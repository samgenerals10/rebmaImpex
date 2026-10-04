// rebma-mobile/lib/registration.ts
// Client copy of api/_shared/registration.ts's 12-hour rule, used only to
// show "Expired" and the right sign-in message. The server enforces it.
export const APPROVAL_WINDOW_HOURS = 12;

export function isRegistrationExpired(status: unknown, registeredAt: unknown): boolean {
  const s = String(status || '').toUpperCase();
  if (s === 'EXPIRED') return true;
  if (s !== 'PENDING' && s !== 'PENDING_APPROVAL') return false;
  if (!registeredAt) return false;
  const t = new Date(String(registeredAt)).getTime();
  return Number.isFinite(t) && Date.now() - t > APPROVAL_WINDOW_HOURS * 3600_000;
}

// "5h 20m left", or null once expired / when there's no timestamp.
export function approvalTimeLeft(registeredAt: unknown): string | null {
  if (!registeredAt) return null;
  const ms = new Date(String(registeredAt)).getTime() + APPROVAL_WINDOW_HOURS * 3600_000 - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}
