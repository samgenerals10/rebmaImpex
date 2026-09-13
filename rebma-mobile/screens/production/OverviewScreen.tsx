// rebma-mobile/screens/production/OverviewScreen.tsx
// Ports: rebma-web/src/views/production/OverviewView.tsx (554 lines) —
// condensed (D62) per the established Overview precedent (Finance/Risk/
// Management/HR's own Overview screens): real KPI tiles (today's boxes/
// sachets produced, quality pass rate, orders submitted today, WIP item
// count) + a needs-attention list (pending production_requests, linking
// to InternalOrders) + ApprovalHistoryPanel + the module launcher. Not a
// port of the day-of-week output bar chart or the KPI dropdown menus.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Boxes, Package, CheckCircle2, ClipboardList } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';

export default function OverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('PRODUCTION');

  const [todayBoxes, setTodayBoxes] = useState(0);
  const [todaySachets, setTodaySachets] = useState(0);
  const [passRate, setPassRate] = useState(0);
  const [ordersToday, setOrdersToday] = useState(0);
  const [wipCount, setWipCount] = useState(0);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const [{ data: output }, { count: wipCnt }, { data: pendingRequests }] = await Promise.all([
      supabase.from('production_logs').select('date, boxes_produced, total_sachets, quality_result'),
      supabase.from('wip_stock').select('id', { count: 'exact', head: true }),
      supabase.from('production_requests').select('*').eq('status', 'PENDING_MANAGEMENT').order('created_at', { ascending: false }).limit(5),
    ]);

    const rows = output || [];
    const todayRows = rows.filter((r: any) => r.date === today);
    setTodayBoxes(todayRows.reduce((s: number, r: any) => s + Number(r.boxes_produced || 0), 0));
    setTodaySachets(todayRows.reduce((s: number, r: any) => s + Number(r.total_sachets || 0), 0));
    setPassRate(rows.length ? Math.round((rows.filter((r: any) => r.quality_result === 'Pass' || !r.quality_result).length / rows.length) * 100) : 0);
    setOrdersToday(todayRows.length);
    setWipCount(wipCnt || 0);
    setPending(pendingRequests || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Boxes Produced Today" value={loading ? '—' : todayBoxes} icon={<Package size={16} color={t.colors.accent} />} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Sachets Today" value={loading ? '—' : todaySachets.toLocaleString()} icon={<Boxes size={16} color={t.colors.accent} />} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Quality Pass Rate" value={loading ? '—' : `${passRate}%`} tone={passRate >= 90 ? 'accent' : 'warning'} icon={<CheckCircle2 size={16} color={t.colors.status.success.text} />} /></View>
          <View style={{ width: '47%' }}><MetricCard label="WIP Items" value={loading ? '—' : wipCount} icon={<ClipboardList size={16} color={t.colors.textSecondary} />} onPress={() => navigation.navigate('WIPStock')} /></View>
        </View>

        <View>
          <SectionHeader title="Needs Attention" subtitle="Production requests awaiting Management approval" />
          {pending.length === 0 && !loading ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.md }}>Nothing pending — all clear.</Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {pending.map((r) => (
                <Card key={r.id} tone="inset">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.product_name}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>Req #{r.request_number || String(r.id).slice(0, 8)} · Qty {r.quantity} {r.unit}</Text>
                    </View>
                    <Badge tone="warning" label="Pending" size="xs" />
                  </View>
                </Card>
              ))}
              <Text
                onPress={() => navigation.navigate('InternalOrders')}
                style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent, textAlign: 'center' }}
              >
                View all internal orders →
              </Text>
            </View>
          )}
        </View>

        <ApprovalHistoryPanel department="PRODUCTION" title="Recent Production Activity" />

        <ModuleLauncher dept={dept} exclude={['Requisition']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
