// rebma-mobile/screens/risk/RiskOverviewScreen.tsx
// Ports: rebma-web/src/views/risk/RiskDashboard.tsx (read in full) — 5 KPI
// tiles (Customers Awaiting Verification / Cargo / Orders / POD / Credit
// Watch) + 2 secondary tiles (Approved/Rejected Today), all from the exact
// same parallel count-only queries web runs. Embeds the new shared
// PendingApprovalsAlertCard + ApprovalHistoryPanel (D34/D35) plus the
// module launcher every department's home screen ends with (D13).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, CreditCard, Camera, UserCheck, ShieldAlert, ShieldCheck, CheckCircle, XCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

export default function RiskOverviewScreen() {
  const t = useTheme();
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

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <PendingApprovalsAlertCard department="RISK" onNavigate={(tab) => navigation.navigate(tab)} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}>
            <MetricCard label="Customer Verification" value={loading ? '—' : customersPendingCount} tone="warning" icon={<UserCheck size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('RiskApprovals')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Cargo Awaiting Review" value={loading ? '—' : cargoCount} tone="warning" icon={<Package size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('RiskApprovals')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Orders — Initial Review" value={loading ? '—' : ordersCount} tone="warning" icon={<CreditCard size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('RiskApprovals')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Orders — Final Release" value={loading ? '—' : finalReleaseCount} tone="danger" icon={<ShieldCheck size={16} color={t.colors.status.danger.text} />} onPress={() => navigation.navigate('RiskApprovals')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="POD to Review" value={loading ? '—' : podCount} tone="warning" icon={<Camera size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('RiskApprovals')} />
          </View>
          <View style={{ width: '100%' }}>
            <MetricCard label="Credit Watch" value={loading ? '—' : creditWatchCount} tone="danger" icon={<ShieldAlert size={16} color={t.colors.status.danger.text} />} onPress={() => navigation.navigate('CustomerCredit')} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <View style={{ flex: 1 }}><MetricCard label="Approved Today" value={loading ? '—' : approvedToday} tone="accent" icon={<CheckCircle size={16} color={t.colors.accent} />} /></View>
          <View style={{ flex: 1 }}><MetricCard label="Rejected Today" value={loading ? '—' : rejectedToday} tone="danger" icon={<XCircle size={16} color={t.colors.status.danger.text} />} /></View>
        </View>

        <Button label="Go to Approvals Queue" onPress={() => navigation.navigate('RiskApprovals')} fullWidth />

        <ApprovalHistoryPanel department="RISK" title="Recent Risk Decisions" />

        <ModuleLauncher dept={dept} exclude={['RiskOverview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
