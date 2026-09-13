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
    const { email, fullName, inviteToken } = req.body || {};
    let { department, phone, ghanaCardId } = req.body || {};
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and Full Name are required.' });
    }

    const emailLower = email.trim().toLowerCase();
    const regPassword = generateSecurePassword(16);

    const { data: gateRows } = await supabaseAdmin
      .from('ceo_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['registrations_allowed']);
    const registrationsAllowed = gateRows?.find(r => r.setting_key === 'registrations_allowed')?.setting_value !== false;
    if (!registrationsAllowed) {
      return res.status(403).json({ error: 'New registrations are currently closed.' });
    }

    // Every non-privileged registration now requires a valid invite —
    // the open, pick-your-own-department form is retired. CEO/HR still
    // register through the separate privileged secret-URL path, which
    // never calls this endpoint.
    if (!inviteToken) {
      return res.status(403).json({ error: 'Registration requires an invite link from HR.' });
    }

    // Resolve the invite server-side and trust everything it carries over
    // whatever the client submitted — the client-side form is only ever
    // pre-filled from the invite, never authoritative. A tampered request
    // shouldn't be able to use a valid token to register into a different
    // department, role, or with different personal details than the ones
    // HR actually entered.
    const { data: invites } = await supabaseAdmin
      .from('staff_invites')
      .select('id, department, role, phone, photo, resume_url, address, staff_category, guarantor_name, guarantor_phone, guarantor_relationship, guarantor_id_number, guarantor_address, auto_approve, status, expires_at')
      .eq('token', inviteToken)
      .limit(1);
    const invite = invites?.[0];
    if (!invite || invite.status !== 'pending' || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) {
      return res.status(410).json({ error: 'This invite link is no longer valid.' });
    }
    department = invite.department;
    phone = invite.phone || phone;
    ghanaCardId = ghanaCardId || null;

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
    const initialStatus = invite.auto_approve ? 'ACTIVE' : 'PENDING_APPROVAL';
    const profileFields = {
      role: department,
      full_name: fullName,
      ghana_card_id: ghanaCardId || null,
      phone: phone || null,
      photo: invite.photo || null,
      resume_url: invite.resume_url || null,
      address: invite.address || null,
      staff_category: invite.staff_category || null,
      guarantor_name: invite.guarantor_name || null,
      guarantor_phone: invite.guarantor_phone || null,
      guarantor_relationship: invite.guarantor_relationship || null,
      guarantor_id_number: invite.guarantor_id_number || null,
      guarantor_address: invite.guarantor_address || null,
      status: initialStatus,
      is_admin: department === 'CEO',
      requires_password_reset: true,
      updated_at: new Date().toISOString(),
    };
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      created_at: new Date().toISOString(),
      ...profileFields,
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
      ...profileFields,
      metadata: {
        fullName,
        department,
        ghanaCardId: ghanaCardId || null,
        phone: phone || null,
        tempAuthSecret: regPassword
      },
    }).eq('email', emailLower);

    await supabaseAdmin.from('staff_invites').update({ status: 'used' }).eq('id', invite.id);

    // Phase 9: Dispatch moved into Risk — a Risk / Driver registration
    // links (or creates) the driver's roster row the same way
    // register-driver-user.ts already did, just automatically as part of
    // this registration instead of a separate manual step.
    if (String(department).toLowerCase() === 'risk' && String(invite.role || '').toLowerCase() === 'driver' && userId) {
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('id, user_id')
        .eq('user_id', userId)
        .limit(1);
      if (!existingDriver?.length) {
        const { count } = await supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true });
        const generatedId = `DRV-${String((count || 0) + 1).padStart(3, '0')}`;
        await supabaseAdmin.from('drivers').insert({
          driver_id: generatedId,
          full_name: fullName,
          phone: phone || null,
          status: 'ACTIVE',
          user_id: userId,
        });
      }
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
