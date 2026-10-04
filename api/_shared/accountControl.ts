// api/_shared/accountControl.ts
// Server-side account controls used by the CEO's Suspend / Block /
// Reactivate / Unblock / Kick / Terminate actions (Step 2).
//
//  * endAllSessions: deletes every sign-in session the account has, via the
//    revoke_user_sessions() database function (supabase_ceo_controls.sql),
//    so its devices can't renew their access. The old Kick called
//    auth.admin.signOut() with a user ID, but that function needs a session
//    token, so every kick failed and nobody was ever signed out.
//  * lockSignIn / unlockSignIn: a suspended or blocked account is banned
//    at sign-in, so it can't start a new session either.
//
// Access already handed out before a kick stays valid only until it expires
// (Supabase Auth → JWT expiry, 1 hour by default). The app also signs the
// person out instantly through its live broadcast, and the database refuses
// role access to any account that isn't ACTIVE (supabase_ceo_security.sql).
import type { SupabaseClient } from '@supabase/supabase-js';

const LOCK_DURATION = '876000h'; // ~100 years: effectively until unlocked

export async function endAllSessions(supabaseAdmin: SupabaseClient, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.rpc('revoke_user_sessions', { p_user_id: userId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function lockSignIn(supabaseAdmin: SupabaseClient, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: LOCK_DURATION });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function unlockSignIn(supabaseAdmin: SupabaseClient, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  return error ? { ok: false, error: error.message } : { ok: true };
}
