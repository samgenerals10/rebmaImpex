// api/register-standard-user.ts
// Vercel Serverless Function — registers a person from an HR invite using
// the Admin API (bypasses SMTP confirmation).
//
// The person now chooses their own password here, so no temporary
// password is generated, emailed, or stored anywhere. Earlier versions
// kept the generated password in profiles.metadata.tempAuthSecret in
// plain text; that is gone.
//
// Also recorded for the CEO's review, in staff_registration_details (CEO
// read only, see supabase_registration_details.sql): the device they used,
// their GPS location if they allowed it, and an approximate location plus
// IP address taken from the request. The approximate location comes from
// Vercel's own geo headers, so no third party sees anyone's IP.
//
// Copy rule: the person is only ever told their registration is waiting
// for approval. Nothing here tells them who approves it.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findUserByEmail } from './_shared/findUserByEmail';
import { isRateLimited } from './_shared/rateLimit';
import { APPROVAL_WINDOW_HOURS } from './_shared/registration';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Statuses that mean "no working account yet", so registering again with
// the same email is allowed. Anything else is a real account and must not
// be overwritten by someone holding an invite for that email.
const REREGISTERABLE = new Set(['PENDING', 'PENDING_APPROVAL', 'REJECTED', 'EXPIRED']);

function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Choose a password of at least 8 characters.';
  if (pw.length > 72) return 'That password is too long. Use 72 characters or fewer.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Your password needs at least one letter and one number.';
  return null;
}

