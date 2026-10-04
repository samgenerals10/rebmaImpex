// api/_shared/mailer.ts
// Every message the app sends to a person: the staff invite (first send and
// resend), the "you're approved" notice, and birthday wishes. Each goes out
// by email AND by SMS, per direct instruction.
//
// Email goes through Resend (https://resend.com), which has a free plan
// (3,000 emails a month, 100 a day). Its key and the "send from" address
// are entered in Control Center → API Keys, never in Vercel. Until a domain
// is verified in Resend, it only delivers to the Resend account's own
// address; that's Resend's rule, not ours.
//
// SMS goes through _shared/sms.ts (a spare Android phone, free).
//
// Nothing here throws for a missing setup. Each channel reports
// { sent: false, reason } so the real work (an approval, a reopened invite)
// still finishes and the person using the app is told what didn't go out.
//
// Copy rule: nothing sent to a person being registered says who approves
// them. They only ever hear "waiting for approval".
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from './settings';
import { sendSms, type SendResult } from './sms';

export type { SendResult };

const DEFAULT_FROM = 'Rebma Impex <onboarding@resend.dev>';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function isMailConfigured(supabaseAdmin: SupabaseClient): Promise<boolean> {
  return !!(await getSettings(supabaseAdmin, ['api_key_resend'])).api_key_resend;
}

export async function sendMail(supabaseAdmin: SupabaseClient, to: string | null | undefined, subject: string, text: string, html: string): Promise<SendResult> {
  if (!to) return { sent: false, reason: 'No email address on file.' };
  const s = await getSettings(supabaseAdmin, ['api_key_resend', 'email_from_address']);
  if (!s.api_key_resend) return { sent: false, reason: 'Email is not set up yet (Control Center → API Keys → Resend).' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.api_key_resend}` },
      body: JSON.stringify({ from: s.email_from_address || DEFAULT_FROM, to: [to], subject, text, html }),
    });
    if (!res.ok) {
      const body: any = await res.json().catch(() => ({}));
      return { sent: false, reason: `Resend refused the email: ${body?.message || `HTTP ${res.status}`}` };
    }
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: `Could not reach Resend (${e?.message || 'network error'}).` };
  }
}

async function getDownloadUrl(supabaseAdmin: SupabaseClient): Promise<string> {
  return (await getSettings(supabaseAdmin, ['app_download_url'])).app_download_url;
}

export type Channel = 'email' | 'sms';

// Two links: the app download (Control Center → API Keys → Mobile App
// Download Link) and the registration link they paste into the app's
// Register page. With no download link set, only the registration step is
// included rather than a broken link.
export async function sendInvite(
  supabaseAdmin: SupabaseClient,
  invite: { email?: string | null; phone?: string | null; full_name?: string | null; token: string },
  origin: string,
  channels: Channel[] = ['email', 'sms'],
): Promise<{ link: string; email?: SendResult; sms?: SendResult }> {
  const link = `${origin}/register?token=${invite.token}`;
  const downloadUrl = await getDownloadUrl(supabaseAdmin);
  const name = invite.full_name || '';
  const after = 'When you register you choose your own password. Your registration then waits for approval, and we will let you know as soon as you can sign in.';
  const expiry = 'This link expires in 7 days. Once you register, it must be approved within 12 hours or you will need a new link.';
  const result: { link: string; email?: SendResult; sms?: SendResult } = { link };

  if (channels.includes('email')) {
    const textSteps = downloadUrl
      ? `1. Download the Rebma app:\n${downloadUrl}\n\n2. Open the app, tap Register on the sign-in page, and paste this link:\n${link}`
      : `Open the Rebma app, tap Register on the sign-in page, and paste this link:\n${link}`;
    const htmlSteps = downloadUrl
      ? `<p><strong>1. Download the Rebma app:</strong><br><a href="${esc(downloadUrl)}">${esc(downloadUrl)}</a></p><p><strong>2. Open the app, tap Register on the sign-in page, and paste this link:</strong><br><a href="${esc(link)}">${esc(link)}</a></p>`
      : `<p>Open the Rebma app, tap Register on the sign-in page, and paste this link:<br><a href="${esc(link)}">${esc(link)}</a></p>`;
    result.email = await sendMail(
      supabaseAdmin,
      invite.email,
      'Your Rebma Impex invite: download the app and register',
      `Hi ${name},\n\nYou have been invited to join Rebma Impex.\n\n${textSteps}\n\n${after}\n\n${expiry} If you weren't expecting this, you can safely ignore it.\n\nRebma Impex HR`,
      `<p>Hi ${esc(name)},</p><p>You have been invited to join Rebma Impex.</p>${htmlSteps}<p>${after}</p><p>${expiry} If you weren't expecting this, you can safely ignore it.</p><p>Rebma Impex HR</p>`,
    );
  }

  if (channels.includes('sms')) {
    const smsSteps = downloadUrl
      ? `1. Download the app: ${downloadUrl}\n2. Open it, tap Register and paste: ${link}`
      : `Open the Rebma app, tap Register and paste: ${link}`;
    result.sms = await sendSms(
      supabaseAdmin,
      invite.phone,
      `Hi ${name}, you're invited to join Rebma Impex.\n${smsSteps}\nYou'll choose your password when you register. Link expires in 7 days.`,
    );
  }
  return result;
}

export async function sendApproved(
  supabaseAdmin: SupabaseClient,
  person: { email?: string | null; phone?: string | null; fullName: string },
  origin: string,
): Promise<{ email: SendResult; sms: SendResult }> {
  const email = await sendMail(
    supabaseAdmin,
    person.email,
    'Your Rebma Impex account is approved',
    `Hi ${person.fullName},\n\nYour registration has been approved. You can now sign in to the Rebma app with your email and the password you chose when you registered.\n\nOn the web: ${origin}\n\nRebma Impex HR`,
    `<p>Hi ${esc(person.fullName)},</p><p>Your registration has been approved. You can now sign in to the Rebma app with your email and the password you chose when you registered.</p><p>On the web: <a href="${esc(origin)}">${esc(origin)}</a></p><p>Rebma Impex HR</p>`,
  );
  const sms = await sendSms(
    supabaseAdmin,
    person.phone,
    `Hi ${person.fullName}, your Rebma Impex account is approved. Sign in with your email and the password you chose.`,
  );
  return { email, sms };
}

// One plain sentence for whoever triggered the send, e.g.
// "Emailed and texted." / "Emailed. SMS not sent: No usable phone number on file."
export function deliverySummary(r: { email?: SendResult; sms?: SendResult }): string {
  const parts: string[] = [];
  const ok = [r.email?.sent && 'emailed', r.sms?.sent && 'texted'].filter(Boolean) as string[];
  if (ok.length) parts.push(`${ok.join(' and ').replace(/^./, (c) => c.toUpperCase())}.`);
  if (r.email && !r.email.sent) parts.push(`Email not sent: ${r.email.reason}`);
  if (r.sms && !r.sms.sent) parts.push(`SMS not sent: ${r.sms.reason}`);
  return parts.join(' ');
}
