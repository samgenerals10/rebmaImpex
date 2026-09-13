// rebma-mobile/screens/adminWarehouse/ReleasesScreen.tsx
// Ports: rebma-web/src/views/OperationsDashboard.tsx's `Releases`
// (Fulfillment) sub-tab (~L1460-1540) in full — THREE sections, not one:
// (1) orders in PROCESSING → "Release & Load Truck" (auto-assigns a
// driver, same action as Overview's mini-list, via the shared
// lib/dispatchActions.ts helper); (2) fulfillment_tickets type
// PRODUCTION_RELEASE → "Mark Prepared" (plain status flip); (3)
// fulfillment_tickets type RAW_MATERIAL_RELEASE → "Release to Production"
// (deducts stock_ledger/stock for each requisitioned item, then completes
// the ticket and its linked material_requisitions row).
//
// Correction from this phase's plan: (2) and (3) were originally going to
// live in a separate drill-through screen (moved verbatim from Phase
// 7.0's OperationsHomeScreen placeholder), on the assumption they were a
// hidden view like LoggedCargo. Reading the actual JSX showed both ticket
// lists render directly inside this real, sidebar-visible Releases
// sub-tab — so they belong here, not behind a hidden "View All". The
// placeholder screen also lacked (3)'s stock-deduction side effect
// entirely (it only flipped status), which would have been a real
// inventory-accuracy bug had it shipped as Admin & Warehouse's home
// screen's drill-through.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { releaseOrderToDispatch } from '../../lib/dispatchActions';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonList } from '../../components/ui/Skeleton';
import { PackageCheck, Factory, Layers } from 'lucide-react-native';

interface OrderRow {
  id: string;
  ticket_number: string | null;
  client_name: string;
  product_name: string | null;
  destination: string | null;
  total_amount: number;
}

interface TicketRow {
  id: string;
  type: string;
  details: any;
  status: string;
}

