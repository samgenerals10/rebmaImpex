// api/_shared/sms.ts
// Sends text messages through "SMS Gateway for Android"
// (https://sms-gate.app): a free, open-source app that turns a spare
// Android phone with a SIM into the sender. Texts come out of that SIM's
// own SMS bundle, so there's no SMS company and no per-text fee to us.
// The app's public cloud server, which relays our request to the phone,
// is free (https://docs.sms-gate.app/pricing/).
//
// Set up once in Control Center → API Keys: the username and password the
// app shows under "Cloud server". The phone must stay on, charged and
// connected for texts to go out.
//
// Request shape from the official docs:
//   POST https://api.sms-gate.app/3rdparty/v1/messages  (Basic auth)
//   { "textMessage": { "text": "..." }, "phoneNumbers": ["+233..."] }
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from './settings';

const DEFAULT_GATEWAY_URL = 'https://api.sms-gate.app/3rdparty/v1';

export interface SendResult { sent: boolean; reason?: string }

// Ghanaian numbers are usually typed as 0244123456. The gateway needs the
// international form, +233244123456. A number already starting with + or
// 00 is kept as international.
export function toInternational(raw: string, countryCode = '233'): string | null {
  const s = String(raw || '').replace(/[^\d+]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) return s.length >= 9 ? s : null;
  if (s.startsWith('00')) return `+${s.slice(2)}`;
  if (s.startsWith(countryCode)) return `+${s}`;
  if (s.startsWith('0')) return `+${countryCode}${s.slice(1)}`;
  if (s.length === 9) return `+${countryCode}${s}`;
  return null;
}

export async function isSmsConfigured(supabaseAdmin: SupabaseClient): Promise<boolean> {
  const s = await getSettings(supabaseAdmin, ['sms_gateway_username', 'sms_gateway_password']);
  return !!(s.sms_gateway_username && s.sms_gateway_password);
}

export async function sendSms(supabaseAdmin: SupabaseClient, phone: string | null | undefined, text: string): Promise<SendResult> {
  const s = await getSettings(supabaseAdmin, ['sms_gateway_username', 'sms_gateway_password', 'sms_gateway_url', 'sms_default_country_code']);
  if (!s.sms_gateway_username || !s.sms_gateway_password) {
    return { sent: false, reason: 'SMS is not set up yet (Control Center → API Keys → SMS Gateway).' };
  }
  const number = toInternational(phone || '', (s.sms_default_country_code || '233').replace(/\D/g, '') || '233');
  if (!number) return { sent: false, reason: 'No usable phone number on file.' };

  const base = (s.sms_gateway_url || DEFAULT_GATEWAY_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${s.sms_gateway_username}:${s.sms_gateway_password}`).toString('base64')}`,
      },
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [number] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, reason: `The SMS phone refused the message (HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}).` };
    }
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: `Could not reach the SMS phone (${e?.message || 'network error'}).` };
  }
}
