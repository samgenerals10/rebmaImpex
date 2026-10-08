// api/_shared/errorReport.ts
// Logs an error to app_error_log and emails it to the company address
// (Control Center → API Keys → Error Reports Email, else the company Gmail).
// Used for server errors (api/[fn].ts) and for errors the web and phone
// apps send in (api/_routes/report-error.ts).
//
// Safety limits, so a bug can't flood the inbox:
//   the same error again within an hour is logged but not emailed;
//   after 40 error emails in a day, errors are only logged until tomorrow.
// Never throws: reporting an error must not cause another one.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { getSettings } from './settings';
import { sendMail, esc } from './mailer';

const DAILY_EMAIL_CAP = 40;
const REPEAT_WINDOW_MS = 60 * 60 * 1000;

export interface ErrorReport {
  source: 'server' | 'web' | 'phone';
  location?: string | null;
  message: string;
  detail?: string | null;
  userId?: string | null;
  userName?: string | null;
  pageUrl?: string | null;
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

export async function reportError(supabaseAdmin: SupabaseClient, r: ErrorReport): Promise<void> {
  try {
    const message = clip(r.message, 1000).trim() || 'Unknown error';
    const location = clip(r.location, 200) || null;
    // Numbers and ids vary between repeats of the same bug, so they're left
    // out of the fingerprint.
    const fingerprint = createHash('sha1')
      .update(`${r.source}|${location || ''}|${message.replace(/[0-9a-f]{8,}|\d+/gi, '#')}`)
      .digest('hex');

    const since = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString();
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const [{ count: recentSame }, { count: emailedToday }] = await Promise.all([
      supabaseAdmin.from('app_error_log').select('id', { count: 'exact', head: true }).eq('fingerprint', fingerprint).eq('emailed', true).gte('created_at', since),
      supabaseAdmin.from('app_error_log').select('id', { count: 'exact', head: true }).eq('emailed', true).gte('created_at', startOfDay.toISOString()),
    ]);
    const shouldEmail = !recentSame && (emailedToday || 0) < DAILY_EMAIL_CAP;

    let emailed = false;
    if (shouldEmail) {
      const s = await getSettings(supabaseAdmin, ['error_report_email', 'gmail_address']);
      const to = s.error_report_email || s.gmail_address;
      if (to) {
        const where = { server: 'Server', web: 'Web app', phone: 'Phone app' }[r.source];
        const when = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' });
        const rows: [string, string | null | undefined][] = [
          ['Where', `${where}${location ? `, ${location}` : ''}`],
          ['When', `${when} (Ghana time)`],
          ['Who', r.userName || (r.userId ? r.userId : 'Not signed in')],
          ['Page', r.pageUrl],
        ];
        const text = `${message}\n\n${rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}${r.detail ? `\n\nDetails:\n${clip(r.detail, 4000)}` : ''}\n\nOnly the first time an error happens each hour is emailed. Every occurrence is kept in the error log.`;
        const html = `<p style="font-size:15px"><strong>${esc(message)}</strong></p><table style="font-size:13px">${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#64748b;padding-right:12px">${k}</td><td>${esc(String(v))}</td></tr>`).join('')}</table>${r.detail ? `<pre style="font-size:12px;background:#f1f5f9;padding:10px;border-radius:6px;white-space:pre-wrap">${esc(clip(r.detail, 4000))}</pre>` : ''}<p style="font-size:12px;color:#64748b">Only the first time an error happens each hour is emailed. Every occurrence is kept in the error log.</p>`;
        const sent = await sendMail(supabaseAdmin, to, `Rebma error: ${clip(location || where, 80)}`, text, html);
        emailed = sent.sent;
      }
    }

    await supabaseAdmin.from('app_error_log').insert({
      source: r.source,
      location,
      message,
      detail: r.detail ? clip(r.detail, 8000) : null,
      user_id: r.userId || null,
      user_name: r.userName ? clip(r.userName, 200) : null,
      page_url: r.pageUrl ? clip(r.pageUrl, 500) : null,
      fingerprint,
      emailed,
    });
  } catch {
    // Reporting is best effort.
  }
}
