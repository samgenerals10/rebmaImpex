// Sends phone app errors to the server, which logs them and emails the
// company address (api/_routes/report-error.ts). The web's copy is
// rebma-web/src/utils/errorReporter.ts. Covers crashes and every failure
// pop-up a person sees (lib/appAlert.ts). Never throws, and the same
// message is sent at most once a minute from this phone.
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
const recent = new Map<string, number>();
const FAILURE_WORDS = /could ?n[o']t|failed|failure|\berror\b|not sent|refused|did not work|went wrong|unable to|denied/i;

/** True when a message shown to a person is reporting a problem. */
export const looksLikeFailure = (msg: string) => FAILURE_WORDS.test(msg);

export async function reportClientError(location: string, message: string, detail?: string | null): Promise<void> {
  try {
    if (!BASE_URL) return;
    const msg = String(message || '').trim();
    if (!msg) return;
    const key = `${location}|${msg}`;
    if (Date.now() - (recent.get(key) || 0) < 60000) return;
    recent.set(key, Date.now());

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch(`${BASE_URL}/api/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ source: 'phone', location, message: msg.slice(0, 1000), detail: detail ? String(detail).slice(0, 6000) : null, pageUrl: `${Platform.OS} app` }),
    });
  } catch {
    // Reporting is best effort.
  }
}

let installed = false;
/** Catch crashes anywhere in the phone app. Called once at start-up. */
export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;
  const g: any = globalThis as any;
  const errorUtils = g.ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      reportClientError(isFatal ? 'Crash (app closed)' : 'Crash', error?.message || String(error), error?.stack || null);
      previous?.(error, isFatal);
    });
  }
}
