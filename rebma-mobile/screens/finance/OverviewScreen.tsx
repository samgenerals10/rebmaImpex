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
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

interface OrderRow {
  id: string;
  client_name: string;
  total_amount: number;
  status: string;
}

export default function OverviewScreen() {
  const t = useTheme();
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
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Revenue" value={loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Pending Orders" value={loading ? '—' : pending.length} tone="warning" onPress={() => navigation.navigate('OrdersQueue')} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Payments Recorded" value={loading ? '—' : paymentCount} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Collections" value={loading ? '—' : `GHS ${creditOutstanding.toLocaleString()}`} /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Orders Awaiting Review</Text>
          {pending.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>Nothing pending finance review.</Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {pending.slice(0, 5).map((o) => (
                <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{o.client_name}</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {Number(o.total_amount || 0).toLocaleString()}</Text>
                </View>
              ))}
              <Text onPress={() => navigation.navigate('OrdersQueue')} style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accent, textAlign: 'center', marginTop: t.spacing.sm }}>
                Review All →
              </Text>
            </View>
          )}
        </Card>

        <ModuleLauncher dept={dept} exclude={['Evaluation']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
