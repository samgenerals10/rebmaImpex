// rebma-mobile/lib/pendingApprovals.ts
//
// Extracted from components/shared/PendingApprovalsAlertCard.tsx (Phase
// 7.5 D35 / 7.6 D47 / 7.9 D71) — the fetch logic is unchanged byte-for-
// byte, just relocated so the persistent header badge (PersistentIconRow)
// can share it without duplicating four departments' worth of count
// queries. Per direct correction, the old on-dashboard card is gone —
// this is now the header icon's own data source instead.
import { supabase } from './supabaseClient';

export interface PendingItem {
  label: string;
  count: number;
  tab: string;
}

export async function fetchPendingForDept(department: string): Promise<PendingItem[]> {
  const items: PendingItem[] = [];
  if (department === 'RISK') {
    const [cargo, orders, finalRelease, pod] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_APPROVAL'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_RELEASE'),
      supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_REVIEW'),
    ]);
    if ((cargo.count || 0) > 0) items.push({ label: 'cargo intake', count: cargo.count || 0, tab: 'RiskApprovals' });
    if ((orders.count || 0) > 0) items.push({ label: 'orders in initial review', count: orders.count || 0, tab: 'RiskApprovals' });
    if ((finalRelease.count || 0) > 0) items.push({ label: 'orders in final release', count: finalRelease.count || 0, tab: 'RiskApprovals' });
    if ((pod.count || 0) > 0) items.push({ label: 'delivery proofs', count: pod.count || 0, tab: 'RiskApprovals' });
  }
  if (department === 'MANAGEMENT') {
    const [cargo, orders, production, purchases, float] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT'),
      supabase.from('production_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT').then((r) => r, () => ({ count: 0 })),
      supabase.from('general_purchases').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL').then((r) => r, () => ({ count: 0 })),
      supabase.from('float_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT').then((r) => r, () => ({ count: 0 })),
    ]);
    if ((cargo.count || 0) > 0) items.push({ label: 'cargo intake', count: cargo.count || 0, tab: 'CreditApproval' });
    if ((orders.count || 0) > 0) items.push({ label: 'orders awaiting approval', count: orders.count || 0, tab: 'CreditApproval' });
    if (((production as any).count || 0) > 0) items.push({ label: 'production requests', count: (production as any).count || 0, tab: 'CreditApproval' });
    if (((purchases as any).count || 0) > 0) items.push({ label: 'general purchases', count: (purchases as any).count || 0, tab: 'CreditApproval' });
    if (((float as any).count || 0) > 0) items.push({ label: 'float requests', count: (float as any).count || 0, tab: 'CreditApproval' });
  }
  if (department === 'ADMIN_WAREHOUSE') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [cargo, cargoApproved, production, rawMaterial, orders] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_APPROVAL'),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('updated_at', since),
      supabase.from('fulfillment_tickets').select('id', { count: 'exact', head: true }).eq('type', 'PRODUCTION_RELEASE').eq('status', 'PENDING').then((r) => r, () => ({ count: 0 })),
      supabase.from('fulfillment_tickets').select('id', { count: 'exact', head: true }).eq('type', 'RAW_MATERIAL_RELEASE').eq('status', 'PENDING').then((r) => r, () => ({ count: 0 })),
      supabase.from('orders').select('id').in('status', ['APPROVED', 'PROCESSING']),
    ]);
    if ((cargo.count || 0) > 0) items.push({ label: 'cargo pending Risk sign-off', count: cargo.count || 0, tab: 'PortIngestion' });
    if ((cargoApproved.count || 0) > 0) items.push({ label: 'cargo approved and ready to log into stock', count: cargoApproved.count || 0, tab: 'Stock' });
    if (((production as any).count || 0) > 0) items.push({ label: 'production releases to prepare', count: (production as any).count || 0, tab: 'Releases' });
    if (((rawMaterial as any).count || 0) > 0) items.push({ label: 'raw material releases to prepare', count: (rawMaterial as any).count || 0, tab: 'Releases' });
    const orderIds = (orders.data || []).map((o: any) => o.id);
    let readyToDispatchCount = orderIds.length;
    if (orderIds.length > 0) {
      const { data: deliveryLogRows } = await supabase.from('delivery_logs').select('order_id').in('order_id', orderIds);
      const dispatchedIds = new Set((deliveryLogRows || []).map((d: any) => d.order_id).filter(Boolean));
      readyToDispatchCount = orderIds.filter((id: string) => !dispatchedIds.has(id)).length;
    }
    if (readyToDispatchCount > 0) items.push({ label: 'orders ready to dispatch', count: readyToDispatchCount, tab: 'ApprovedGoods' });
  }
  if (department === 'CEO') {
    const [registrations, priceChanges] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      supabase.from('goods_price_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);
    if ((registrations.count || 0) > 0) items.push({ label: 'registrations', count: registrations.count || 0, tab: 'Approvals' });
    if ((priceChanges.count || 0) > 0) items.push({ label: 'price changes', count: priceChanges.count || 0, tab: 'PriceApprovals' });
  }
  return items;
}
