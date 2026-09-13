// rebma-mobile/screens/marketing/AnalyticsScreen.tsx
// Ports: rebma-web/src/views/marketing/AnalyticsView.tsx — all real,
// live-aggregated from a single `orders` fetch + a `customers` count
// (confirmed no mock/hardcoded seed arrays here, unlike some other
// departments' Overview dashboards). Web's pie/funnel charts are
// condensed to the shared BarChart primitive, same simplification
// already applied throughout Phase 7.1/7.2.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

interface OrderRow {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  client_name: string;
  product_name: string | null;
  payment_mode: string;
}

export default function AnalyticsScreen() {
  const t = useTheme();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [ordersRes, custRes] = await Promise.all([
      supabase.from('orders').select('id, total_amount, status, created_at, client_name, product_name, payment_mode'),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    setCustomerCount(custRes.count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalOrders = orders.length;

  const monthlyTrend = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] || 0) + Number(o.total_amount || 0);
    }
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      .map(([month, amount]) => ({ label: month.slice(5), value: amount, formattedValue: `GHS ${amount.toLocaleString()}` }));
  }, [orders]);

  const paymentBreakdown = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) buckets[o.payment_mode || 'CASH'] = (buckets[o.payment_mode || 'CASH'] || 0) + 1;
    return Object.entries(buckets).sort((a, b) => b[1] - a[1]).map(([mode, count]) => ({ label: mode.replace(/_/g, ' '), value: count }));
  }, [orders]);

  const statusFunnel = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) buckets[o.status] = (buckets[o.status] || 0) + 1;
    return Object.entries(buckets).sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ label: status.replace(/_/g, ' '), value: count }));
  }, [orders]);

  const topProducts = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) { const name = o.product_name || 'Unknown'; buckets[name] = (buckets[name] || 0) + 1; }
    return Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ label: name, value: count }));
  }, [orders]);

  const topCustomers = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const o of orders) buckets[o.client_name] = (buckets[o.client_name] || 0) + Number(o.total_amount || 0);
    return Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ label: name, value: amount, formattedValue: `GHS ${amount.toLocaleString()}` }));
  }, [orders]);

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Revenue" value={loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Orders" value={loading ? '—' : totalOrders} /></View>
          <View style={{ width: '100%' }}><MetricCard label="Total Customers" value={loading ? '—' : customerCount} /></View>
        </View>

        {!loading && monthlyTrend.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Sales Trend (6 Months)</Text>
            <BarChart data={monthlyTrend} />
          </Card>
        )}
        {!loading && paymentBreakdown.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Payment Method Breakdown</Text>
            <BarChart data={paymentBreakdown} />
          </Card>
        )}
        {!loading && statusFunnel.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Order Status Funnel</Text>
            <BarChart data={statusFunnel} />
          </Card>
        )}
        {!loading && topProducts.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Top Products</Text>
            <BarChart data={topProducts} />
          </Card>
        )}
        {!loading && topCustomers.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Top Customers</Text>
            <BarChart data={topCustomers} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
