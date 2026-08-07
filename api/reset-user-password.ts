// api/reset-user-password.ts
// Vercel Serverless Function — lets an authorized staff member trigger a
// password-reset email for ANOTHER user. No such feature existed before
// this (only self-service reset via the login screen); this is what the
// Control Center's "Password Reset Authority" setting actually gates.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    .select('full_name, role, is_admin')
    .eq('id', callerData.user.id)
    .limit(1);
  const callerProfile = callerProfiles?.[0];
  if (!callerProfile) return res.status(403).json({ error: 'Caller profile not found.' });

  // password_reset_authority (Control Center, System Controls): ceo_only /
  // hr_and_ceo / specific_user. 'specific_user' has no configured target to
  // fall back on, so it's treated the same as ceo_only. Unset defaults to
  // hr_and_ceo, matching how HR already handles most account-recovery asks.
  const { data: authoritySetting } = await supabaseAdmin
    .from('ceo_settings')
    .select('setting_value')
    .eq('setting_key', 'password_reset_authority')
    .maybeSingle();
  const authorityValue = authoritySetting?.setting_value ?? 'hr_and_ceo';
  const callerRole = (callerProfile.role || '').toUpperCase();
  const allowed = callerProfile.is_admin
    || (authorityValue === 'hr_and_ceo' && callerRole === 'HR');
  if (!allowed) {
    return res.status(403).json({ error: 'You are not authorized to reset staff passwords.' });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required.' });

  const { data: targetProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .limit(1);
  const targetProfile = targetProfiles?.[0];
  if (!targetProfile?.email) return res.status(404).json({ error: 'User profile or email not found.' });

  const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(targetProfile.email);
  if (resetError) {
    return res.status(500).json({ error: `Failed to send reset email: ${resetError.message}` });
  }

  try {
    await supabaseAdmin.from('global_audit_history').insert({
      action: 'RESET_USER_PASSWORD',
      department: 'HR',
      performed_by: callerProfile.full_name || 'HR Staff',
      user_id: callerData.user.id,
      details: `Password reset email sent to ${targetProfile.full_name || targetProfile.email}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit trail logging failed:', e);
  }

  return res.status(200).json({ message: `Password reset email sent to ${targetProfile.full_name || targetProfile.email}.` });
}
