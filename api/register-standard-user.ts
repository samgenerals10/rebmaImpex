// api/register-standard-user.ts
// Vercel Serverless Function — securely registers standard users using Admin API to bypass SMTP issues
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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, fullName, phone, ghanaCardId, inviteToken } = req.body || {};
    let { department } = req.body || {};
    if (!email || !fullName || !department) {
      return res.status(400).json({ error: 'Email, Full Name, and Department are required.' });
    }

    const emailLower = email.trim().toLowerCase();
    const regPassword = generateSecurePassword(16);

    const { data: gateRows } = await supabaseAdmin
      .from('ceo_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['registrations_allowed', 'invitation_only']);
    const registrationsAllowed = gateRows?.find(r => r.setting_key === 'registrations_allowed')?.setting_value !== false;
    const invitationOnly = gateRows?.find(r => r.setting_key === 'invitation_only')?.setting_value === true;
    if (!registrationsAllowed) {
      return res.status(403).json({ error: 'New registrations are currently closed.' });
    }
    if (invitationOnly && !inviteToken) {
      return res.status(403).json({ error: 'Registration currently requires an invite link — ask HR or the CEO for one.' });
    }

    // If an invite token is present, resolve it server-side and trust its
    // department/role over whatever the client submitted (the client-side
    // form is only ever pre-filled from the invite, never authoritative —
    // a tampered request shouldn't be able to use a valid token to
    // register into a different department than the one it was issued for).
    let invite: { id: string; department: string; auto_approve: boolean } | null = null;
    if (inviteToken) {
      const { data: invites } = await supabaseAdmin
        .from('staff_invites')
        .select('id, department, auto_approve, status, expires_at')
        .eq('token', inviteToken)
        .limit(1);
      const found = invites?.[0];
      if (!found || found.status !== 'pending' || (found.expires_at && new Date(found.expires_at).getTime() < Date.now())) {
        return res.status(410).json({ error: 'This invite link is no longer valid.' });
      }
      invite = found;
      department = found.department;
    }

    // List users to check if user already exists
    const foundUser = await findUserByEmail(supabaseAdmin, emailLower);
    let userId = foundUser?.id;

    if (!foundUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: regPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          department: department,
          ghanaCardId: ghanaCardId || null,
          phone: phone || null,
        }
      });
      if (createError) {
        return res.status(400).json({ error: `Registration failed: ${createError.message}` });
      }
      userId = createData.user?.id;
    } else {
      // If user exists, update password and metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        password: regPassword,
        user_metadata: {
          full_name: fullName,
          department: department,
          ghanaCardId: ghanaCardId || null,
          phone: phone || null,
        }
      });
      if (updateError) {
        return res.status(400).json({ error: `Registration update failed: ${updateError.message}` });
      }
    }

    // An invite with auto_approve skips the HR/CEO approval queue entirely.
    const initialStatus = invite?.auto_approve ? 'ACTIVE' : 'PENDING_APPROVAL';
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      full_name: fullName,
      role: department,
      ghana_card_id: ghanaCardId || null,
      phone: phone || null,
      status: initialStatus,
      is_admin: department === 'CEO',
      requires_password_reset: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        fullName,
        department,
        ghanaCardId: ghanaCardId || null,
        phone: phone || null,
        tempAuthSecret: regPassword
      }
    }, { onConflict: 'id' });

    // Also update by email to ensure consistency
    await supabaseAdmin.from('profiles').update({
      role: department,
      full_name: fullName,
      ghana_card_id: ghanaCardId || null,
      phone: phone || null,
      status: initialStatus,
      is_admin: department === 'CEO',
      requires_password_reset: true,
      metadata: {
        fullName,
        department,
        ghanaCardId: ghanaCardId || null,
        phone: phone || null,
        tempAuthSecret: regPassword
      },
      updated_at: new Date().toISOString()
    }).eq('email', emailLower);

    if (invite) {
      await supabaseAdmin.from('staff_invites').update({ status: 'used' }).eq('id', invite.id);
    }

    return res.status(200).json({
      success: true,
      message: initialStatus === 'ACTIVE' ? 'Registration complete — you can sign in now.' : 'Registration submitted. Please await HR approval.',
      userId,
      status: initialStatus
    });

  } catch (err: any) {
    console.error('Server error during standard registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
