// rebma-mobile/lib/requestKey.ts
//
// A one-time key for a single submission (a new order, payment or email).
// The same key is reused if the person taps again or retries after a
// dropped connection, and the database refuses a second record with the
// same key (supabase_no_duplicates.sql). It only has to be unique, not
// secret. Twin: rebma-web/src/utils/requestKey.ts.
export function newRequestKey(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
