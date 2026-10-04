// api/send-staff-invite-email.ts
// Vercel Serverless Function — sends the invite for a staff_invites row HR
// already created and saved, by email (Resend) and SMS (the Android SMS
// phone). Both are set up in Control Center → API Keys. Body:
//   { inviteId, channels?: ('email' | 'sms')[] }   default: both
// Each channel reports whether it went out and, if not, why, so HR is
// never told something was sent when it wasn't. The messages are built in
// _shared/mailer.ts, shared with resend-invite.ts.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { sendInvite, deliverySummary, type Channel } from './_shared/mailer';
import { getAppOrigin } from './_shared/settings';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Tighter than the others — this sends a real email through your
  // provider on every call, so a flood here isn't just Supabase load,
  // it's a real risk of burning through your email quota/reputation.
  if (await isRateLimited(supabaseAdmin, req, res, 'send-staff-invite-email', 10, 60)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData.user) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
  const { data: callerProfiles } = await supabaseAdmin
    .from('profiles')
    .select('role, is_admin, status')
    .eq('id', callerData.user.id)
    .limit(1);
  const callerRole = (callerProfiles?.[0]?.role || '').toUpperCase();
  if (String(callerProfiles?.[0]?.status || '').toUpperCase() !== 'ACTIVE') {
    return res.status(403).json({ error: 'Your account is not active.' });
  }
  if (callerRole !== 'HR' && !callerProfiles?.[0]?.is_admin) {
    return res.status(403).json({ error: 'Only HR or the CEO can send staff invites.' });
  }

  try {
    const { inviteId } = req.body || {};
    const requested: Channel[] = Array.isArray(req.body?.channels) ? req.body.channels.filter((c: unknown) => c === 'email' || c === 'sms') : ['email', 'sms'];
    const channels: Channel[] = requested.length ? requested : ['email', 'sms'];
    if (!inviteId) return res.status(400).json({ error: 'inviteId is required.' });

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('staff_invites')
      .select('id, token, email, phone, full_name, status, sent_via')
      .eq('id', inviteId)
      .single();
    if (inviteError || !invite) return res.status(404).json({ error: 'Invite not found.' });

    const origin = await getAppOrigin(supabaseAdmin, req.headers.origin as string);
    const result = await sendInvite(supabaseAdmin, invite, origin, channels);
    const nowSent = (['email', 'sms'] as const).filter((c) => result[c]?.sent);
    if (nowSent.length) {
      await supabaseAdmin.from('staff_invites').update({ sent_via: Array.from(new Set([...(invite.sent_via || []), ...nowSent])) }).eq('id', inviteId);
    }

    return res.status(200).json({
      success: nowSent.length > 0,
      email: result.email,
      sms: result.sms,
      link: result.link,
      message: deliverySummary(result) || 'Nothing was sent.',
    });
  } catch (err: any) {
    console.error('Failed to send staff invite email:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email.' });
  }
}
