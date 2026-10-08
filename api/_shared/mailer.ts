// api/_shared/mailer.ts
// Every message the app sends to a person: the staff invite (first send and
// resend), the "you're approved" notice, and birthday wishes. Each goes out
// by email AND by SMS, per direct instruction.
//
// Email goes out one of two free ways, both set in Control Center → API
// Keys (never in Vercel):
//   Resend  (https://resend.com) an API key and a "send from" address on
//           the verified company domain (hr@rebmaimpex.com). Goes first
//           when both are filled in.
//   Gmail   a Gmail address plus a Google "app password". The backup when
//           Resend fails, and the main route if Resend isn't set up.
//           About 500 emails a day.
//
// SMS goes through _shared/sms.ts (Arkesel, a Ghana SMS company).
//
// Nothing here throws for a missing setup. Each channel reports
// { sent: false, reason } so the real work (an approval, a reopened invite)
// still finishes and the person using the app is told what didn't go out.
//
// Copy rule: nothing sent to a person being registered says who approves
// them. They only ever hear "waiting for approval".
import type { SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { getSettings, getAppOrigin } from './settings';
import { esc as escapeHtml } from './htmlEscape';
import { brandedEmail, paragraphsFromText, emailButton, emailNote, emailStep, emailCallout, emailPanel, COMPANY_NAME } from './emailTemplate';
import { sendSms, type SendResult } from './sms';

export type { SendResult };

const DEFAULT_FROM = 'Rebma Impex Ghana Limited <onboarding@resend.dev>';

export const esc = escapeHtml;

const MAIL_KEYS = ['gmail_address', 'gmail_app_password', 'api_key_resend', 'email_from_address'];

// Google shows app passwords as four groups of four letters; spaces are
// fine to paste but aren't part of the password.
const gmailPassword = (p: string) => p.replace(/\s+/g, '');
const hasGmail = (s: Record<string, string>) => !!(s.gmail_address && gmailPassword(s.gmail_app_password));

export async function isMailConfigured(supabaseAdmin: SupabaseClient): Promise<boolean> {
  const s = await getSettings(supabaseAdmin, MAIL_KEYS);
  return hasGmail(s) || !!s.api_key_resend;
}

async function sendViaGmail(s: Record<string, string>, to: string, subject: string, text: string, html: string): Promise<SendResult> {
  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: s.gmail_address, pass: gmailPassword(s.gmail_app_password) },
    });
    await transport.sendMail({ from: `"${COMPANY_NAME}" <${s.gmail_address}>`, to, subject, text, html });
    return { sent: true };
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (e?.code === 'EAUTH' || /535|Username and Password not accepted|Invalid login/i.test(msg)) {
      return { sent: false, reason: 'Gmail refused the sign-in. Check the Gmail address and app password in Control Center, then API Keys (the Google account needs 2-Step Verification turned on to make an app password).' };
    }
    if (/limit|quota|550 5\.4\.5|421/i.test(msg)) {
      return { sent: false, reason: 'Gmail daily sending limit reached. Try again tomorrow.' };
    }
    return { sent: false, reason: `Gmail could not send the email (${msg || 'network error'}).` };
  }
}

