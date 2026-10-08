// api/_shared/htmlEscape.ts
// Escapes text for safe use inside HTML. Shared by the email template and
// the mailer (kept apart so the two don't import each other).
export const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
