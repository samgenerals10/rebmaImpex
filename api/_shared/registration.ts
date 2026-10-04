// api/_shared/registration.ts
// The 12-hour approval window, in one place for every endpoint that
// checks it (approve-user.ts, resend-invite.ts). A registration that is
// still pending this long after the person registered has expired: it
// can't be approved, and HR resends a fresh link instead.
//
// The same rule is mirrored on the clients (rebma-mobile/lib/registration.ts,
// rebma-web/src/utils/registration.ts) purely to show "Expired"; the server
// is what actually enforces it.
export const APPROVAL_WINDOW_HOURS = 12;

export function isRegistrationExpired(status: unknown, registeredAt: unknown): boolean {
  const s = String(status || '').toUpperCase();
  if (s === 'EXPIRED') return true;
  if (s !== 'PENDING' && s !== 'PENDING_APPROVAL') return false;
  // Registrations from before this rule have no timestamp; they never expire.
  if (!registeredAt) return false;
  const t = new Date(String(registeredAt)).getTime();
  return Number.isFinite(t) && Date.now() - t > APPROVAL_WINDOW_HOURS * 3600_000;
}
