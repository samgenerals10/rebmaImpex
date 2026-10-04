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

import DateRangeField from '../../components/ui/DateRangeField';
import type { CalendarValue } from '../../components/ui/CalendarPicker';
import { lastNDays, rangeBounds, rangeDays } from '../../lib/dateRange';

export default function AnalyticsScreen() {
  const t = useTheme();
  // Calendar range instead of 7D / 30D / 90D / 12M (Part C); starts on the
  // last 7 days, the old default.
  const [range, setRange] = useState<CalendarValue>(() => lastNDays(7));
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeBounds(range);
    let vq = supabase.from('visitors').select('full_name, host_name, check_in_time');
    let aq = supabase.from('attendance').select('date');
    if (from) { vq = vq.gte('check_in_time', from.toISOString()); aq = aq.gte('date', range.start!); }
    if (to) { vq = vq.lte('check_in_time', to.toISOString()); aq = aq.lte('date', range.end!); }
    const [v, a] = await Promise.all([vq, aq]);
    setVisitors(v.data || []);
    setAttendance(a.data || []);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const totalVisitors = visitors.length;
  const totalCheckins = attendance.length;
  const avgPerDay = (totalVisitors / rangeDays(range)).toFixed(1);

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
        <DateRangeField value={range} onChange={setRange} title="Visitor figures for" />

        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Total Visitors" value={loading ? '—' : totalVisitors} /></View><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Total Check-Ins" value={loading ? '—' : totalCheckins} tone="accent" /></View><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Avg Visitors / Day" value={loading ? '—' : avgPerDay} /></View></View>
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
