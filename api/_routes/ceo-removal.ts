// api/ceo-removal.ts
// Vercel Serverless Function — removing a CEO (Step 2). Approved rule:
// removing a CEO needs two CEOs. One requests it; a different CEO approves.
// With two CEOs that means the one being removed must agree, so neither CEO
// can ever take sole control by removing the other.
//
// Body:
//   { action: 'request', targetId, reason, password }
//   { action: 'approve', requestId, password }   any CEO except the requester
//   { action: 'reject',  requestId, password }   any CEO except the requester
//   { action: 'cancel',  requestId }             the requester only
//
// On approval the CEO is removed the same way Terminate removes staff
// (Step 4): sign-in locked for good, sessions ended, profile kept as
// TERMINATED (no longer CEO). NOTHING is deleted; all their work stays in
// the system. At least one active CEO always remains.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { requireCeo, verifyPassword } from '../_shared/reauth';
import { endAllSessions, lockSignIn } from '../_shared/accountControl';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function audit(action: string, performedBy: string, userId: string, referenceId: string, details: string) {
  await supabaseAdmin.from('global_audit_history').insert({
    action, department: 'CEO', performed_by: performedBy, user_id: userId, reference_id: referenceId, details, timestamp: new Date().toISOString(),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'ceo-removal', 10, 60)) return;

  const caller = await requireCeo(supabaseAdmin, req, res);
  if (!caller) return;
  const me = caller.user.id;
  const myName = caller.profile.full_name || 'CEO';
  const { action } = req.body || {};

  if (action === 'request') {
    const { targetId, reason, password } = req.body || {};
    if (!targetId || targetId === me) return res.status(400).json({ error: 'Pick another CEO to remove.' });
    const { data: target } = await supabaseAdmin.from('profiles').select('id, full_name, is_admin, status').eq('id', targetId).maybeSingle();
    if (!target?.is_admin || String(target.status || '').toUpperCase() !== 'ACTIVE') {
      return res.status(404).json({ error: 'That person is not an active CEO.' });
    }
    if (!(await verifyPassword(supabaseAdmin, res, caller.user, password))) return;

    const { data: created, error } = await supabaseAdmin.from('ceo_removal_requests').insert({
      target_id: targetId, target_name: target.full_name, requested_by: me, requested_by_name: myName,
      reason: String(reason || '').trim().slice(0, 500) || null,
    }).select('id').single();
    if (error) {
      return res.status(409).json({ error: /duplicate|unique/i.test(error.message) ? 'A removal request for this CEO is already waiting.' : error.message });
    }
    await supabaseAdmin.from('notifications').insert({
      recipient_department: 'CEO', type: 'approval', read: false, created_at: new Date().toISOString(),
      title: 'CEO removal requested',
      message: `${myName} has asked to remove ${target.full_name} as CEO. Another CEO must approve it in Control Center, then CEO Account.`,
    });
    await audit('CEO_REMOVAL_REQUESTED', myName, me, created.id, `Removal of ${target.full_name} as CEO requested.${reason ? ` Reason: ${reason}` : ''}`);
    return res.status(200).json({ message: `Removal request sent. Another CEO must approve it before ${target.full_name} is removed.` });
  }

  const { requestId, password } = req.body || {};
  if (!requestId) return res.status(400).json({ error: 'requestId is required.' });
  const { data: request } = await supabaseAdmin.from('ceo_removal_requests').select('*').eq('id', requestId).maybeSingle();
  if (!request || request.status !== 'pending') return res.status(404).json({ error: 'That request is no longer waiting.' });

  if (action === 'cancel') {
    if (request.requested_by !== me) return res.status(403).json({ error: 'Only the CEO who asked can cancel this request.' });
    await supabaseAdmin.from('ceo_removal_requests').update({ status: 'cancelled', decided_by: me, decided_by_name: myName, decided_at: new Date().toISOString() }).eq('id', requestId);
    await audit('CEO_REMOVAL_CANCELLED', myName, me, requestId, `Request to remove ${request.target_name} as CEO was cancelled.`);
    return res.status(200).json({ message: 'Request cancelled.' });
  }

  if (action !== 'approve' && action !== 'reject') return res.status(400).json({ error: 'Unknown action.' });
  if (request.requested_by === me) return res.status(403).json({ error: 'A different CEO must decide on this request.' });
  if (!(await verifyPassword(supabaseAdmin, res, caller.user, password))) return;

  if (action === 'reject') {
    await supabaseAdmin.from('ceo_removal_requests').update({ status: 'rejected', decided_by: me, decided_by_name: myName, decided_at: new Date().toISOString() }).eq('id', requestId).eq('status', 'pending');
    await audit('CEO_REMOVAL_REJECTED', myName, me, requestId, `Request to remove ${request.target_name} as CEO was rejected.`);
    return res.status(200).json({ message: `Request rejected. ${request.target_name} stays CEO.` });
  }

  // Approve. Never leave the company without an active CEO.
  const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true).eq('status', 'ACTIVE').neq('id', request.target_id);
  if ((count || 0) < 1) return res.status(409).json({ error: 'This would leave no active CEO, so it was not done.' });

  // Claim the request so it can only be carried out once.
  const { data: claimed } = await supabaseAdmin.from('ceo_removal_requests')
    .update({ status: 'approved', decided_by: me, decided_by_name: myName, decided_at: new Date().toISOString() })
    .eq('id', requestId).eq('status', 'pending').select('id').maybeSingle();
  if (!claimed) return res.status(409).json({ error: 'That request was already decided.' });

  const lock = await lockSignIn(supabaseAdmin, request.target_id);
  if (!lock.ok) {
    await supabaseAdmin.from('ceo_removal_requests').update({ status: 'pending', decided_by: null, decided_by_name: null, decided_at: null }).eq('id', requestId);
    return res.status(500).json({ error: `Could not lock their sign-in: ${lock.error}` });
  }
  const { error: profileError } = await supabaseAdmin.from('profiles')
    .update({ is_admin: false, status: 'TERMINATED', updated_at: new Date().toISOString() })
    .eq('id', request.target_id);
  if (profileError) return res.status(500).json({ error: `Sign-in locked, but CEO access could not be removed: ${profileError.message}` });
  await endAllSessions(supabaseAdmin, request.target_id);

  await audit('CEO_REMOVED', myName, me, request.target_id, `${request.target_name} was removed as CEO. Requested by ${request.requested_by_name}, approved by ${myName}.`);
  return res.status(200).json({ message: `${request.target_name} has been removed as CEO.` });
}
