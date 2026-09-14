// rebma-mobile/lib/apiBase.ts
//
// Phase 7.7, D53. Config-gated helper for the two privileged Vercel
// endpoints (api/register-staff-user.ts, api/approve-user.ts) HR needs.
// Those endpoints' own logic (auth-token validation, server-side role
// re-check, service-role-gated Auth admin calls) is correct and reused
// as-is per direct instruction — not rewritten, not migrated to Edge
// Functions. The one missing piece is the deployed base URL, which this
// app doesn't know yet (confirmed during the Phase 7.7 pre-flight audit:
// no live deployment URL found in the repo). Rather than guess a URL or
// block the rest of HR on it, this throws a clear, specific error when
// unset, so Add Staff / Approve Registration fail loudly with an
// actionable message instead of a cryptic network error. Once the real
// URL is known, setting EXPO_PUBLIC_API_BASE_URL in .env makes both
// flows live with zero code changes.
import { supabase } from './supabaseClient';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("This action isn't configured yet. Ask an admin to set the API base URL.");
    this.name = 'ApiNotConfiguredError';
  }
}

export async function callPrivilegedApi<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE_URL) throw new ApiNotConfiguredError();

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated.');

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed.');
  return json as T;
}

export function isPrivilegedApiConfigured(): boolean {
  return !!BASE_URL;
}

// Phase 10.1 — the two registration endpoints (lookup-invite,
// register-standard-user) are public: no session exists yet for a
// brand-new candidate, so they take no auth header at all, unlike
// callPrivilegedApi above. Same BASE_URL config gate and the same clear
// ApiNotConfiguredError when it's unset.
export async function callPublicApi<T = any>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<T> {
  if (!BASE_URL) throw new ApiNotConfiguredError();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed.');
  return json as T;
}
