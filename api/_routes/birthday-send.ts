// api/birthday-send.ts
// Vercel Serverless Function — HR's "Send wish" from the Birthdays page.
// HR (or the CEO) picks or edits the message and the channels; this sends
// it by email and/or SMS and records it in birthday_wishes_log. WhatsApp
// is opened on HR's own device instead (one tap), and recorded there.
//
// Body: { personType: 'staff'|'customer', personId, templateId?, subject,
//         message, channels: ('email'|'sms')[], year? }
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from '../_shared/rateLimit';
import { getCaller } from '../_shared/reauth';
import { getSetting } from '../_shared/settings';
import { sendBirthdayWish, type BirthdayPerson } from '../_shared/birthdays';
import { deliverySummary } from '../_shared/mailer';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'birthday-send', 30, 60)) return;

  const caller = await getCaller(supabaseAdmin, req, res);
  if (!caller) return;
  if (String(caller.profile.role || '').toUpperCase() !== 'HR' && !caller.profile.is_admin) {
    return res.status(403).json({ error: 'Only HR sends birthday wishes.' });
  }
  if ((await getSetting(supabaseAdmin, 'birthday_wishes_enabled')) === 'false') {
    return res.status(403).json({ error: 'Birthday wishes are switched off in Control Center.' });
  }

  const { personType, personId, templateId, subject, message, channels, year } = req.body || {};
  if (personType !== 'staff' && personType !== 'customer') return res.status(400).json({ error: 'Unknown person type.' });
  const text = String(message || '').trim();
  if (!text) return res.status(400).json({ error: 'Write the message first.' });
  if (text.length > 1000) return res.status(400).json({ error: 'Keep the message under 1,000 characters.' });
  const chosen: string[] = (Array.isArray(channels) ? channels : []).filter((c: unknown) => c === 'email' || c === 'sms');
  if (!chosen.length) return res.status(400).json({ error: 'Pick email, SMS or both.' });

  // Load the person on the server; nothing about them is trusted from the device.
  let person: BirthdayPerson | null = null;
  if (personType === 'staff') {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email, phone').eq('id', personId).maybeSingle();
    if (data) person = { type: 'staff', id: String(data.id), name: data.full_name || '', email: data.email || null, phone: data.phone || null };
    else {
      // Staff without the app (Step 4) are wished as staff too.
      const { data: other } = await supabaseAdmin.from('non_app_staff').select('id, full_name, phone').eq('id', personId).maybeSingle();
      if (other) person = { type: 'staff', id: String(other.id), name: other.full_name || '', email: null, phone: other.phone || null };
    }
  } else {
    const { data } = await supabaseAdmin.from('customers').select('id, name, email, phone').eq('id', personId).maybeSingle();
    if (data) person = { type: 'customer', id: String(data.id), name: data.name || '', email: data.email || null, phone: data.phone || null };
  }
  if (!person) return res.status(404).json({ error: 'That person could not be found.' });

  const result = await sendBirthdayWish(supabaseAdmin, person, String(subject || 'Happy birthday from Rebma Impex Ghana Limited').slice(0, 200), text, chosen);

  const wishYear = Number.isInteger(year) ? year : new Date().getUTCFullYear();
  const { data: existing } = await supabaseAdmin
    .from('birthday_wishes_log')
    .select('id, email_sent, sms_sent')
    .eq('person_type', person.type).eq('person_id', person.id).eq('wish_year', wishYear)
    .maybeSingle();
  const row = {
    person_type: person.type, person_id: person.id, person_name: person.name, wish_year: wishYear,
    template_id: templateId || null, message: text, sent_by: caller.profile.full_name || 'HR', sent_at: new Date().toISOString(),
    email_sent: !!existing?.email_sent || !!result.email?.sent,
    sms_sent: !!existing?.sms_sent || !!result.sms?.sent,
    email_note: result.email && !result.email.sent ? result.email.reason : null,
    sms_note: result.sms && !result.sms.sent ? result.sms.reason : null,
  };
  if (existing) await supabaseAdmin.from('birthday_wishes_log').update(row).eq('id', existing.id);
  else await supabaseAdmin.from('birthday_wishes_log').insert(row);

  return res.status(200).json({ email: result.email, sms: result.sms, message: deliverySummary(result) || 'Nothing was sent.' });
}
