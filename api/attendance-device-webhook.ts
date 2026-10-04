// api/attendance-device-webhook.ts
// Vercel Serverless Function — receives real attendance events from a
// physical biometric device (e.g. a ZKTeco K14/MB10 fingerprint terminal)
// via a small connector program running on the company's own network. The
// device never talks to this endpoint directly — see the connector script
// this file ships alongside (scripts/attendance-connector/) for why.
//
// Writes into the SAME `attendance` table Reception's existing manual
// check-in screen already writes into (rebma-mobile/screens/reception/
// AttendanceScreen.tsx) — confirmed exact column shape by reading that
// screen's own insert payload, not guessed. This means a fingerprint
// check-in shows up on every existing attendance screen (Reception, HR)
// with zero UI changes, per the explicit goal of not maintaining two
// separate attendance systems.
//
// Authenticated via a shared-secret header, the same pattern api/send-
// push.ts already uses for its own webhook — the caller here is the
// company's own connector program, not an end user with a login session,
// so there's no user Bearer token to check.
//
// The secret is now per-device, matched by the payload's own `deviceId`
// against `peripheral_devices.device_name` (the "Add Attendance Device"
// screen in the app, HR's Attendance screen — Control Center's old single
// global key doesn't scale once more than one terminal exists, which the
// user explicitly said is coming: "as time goes on, there could be other
// [devices]"). ceo_settings' single key is kept as a fallback ONLY for a
// device that was never registered in that screen, so nothing already
// configured that way silently breaks; a registered device's own secret
// always wins once one exists for that deviceId.
//
// Manual setup required once this is deployed:
//   1. In the app, HR's Attendance screen → Attendance Devices → Add
//      Device. Pick SDK or API. Devices are never hard-coded; anything
//      added there is picked up automatically.
//   2. API, Push devices: paste the push address the app shows (it holds
//      ?device=NAME&key=SECRET) into the device or its cloud portal.
//      SDK and API, Pull devices: run the connector program in registry
//      mode (scripts/attendance-connector/config.json with apiBaseUrl and
//      connectorKey). It fetches the device list from
//      api/connector-devices.ts and posts here with each device's own name
//      and secret, so nothing per device goes into its config.
//   3. Enroll each employee on the physical device using their real
//      employee number (format EMP-00001 — from `profiles.employee_number`
//      for an app-using staff member, or from `non_app_staff.employee_number`
//      for someone hired but given no app account) as that device's
//      "User ID" field — this is the only place employee identity is
//      matched, so a mismatch here means the device's checkins are
//      rejected with a clear "employee not found" error, not silently
//      dropped or mis-attributed.
//
// Explicitly out of scope for this pass (matching the app's own current
// scope, not a new gap introduced here): CHECK_OUT events. The
// `attendance` table has no check_out_time column anywhere in this app
// today — Reception's own screen is check-in only. A CHECK_OUT event is
// acknowledged (200, not an error) but not written, so a device sending
// both event types doesn't fail; only CHECK_IN is actually recorded.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { timingSafeEqual } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const envWebhookSecret = process.env.ATTENDANCE_DEVICE_WEBHOOK_SECRET || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Mirrors rebma-mobile/lib/ceoSetting.ts's getCeoSetting() exactly (same
// ceo_settings(setting_key, setting_value) shape, same JSON-or-raw-string
// read) — inlined rather than imported since this Vercel function has its
// own separate build context, the same reason every other file in api/
// is self-contained.
async function getCeoSettingValue(key: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from('ceo_settings').select('setting_value').eq('setting_key', key).maybeSingle();
    const v = data?.setting_value;
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return v; }
    }
    return String(v);
  } catch {
    return '';
  }
}

async function getGlobalFallbackSecret(): Promise<string> {
  const fromSettings = await getCeoSettingValue('api_key_attendance_webhook_secret');
  return fromSettings || envWebhookSecret;
}

