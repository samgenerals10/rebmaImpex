// api/_shared/emailTemplate.ts
// The one look every email from the app shares: the Rebma logo and name at
// the top, the message in a clean white card, a footer with the company.
// Built with tables and inline styles, because email apps (Gmail, Outlook,
// phones) ignore most modern CSS. The logo is loaded from the app's own web
// address, so it always matches the current logo.
import { esc } from './htmlEscape';

const BRAND = '#068d5c';
const INK = '#0f172a';
const MUTED = '#64748b';

/** Turn plain text into email paragraphs: blank line = new paragraph,
 *  single line break kept, web addresses made clickable. */
export function paragraphsFromText(text: string): string {
  const linkify = (s: string) =>
    esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${BRAND};word-break:break-all">${u}</a>`);
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${INK}">${linkify(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** A big, tappable button. */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:999px;background:${BRAND}"><a href="${esc(url)}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
}

/** A small grey note under the main message. */
export function emailNote(text: string): string {
  return `<p style="margin:0 0 12px;font-size:12.5px;line-height:1.6;color:${MUTED}">${esc(text)}</p>`;
}

export function brandedEmail(opts: { origin: string; bodyHtml: string; preheader?: string; signOff?: string }): string {
  const logo = `${opts.origin.replace(/\/+$/, '')}/logo-mark.png`;
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader)}</div>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rebma Impex</title></head>
<body style="margin:0;padding:0;background:#eef2f1;-webkit-text-size-adjust:100%">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f1"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="background:${BRAND};height:5px;border-radius:14px 14px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="background:#ffffff;padding:26px 32px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px"><img src="${esc(logo)}" width="67" height="40" alt="Rebma Impex" style="display:block;border:0;width:67px;height:40px"></td>
        <td style="font-family:Georgia,'Times New Roman',serif"><div style="font-size:19px;font-weight:700;letter-spacing:0.04em;color:${INK}">REBMA IMPEX</div><div style="font-size:11px;letter-spacing:0.18em;color:${BRAND};font-weight:700">GHANA</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;padding:6px 32px 10px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0"><div style="border-top:1px solid #e8edf2;margin:14px 0 22px"></div></td></tr>
    <tr><td style="background:#ffffff;padding:0 32px 14px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      ${opts.bodyHtml}
      <p style="margin:22px 0 4px;font-size:15px;color:${INK}">${esc(opts.signOff || 'Rebma Impex')}</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:18px 32px;border:1px solid #e2e8f0;border-top:1px solid #e8edf2;border-radius:0 0 14px 14px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.6;color:${MUTED}">
      Rebma Impex Limited, Ghana<br>This message was sent to you by Rebma Impex. Please do not share the links in it with anyone else.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
