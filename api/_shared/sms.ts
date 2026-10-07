// api/_shared/sms.ts
// Sends text messages through Arkesel (https://arkesel.com), a Ghana SMS
// company. Nothing else is needed: no spare phone. Sign-up and the API are
// free; each text costs a little from your Arkesel top-up (about GHS 0.02).
//
// Set up once in Control Center → API Keys: the Arkesel API key and the
// sender name people see (up to 11 letters, approved by Arkesel, e.g.
// REBMA).
//
// Request shape from Arkesel's own API spec (v2.4.0):
//   POST https://sms.arkesel.com/api/v2/sms/send   header  api-key: <key>
//   { "sender": "REBMA", "message": "...", "recipients": ["233244123456"] }
//   reply { "status": "success", "data": [...] } or
//         { "status": "error", "message": "Insufficient balance or invalid coverage!" }
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from './settings';

const ARKESEL_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const DEFAULT_SENDER = 'REBMA';

export interface SendResult { sent: boolean; reason?: string }

// Ghanaian numbers are usually typed as 0244123456. Arkesel needs the
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
  return !!(await getSettings(supabaseAdmin, ['api_key_arkesel'])).api_key_arkesel;
}

export async function sendSms(supabaseAdmin: SupabaseClient, phone: string | null | undefined, text: string): Promise<SendResult> {
  const s = await getSettings(supabaseAdmin, ['api_key_arkesel', 'sms_sender_id', 'sms_default_country_code']);
  if (!s.api_key_arkesel) {
    return { sent: false, reason: 'SMS is not set up yet (Control Center, then API Keys, then SMS (Arkesel)).' };
  }
  const number = toInternational(phone || '', (s.sms_default_country_code || '233').replace(/\D/g, '') || '233');
  if (!number) return { sent: false, reason: 'No usable phone number on file.' };
  // Arkesel wants the number without the plus sign: 233244123456.
  const recipient = number.replace(/^\+/, '');
  const sender = (s.sms_sender_id || DEFAULT_SENDER).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 11) || DEFAULT_SENDER;

  try {
    const res = await fetch(ARKESEL_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': s.api_key_arkesel },
      body: JSON.stringify({ sender, message: text, recipients: [recipient] }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (res.ok && body?.status === 'success') return { sent: true };
    const why = body?.message || `HTTP ${res.status}`;
    if (res.status === 402 || /balance/i.test(why)) return { sent: false, reason: 'Arkesel says the SMS balance is too low. Top up your Arkesel account.' };
    if (res.status === 401 || /api.?key|unauthori/i.test(why)) return { sent: false, reason: 'Arkesel did not accept the API key. Check it in Control Center, then API Keys.' };
    return { sent: false, reason: `Arkesel refused the text: ${why}` };
  } catch (e: any) {
    return { sent: false, reason: `Could not reach Arkesel (${e?.message || 'network error'}).` };
  }
}
