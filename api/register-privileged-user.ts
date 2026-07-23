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

    const { data: existingUser } = await supabaseAdmin.auth.admin
      .listUsers({ page: 1, perPage: 1000 });
      
    const foundUser = existingUser?.users?.find(
      u => u.email?.toLowerCase() === emailLower
    );

    let userId = foundUser?.id;

    if (!foundUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, department: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized }
      });
      if (createError) {
        return res.status(400).json({ error: `Registration failed: ${createError.message}` });
      }
      userId = createData.user?.id;
    } else {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        password,
        user_metadata: { full_name: fullName, department: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized }
      });
      if (updateError) {
        return res.status(400).json({ error: `Registration update failed: ${updateError.message}` });
      }
    }

    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      full_name: fullName,
      role: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized,
      status: 'ACTIVE',
      is_admin: roleNormalized === 'CEO',
      requires_password_reset: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    await supabaseAdmin.from('profiles')
      .update({ 
        role: roleNormalized === 'Human Resources' ? 'HR' : roleNormalized,
        full_name: fullName,
        status: 'ACTIVE',
        is_admin: roleNormalized === 'CEO',
        requires_password_reset: false,
        updated_at: new Date().toISOString()
      })
      .eq('email', emailLower);

    return res.status(200).json({ success: true, message: 'Account created successfully.' });

  } catch (err: any) {
    console.error('Server error during privileged registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
