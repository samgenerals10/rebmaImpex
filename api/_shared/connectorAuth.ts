// api/_shared/connectorAuth.ts
// Checks the connector key the office connector program sends
// (x-connector-key). The key lives in Control Center → API Keys →
// Attendance Connector Key, with the CONNECTOR_KEY env var as a fallback.
// Compared in constant time so the key can't be guessed byte by byte.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { timingSafeEqual } from 'crypto';

async function getConnectorKey(supabaseAdmin: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from('ceo_settings').select('setting_value').eq('setting_key', 'api_key_connector').maybeSingle();
    const v = data?.setting_value;
    if (typeof v === 'string' && v) {
      try { return String(JSON.parse(v)); } catch { return v; }
    }
  } catch {
    // fall through to the env var
  }
  return process.env.CONNECTOR_KEY || '';
}

export async function isConnectorAuthorized(supabaseAdmin: SupabaseClient, req: VercelRequest): Promise<boolean> {
  const provided = typeof req.headers['x-connector-key'] === 'string' ? req.headers['x-connector-key'] : '';
  const expected = await getConnectorKey(supabaseAdmin);
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
