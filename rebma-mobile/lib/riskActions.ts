// rebma-mobile/lib/riskActions.ts
//
// Phase 7.5, D37. Mobile mirror of rebma-web/src/services/apiClient.ts's
// management.setCustomerVerification() — mobile has no service-layer
// equivalent of apiClient.ts, so this is a small local helper matching
// that one write shape exactly, same pattern lib/financeActions.ts used
// in Phase 7.4.
import { supabase } from './supabaseClient';

// verifiedBy is now looked up server-side from the live profiles row for
// the caller's own session, not taken from a caller-supplied opts field —
// security/gap audit fix: the old opts.verifiedBy was just whatever the
// client passed in, forgeable by a client calling this update directly.
export async function setCustomerVerification(
  customerId: string,
  status: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION',
  opts: { rejectionReason?: string } = {}
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const performerId = sessionData.session?.user?.id || null;
  const { data: performers } = await supabase.from('profiles').select('full_name').eq('id', performerId).limit(1);
  const performedBy = performers?.[0]?.full_name || 'Risk';
  const { error } = await supabase.from('customers').update({
    status,
    verified_by: performedBy,
    verified_at: new Date().toISOString(),
    rejection_reason: status === 'APPROVED' ? null : (opts.rejectionReason || null),
  }).eq('id', customerId);
  if (error) throw error;
}
