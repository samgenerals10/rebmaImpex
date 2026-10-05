// rebma-mobile/screens/adminWarehouse/ApprovedGoodsScreen.tsx
// Ports: rebma-web/src/views/operations/ApprovedGoodsView.tsx's orders
// table + its "Dispatch" action (the screen's functional core — vehicle/
// driver are plain text fields on web, confirmed by reading the dispatch
// modal, not a driver picker). The approved-cargo list itself is left to
// OpsHistoryScreen/StockScreen (which already cover post-approval cargo
// visibility) rather than duplicated here — this screen's job is the
// order-to-delivery handoff.
//
// "Print Waybill" is intentionally omitted (D11) — the waybill number and
// container number are still shown, read-only, once a delivery exists.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { Truck, Package, PackageCheck, TicketCheck, AlertCircle, History } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import ProductImage from '../../components/ui/ProductImage';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import IconActionButton from '../../components/ui/IconActionButton';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';

interface OrderRow {
  id: string;
  ticket_number: string | null;
  client_name: string;
  product_name: string | null;
  destination: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  status: string;
  payment_mode: string;
  metadata: any;
  finance_approved_by: string | null;
  created_by: string | null;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
];

export default function ApprovedGoodsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());
  const [waybills, setWaybills] = useState<Record<string, { waybillNumber: string; containerNumber: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<OrderRow | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<OrderRow | null>(null);
  // vehicleId/driverName removed (Phase 9) — Admin & Warehouse no longer
  // assigns either; Risk does, once the order lands in their Dispatch
  // queue as PENDING_ASSIGNMENT.
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [cargoBatches, setCargoBatches] = useState(0);
  const [cargoUnits, setCargoUnits] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, ticket_number, client_name, product_name, destination, destination_lat, destination_lng, status, payment_mode, metadata, finance_approved_by, created_by')
      .in('status', ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setOrders(data as any);

    const { data: dl } = await supabase.from('delivery_logs').select('order_id').not('order_id', 'is', null);
    if (dl) setDispatchedIds(new Set(dl.map((r: any) => r.order_id)));

    const { data: wb } = await supabase.from('waybills').select('order_id, waybill_number, container_number');
    if (wb) {
      const map: Record<string, { waybillNumber: string; containerNumber: string | null }> = {};
      for (const w of wb as any[]) map[w.order_id] = { waybillNumber: w.waybill_number, containerNumber: w.container_number };
      setWaybills(map);
    }

    // Port-approved cargo batches/units, for the same two KPI tiles web
    // derives from its "goods" list — that full list itself stays out of
    // scope here (StockScreen/OpsHistoryScreen already cover it), this is
    // just the two summary numbers.
    const { data: goods } = await supabase.from('cargo_intake').select('quantity').eq('status', 'APPROVED');
    if (goods) {
      setCargoBatches(goods.length);
      setCargoUnits(goods.reduce((s: number, g: any) => s + (Number(g.quantity) || 0), 0));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserEmail(data.user?.email || data.user?.id || 'Operations Staff'));
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch = !q || o.client_name.toLowerCase().includes(q) || (o.ticket_number || '').toLowerCase().includes(q) || (o.product_name || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const pendingDispatchCount = orders.filter((o) => (o.status === 'APPROVED' || o.status === 'PROCESSING') && !dispatchedIds.has(o.id)).length;
  const inTransitCount = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;

  const openDispatch = (order: OrderRow) => {
    setTarget(order);
  };

  const submitDispatch = async () => {
    if (!target) return;
    setSubmitting(true);
    // Phase 9: always lands as PENDING_ASSIGNMENT — Risk assigns the
    // vehicle and driver next, not Admin & Warehouse.
    const { data: rows, error } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: target.id,
        customer_name: target.client_name,
        delivery_address: target.destination,
        destination_lat: target.destination_lat,
        destination_lng: target.destination_lng,
        vehicle_id: 'TBD',
        driver_name: null,
        status: 'PENDING_ASSIGNMENT',
        updated_at: new Date().toISOString(),
      })
      .select();
    if (error) {
      setSubmitting(false);
      Alert.alert('Dispatch Failed', error.message);
      return;
    }
    // The order must pass through PROCESSING before it can ever reach
    // OUT_FOR_DELIVERY — enforce_order_status_transition() only allows
    // that jump from PROCESSING, and nothing else in the app ever set
    // this. Without it, every dispatched order silently gets stuck the
    // moment the driver starts sharing their location, with no way for
    // Risk to approve the delivery afterward.
    const { error: statusErr } = await supabase
      .from('orders')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .eq('id', target.id);
    if (statusErr) {
      Alert.alert('Dispatch Warning', `The delivery was created, but the order status could not be updated: ${statusErr.message}`);
    }
    // The waybill is made and printed by Risk (lib/waybillPrint.ts), not here.
    try {
      await supabase.from('global_audit_history').insert({
        action: 'DISPATCH_ORDER',
        department: 'ADMIN_WAREHOUSE',
        performed_by: profile?.fullName || 'Ops Staff',
        user_id: profile?.id || null,
        // Direct correction: this write had no reference_id at all, so
        // "loaded to dispatch" never showed up on the order's own
        // workflow timeline no matter where it was opened from.
        reference_id: target.id,
        details: `Order ${target.ticket_number || target.id} loaded to dispatch. Sent to Risk for vehicle and driver assignment.`,
        timestamp: new Date().toISOString(),
      });
    } catch {}
    setSubmitting(false);
    setDispatchedIds((prev) => new Set(prev).add(target.id));
    setTarget(null);
    load();
  };

  const columns: DataColumn<OrderRow>[] = [
    { key: 'client_name', label: 'Client', primary: true },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone={statusTone(o.status)} label={o.status.replace(/_/g, ' ')} /> },
    { key: 'ticket_number', label: 'Ticket #', render: (o) => o.ticket_number || 'Not set' },
    { key: 'product_name', label: 'Product', render: (o) => o.product_name || 'Not set' },
    { key: 'destination', label: 'Destination', render: (o) => o.destination || 'Not set' },
    { key: 'payment_mode', label: 'Payment', render: (o) => o.payment_mode || 'Not set' },
    { key: 'issued_by', label: 'Issued By', render: (o) => o.finance_approved_by || o.created_by || 'Pending record' },
    {
      key: 'waybill', label: 'Waybill',
      render: (o) => waybills[o.id]?.waybillNumber || 'Not set',
    },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
            <MetricCard emphasis="compact" label="Approved Cargo Batches" value={loading ? 'Not set' : cargoBatches} icon={<Package size={16} color={t.colors.accent} />} />
            </View>
            <View style={{ flex: 1 }}>
            <MetricCard emphasis="compact" label="Total Port Units" value={loading ? 'Not set' : cargoUnits} icon={<PackageCheck size={16} color={t.colors.accent} />} />
            </View>
            <View style={{ flex: 1 }}>
            <MetricCard emphasis="compact" label="Awaiting Dispatch" value={loading ? 'Not set' : pendingDispatchCount} icon={<TicketCheck size={16} color={t.colors.status.warning.text} />} tone={pendingDispatchCount > 0 ? 'warning' : undefined} />
            </View>
            <View style={{ flex: 1 }}>
            <MetricCard emphasis="compact" label="In Transit" value={loading ? 'Not set' : inTransitCount} icon={<Truck size={16} color={t.colors.accent} />} />
            </View>
          </View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Search client, ticket, or product…" />
        <SearchablePicker value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} label="Filter by Status" />

        <DataList
          columns={columns}
          data={filtered}
          rowKey={(o) => o.id}
          loading={loading}
          emptyTitle="No approved orders found"
          collapsible
          rowThumbnail={(o) => <ProductImage uri={o.metadata?.items?.[0]?.productImage} label={o.product_name || 'Order'} size={40} />}
          renderActions={(o) => {
            const isDispatchable = (o.status === 'APPROVED' || o.status === 'PROCESSING') && !dispatchedIds.has(o.id);
            const isDispatched = (o.status === 'APPROVED' || o.status === 'PROCESSING') && dispatchedIds.has(o.id);
            return (
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
                {/* Direct instruction: tracking should be "horizontal on
                    every list", a visible icon right on the row. */}
                <IconActionButton icon={History} tone="info" accessibilityLabel="View Timeline" onPress={() => setTimelineTarget(o)} />
                {isDispatchable && <Button label="Dispatch" size="sm" icon={<Truck size={12} color="#fff" />} onPress={() => openDispatch(o)} />}
                {isDispatched && <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.info.text }}>Assigned, awaiting pickup</Text>}
                {o.status === 'OUT_FOR_DELIVERY' && <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.warning.text }}>In Transit</Text>}
                {o.status === 'DELIVERED' && <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.success.text }}>✓ Delivered</Text>}
              </View>
            );
          }}
        />

        <RequestTimelineSheet
          open={!!timelineTarget}
          onClose={() => setTimelineTarget(null)}
          referenceId={timelineTarget?.id || ''}
          displayId={timelineTarget?.ticket_number || timelineTarget?.id}
        />
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'right' }}>
          {filtered.length} order{filtered.length !== 1 ? 's' : ''} · {pendingDispatchCount} pending · {inTransitCount} in transit
        </Text>
      </View>

      <Sheet
        open={!!target}
        onClose={() => setTarget(null)}
        title="Load to Dispatch"
        subtitle={target ? `${target.client_name} · ${target.ticket_number || target.id}` : undefined}
        side="bottom"
        footer={<Button label={submitting ? 'Sending…' : 'Confirm & Send to Risk'} onPress={submitDispatch} loading={submitting} disabled={submitting} fullWidth />}
      >
        {target && Array.isArray(target.metadata?.items) && target.metadata.items.length > 0 && (
          <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.md }}>
            {target.metadata.items.map((it: any, idx: number) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <ProductImage uri={it.productImage} label={it.productName} size={36} />
                <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{it.productName}</Text>
              </View>
            ))}
          </View>
        )}
        {target && (
          <View style={{ backgroundColor: t.colors.bgPage, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, marginBottom: t.spacing.md, gap: t.spacing.xs }}>
            {[
              ['Ticket', target.ticket_number || 'Not set'],
              ['Client', target.client_name],
              ['Product', target.product_name || 'Not set'],
              ['Destination', target.destination || 'Not set'],
              ['Payment Mode', target.payment_mode],
              ['Issued By', target.finance_approved_by || target.created_by || 'Pending record'],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{k}</Text>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{v}</Text>
              </View>
            ))}
          </View>
        )}
        {target && (
          <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, marginBottom: t.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Quantity (from order)</Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accent }}>
                {target.metadata?.quantity != null ? `${Number(target.metadata.quantity).toLocaleString()} units` : 'N/A'}
              </Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.label9.size, color: t.colors.textMuted, marginTop: 4 }}>This quantity will be recorded as OUT in the stock ledger</Text>
          </View>
        )}
        <Text style={{ fontSize: t.type.body12.size, color: t.colors.textMuted, marginBottom: t.spacing.md }}>
          Vehicle and driver are no longer assigned here. Risk picks them once this order lands in their Dispatch queue.
        </Text>
        {!!currentUserEmail && (
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.label9.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>
            This action will be attributed to: <Text style={{ fontFamily: t.font.semibold, color: t.colors.textSecondary }}>{currentUserEmail}</Text>
          </Text>
        )}
      </Sheet>
    </Screen>
  );
}
