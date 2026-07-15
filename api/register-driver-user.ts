// api/register-driver-user.ts
// Vercel Serverless Function — creates a mobile-app login for an existing driver
// roster row (public.drivers) so their phone can authenticate and stream GPS.
// No HR approval step: Dispatch is directly vouching for its own driver roster.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findUserByEmail } from './_shared/findUserByEmail';

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
    .select('role, is_ceo')
    .eq('id', callerData.user.id)
    .limit(1);
  const callerProfile = callerProfiles?.[0];
  const callerRole = (callerProfile?.role || '').toUpperCase();
  if (!callerProfile || (callerRole !== 'DISPATCH' && !callerProfile.is_ceo)) {
    return res.status(403).json({ error: 'Only Dispatch or CEO can create driver mobile accounts.' });
  }

  try {
    const { driverRowId, email } = req.body || {};
    if (!driverRowId || !email) {
      return res.status(400).json({ error: 'driverRowId and email are required.' });
    }

    const { data: driverRow, error: driverErr } = await supabaseAdmin
      .from('drivers')
      .select('id, driver_id, full_name, user_id')
      .eq('id', driverRowId)
      .single();
    if (driverErr || !driverRow) {
      return res.status(404).json({ error: 'Driver not found.' });
    }
    if (driverRow.user_id) {
      return res.status(400).json({ error: 'This driver already has a mobile app login.' });
    }

    const emailLower = String(email).trim().toLowerCase();
    const regPassword = generateSecurePassword(16);

    const foundUser = await findUserByEmail(supabaseAdmin, emailLower);
    let userId = foundUser?.id;

    if (!foundUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: regPassword,
        email_confirm: true,
        user_metadata: {
          full_name: driverRow.full_name,
          department: 'dispatch',
          isDriver: true,
        }
      });
      if (createError) {
        return res.status(400).json({ error: `Account creation failed: ${createError.message}` });
      }
      userId = createData.user?.id;
    } else {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        password: regPassword,
        user_metadata: {
          full_name: driverRow.full_name,
          department: 'dispatch',
          isDriver: true,
        }
      });
      if (updateError) {
        return res.status(400).json({ error: `Account update failed: ${updateError.message}` });
      }
    }

    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      full_name: driverRow.full_name,
      role: 'dispatch',
      status: 'ACTIVE',
      is_ceo: false,
      requires_password_reset: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { isDriver: true, driverId: driverRow.driver_id, tempAuthSecret: regPassword }
    }, { onConflict: 'id' });

    const { error: linkErr } = await supabaseAdmin.from('drivers').update({ user_id: userId }).eq('id', driverRowId);
    if (linkErr) {
      return res.status(500).json({ error: `Account created but failed to link to driver record: ${linkErr.message}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Driver mobile account created.',
      userId,
      email: emailLower,
      password: regPassword
    });

  } catch (err: any) {
    console.error('Server error during driver registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
