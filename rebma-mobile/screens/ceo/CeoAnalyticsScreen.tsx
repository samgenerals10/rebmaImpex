// rebma-mobile/screens/ceo/CeoAnalyticsScreen.tsx
//
// New — step 4 of the tab-bar rebuild. CEO Command had no Analytics
// screen before this. Built against real orders/supplier_orders columns
// already verified elsewhere (ceo/OverviewScreen.tsx, SupplierOrdersScreen.tsx).
// supplier_orders carries mixed currencies, so its own total_amount is
// never summed across rows here — only counted, to avoid a misleading
// cross-currency figure. Shows an order-status breakdown rather than
// repeating OverviewScreen's own pending-queue tiles.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

const STATUS_COLORS = ['#22c55e', '#0ea5e9', '#f59e0b', '#8b5cf6', '#f43f5e', '#64748b'];

export default function CeoAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveredOrders, setDeliveredOrders] = useState(0);
  const [activeSupplierOrders, setActiveSupplierOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [byStatus, setByStatus] = useState<{ label: string; value: number; formattedValue: string; color: string }[]>([]);

  const load = useCallback(async () => {
    const [ordersRes, supplierRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('status').limit(3000),
      supabase.from('supplier_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '(received,completed)'),
      supabase.from('finance_payments').select('amount').limit(3000),
    ]);
    const orders = ordersRes.data || [];
    const revenue = (paymentsRes.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const byStatusMap: Record<string, number> = {};
    orders.forEach((r: any) => {
      const status = r.status || 'UNKNOWN';
      byStatusMap[status] = (byStatusMap[status] || 0) + 1;
    });
    const statusData = Object.entries(byStatusMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([status, count], i) => ({
        label: status.replace(/_/g, ' '),
        value: count,
        formattedValue: String(count),
        color: STATUS_COLORS[i % STATUS_COLORS.length],
      }));

    setTotalOrders(orders.length);
    setDeliveredOrders(orders.filter((r: any) => r.status === 'DELIVERED').length);
    setActiveSupplierOrders(supplierRes.count || 0);
    setTotalRevenue(revenue);
    setByStatus(statusData);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Orders" value={loading ? '—' : totalOrders} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Delivered" value={loading ? '—' : deliveredOrders} tone="success" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Active Supplier Orders" value={loading ? '—' : activeSupplierOrders} tone="info" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Revenue" value={loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`} /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Orders by Status</Text>
          {byStatus.length > 0 ? (
            <BarChart data={byStatus} />
          ) : (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No order data yet</Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
