// api/approve-user.ts
// Vercel Serverless Function — HR approves or denies a pending user registration.
// Uses the service_role key to update profiles and send magic link emails.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    .select('full_name, role, is_admin')
    .eq('id', callerData.user.id)
    .limit(1);

  const callerProfile = callerProfiles?.[0];
  if (!callerProfile) {
    return res.status(403).json({ error: 'Caller profile not found.' });
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
    if (setting('ceo_must_approve_registrations', false)) {
      return res.status(403).json({ error: 'The CEO must personally approve registrations right now.' });
    }
    const hrCanApprove = setting('hr_can_approve_registrations', true);
    const managementCanApprove = setting('management_can_approve_registrations', true);
    const callerCanApprove = (callerRole === 'HR' && hrCanApprove) || (callerRole === 'MANAGEMENT' && managementCanApprove);
    if (!callerCanApprove) {
      return res.status(403).json({ error: 'Only HR or CEO can approve users.' });
    }
  }

  const { userId, approve, generatedPassword } = req.body || {};
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
  const isPrivilegedTarget = targetRole === 'MANAGEMENT' || targetRole === 'HR';
  if (isPrivilegedTarget && !callerProfile.is_admin) {
    return res.status(403).json({ error: 'Only the CEO can approve Management or HR registrations.' });
  }

  const status = approve ? 'ACTIVE' : 'REJECTED';
  const updateData: any = { status, updated_at: new Date().toISOString() };

  if (approve) {
    updateData.requires_password_reset = true;
    if (generatedPassword) {
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

    await supabaseAdmin.from('global_audit_history').insert({
      action: approve ? 'APPROVE_USER' : 'REJECT_USER',
      department: 'HR',
      performed_by: performedBy,
      user_id: callerData.user.id,
      details: `User ${targetName} (${targetDept}) ${approve ? 'approved' : 'rejected'}.`,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Audit trail logging failed:', e);
  }

  return res.status(200).json({
    message: approve
      ? `User ${targetProfile.full_name} approved.`
      : `User ${targetProfile.full_name} rejected.`,
    status,
  });
}
