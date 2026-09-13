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
  return `Insufficient stock — cannot approve: ${list}`;
}

// Deducts sold items from stock the moment a sale is confirmed. Never
// throws — a stock hiccup shouldn't block the approval itself, it just
// logs, matching web's own try/catch-and-continue behavior.
export async function deductStockForOrder(order: any, reference: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
    const now = new Date().toISOString();

    const meta = order.metadata || {};
    const metaItems = meta.items || [];
    const lineItems = metaItems.length > 0
      ? metaItems
      : (order.product_name ? [{ productName: order.product_name, quantity: Number(order.quantity || 1) }] : []);

    for (const item of lineItems) {
      if (!item.productName) continue;
      const qty = Number(item.quantity) || 1;

      const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
        product_name: item.productName,
        movement_type: 'REMOVE',
        quantity: qty,
        reference,
        performed_by: performerId,
        created_at: now,
      });
      if (ledgerErr) console.error('Stock ledger insert failed during sale confirmation:', ledgerErr);

      const { data: existing } = await supabase.from('stock').select('id, quantity').ilike('product_name', item.productName).limit(1);
      if (existing && existing.length > 0) {
        const newQty = Math.max(0, (existing[0].quantity || 0) - qty);
        const { error: stockErr } = await supabase.from('stock').update({ quantity: newQty, last_updated: now, updated_by: performerId }).eq('id', existing[0].id);
        if (stockErr) console.error('Stock quantity update failed during sale confirmation:', stockErr);
      }
    }
  } catch (e) {
    console.error('Stock deduction failed during sale confirmation:', e);
  }
}

export function generateReceiptNumber(): string {
  return 'RCP-' + Math.floor(10000 + Math.random() * 90000);
}
