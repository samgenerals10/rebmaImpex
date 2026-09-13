// rebma-mobile/screens/production/AnalyticsScreen.tsx
// Ports: rebma-web/src/views/production/AnalyticsView.tsx (427 lines) —
// condensed to KPI tiles + BarChart (D66), matching every prior phase's
// Analytics-screen precedent (Phase 7.1's D9). Confirmed no mock data to
// worry about here, just scope reduction from a multi-chart dashboard.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ProdAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBoxes, setTotalBoxes] = useState(0);
  const [totalSachets, setTotalSachets] = useState(0);
  const [passRate, setPassRate] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [monthly, setMonthly] = useState<{ label: string; value: number; formattedValue: string; color: string }[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('production_logs')
      .select('date, product_name, boxes_produced, total_sachets, quality_result')
      .order('date', { ascending: false })
      .limit(2000);
    const records = data || [];

    const boxes = records.reduce((s: number, r: any) => s + Number(r.boxes_produced || 0), 0);
    const sachets = records.reduce((s: number, r: any) => s + Number(r.total_sachets || 0), 0);
    const passed = records.filter((r: any) => r.quality_result === 'Pass' || !r.quality_result).length;
    const rate = records.length ? Math.round((passed / records.length) * 100) : 0;

    const byMonth: Record<string, number> = {};
    records.forEach((r: any) => {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        const key = MONTH_NAMES[d.getMonth()];
        byMonth[key] = (byMonth[key] || 0) + Number(r.boxes_produced || 0);
      }
    });
    const monthlyData = MONTH_NAMES.filter((m) => byMonth[m]).slice(-6).map((m) => ({
      label: m,
      value: byMonth[m],
      formattedValue: `${byMonth[m].toLocaleString()} boxes`,
      color: t.colors.accent,
    }));

    setTotalBoxes(boxes);
    setTotalSachets(sachets);
    setPassRate(rate);
    setTotalRecords(records.length);
    setMonthly(monthlyData);
    setLoading(false);
    setRefreshing(false);
  }, [t.colors.accent]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Boxes Produced" value={loading ? '—' : totalBoxes.toLocaleString()} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Sachets Produced" value={loading ? '—' : totalSachets.toLocaleString()} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Quality Pass Rate" value={loading ? '—' : `${passRate}%`} tone={passRate >= 90 ? 'accent' : 'warning'} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Records" value={loading ? '—' : totalRecords} /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Monthly Output (last 6 months)</Text>
          {monthly.length > 0 ? (
            <BarChart data={monthly} />
          ) : (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No monthly data yet</Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
