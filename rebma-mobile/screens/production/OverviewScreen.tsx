// rebma-mobile/screens/production/OverviewScreen.tsx
// Ports: rebma-web/src/views/production/OverviewView.tsx
// Redesigned with Aczone Design System: two clickable snapshot tiles, 2x2 Metric Grid, Grouped Action Launcher.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Boxes, ClipboardList, Factory, Layers, CheckCircle2, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';

export default function OverviewScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
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
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        {/* Manufacturing & Output snapshot — two clickable tiles, not one
            oversized banner (per direct correction: a full-bleed color
            block that does nothing on tap doesn't belong in a mobile app). */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone="accent"
              label="Boxes Today"
              value={loading ? '—' : todayBoxes.toLocaleString()}
              sublabel={`${todaySachets.toLocaleString()} sachets`}
              icon={<Boxes size={18} color={t.colors.accent} />}
              onPress={() => navigation.navigate('OutputRecording')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone="success"
              label="Quality Pass Rate"
              value={loading ? '—' : `${passRate}%`}
              sublabel="Today's output"
              icon={<CheckCircle2 size={18} color={t.colors.status.success.text} />}
              onPress={() => navigation.navigate('OutputRecording')}
            />
          </View>
        </View>

        {/* Key Metrics — 4 across, per direct correction */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Plant Metrics" subtitle="Real-time output and inventory levels" />
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Sachets"
                value={loading ? '—' : todaySachets.toLocaleString()}
                sublabel="Daily volume"
                icon={<Boxes size={14} color={t.colors.action.blue} />}
                tone="info"
                onPress={() => navigation.navigate('OutputRecording')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="WIP"
                value={loading ? '—' : wipCount}
                sublabel="In progress"
                icon={<Layers size={14} color={t.colors.action.amber} />}
                tone="warning"
                onPress={() => navigation.navigate('WIPStock')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Runs"
                value={loading ? '—' : ordersToday}
                sublabel="Batches today"
                icon={<Factory size={14} color={t.colors.action.teal} />}
                tone="success"
                onPress={() => navigation.navigate('InternalOrders')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="QA Pass"
                value={loading ? '—' : `${passRate}%`}
                sublabel="Verification"
                icon={<CheckCircle2 size={14} color={t.colors.action.emerald} />}
                tone="success"
                onPress={() => navigation.navigate('ProdAnalytics')}
              />
              </View>
            </View>
          </View>
        </View>

        {/* Needs Attention Queue */}
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHeader title="Raw Material Requisitions" subtitle="Internal requests pending Management approval" />
            <Pressable onPress={() => navigation.navigate('InternalOrders')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>View all</Text>
              <ArrowRight size={14} color={t.colors.accent} />
            </Pressable>
          </View>
          {pending.length === 0 && !loading ? (
            <View
              style={[
                {
                  backgroundColor: t.colors.bgCard,
                  borderRadius: 18,
                  padding: t.spacing.lg,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: t.colors.border,
                },
                t.shadow('card'),
              ]}
            >
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
                No pending requisitions. All clear!
              </Text>
            </View>
          ) : (
            <View
              style={[
                {
                  backgroundColor: t.colors.bgCard,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: t.colors.border,
                  overflow: 'hidden',
                },
                t.shadow('card'),
              ]}
            >
              {pending.map((r, idx) => {
                const isLast = idx === pending.length - 1;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => navigation.navigate('InternalOrders')}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: t.spacing.md,
                        paddingVertical: 14,
                        paddingHorizontal: t.spacing.lg,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: t.colors.border,
                        backgroundColor: pressed ? (t.darkMode ? '#2D3748' : '#F8F7FF') : 'transparent',
                      },
                    ]}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${t.colors.action.amber}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <ClipboardList size={20} color={t.colors.action.amber} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                        {r.product_name}
                      </Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>
                        Req #{r.request_number || String(r.id).slice(0, 8)} · Qty {r.quantity} {r.unit}
                      </Text>
                    </View>
                    <Badge tone="warning" label="Pending" size="xs" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Audit Panel */}
        <ApprovalHistoryPanel department="PRODUCTION" title="Recent Production Activity" />

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['Requisition']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