export default function ReleasesScreen() {
  const t = useTheme();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [productionTickets, setProductionTickets] = useState<TicketRow[]>([]);
  const [rawMaterialTickets, setRawMaterialTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ordersRes, prodRes, rawRes] = await Promise.all([
      supabase.from('orders').select('id, ticket_number, client_name, product_name, destination, total_amount').eq('status', 'PROCESSING').order('created_at', { ascending: false }),
      supabase.from('fulfillment_tickets').select('id, type, details, status').eq('type', 'PRODUCTION_RELEASE').eq('status', 'PENDING').order('created_at', { ascending: false }),
      supabase.from('fulfillment_tickets').select('id, type, details, status').eq('type', 'RAW_MATERIAL_RELEASE').eq('status', 'PENDING').order('created_at', { ascending: false }),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (prodRes.data) setProductionTickets(prodRes.data as any);
    if (rawRes.data) setRawMaterialTickets(rawRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRelease = async (order: OrderRow) => {
    setBusyId(order.id);
    try {
      const { driverName } = await releaseOrderToDispatch(order.id);
      Alert.alert('Released to Dispatch', `Order assigned to ${driverName}.`);
      load();
    } catch (e: any) {
      Alert.alert('Release Failed', e.message || 'Could not release this order.');
    } finally {
      setBusyId(null);
    }
  };

  const markProductionPrepared = async (ticket: TicketRow) => {
    setBusyId(ticket.id);
    const { error } = await supabase.from('fulfillment_tickets').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('id', ticket.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Failed to Update', error.message);
      return;
    }
    setProductionTickets((prev) => prev.filter((x) => x.id !== ticket.id));
  };

  const releaseRawMaterials = async (ticket: TicketRow) => {
    setBusyId(ticket.id);
    const now = new Date().toISOString();
    const items = Array.isArray(ticket.details?.items) ? ticket.details.items : [];
    try {
      for (const item of items) {
        if (!item.materialName) continue;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;

        await supabase.from('stock_ledger').insert({
          product_name: item.materialName,
          movement_type: 'REMOVE',
          quantity: qty,
          reference: `Raw material released to Production (ticket ${ticket.id})`,
          created_at: now,
        });

        const { data: existing } = await supabase.from('stock').select('id, quantity').ilike('product_name', item.materialName).limit(1);
        if (existing && existing.length > 0) {
          const newQty = Math.max(0, (existing[0].quantity || 0) - qty);
          await supabase.from('stock').update({ quantity: newQty, last_updated: now }).eq('id', existing[0].id);
        }
      }

      await supabase.from('fulfillment_tickets').update({ status: 'COMPLETED', updated_at: now }).eq('id', ticket.id);
      if (ticket.details?.requisitionId) {
        await supabase.from('material_requisitions').update({ status: 'FULFILLED', updated_at: now }).eq('id', ticket.details.requisitionId);
      }
      setRawMaterialTickets((prev) => prev.filter((x) => x.id !== ticket.id));
    } catch (e: any) {
      Alert.alert('Release Failed', e.message || 'Could not release these materials.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <Card>
          <SectionTitle title="Fulfillment Releasing Queue" />
          {loading ? (
            <SkeletonList rows={2} />
          ) : orders.length === 0 ? (
            <EmptyState icon={<PackageCheck size={20} color={t.colors.textMuted} />} title="No orders pending release" />
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {orders.map((o) => (
                <View key={o.id} style={rowStyle(t)}>
                  <View style={{ flex: 1, marginRight: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{o.client_name}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{o.product_name || '—'} · {o.destination || '—'} · GHS {o.total_amount.toLocaleString()}</Text>
                  </View>
                  <Button label="Release" size="sm" onPress={() => handleRelease(o)} loading={busyId === o.id} disabled={busyId === o.id} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <SectionTitle title="Production Repackaging Releases" icon={<Factory size={16} color={t.colors.accent} />} />
          {loading ? (
            <SkeletonList rows={2} />
          ) : productionTickets.length === 0 ? (
            <EmptyState icon={<Factory size={20} color={t.colors.textMuted} />} title="No production releases pending" />
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {productionTickets.map((tk) => (
                <View key={tk.id} style={rowStyle(t)}>
                  <View style={{ flex: 1, marginRight: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
                      {tk.details?.productName || 'Product'} — {tk.details?.quantity} {tk.details?.unit || 'units'}
                    </Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{tk.details?.purpose || 'Approved by Management for repackaging/handling'}</Text>
                  </View>
                  <Button label="Mark Prepared" size="sm" onPress={() => markProductionPrepared(tk)} loading={busyId === tk.id} disabled={busyId === tk.id} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <SectionTitle title="Raw Material Releases" icon={<Layers size={16} color={t.colors.accent} />} />
          {loading ? (
            <SkeletonList rows={2} />
          ) : rawMaterialTickets.length === 0 ? (
            <EmptyState icon={<Layers size={20} color={t.colors.textMuted} />} title="No raw material releases pending" />
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {rawMaterialTickets.map((tk) => {
                const items = Array.isArray(tk.details?.items) ? tk.details.items : [];
                const summary = items.map((i: any) => `${i.materialName} — ${i.quantity} ${i.unit || 'units'}`).join(', ') || 'Materials';
                return (
                  <View key={tk.id} style={rowStyle(t)}>
                    <View style={{ flex: 1, marginRight: t.spacing.sm }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={2}>{summary}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{tk.details?.notes || 'Recorded by Finance, ready for Production pickup'}</Text>
                    </View>
                    <Button label="Release" size="sm" onPress={() => releaseRawMaterials(tk)} loading={busyId === tk.id} disabled={busyId === tk.id} />
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

function SectionTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.md }}>
      {icon}
      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{title}</Text>
    </View>
  );
}

function rowStyle(t: ReturnType<typeof useTheme>) {
  return {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: t.spacing.md,
    backgroundColor: t.colors.bgPage,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
  };
}
