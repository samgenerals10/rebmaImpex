// api/_shared/emailTemplate.ts
// The one look every email from the app shares. Layout in the style of a
// modern product email: a dark header with soft wave artwork and a large
// headline, a flat white card, a grey details panel, and a sign-off row with
// the logo on the right. Colours, the Inter font and the green gradient
// button come from the system's own design tokens (rebma-web/src/index.css).
// No shadows.
//
// Built with tables and inline styles, because email apps (Gmail, Outlook,
// phones) ignore most modern CSS. Inter is requested with a normal system
// font as the fallback: Apple Mail, iPhone Mail and Outlook show Inter,
// while Gmail only ever shows its own fonts, so there it falls back to the
// closest system font. The logo and header artwork are loaded from the
// app's own web address (public/logo-mark.png, public/email/).
import { esc } from './htmlEscape';

export const COMPANY_NAME = 'Rebma Impex Ghana Limited';

const ACCENT = '#22c55e';
const ACCENT_DARK = '#16a34a';
const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#94a3b8';
const PANEL = '#f4f6f8';
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const GRADIENT = `linear-gradient(135deg,${ACCENT},${ACCENT_DARK})`;
const HEADER_BG = '#06180f';

/** Plain text to email paragraphs: blank line = new paragraph, a single
 *  line break is kept, web addresses become clickable. */
export function paragraphsFromText(text: string): string {
  const linkify = (s: string) =>
    esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${ACCENT_DARK};font-weight:600;word-break:break-all">${u}</a>`);
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:14px;line-height:1.75;color:${BODY}">${linkify(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** The system's primary button: green gradient, white text, pill shape. */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td align="center" bgcolor="${ACCENT_DARK}" style="border-radius:999px;background:${ACCENT_DARK};background-image:${GRADIENT}"><a href="${esc(url)}" style="display:inline-block;padding:13px 32px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
}

/** The grey details panel: a title, a muted reference line, a list of
 *  label and value rows, and an optional link on the right. */
export function emailPanel(opts: {
  title: string;
  reference?: string;
  rows?: [string, string][];
  linkLabel?: string;
  linkUrl?: string;
}): string {
  const rows = (opts.rows || []).filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:5px 0;font-size:12.5px;color:${MUTED};width:38%;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:13.5px;font-weight:600;color:${INK};vertical-align:top">${esc(v)}</td></tr>`)
    .join('');
  const link = opts.linkLabel && opts.linkUrl
    ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e3e8ee;text-align:right"><a href="${esc(opts.linkUrl)}" style="font-size:12.5px;font-weight:600;color:${ACCENT_DARK};text-decoration:none">${esc(opts.linkLabel)}</a></div>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;background:${PANEL};border-radius:12px"><tr><td style="padding:20px 22px;font-family:${FONT}">
    <div style="font-size:16px;font-weight:600;color:${INK}">${esc(opts.title)}</div>
    ${opts.reference ? `<div style="margin-top:3px;font-size:12px;color:${MUTED};word-break:break-all">${esc(opts.reference)}</div>` : ''}
    ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${rows}</table>` : ''}
    ${link}
  </td></tr></table>`;
}

/** One numbered step, for things that really happen in order. */
export function emailStep(n: number, title: string, bodyHtml = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:${PANEL};border-radius:12px"><tr>
    <td width="54" valign="top" style="padding:16px 0 16px 18px"><div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:${ACCENT_DARK};background-image:${GRADIENT};color:#ffffff;font-family:${FONT};font-size:13px;font-weight:700">${n}</div></td>
    <td valign="top" style="padding:15px 18px 15px 4px;font-family:${FONT}"><div style="font-size:14px;font-weight:600;color:${INK};line-height:1.5">${esc(title)}</div>${bodyHtml ? `<div style="margin-top:3px;font-size:13px;line-height:1.65;color:${BODY}">${bodyHtml}</div>` : ''}</td>
  </tr></table>`;
}

/** A soft note for the "good to know" part. */
export function emailCallout(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;border:1px solid #dcfce7;background:#f0fdf4;border-radius:12px"><tr><td style="padding:14px 18px;font-family:${FONT};font-size:13px;line-height:1.7;color:${BODY}">${esc(text)}</td></tr></table>`;
}

/** A small muted note. */
export function emailNote(text: string): string {
  return `<p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:${MUTED};word-break:break-all">${esc(text)}</p>`;
}

export function brandedEmail(opts: {
  origin: string;
  bodyHtml: string;
  title?: string;
  subtitle?: string;
  preheader?: string;
  signOff?: string;
  contact?: string;
}): string {
  const origin = opts.origin.replace(/\/+$/, '');
  const logo = `${origin}/logo-mark.png`;
  const waves = `${origin}/email/header-waves.png`;
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader)}</div>` : '';
  const hero = opts.title
    ? `<div style="margin-top:30px;font-size:26px;line-height:1.25;font-weight:600;color:#ffffff;letter-spacing:-0.01em">${esc(opts.title)}</div>${opts.subtitle ? `<div style="margin-top:8px;font-size:13.5px;line-height:1.6;color:#a7c7b6">${esc(opts.subtitle)}</div>` : ''}`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(COMPANY_NAME)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${ACCENT};-webkit-text-size-adjust:100%;font-family:${FONT}">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ACCENT}"><tr><td align="center" style="padding:40px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:8px">
    <tr><td bgcolor="${HEADER_BG}" background="${esc(waves)}" style="background:${HEADER_BG};background-image:url('${esc(waves)}');background-size:cover;background-position:center bottom;border-radius:8px 8px 0 0;padding:30px 36px 38px;font-family:${FONT}">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#ffffff;border-radius:10px;padding:6px 10px"><img src="${esc(logo)}" width="50" height="30" alt="${esc(COMPANY_NAME)}" style="display:block;border:0;width:50px;height:30px"></td>
        <td style="padding-left:12px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff">${esc(COMPANY_NAME)}</td>
      </tr></table>
      ${hero}
    </td></tr>
    <tr><td style="padding:34px 36px 6px;font-family:${FONT};color:${BODY}">
      ${opts.bodyHtml}
    </td></tr>
    <tr><td style="padding:10px 36px 34px;font-family:${FONT}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle"><div style="font-size:13.5px;font-weight:600;color:${INK}">${esc(opts.signOff || COMPANY_NAME)}</div>${opts.contact ? `<div style="margin-top:2px;font-size:12px;color:${MUTED}">${esc(opts.contact)}</div>` : ''}</td>
        <td valign="middle" align="right" width="60"><img src="${esc(logo)}" width="50" height="30" alt="" style="display:block;border:0;width:50px;height:30px"></td>
      </tr></table>
      <div style="margin-top:22px;font-size:11.5px;line-height:1.7;color:${MUTED}">This message was sent to you by ${esc(COMPANY_NAME)}. Please do not share the links in it with anyone else.</div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
