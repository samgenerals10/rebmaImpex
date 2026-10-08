// api/_shared/emailTemplate.ts
// The one look every email from the app shares, built from the system's own
// design tokens (rebma-web/src/index.css): the Inter font, the green
// gradient button (#22c55e to #16a34a), the soft green page background,
// the slate text colours and 14px card corners. No shadows.
//
// Built with tables and inline styles, because email apps (Gmail, Outlook,
// phones) ignore most modern CSS. Inter is requested with a normal system
// font as the fallback: Apple Mail, iPhone Mail and Outlook show Inter,
// while Gmail only ever shows its own fonts, so there it falls back to the
// closest system font. The logo is loaded from the app's own web address,
// so it always matches the current logo.
import { esc } from './htmlEscape';

export const COMPANY_NAME = 'Rebma Impex Ghana Limited';

const ACCENT = '#22c55e';
const ACCENT_DARK = '#16a34a';
const PAGE_BG = '#f0fdf4';
const INK = '#0f172a';
const BODY = '#475569';
const MUTED = '#94a3b8';
const BORDER = '#e2e8f0';
const SOFT = '#f8fafc';
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const GRADIENT = `linear-gradient(135deg,${ACCENT},${ACCENT_DARK})`;

/** Plain text to email paragraphs: blank line = new paragraph, a single
 *  line break is kept, web addresses become clickable. */
export function paragraphsFromText(text: string): string {
  const linkify = (s: string) =>
    esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${ACCENT_DARK};font-weight:600;word-break:break-all">${u}</a>`);
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BODY}">${linkify(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** The system's primary button: green gradient, white text, pill shape. */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td align="center" bgcolor="${ACCENT_DARK}" style="border-radius:999px;background:${ACCENT_DARK};background-image:${GRADIENT}"><a href="${esc(url)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
}

/** One numbered step, for things that really happen in order. */
export function emailStep(n: number, title: string, bodyHtml = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:${SOFT};border:1px solid ${BORDER};border-radius:14px"><tr>
    <td width="56" valign="top" style="padding:16px 0 16px 16px"><div style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:999px;background:${ACCENT_DARK};background-image:${GRADIENT};color:#ffffff;font-family:${FONT};font-size:14px;font-weight:700">${n}</div></td>
    <td valign="top" style="padding:16px 16px 16px 4px;font-family:${FONT}"><div style="font-size:15px;font-weight:600;color:${INK};line-height:1.4">${esc(title)}</div>${bodyHtml ? `<div style="margin-top:4px;font-size:13.5px;line-height:1.6;color:${BODY}">${bodyHtml}</div>` : ''}</td>
  </tr></table>`;
}

/** A soft green box for the "good to know" part. */
export function emailCallout(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;background:${PAGE_BG};border:1px solid #bbf7d0;border-radius:14px"><tr><td style="padding:14px 18px;font-family:${FONT};font-size:13px;line-height:1.65;color:${BODY}">${esc(text)}</td></tr></table>`;
}

/** A small grey note. */
export function emailNote(text: string): string {
  return `<p style="margin:0 0 10px;font-size:12.5px;line-height:1.6;color:${MUTED};word-break:break-all">${esc(text)}</p>`;
}

export function brandedEmail(opts: {
  origin: string;
  bodyHtml: string;
  title?: string;
  subtitle?: string;
  preheader?: string;
  signOff?: string;
}): string {
  const logo = `${opts.origin.replace(/\/+$/, '')}/logo-mark.png`;
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader)}</div>` : '';
  const hero = opts.title
    ? `<div style="font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;letter-spacing:-0.01em">${esc(opts.title)}</div>${opts.subtitle ? `<div style="margin-top:8px;font-size:15px;line-height:1.55;color:#dcfce7">${esc(opts.subtitle)}</div>` : ''}`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(COMPANY_NAME)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;font-family:${FONT}">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG}"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid ${BORDER};border-radius:14px">
    <tr><td bgcolor="${ACCENT_DARK}" style="background:${ACCENT_DARK};background-image:${GRADIENT};border-radius:13px 13px 0 0;padding:26px 32px 30px;font-family:${FONT}">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 ${opts.title ? '24px' : '0'}"><tr>
        <td style="background:#ffffff;border-radius:12px;padding:8px 12px"><img src="${esc(logo)}" width="67" height="40" alt="${esc(COMPANY_NAME)}" style="display:block;border:0;width:67px;height:40px"></td>
        <td style="padding-left:14px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.35;color:#ffffff">${esc(COMPANY_NAME)}</td>
      </tr></table>
      ${hero}
    </td></tr>
    <tr><td style="padding:30px 32px 8px;font-family:${FONT};color:${BODY}">
      ${opts.bodyHtml}
      <p style="margin:24px 0 2px;font-size:15px;line-height:1.5;color:${BODY}">Best regards,</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:${INK}">${esc(opts.signOff || COMPANY_NAME)}</p>
    </td></tr>
    <tr><td style="padding:0 32px"><div style="border-top:1px solid ${BORDER}"></div></td></tr>
    <tr><td style="padding:18px 32px 26px;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED}">
      <strong style="color:${BODY};font-weight:600">${esc(COMPANY_NAME)}</strong><br>
      This message was sent to you by ${esc(COMPANY_NAME)}. Please do not share the links in it with anyone else.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
