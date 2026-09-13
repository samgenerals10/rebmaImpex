// rebma-mobile/screens/management/MgmtOverviewScreen.tsx
// Ports: rebma-web/src/views/management/MgmtOverviewView.tsx (1238 lines)
// — condensed (D38) to the same proportional shape every other
// department's Overview screen already uses: real KPI tiles (pending
// counts across the 5 approval lanes, reusing the same query shapes
// MgmtApprovalsScreen runs) + one real needs-attention list +
// PendingApprovalsAlertCard (new MANAGEMENT branch, D47) +
// ApprovalHistoryPanel + the module launcher. Not a port of the
// cashflow/revenue-modal dashboard.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, CreditCard, Factory, ShoppingCart, Wallet } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

export default function MgmtOverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('MANAGEMENT');

  const [cargoCount, setCargoCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [productionCount, setProductionCount] = useState(0);
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [floatCount, setFloatCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [cargo, orders, production, purchases, float] = await Promise.all([
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT'),
      supabase.from('production_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT').then((r) => r, () => ({ count: 0 })),
      supabase.from('general_purchases').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT_APPROVAL').then((r) => r, () => ({ count: 0 })),
      supabase.from('float_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_MANAGEMENT').then((r) => r, () => ({ count: 0 })),
    ]);
    setCargoCount(cargo.count || 0);
    setOrdersCount(orders.count || 0);
    setProductionCount((production as any).count || 0);
    setPurchasesCount((purchases as any).count || 0);
    setFloatCount((float as any).count || 0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <PendingApprovalsAlertCard department="MANAGEMENT" onNavigate={(tab) => navigation.navigate(tab)} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}>
            <MetricCard label="Cargo Intake" value={loading ? '—' : cargoCount} tone="warning" icon={<Package size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('CreditApproval')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Escalated Orders" value={loading ? '—' : ordersCount} tone="warning" icon={<CreditCard size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('CreditApproval')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Production Requests" value={loading ? '—' : productionCount} tone="warning" icon={<Factory size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('CreditApproval')} />
          </View>
          <View style={{ width: '47%' }}>
            <MetricCard label="General Purchases" value={loading ? '—' : purchasesCount} tone="warning" icon={<ShoppingCart size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('CreditApproval')} />
          </View>
          <View style={{ width: '100%' }}>
            <MetricCard label="Float Requests" value={loading ? '—' : floatCount} tone="warning" icon={<Wallet size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('CreditApproval')} />
          </View>
        </View>

        <ApprovalHistoryPanel department="MANAGEMENT" title="Recent Management Decisions" />

        <ModuleLauncher dept={dept} exclude={['CargoApproval']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
