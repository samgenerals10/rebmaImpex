// api/set-user-status.ts
// Vercel Serverless Function — Suspend / Reactivate / Block / Unblock
// (Step 2). These used to be changed straight from the phone or browser
// with no server check. Now:
//   * the CEO can do all four, on anyone except himself or another CEO;
//   * HR can only Suspend and Reactivate ordinary staff (never HR,
//     Management or CEO accounts), as HR's staff screen always allowed;
//   * the password is checked on the server (api/_shared/reauth.ts);
//   * Suspend and Block lock the person's sign-in and end all their
//     sessions; Reactivate and Unblock unlock it;
//   * every action is logged with the CEO's name.
//
// Body: { userId, action: 'suspend' | 'reactivate' | 'block' | 'unblock', password }
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { getCaller, verifyPassword } from './_shared/reauth';
import { endAllSessions, lockSignIn, unlockSignIn } from './_shared/accountControl';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ACTIONS = {
  suspend:    { from: ['ACTIVE'],    to: 'SUSPENDED', lock: true,  verb: 'suspended',   audit: 'SUSPEND_USER' },
  block:      { from: ['ACTIVE', 'SUSPENDED'], to: 'BLOCKED', lock: true, verb: 'blocked', audit: 'BLOCK_USER' },
  reactivate: { from: ['SUSPENDED'], to: 'ACTIVE',    lock: false, verb: 'reactivated', audit: 'REACTIVATE_USER' },
  unblock:    { from: ['BLOCKED'],   to: 'ACTIVE',    lock: false, verb: 'unblocked',   audit: 'UNBLOCK_USER' },
} as const;
type Action = keyof typeof ACTIONS;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'set-user-status', 30, 60)) return;

  const caller = await getCaller(supabaseAdmin, req, res);
  if (!caller) return;
  const isCeo = !!caller.profile.is_admin;
  const isHr = String(caller.profile.role || '').toUpperCase() === 'HR';
  if (!isCeo && !isHr) return res.status(403).json({ error: 'Only the CEO or HR can change account status.' });

  const { userId, action, password } = req.body || {};
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'userId is required.' });
  if (!(action in ACTIONS)) return res.status(400).json({ error: 'Unknown action.' });
  const rule = ACTIONS[action as Action];
  if (!isCeo && (action === 'block' || action === 'unblock')) {
    return res.status(403).json({ error: 'Only the CEO can block or unblock an account.' });
  }

  if (userId === caller.user.id) return res.status(400).json({ error: 'You cannot do this to your own account.' });

  const { data: target } = await supabaseAdmin.from('profiles').select('id, full_name, role, status, is_admin').eq('id', userId).maybeSingle();
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.is_admin || String(target.role || '').toUpperCase() === 'CEO') {
    return res.status(403).json({ error: 'A CEO account cannot be suspended or blocked. Removing a CEO needs both CEOs.' });
  }
  if (!isCeo && ['HR', 'MANAGEMENT'].includes(String(target.role || '').toUpperCase())) {
    return res.status(403).json({ error: 'Only the CEO can suspend HR or Management accounts.' });
  }
  const current = String(target.status || '').toUpperCase();
  if (!(rule.from as readonly string[]).includes(current)) {
    return res.status(409).json({ error: `${target.full_name || 'This user'} is ${current.toLowerCase() || 'in another state'}, so they can't be ${rule.verb}.` });
  }

  if (!(await verifyPassword(supabaseAdmin, res, caller.user, password))) return;

  // Lock or unlock sign-in first, so a failure leaves the status unchanged.
  const signIn = rule.lock ? await lockSignIn(supabaseAdmin, userId) : await unlockSignIn(supabaseAdmin, userId);
  if (!signIn.ok) return res.status(500).json({ error: `Could not update their sign-in: ${signIn.error}` });

  const { error: updateError } = await supabaseAdmin.from('profiles').update({ status: rule.to, updated_at: new Date().toISOString() }).eq('id', userId);
  if (updateError) {
    // Put sign-in back the way it was.
    if (rule.lock) await unlockSignIn(supabaseAdmin, userId); else await lockSignIn(supabaseAdmin, userId);
    return res.status(500).json({ error: `Could not update their status: ${updateError.message}` });
  }

  let sessionNote = '';
  if (rule.lock) {
    const ended = await endAllSessions(supabaseAdmin, userId);
    if (!ended.ok) sessionNote = ' Their open sessions could not be ended right away, but they can no longer sign in.';
  }

  await supabaseAdmin.from('global_audit_history').insert({
    action: rule.audit, department: isCeo ? 'CEO' : 'HR', performed_by: caller.profile.full_name || (isCeo ? 'CEO' : 'HR'), user_id: caller.user.id,
    reference_id: userId, details: `${target.full_name || userId} was ${rule.verb}.`, timestamp: new Date().toISOString(),
  });

  return res.status(200).json({ status: rule.to, message: `${target.full_name || 'User'} was ${rule.verb}.${sessionNote}` });
}
