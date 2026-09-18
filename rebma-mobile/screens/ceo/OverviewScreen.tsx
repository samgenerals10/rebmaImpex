// rebma-mobile/screens/ceo/OverviewScreen.tsx
// Ports: rebma-web/src/views/CeoDashboard.tsx (889 lines) — condensed
// (D71) per the established Overview precedent (every prior department's
// home screen): 4 KPI tiles from cheap, real aggregate queries (Today's
// Orders, Today's Revenue, Active Supplier Orders, Deliveries In
// Transit), a Recent Orders list, a new CEO branch on
// PendingApprovalsAlertCard (registrations + price changes — the two
// lanes ApprovalsScreen/PriceApprovalsScreen own), and ModuleLauncher.
// Not a port of the 889-line dashboard's embedded fleet map / 3 chart
// types / live inventory grid / cargo-discrepancy panel — those either
// duplicate what Tracking/Accounts/other tabs already cover on mobile,
// or are exactly the chart-heavy content every prior condensed Overview
// screen has already declined to port.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingCart, DollarSign, ShoppingBag, Truck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import PendingApprovalsAlertCard from '../../components/shared/PendingApprovalsAlertCard';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';

interface RecentOrder { id: string; ticket_number: string | null; client_name: string | null; total_amount: number; status: string; created_at: string }

export default function OverviewScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('CEO');

  const [todayOrders, setTodayOrders] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [activeSupplierOrders, setActiveSupplierOrders] = useState(0);
  const [inTransit, setInTransit] = useState(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const [ordersTodayRes, paymentsTodayRes, supplierOrdersRes, deliveriesRes, recentRes] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('finance_payments').select('amount').gte('created_at', today),
      supabase.from('supplier_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '(received,completed)'),
      supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'OUT_FOR_DELIVERY'),
      supabase.from('orders').select('id, ticket_number, client_name, total_amount, status, created_at').order('created_at', { ascending: false }).limit(5),
    ]);
    setTodayOrders(ordersTodayRes.count || 0);
    setTodayRevenue((paymentsTodayRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0));
    setActiveSupplierOrders(supplierOrdersRes.count || 0);
    setInTransit(deliveriesRes.count || 0);
    setRecentOrders((recentRes.data as any) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        <PendingApprovalsAlertCard department="CEO" onNavigate={(tab) => navigation.navigate(tab)} />

        {/* Aczone Executive Revenue Hero Card */}
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Executive Financial Snapshot
                </Text>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: '#FFFFFF', marginTop: 2 }}>
                {loading ? '—' : `GHS ${todayRevenue.toLocaleString()}`}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {loading ? 'Synchronizing live...' : `${todayOrders} commercial order${todayOrders === 1 ? '' : 's'} recorded today`}
              </Text>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>

        {/* Aczone 2x2 Metric Grid */}
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Today's Orders"
              value={loading ? '—' : todayOrders}
              sublabel="Active commercial demand"
              icon={<ShoppingCart size={20} color={t.colors.action.blue} />}
              tone="info"
            />
            <MetricCard
              label="Supplier Orders"
              value={loading ? '—' : activeSupplierOrders}
              sublabel="Inbound vessel cargo"
              icon={<ShoppingBag size={20} color={t.colors.action.amber} />}
              tone="warning"
              onPress={() => navigation.navigate('SupplierOrders')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Fleet In Transit"
              value={loading ? '—' : inTransit}
              sublabel="Active road dispatches"
              icon={<Truck size={20} color={t.colors.action.sky} />}
              tone="info"
              onPress={() => navigation.navigate('Tracking')}
            />
          </View>
        </View>

        {/* Aczone Recent Orders Card Stream */}
        <View>
          <SectionHeader title="Recent Orders" subtitle="Live commercial sales activity stream" />
          <View style={{ gap: t.spacing.sm, marginTop: t.spacing.xs }}>
            {recentOrders.map((o) => (
              <View
                key={o.id}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.md,
                    backgroundColor: t.colors.bgCard,
                    borderRadius: 20,
                    padding: t.spacing.lg,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                  },
                  t.shadow('card'),
                ]}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={20} color={t.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.base16.size, color: t.colors.textPrimary }} numberOfLines={1}>
                    {o.client_name || o.ticket_number || 'Commercial Order'}
                  </Text>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    {o.ticket_number || o.id.slice(0, 8)} · GHS {Number(o.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
                <Badge tone="purple" label={(o.status || 'ACTIVE').replace(/_/g, ' ')} size="sm" />
              </View>
            ))}
            {recentOrders.length === 0 && !loading && (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.md }}>No orders yet.</Text>
            )}
          </View>
        </View>

        <ModuleLauncher dept={dept} exclude={['Overview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
