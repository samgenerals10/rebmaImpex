// rebma-web/src/utils/secureToken.ts
// A hard-to-guess token for invite links. Made by the database
// (new_random_token(), cryptographically random); the browser's own
// crypto.getRandomValues is the fallback if the database update hasn't
// been run yet. The old Math.random() version could be guessed, which
// would let someone register into a role from a made-up link.
import { supabase } from '../lib/supabaseClient';

export async function newSecureToken(): Promise<string> {
  const { data, error } = await (supabase as any).rpc('new_random_token');
  if (!error && typeof data === 'string' && data.length >= 32) return data;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
