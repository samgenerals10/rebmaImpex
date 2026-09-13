// rebma-mobile/lib/riskActions.ts
//
// Phase 7.5, D37. Mobile mirror of rebma-web/src/services/apiClient.ts's
// management.setCustomerVerification() — mobile has no service-layer
// equivalent of apiClient.ts, so this is a small local helper matching
// that one write shape exactly, same pattern lib/financeActions.ts used
// in Phase 7.4.
import { supabase } from './supabaseClient';

export async function setCustomerVerification(
  customerId: string,
  status: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION',
  opts: { verifiedBy?: string; rejectionReason?: string } = {}
): Promise<void> {
  const { error } = await supabase.from('customers').update({
    status,
    verified_by: opts.verifiedBy || null,
    verified_at: new Date().toISOString(),
    rejection_reason: status === 'APPROVED' ? null : (opts.rejectionReason || null),
  }).eq('id', customerId);
  if (error) throw error;
}
