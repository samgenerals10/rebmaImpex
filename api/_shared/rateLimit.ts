// api/_shared/rateLimit.ts
//
// Real, applied answer to "what happens if one user sends 1 million
// requests in a minute" — nothing did, anywhere in api/, before this.
// Every custom endpoint fired straight into Supabase on every single
// request, so a flood against any one of them (especially the ones that
// need no login at all: lookup-invite, register-standard-user, trip)
// would exhaust the same connection pool every real user shares, taking
// the whole app down, not just that one endpoint.
//
// Backed by a single Postgres table + an atomic RPC (check_rate_limit,
// supabase_rate_limits.sql) rather than an in-memory counter — a Vercel
// function can run on any of several instances, so an in-process counter
// would undercount and let a distributed flood straight through. The RPC
// does one atomic UPSERT per call, so a rejected request costs one cheap
// row check, never the real work (a Supabase profiles/staff_invites
// query, an auth admin call, an email send) the endpoint would otherwise
// have done.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function callerKey(req: VercelRequest, bucket: string): string {
  // Vercel's edge sets this to the real client IP even behind their own
  // proxy — the only caller identity available for an endpoint that
  // (deliberately, for trip.ts/lookup-invite.ts/register-standard-user.ts)
  // has no login session to key off instead.
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded || 'unknown').split(',')[0].trim();
  return `${bucket}:${ip}`;
}

// Returns true (and sends the 429 itself) when the caller should be
// blocked — callers do `if (await isRateLimited(...)) return;` as the
// very first line of the handler, before touching req.body or Supabase
// for anything real.
export async function isRateLimited(
  supabaseAdmin: SupabaseClient,
  req: VercelRequest,
  res: VercelResponse,
  bucket: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const { data: allowed, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: callerKey(req, bucket),
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    // A failure in the rate-limit check itself (RPC not deployed yet,
    // transient error) fails OPEN, not closed — a rate limiter that can
    // take the whole API down by itself failing is worse than no limiter
    // at all. Real abuse is still caught the moment the RPC is healthy.
    if (error) return false;
    if (allowed === false) {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
