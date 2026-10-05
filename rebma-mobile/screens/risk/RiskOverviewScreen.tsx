// rebma-mobile/screens/risk/RiskOverviewScreen.tsx
// Ports: rebma-web/src/views/risk/RiskDashboard.tsx
// Redesigned with Aczone Design System: Hero Card, Metric Grids, Action Buttons, Linear grouped launcher.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, CreditCard, Camera, UserCheck, ShieldAlert, ShieldCheck, CheckCircle2, XCircle, ClipboardCheck, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';

export default function RiskOverviewScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('RISK');

  const [cargoCount, setCargoCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [finalReleaseCount, setFinalReleaseCount] = useState(0);
  const [podCount, setPodCount] = useState(0);
  const [customersPendingCount, setCustomersPendingCount] = useState(0);
  const [creditWatchCount, setCreditWatchCount] = useState(0);
  const [approvedToday, setApprovedToday] = useState(0);
  const [rejectedToday, setRejectedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [cargo, orders, finalRelease, pod, customersPending, todayLogs, onHoldCustomers, limitedCustomers, creditOrders] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_APPROVAL'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_RELEASE'),
      supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_REVIEW'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'PENDING').then((r) => r, () => ({ count: 0 })),
      supabase.from('global_audit_history').select('action').eq('department', 'RISK')
        .gte('timestamp', `${today}T00:00:00.000Z`).lte('timestamp', `${today}T23:59:59.999Z`),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('credit_status', 'ON_HOLD').then((r) => r, () => ({ count: 0 })),
      supabase.from('customers').select('id, credit_limit').not('credit_limit', 'is', null).then((r) => r, () => ({ data: [] as any[] })),
      supabase.from('orders').select('customer_id, client_name, total_amount, amount_paid').eq('payment_mode', 'CREDIT')
        .not('status', 'in', '(REJECTED,CANCELLED,RETURNED_FOR_CORRECTION)').then((r) => r, () => ({ data: [] as any[] })),
    ]);

    setCargoCount(cargo.count || 0);
    setOrdersCount(orders.count || 0);
    setFinalReleaseCount(finalRelease.count || 0);
    setPodCount(pod.count || 0);
    setCustomersPendingCount((customersPending as any).count || 0);

    const logs = todayLogs.data || [];
    setApprovedToday(logs.filter((r: any) => String(r.action).startsWith('APPROVE')).length);
    setRejectedToday(logs.filter((r: any) => String(r.action).startsWith('REJECT')).length);

    const onHoldCount = (onHoldCustomers as any).count || 0;
    let overLimitCount = 0;
    for (const c of (limitedCustomers as any).data || []) {
      const limit = Number(c.credit_limit) || 0;
      const outstanding = ((creditOrders as any).data || [])
        .filter((o: any) => o.customer_id === c.id)
        .reduce((s: number, o: any) => s + Math.max(Number(o.total_amount || 0) - Number(o.amount_paid || 0), 0), 0);
      if (outstanding >= limit) overLimitCount += 1;
    }
    setCreditWatchCount(onHoldCount + overLimitCount);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPending = customersPendingCount + cargoCount + ordersCount + finalReleaseCount + podCount;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        <PendingApprovalsAlertCard department="RISK" onNavigate={(tab) => navigation.navigate(tab)} />

        {/* Risk & Compliance snapshot — two clickable tiles, not one
            oversized banner (per direct correction: a full-bleed color
            block that does nothing on tap doesn't belong in a mobile app). */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone={totalPending > 0 ? 'warning' : 'accent'}
              label="Pending Review"
              value={loading ? '—' : totalPending}
              sublabel="Across all queues"
              icon={<ShieldAlert size={18} color={totalPending > 0 ? t.colors.status.warning.text : t.colors.accent} />}
              onPress={() => navigation.navigate('RiskApprovals')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone="success"
              label="Reviewed Today"
              value={loading ? '—' : approvedToday + rejectedToday}
              sublabel={`${approvedToday} verified, ${rejectedToday} rejected`}
              icon={<CheckCircle2 size={18} color={t.colors.status.success.text} />}
              onPress={() => navigation.navigate('DeptActivity')}
            />
          </View>
        </View>

        {/* Verification Lanes — 4 across and wrapping, per direct correction */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Verification Lanes" subtitle="Active compliance queues requiring sign-off" />
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Cargo Intake"
                value={loading ? '—' : cargoCount}
                sublabel="Port arrival"
                icon={<Package size={14} color={t.colors.action.sky} />}
                tone={cargoCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('RiskApprovals')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Initial Orders"
                value={loading ? '—' : ordersCount}
                sublabel="First review"
                icon={<CreditCard size={14} color={t.colors.action.violet} />}
                tone={ordersCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('RiskApprovals')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Final Release"
                value={loading ? '—' : finalReleaseCount}
                sublabel="Outbound gate"
                icon={<ShieldCheck size={14} color={t.colors.action.rose} />}
                tone={finalReleaseCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('RiskApprovals')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Delivery PODs"
                value={loading ? '—' : podCount}
                sublabel="POD audit"
                icon={<Camera size={14} color={t.colors.action.teal} />}
                tone={podCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('RiskApprovals')}
              />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Customer KYC"
                value={loading ? '—' : customersPendingCount}
                sublabel="New accounts"
                icon={<UserCheck size={14} color={t.colors.action.amber} />}
                tone={customersPendingCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('RiskApprovals')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Credit Watch"
                value={loading ? '—' : creditWatchCount}
                sublabel="Over limit"
                icon={<ShieldAlert size={14} color={t.colors.status.danger.text} />}
                tone={creditWatchCount > 0 ? 'danger' : 'neutral'}
                onPress={() => navigation.navigate('CustomerCredit')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Approved"
                value={loading ? '—' : approvedToday}
                sublabel="Today"
                tone="success"
                icon={<CheckCircle2 size={14} color={t.colors.action.emerald} />}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Rejected"
                value={loading ? '—' : rejectedToday}
                sublabel="Today"
                tone={rejectedToday > 0 ? 'danger' : 'neutral'}
                icon={<XCircle size={14} color={t.colors.action.rose} />}
              />
              </View>
            </View>
          </View>
        </View>

        {/* Quick CTA */}
        {totalPending > 0 && (
          <Button
            label={`Review ${totalPending} Pending Approvals`}
            onPress={() => navigation.navigate('RiskApprovals')}
            fullWidth
          />
        )}

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['RiskOverview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
