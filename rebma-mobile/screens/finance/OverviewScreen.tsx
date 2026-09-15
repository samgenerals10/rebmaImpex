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
import { DollarSign, Clock, Receipt, Wallet } from 'lucide-react-native';
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
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                Total Revenue
              </Text>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.onAccent, marginTop: t.spacing.xs }}>
                {loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {loading ? '' : `${paymentCount} payment${paymentCount === 1 ? '' : 's'} recorded`}
              </Text>
            </View>
            <View style={{ width: 52, height: 52, borderRadius: t.radius.lg, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={26} color={t.colors.onAccent} />
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <MetricCard label="Pending" value={loading ? '—' : pending.length} icon={<Clock size={16} color={t.colors.action.amber} />} tone="neutral" onPress={() => navigation.navigate('OrdersQueue')} />
          <MetricCard label="Payments" value={loading ? '—' : paymentCount} icon={<Receipt size={16} color={t.colors.action.blue} />} tone="neutral" />
          <MetricCard label="Collections" value={loading ? '—' : `GHS ${(creditOutstanding / 1000).toFixed(1)}k`} icon={<Wallet size={16} color={t.colors.action.teal} />} tone="neutral" />
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Orders Awaiting Review</Text>
          {pending.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>Nothing pending finance review.</Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {pending.slice(0, 5).map((o) => (
                <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.lg }}>
                  <View style={{ width: 36, height: 36, borderRadius: t.radius.md, backgroundColor: `${t.colors.action.amber}1f`, alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={16} color={t.colors.action.amber} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{o.client_name}</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {Number(o.total_amount || 0).toLocaleString()}</Text>
                </View>
              ))}
              <Text onPress={() => navigation.navigate('OrdersQueue')} style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accent, textAlign: 'center', marginTop: t.spacing.sm }}>
                Review All
              </Text>
            </View>
          )}
        </Card>

        <ModuleLauncher dept={dept} exclude={['Evaluation']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
