// rebma-mobile/screens/adminWarehouse/OverviewScreen.tsx
// Ports: rebma-web/src/views/OperationsDashboard.tsx's `Overview` sub-tab
// (~L1068-1212) — 5 KPI tiles, a bar-chart snapshot of the same 5 figures,
// two "recent items" mini-lists, then the Phase 7.1 module launcher (D13)
// over the department's other 17 sub-tabs.
//
// The "Recent Cargo Intakes" list's web "View All" button targets a hidden
// `LoggedCargo` sub-tab that ISN'T in Sidebar.tsx's tab list (verified) —
// genuinely reachable only by drill-through, unlike fulfillment_tickets
// (which turned out to render directly inside the real, visible `Releases`
// sub-tab — see ReleasesScreen.tsx's header comment for that correction).
// Rather than build a second near-duplicate cargo table screen for
// LoggedCargo, its data (search, status filter, rejection reason) is
// folded into OpsHistoryScreen, so "View All" here targets the real
// `OpsHistory` registry sub-tab instead — one richer screen, not two.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Layers, Truck, TriangleAlert, Package, ClipboardCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { releaseOrderToDispatch } from '../../lib/dispatchActions';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import Button from '../../components/ui/Button';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

interface CargoRow {
  id: string;
  product_name: string | null;
  company: string | null;
  weight: number | null;
  status: string;
  discrepancies: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  client_name: string;
  product_name: string | null;
  total_amount: number;
  status: string;
}

export default function OverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const dept = getDepartmentEntry(activeDepartment || 'ADMIN_WAREHOUSE');

  const [cargo, setCargo] = useState<CargoRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stockQty, setStockQty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cargoRes, ordersRes, stockRes] = await Promise.all([
      supabase.from('cargo_intake').select('id, product_name, company, weight, status, discrepancies, created_at').order('created_at', { ascending: false }),
      supabase.from('orders').select('id, client_name, product_name, total_amount, status'),
      supabase.from('stock').select('quantity'),
    ]);
    if (cargoRes.data) setCargo(cargoRes.data as any);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (stockRes.data) setStockQty(stockRes.data.reduce((acc: number, r: any) => acc + (Number(r.quantity) || 0), 0));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalTons = cargo.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
  const pendingReleaseOrders = orders.filter((o) => o.status === 'PROCESSING');
  const pendingApprovalCount = cargo.filter((c) => c.status === 'PENDING_RISK_APPROVAL').length;
  const discrepancyCount = cargo.filter((c) => c.discrepancies && c.discrepancies !== 'None').length;

  const handleRelease = async (order: OrderRow) => {
    setReleasingId(order.id);
    try {
      const { driverName } = await releaseOrderToDispatch(order.id);
      Alert.alert('Released to Dispatch', `Order assigned to ${driverName}.`);
      load();
    } catch (e: any) {
      Alert.alert('Release Failed', e.message || 'Could not release this order.');
    } finally {
      setReleasingId(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}>
            <MetricCard label="Cargo Weight" value={loading ? '—' : totalTons.toFixed(1)} sublabel="Tons accumulated" icon={<Layers size={16} color={t.colors.accent} />} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Awaiting Release" value={loading ? '—' : pendingReleaseOrders.length} sublabel="Ready to load" icon={<Truck size={16} color={t.colors.accent} />} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Pending Approval" value={loading ? '—' : pendingApprovalCount} sublabel="Batches at Risk review" icon={<ClipboardCheck size={16} color={t.colors.accent} />} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Discrepancies" value={loading ? '—' : discrepancyCount} sublabel="Flagged batches" icon={<TriangleAlert size={16} color={t.colors.accent} />} tone="warning" />
          </View>
          <View style={{ width: '100%' }}>
            <MetricCard
              label="Total Stock Items"
              value={loading ? '—' : stockQty}
              sublabel="Port + Products + Purchases"
              icon={<Package size={16} color={t.colors.accent} />}
              onPress={() => navigation.navigate('Stock')}
            />
          </View>
        </View>

        {!loading && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>
              Operations KPI Snapshot
            </Text>
            <BarChart
              data={[
                { label: 'Cargo Weight (T)', value: totalTons, color: '#3b82f6' },
                { label: 'Awaiting Release', value: pendingReleaseOrders.length, color: '#10b981' },
                { label: 'Pending Approval', value: pendingApprovalCount, color: '#f59e0b' },
                { label: 'Discrepancy Notes', value: discrepancyCount, color: '#f43f5e' },
                { label: 'Total Stock Qty', value: stockQty, color: '#8b5cf6' },
              ]}
            />
          </Card>
        )}

        <Card>
          <SectionHeader
            title="Recent Cargo Intakes"
            action={
              <Text
                onPress={() => navigation.navigate('OpsHistory')}
                style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.accent }}
              >
                View All
              </Text>
            }
          />
          {cargo.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>
              No cargo intakes logged.
            </Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {cargo.slice(0, 3).map((item) => (
                <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <View style={{ flex: 1, marginRight: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{item.product_name || 'Unnamed Cargo'}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>CARGO-{item.id.slice(-6).toUpperCase()} · {item.company || '—'}</Text>
                  </View>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{Number(item.weight || 0).toFixed(1)}T</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Fulfillment Release Queue"
            action={
              <Text
                onPress={() => navigation.navigate('Releases')}
                style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.accent }}
              >
                View Queue
              </Text>
            }
          />
          {pendingReleaseOrders.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>
              No orders waiting release.
            </Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {pendingReleaseOrders.slice(0, 3).map((order) => (
                <View key={order.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <View style={{ flex: 1, marginRight: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{order.client_name}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>GHS {order.total_amount.toLocaleString()}</Text>
                  </View>
                  <Button label="Release" size="sm" onPress={() => handleRelease(order)} loading={releasingId === order.id} disabled={releasingId === order.id} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <ModuleLauncher dept={dept} exclude={['Overview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
