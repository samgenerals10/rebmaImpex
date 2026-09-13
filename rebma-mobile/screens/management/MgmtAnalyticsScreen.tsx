// rebma-mobile/screens/management/MgmtAnalyticsScreen.tsx
// Ports: rebma-web/src/views/management/MgmtAnalyticsView.tsx (440 lines)
// — condensed to KPI tiles + BarChart from real aggregates (D43), matching
// the established Analytics-screen precedent (Phase 7.1's
// OpsAnalyticsScreen/FleetAnalyticsScreen) rather than porting the
// cashflow tabs, YoY chart, or performance heatmap.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

export default function MgmtAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approved, setApproved] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [pending, setPending] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [deptRevenue, setDeptRevenue] = useState<{ label: string; value: number }[]>([]);

  const load = useCallback(async () => {
    const [approvedRes, rejectedRes, pendingRes, ordersRes, paymentsRes, purchasesRes] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL'),
      supabase.from('orders').select('total_amount, status'),
      supabase.from('finance_payments').select('amount'),
      supabase.from('general_purchases').select('cost, status'),
    ]);
    setApproved(approvedRes.count || 0);
    setRejected(rejectedRes.count || 0);
    setPending(pendingRes.count || 0);

    const orders = ordersRes.data || [];
    const rev = orders.filter((o: any) => o.status !== 'CANCELLED' && o.status !== 'REJECTED').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    setRevenue(rev);

    const purchaseCosts = (purchasesRes.data || []).filter((p: any) => p.status === 'APPROVED').reduce((s: number, p: any) => s + Number(p.cost || 0), 0);
    setExpenses(purchaseCosts);

    // Department revenue: orders' own destination-department isn't tracked
    // per row, so this uses the same real signal MgmtAnalyticsView.tsx's
    // condensed replacement needs — approved cargo/order/purchase volume
    // by type, a simplified but real breakdown.
    setDeptRevenue([
      { label: 'Orders', value: rev },
      { label: 'Payments', value: (paymentsRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0) },
      { label: 'Purchases', value: purchaseCosts },
    ]);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Cargo Approved" value={loading ? '—' : approved} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Cargo Rejected" value={loading ? '—' : rejected} tone="danger" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Cargo Pending" value={loading ? '—' : pending} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Net Revenue" value={loading ? '—' : `GHS ${(revenue - expenses).toLocaleString()}`} tone={revenue - expenses >= 0 ? 'accent' : 'danger'} /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Flow Breakdown</Text>
          <BarChart data={deptRevenue.map((d) => ({ ...d, formattedValue: `GHS ${d.value.toLocaleString()}`, color: t.colors.accent }))} />
        </Card>
      </View>
    </Screen>
  );
}