async function sendViaResend(s: Record<string, string>, to: string, subject: string, text: string, html: string): Promise<SendResult> {
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

// Order: Resend first when it has a key AND a company "From" address
// (the verified domain, e.g. hr@rebmaimpex.com); if that fails, Gmail takes
// over when it is set up, so a Resend problem never stops an invite.
// Without a company From address, Resend can only reach its own owner, so
// Gmail goes first when it is set up.
export async function sendMail(supabaseAdmin: SupabaseClient, to: string | null | undefined, subject: string, text: string, bodyHtml: string, opts: { raw?: boolean; preheader?: string; title?: string; subtitle?: string } = {}): Promise<SendResult> {
  if (!to) return { sent: false, reason: 'No email address on file.' };
  const s = await getSettings(supabaseAdmin, MAIL_KEYS);
  // Every email gets the same branded look (logo, card, footer) unless a
  // caller already built a full page.
  const html = opts.raw ? bodyHtml : brandedEmail({ origin: await getAppOrigin(supabaseAdmin), bodyHtml, preheader: opts.preheader, title: opts.title ?? subject, subtitle: opts.subtitle, contact: (/<([^>]+)>/.exec(s.email_from_address || '')?.[1] || s.email_from_address || s.gmail_address || '').trim() });
  const resendReady = !!(s.api_key_resend && s.email_from_address);

  if (resendReady) {
    const first = await sendViaResend(s, to, subject, text, html);
    if (first.sent || !hasGmail(s)) return first;
    const backup = await sendViaGmail(s, to, subject, text, html);
    return backup.sent ? backup : { sent: false, reason: `${first.reason} Then Gmail also failed: ${backup.reason}` };
  }
  if (hasGmail(s)) return sendViaGmail(s, to, subject, text, html);
  if (!s.api_key_resend) return { sent: false, reason: 'Email is not set up yet (Control Center, then API Keys, then Resend or Gmail).' };
  return sendViaResend(s, to, subject, text, html);
}

async function getDownloadUrl(supabaseAdmin: SupabaseClient): Promise<string> {
  return (await getSettings(supabaseAdmin, ['app_download_url'])).app_download_url;
}

export type Channel = 'email' | 'sms';

const DEPARTMENT_LABELS: Record<string, string> = {
  admin_warehouse: 'Admin & Warehouse', operations: 'Admin & Warehouse', dispatch: 'Admin & Warehouse', logistics: 'Admin & Warehouse',
  finance: 'Account Department', hr: 'HR', marketing: 'Marketing', receptionist: 'Reception', reception: 'Reception',
  production: 'Production', management: 'Management', risk: 'Risk', ceo: 'CEO',
};
const departmentLabel = (code?: string | null) => (code ? DEPARTMENT_LABELS[String(code).toLowerCase()] || String(code) : '');
const prettyDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' });
};

// Two links: the app download (Control Center → API Keys → Mobile App
// Download Link) and the registration link they paste into the app's
// Register page. With no download link set, only the registration step is
// included rather than a broken link.
//
// customMessage is the text HR edited in the Send panel. When given, it is
// the body of the email and of the text; the registration button is always
// added so the link can't be lost by editing, and the text gets the link
// appended if HR's version left it out.
export async function sendInvite(
  supabaseAdmin: SupabaseClient,
  invite: { email?: string | null; phone?: string | null; full_name?: string | null; token: string; department?: string | null; role?: string | null; expires_at?: string | null },
  origin: string,
  channels: Channel[] = ['email', 'sms'],
  customMessage?: string | null,
): Promise<{ link: string; email?: SendResult; sms?: SendResult }> {
  const link = `${origin}/register?token=${invite.token}`;
  const downloadUrl = await getDownloadUrl(supabaseAdmin);
  const name = invite.full_name || '';
  const after = 'When you register you choose your own password. Your registration then waits for approval, and we will let you know as soon as you can sign in.';
  const expiry = 'This link expires in 7 days. Once you register, it must be approved within 12 hours or you will need a new link.';
  const custom = (customMessage || '').trim().slice(0, 2000);
  const result: { link: string; email?: SendResult; sms?: SendResult } = { link };

  if (channels.includes('email')) {
    const subject = `You are invited to join ${COMPANY_NAME}`;
    const heroOpts = { title: 'You are invited', subtitle: `Join the team at ${COMPANY_NAME}`, preheader: `Your invitation to join ${COMPANY_NAME}` };
    const linkFallback = `${emailNote('If the button does not work, copy this link into the Rebma app or your browser:')}${emailNote(link)}`;
    if (custom) {
      result.email = await sendMail(
        supabaseAdmin, invite.email, subject,
        `${custom}${custom.includes(link) ? '' : `\n\nRegister here:\n${link}`}\n\n${COMPANY_NAME}`,
        `${paragraphsFromText(custom)}${emailButton('Register now', link)}${linkFallback}`,
        heroOpts,
      );
    } else {
      const textSteps = downloadUrl
        ? `1. Download the Rebma app:\n${downloadUrl}\n\n2. Open the app, tap Register on the sign-in page, and paste this link:\n${link}`
        : `Open the Rebma app, tap Register on the sign-in page, and paste this link:\n${link}`;
      const steps = downloadUrl
        ? `${emailStep(1, 'Get the Rebma app', `<a href="${esc(downloadUrl)}" style="color:#16a34a;font-weight:600;word-break:break-all">${esc(downloadUrl)}</a>`)}${emailStep(2, 'Open it and tap Register', 'Paste your invite link when it asks, then choose your own password.')}`
        : `${emailStep(1, 'Open the Rebma app and tap Register', 'Paste your invite link when it asks, then choose your own password.')}`;
      result.email = await sendMail(
        supabaseAdmin, invite.email, subject,
        `Hi ${name},\n\nYou have been invited to join ${COMPANY_NAME}.\n\n${textSteps}\n\n${after}\n\n${expiry} If you weren't expecting this, you can safely ignore it.\n\n${COMPANY_NAME}`,
        `${paragraphsFromText(`Hi ${name},\n\nYou have been invited to join ${COMPANY_NAME}. Here are the details of your invitation:`)}${emailPanel({
          title: 'Your invitation',
          reference: invite.email ? `Sent to ${invite.email}` : undefined,
          rows: [['Name', name], ['Role', (invite.role || '').replace(/^./, (c) => c.toUpperCase())], ['Department', departmentLabel(invite.department)], ['Link valid until', prettyDate(invite.expires_at)]],
          linkLabel: 'Open registration',
          linkUrl: link,
        })}${paragraphsFromText('Here is how to get started:')}${steps}${emailButton('Register now', link)}${linkFallback}${emailCallout(`${after} ${expiry}`)}${emailNote("If you weren't expecting this, you can safely ignore it.")}`,
        heroOpts,
      );
    }
  }

  if (channels.includes('sms')) {
    const defaultSms = downloadUrl
      ? `Hi ${name}, you're invited to join ${COMPANY_NAME}.\n1. Download the app: ${downloadUrl}\n2. Open it, tap Register and paste: ${link}\nYou'll choose your password when you register. Link expires in 7 days.`
      : `Hi ${name}, you're invited to join ${COMPANY_NAME}.\nOpen the Rebma app, tap Register and paste: ${link}\nYou'll choose your password when you register. Link expires in 7 days.`;
    const sms = custom ? (custom.includes(link) ? custom : `${custom}\n${link}`) : defaultSms;
    result.sms = await sendSms(supabaseAdmin, invite.phone, sms);
  }
  return result;
}

