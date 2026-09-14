// rebma-mobile/screens/adminWarehouse/OpsAnalyticsScreen.tsx
// Ports: rebma-web/src/views/operations/AnalyticsView.tsx — cargo intake
// counts, stock health counts, the 6-month Cargo Inflow vs Release trend,
// Stock by Category breakdown (as a bar chart, same chart-type-only
// simplification precedent as FleetAnalyticsScreen — the data is real,
// only the pie-vs-bar rendering differs), and Top Products by Volume,
// which the earlier pass here had dropped as "a second, denser chart
// type over the same counts" — re-checked against source and that's
// wrong for Top Products specifically: it's its own real, unique dataset
// (per-product received/released quantities and a computed status), not
// a restatement of the KPI tiles. Ported for real below. The clickable
// KPI-tile drill-down modal and page-level CSV export are still not
// ported, consistent with the same call made on the Overview screen.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import Badge from '../../components/ui/Badge';
import DataList, { type DataColumn } from '../../components/ui/DataList';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TopProductRow { rank: number; name: string; received: number; receivedCount: number; releasedQty: number; releasedCount: number; status: string; }

export default function OpsAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [totalCargo, setTotalCargo] = useState(0);
  const [approvedCargo, setApprovedCargo] = useState(0);
  const [discrepancyCargo, setDiscrepancyCargo] = useState(0);
  const [stockCounts, setStockCounts] = useState({ inStock: 0, lowStock: 0, outOfStock: 0 });
  const [cargoInflow, setCargoInflow] = useState<{ month: string; inflow: number; released: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);

  const load = useCallback(async () => {
    const [totalRes, approvedRes, discrepancyRes, stockRes, categoryRes, productRes] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).not('discrepancies', 'is', null),
      supabase.from('stock').select('quantity, minimum_level'),
      supabase.from('stock').select('category'),
      supabase.from('cargo_intake').select('product_name, status, quantity, created_at'),
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

    // Cargo inflow chart, grouped by month, last 6 months
    const cargoRows = productRes.data || [];
    const monthMap: Record<string, { inflow: number; released: number }> = {};
    for (const row of cargoRows as any[]) {
      const m = MONTHS_SHORT[new Date(row.created_at).getMonth()];
      if (!monthMap[m]) monthMap[m] = { inflow: 0, released: 0 };
      monthMap[m].inflow++;
      if (row.status === 'APPROVED') monthMap[m].released++;
    }
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const k = MONTHS_SHORT[d.getMonth()];
      return { month: k, inflow: monthMap[k]?.inflow || 0, released: monthMap[k]?.released || 0 };
    });
    setCargoInflow(last6);

    // Stock by Category breakdown, top 6
    const catRows = categoryRes.data || [];
    const catMap: Record<string, number> = {};
    for (const r of catRows as any[]) { const cat = r.category || 'Uncategorised'; catMap[cat] = (catMap[cat] || 0) + 1; }
    const catTotal = Object.values(catMap).reduce((a, b) => a + b, 0);
    setCategoryBreakdown(
      Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, count]) => ({ name, value: catTotal > 0 ? Math.round((count / catTotal) * 100) : 0 }))
    );

    // Top Products by Volume — real per-product received/released quantities
    const prodMap: Record<string, { received: number; receivedCount: number; releasedQty: number; releasedCount: number }> = {};
    for (const r of cargoRows as any[]) {
      const name = r.product_name || 'Unknown';
      const qty = Number(r.quantity || 1);
      if (!prodMap[name]) prodMap[name] = { received: 0, receivedCount: 0, releasedQty: 0, releasedCount: 0 };
      prodMap[name].received += qty;
      prodMap[name].receivedCount++;
      if (r.status === 'APPROVED') { prodMap[name].releasedQty += qty; prodMap[name].releasedCount++; }
    }
    setTopProducts(
      Object.entries(prodMap).sort((a, b) => b[1].received - a[1].received).slice(0, 10)
        .map(([name, d], i) => ({
          rank: i + 1, name, received: d.received, receivedCount: d.receivedCount,
          releasedQty: d.releasedQty, releasedCount: d.releasedCount,
          status: d.releasedQty >= d.received ? 'Healthy' : d.releasedQty === 0 ? 'Out of Stock' : 'Low Stock',
        }))
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inflowChartData = useMemo(
    () => cargoInflow.flatMap((d) => [
      { label: `${d.month} In`, value: d.inflow },
      { label: `${d.month} Rel`, value: d.released },
    ]),
    [cargoInflow]
  );

  const topProductCols: DataColumn<TopProductRow>[] = [
    { key: 'name', label: 'Product', primary: true, render: (r) => `#${r.rank} ${r.name}` },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={r.status === 'Healthy' ? 'success' : r.status === 'Low Stock' ? 'warning' : 'danger'} label={r.status} /> },
    { key: 'received', label: 'Qty Received', render: (r) => `${r.received} (${r.receivedCount} deliveries)` },
    { key: 'releasedQty', label: 'Qty Released', render: (r) => `${r.releasedQty} (${r.releasedCount} releases)` },
  ];

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
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Current Stock Status</Text>
            <BarChart
              data={[
                { label: 'In Stock', value: stockCounts.inStock, color: '#10b981' },
                { label: 'Low Stock', value: stockCounts.lowStock, color: '#f59e0b' },
                { label: 'Out of Stock', value: stockCounts.outOfStock, color: '#ef4444' },
              ]}
            />
          </Card>
        )}

        {!loading && cargoInflow.some((d) => d.inflow > 0) && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Cargo Inflow vs Release Velocity (6 months)</Text>
            <BarChart data={inflowChartData} />
          </Card>
        )}

        {!loading && categoryBreakdown.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Stock by Category</Text>
            <BarChart data={categoryBreakdown.map((c) => ({ label: c.name, value: c.value, formattedValue: `${c.value}%` }))} />
          </Card>
        )}

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Top Products by Volume</Text>
          {topProducts.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No cargo intake data yet.</Text>
          ) : <DataList columns={topProductCols} data={topProducts} rowKey={(r) => r.name} />}
        </Card>
      </View>
    </Screen>
  );
}
