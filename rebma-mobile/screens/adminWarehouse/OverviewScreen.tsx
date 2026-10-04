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
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { useNavigation } from '@react-navigation/native';
import { Layers, Truck, ClipboardCheck, Package, TriangleAlert } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { releaseOrderToDispatch } from '../../lib/dispatchActions';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import { useUpdatedKpiSpan } from '../../hooks/useUpdatedKpiSpan';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import ProductImage from '../../components/ui/ProductImage';
import Button from '../../components/ui/Button';
import SectionHeader from '../../components/ui/SectionHeader';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import TrackedSection from '../../components/ui/TrackedSection';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';

// Direct instruction: the wide "spans" slot in the KPI bento layout below
// isn't fixed to one KPI — it's whichever one changed since the user's
// last visit here. When more than one changed, the earliest entry in
// this list wins; when none changed, the LAST entry ('stock') is the
// safe default so the layout is never ambiguous.
const KPI_PRIORITY_ORDER = ['issues', 'pending', 'queue', 'weight', 'stock'];

interface CargoRow {
  id: string;
  product_name: string | null;
  company: string | null;
  weight: number | null;
  status: string;
  discrepancies: string | null;
  created_at: string;
  product_image: string | null;
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
      supabase.from('cargo_intake').select('id, product_name, company, weight, status, discrepancies, created_at, product_image').order('created_at', { ascending: false }),
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

  // Direct instruction: the spanning KPI is whichever one changed since
  // the last visit to this screen, not a fixed choice — see
  // hooks/useUpdatedKpiSpan.ts for the compare/tie-break/default logic.
  const spanKey = useUpdatedKpiSpan(
    'kpi-span-admin-warehouse-overview-v1',
    loading ? null : { stock: stockQty, weight: totalTons, queue: pendingReleaseOrders.length, pending: pendingApprovalCount, issues: discrepancyCount },
    KPI_PRIORITY_ORDER
  );

  const kpiDefs = [
    { id: 'stock', label: 'Stock', value: loading ? '—' : stockQty.toLocaleString(), sublabel: 'Total units', naturalTone: 'accent' as const, Icon: Package, naturalIconColor: t.colors.accent, onPress: () => navigation.navigate('Stock') },
    { id: 'weight', label: 'Weight', value: loading ? '—' : `${totalTons.toFixed(1)}T`, sublabel: 'Cargo tons', naturalTone: 'info' as const, Icon: Layers, naturalIconColor: t.colors.status.info.text, onPress: () => navigation.navigate('Stock') },
    { id: 'queue', label: 'Queue', value: loading ? '—' : pendingReleaseOrders.length, sublabel: 'Ready to load', naturalTone: 'success' as const, Icon: Truck, naturalIconColor: t.colors.action.emerald, onPress: () => navigation.navigate('Releases') },
    { id: 'pending', label: 'Pending', value: loading ? '—' : pendingApprovalCount, sublabel: 'At Risk review', naturalTone: 'warning' as const, Icon: ClipboardCheck, naturalIconColor: t.colors.action.amber, onPress: () => navigation.navigate('OpsHistory') },
    { id: 'issues', label: 'Issues', value: loading ? '—' : discrepancyCount, sublabel: 'Flagged batches', naturalTone: 'danger' as const, Icon: TriangleAlert, naturalIconColor: t.colors.action.rose, onPress: () => navigation.navigate('OpsHistory') },
  ];
  const spanning = kpiDefs.find((k) => k.id === spanKey) || kpiDefs.find((k) => k.id === 'stock')!;
  const remaining = kpiDefs.filter((k) => k.id !== spanning.id);

  // Direct instruction: the spanning card is amber ("this changed, look
  // here"), EXCEPT Issues — which keeps its own red, per direct
  // correction, since red is reserved for "this is a real problem" and
  // that meaning shouldn't get diluted just because Issues happens to
  // be the one that changed this time.
  const AMBER_ICON_COLOR = t.colors.status.warning.text;
  const effectiveKpi = (k: (typeof kpiDefs)[number], isSpanning: boolean) => {
    const useAmber = isSpanning && k.id !== 'issues';
    return {
      tone: useAmber ? ('warning' as const) : k.naturalTone,
      icon: <k.Icon size={18} color={useAmber ? AMBER_ICON_COLOR : k.naturalIconColor} />,
    };
  };

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

