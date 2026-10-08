// api/ceo-change-email.ts
// Control Center → CEO Account → Change Email. Step 1 of 2.
//
//   1. The CEO types his current password (checked on the server).
//   2. A one-time confirmation link is emailed to the NEW address. Nothing
//      changes yet. A heads-up also goes to the CURRENT address, so a
//      change nobody asked for gets noticed.
//   3. The change only happens when that link is opened
//      (api/ceo-confirm-email-change.ts). Links last 1 hour and work once.
//
// The link token is random and only its SHA-256 hash is stored, so a copy
// of the database can't be used to confirm a change.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';
import { isRateLimited } from '../_shared/rateLimit';
import { requireCeo, verifyPassword } from '../_shared/reauth';
import { sendMail, esc, isMailConfigured } from '../_shared/mailer';
import { getAppOrigin } from '../_shared/settings';
import { findUserByEmail } from '../_shared/findUserByEmail';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const LINK_MINUTES = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'ceo-change-email', 10, 60)) return;

  const caller = await requireCeo(supabaseAdmin, req, res);
  if (!caller) return;

  const { password, newEmail } = req.body || {};
  const target = String(newEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(target)) return res.status(400).json({ error: 'Enter a valid new email address.' });
  const current = String(caller.user.email || '').toLowerCase();
  if (target === current) return res.status(400).json({ error: 'That is already your email.' });

  if (!(await verifyPassword(supabaseAdmin, res, caller.user, password))) return;

  // The confirmation step is mandatory, so without email there is no change.
  if (!(await isMailConfigured(supabaseAdmin))) {
    return res.status(503).json({ error: 'Email is not set up yet (Control Center, then API Keys, then Gmail or Resend), so the confirmation link cannot be sent. Nothing was changed.' });
  }
  if (await findUserByEmail(supabaseAdmin, target)) {
    return res.status(409).json({ error: 'That email already belongs to another account.' });
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + LINK_MINUTES * 60_000).toISOString();

  // Any earlier unconfirmed request is cancelled; only the newest link works.
  await supabaseAdmin.from('ceo_email_change_requests').update({ used_at: new Date().toISOString() }).eq('user_id', caller.user.id).is('used_at', null);
  const { error: insertError } = await supabaseAdmin.from('ceo_email_change_requests').insert({
    user_id: caller.user.id, old_email: current, new_email: target, token_hash: tokenHash, expires_at: expiresAt,
  });
  if (insertError) return res.status(500).json({ error: `Could not start the change: ${insertError.message}` });

  const origin = await getAppOrigin(supabaseAdmin, req.headers.origin as string);
  const link = `${origin}/confirm-email-change?token=${token}`;
  const name = caller.profile.full_name || '';

  const sent = await sendMail(
    supabaseAdmin,
    target,
    'Confirm your new Rebma Impex Ghana Limited sign-in email',
    `Hi ${name},\n\nA request was made to change your Rebma Impex Ghana Limited sign-in email to this address. To confirm, open this link within ${LINK_MINUTES} minutes:\n${link}\n\nIf you didn't ask for this, ignore this email and nothing will change.\n\nRebma Impex`,
    `<p>Hi ${esc(name)},</p><p>A request was made to change your Rebma Impex Ghana Limited sign-in email to this address. To confirm, open this link within ${LINK_MINUTES} minutes:</p><p><a href="${esc(link)}">Confirm my new email</a></p><p>If you didn't ask for this, ignore this email and nothing will change.</p><p>Rebma Impex</p>`,
  );
  if (!sent.sent) {
    await supabaseAdmin.from('ceo_email_change_requests').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    return res.status(502).json({ error: `The confirmation email could not be sent, so nothing was changed. ${sent.reason || ''}`.trim() });
  }

  // Heads-up to the current address (never contains the link).
  await sendMail(
    supabaseAdmin,
    current,
    'Your Rebma Impex Ghana Limited sign-in email is being changed',
    `Hi ${name},\n\nA change of your sign-in email to ${target} was requested from Control Center. It only takes effect once confirmed from that address. If this wasn't you, change your password straight away.\n\nRebma Impex Ghana Limited`,
    `<p>Hi ${esc(name)},</p><p>A change of your sign-in email to <strong>${esc(target)}</strong> was requested from Control Center. It only takes effect once confirmed from that address.</p><p>If this wasn't you, change your password straight away.</p>`,
  ).catch(() => ({ sent: false }));

  await supabaseAdmin.from('global_audit_history').insert({
    action: 'CEO_EMAIL_CHANGE_REQUESTED', department: 'CEO', performed_by: name || 'CEO', user_id: caller.user.id,
    reference_id: caller.user.id, details: `Sign-in email change to ${target} requested. Waiting for confirmation.`, timestamp: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, message: `A confirmation link was sent to ${target}. Your email changes once you open it (within ${LINK_MINUTES} minutes).` });
}
