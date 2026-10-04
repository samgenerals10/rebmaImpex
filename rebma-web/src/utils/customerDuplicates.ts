// rebma-web/src/utils/customerDuplicates.ts
//
// Before a customer is saved, checks whether the phone number or Ghana Card
// number already belongs to another customer (find_customer_duplicate() in
// supabase_no_duplicates.sql, the same matching the database rule uses, so
// "024 123 4567" and "+233 24 123 4567" count as the same number).
// Twin: rebma-mobile/lib/customerDuplicates.ts.
import { supabase } from '../lib/supabaseClient';

export interface CustomerMatch { id: string; name: string; matchedOn: 'phone' | 'card' }

export async function findCustomerDuplicate(phone: string, card: string, excludeId?: string): Promise<CustomerMatch | null> {
  const { data, error } = await supabase.rpc('find_customer_duplicate', {
    p_phone: phone || null, p_card: card || null, p_exclude_id: excludeId || null,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as any;
  return { id: String(row.id), name: String(row.name || 'a customer'), matchedOn: row.matched_on === 'card' ? 'card' : 'phone' };
}
