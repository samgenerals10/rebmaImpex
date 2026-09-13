// rebma-mobile/screens/reception/AnalyticsScreen.tsx
// Ports: rebma-web/src/views/reception/AnalyticsView.tsx — period toggle
// (7D/30D/90D/12M) + KPI tiles + a trend chart, all computed live from
// real `visitors`/`attendance` rows (confirmed real, unlike Overview's
// mock-seeded chrome — see VisitorLogScreen.tsx's header comment). Web's
// pie/heatmap chart variety is condensed to the shared BarChart primitive,
// same simplification already applied to FleetAnalyticsScreen/
// OpsAnalyticsScreen in Phase 7.1; the frequent-visitors/most-visited-staff
// lists are real aggregates and are kept.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

type Period = '7D' | '30D' | '90D' | '12M';
const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '30D': 30, '90D': 90, '12M': 365 };

export default function AnalyticsScreen() {
  const t = useTheme();
  const [period, setPeriod] = useState<Period>('7D');
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - PERIOD_DAYS[period]);
    const sinceIso = since.toISOString();

    const [v, a] = await Promise.all([
      supabase.from('visitors').select('full_name, host_name, check_in_time').gte('check_in_time', sinceIso),
      supabase.from('attendance').select('date').gte('date', sinceIso.slice(0, 10)),
    ]);
    setVisitors(v.data || []);
    setAttendance(a.data || []);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const totalVisitors = visitors.length;
  const totalCheckins = attendance.length;
  const avgPerDay = PERIOD_DAYS[period] > 0 ? (totalVisitors / PERIOD_DAYS[period]).toFixed(1) : '0';

  const dayBuckets: Record<string, number> = {};
  for (const v of visitors) {
    const day = (v.check_in_time || '').slice(0, 10);
    if (day) dayBuckets[day] = (dayBuckets[day] || 0) + 1;
  }
  const trendData = Object.entries(dayBuckets).sort((a, b) => a[0].localeCompare(b[0])).slice(-10)
    .map(([date, count]) => ({ label: date.slice(5), value: count }));

  const frequentVisitors = Object.entries(
    visitors.reduce((acc: Record<string, number>, v) => { const n = v.full_name || 'Unknown'; acc[n] = (acc[n] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const mostVisitedStaff = Object.entries(
    visitors.reduce((acc: Record<string, number>, v) => { const n = v.host_name || 'Unassigned'; acc[n] = (acc[n] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', backgroundColor: t.colors.bgCard, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, padding: 3 }}>
          {(['7D', '30D', '90D', '12M'] as Period[]).map((p) => (
            <Pressable key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: period === p ? t.colors.accent : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: period === p ? t.colors.onAccent : t.colors.textSecondary }}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Visitors" value={loading ? '—' : totalVisitors} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Check-Ins" value={loading ? '—' : totalCheckins} tone="accent" /></View>
          <View style={{ width: '100%' }}><MetricCard label="Avg Visitors / Day" value={loading ? '—' : avgPerDay} /></View>
        </View>

        {!loading && trendData.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Visitor Trend</Text>
            <BarChart data={trendData} />
          </Card>
        )}

        {!loading && frequentVisitors.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Frequent Visitors</Text>
            <BarChart data={frequentVisitors.map(([name, count]) => ({ label: name, value: count }))} />
          </Card>
        )}

        {!loading && mostVisitedStaff.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Most Visited Staff</Text>
            <BarChart data={mostVisitedStaff.map(([name, count]) => ({ label: name, value: count, color: t.colors.action.indigo }))} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
