// rebma-mobile/lib/managementActions.ts
//
// Phase 7.6, D40. Mobile mirrors of rebma-web/src/services/apiClient.ts's
// management.setCustomerDiscount()/setCustomerSpecial() write shapes —
// same "small local helper for one write shape" pattern lib/riskActions.ts
// (Phase 7.5) and lib/financeActions.ts (Phase 7.4) already established.
import { supabase } from './supabaseClient';

export async function setCustomerDiscount(customerId: string, discountPercent: number): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ discount_percent: discountPercent, updated_at: new Date().toISOString() })
    .eq('id', customerId);
  if (error) throw new Error(error.message);
}

export async function setCustomerSpecial(customerId: string, isSpecial: boolean): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ is_special_customer: isSpecial, updated_at: new Date().toISOString() })
    .eq('id', customerId);
  if (error) throw new Error(error.message);
}
