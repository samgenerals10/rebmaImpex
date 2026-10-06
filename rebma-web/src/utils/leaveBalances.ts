// Leave balances: HR sets how many days per year each leave type gives
// everyone (leave_entitlements), and each person's used days come from
// their APPROVED leave requests that start in the chosen year. Leave
// requests are stored by name (staff_name), not by id, so people are
// matched on their name with case and extra spaces ignored.
import { supabase } from '../lib/supabaseClient';

export const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Emergency'] as const;
export type LeaveType = typeof LEAVE_TYPES[number];

/** Days per year for each leave type; a missing type has no allowance set. */
export type Entitlements = Partial<Record<LeaveType, number>>;

export async function loadEntitlements(): Promise<Entitlements> {
  const { data, error } = await supabase.from('leave_entitlements').select('leave_type, days_per_year');
  if (error) throw error;
  const out: Entitlements = {};
  for (const r of data || []) {
    if ((LEAVE_TYPES as readonly string[]).includes(r.leave_type)) out[r.leave_type as LeaveType] = Number(r.days_per_year);
  }
  return out;
}

/** Save HR's allowances. A blank (undefined) type is removed, meaning no allowance. */
export async function saveEntitlements(next: Entitlements, updatedBy: string): Promise<void> {
  const now = new Date().toISOString();
  const rows = LEAVE_TYPES.filter(t => next[t] !== undefined)
    .map(t => ({ leave_type: t, days_per_year: next[t]!, updated_by: updatedBy, updated_at: now }));
  const cleared = LEAVE_TYPES.filter(t => next[t] === undefined);
  if (rows.length) {
    const { error } = await supabase.from('leave_entitlements').upsert(rows, { onConflict: 'leave_type' });
    if (error) throw error;
  }
  if (cleared.length) {
    const { error } = await supabase.from('leave_entitlements').delete().in('leave_type', cleared);
    if (error) throw error;
  }
}

export interface LeaveRow { staffName: string; leaveType: string; startDate: string; days: number; status: string }
export interface StaffRow { key: string; fullName: string; department: string }

export interface TypeBalance { allowed: number | null; used: number; left: number | null }
export interface BalanceRow { key: string; name: string; department: string; byType: Record<LeaveType, TypeBalance> }

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function computeBalances(staff: StaffRow[], leaves: LeaveRow[], ent: Entitlements, year: number): BalanceRow[] {
  const used = new Map<string, number>();
  for (const l of leaves) {
    if (String(l.status).toUpperCase() !== 'APPROVED') continue;
    if (!l.startDate || Number(l.startDate.slice(0, 4)) !== year) continue;
    const k = `${norm(l.staffName)}|${l.leaveType}`;
    used.set(k, (used.get(k) || 0) + (Number(l.days) || 0));
  }
  return staff.map(s => {
    const byType = {} as Record<LeaveType, TypeBalance>;
    for (const t of LEAVE_TYPES) {
      const u = used.get(`${norm(s.fullName)}|${t}`) || 0;
      const allowed = ent[t] ?? null;
      byType[t] = { allowed, used: u, left: allowed === null ? null : allowed - u };
    }
    return { key: s.key, name: s.fullName, department: s.department, byType };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
