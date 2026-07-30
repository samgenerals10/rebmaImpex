// rebma-web/src/lib/supabaseClient.ts
// Single Supabase client for the entire frontend application.
// Uses the anon key (safe for browser) — RLS policies protect data server-side.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Please set them in rebma-web/.env'
  );
}

// "Keep me logged in" backing store — this flag itself must live in
// localStorage (outside the swappable storage below) so it survives a full
// page reload and tells us, before Supabase even asks, which store this
// browser's session lives in. Default true (localStorage) matches the
// checkbox's own default-checked state, so anyone who never touches it sees
// no change from before this existed.
const KEEP_SIGNED_IN_KEY = 'rebma-keep-signed-in';

export function setAuthPersistence(keepSignedIn: boolean) {
  try { localStorage.setItem(KEEP_SIGNED_IN_KEY, String(keepSignedIn)); } catch {}
}

function activeStorage(): Storage {
  try {
    return localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'false' ? sessionStorage : localStorage;
  } catch {
    return localStorage;
  }
}

// Supabase's `storage` option just needs get/set/removeItem — routing each
// call through activeStorage() lets the SAME client instance write a fresh
// sign-in to sessionStorage (gone when the tab closes) or localStorage
// (survives it), decided per-login by the checkbox, without recreating the
// client.
const dynamicAuthStorage = {
  getItem: (key: string) => activeStorage().getItem(key),
  setItem: (key: string, value: string) => activeStorage().setItem(key, value),
  removeItem: (key: string) => activeStorage().removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'rebma-impex-auth',
    storage: dynamicAuthStorage,
  }
});

