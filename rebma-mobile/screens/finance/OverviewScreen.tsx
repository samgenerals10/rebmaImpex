// rebma-mobile/screens/finance/OverviewScreen.tsx
// Ports: rebma-web/src/views/finance/OverviewView.tsx — a very large
// desktop dashboard (inventory drill-downs, cost-price breakdowns, wallet
// splits, cashflow tabs). Condensed to the same proportional shape every
// other department's Overview screen in this app uses: real KPI tiles +
// one real "needs attention" list + the module launcher (D13) — matching
// the scope precedent already set for Admin & Warehouse/Reception/
// Marketing's own Overview screens, not a 1:1 port of every drill-down.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DollarSign, Clock, Receipt, Wallet, ClipboardList } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import TrackedSection from '../../components/ui/TrackedSection';

interface OrderRow {
  id: string;
  client_name: string;
  total_amount: number;
  status: string;
}

export default function OverviewScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
  const navigation = useNavigation<any>();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const dept = getDepartmentEntry(activeDepartment || 'FINANCE');

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [paymentCount, setPaymentCount] = useState(0);
  const [creditOutstanding, setCreditOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [ordersRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('id, client_name, total_amount, status'),
      supabase.from('finance_payments').select('id, amount'),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (paymentsRes.data) {
      setPaymentCount(paymentsRes.data.length);
      setCreditOutstanding(paymentsRes.data.reduce((s: number, p: any) => s + Number(p.amount || 0), 0));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = orders.filter((o) => ['DELIVERED', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pending = orders.filter((o) => o.status === 'PENDING_FINANCE');

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        {/* Accounts Snapshot — two clickable tiles, not one oversized
            banner (per direct correction: a full-bleed color block that
            does nothing on tap doesn't belong in a mobile app). */}
        <TrackedSection id="hero" title="Accounts Snapshot" icon={DollarSign}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone="accent"
              label="Total Revenue"
              value={loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`}
              sublabel="All approved orders"
              icon={<DollarSign size={18} color={t.colors.accent} />}
              onPress={() => navigation.navigate('Transactions')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone="warning"
              label="Pending Orders"
              value={loading ? '—' : pending.length}
              sublabel="Awaiting review"
              icon={<Clock size={18} color={t.colors.status.warning.text} />}
              onPress={() => navigation.navigate('OrdersQueue')}
            />
          </View>
        </View>
        </TrackedSection>

        {/* Key Metrics */}
        <TrackedSection id="metrics" title="Key Metrics" icon={ClipboardList}>
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="compact"
              label="Total Orders"
              value={loading ? '—' : orders.length}
              sublabel="All statuses"
              icon={<ClipboardList size={14} color={t.colors.action.violet} />}
              tone="neutral"
              onPress={() => navigation.navigate('OrdersQueue')}
            />
            </View>
            <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="compact"
              label="Payments"
              value={loading ? '—' : paymentCount}
              sublabel="Receipts register"
              icon={<Receipt size={14} color={t.colors.action.blue} />}
              tone="info"
              onPress={() => navigation.navigate('Receipts')}
            />
            </View>
            <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="compact"
              label="Collections"
              value={loading ? '—' : `GHS ${(creditOutstanding / 1000).toFixed(1)}k`}
              sublabel="Ledger inflow"
              icon={<Wallet size={14} color={t.colors.action.teal} />}
              tone="success"
              onPress={() => navigation.navigate('Transactions')}
            />
            </View>
          </View>
        </View>
        </TrackedSection>

        <TrackedSection id="pending-review" title="Orders Awaiting Review" icon={Clock}>
        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>
            Orders Awaiting Review
          </Text>
          {pending.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>
              Nothing pending finance review.
            </Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {pending.slice(0, 5).map((o) => (
                <View
                  key={o.id}
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
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${t.colors.action.amber}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={18} color={t.colors.action.amber} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                    {o.client_name}
                  </Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                    GHS {Number(o.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
              ))}
              <Text onPress={() => navigation.navigate('OrdersQueue')} style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accent, textAlign: 'center', marginTop: t.spacing.sm }}>
                Review All Orders
              </Text>
            </View>
          )}
        </Card>
        </TrackedSection>

        <ModuleLauncher dept={dept} exclude={['Evaluation']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
