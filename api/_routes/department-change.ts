// api/department-change.ts
// Vercel Serverless Function — a staff member asks to move to another
// department (approved rule): the request goes to the CEO, and nothing
// changes until the CEO approves it.
//
//  * request  The person: { toDepartment, toRole?, reason }. The CEO is
//             notified. A CEO can't use this.
//  * cancel   The person, while it is still waiting.
//  * approve / reject
//             The CEO only, with his password. On approve their
//             department (and role, if one was asked for) changes. Their
//             past work stays in the department where they did it.
//
// Body: { action, toDepartment?, toRole?, reason?, requestId?, note?, password? }
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { getCaller, verifyPassword } from '../_shared/reauth';
import { notify, audit } from '../_shared/termination';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Department codes as stored in profiles.role (lower case). Never CEO.
const DEPARTMENTS: Record<string, string> = {
  admin_warehouse: 'Admin & Warehouse', finance: 'Account Department', hr: 'HR', marketing: 'Marketing',
  receptionist: 'Reception', production: 'Production', management: 'Management', risk: 'Risk',
};
// How each department is written in profiles.role by the apps (HR is
// upper case there, the rest lower case); the database compares in lower case.
const STORED: Record<string, string> = { hr: 'HR' };
const stored = (code: string) => STORED[code] || code;
const label = (code: string | null | undefined) => (code ? DEPARTMENTS[String(code).toLowerCase()] || String(code) : 'their department');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'department-change', 20, 60)) return;

  const caller = await getCaller(supabaseAdmin, req, res);
  if (!caller) return;
  const me = caller.user.id;
  const myName = caller.profile.full_name || 'Staff member';
  const isCeo = !!caller.profile.is_admin;
  const body = req.body || {};

  if (body.action === 'request') {
    if (isCeo) return res.status(403).json({ error: 'A CEO does not change department this way.' });
    const to = String(body.toDepartment || '').toLowerCase();
    if (!DEPARTMENTS[to]) return res.status(400).json({ error: 'Pick the department you want to move to.' });
    const from = String(caller.profile.role || '').toLowerCase();
    if (to === from) return res.status(400).json({ error: `You are already in ${label(to)}.` });
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    if (!reason) return res.status(400).json({ error: 'Tell the CEO why you want to move.' });
    const toRole = typeof body.toRole === 'string' ? body.toRole.trim().slice(0, 100) || null : null;

    const { error } = await supabaseAdmin.from('department_change_requests').insert({
      user_id: me, full_name: myName, from_department: from || null, to_department: to, to_role: toRole, reason,
    });
    if (error) {
      return res.status(409).json({ error: /duplicate|unique/i.test(error.message) ? 'You already have a department change request waiting.' : error.message });
    }
    await notify(supabaseAdmin, { department: 'CEO' }, 'Department change request',
      `${myName} asked to move from ${label(from)} to ${label(to)}${toRole ? ` as ${toRole}` : ''}. Approve or reject it in Approvals.`);
    return res.status(200).json({ message: `Your request was sent to the CEO. You stay in ${label(from)} until it is approved.` });
  }

  const requestId = body.requestId;
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return res.status(400).json({ error: 'requestId is required.' });
  const { data: request } = await supabaseAdmin.from('department_change_requests').select('*').eq('id', requestId).maybeSingle();
  if (!request || request.status !== 'pending') return res.status(404).json({ error: 'That request is no longer waiting.' });

  if (body.action === 'cancel') {
    if (request.user_id !== me) return res.status(403).json({ error: 'Only the person who asked can cancel it.' });
    await supabaseAdmin.from('department_change_requests').update({ status: 'cancelled', decided_at: new Date().toISOString() }).eq('id', requestId).eq('status', 'pending');
    return res.status(200).json({ message: 'Request cancelled.' });
  }

  if (body.action !== 'approve' && body.action !== 'reject') return res.status(400).json({ error: 'Unknown action.' });
  if (!isCeo) return res.status(403).json({ error: 'Only the CEO can approve a department change.' });
  if (!(await verifyPassword(supabaseAdmin, res, caller.user, body.password))) return;

  const now = new Date().toISOString();
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
  const { data: claimed } = await supabaseAdmin.from('department_change_requests')
    .update({ status: body.action === 'approve' ? 'approved' : 'rejected', decided_by: me, decided_by_name: myName, decided_at: now, note })
    .eq('id', requestId).eq('status', 'pending').select('id').maybeSingle();
  if (!claimed) return res.status(409).json({ error: 'That request was already decided.' });

  if (body.action === 'reject') {
    await notify(supabaseAdmin, { recipientId: request.user_id }, 'Department change not approved',
      `Your request to move to ${label(request.to_department)} was not approved.${note ? ` Note: ${note}` : ''}`);
    await audit(supabaseAdmin, 'DEPARTMENT_CHANGE_REJECTED', 'CEO', myName, me, request.user_id, `${request.full_name}'s move to ${label(request.to_department)} rejected.`);
    return res.status(200).json({ message: `Rejected. ${request.full_name} stays in ${label(request.from_department)}.` });
  }

  const { data: target } = await supabaseAdmin.from('profiles').select('id, status, is_admin, metadata').eq('id', request.user_id).maybeSingle();
  if (!target || target.is_admin || String(target.status || '').toUpperCase() !== 'ACTIVE') {
    await supabaseAdmin.from('department_change_requests').update({ status: 'pending', decided_by: null, decided_by_name: null, decided_at: null }).eq('id', requestId);
    return res.status(409).json({ error: 'That person is no longer an active staff member.' });
  }
  const metadata = { ...(target.metadata || {}), ...(request.to_role ? { role: request.to_role } : {}) };
  const { error: updateError } = await supabaseAdmin.from('profiles')
    .update({ role: stored(String(request.to_department).toLowerCase()), metadata, updated_at: now }).eq('id', request.user_id);
  if (updateError) {
    await supabaseAdmin.from('department_change_requests').update({ status: 'pending', decided_by: null, decided_by_name: null, decided_at: null }).eq('id', requestId);
    return res.status(500).json({ error: `Could not change their department: ${updateError.message}` });
  }
  await notify(supabaseAdmin, { recipientId: request.user_id }, 'Department change approved',
    `You are now in ${label(request.to_department)}${request.to_role ? ` as ${request.to_role}` : ''}. Sign out and back in if your menu has not changed yet.`);
  await notify(supabaseAdmin, { department: 'HR' }, 'Staff moved department',
    `${request.full_name} moved from ${label(request.from_department)} to ${label(request.to_department)}, approved by the CEO.`);
  await audit(supabaseAdmin, 'DEPARTMENT_CHANGED', 'CEO', myName, me, request.user_id,
    `${request.full_name} moved from ${label(request.from_department)} to ${label(request.to_department)}${request.to_role ? ` as ${request.to_role}` : ''}.`);
  return res.status(200).json({ message: `${request.full_name} is now in ${label(request.to_department)}.` });
}
