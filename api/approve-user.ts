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
    .select('full_name, role, is_ceo')
    .eq('id', callerData.user.id)
    .limit(1);

  const callerProfile = callerProfiles?.[0];
  if (!callerProfile) {
    return res.status(403).json({ error: 'Caller profile not found.' });
  }

  const callerRole = (callerProfile.role || '').toUpperCase();
  if (callerRole !== 'HR' && !callerProfile.is_ceo) {
    return res.status(403).json({ error: 'Only HR or CEO can approve users.' });
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

  const status = approve ? 'ACTIVE' : 'REJECTED';
  const updateData: any = { status, updated_at: new Date().toISOString() };

  if (approve) {
    updateData.requires_password_reset = true;
    if (generatedPassword) {
      updateData.password_hash = generatedPassword;
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

  // If approved, send a magic link email to the user so they can set their password
  if (approve && targetProfile.email) {
    const siteUrl = process.env.SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173';

    const { error: magicLinkError } = await supabaseAdmin.auth.signInWithOtp({
      email: targetProfile.email,
      options: {
        emailRedirectTo: siteUrl,
        shouldCreateUser: false,
      },
    });

    if (magicLinkError) {
      console.error('Failed to send magic link to approved user:', magicLinkError);
      // Don't fail the request — profile is already approved
    }
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
      ? `User ${targetProfile.full_name} approved. Login link sent to their email.`
      : `User ${targetProfile.full_name} rejected.`,
    status,
  });
}
