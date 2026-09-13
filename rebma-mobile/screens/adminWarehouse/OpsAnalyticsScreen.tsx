// rebma-mobile/screens/adminWarehouse/OpsAnalyticsScreen.tsx
// Ports: rebma-web/src/views/operations/AnalyticsView.tsx — cargo intake
// counts (total/approved/discrepancy) and stock health counts
// (in-stock/low-stock/out-of-stock), same aggregate style as
// FleetAnalyticsScreen. Web's category-breakdown pie and 6-month
// inflow/released trend chart are read-only chrome over the same
// underlying counts already shown in the metric tiles — condensed to the
// bar chart below rather than a second, denser chart type.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

export default function OpsAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [totalCargo, setTotalCargo] = useState(0);
  const [approvedCargo, setApprovedCargo] = useState(0);
  const [discrepancyCargo, setDiscrepancyCargo] = useState(0);
  const [stockCounts, setStockCounts] = useState({ inStock: 0, lowStock: 0, outOfStock: 0 });

  const load = useCallback(async () => {
    const [totalRes, approvedRes, discrepancyRes, stockRes] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).not('discrepancies', 'is', null),
      supabase.from('stock').select('quantity, minimum_level'),
    ]);
    setTotalCargo(totalRes.count || 0);
    setApprovedCargo(approvedRes.count || 0);
    setDiscrepancyCargo(discrepancyRes.count || 0);
    const items = stockRes.data || [];
    setStockCounts({
      inStock: items.filter((s: any) => s.quantity > (s.minimum_level || 0)).length,
      lowStock: items.filter((s: any) => s.quantity > 0 && s.quantity <= (s.minimum_level || 0)).length,
      outOfStock: items.filter((s: any) => s.quantity <= 0).length,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Cargo Intakes" value={loading ? '—' : totalCargo} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Approved" value={loading ? '—' : approvedCargo} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Discrepancies" value={loading ? '—' : discrepancyCargo} tone="danger" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Low / Out of Stock" value={loading ? '—' : stockCounts.lowStock + stockCounts.outOfStock} tone="warning" /></View>
        </View>

        {!loading && (
          <Card>
            <BarChart
              data={[
                { label: 'In Stock', value: stockCounts.inStock, color: '#10b981' },
                { label: 'Low Stock', value: stockCounts.lowStock, color: '#f59e0b' },
                { label: 'Out of Stock', value: stockCounts.outOfStock, color: '#ef4444' },
              ]}
            />
          </Card>
        )}
      </View>
    </Screen>
  );
}
