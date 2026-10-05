// api/birthday-wishes.ts
// Vercel Serverless Function — the birthday wishes scheduler (Part B).
//
// Each run (safe to run any number of times a day):
//   1. Tells HR (bell + phone notification) whose birthday is TOMORROW and
//      whose is TODAY, once each per day.
//   2. If HR's auto-send is on and it's now past HR's sending time, sends
//      today's birthday people HR's default template, by its email/SMS
//      channels. Anyone HR already wished by hand is skipped. WhatsApp is
//      never automatic: it's one tap from HR's Birthdays page.
//
// What triggers it:
//   * Vercel Cron once a day at 08:00 Ghana time (vercel.json). The free
//     Vercel plan only allows daily jobs, so this alone covers the default
//     8:00 sending time.
//   * For any other sending time HR chooses, Supabase's free built-in
//     scheduler calls this every hour (see supabase_birthday_scheduler.sql).
//
// No secret is needed to call it: a run only ever does what was due today,
// and both the notices and the wishes are claimed in a log BEFORE they go
// out, so repeated or simultaneous calls can never double-send.
//
// The CEO's master switch (Control Center → Birthday Wishes) stops all of it.
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { getSetting } from './_shared/settings';
import { loadBirthdayPeople, isBirthdayOn, pickDefaultTemplate, fillTemplate, sendBirthdayWish, type BirthdayTemplate } from './_shared/birthdays';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function claimNotice(date: string, kind: 'today' | 'tomorrow' | 'no_template'): Promise<boolean> {
  const { error } = await supabaseAdmin.from('birthday_notice_log').insert({ notice_date: date, kind });
  return !error;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'birthday-wishes', 10, 60)) return;

  if ((await getSetting(supabaseAdmin, 'birthday_wishes_enabled')) === 'false') {
    return res.status(200).json({ skipped: true, reason: 'Birthday wishes are switched off in Control Center.' });
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600_000);
  const people = await loadBirthdayPeople(supabaseAdmin);
  const todays = people.filter((p) => isBirthdayOn(p.dob, now));
  const tomorrows = people.filter((p) => isBirthdayOn(p.dob, tomorrow));
  const listNames = (list: typeof people) => list.map((p) => `${p.name} (${p.type === 'staff' ? 'staff' : 'customer'})`).join(', ');

  // 1. Notices to HR.
  const notices: string[] = [];
  if (tomorrows.length && (await claimNotice(ymd(now), 'tomorrow'))) {
    await supabaseAdmin.from('notifications').insert({
      recipient_department: 'HR', type: 'birthday', read: false, created_at: now.toISOString(),
      title: `Birthday${tomorrows.length > 1 ? 's' : ''} tomorrow`,
      message: `${listNames(tomorrows)}. Open HR, then Birthdays to prepare a message.`,
    });
    notices.push('tomorrow');
  }
  if (todays.length && (await claimNotice(ymd(now), 'today'))) {
    await supabaseAdmin.from('notifications').insert({
      recipient_department: 'HR', type: 'birthday', read: false, created_at: now.toISOString(),
      title: `Birthday${todays.length > 1 ? 's' : ''} today`,
      message: `${listNames(todays)}. Open HR, then Birthdays to send a wish.`,
    });
    notices.push('today');
  }

  // 2. Automatic sending.
  const { data: settings } = await supabaseAdmin.from('birthday_settings').select('auto_send, send_time').eq('id', 'default').maybeSingle();
  const autoSend = settings?.auto_send !== false;
  const [hh, mm] = String(settings?.send_time || '08:00').split(':').map((n) => parseInt(n, 10));
  const dueAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh || 0, mm || 0);
  const results: any[] = [];

  if (autoSend && now.getTime() >= dueAt && todays.length) {
    const { data: templateRows } = await supabaseAdmin.from('birthday_templates').select('*');
    const templates = (templateRows || []) as BirthdayTemplate[];
    const year = now.getUTCFullYear();

    for (const person of todays) {
      const template = pickDefaultTemplate(templates, person.type);
      if (!template) { results.push({ name: person.name, skipped: 'no default template' }); continue; }

      // Claim first; a conflict means HR (or an earlier run) already wished them.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('birthday_wishes_log')
        .insert({ person_type: person.type, person_id: person.id, person_name: person.name, wish_year: year, template_id: template.id, sent_by: 'Automatic' })
        .select('id').maybeSingle();
      if (claimError || !claimed) { results.push({ name: person.name, skipped: 'already wished' }); continue; }

      const message = fillTemplate(template.body, person.name);
      const sent = await sendBirthdayWish(supabaseAdmin, person, fillTemplate(template.email_subject, person.name), message, template.channels.filter((c) => c !== 'whatsapp'));
      await supabaseAdmin.from('birthday_wishes_log').update({
        message, email_sent: !!sent.email?.sent, sms_sent: !!sent.sms?.sent,
        email_note: sent.email && !sent.email.sent ? sent.email.reason : null,
        sms_note: sent.sms && !sent.sms.sent ? sent.sms.reason : null,
        sent_at: now.toISOString(),
      }).eq('id', claimed.id);
      results.push({ name: person.name, emailSent: !!sent.email?.sent, smsSent: !!sent.sms?.sent });
    }

    // Warn HR once a day if wishes were held back for lack of a default.
    if (results.some((r) => r.skipped === 'no default template') && (await claimNotice(ymd(now), 'no_template'))) {
      await supabaseAdmin.from('notifications').insert({
        recipient_department: 'HR', type: 'birthday', read: false, created_at: now.toISOString(),
        title: 'Birthday wish not sent automatically',
        message: 'Some birthday wishes could not go out automatically because no default template is set. Open HR, then Birthday Templates and mark one as default.',
      });
    }
  }

  return res.status(200).json({ date: ymd(now), today: todays.length, tomorrow: tomorrows.length, notices, autoSend, results });
}
