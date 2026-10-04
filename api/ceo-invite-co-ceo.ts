// api/ceo-invite-co-ceo.ts
// Control Center → CEO Account → Add Co-CEO.
//
//   1. The CEO types his password (checked on the server) and enters the
//      co-CEO's name, email and (optionally) phone.
//   2. A CEO invite is created and sent by email and SMS: app download link
//      plus registration link, same as any staff invite.
//   3. The co-CEO registers in the app and chooses a password. Their account
//      stays locked, with no CEO powers, until a CEO approves it (again with
//      the password) in Approvals. See register-standard-user.ts and
//      approve-user.ts.
//
// Only this endpoint creates CEO invites. The database also refuses a CEO
// invite from anyone who isn't a CEO (supabase_ceo_security.sql).
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { isRateLimited } from './_shared/rateLimit';
import { requireCeo, verifyPassword } from './_shared/reauth';
import { sendInvite, deliverySummary } from './_shared/mailer';
import { getAppOrigin } from './_shared/settings';
import { findUserByEmail } from './_shared/findUserByEmail';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_LINK_DAYS = 7;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'ceo-invite-co-ceo', 10, 60)) return;

  const caller = await requireCeo(supabaseAdmin, req, res);
  if (!caller) return;

  const { password, fullName, email, phone } = req.body || {};
  const name = String(fullName || '').trim();
  const target = String(email || '').trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "Enter the co-CEO's full name." });
  if (!EMAIL_RE.test(target)) return res.status(400).json({ error: "Enter the co-CEO's email address." });

  if (!(await verifyPassword(supabaseAdmin, res, caller.user, password))) return;

  if (await findUserByEmail(supabaseAdmin, target)) {
    return res.status(409).json({ error: 'That email already belongs to an account. Use a different email.' });
  }

  // One live CEO invite per email: an older unused one is revoked.
  await supabaseAdmin.from('staff_invites').update({ status: 'revoked' }).ilike('email', target).eq('department', 'CEO').eq('status', 'pending');

  const token = randomBytes(24).toString('hex');
  const { data: invite, error: insertError } = await supabaseAdmin.from('staff_invites').insert({
    token,
    email: target,
    full_name: name,
    phone: String(phone || '').trim() || null,
    department: 'CEO',
    role: 'CEO',
    auto_approve: false,
    status: 'pending',
    expires_at: new Date(Date.now() + INVITE_LINK_DAYS * 24 * 3600_000).toISOString(),
    created_by: caller.user.id,
    sent_via: [],
  }).select('id').single();
  if (insertError || !invite) return res.status(500).json({ error: `Could not create the invite: ${insertError?.message || 'unknown error'}` });

  const origin = await getAppOrigin(supabaseAdmin, req.headers.origin as string);
  const result = await sendInvite(supabaseAdmin, { email: target, phone: String(phone || '').trim() || null, full_name: name, token }, origin);
  const sentVia = (['email', 'sms'] as const).filter((c) => result[c]?.sent);
  if (sentVia.length) await supabaseAdmin.from('staff_invites').update({ sent_via: sentVia }).eq('id', invite.id);

  await supabaseAdmin.from('global_audit_history').insert({
    action: 'CO_CEO_INVITED', department: 'CEO', performed_by: caller.profile.full_name || 'CEO', user_id: caller.user.id,
    reference_id: String(invite.id), details: `Co-CEO invite sent to ${name} (${target}).`, timestamp: new Date().toISOString(),
  });

  return res.status(200).json({
    success: true,
    link: result.link,
    message: sentVia.length
      ? `Invite sent to ${name}. ${deliverySummary(result)} They register in the app, then you approve them in Approvals.`
      : `Invite created for ${name}, but nothing went out automatically. ${deliverySummary(result)} Share the link with them yourself.`,
  });
}
