// api/_shared/termination.ts
//
// Ending someone's account (CEO terminating them, or HR confirming their
// own Delete Account request). Approved rule:
//  * It takes effect at once: sign-in locked for good, every session
//    ended, status TERMINATED.
//  * NOTHING is deleted. Their profile, attendance and all the work they
//    did (orders, customers, payments, cargo, approvals...) stay in the
//    system, still under their name, and the department keeps seeing it.
//    A new hire gets their own new profile and sees the same work.
//  * Spreadsheets and tasks they made themselves were only visible to
//    them; they are now shared with their department so nothing is stuck.
//  * Their chats and meetings stay private and are not moved to anyone.
// Open deliveries of a driver who is terminated are counted so Risk can
// pick another driver in Dispatch.
import type { SupabaseClient } from '@supabase/supabase-js';
import { endAllSessions, lockSignIn } from './accountControl';

export type PersonKind = 'app' | 'no_app';

export interface Person {
  kind: PersonKind;
  id: string;
  fullName: string;
  department: string | null; // role column / department code, lower case
  status: string;
  isCeo: boolean;
}

export async function loadPerson(supabaseAdmin: SupabaseClient, kind: PersonKind, id: string): Promise<Person | null> {
  if (kind === 'app') {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, role, is_admin, status').eq('id', id).maybeSingle();
    if (!data) return null;
    return {
      kind, id: data.id, fullName: data.full_name || 'Employee', department: data.role ? String(data.role).toLowerCase() : null,
      status: String(data.status || '').toUpperCase(), isCeo: !!data.is_admin || String(data.role || '').toUpperCase() === 'CEO',
    };
  }
  const { data } = await supabaseAdmin.from('non_app_staff').select('id, full_name, department, status').eq('id', id).maybeSingle();
  if (!data) return null;
  return {
    kind, id: data.id, fullName: data.full_name || 'Employee', department: data.department ? String(data.department).toLowerCase() : null,
    status: String(data.status || '').toUpperCase(), isCeo: false,
  };
}

// HR and Management staff are the CEO's to handle (approved rule).
export const isHrOrManagement = (p: Person) => p.department === 'hr' || p.department === 'management';

// Their own spreadsheets and tasks become visible to their department.
// Best effort: a table or column that isn't there yet never blocks the
// termination itself.
async function shareTheirWork(supabaseAdmin: SupabaseClient, personId: string) {
  try {
    await supabaseAdmin.from('spreadsheets').update({ shared_with_department: true }).eq('created_by_id', personId);
  } catch { /* column added by supabase_staff_lifecycle.sql */ }
  try {
    await supabaseAdmin.from('tasks').update({ shared: true }).eq('user_id', personId);
  } catch { /* tasks table may not exist */ }
}

