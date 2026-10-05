// api/connector-status.ts
// Vercel Serverless Function — the office connector program reports how
// each device is doing, so HR → Attendance shows it next to the device:
//   live       connected and listening; scans arrive the moment they happen
//   ok         read successfully (devices we fetch from on a timer)
//   error      couldn't reach or read the device (message says why)
//   no_driver  the connector has no driver for that make yet
//
// Same connector key as api/connector-devices.ts (the caller is a program
// on the office PC, not a signed-in person). It can only write these three
// health columns, and only on attendance devices that already exist.
//
// Body: { reports: [{ deviceId, status, message? }] }
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { isConnectorAuthorized } from '../_shared/connectorAuth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const STATUSES = new Set(['live', 'ok', 'error', 'no_driver']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // The connector reports about once a minute, plus on every change.
  if (await isRateLimited(supabaseAdmin, req, res, 'connector-status', 60, 60)) return;

  if (!(await isConnectorAuthorized(supabaseAdmin, req))) {
    return res.status(401).json({ error: 'Invalid connector key.' });
  }

  const reports = Array.isArray(req.body?.reports) ? req.body.reports.slice(0, 100) : [];
  const now = new Date().toISOString();
  let updated = 0;

  for (const r of reports) {
    const deviceId = typeof r?.deviceId === 'string' ? r.deviceId : '';
    const status = typeof r?.status === 'string' ? r.status : '';
    if (!UUID.test(deviceId) || !STATUSES.has(status)) continue;
    const message = typeof r?.message === 'string' ? r.message.slice(0, 300) : null;
    const { error } = await supabaseAdmin
      .from('peripheral_devices')
      .update({ connector_status: status, connector_message: message, connector_checked_at: now })
      .eq('id', deviceId)
      .eq('device_type', 'attendance');
    if (!error) updated += 1;
  }

  return res.status(200).json({ updated });
}
