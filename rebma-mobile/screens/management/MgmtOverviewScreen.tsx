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
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';

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
      // FIX: was checking PENDING_MANAGEMENT_APPROVAL, a status the real
      // cargo pipeline stopped writing once Risk took over cargo approval
      // entirely (Phase 1/9 reform) — this always read 0 regardless of
      // how much cargo was actually pending. The real status is
      // PENDING_RISK_APPROVAL; Management can see this count but doesn't
      // act on it (Risk owns the approval), hence read-only awareness.
      supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_RISK_APPROVAL'),
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

  // Cargo intentionally excluded — Risk owns cargo approval entirely
  // (Phase 1/9 reform), so it's not an "Executive Approval" Management
  // acts on. Counting it here would inflate this total with something
  // tapping through leads nowhere actionable for Management.
  const totalApprovals = ordersCount + productionCount + purchasesCount + floatCount;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>

        <PendingApprovalsAlertCard department="MANAGEMENT" onNavigate={(tab) => navigation.navigate(tab)} />

        {/* Management Executive Desk snapshot — two clickable tiles, not
            one oversized banner (per direct correction: a full-bleed
            color block that does nothing on tap doesn't belong in a
            mobile app). */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone={totalApprovals > 0 ? 'warning' : 'accent'}
              label="Action Items"
              value={loading ? '—' : totalApprovals}
              sublabel={totalApprovals === 0 ? 'All lanes clear' : 'Awaiting sign-off'}
              icon={<Layers size={18} color={totalApprovals > 0 ? t.colors.status.warning.text : t.colors.accent} />}
              onPress={() => navigation.navigate('CreditApproval')}
            />
          </View>
          <View style={{ flex: 1 }}>
            {/* Risk owns cargo APPROVAL, but Management still has a real,
                actionable next step once cargo's approved: setting its
                selling price. SetPricesScreen already computes
                unpricedGoods (APPROVED cargo vs. goods_prices) and shows
                a live "N approved products need a price" banner — that's
                the real destination, not a passive log. */}
            <MetricCard
              emphasis="primary"
              tone="info"
              label="Cargo Intake"
              value={loading ? '—' : cargoCount}
              sublabel="Port arrivals"
              icon={<Package size={18} color={t.colors.status.info.text} />}
              onPress={() => navigation.navigate('SetPrices')}
            />
          </View>
        </View>

        {/* 4 Approval Lanes — cargo removed (Risk owns that approval
            entirely, it was never an Executive Decision Lane), reflowed
            to a clean 2x2 instead of the old 3+2-with-a-spacer layout. */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Executive Decision Lanes" subtitle="4 critical operational sign-off queues" />
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Cust. Credit"
                value={loading ? '—' : ordersCount}
                sublabel="Escalated"
                icon={<CreditCard size={14} color={t.colors.action.violet} />}
                tone={ordersCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('CreditApproval')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Production"
                value={loading ? '—' : productionCount}
                sublabel="Raw material"
                icon={<Factory size={14} color={t.colors.action.teal} />}
                tone={productionCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('CreditApproval')}
              />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Purchases"
                value={loading ? '—' : purchasesCount}
                sublabel="Expenses"
                icon={<ShoppingCart size={14} color={t.colors.action.amber} />}
                tone={purchasesCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('CreditApproval')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Petty Float"
                value={loading ? '—' : floatCount}
                sublabel="Replenishment"
                icon={<Wallet size={14} color={t.colors.action.rose} />}
                tone={floatCount > 0 ? 'warning' : 'neutral'}
                onPress={() => navigation.navigate('CreditApproval')}
              />
              </View>
            </View>
          </View>
        </View>

        {totalApprovals > 0 && (
          <Button
            label={`Review ${totalApprovals} Executive Approvals →`}
            onPress={() => navigation.navigate('CreditApproval')}
            fullWidth
          />
        )}

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['CargoApproval']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
