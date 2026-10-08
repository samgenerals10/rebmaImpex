// api/_shared/emailTemplate.ts
// The one look every email from the app shares, in the colours of the
// sign-in and sign-up pages (rebma-web/src/components/auth/AuthBrand.tsx,
// sampled from the logo): turquoise main button, forest green links, amber
// accents, near-black text, light grey panels, on a flat turquoise page. The
// header is plain white with the cropped logo mark and no tile behind it.
// Modern product-email layout: large headline, flat white card, grey details
// panel, and a sign-off row with the logo on the right. No shadows.
//
// Built with tables and inline styles, because email apps (Gmail, Outlook,
// phones) ignore most modern CSS. Inter is requested with a normal system
// font as the fallback: Apple Mail, iPhone Mail and Outlook show Inter,
// while Gmail only ever shows its own fonts, so there it falls back to the
// closest system font. The logo is loaded from the app's own web address
// (public/logo-mark.png).
import { esc } from './htmlEscape';

export const COMPANY_NAME = 'Rebma Impex Ghana Limited';

const TURQUOISE = '#02afd9';
const AMBER = '#f2a72e';
const FOREST = '#0c5c34';
// The page behind the card: the logo's turquoise, one flat colour (no gradient),
// the same turquoise as the buttons.
const PAGE = TURQUOISE;
const INK = '#111827';
const BODY = '#374151';
const MUTED = '#6b7280';
const PANEL = '#f3f4f6';
const LINE = '#e5e7eb';
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Plain text to email paragraphs: blank line = new paragraph, a single
 *  line break is kept, web addresses become clickable. */
export function paragraphsFromText(text: string): string {
  const linkify = (s: string) =>
    esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${FOREST};font-weight:700;word-break:break-all">${u}</a>`);
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:14px;line-height:1.75;color:${BODY}">${linkify(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** The system's primary button: green gradient, white text, pill shape. */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td align="center" bgcolor="${TURQUOISE}" style="border-radius:999px;background:${TURQUOISE}"><a href="${esc(url)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
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
    ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid ${LINE};text-align:right"><a href="${esc(opts.linkUrl)}" style="font-size:12.5px;font-weight:700;color:${FOREST};text-decoration:none">${esc(opts.linkLabel)}</a></div>`
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
    <td width="54" valign="top" style="padding:16px 0 16px 18px"><div style="width:28px;height:28px;line-height:28px;text-align:center;border-radius:999px;background:${TURQUOISE};color:#ffffff;font-family:${FONT};font-size:13px;font-weight:700">${n}</div></td>
    <td valign="top" style="padding:15px 18px 15px 4px;font-family:${FONT}"><div style="font-size:14px;font-weight:600;color:${INK};line-height:1.5">${esc(title)}</div>${bodyHtml ? `<div style="margin-top:3px;font-size:13px;line-height:1.65;color:${BODY}">${bodyHtml}</div>` : ''}</td>
  </tr></table>`;
}

/** A soft note for the "good to know" part. */
export function emailCallout(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;border:1px solid #fde9c4;background:#fffaf0;border-radius:12px"><tr><td style="padding:14px 18px;font-family:${FONT};font-size:13px;line-height:1.7;color:${BODY}">${esc(text)}</td></tr></table>`;
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
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader)}</div>` : '';
  const hero = opts.title
    ? `<div style="margin-top:26px;font-size:26px;line-height:1.25;font-weight:700;color:${INK};letter-spacing:-0.01em">${esc(opts.title)}</div>${opts.subtitle ? `<div style="margin-top:8px;font-size:14px;line-height:1.6;color:${MUTED}">${esc(opts.subtitle)}</div>` : ''}`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(COMPANY_NAME)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;font-family:${FONT}">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background:${PAGE}"><tr><td align="center" style="padding:40px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:8px">
    <tr><td style="background:#ffffff;border-radius:8px 8px 0 0;padding:34px 36px 26px;font-family:${FONT}">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="bottom"><img src="${esc(logo)}" width="57" height="34" alt="${esc(COMPANY_NAME)}" style="display:block;border:0;width:57px;height:34px"></td>
        <td valign="bottom" style="padding-left:12px;padding-bottom:2px;font-family:${FONT};font-size:13px;line-height:1;font-weight:800;letter-spacing:0.04em;color:${INK}">REBMA IMPEX GHANA LIMITED</td>
      </tr></table>
      ${hero}
    </td></tr>
    <tr><td style="padding:0 36px"><div style="border-top:1px solid ${LINE}"></div></td></tr>
    <tr><td style="padding:28px 36px 6px;font-family:${FONT};color:${BODY}">
      ${opts.bodyHtml}
    </td></tr>
    <tr><td style="padding:10px 36px 34px;font-family:${FONT}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="bottom"><div style="font-size:13.5px;font-weight:700;color:${INK}">${esc(opts.signOff || COMPANY_NAME)}</div>${opts.contact ? `<div style="margin-top:2px;font-size:12px;color:${MUTED}">${esc(opts.contact)}</div>` : ''}</td>
        <td valign="bottom" align="right" width="64"><img src="${esc(logo)}" width="50" height="30" alt="" style="display:block;border:0;width:50px;height:30px"></td>
      </tr></table>
      <div style="margin-top:22px;font-size:11.5px;line-height:1.7;color:${MUTED}">This message was sent to you by ${esc(COMPANY_NAME)}. Please do not share the links in it with anyone else.</div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