// Device lookup by name (the payload's deviceId, or ?device= in the URL
// for devices that can only be given a URL, not custom headers). Matched
// case-insensitively; % and _ are escaped so a crafted name can't
// wildcard-match some other device's row.
interface DeviceRow {
  id: string;
  webhook_secret: string;
  field_map: Record<string, string> | null;
  is_active: boolean;
}

async function findDevice(deviceId: string | undefined): Promise<DeviceRow | null> {
  if (!deviceId) return null;
  const pattern = deviceId.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await supabaseAdmin
    .from('peripheral_devices')
    .select('id, webhook_secret, field_map, is_active')
    .eq('device_type', 'attendance')
    .ilike('device_name', pattern)
    .maybeSingle();
  return (data as DeviceRow) || null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Where each value lives in the device's own JSON. A registered device can
// override any of these in the app (Add Device → field mapping), which is
// what lets a new brand work without a code change. Dot paths are allowed,
// e.g. "data.userId".
const DEFAULT_FIELD_MAP: Record<string, string> = {
  employeeNumber: 'employeeNumber',
  timestamp: 'timestamp',
  event: 'event',
  recordsPath: '',
};

function getPath(obj: any, path: string | undefined): any {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Keypad-only terminals (like the Dahua ASA1222E-S) can only store
// numeric user IDs, so staff get enrolled as e.g. 46 instead of EMP-00046.
// A purely numeric ID is also tried as its EMP-padded form.
function employeeNumberCandidates(raw: unknown): string[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  if (/^\d+$/.test(s)) return [s, `EMP-${String(parseInt(s, 10)).padStart(5, '0')}`];
  return [s];
}

// No event field (or one we can't read) counts as a check-in; anything
// containing "out" (CHECK_OUT, checkout, "Out") is a check-out.
function normalizeEvent(raw: unknown): 'CHECK_IN' | 'CHECK_OUT' {
  return /out/i.test(String(raw ?? '')) ? 'CHECK_OUT' : 'CHECK_IN';
}

// ISO strings and epoch seconds/milliseconds are all accepted. A missing
// or unreadable time falls back to when we received it.
function parseTimestamp(raw: unknown): Date {
  if (typeof raw === 'number') return new Date(raw < 1e12 ? raw * 1000 : raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const d = raw ? new Date(String(raw)) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

// Mirrors rebma-mobile/lib/attendanceRules.ts's isPastTime()/DEFAULT_ATTENDANCE_RULES
// exactly, but inlined rather than imported — this Vercel function has its
// own separate build/bundling context from the mobile app, the same reason
// every other file in api/ is self-contained rather than importing from
// rebma-mobile/ or rebma-web/.
const DEFAULT_LATE_AFTER = '09:00';

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

async function getLateAfterTime(): Promise<string> {
  const { data } = await supabaseAdmin.from('attendance_rules').select('late_after_time').eq('id', 'default').maybeSingle();
  return data?.late_after_time || DEFAULT_LATE_AFTER;
}

interface RecordResult { status: number; body: Record<string, unknown> }

interface Person {
  kind: 'app' | 'no_app';
  id: string;
  fullName: string;
  department: string | null;
  employeeNumber: string | null;
  status: string;
  viaEnrollment: boolean;
}

async function loadPersonById(kind: 'app' | 'no_app', id: string, viaEnrollment: boolean): Promise<Person | null> {
  if (kind === 'app') {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, role, employee_number, status').eq('id', id).maybeSingle();
    return data ? { kind, id: data.id, fullName: data.full_name, department: data.role, employeeNumber: data.employee_number, status: String(data.status || '').toUpperCase(), viaEnrollment } : null;
  }
  const { data } = await supabaseAdmin.from('non_app_staff').select('id, full_name, department, employee_number, status').eq('id', id).maybeSingle();
  return data ? { kind, id: data.id, fullName: data.full_name, department: data.department, employeeNumber: data.employee_number, status: String(data.status || 'ACTIVE').toUpperCase(), viaEnrollment } : null;
}

async function resolvePerson(deviceId: string | null, rawUserId: string, candidates: string[]): Promise<Person | { error: RecordResult }> {
  if (deviceId && rawUserId) {
    const pattern = rawUserId.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: enrolled } = await supabaseAdmin.from('device_enrollments')
      .select('person_kind, person_id').eq('device_id', deviceId).ilike('device_user_id', pattern).maybeSingle();
    if (enrolled) {
      const p = await loadPersonById(enrolled.person_kind, enrolled.person_id, true);
      if (p) return p;
    }
  }

  const { data: profiles, error: profileErr } = await supabaseAdmin
    .from('profiles').select('id').in('employee_number', candidates).limit(1);
  if (profileErr) return { error: { status: 500, body: { error: `Employee lookup failed: ${profileErr.message}` } } };
  if (profiles?.[0]) {
    const p = await loadPersonById('app', profiles[0].id, false);
    if (p) return p;
  }
  const { data: others, error: nonAppErr } = await supabaseAdmin
    .from('non_app_staff').select('id').in('employee_number', candidates).limit(1);
  if (nonAppErr) return { error: { status: 500, body: { error: `Employee lookup failed: ${nonAppErr.message}` } } };
  if (others?.[0]) {
    const p = await loadPersonById('no_app', others[0].id, false);
    if (p) return p;
  }
  return { error: { status: 404, body: { error: `No staff member found with User ID ${candidates[0]}. Enroll them on this device with their employee number, or link the User ID to them in HR.` } } };
}

async function noteRefusal(device: DeviceRow | null, message: string) {
  if (!device) return;
  await supabaseAdmin.from('peripheral_devices').update({ last_refusal_message: message.slice(0, 300), last_refusal_at: new Date().toISOString() }).eq('id', device.id);
}

async function processRecord(rec: any, map: Record<string, string>, device: DeviceRow | null): Promise<RecordResult> {
  const candidates = employeeNumberCandidates(getPath(rec, map.employeeNumber));
  if (candidates.length === 0) {
    return { status: 400, body: { error: `No employee number found in the scan (expected field "${map.employeeNumber}").` } };
  }
  const event = normalizeEvent(getPath(rec, map.event));
  if (event === 'CHECK_OUT') {
    // Acknowledged, not an error — see the file header comment. Prevents
    // a device that sends both event types from seeing every CHECK_OUT
    // as a failure and retrying it forever.
    return { status: 200, body: { recorded: false, reason: 'CHECK_OUT is not yet tracked by this system.' } };
  }

  // Who is this? Checked in order:
  //   1. this device's own enrollment list (device_enrollments), for a
  //      person enrolled under a User ID that isn't their employee number;
  //   2. their employee number, among app users (profiles) and then staff
  //      without an app account (non_app_staff).
  const rawUserId = String(getPath(rec, map.employeeNumber) ?? '').trim();
  const person = await resolvePerson(device?.id || null, rawUserId, candidates);
  if ('error' in person) return person.error;

  // Step 4 (approved): a suspended, blocked or terminated person's scan is
  // refused, so their attendance stays clean. The device keeps the reason.
  if (person.status !== 'ACTIVE') {
    const why = `${person.fullName} (${person.employeeNumber || rawUserId}) is ${person.status.toLowerCase() || 'not active'}, so the scan was not recorded.`;
    await noteRefusal(device, why);
    return { status: 403, body: { recorded: false, error: why } };
  }

  const staffName = person.fullName;
  const department = person.department;
  const employeeNumber = person.employeeNumber || candidates[0];
  // Linking the row to the person's account is what lets the attendance
  // table show their photo and details. Staff without an app account have
  // no account to link, so it stays empty for them.
  const userId = person.kind === 'app' ? person.id : null;

  // The first accepted scan records who is enrolled on this device under
  // which User ID, so HR sees it without typing anything.
  if (device && !person.viaEnrollment && rawUserId) {
    await supabaseAdmin.from('device_enrollments').upsert({
      device_id: device.id, person_kind: person.kind, person_id: person.id, employee_number: person.employeeNumber,
      device_user_id: rawUserId, source: 'scan', enrolled_by: 'First scan',
    }, { onConflict: 'device_id,person_kind,person_id', ignoreDuplicates: true });
  }

  // A time more than 5 minutes ahead means the device clock is wrong (or
  // the scan was made up). It is recorded at the time we received it, so a
  // future-dated check-in can never be planted and a real scan is not lost.
  let eventDate = parseTimestamp(getPath(rec, map.timestamp));
  if (eventDate.getTime() > Date.now() + 5 * 60_000) eventDate = new Date();
  const dateStr = eventDate.toISOString().slice(0, 10);

  // A real device can retry/resend the same scan (network hiccup, staff
  // member scanning twice by mistake) — don't create a second row for a
  // check-in that already happened today.
  const { data: existing } = await supabaseAdmin
    .from('attendance')
    .select('id')
    .eq('employee_number', employeeNumber)
    .eq('date', dateStr)
    .maybeSingle();
  if (existing) {
    return { status: 200, body: { recorded: false, reason: 'Already checked in today.', attendanceId: existing.id } };
  }

  const lateAfter = await getLateAfterTime();
  const isLate = (eventDate.getHours() * 60 + eventDate.getMinutes()) > timeStringToMinutes(lateAfter);

  const record = {
    staff_name: staffName,
    check_in_time: eventDate.toISOString(),
    status: isLate ? 'LATE' : 'PRESENT',
    date: dateStr,
    attendance_type: 'Biometric',
    gps_verified: false,
    department,
    late_reason: null,
    employee_number: employeeNumber,
    user_id: userId,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin.from('attendance').insert(record).select('id').single();
  if (insertErr) return { status: 500, body: { error: `Could not record attendance: ${insertErr.message}` } };
  return { status: 200, body: { recorded: true, attendanceId: inserted.id, status: record.status } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // A real device checks in one employee at a time, a few seconds apart
  // at most — 60/min per source IP is generous for that and still a hard
  // ceiling against a flood or a secret-guessing sweep, checked before
  // the (also real, also costs a query) webhook-secret lookup below.
  if (await isRateLimited(supabaseAdmin, req, res, 'attendance-webhook', 60, 60)) return;

  const body = req.body ?? {};
  // Header first (the connector program sends these), then URL query
  // params, for devices whose settings only accept a URL.
  const deviceId = (typeof body.deviceId === 'string' && body.deviceId) || (typeof req.query.device === 'string' ? req.query.device : undefined);
  const providedSecret = (typeof req.headers['x-webhook-secret'] === 'string' ? req.headers['x-webhook-secret'] : '') || (typeof req.query.key === 'string' ? req.query.key : '');

  const device = await findDevice(deviceId);
  const expectedSecret = device?.webhook_secret || (await getGlobalFallbackSecret());
  if (!expectedSecret || !providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: 'Invalid webhook secret.' });
  }
  if (device && !device.is_active) {
    return res.status(403).json({ error: 'This device is deactivated in the app.' });
  }

  const map = { ...DEFAULT_FIELD_MAP, ...(device?.field_map || {}) };
  const source = map.recordsPath ? getPath(body, map.recordsPath) : body;
  // Some devices send one scan per request, others a batch. Capped so one
  // request can't fan out into thousands of database writes.
  const records = (Array.isArray(source) ? source : [source]).slice(0, 200);

  if (device) {
    await supabaseAdmin.from('peripheral_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);
  }

  const results: RecordResult[] = [];
  for (const rec of records) {
    const result = await processRecord(rec, map, device);
    // An unknown person is a refusal HR should see on the device too.
    if (result.status === 404) await noteRefusal(device, String(result.body.error || 'Unknown person.'));
    results.push(result);
  }

  if (results.length === 1) return res.status(results[0].status).json(results[0].body);
  return res.status(200).json({ results: results.map((r) => ({ httpStatus: r.status, ...r.body })) });
}
