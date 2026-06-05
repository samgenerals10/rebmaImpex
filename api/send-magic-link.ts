// api/send-magic-link.ts
// Vercel Serverless Function — sends a Supabase magic link for privileged roles (CEO/HR)
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Whitelisted emails from environment (server-side only)
const CEO_EMAIL = (process.env.CEO_EMAIL || process.env.VITE_WHITELISTED_CEO_EMAIL || '').trim().toLowerCase();
const HR_EMAIL = (process.env.HR_EMAIL || process.env.VITE_WHITELISTED_HR_EMAIL || '').trim().toLowerCase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, role } = req.body || {};
  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required.' });
  }

  const emailLower = email.trim().toLowerCase();
  const roleUpper = role.toUpperCase();

  // Validate email against whitelist
  if (roleUpper === 'CEO' && emailLower !== CEO_EMAIL) {
    return res.status(403).json({ error: 'Email is not whitelisted for the CEO role.' });
  }
  if (roleUpper === 'HR' && emailLower !== HR_EMAIL) {
    return res.status(403).json({ error: 'Email is not whitelisted for the HR role.' });
  }
  if (roleUpper !== 'CEO' && roleUpper !== 'HR') {
    return res.status(400).json({ error: 'Magic link is only available for CEO and HR roles.' });
  }

  // Check if user profile exists; if not, create it with PENDING_EMAIL_VERIFICATION
  const { data: existingProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, status')
    .eq('email', emailLower)
    .limit(1);

  if (!existingProfiles || existingProfiles.length === 0) {
    // First-time login for a privileged user — we need to create their auth account + profile
    // Supabase will auto-create the auth user when we send the magic link
  }

  // Determine redirect URL
  const siteUrl = process.env.SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173';

  // Send magic link via Supabase Auth OTP (email channel)
  const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
    email: emailLower,
    options: {
      emailRedirectTo: siteUrl,
      data: {
        role: roleUpper,
        department: roleUpper,
        full_name: roleUpper === 'CEO' ? 'CEO Office' : 'HR Manager',
        is_ceo: roleUpper === 'CEO',
      },
      shouldCreateUser: true,
    },
  });

  if (otpError) {
    console.error('Magic link dispatch failed:', otpError);
    return res.status(500).json({ error: otpError.message || 'Failed to send magic link.' });
  }

  // If profile doesn't exist yet, create it now
  if (!existingProfiles || existingProfiles.length === 0) {
    // Fetch user by email directly
    const { data: userData } = await supabaseAdmin.auth.admin.getUserByEmail(emailLower);
    const authUser = userData?.user;

    if (authUser) {
      await supabaseAdmin.from('profiles').upsert({
        id: authUser.id,
        email: emailLower,
        full_name: authUser.user_metadata?.full_name || (roleUpper === 'CEO' ? 'CEO' : 'HR Manager'),
        role: roleUpper,
        status: 'ACTIVE',
        is_ceo: roleUpper === 'CEO',
        requires_password_reset: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } else {
    // Profile exists — ensure status is ACTIVE for privileged roles
    const profile = existingProfiles[0];
    if (profile.status !== 'ACTIVE') {
      await supabaseAdmin
        .from('profiles')
        .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
        .eq('id', profile.id);
    }
  }

  return res.status(200).json({
    message: 'Magic link sent! Check your email inbox.',
  });
}
