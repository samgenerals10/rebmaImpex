// api/_shared/normalizePhone.ts
// Ghana numbers show up in the DB as either local ("0267898090") or E.164
// ("+233267898090") — comparing raw strings misses matches. Comparing the
// last 9 digits (the subscriber number, stable across both formats) works
// without needing to know which format a given row used.
export function phoneKey(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-9);
}
