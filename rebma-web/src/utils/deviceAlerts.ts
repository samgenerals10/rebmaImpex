// Laptop pop-up alerts (the browser's own notifications).
//
// The on/off choice is per device, stored in this browser only: turning
// it off here never touches the bell or any other device. The browser
// itself must also allow notifications for this site.

const STORAGE_KEY = 'rebma-device-alerts';

export function deviceAlertsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getDeviceAlertsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setDeviceAlertsEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Private windows can block storage; the choice just won't be kept.
  }
}

export function devicePermission(): NotificationPermission | 'unsupported' {
  return deviceAlertsSupported() ? Notification.permission : 'unsupported';
}

// Must be called from a click, or browsers ignore it.
export async function requestDevicePermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!deviceAlertsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Shows a pop-up only when the app isn't the tab in front. When it is,
// the in-app toast and bell already show the alert.
export function showDeviceAlert(title: string, body: string, onClick?: () => void) {
  if (!deviceAlertsSupported() || !getDeviceAlertsEnabled()) return;
  if (Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()) return;
  try {
    const n = new Notification(title, { body, icon: '/logo.png', tag: `rebma-${title}-${body}`.slice(0, 120) });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    // Some browsers (for example on phones) only allow pop-ups from a
    // service worker. The bell still has the alert.
  }
}
