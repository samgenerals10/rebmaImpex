// Sends web app errors to the server, which logs them and emails the
// company address (api/_routes/report-error.ts, api/_shared/errorReport.ts).
// Covers crashes (uncaught errors and failed promises) and every failure
// message a person sees in a notification. Never throws, and the same
// message is sent at most once a minute from this browser.
import { supabase } from '../lib/supabaseClient';

const recent = new Map<string, number>();
const FAILURE_WORDS = /could ?n[o']t|failed|failure|\berror\b|not sent|refused|did not work|went wrong|unable to|denied/i;

/** True when a message shown to a person is reporting a problem. */
export const looksLikeFailure = (msg: string) => FAILURE_WORDS.test(msg);

export async function reportClientError(location: string, message: string, detail?: string | null): Promise<void> {
  try {
    const msg = String(message || '').trim();
    if (!msg) return;
    const key = `${location}|${msg}`;
    const last = recent.get(key) || 0;
    if (Date.now() - last < 60000) return;
    recent.set(key, Date.now());

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ source: 'web', location, message: msg.slice(0, 1000), detail: detail ? String(detail).slice(0, 6000) : null, pageUrl: window.location.href }),
      keepalive: true,
    });
  } catch {
    // Reporting is best effort.
  }
}

let installed = false;
/** Catch crashes anywhere in the web app. Called once at start-up. */
export function installGlobalErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    // Ignore browser noise that isn't a real app failure.
    if (!e.message || /ResizeObserver loop/i.test(e.message)) return;
    reportClientError('Crash', e.message, e.error?.stack || `${e.filename || ''}:${e.lineno || ''}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r: any = e.reason;
    const msg = r?.message || String(r || 'Unhandled promise rejection');
    if (/AbortError|The user aborted/i.test(msg)) return;
    reportClientError('Crash', msg, r?.stack || null);
  });
}
