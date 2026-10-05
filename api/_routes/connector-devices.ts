// api/connector-devices.ts
// Vercel Serverless Function — the device list for the on-site connector
// program (scripts/attendance-connector/). Instead of each device being
// typed into the connector's own config file, the connector asks this
// endpoint which devices to poll, so adding a device in the app (HR →
// Attendance → Add Device) is enough for the connector to start using it
// on its next poll.
//
// Only returns devices the connector actually has work to do for: SDK
// devices and API devices in "pull" mode. "Push" devices send scans
// straight to the webhook and never need the connector.
//
// Authenticated with a connector key (Control Center → API Keys →
// Attendance Connector Key, or the CONNECTOR_KEY env var as a fallback),
// not a user login, since the caller is a program on the office PC. This
// response includes each device's own login and webhook secret, so the key
// is required and compared in constant time.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { isConnectorAuthorized } from '../_shared/connectorAuth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // The connector polls every 30s; 30/min leaves plenty of headroom.
  if (await isRateLimited(supabaseAdmin, req, res, 'connector-devices', 30, 60)) return;

  if (!(await isConnectorAuthorized(supabaseAdmin, req))) {
    return res.status(401).json({ error: 'Invalid connector key.' });
  }

  const { data, error } = await supabaseAdmin
    .from('peripheral_devices')
    .select('id, device_name, connection_type, protocol, api_mode, ip_address, port, api_url, auth_username, auth_password, api_token, field_map, webhook_secret')
    .eq('device_type', 'attendance')
    .eq('is_active', true);
  if (error) return res.status(500).json({ error: `Could not load devices: ${error.message}` });

  const devices = (data || []).filter((d) => d.connection_type === 'sdk' || (d.connection_type === 'api' && d.api_mode === 'pull'));
  return res.status(200).json({ devices });
}
