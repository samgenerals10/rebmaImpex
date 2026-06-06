// api/register-privileged-user.ts
// Vercel Serverless Function — securely registers privileged users (CEO/HR)
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const CEO_EMAIL = (process.env.CEO_EMAIL || process.env.VITE_WHITELISTED_CEO_EMAIL || '').trim().toLowerCase();
const HR_EMAIL = (process.env.HR_EMAIL || process.env.VITE_WHITELISTED_HR_EMAIL || '').trim().toLowerCase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, fullName, role } = req.body || {};
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const emailLower = email.trim().toLowerCase();
    const roleNormalized = role.trim();

    // Verify authorized email based on role
    if (roleNormalized === 'CEO') {
      if (emailLower !== CEO_EMAIL) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    } else if (roleNormalized === 'Human Resources') {
      if (emailLower !== HR_EMAIL) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid privileged role selected.' });
    }

    // Check if the user already exists in auth.users by email
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Failed to list auth users:', listError);
      return res.status(500).json({ error: listError.message || 'Failed to check existing users.' });
    }

    const existingUser = (listData?.users || []).find(
      (u: any) => u.email && u.email.toLowerCase() === emailLower
    );

    let user;
    let isNew = true;
    const now = new Date().toISOString();

    if (existingUser) {
      isNew = false;
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          user_metadata: {
            full_name: fullName,
            department: roleNormalized === 'Human Resources' ? 'HR' : 'CEO'
          }
        }
      );
      if (updateError || !updateData.user) {
        console.error('Failed to update existing auth user:', updateError);
        return res.status(500).json({ error: updateError?.message || 'Failed to update user auth account.' });
      }
      user = updateData.user;
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          department: roleNormalized === 'Human Resources' ? 'HR' : 'CEO'
        }
      });

      if (authError || !authData.user) {
        console.error('Auth user creation error:', authError);
        return res.status(500).json({ error: authError?.message || 'Failed to create user auth account.' });
      }
      user = authData.user;
    }

    if (isNew) {
      // Insert user into profiles table
      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: user.id,
        email: emailLower,
        full_name: fullName,
        role: roleNormalized === 'Human Resources' ? 'HR' : 'CEO',
        status: 'ACTIVE',
        is_ceo: roleNormalized === 'CEO',
        requires_password_reset: false,
        created_at: now,
        updated_at: now
      });

      if (profileError) {
        console.error('Profile DB insert error:', profileError);
        // Clean up the created auth user to avoid dangling accounts
        await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => {});
        return res.status(500).json({ error: profileError.message || 'Failed to create user profile.' });
      }
    } else {
      // Upsert the profiles table using ON CONFLICT (id) DO UPDATE (default behavior for upsert)
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        email: emailLower,
        full_name: fullName,
        role: roleNormalized === 'Human Resources' ? 'HR' : 'CEO',
        status: 'ACTIVE',
        is_ceo: roleNormalized === 'CEO',
        requires_password_reset: false,
        updated_at: now
      });

      if (profileError) {
        console.error('Profile DB upsert error:', profileError);
        return res.status(500).json({ error: profileError.message || 'Failed to update user profile.' });
      }
    }

    return res.status(200).json({ success: true, message: 'Account created successfully.' });

  } catch (err: any) {
    console.error('Server error during privileged registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