        {/* Direct instruction: a bento layout, not 5 equal cards — one
            KPI (whichever changed since the last visit, see spanKey
            above) spans 2 columns beside 1 regular KPI on the first
            row; the other 3 regular KPIs sit on the second row. Every
            regular-size card here uses MetricCard's 'secondary'
            emphasis, which already matches the Department Pages tiles'
            own height/icon-size exactly (94px / 38px icon) — same
            target size, just still showing the KPI's number, per
            direct instruction. */}
        <TrackedSection id="metrics" title="Key Metrics" icon={ClipboardCheck}>
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 2 }}>
              <MetricCard
                emphasis="secondary"
                tone={effectiveKpi(spanning, true).tone}
                label={spanning.label}
                value={spanning.value}
                sublabel={spanning.sublabel}
                icon={effectiveKpi(spanning, true).icon}
                onPress={spanning.onPress}
              />
            </View>
            <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="secondary"
                tone={effectiveKpi(remaining[0], false).tone}
                label={remaining[0].label}
                value={remaining[0].value}
                sublabel={remaining[0].sublabel}
                icon={effectiveKpi(remaining[0], false).icon}
                onPress={remaining[0].onPress}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {remaining.slice(1).map((k) => (
              <View key={k.id} style={{ flex: 1 }}>
                <MetricCard
                  emphasis="secondary"
                  tone={effectiveKpi(k, false).tone}
                  label={k.label}
                  value={k.value}
                  sublabel={k.sublabel}
                  icon={effectiveKpi(k, false).icon}
                  onPress={k.onPress}
                />
              </View>
            ))}
          </View>
        </View>
        </TrackedSection>

        {/* Recent Cargo Intakes Card */}
        <TrackedSection id="recent-cargo" title="Recent Cargo Intakes" icon={Layers}>
        {/* Direct correction: outer border removed and padding tightened
            (via Card's own `style` override, not a change to the shared
            component — every other screen's <Card> is unaffected). The
            horizontal-scroll items below already carry their own
            border/background, so the outer Card doing the same too was
            a border-in-a-border, padding-in-a-padding look. Shadow alone
            now separates this from the page, matching the lighter-touch
            direction the KPI cards already moved to. */}
        <Card style={{ borderWidth: 0, padding: t.spacing.md }}>
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
            // Direct correction: converted from a vertically-stacked list
            // to a horizontal-scroll strip of fixed-width cards — this
            // section's height is now constant no matter how many items
            // scroll past, so it can show more (8, not 3) without ever
            // pushing the sections below it further down the page.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm, marginTop: t.spacing.xs, paddingRight: t.spacing.md }}>
              {cargo.slice(0, 8).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate('OpsHistory')}
                  style={({ pressed }) => ({
                    width: 176,
                    padding: t.spacing.md,
                    backgroundColor: pressed ? (t.darkMode ? '#25344A' : '#EFEEF9') : (t.darkMode ? '#1E293B' : '#F8F7FD'),
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                  })}
                >
                  {/* Direct correction: the real cargo photo (captured
                      at Stock Intake, e.g. Milk Powder/Rice) now shows
                      here — it was already being saved, this screen's
                      own query just never selected the column that
                      holds it. ProductImage's own tap opens a full-size
                      viewer; tapping anywhere else on the card navigates
                      to Discrepancy Reports, per direct instruction that
                      the card itself be wired, not just decorative. */}
                  <ProductImage uri={item.product_image} label={item.product_name || 'Cargo'} size={40} />
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: t.spacing.sm }} numberOfLines={1}>
                    {item.product_name || 'Unnamed Cargo'}
                  </Text>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    CARGO-{item.id.slice(-6).toUpperCase()} · {item.company || '—'}
                  </Text>
                  <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: t.spacing.sm }}>
                    {Number(item.weight || 0).toFixed(1)}T
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Card>
        </TrackedSection>

        {/* Fulfillment Release Queue */}
        <TrackedSection id="release-queue" title="Fulfillment Release Queue" icon={Truck}>
        <Card style={{ borderWidth: 0, padding: t.spacing.md }}>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm, marginTop: t.spacing.xs, paddingRight: t.spacing.md }}>
              {pendingReleaseOrders.slice(0, 8).map((order) => (
                <View
                  key={order.id}
                  style={{
                    width: 176,
                    padding: t.spacing.md,
                    backgroundColor: t.darkMode ? '#1E293B' : '#F8F7FD',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${t.colors.action.emerald}18`, alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.sm }}>
                    <Truck size={16} color={t.colors.action.emerald} />
                  </View>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                    {order.client_name}
                  </Text>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    GHS {Number(order.total_amount || 0).toLocaleString()}
                  </Text>
                  <View style={{ marginTop: t.spacing.sm }}>
                    <Button label="Release" size="sm" onPress={() => handleRelease(order)} loading={releasingId === order.id} disabled={releasingId === order.id} />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
        </TrackedSection>

        <ModuleLauncher dept={dept} exclude={['Overview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
