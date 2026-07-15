// api/_shared/findUserByEmail.ts
// Shared helper — auth.admin.listUsers() is paginated (default 1000/page); a
// single unpaginated call silently misses matches once the org has more than
// 1000 accounts. This walks pages until the email is found or pages run out.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function findUserByEmail(supabaseAdmin: SupabaseClient, emailLower: string) {
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Database check failed: ${error.message}`);
    const found = data?.users?.find(u => u.email?.toLowerCase() === emailLower);
    if (found) return found;
    if (!data?.users || data.users.length < perPage) return undefined; // last page reached
  }
  return undefined;
}
