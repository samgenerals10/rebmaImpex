// rebma-mobile/lib/secureToken.ts
// A hard-to-guess token for invite links, made by the database
// (new_random_token(), cryptographically random). The old Math.random()
// version could be guessed, which would let someone register into a role
// from a made-up link. Web twin: rebma-web/src/utils/secureToken.ts.
import { supabase } from './supabaseClient';

export async function newSecureToken(): Promise<string> {
  const { data, error } = await (supabase as any).rpc('new_random_token');
  if (error || typeof data !== 'string' || data.length < 32) {
    throw new Error('Could not create a secure invite link. Make sure the database update for Step 4 has been run.');
  }
  return data;
}
