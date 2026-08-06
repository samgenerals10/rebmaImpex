// api/terminate-user.ts
// Vercel Serverless Function — properly terminates a staff account.
// The previous frontend-only implementation called supabase.auth.admin
// from a browser client built with the anon key, which silently no-ops
// (admin.* requires the service_role key) — the app deleted the profiles
// row and reported success while the person's actual login stayed live.
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
  if (!callerProfile) {
    return res.status(403).json({ error: 'Caller profile not found.' });
  }

  const callerRole = (callerProfile.role || '').toUpperCase();
  if (callerRole !== 'HR' && !callerProfile.is_admin) {
    return res.status(403).json({ error: 'Only HR or CEO can terminate accounts.' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const { data: targetProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .limit(1);

  const targetProfile = targetProfiles?.[0];
  if (!targetProfile) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  // Same escalation rule as approve-user.ts — HR can't terminate its own
  // department or Management, only the CEO can.
  const targetRole = (targetProfile.role || '').toUpperCase();
  const isPrivilegedTarget = targetRole === 'MANAGEMENT' || targetRole === 'HR';
  if (isPrivilegedTarget && !callerProfile.is_admin) {
    return res.status(403).json({ error: 'Only the CEO can terminate Management or HR accounts.' });
  }

  if (userId === callerData.user.id) {
    return res.status(400).json({ error: 'You cannot terminate your own account.' });
  }

  // The real fix: this runs with the service-role key, so admin.deleteUser
  // actually works instead of silently no-opping.
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return res.status(500).json({ error: `Failed to delete login credentials: ${authDeleteError.message}` });
  }

  // Update, not delete, so the person stays visible/auditable in User
  // Management instead of vanishing from every screen that joins profiles.
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ status: 'TERMINATED', updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    return res.status(500).json({ error: `Login deleted, but failed to update profile status: ${updateError.message}` });
  }

  try {
    await supabaseAdmin.from('global_audit_history').insert({
      action: 'TERMINATE_USER',
      department: 'HR',
      performed_by: callerProfile.full_name || 'HR Staff',
      user_id: callerData.user.id,
      details: `User ${targetProfile.full_name || userId} terminated — login credentials revoked.`,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit trail logging failed:', e);
  }

  return res.status(200).json({ message: `${targetProfile.full_name || 'User'} terminated.` });
}
