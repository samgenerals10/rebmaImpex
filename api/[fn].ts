// api/[fn].ts
//
// The one server function. Vercel's free plan allows at most 12 server
// functions per deploy, and this app has more endpoints than that, so
// every endpoint lives in api/_routes/ (folders starting with _ are not
// counted) and this file hands each request to the right one by name.
// Addresses are unchanged: /api/approve-user still runs
// api/_routes/approve-user.ts, exactly as before.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { reportError } from './_shared/errorReport';
import h_account_deletion from './_routes/account-deletion';
import h_approve_user from './_routes/approve-user';
import h_attendance_device_webhook from './_routes/attendance-device-webhook';
import h_birthday_send from './_routes/birthday-send';
import h_birthday_wishes from './_routes/birthday-wishes';
import h_ceo_change_email from './_routes/ceo-change-email';
import h_ceo_confirm_email_change from './_routes/ceo-confirm-email-change';
import h_ceo_invite_co_ceo from './_routes/ceo-invite-co-ceo';
import h_ceo_removal from './_routes/ceo-removal';
import h_connector_devices from './_routes/connector-devices';
import h_connector_status from './_routes/connector-status';
import h_data_reset from './_routes/data-reset';
import h_department_change from './_routes/department-change';
import h_kick_user from './_routes/kick-user';
import h_lookup_invite from './_routes/lookup-invite';
import h_register_privileged_user from './_routes/register-privileged-user';
import h_report_error from './_routes/report-error';
import h_register_staff_user from './_routes/register-staff-user';
import h_register_standard_user from './_routes/register-standard-user';
import h_resend_invite from './_routes/resend-invite';
import h_reset_user_password from './_routes/reset-user-password';
import h_send_approval_notice from './_routes/send-approval-notice';
import h_send_push from './_routes/send-push';
import h_send_staff_invite_email from './_routes/send-staff-invite-email';
import h_set_user_status from './_routes/set-user-status';
import h_terminate_user from './_routes/terminate-user';
import h_trip from './_routes/trip';

const ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  'account-deletion': h_account_deletion,
  'approve-user': h_approve_user,
  'attendance-device-webhook': h_attendance_device_webhook,
  'birthday-send': h_birthday_send,
  'birthday-wishes': h_birthday_wishes,
  'ceo-change-email': h_ceo_change_email,
  'ceo-confirm-email-change': h_ceo_confirm_email_change,
  'ceo-invite-co-ceo': h_ceo_invite_co_ceo,
  'ceo-removal': h_ceo_removal,
  'connector-devices': h_connector_devices,
  'connector-status': h_connector_status,
  'data-reset': h_data_reset,
  'department-change': h_department_change,
  'kick-user': h_kick_user,
  'lookup-invite': h_lookup_invite,
  'register-privileged-user': h_register_privileged_user,
  'report-error': h_report_error,
  'register-staff-user': h_register_staff_user,
  'register-standard-user': h_register_standard_user,
  'resend-invite': h_resend_invite,
  'reset-user-password': h_reset_user_password,
  'send-approval-notice': h_send_approval_notice,
  'send-push': h_send_push,
  'send-staff-invite-email': h_send_staff_invite_email,
  'set-user-status': h_set_user_status,
  'terminate-user': h_terminate_user,
  'trip': h_trip,
};

// Any route that crashes, or answers with a server error (500 and up), is
// logged and emailed to the company address (_shared/errorReport.ts).
// report-error itself is left out so a reporting problem can't loop.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = String(req.query.fn || '');
  const route = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : undefined;
  if (!route) return res.status(404).json({ error: 'Not found.' });
  // The route name is not one of the endpoint's own inputs.
  delete (req.query as Record<string, unknown>).fn;
  if (name === 'report-error') return route(req, res);

  let serverError: string | null = null;
  const json = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 500) serverError = String(body?.error || body?.message || `HTTP ${res.statusCode}`);
    return json(body);
  }) as typeof res.json;

  try {
    await route(req, res);
  } catch (e: any) {
    const crash = String(e?.message || 'The server crashed.');
    await reportError(supabaseAdmin, { source: 'server', location: `/api/${name}`, message: crash, detail: e?.stack || null });
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong on the server. The team has been told.' });
    return;
  }
  // Set inside res.json above, which TypeScript can't see from here.
  const failed = serverError as string | null;
  if (failed) {
    await reportError(supabaseAdmin, { source: 'server', location: `/api/${name}`, message: failed });
  }
}
