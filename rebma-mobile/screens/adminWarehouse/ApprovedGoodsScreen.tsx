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
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Truck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';

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
}

export default function ApprovedGoodsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());
  const [waybills, setWaybills] = useState<Record<string, { waybillNumber: string; containerNumber: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<OrderRow | null>(null);
  // vehicleId/driverName removed (Phase 9) — Admin & Warehouse no longer
  // assigns either; Risk does, once the order lands in their Dispatch
  // queue as PENDING_ASSIGNMENT.
  const [containerNumber, setContainerNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, ticket_number, client_name, product_name, destination, destination_lat, destination_lng, status, payment_mode, metadata')
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

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDispatch = (order: OrderRow) => {
    setTarget(order);
    setContainerNumber('');
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
    if (rows && rows[0]) {
      try {
        const deliveryId = rows[0].id;
        const { data: existing } = await supabase.from('waybills').select('id').eq('delivery_log_id', deliveryId).limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from('waybills').insert({
            order_id: target.id,
            delivery_log_id: deliveryId,
            container_number: containerNumber.trim() || null,
            created_by: profile?.fullName || null,
          });
        }
      } catch {}
    }
    try {
      await supabase.from('global_audit_history').insert({
        action: 'DISPATCH_ORDER',
        department: 'ADMIN_WAREHOUSE',
        performed_by: profile?.fullName || 'Ops Staff',
        user_id: profile?.id || null,
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
    { key: 'ticket_number', label: 'Ticket #', render: (o) => o.ticket_number || '—' },
    { key: 'product_name', label: 'Product', render: (o) => o.product_name || '—' },
    { key: 'destination', label: 'Destination', render: (o) => o.destination || '—' },
    { key: 'payment_mode', label: 'Payment', render: (o) => o.payment_mode || '—' },
    {
      key: 'waybill', label: 'Waybill',
      render: (o) => waybills[o.id]?.waybillNumber || '—',
    },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <DataList
        columns={columns}
        data={orders}
        rowKey={(o) => o.id}
        loading={loading}
        emptyTitle="No approved orders found"
        renderActions={(o) => {
          const isDispatchable = (o.status === 'APPROVED' || o.status === 'PROCESSING') && !dispatchedIds.has(o.id);
          const isDispatched = (o.status === 'APPROVED' || o.status === 'PROCESSING') && dispatchedIds.has(o.id);
          if (isDispatchable) {
            return <Button label="Dispatch" size="sm" icon={<Truck size={12} color="#fff" />} onPress={() => openDispatch(o)} />;
          }
          if (isDispatched) {
            return <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.info.text }}>Assigned — awaiting pickup</Text>;
          }
          if (o.status === 'OUT_FOR_DELIVERY') {
            return <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.warning.text }}>In Transit</Text>;
          }
          return null;
        }}
      />

      <Sheet
        open={!!target}
        onClose={() => setTarget(null)}
        title="Load to Dispatch"
        subtitle={target ? `${target.client_name} · ${target.ticket_number || target.id}` : undefined}
        side="bottom"
        footer={<Button label={submitting ? 'Sending…' : 'Confirm & Send to Risk'} onPress={submitDispatch} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Text style={{ fontSize: t.type.body12.size, color: t.colors.textMuted, marginBottom: t.spacing.md }}>
          Vehicle and driver are no longer assigned here — Risk picks them once this order lands in their Dispatch queue.
        </Text>
        <Field label="Container Number" hint="Optional"><Input value={containerNumber} onChangeText={setContainerNumber} placeholder="E.g., MSKU-1234567" /></Field>
      </Sheet>
    </Screen>
  );
}
