// api/resend-invite.ts
// Vercel Serverless Function — HR's "Resend link" button.
//
// Two cases, both from HR's staff list:
//   { userId }   A registration that expired because it wasn't approved
//                within 12 hours. Its half-made login is removed so the
//                same email can register again, and the original invite
//                is reopened with a fresh link.
//   { inviteId } An invite whose link was never used (or ran past its 7
//                days). It just gets a fresh link.
//
// Either way, the new link goes out by email and SMS (whichever are set
// up in Control Center → API Keys). The link is also returned so HR can
// send it by WhatsApp with one tap, or share it by hand if neither is set up.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { isRateLimited } from '../_shared/rateLimit';
import { isRegistrationExpired } from '../_shared/registration';
import { sendInvite, deliverySummary } from '../_shared/mailer';
import { getAppOrigin } from '../_shared/settings';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const INVITE_LINK_DAYS = 7;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Sends a real email, same limit as send-staff-invite-email.ts.
  if (await isRateLimited(supabaseAdmin, req, res, 'resend-invite', 10, 60)) return;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (callerError || !callerData.user) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
  const { data: caller } = await supabaseAdmin
    .from('profiles')
    .select('full_name, role, is_admin, status')
    .eq('id', callerData.user.id)
    .maybeSingle();
  if (!caller || String(caller.status || '').toUpperCase() !== 'ACTIVE' || ((caller.role || '').toUpperCase() !== 'HR' && !caller.is_admin)) {
    return res.status(403).json({ error: 'Only HR or the CEO can resend invite links.' });
  }

  try {
    const { userId, inviteId } = req.body || {};
    if (!userId && !inviteId) return res.status(400).json({ error: 'userId or inviteId is required.' });

    let invite: any = null;
    let personName = '';

    if (userId) {
      const { data: target } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, status, registered_at')
        .eq('id', userId)
        .maybeSingle();
      if (!target) return res.status(404).json({ error: 'Registration not found.' });
      if (!isRegistrationExpired(target.status, target.registered_at)) {
        return res.status(409).json({ error: 'This registration has not expired, so there is nothing to resend.' });
      }
      personName = target.full_name || '';

      // Find the invite they registered from: the recorded link first, then
      // the newest invite for their email.
      const { data: details } = await supabaseAdmin
        .from('staff_registration_details')
        .select('invite_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (details?.invite_id) {
        const { data } = await supabaseAdmin.from('staff_invites').select('*').eq('id', details.invite_id).maybeSingle();
        invite = data;
      }
      if (!invite && target.email) {
        const { data } = await supabaseAdmin
          .from('staff_invites')
          .select('*')
          .ilike('email', target.email)
          .order('created_at', { ascending: false })
          .limit(1);
        invite = data?.[0] || null;
      }
      if (!invite) return res.status(404).json({ error: 'The original invite for this person could not be found. Add them again from Add Staff.' });
      // A CEO invite can only be reopened by a CEO. Checked before anything changes.
      if (String(invite.department || '').toUpperCase() === 'CEO' && !caller.is_admin) {
        return res.status(403).json({ error: 'Only a CEO can resend a co-CEO invite.' });
      }

      // Remove the expired half-made account so the same email can register
      // again. A driver roster row keeps existing, just unlinked.
      await supabaseAdmin.from('drivers').update({ user_id: null }).eq('user_id', userId);
      await supabaseAdmin.from('staff_registration_details').delete().eq('user_id', userId);
      const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
      if (profileDeleteError) {
        // Something still references the profile. Mark it expired instead,
        // which register-standard-user.ts treats as safe to re-register.
        await supabaseAdmin.from('profiles').update({ status: 'EXPIRED', updated_at: new Date().toISOString() }).eq('id', userId);
      } else {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authDeleteError) console.error('Could not remove expired login:', authDeleteError.message);
      }
    } else {
      const { data } = await supabaseAdmin.from('staff_invites').select('*').eq('id', inviteId).maybeSingle();
      if (!data) return res.status(404).json({ error: 'Invite not found.' });
      if (data.status === 'used') return res.status(409).json({ error: 'This person has already registered with this invite.' });
      if (String(data.department || '').toUpperCase() === 'CEO' && !caller.is_admin) {
        return res.status(403).json({ error: 'Only a CEO can resend a co-CEO invite.' });
      }
      invite = data;
      personName = data.full_name || '';
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_LINK_DAYS * 24 * 3600_000).toISOString();
    const { error: resetError } = await supabaseAdmin
      .from('staff_invites')
      .update({ token, status: 'pending', expires_at: expiresAt, sent_via: [] })
      .eq('id', invite.id);
    if (resetError) return res.status(500).json({ error: `Could not reopen the invite: ${resetError.message}` });

    const origin = await getAppOrigin(supabaseAdmin, req.headers.origin as string);
    const result = await sendInvite(supabaseAdmin, { email: invite.email, phone: invite.phone, full_name: invite.full_name, token }, origin);
    const link = result.link;
    const sentVia = (['email', 'sms'] as const).filter((c) => result[c]?.sent);
    if (sentVia.length) await supabaseAdmin.from('staff_invites').update({ sent_via: sentVia }).eq('id', invite.id);

    try {
      await supabaseAdmin.from('global_audit_history').insert({
        action: 'RESEND_INVITE',
        department: 'HR',
        performed_by: caller.full_name || 'HR Staff',
        user_id: callerData.user.id,
        reference_id: String(invite.id),
        details: `New registration link issued for ${personName || invite.email || 'a candidate'}${userId ? ' after their registration expired' : ''}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Audit trail logging failed:', e);
    }

    return res.status(200).json({
      success: true,
      emailSent: !!result.email?.sent,
      smsSent: !!result.sms?.sent,
      link,
      phone: invite.whatsapp_number || invite.phone || null,
      fullName: invite.full_name || personName,
      message: sentVia.length
        ? `A new link is ready. ${deliverySummary(result)}`
        : `A new link is ready, but nothing went out automatically. ${deliverySummary(result)} Send it by WhatsApp or share it by hand.`,
    });
  } catch (err: any) {
    console.error('Resend invite failed:', err);
    return res.status(500).json({ error: err.message || 'Could not resend the link.' });
  }
}
