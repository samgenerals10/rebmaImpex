// api/_shared/settings.ts
// Reads CEO settings (Control Center) on the server. Every API key the
// app uses lives in Control Center → API Keys (the ceo_settings table),
// per direct instruction; only the database connection itself stays in
// Vercel's environment. Values may be stored JSON-encoded or raw, the same
// way rebma-mobile/lib/ceoSetting.ts reads them.
import type { SupabaseClient } from '@supabase/supabase-js';

function decode(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      return v;
    }
  }
  return String(v);
}

export async function getSettings(supabaseAdmin: SupabaseClient, keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = '';
  try {
    const { data } = await supabaseAdmin.from('ceo_settings').select('setting_key, setting_value').in('setting_key', keys);
    for (const row of data || []) out[row.setting_key] = decode(row.setting_value).trim();
  } catch {
    // Unreadable settings behave like empty ones: the feature reports
    // "not set up" instead of failing the whole request.
  }
  return out;
}

export async function getSetting(supabaseAdmin: SupabaseClient, key: string): Promise<string> {
  return (await getSettings(supabaseAdmin, [key]))[key];
}

// The web address people open the app at, for links in emails and texts.
// Control Center → API Keys → App Web Address first, then the request's own
// origin, then the deployed default.
export async function getAppOrigin(supabaseAdmin: SupabaseClient, reqOrigin?: string): Promise<string> {
  const fromSettings = await getSetting(supabaseAdmin, 'app_web_address');
  return (fromSettings || reqOrigin || process.env.PUBLIC_APP_URL || 'https://app.rebmaimpex.com').replace(/\/+$/, '');
}
