// rebma-web/src/utils/registration.ts
// Web twin of rebma-mobile/lib/registration.ts + registrationContext.ts.
//
//  * The 12-hour approval rule, used only to show "Expired" and the right
//    sign-in message. The server (api/_shared/registration.ts) enforces it.
//  * What gets recorded about the browser and place someone registers
//    from, for the CEO to review. The server adds the network address and
//    an approximate location itself; this only adds the browser details and
//    a GPS position if the person allows it.
export const APPROVAL_WINDOW_HOURS = 12;

export function isRegistrationExpired(status: unknown, registeredAt: unknown): boolean {
  const s = String(status || '').toUpperCase();
  if (s === 'EXPIRED') return true;
  if (s !== 'PENDING' && s !== 'PENDING_APPROVAL') return false;
  if (!registeredAt) return false;
  const t = new Date(String(registeredAt)).getTime();
  return Number.isFinite(t) && Date.now() - t > APPROVAL_WINDOW_HOURS * 3600_000;
}

export function approvalTimeLeft(registeredAt: unknown): string | null {
  if (!registeredAt) return null;
  const ms = new Date(String(registeredAt)).getTime() + APPROVAL_WINDOW_HOURS * 3600_000 - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function parseUserAgent(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : undefined;
  let os: string | undefined;
  let osVersion: string | undefined;
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Windows NT ([\d.]+)/))) { os = 'Windows'; osVersion = m[1] === '10.0' ? '10 or 11' : m[1]; }
  else if ((m = ua.match(/Android ([\d.]+)/))) { os = 'Android'; osVersion = m[1]; }
  else if ((m = ua.match(/(?:iPhone|iPad).*OS ([\d_]+)/))) { os = 'iOS'; osVersion = m[1].replace(/_/g, '.'); }
  else if ((m = ua.match(/Mac OS X ([\d_]+)/))) { os = 'macOS'; osVersion = m[1].replace(/_/g, '.'); }
  else if (/Linux/.test(ua)) os = 'Linux';
  const kind = /iPad|Tablet/.test(ua) ? 'Tablet' : /Mobi|iPhone|Android/.test(ua) ? 'Phone' : 'Computer';
  return { browser, os, osVersion, kind };
}

export function getRegistrationDevice() {
  const ua = navigator.userAgent || '';
  const parsed = parseUserAgent(ua);
  return {
    kind: parsed.kind,
    platform: 'Web browser',
    os: parsed.os,
    osVersion: parsed.osVersion,
    browser: parsed.browser,
    userAgent: ua,
    screen: `${window.screen.width} x ${window.screen.height}`,
  };
}

export function getRegistrationLocation(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ refusedReason: 'This browser cannot share a location.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        source: 'GPS',
      }),
      (err) => resolve({
        refusedReason: err.code === err.PERMISSION_DENIED ? 'Location permission was not given.'
          : err.code === err.TIMEOUT ? 'Location took too long to find.' : 'Location could not be read.',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}
