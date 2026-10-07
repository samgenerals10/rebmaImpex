// Checks the signed-in person's password again before a sensitive screen
// opens (Control Center, API Keys). It uses a separate, throwaway Supabase
// connection kept only in memory, so the real signed-in session (and its
// two-factor level) is never replaced or signed out.
// rebma-mobile/lib/verifyPassword.ts is the phone's copy.
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export async function verifyMyPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!password) return { ok: false, error: 'Type your password.' };
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { ok: false, error: 'You are not signed in.' };

  const checker = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'rebma-password-check' },
  });
  const { error } = await checker.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: /invalid/i.test(error.message) ? 'That password is not right.' : error.message };
  }
  return { ok: true };
}
