// rebma-web/src/utils/privilegedApi.ts
// Web twin of rebma-mobile/lib/apiBase.ts's callPrivilegedApi: a signed-in
// POST to one of the server endpoints in api/, sending the person's session
// token so the server can check who is asking. Throws the server's own
// error message, so a wrong password or a refused action reads clearly.
import { supabase } from '../lib/supabaseClient';

export async function callPrivilegedApi<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated.');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'That did not work.');
  return json as T;
}
