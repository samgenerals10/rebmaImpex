// api/account-deletion.ts
// Vercel Serverless Function — "Delete Account" in Settings (approved rule):
// the person asks, HR confirms, and only then is the account closed.
//
//  * request  The person, with their own password (so nobody can do it
//             from a phone left signed in). HR is notified. A CEO can't
//             use this; removing a CEO needs both CEOs in Control Center.
//  * cancel   The person, while it is still waiting.
//  * approve / reject
//             HR, with their password. Requests from HR or Management
//             staff are confirmed by the CEO instead (same rule as
//             everywhere else: HR doesn't act on HR or Management).
// Closing the account is the same as termination: sign-in locked, nothing
// deleted, all their work stays in the system (api/_shared/termination.ts).
//
// Body: { action, reason?, requestId?, note?, password? }
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { getCaller, verifyPassword } from '../_shared/reauth';
import { loadPerson, terminatePerson, isHrOrManagement, notify, audit } from '../_shared/termination';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'account-deletion', 10, 60)) return;

  const caller = await getCaller(supabaseAdmin, req, res);
  if (!caller) return;
  const me = caller.user.id;
  const myName = caller.profile.full_name || 'Staff member';
  const isCeo = !!caller.profile.is_admin;
  const isHr = String(caller.profile.role || '').toUpperCase() === 'HR';
  const body = req.body || {};

  if (body.action === 'request') {
    const person = await loadPerson(supabaseAdmin, 'app', me);
    if (!person) return res.status(404).json({ error: 'Your profile was not found.' });
    if (person.isCeo) return res.status(403).json({ error: 'A CEO account is removed by the other CEO in Control Center, not here.' });
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    if (!reason) return res.status(400).json({ error: 'Tell HR why you want to delete your account.' });
    if (!(await verifyPassword(supabaseAdmin, res, caller.user, body.password))) return;

    const confirmer = isHrOrManagement(person) ? 'CEO' : 'HR';
    const { error } = await supabaseAdmin.from('account_deletion_requests').insert({
      user_id: me, full_name: person.fullName, department: person.department, reason, confirmer,
    });
    if (error) {
      return res.status(409).json({ error: /duplicate|unique/i.test(error.message) ? 'You already have a request waiting.' : error.message });
    }
    await notify(supabaseAdmin, { department: confirmer }, 'Account deletion request',
      `${person.fullName} asked to delete their account. Confirm or reject it in ${confirmer === 'HR' ? 'HR, Staff' : 'Approvals'}.`);
    await audit(supabaseAdmin, 'ACCOUNT_DELETION_REQUESTED', 'HR', myName, me, me, `${person.fullName} asked to delete their account.`);
    return res.status(200).json({ message: `Your request was sent to ${confirmer === 'HR' ? 'HR' : 'the CEO'}. Your account stays open until they confirm it.` });
  }

  const requestId = body.requestId;
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return res.status(400).json({ error: 'requestId is required.' });
  const { data: request } = await supabaseAdmin.from('account_deletion_requests').select('*').eq('id', requestId).maybeSingle();
  if (!request || request.status !== 'pending') return res.status(404).json({ error: 'That request is no longer waiting.' });

  if (body.action === 'cancel') {
    if (request.user_id !== me) return res.status(403).json({ error: 'Only the person who asked can cancel it.' });
    await supabaseAdmin.from('account_deletion_requests').update({ status: 'cancelled', decided_at: new Date().toISOString() }).eq('id', requestId).eq('status', 'pending');
    return res.status(200).json({ message: 'Request cancelled. Your account stays open.' });
  }

  if (body.action !== 'approve' && body.action !== 'reject') return res.status(400).json({ error: 'Unknown action.' });
  const allowed = request.confirmer === 'CEO' ? isCeo : (isHr || isCeo);
  if (!allowed) return res.status(403).json({ error: request.confirmer === 'CEO' ? 'Only the CEO can confirm this request.' : 'Only HR or the CEO can confirm this request.' });
  if (request.user_id === me) return res.status(400).json({ error: 'You cannot confirm your own request.' });
  if (!(await verifyPassword(supabaseAdmin, res, caller.user, body.password))) return;

  // Claim it so it is only carried out once.
  const now = new Date().toISOString();
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
  const { data: claimed } = await supabaseAdmin.from('account_deletion_requests')
    .update({ status: body.action === 'approve' ? 'approved' : 'rejected', decided_by: me, decided_by_name: myName, decided_at: now, note })
    .eq('id', requestId).eq('status', 'pending').select('id').maybeSingle();
  if (!claimed) return res.status(409).json({ error: 'That request was already decided.' });

  if (body.action === 'reject') {
    await notify(supabaseAdmin, { recipientId: request.user_id }, 'Account deletion request rejected',
      `Your request to delete your account was not confirmed.${note ? ` Note: ${note}` : ''} Your account stays open.`);
    await audit(supabaseAdmin, 'ACCOUNT_DELETION_REJECTED', 'HR', myName, me, request.user_id, `Request from ${request.full_name} rejected.`);
    return res.status(200).json({ message: `Rejected. ${request.full_name}'s account stays open.` });
  }

  const person = await loadPerson(supabaseAdmin, 'app', request.user_id);
  if (!person || person.isCeo) {
    await supabaseAdmin.from('account_deletion_requests').update({ status: 'pending', decided_by: null, decided_by_name: null, decided_at: null }).eq('id', requestId);
    return res.status(409).json({ error: 'That account can no longer be closed here.' });
  }
  const done = await terminatePerson(supabaseAdmin, person);
  if (!done.ok) {
    await supabaseAdmin.from('account_deletion_requests').update({ status: 'pending', decided_by: null, decided_by_name: null, decided_at: null }).eq('id', requestId);
    return res.status(500).json({ error: done.error });
  }
  await audit(supabaseAdmin, 'ACCOUNT_DELETION_CONFIRMED', 'HR', myName, me, request.user_id,
    `${request.full_name}'s account was closed at their request. Nothing was deleted; all their work stays in the system.`);
  return res.status(200).json({ message: `${request.full_name}'s account is closed. All their work stays in the system.` });
}
