// rebma-mobile/screens/management/MgmtOverviewScreen.tsx
// Ports: rebma-web/src/views/management/MgmtOverviewView.tsx
// Redesigned with Aczone Design System: Hero Card, 2x2 Metric Grid, Quick Action Hubs, Linear styling.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Package, CreditCard, Factory, ShoppingCart, Wallet, Layers, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';

export default function MgmtOverviewScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
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

  const totalApprovals = cargoCount + ordersCount + productionCount + purchasesCount + floatCount;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        <PendingApprovalsAlertCard department="MANAGEMENT" onNavigate={(tab) => navigation.navigate(tab)} />

        {/* Aczone Management Hero Card */}
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: totalApprovals > 0 ? '#FBBF24' : '#34D399' }} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Management Executive Desk
                </Text>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: '#FFFFFF', marginTop: 2 }}>
                {loading ? '—' : totalApprovals}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {loading ? '' : `${totalApprovals === 0 ? 'All 5 approval lanes clear' : `${totalApprovals} action item${totalApprovals === 1 ? '' : 's'} awaiting executive sign-off`}`}
              </Text>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>

        {/* 5 Approval Lanes Grid */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Executive Decision Lanes" subtitle="5 critical operational sign-off queues" />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Cargo Intake"
              value={loading ? '—' : cargoCount}
              sublabel="Port arrivals"
              icon={<Package size={20} color={t.colors.action.sky} />}
              tone={cargoCount > 0 ? 'warning' : 'neutral'}
              onPress={() => navigation.navigate('CreditApproval')}
            />
            <MetricCard
              label="Customer Credit"
              value={loading ? '—' : ordersCount}
              sublabel="Escalated orders"
              icon={<CreditCard size={20} color={t.colors.action.violet} />}
              tone={ordersCount > 0 ? 'warning' : 'neutral'}
              onPress={() => navigation.navigate('CreditApproval')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Production Req"
              value={loading ? '—' : productionCount}
              sublabel="Raw material batch"
              icon={<Factory size={20} color={t.colors.action.teal} />}
              tone={productionCount > 0 ? 'warning' : 'neutral'}
              onPress={() => navigation.navigate('CreditApproval')}
            />
            <MetricCard
              label="General Purchases"
              value={loading ? '—' : purchasesCount}
              sublabel="Merchant expenses"
              icon={<ShoppingCart size={20} color={t.colors.action.amber} />}
              tone={purchasesCount > 0 ? 'warning' : 'neutral'}
              onPress={() => navigation.navigate('CreditApproval')}
            />
          </View>
          <MetricCard
            label="Petty Float Requests"
            value={loading ? '—' : floatCount}
            sublabel="Cash replenishment approvals"
            icon={<Wallet size={20} color={t.colors.action.rose} />}
            tone={floatCount > 0 ? 'warning' : 'neutral'}
            onPress={() => navigation.navigate('CreditApproval')}
          />
        </View>

        {totalApprovals > 0 && (
          <Button
            label={`Review ${totalApprovals} Executive Approvals →`}
            onPress={() => navigation.navigate('CreditApproval')}
            fullWidth
          />
        )}

        {/* Audit Log Panel */}
        <ApprovalHistoryPanel department="MANAGEMENT" title="Recent Management Decisions" />

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['CargoApproval']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
