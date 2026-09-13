// api/send-staff-invite-email.ts
// Vercel Serverless Function — sends the real invite email for a
// staff_invites row HR already created and saved. Requires SMTP_HOST,
// SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM env vars to be configured —
// until they are, this returns a clear "not configured" error rather
// than silently pretending to send.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    .select('role, is_admin')
    .eq('id', callerData.user.id)
    .limit(1);
  const callerRole = (callerProfiles?.[0]?.role || '').toUpperCase();
  if (callerRole !== 'HR' && !callerProfiles?.[0]?.is_admin) {
    return res.status(403).json({ error: 'Only HR or the CEO can send staff invites.' });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(503).json({ error: 'Email sending is not configured yet — ask an admin to set SMTP_HOST, SMTP_USER, and SMTP_PASS.' });
  }

  try {
    const { inviteId } = req.body || {};
    if (!inviteId) return res.status(400).json({ error: 'inviteId is required.' });

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('staff_invites')
      .select('id, token, email, full_name, department, role, status, sent_via')
      .eq('id', inviteId)
      .single();
    if (inviteError || !invite) return res.status(404).json({ error: 'Invite not found.' });
    if (!invite.email) return res.status(400).json({ error: 'This invite has no email address on file.' });

    const origin = (req.headers.origin as string) || process.env.PUBLIC_APP_URL || 'https://rebma-impex.vercel.app';
    const link = `${origin}/register?token=${invite.token}`;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT || 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: invite.email,
      subject: 'You have been invited to register with Rebma Impex',
      text: `Hi ${invite.full_name || ''},\n\nHR has approved your registration with Rebma Impex. Complete your registration using the link below:\n\n${link}\n\nThis link expires in 7 days. If you weren't expecting this, you can safely ignore it.\n\n— Rebma Impex HR`,
      html: `<p>Hi ${invite.full_name || ''},</p><p>HR has approved your registration with Rebma Impex. Complete your registration using the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 7 days. If you weren't expecting this, you can safely ignore it.</p><p>— Rebma Impex HR</p>`,
    });

    await supabaseAdmin.from('staff_invites').update({ sent_via: [...(invite.sent_via || []), 'email'] }).eq('id', inviteId);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Failed to send staff invite email:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email.' });
  }
}
