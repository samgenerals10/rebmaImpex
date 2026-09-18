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
import { View, Text, Alert, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Layers, Truck, TriangleAlert, Package, ClipboardCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { releaseOrderToDispatch } from '../../lib/dispatchActions';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import Button from '../../components/ui/Button';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';

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
  const { scrollHandler } = useCollapsibleHeader();
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
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        <PendingApprovalsAlertCard department="ADMIN_WAREHOUSE" onNavigate={(tab) => navigation.navigate(tab)} />

        {/* Aczone Warehouse Stock Hero Banner */}
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Active Inventory Snapshot
                </Text>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: '#FFFFFF', marginTop: 2 }}>
                {loading ? '—' : stockQty.toLocaleString()} Units
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                Port Cargo + Internal Production + Purchases
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate('Stock')} style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={28} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
          </View>
        </Card>

        {/* Aczone 2x2 Metrics Grid */}
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Cargo Weight"
              value={loading ? '—' : `${totalTons.toFixed(1)} T`}
              sublabel="Tons accumulated"
              icon={<Layers size={20} color={t.colors.action.blue} />}
              tone="info"
            />
            <MetricCard
              label="Awaiting Release"
              value={loading ? '—' : pendingReleaseOrders.length}
              sublabel="Ready to load"
              icon={<Truck size={20} color={t.colors.action.emerald} />}
              tone="success"
              onPress={() => navigation.navigate('Releases')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Pending Approval"
              value={loading ? '—' : pendingApprovalCount}
              sublabel="At Risk review"
              icon={<ClipboardCheck size={20} color={t.colors.action.amber} />}
              tone="warning"
            />
            <MetricCard
              label="Discrepancies"
              value={loading ? '—' : discrepancyCount}
              sublabel="Flagged batches"
              icon={<TriangleAlert size={20} color={t.colors.action.rose} />}
              tone="danger"
              onPress={() => navigation.navigate('OpsHistory')}
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
                { label: 'Cargo Weight (T)', value: totalTons, color: t.colors.action.blue },
                { label: 'Awaiting Release', value: pendingReleaseOrders.length, color: t.colors.action.emerald },
                { label: 'Pending Approval', value: pendingApprovalCount, color: t.colors.action.amber },
                { label: 'Discrepancy Notes', value: discrepancyCount, color: t.colors.action.rose },
                { label: 'Total Stock Qty', value: stockQty, color: t.colors.action.violet },
              ]}
            />
          </Card>
        )}

        {/* Recent Cargo Intakes Card */}
        <Card>
          <SectionHeader
            title="Recent Cargo Intakes"
            subtitle="Inbound port shipments and goods receipts"
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
            <View style={{ gap: t.spacing.sm, marginTop: t.spacing.xs }}>
              {cargo.slice(0, 3).map((item) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.md,
                    padding: t.spacing.md,
                    backgroundColor: t.darkMode ? '#1E293B' : '#F8F7FD',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                  }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${t.colors.action.blue}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={18} color={t.colors.action.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                      {item.product_name || 'Unnamed Cargo'}
                    </Text>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                      CARGO-{item.id.slice(-6).toUpperCase()} · {item.company || '—'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                    {Number(item.weight || 0).toFixed(1)}T
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Fulfillment Release Queue */}
        <Card>
          <SectionHeader
            title="Fulfillment Release Queue"
            subtitle="Orders cleared and awaiting carrier dispatch"
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
            <View style={{ gap: t.spacing.sm, marginTop: t.spacing.xs }}>
              {pendingReleaseOrders.slice(0, 3).map((order) => (
                <View
                  key={order.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.md,
                    padding: t.spacing.md,
                    backgroundColor: t.darkMode ? '#1E293B' : '#F8F7FD',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                  }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${t.colors.action.emerald}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={18} color={t.colors.action.emerald} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                      {order.client_name}
                    </Text>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                      GHS {Number(order.total_amount || 0).toLocaleString()}
                    </Text>
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
