// rebma-mobile/lib/financeActions.ts
//
// Phase 7.4: ported from rebma-web/src/services/apiClient.ts's
// checkStockAvailability/shortageMessage/deductStockForOrder — the exact
// stock-guard-then-deduct sequence OrdersQueueView.tsx's approveOrder()
// runs (confirmed by reading the source, including the comment noting
// this screen's own Approve button didn't call deductStockForOrder until
// a recent web fix, so stock silently never moved on approval before
// that). Used by both OrdersQueueScreen and RecordPaymentScreen, which
// both approve orders.
import { Alert } from './appAlert';
import { supabase } from './supabaseClient';

export interface StockShortage {
  productName: string;
  requested: number;
  available: number;
}

export async function checkStockAvailability(order: any): Promise<StockShortage[]> {
  const meta = order.metadata || {};
  const metaItems = meta.items || [];
  const lineItems = metaItems.length > 0
    ? metaItems
    : (order.product_name ? [{ productName: order.product_name, quantity: Number(order.quantity || 1) }] : []);

  const shortages: StockShortage[] = [];
  for (const item of lineItems) {
    if (!item.productName) continue;
    const requested = Number(item.quantity) || 0;
    if (requested <= 0) continue;
    const { data: existing } = await supabase.from('stock').select('quantity').ilike('product_name', item.productName).limit(1);
    const available = existing && existing.length > 0 ? Number(existing[0].quantity) || 0 : 0;
    if (requested > available) {
      shortages.push({ productName: item.productName, requested, available });
    }
  }
  return shortages;
}

export function shortageMessage(shortages: StockShortage[]): string {
  const list = shortages.map((s) => `${s.productName} (need ${s.requested}, only ${s.available} in stock)`).join('; ');
  return `Insufficient stock, so this can't be approved: ${list}`;
}

export function generateReceiptNumber(): string {
  return 'RCP-' + Math.floor(10000 + Math.random() * 90000);
}

// The guarded approve path every credit/order approval on mobile must go
// through, matching web's own exported approveAccountsReview() in
// OrdersQueueView.tsx (reused there by FinanceDashboard.tsx's Record
// Payment block for exactly the same reason). Runs the stock-shortage
// check, the accounts_review_order RPC (PENDING_FINANCE ->
// PENDING_RISK_RELEASE, the only legal next status), stock deduction,
// and the Risk/Marketing notifications plus the audit log entry, in one
// place, so neither Orders Queue nor Record Payment can drift into a bare
// status write again.
// Approval, stock deduction and (when given) the payment now happen in ONE
// database step, accounts_approve_order() (supabase_atomic_approvals.sql):
// all of it or none of it. Same as web.
export async function approveAccountsReview(order: any, performedBy: string, payment?: Record<string, unknown> | null): Promise<boolean> {
  const shortages = await checkStockAvailability(order);
  if (shortages.length > 0) {
    Alert.alert('Insufficient Stock', shortageMessage(shortages));
    return false;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const performedByEmail = sessionData?.session?.user?.email || null;
  const now = new Date().toISOString();

  const { error: rpcErr } = await supabase.rpc('accounts_approve_order', {
    p_order_id: order.id, p_approved_by: performedBy, p_approved_by_email: performedByEmail,
    p_payment: payment ?? null,
  });
  if (rpcErr) { Alert.alert('Not approved', rpcErr.message); return false; }
  await supabase.from('supplier_order_notifications').insert([
    { message: `Accounts cleared order ${order.ticket_number || order.id} for ${order.client_name} and it's awaiting Risk's final release check.`, notified_department: 'RISK', read: false },
    { message: `Your order ${order.ticket_number || order.id} has cleared Accounts and is awaiting Risk's final release check.`, notified_department: 'MARKETING', read: false },
  ]);
  await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Order ${order.ticket_number || order.id} APPROVED for ${order.client_name}, GHS ${Number(order.total_amount || 0).toLocaleString()}`, performed_by: performedBy, reference_id: order.id, timestamp: now }]);
  return true;
}
