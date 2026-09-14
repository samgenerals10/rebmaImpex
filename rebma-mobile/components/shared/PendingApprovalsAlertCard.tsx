// rebma-mobile/components/shared/PendingApprovalsAlertCard.tsx
//
// Phase 7.5, D35. Ports rebma-web/src/components/global/PendingApprovalsAlert.tsx
// — department-agnostic pending-count banner, tap-to-navigate. Ports the
// RISK branch of fetchPendingForDept() (cargo/orders/POD counts), plus a
// MANAGEMENT branch added in Phase 7.6 (D47, 5 approval lanes). Other
// departments' Overview screens already show equivalent counts
// inline via their own KPI tiles, so their branches aren't needed yet —
// add them here, not as a new file, when a future phase wants this exact
// banner treatment instead. Drops the toast/addNotification fan-out and
// the "newly priced items" last-viewed tracking (RISK's own branch never
// used either) — the on-screen banner itself is the real, preserved
// capability.
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';

interface PendingItem {
  label: string;
  count: number;
  tab: string;
}

async function fetchPendingForDept(department: string): Promise<PendingItem[]> {
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
    // Phase 7.6, D47 — counts across Management's 5 live approval lanes,
    // same statuses MgmtApprovalsScreen itself queries.
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
    // Ports rebma-web/src/components/global/PendingApprovalsAlert.tsx's
    // ADMIN_WAREHOUSE branch — 4 of its 5 items, not 5. Its 5th item
    // ("new deliveries to assign") points at tab: 'ActiveDeliveries', a
    // stale reference from before Phase 9 moved Dispatch's screens
    // (Deliveries/ActiveDeliveries/Drivers/Tracking/ProofOfDelivery/
    // Scanner) to RISK — confirmed by reading the current
    // rebma-web/src/components/layout/Sidebar.tsx: ADMIN_WAREHOUSE's own
    // 12-tab list has no ActiveDeliveries entry any more, on either
    // platform. Faithfully copying that pointer would just reproduce a
    // dead-navigation bug that already exists on web; omitted rather than
    // guessed at.
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
    // Same de-dup against delivery_logs web's own count applies — an order
    // dispatched to a driver doesn't leave APPROVED/PROCESSING on its own
    // status, so without excluding already-handed-off orders this would
    // keep counting them long after they left this department's hands.
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
    // Phase 7.9, D71 — the two lanes CEO's own Approvals/PriceApprovals
    // screens own: pending registrations (profiles.status =
    // PENDING_APPROVAL, unfiltered by department — matches
    // ApprovalsScreen's own unfiltered query) and pending price changes
    // (goods_price_change_requests.status = PENDING).
    const [registrations, priceChanges] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      supabase.from('goods_price_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);
    if ((registrations.count || 0) > 0) items.push({ label: 'registrations', count: registrations.count || 0, tab: 'Approvals' });
    if ((priceChanges.count || 0) > 0) items.push({ label: 'price changes', count: priceChanges.count || 0, tab: 'PriceApprovals' });
  }
  return items;
}

interface Props {
  department: string;
  onNavigate?: (tab: string) => void;
}

export default function PendingApprovalsAlertCard({ department, onNavigate }: Props) {
  const t = useTheme();
  const [pending, setPending] = useState<PendingItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPendingForDept(department);
      if (active) setPending(result);
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { active = false; clearInterval(iv); };
  }, [department]);

  if (pending.length === 0) return null;

  const totalCount = pending.reduce((s, p) => s + p.count, 0);
  const primaryTab = pending[0].tab;
  const warn = t.colors.status.warning;

  return (
    <Pressable
      onPress={() => onNavigate?.(primaryTab)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: t.spacing.md,
        padding: t.spacing.md, borderRadius: t.radius.card,
        borderWidth: 1, borderColor: warn.text + '60', backgroundColor: warn.bg,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: warn.text + '20', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={18} color={warn.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: warn.text }}>
          {totalCount} Pending Approval{totalCount !== 1 ? 's' : ''}
        </Text>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: warn.text, opacity: 0.8, marginTop: 2 }} numberOfLines={1}>
          {pending.map((p) => `${p.count} ${p.label}`).join(' · ')}
        </Text>
      </View>
      <View style={{ paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: warn.text }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: '#ffffff' }}>Review →</Text>
      </View>
    </Pressable>
  );
}
