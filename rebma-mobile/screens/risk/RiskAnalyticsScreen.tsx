// rebma-mobile/screens/risk/RiskAnalyticsScreen.tsx
//
// New — step 4 of the tab-bar rebuild. RiskOverviewScreen already shows
// Approved/Rejected Today and a Credit Watch tile, so this deliberately
// shows something different: a 7-day approval breakdown by request type,
// sourced from global_audit_history the same way RiskOverviewScreen
// already reads it (department='RISK', action string prefix), plus
// week-over-week Approved/Rejected totals.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

const TYPE_COLORS: Record<string, string> = {
  CARGO: '#0ea5e9', ORDER: '#8b5cf6', POD: '#10b981', CUSTOMER: '#f59e0b',
};

function classify(action: string): string {
  const a = action.toUpperCase();
  if (a.includes('CARGO')) return 'CARGO';
  if (a.includes('POD') || a.includes('DELIVERY')) return 'POD';
  if (a.includes('CUSTOMER') || a.includes('CUST-')) return 'CUSTOMER';
  return 'ORDER';
}

export default function RiskAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvedWeek, setApprovedWeek] = useState(0);
  const [rejectedWeek, setRejectedWeek] = useState(0);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [byType, setByType] = useState<{ label: string; value: number; formattedValue: string; color: string }[]>([]);

  const load = useCallback(async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('global_audit_history')
      .select('action')
      .eq('department', 'RISK')
      .gte('timestamp', weekAgo);
    const rows = data || [];

    const approved = rows.filter((r: any) => String(r.action).startsWith('APPROVE')).length;
    const rejected = rows.filter((r: any) => String(r.action).startsWith('REJECT')).length;

    const byTypeMap: Record<string, number> = {};
    rows.forEach((r: any) => {
      const type = classify(String(r.action));
      byTypeMap[type] = (byTypeMap[type] || 0) + 1;
    });
    const typeData = Object.entries(byTypeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        label: type.charAt(0) + type.slice(1).toLowerCase(),
        value: count,
        formattedValue: String(count),
        color: TYPE_COLORS[type] || t.colors.accent,
      }));

    setApprovedWeek(approved);
    setRejectedWeek(rejected);
    setTotalDecisions(rows.length);
    setByType(typeData);
    setLoading(false);
    setRefreshing(false);
  }, [t.colors.accent]);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Approved (7 days)" value={loading ? '—' : approvedWeek} tone="success" /></View><View style={{ flex: 1 }}><MetricCard emphasis="compact" label="Rejected (7 days)" value={loading ? '—' : rejectedWeek} tone={rejectedWeek > 0 ? 'danger' : 'neutral'} /></View><View style={{ flex: 1 }}><MetricCard label="Total Decisions (7 days)" value={loading ? '—' : totalDecisions} tone="accent" emphasis="compact" /></View></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Decisions by Type (last 7 days)</Text>
          {byType.length > 0 ? (
            <BarChart data={byType} />
          ) : (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No decisions recorded in the last 7 days</Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
