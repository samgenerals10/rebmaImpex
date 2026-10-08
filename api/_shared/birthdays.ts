// api/_shared/birthdays.ts
// Shared pieces for birthday wishes (approved Part B): who has a birthday on
// a date, filling a template's {name} / {first_name}, and sending by email
// and SMS. Used by the scheduled job (api/birthday-wishes.ts) and HR's
// manual Send (api/birthday-send.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMail, type SendResult } from './mailer';
import { paragraphsFromText } from './emailTemplate';
import { sendSms } from './sms';

export interface BirthdayPerson { type: 'staff' | 'customer'; id: string; name: string; email: string | null; phone: string | null }
export interface BirthdayTemplate { id: string; name: string; audience: 'staff' | 'customer' | 'both'; channels: string[]; email_subject: string; body: string; is_default: boolean }

// Month-day match. Someone born on 29 February is wished on 28 February in
// years without a 29th. Dates are compared in UTC, which is Ghana time.
export function isBirthdayOn(dob: string | null | undefined, day: Date): boolean {
  if (!dob) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return false;
  const month = Number(m[2]);
  const date = Number(m[3]);
  const tMonth = day.getUTCMonth() + 1;
  const tDate = day.getUTCDate();
  if (month === tMonth && date === tDate) return true;
  const y = day.getUTCFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return month === 2 && date === 29 && !leap && tMonth === 2 && tDate === 28;
}

export async function loadBirthdayPeople(supabaseAdmin: SupabaseClient): Promise<(BirthdayPerson & { dob: string })[]> {
  const [{ data: appStaff }, { data: otherStaff }, { data: customers }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, email, phone, date_of_birth, status').not('date_of_birth', 'is', null),
    // Staff without the app (Step 4): wished as staff, by SMS (no email).
    supabaseAdmin.from('non_app_staff').select('id, full_name, phone, date_of_birth, status').not('date_of_birth', 'is', null),
    supabaseAdmin.from('customers').select('id, name, email, phone, date_of_birth').not('date_of_birth', 'is', null),
  ]);
  return [
    ...[...(appStaff || []), ...(otherStaff || [])]
      .filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE')
      .map((p: any) => ({ type: 'staff' as const, id: String(p.id), name: p.full_name || '', email: p.email || null, phone: p.phone || null, dob: p.date_of_birth })),
    ...(customers || []).map((c: any) => ({ type: 'customer' as const, id: String(c.id), name: c.name || '', email: c.email || null, phone: c.phone || null, dob: c.date_of_birth })),
  ];
}

export function fillTemplate(text: string, fullName: string): string {
  const first = (fullName || '').trim().split(/\s+/)[0] || 'there';
  return text.replace(/\{first_name\}/g, first).replace(/\{name\}/g, (fullName || '').trim() || first);
}

// The default template for this person: one made for their group first,
// then one made for both groups.
export function pickDefaultTemplate(templates: BirthdayTemplate[], type: 'staff' | 'customer'): BirthdayTemplate | null {
  return templates.find((t) => t.is_default && t.audience === type)
    || templates.find((t) => t.is_default && t.audience === 'both')
    || null;
}

export async function sendBirthdayWish(
  supabaseAdmin: SupabaseClient,
  person: BirthdayPerson,
  subject: string,
  message: string,
  channels: string[],
): Promise<{ email?: SendResult; sms?: SendResult }> {
  const out: { email?: SendResult; sms?: SendResult } = {};
  if (channels.includes('email')) {
    out.email = await sendMail(supabaseAdmin, person.email, subject, `${message}\n\nRebma Impex`, paragraphsFromText(message), { preheader: subject });
  }
  if (channels.includes('sms')) {
    out.sms = await sendSms(supabaseAdmin, person.phone, message);
  }
  return out;
}