// Keeps only short scalar values from client-supplied JSON, so a request
// can't stuff anything large or nested into the CEO's review record.
function cleanObject(raw: unknown, keys: string[]): Record<string, string | number | boolean> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string | number | boolean> = {};
  for (const k of keys) {
    const v = (raw as any)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function header(req: VercelRequest, name: string): string {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return '';
  try { return decodeURIComponent(s); } catch { return s; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Real registration is a one-time action per person — nobody
  // legitimately submits this more than a handful of times a minute, so
  // this is deliberately tight. Every one of these calls creates a real
  // Supabase Auth user via the admin API if it gets far enough, so a
  // flood here isn't just expensive, it's also how someone would try to
  // mass-create accounts.
  if (await isRateLimited(supabaseAdmin, req, res, 'register-standard-user', 10, 60)) return;

  try {
    const { email, fullName, inviteToken, password, device, location } = req.body || {};
    let { department, phone, ghanaCardId } = req.body || {};
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and Full Name are required.' });
    }
    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ error: pwProblem });

    const emailLower = String(email).trim().toLowerCase();

    const { data: gateRows } = await supabaseAdmin
      .from('ceo_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['registrations_allowed']);
    const registrationsAllowed = gateRows?.find(r => r.setting_key === 'registrations_allowed')?.setting_value !== false;
    if (!registrationsAllowed) {
      return res.status(403).json({ error: 'New registrations are currently closed.' });
    }

    // Every non-privileged registration requires a valid invite. CEO
    // accounts register through the separate privileged path, which never
    // calls this endpoint.
    if (!inviteToken) {
      return res.status(403).json({ error: 'Registration requires an invite link from HR.' });
    }

    // Resolve the invite server-side and trust everything it carries over
    // whatever the client submitted. A tampered request can't use a valid
    // token to register into a different department, role, or with
    // different personal details than the ones HR entered.
    const { data: invites } = await supabaseAdmin
      .from('staff_invites')
      .select('id, email, department, role, phone, photo, resume_url, address, staff_category, guarantor_name, guarantor_phone, guarantor_relationship, guarantor_id_number, guarantor_address, auto_approve, status, expires_at, created_by')
      .eq('token', inviteToken)
      .limit(1);
    const invite = invites?.[0];
    if (!invite || invite.status !== 'pending' || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) {
      return res.status(410).json({ error: 'This invite link is no longer valid. Ask HR to send you a new one.' });
    }
    // The invite was issued to one email address. Registering it under a
    // different one would let a forwarded link create someone else's account.
    if (invite.email && String(invite.email).trim().toLowerCase() !== emailLower) {
      return res.status(403).json({ error: 'This invite was sent to a different email address.' });
    }
    // Only a CEO may create a CEO invite or one that skips approval. The
    // database stamps the real creator (supabase_ceo_security.sql), so this
    // can't be faked from a phone or browser.
    let creatorIsCeo = false;
    if (invite.created_by) {
      const { data: creator } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', invite.created_by).maybeSingle();
      creatorIsCeo = !!creator?.is_admin;
    }
    if (String(invite.department || '').toUpperCase() === 'CEO' && !creatorIsCeo) {
      return res.status(403).json({ error: 'This invite link is no longer valid. Ask HR to send you a new one.' });
    }
    const autoApprove = !!invite.auto_approve && creatorIsCeo && String(invite.department || '').toUpperCase() !== 'CEO';
    department = invite.department;
    phone = invite.phone || phone;
    ghanaCardId = ghanaCardId || null;

    const userMetadata = {
      full_name: fullName,
      department,
      ghanaCardId: ghanaCardId || null,
      phone: phone || null,
    };

    // A not-yet-approved account is locked at sign-in until approved, so
    // nobody can get a session (and database access) before approval.
    const banDuration = autoApprove ? 'none' : '876000h';

    const foundUser = await findUserByEmail(supabaseAdmin, emailLower);
    let userId = foundUser?.id;

    if (!foundUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        ban_duration: banDuration,
      });
      if (createError) {
        return res.status(400).json({ error: `Registration failed: ${createError.message}` });
      }
      userId = createData.user?.id;
    } else {
      // Only a login with no working account behind it (never approved,
      // rejected, or expired) may be re-registered. A real account is
      // never overwritten, even by someone holding a valid invite.
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('status')
        .eq('id', foundUser.id)
        .maybeSingle();
      const existingStatus = String(existingProfile?.status || '').toUpperCase();
      if (existingProfile && !REREGISTERABLE.has(existingStatus)) {
        return res.status(409).json({ error: 'An account with this email already exists. Sign in instead, or ask HR for help.' });
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        password,
        user_metadata: userMetadata,
        ban_duration: banDuration,
      });
      if (updateError) {
        return res.status(400).json({ error: `Registration update failed: ${updateError.message}` });
      }
    }

    const nowIso = new Date().toISOString();
    // An invite with auto_approve skips the approval queue entirely.
    const initialStatus = autoApprove ? 'ACTIVE' : 'PENDING_APPROVAL';
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: emailLower,
      created_at: nowIso,
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
      // CEO powers are only given when a CEO approves (approve-user.ts).
      is_admin: false,
      // They chose this password themselves, so no forced reset.
      requires_password_reset: false,
      registered_at: nowIso,
      updated_at: nowIso,
      metadata: { fullName, department, ghanaCardId: ghanaCardId || null, phone: phone || null, inviteRole: invite.role || null },
    }, { onConflict: 'id' });

    // What the CEO reviews before approving. Never fatal: if this write
    // fails (e.g. the SQL hasn't been run yet) the registration still goes
    // through, the CEO just sees "not recorded".
    try {
      const forwarded = header(req, 'x-forwarded-for');
      const ip = (forwarded.split(',')[0] || header(req, 'x-real-ip') || '').trim() || null;
      const networkLocation = cleanObject({
        city: header(req, 'x-vercel-ip-city'),
        region: header(req, 'x-vercel-ip-country-region'),
        country: header(req, 'x-vercel-ip-country'),
        latitude: Number(header(req, 'x-vercel-ip-latitude')) || undefined,
        longitude: Number(header(req, 'x-vercel-ip-longitude')) || undefined,
      }, ['city', 'region', 'country', 'latitude', 'longitude']);
      await supabaseAdmin.from('staff_registration_details').upsert({
        user_id: userId,
        invite_id: invite.id,
        registered_at: nowIso,
        device: cleanObject(device, ['kind', 'platform', 'os', 'osVersion', 'model', 'manufacturer', 'browser', 'appVersion', 'userAgent', 'screen']),
        location: cleanObject(location, ['latitude', 'longitude', 'accuracy', 'address', 'source', 'refusedReason']),
        network_location: networkLocation,
        ip_address: ip,
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Could not save registration details:', e);
    }

    await supabaseAdmin.from('staff_invites').update({ status: 'used' }).eq('id', invite.id);

    // Phase 9: Dispatch moved into Risk — a Risk / Driver registration
    // links (or creates) the driver's roster row automatically.
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

    // Tell the CEO directly. Same notifications table the bell reads; its
    // insert also fires the send-push webhook.
    if (initialStatus !== 'ACTIVE') {
      await supabaseAdmin.from('notifications').insert({
        recipient_department: 'CEO',
        title: 'New staff awaiting your approval',
        message: `${fullName} (${invite.role || department}) has registered. Approve within ${APPROVAL_WINDOW_HOURS} hours or the registration expires.`,
        type: 'approval',
        read: false,
        created_at: nowIso,
      });
    }

    return res.status(200).json({
      success: true,
      message: initialStatus === 'ACTIVE'
        ? 'Registration complete. You can sign in now with your email and the password you chose.'
        : 'Your registration is waiting for approval. We will email you as soon as you can sign in.',
      userId,
      status: initialStatus,
    });

  } catch (err: any) {
    console.error('Server error during standard registration:', err);
    return res.status(500).json({ error: err.message || 'Server error occurred.' });
  }
}
