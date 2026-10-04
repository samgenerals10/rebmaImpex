// api/ceo-confirm-email-change.ts
// Step 2 of 2 of the CEO email change (see ceo-change-email.ts). Called by
// the web page the confirmation link opens (/confirm-email-change). No
// sign-in needed: holding the one-time link sent to the new address is the
// proof. The link works once, within its hour, and only its hash is stored.
//
// On success the CEO's sign-in email switches, his profile email follows,
// and the old address is told the change went through.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { isRateLimited } from './_shared/rateLimit';
import { sendMail, esc } from './_shared/mailer';
import { findUserByEmail } from './_shared/findUserByEmail';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Public endpoint guarded by a 256-bit token; tight limit stops guessing.
  if (await isRateLimited(supabaseAdmin, req, res, 'ceo-confirm-email-change', 10, 60)) return;

  const token = String(req.body?.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'This confirmation link is not valid.' });
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data: request } = await supabaseAdmin
    .from('ceo_email_change_requests')
    .select('id, user_id, old_email, new_email, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!request || request.used_at) return res.status(410).json({ error: 'This confirmation link has already been used or was cancelled.' });
  if (new Date(request.expires_at).getTime() < Date.now()) return res.status(410).json({ error: 'This confirmation link has expired. Request the change again from Control Center.' });

  // Claim it first, so the same link can never be used twice.
  const { data: claimed } = await supabaseAdmin
    .from('ceo_email_change_requests')
    .update({ used_at: new Date().toISOString() })
    .eq('id', request.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return res.status(410).json({ error: 'This confirmation link has already been used.' });

  // The account must still be an active CEO, and the new email still free.
  const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, is_admin, status').eq('id', request.user_id).maybeSingle();
  if (!profile?.is_admin || String(profile.status || '').toUpperCase() !== 'ACTIVE') {
    return res.status(403).json({ error: 'This account can no longer change the CEO email.' });
  }
  const other = await findUserByEmail(supabaseAdmin, request.new_email);
  if (other && other.id !== request.user_id) return res.status(409).json({ error: 'That email now belongs to another account, so nothing was changed.' });

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(request.user_id, { email: request.new_email, email_confirm: true });
  if (authError) return res.status(500).json({ error: `Could not change the sign-in email: ${authError.message}` });
  await supabaseAdmin.from('profiles').update({ email: request.new_email, updated_at: new Date().toISOString() }).eq('id', request.user_id);
  // Keep the app's recorded CEO email (Control Center) in step, if it was
  // this CEO's. The Vercel CEO_EMAIL stays as the spare.
  const { data: stored } = await supabaseAdmin.from('ceo_settings').select('setting_value').eq('setting_key', 'ceo_email').maybeSingle();
  const storedEmail = typeof stored?.setting_value === 'string' ? stored.setting_value.replace(/"/g, '').toLowerCase() : '';
  if (!storedEmail || storedEmail === request.old_email.toLowerCase()) {
    await supabaseAdmin.from('ceo_settings').upsert(
      { setting_key: 'ceo_email', setting_value: request.new_email, updated_at: new Date().toISOString() },
      { onConflict: 'setting_key' },
    );
  }

  const name = profile.full_name || '';
  await sendMail(
    supabaseAdmin,
    request.old_email,
    'Your Rebma Impex sign-in email was changed',
    `Hi ${name},\n\nYour Rebma Impex sign-in email is now ${request.new_email}. If this wasn't you, contact the other CEO or your administrator immediately.\n\nRebma Impex`,
    `<p>Hi ${esc(name)},</p><p>Your Rebma Impex sign-in email is now <strong>${esc(request.new_email)}</strong>.</p><p>If this wasn't you, contact the other CEO or your administrator immediately.</p><p>Rebma Impex</p>`,
  ).catch(() => ({ sent: false }));

  await supabaseAdmin.from('global_audit_history').insert({
    action: 'CEO_EMAIL_CHANGED', department: 'CEO', performed_by: name || 'CEO', user_id: request.user_id,
    reference_id: request.user_id, details: `Sign-in email changed from ${request.old_email} to ${request.new_email}.`, timestamp: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, message: `Done. Sign in with ${request.new_email} from now on.` });
}
