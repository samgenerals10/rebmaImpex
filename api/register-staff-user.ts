// api/register-staff-user.ts
// Vercel Serverless Function — HR adding a staff member directly (not the
// self-service registration + approval queue). Creates a real Supabase Auth
// account and an ACTIVE profile in one step, since HR is directly vouching
// for the hire, mirroring api/register-driver-user.ts.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const generateSecurePassword = (length = 16): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  const pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];

  for (let i = 4; i < length; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }

  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }

  return pw.join('');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, fullName, department, phone, ghanaCardId } = req.body || {};
    if (!email || !fullName || !department) {
      return res.status(400).json({ error: 'Email, Full Name, and Department are required.' });
    }

    const emailLower = String(email).trim().toLowerCase();
    const regPassword = generateSecurePassword(16);

    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      return res.status(500).json({ error: `Database check failed: ${listError.message}` });
    }
    const foundUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === emailLower);

    let userId = foundUser?.id;

    if (!foundUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: regPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, department, ghanaCardId: ghanaCardId || null, phone: phone || null }
      });
      if (createError) {
        return res.status(400).json({ error: `Account creation failed: ${createError.message}` });
      }
      userId = createData.user?.id;
    } else {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        password: regPassword,
        user_metadata: { full_name: fullName, department, ghanaCardId: ghanaCardId || null, phone: phone || null }
      });
      if (updateError) {
        return res.status(400).json({ error: `Account update failed: ${updateError.message}` });
      }
    }

    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      full_name: fullName,
      role: department,
      phone: phone || null,
      ghana_card_id: ghanaCardId || null,
      status: 'ACTIVE',
      is_ceo: department === 'CEO',
      requires_password_reset: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { tempAuthSecret: regPassword },
    }, { onConflict: 'id' });
    if (profileErr) {
      return res.status(500).json({ error: `Account created but profile save failed: ${profileErr.message}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Staff account created.',
      userId,
      email: emailLower,
      password: regPassword
    });

  } catch (err: any) {
    console.error('Server error during staff registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
