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
import { Alert } from 'react-native';
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

// Deducts sold items from stock the moment a sale is confirmed. Never
// throws — a stock hiccup shouldn't block the approval itself, it just
// logs, matching web's own try/catch-and-continue behavior.
// Routed through a SECURITY DEFINER RPC (deduct_stock_for_order) that
// takes a per-product advisory lock, matching web's own fix and the same
// idiom create_order_with_stock_check() already uses — the previous
// read-quantity-then-write-quantity two-step here had no lock between the
// two round trips, so two concurrent approvals for the same product could
// both read the same starting quantity and both write a decremented
// value, losing one decrement (an effective oversell).
export async function deductStockForOrder(order: any, reference: string): Promise<void> {
  try {
    const meta = order.metadata || {};
    const metaItems = meta.items || [];
    const lineItems = metaItems.length > 0
      ? metaItems
      : (order.product_name ? [{ productName: order.product_name, quantity: Number(order.quantity || 1) }] : []);
    if (lineItems.length === 0) return;

    const { error } = await supabase.rpc('deduct_stock_for_order', { p_line_items: lineItems, p_reference: reference });
    if (error) console.error('Stock deduction failed during sale confirmation:', error);
  } catch (e) {
    console.error('Stock deduction failed during sale confirmation:', e);
  }
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
export async function approveAccountsReview(order: any, performedBy: string): Promise<boolean> {
  const shortages = await checkStockAvailability(order);
  if (shortages.length > 0) {
    Alert.alert('Insufficient Stock', shortageMessage(shortages));
    return false;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const performedByEmail = sessionData?.session?.user?.email || null;
  const now = new Date().toISOString();

  const { error: rpcErr } = await supabase.rpc('accounts_review_order', {
    p_order_id: order.id, p_action: 'approve', p_note: null,
    p_approved_by: performedBy, p_approved_by_email: performedByEmail,
  });
  if (rpcErr) { Alert.alert('Approval Failed', rpcErr.message); return false; }

  const ticketRef = order.ticket_number || `ORD-${String(order.id).slice(0, 6).toUpperCase()}`;
  await deductStockForOrder(order, `Order Approved: ${ticketRef}`);
  await supabase.from('supplier_order_notifications').insert([
    { message: `Accounts cleared order ${order.ticket_number || order.id} for ${order.client_name} and it's awaiting Risk's final release check.`, notified_department: 'RISK', read: false },
    { message: `Your order ${order.ticket_number || order.id} has cleared Accounts and is awaiting Risk's final release check.`, notified_department: 'MARKETING', read: false },
  ]);
  await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Order ${order.ticket_number || order.id} APPROVED for ${order.client_name}, GHS ${Number(order.total_amount || 0).toLocaleString()}`, performed_by: performedBy, reference_id: order.id, timestamp: now }]);
  return true;
}