export async function terminatePerson(supabaseAdmin: SupabaseClient, person: Person): Promise<{ ok: boolean; error?: string }> {
  if (person.kind === 'no_app') {
    const { error } = await supabaseAdmin.from('non_app_staff').update({ status: 'TERMINATED' }).eq('id', person.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  // Lock first: if anything after this fails, they still can't sign in.
  const lock = await lockSignIn(supabaseAdmin, person.id);
  if (!lock.ok) return { ok: false, error: `Could not lock their sign-in: ${lock.error}` };
  const { error } = await supabaseAdmin.from('profiles')
    .update({ status: 'TERMINATED', is_admin: false, updated_at: new Date().toISOString() })
    .eq('id', person.id);
  if (error) return { ok: false, error: `Sign-in locked, but their status could not be set: ${error.message}` };
  await endAllSessions(supabaseAdmin, person.id);
  await shareTheirWork(supabaseAdmin, person.id);
  return { ok: true };
}

// Open deliveries assigned to a driver who was terminated; Risk reassigns them.
export async function countOpenDeliveries(supabaseAdmin: SupabaseClient, personId: string): Promise<number> {
  try {
    const { data: drivers } = await supabaseAdmin.from('drivers').select('*').eq('user_id', personId);
    const ids = (drivers || []).map((d: any) => d.id ?? d.driver_id).filter(Boolean);
    if (!ids.length) return 0;
    const { count } = await supabaseAdmin.from('delivery_logs').select('id', { count: 'exact', head: true })
      .in('driver_id', ids).not('status', 'in', '(DELIVERED,FAILED,CANCELLED)');
    return count || 0;
  } catch {
    return 0;
  }
}

export async function notify(supabaseAdmin: SupabaseClient, target: { recipientId?: string; department?: string }, title: string, message: string) {
  await supabaseAdmin.from('notifications').insert({
    recipient_id: target.recipientId || null, recipient_department: target.department || null,
    type: 'approval', read: false, created_at: new Date().toISOString(), title, message,
  });
}

export async function audit(supabaseAdmin: SupabaseClient, action: string, department: string, performedBy: string, userId: string, referenceId: string, details: string) {
  await supabaseAdmin.from('global_audit_history').insert({
    action, department, performed_by: performedBy, user_id: userId, reference_id: referenceId, details, timestamp: new Date().toISOString(),
  });
}

// ── Continue previous work (approved rule) ────────────────────────────
// When HR hires someone into the same department and role as a person who
// was terminated, HR chooses "Continue previous work" or "Start new". On
// Continue, once the new hire is approved, the open work the previous
// person was handling becomes theirs:
//   - open tasks they owned or were assigned
//   - spreadsheets they made (the new person becomes the owner)
//   - open orders, pending customers and pending cargo they looked after
//     (who gets told about them from now on; who created them is kept)
// Chats and meetings are personal and never move. Past work always keeps
// the previous person's name. Start new moves nothing: all the previous
// work stays in the system for the department either way.
type Moved = Record<string, number | string>;

async function step(moved: Moved, key: string, run: () => Promise<number>) {
  try { moved[key] = await run(); } catch (e: any) { moved[key] = `not moved: ${e?.message || 'unknown error'}`; }
}

const OPEN_ORDER_FILTER = '(DELIVERED,REJECTED,CANCELLED)';
const PENDING_CUSTOMER = ['PENDING', 'RETURNED_FOR_CORRECTION'];
const PENDING_CARGO = ['PENDING_RISK_APPROVAL', 'PENDING_MANAGEMENT_APPROVAL', 'RETURNED_FOR_CORRECTION'];

export async function continueWork(supabaseAdmin: SupabaseClient, fromId: string, to: { id: string; name: string }): Promise<Moved> {
  const moved: Moved = {};
  await step(moved, 'tasks', async () => {
    const own = await supabaseAdmin.from('tasks').update({ user_id: to.id }).eq('user_id', fromId).neq('status', 'done').select('id');
    if (own.error) throw own.error;
    const assigned = await supabaseAdmin.from('tasks').update({ assigned_to: to.id }).eq('assigned_to', fromId).neq('status', 'done').select('id');
    if (assigned.error) throw assigned.error;
    return (own.data?.length || 0) + (assigned.data?.length || 0);
  });
  await step(moved, 'spreadsheets', async () => {
    const { data, error } = await supabaseAdmin.from('spreadsheets')
      .update({ created_by_id: to.id, created_by_name: to.name, updated_at: new Date().toISOString() })
      .eq('created_by_id', fromId).select('id');
    if (error) throw error;
    return data?.length || 0;
  });
  const handled = { handled_by_id: to.id, handled_by_name: to.name };
  await step(moved, 'openOrders', async () => {
    const a = await supabaseAdmin.from('orders').update(handled).eq('handled_by_id', fromId).not('status', 'in', OPEN_ORDER_FILTER).select('id');
    if (a.error) throw a.error;
    const b = await supabaseAdmin.from('orders').update(handled).is('handled_by_id', null).eq('created_by', fromId).not('status', 'in', OPEN_ORDER_FILTER).select('id');
    if (b.error) throw b.error;
    return (a.data?.length || 0) + (b.data?.length || 0);
  });
  await step(moved, 'pendingCustomers', async () => {
    const a = await supabaseAdmin.from('customers').update(handled).eq('handled_by_id', fromId).in('status', PENDING_CUSTOMER).select('id');
    if (a.error) throw a.error;
    const b = await supabaseAdmin.from('customers').update(handled).is('handled_by_id', null).eq('registered_by_id', fromId).in('status', PENDING_CUSTOMER).select('id');
    if (b.error) throw b.error;
    return (a.data?.length || 0) + (b.data?.length || 0);
  });
  await step(moved, 'pendingCargo', async () => {
    const a = await supabaseAdmin.from('cargo_intake').update(handled).eq('handled_by_id', fromId).in('status', PENDING_CARGO).select('id');
    if (a.error) throw a.error;
    const b = await supabaseAdmin.from('cargo_intake').update(handled).is('handled_by_id', null).eq('logged_by_id', fromId).in('status', PENDING_CARGO).select('id');
    if (b.error) throw b.error;
    return (a.data?.length || 0) + (b.data?.length || 0);
  });
  return moved;
}

export function describeMoved(moved: Moved): string {
  const labels: Record<string, string> = {
    tasks: 'open tasks', spreadsheets: 'spreadsheets', openOrders: 'open orders', pendingCustomers: 'pending customers', pendingCargo: 'pending cargo',
  };
  return Object.entries(moved).filter(([k]) => labels[k]).map(([k, v]) => (typeof v === 'number' ? `${v} ${labels[k]}` : `${labels[k]} ${v}`)).join(', ');
}