// The "you're approved" notice, sent on approval and by HR's "Send sign-in
// notice again". Gives both ways in: the web address, and the phone app
// download link when one is set in Control Center → API Keys.
export async function sendApproved(
  supabaseAdmin: SupabaseClient,
  person: { email?: string | null; phone?: string | null; fullName: string },
  origin: string,
): Promise<{ email: SendResult; sms: SendResult }> {
  const downloadUrl = await getDownloadUrl(supabaseAdmin);
  const signIn = 'Sign in with your email and the password you chose when you registered.';
  const textWays = downloadUrl
    ? `On your phone, get the Rebma app here:\n${downloadUrl}\n\nOn a computer, open:\n${origin}`
    : `Open the Rebma app on your phone, or on a computer go to:\n${origin}`;
  const ways = downloadUrl
    ? `${emailStep(1, 'On your phone', `Get the Rebma app: <a href="${esc(downloadUrl)}" style="color:#16a34a;font-weight:600;word-break:break-all">${esc(downloadUrl)}</a>`)}${emailStep(2, 'On a computer', `Open <a href="${esc(origin)}" style="color:#16a34a;font-weight:600;word-break:break-all">${esc(origin)}</a>`)}`
    : '';
  const email = await sendMail(
    supabaseAdmin,
    person.email,
    `Your ${COMPANY_NAME} account is approved`,
    `Hi ${person.fullName},\n\nYour registration has been approved. ${signIn}\n\n${textWays}\n\n${COMPANY_NAME}`,
    `${paragraphsFromText(`Hi ${person.fullName},\n\nYour registration has been approved. ${signIn}`)}${emailPanel({
      title: 'Your account',
      reference: person.email || undefined,
      rows: [['Name', person.fullName], ['Status', 'Approved']],
      linkLabel: 'Sign in',
      linkUrl: origin,
    })}${ways}${emailButton('Sign in on the web', origin)}`,
    { title: 'You are approved', subtitle: 'Your account is ready to use', preheader: `Your ${COMPANY_NAME} account is approved` },
  );
  const sms = await sendSms(
    supabaseAdmin,
    person.phone,
    downloadUrl
      ? `Hi ${person.fullName}, your ${COMPANY_NAME} account is approved. Get the app: ${downloadUrl} or use ${origin}. Sign in with your email and the password you chose.`
      : `Hi ${person.fullName}, your ${COMPANY_NAME} account is approved. Sign in at ${origin} with your email and the password you chose.`,
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
