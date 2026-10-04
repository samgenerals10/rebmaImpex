// api/approve-user.ts
// Vercel Serverless Function — HR approves or denies a pending user registration.
// Uses the service_role key to update profiles and send magic link emails.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { isRegistrationExpired, APPROVAL_WINDOW_HOURS } from './_shared/registration';
import { sendApproved, deliverySummary } from './_shared/mailer';
import { getAppOrigin } from './_shared/settings';
import { verifyPassword } from './_shared/reauth';
import { continueWork, describeMoved, notify } from './_shared/termination';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Privileged endpoint (needs a real Bearer token below), but still
  // rate-limited: a leaked/compromised token, or a malicious authenticated
  // caller, shouldn't be able to flood this either.
  if (await isRateLimited(supabaseAdmin, req, res, 'approve-user', 30, 60)) return;

  // Verify the caller is authenticated (extract JWT from Authorization header)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData.user) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }

  // Verify caller is HR or CEO
  const { data: callerProfiles } = await supabaseAdmin
    .from('profiles')
    .select('full_name, role, is_admin, status')
    .eq('id', callerData.user.id)
    .limit(1);

  const callerProfile = callerProfiles?.[0];
  if (!callerProfile) {
    return res.status(403).json({ error: 'Caller profile not found.' });
  }
  if (String(callerProfile.status || '').toUpperCase() !== 'ACTIVE') {
    return res.status(403).json({ error: 'Your account is not active.' });
  }

  const callerRole = (callerProfile.role || '').toUpperCase();

  // Who's allowed to approve is itself CEO-configurable (Control Center →
  // Access Control). The CEO can always approve regardless of these.
  if (!callerProfile.is_admin) {
    const { data: settingRows } = await supabaseAdmin
      .from('ceo_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['ceo_must_approve_registrations', 'hr_can_approve_registrations', 'management_can_approve_registrations']);
    const setting = (key: string, fallback: boolean) => {
      const row = settingRows?.find(r => r.setting_key === key);
      return row ? row.setting_value !== false : fallback;
    };
    // Defaults to true: new staff are approved by the CEO only. The CEO can
    // still turn this off in Control Center to let HR/Management approve.
    if (setting('ceo_must_approve_registrations', true)) {
      return res.status(403).json({ error: 'The CEO must personally approve registrations right now.' });
    }
    const hrCanApprove = setting('hr_can_approve_registrations', true);
    const managementCanApprove = setting('management_can_approve_registrations', true);
    const callerCanApprove = (callerRole === 'HR' && hrCanApprove) || (callerRole === 'MANAGEMENT' && managementCanApprove);
    if (!callerCanApprove) {
      return res.status(403).json({ error: 'Only HR or CEO can approve users.' });
    }
  }

  const { userId, approve, generatedPassword, remark } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  // Fetch the target user profile
  const { data: targetProfiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .limit(1);

  const targetProfile = targetProfiles?.[0];
  if (!targetProfile) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  // Management and HR registrations need the CEO's sign-off specifically —
  // HR can approve every other department, but not its own or Management's.
  const targetRole = (targetProfile.role || '').toUpperCase();
  const isPrivilegedTarget = targetRole === 'MANAGEMENT' || targetRole === 'HR' || targetRole === 'CEO';
  if (isPrivilegedTarget && !callerProfile.is_admin) {
    return res.status(403).json({ error: 'Only the CEO can approve Management, HR or CEO registrations.' });
  }
  // Approving a co-CEO is a high-risk action: the CEO types his password.
  if (approve && targetRole === 'CEO') {
    if (!(await verifyPassword(supabaseAdmin, res, callerData.user, req.body?.password))) return;
  }

  // The 12-hour window: an expired registration can't be approved. HR
  // resends a fresh link instead (api/resend-invite.ts).
  if (approve && isRegistrationExpired(targetProfile.status, targetProfile.registered_at)) {
    return res.status(410).json({ error: `This registration expired because it wasn't approved within ${APPROVAL_WINDOW_HOURS} hours. HR can resend the link from the staff list.` });
  }

  // Someone who registered after the password change chose their own
  // password (registered_at is only set by that version of
  // register-standard-user.ts). Their password is never touched here and
  // no temporary one is created.
  const choseOwnPassword = !!targetProfile.registered_at;

  const status = approve ? 'ACTIVE' : 'REJECTED';
  const updateData: any = { status, updated_at: new Date().toISOString() };

  if (approve) {
    if (targetRole === 'CEO') updateData.is_admin = true;
    // Unlock the sign-in that register-standard-user.ts locked.
    const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    if (unbanError) return res.status(500).json({ error: `Could not unlock the account: ${unbanError.message}` });
    updateData.requires_password_reset = !choseOwnPassword;
    if (generatedPassword && !choseOwnPassword) {
      updateData.password_hash = generatedPassword;
      // Update password and confirm email in Supabase Auth using the admin API
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: generatedPassword,
        email_confirm: true
      });
      if (authUpdateError) {
        return res.status(500).json({ error: `Failed to update user credentials in Supabase Auth: ${authUpdateError.message}` });
      }
    } else {
      // Just confirm email if no password is provided
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true
      });
      if (authUpdateError) {
        return res.status(500).json({ error: `Failed to confirm user email in Supabase Auth: ${authUpdateError.message}` });
      }
    }
  }

  // Update the profile
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  // Audit trail
  try {
    const performedBy = callerProfile.full_name || 'HR Staff';
    const targetName = targetProfile.full_name || 'Staff';
    const targetDept = targetProfile.role || 'Unknown';

    const baseDetails = `User ${targetName} (${targetDept}) ${approve ? 'approved' : 'rejected'}.`;
    await supabaseAdmin.from('global_audit_history').insert({
      action: approve ? 'APPROVE_USER' : 'REJECT_USER',
      department: 'HR',
      performed_by: performedBy,
      user_id: callerData.user.id,
      reference_id: userId,
      details: remark ? `${baseDetails} ${remark}` : baseDetails,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Audit trail logging failed:', e);
  }

  // Continue previous work: if HR chose it when hiring this person into the
  // same department and role as someone who was terminated, the open work
  // that person was handling becomes this person's now. Never fatal.
  let continueNote = '';
  if (approve) {
    try {
      const { data: details } = await supabaseAdmin.from('staff_registration_details').select('invite_id').eq('user_id', userId).maybeSingle();
      if (details?.invite_id) {
        const { data: invite } = await supabaseAdmin.from('staff_invites').select('continue_from_id, continue_from_name').eq('id', details.invite_id).maybeSingle();
        // Only the work of someone who really was terminated can be
        // continued, so an invite can't be pointed at an active colleague.
        const { data: previous } = invite?.continue_from_id
          ? await supabaseAdmin.from('profiles').select('status').eq('id', invite.continue_from_id).maybeSingle()
          : { data: null };
        if (invite?.continue_from_id && invite.continue_from_id !== userId && String(previous?.status || '').toUpperCase() === 'TERMINATED') {
          const newName = targetProfile.full_name || 'The new staff member';
          const moved = await continueWork(supabaseAdmin, invite.continue_from_id, { id: userId, name: newName });
          const what = describeMoved(moved);
          continueNote = ` ${newName} continues ${invite.continue_from_name || 'the previous person'}'s work${what ? ` (${what})` : ''}.`;
          await notify(supabaseAdmin, { recipientId: userId }, 'Previous work is yours now',
            `You continue ${invite.continue_from_name || 'the previous person'}'s work${what ? `: ${what}` : ''}. Their past work stays under their name.`);
          await supabaseAdmin.from('global_audit_history').insert({
            action: 'CONTINUE_PREVIOUS_WORK', department: 'HR', performed_by: callerProfile.full_name || 'HR', user_id: callerData.user.id,
            reference_id: userId, details: `${newName} continues ${invite.continue_from_name || 'the previous person'}'s work.${what ? ` Moved: ${what}.` : ''}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error('Continue previous work failed:', e);
    }
  }

  // Tell the person they can sign in, by email and SMS. Never fatal: the
  // approval already happened, the caller is just told what went out.
  let emailSent = false;
  let deliveryNote = '';
  if (approve && choseOwnPassword) {
    try {
      const origin = await getAppOrigin(supabaseAdmin, req.headers.origin as string);
      const result = await sendApproved(supabaseAdmin, { email: targetProfile.email, phone: targetProfile.phone, fullName: targetProfile.full_name || '' }, origin);
      emailSent = result.email.sent;
      deliveryNote = deliverySummary(result);
    } catch (e) {
      console.error('Approval notice failed:', e);
    }
  }

  return res.status(200).json({
    message: approve
      ? `User ${targetProfile.full_name} approved.${continueNote}${choseOwnPassword && deliveryNote ? ` ${deliveryNote}` : ''}`
      : `User ${targetProfile.full_name} rejected.`,
    status,
    choseOwnPassword,
    emailSent,
  });
}
