// api/_shared/reauth.ts
// Password check for high-risk CEO actions (approved rule): the CEO types
// his normal sign-in password again, and the SERVER checks it, so it
// proves the CEO himself is doing this action right now, even on a phone
// or computer that's already signed in.
//
//  * Checked against Supabase Auth with a throwaway client that keeps
//    nothing; the session it creates is revoked immediately (scope:
//    local, so the CEO's real sessions are untouched).
//  * The password is never stored, logged, or sent anywhere else.
//  * 5 wrong passwords in 15 minutes locks the check for that account
//    for the rest of the 15 minutes, so it can't be guessed.
//  * Fails closed: if the check itself can't run, the action is refused.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const MAX_FAILURES = 5;
const WINDOW_SECONDS = 15 * 60;

export interface Caller {
  user: User;
  profile: { id: string; full_name: string | null; role: string | null; is_admin: boolean | null; status: string | null };
}

// Bearer token -> signed-in user + their profile. Sends 401/403 itself and
// returns null when the caller isn't allowed.
export async function getCaller(supabaseAdmin: SupabaseClient, req: VercelRequest, res: VercelResponse): Promise<Caller | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid authentication token.' });
    return null;
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, is_admin, status')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || String(profile.status || '').toUpperCase() !== 'ACTIVE') {
    res.status(403).json({ error: 'Your account is not active.' });
    return null;
  }
  return { user: data.user, profile };
}

export async function requireCeo(supabaseAdmin: SupabaseClient, req: VercelRequest, res: VercelResponse): Promise<Caller | null> {
  const caller = await getCaller(supabaseAdmin, req, res);
  if (!caller) return null;
  if (!caller.profile.is_admin) {
    res.status(403).json({ error: 'Only the CEO can do this.' });
    return null;
  }
  return caller;
}

const failureKey = (userId: string) => `reauth-fail:${userId}`;

async function isLockedOut(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('api_rate_limits')
    .select('request_count, window_start')
    .eq('key', failureKey(userId))
    .maybeSingle();
  if (!data) return false;
  const started = new Date(data.window_start).getTime();
  return Date.now() - started < WINDOW_SECONDS * 1000 && Number(data.request_count) >= MAX_FAILURES;
}

// Returns true when the password is right. Otherwise sends the error
// response itself and returns false.
export async function verifyPassword(
  supabaseAdmin: SupabaseClient,
  res: VercelResponse,
  user: User,
  password: unknown,
): Promise<boolean> {
  if (typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Enter your password to confirm it is you.', needsPassword: true });
    return false;
  }
  if (!supabaseUrl || !anonKey || !user.email) {
    res.status(500).json({ error: 'Password check is not available right now, so this action was not done.' });
    return false;
  }
  if (await isLockedOut(supabaseAdmin, user.id)) {
    res.status(429).json({ error: 'Too many wrong passwords. Wait 15 minutes and try again.' });
    return false;
  }

  const probe = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await probe.auth.signInWithPassword({ email: user.email, password });

  if (error || !data.user || data.user.id !== user.id) {
    // Count the failure (atomic upsert into the same table the rate limiter uses).
    try {
      await supabaseAdmin.rpc('check_rate_limit', { p_key: failureKey(user.id), p_max_requests: MAX_FAILURES, p_window_seconds: WINDOW_SECONDS });
    } catch { /* still refuse below */ }
    res.status(401).json({ error: 'That password is not correct.', needsPassword: true });
    return false;
  }

  // Revoke only the throwaway session the check just created.
  try { await probe.auth.signOut({ scope: 'local' }); } catch { /* it expires on its own */ }
  return true;
}
