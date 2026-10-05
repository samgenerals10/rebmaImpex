// api/register-privileged-user.ts
// Vercel Serverless Function — the hidden first-CEO sign-up page.
//
// It exists for one reason: the very first CEO has to get in before there
// is anyone to approve them. So it now:
//   * only works while NO CEO account exists at all. Once one exists, every
//     new CEO comes in through Control Center → Add Co-CEO and approval;
//   * only accepts the CEO email: Control Center's value first
//     (ceo_settings 'ceo_email'), then CEO_EMAIL in Vercel as the spare;
//   * never touches an existing account. The old version replaced the
//     password of any existing account with the CEO or HR email, with no
//     sign-in required, which let anyone take over those accounts;
//   * no longer has an HR option. The CEO brings HR in by invite and
//     approval, so HR_EMAIL is no longer used anywhere.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { findUserByEmail } from '../_shared/findUserByEmail';
import { getSetting } from '../_shared/settings';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ENV_CEO_EMAIL = (process.env.CEO_EMAIL || process.env.VITE_WHITELISTED_CEO_EMAIL || '').trim().toLowerCase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // No sign-in exists yet for whoever uses this, so it's IP-limited.
  if (await isRateLimited(supabaseAdmin, req, res, 'register-privileged-user', 5, 60)) return;

  try {
    const { email, password, fullName, role } = req.body || {};
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (String(role).trim() !== 'CEO') {
      return res.status(400).json({ error: 'This page is only for setting up the first CEO.' });
    }
    if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'Choose a password of at least 8 characters, with a letter and a number.' });
    }

    // Locked once any CEO exists.
    const { count } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true);
    if ((count || 0) > 0) {
      return res.status(403).json({ error: 'A CEO account already exists. New CEOs are added from Control Center by an existing CEO.' });
    }

    const allowedEmail = ((await getSetting(supabaseAdmin, 'ceo_email')) || ENV_CEO_EMAIL).toLowerCase();
    const emailLower = String(email).trim().toLowerCase();
    if (!allowedEmail || emailLower !== allowedEmail) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Never modify an existing account from here.
    if (await findUserByEmail(supabaseAdmin, emailLower)) {
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    }

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, department: 'CEO' },
    });
    if (createError || !createData.user) {
      return res.status(400).json({ error: `Registration failed: ${createError?.message || 'unknown error'}` });
    }

    const now = new Date().toISOString();
    await supabaseAdmin.from('profiles').upsert({
      id: createData.user.id,
      email: emailLower,
      full_name: fullName,
      role: 'CEO',
      status: 'ACTIVE',
      is_admin: true,
      requires_password_reset: false,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'id' });

    await supabaseAdmin.from('global_audit_history').insert({
      action: 'FIRST_CEO_CREATED', department: 'CEO', performed_by: fullName, user_id: createData.user.id,
      reference_id: createData.user.id, details: `First CEO account created for ${emailLower}.`, timestamp: now,
    });

    return res.status(200).json({ success: true, message: 'Account created successfully.' });
  } catch (err: any) {
    console.error('Server error during privileged registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
