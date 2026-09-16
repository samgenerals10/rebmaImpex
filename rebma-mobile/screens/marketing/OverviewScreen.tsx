// rebma-mobile/screens/marketing/OverviewScreen.tsx
// Ports: rebma-web/src/views/marketing/OverviewView.tsx (746 lines)
// Redesigned with Aczone Design System v2:
//   - Collapsible floating header via useCollapsibleHeader
//   - Horizontal Segmented Pill Tabs for hub section filtering
//   - Hero Card, 2x2 Metric Grid, Aczone Compact Data Cards
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Animated, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingCart, Users, TrendingUp, CreditCard, Clock, Package, Tag, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { outstandingCreditFor, type OrderLike, type CustomerLike } from '../../utils/customerRating';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';
import SegmentedPillTabs from '../../components/ui/SegmentedPillTabs';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';

interface OrderRow extends OrderLike {
  id: string;
}
interface CustomerRow extends CustomerLike {}
interface ProductRow {
  product_name: string;
  unit_price: number;
}

const HUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'clients', label: 'Clients' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'tools', label: 'All Tools' },
];

export default function OverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const dept = getDepartmentEntry(activeDepartment || 'MARKETING');
  const { scrollHandler } = useCollapsibleHeader();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    const [ordersRes, customersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status, created_at'),
      supabase.from('customers').select('id, name'),
      supabase.from('goods_prices_catalog').select('product_name, unit_price').order('product_name').limit(6),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    if (customersRes.data) setCustomers(customersRes.data as any);
    if (productsRes.data) setProducts(productsRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = orders.filter((o) => ['PENDING_FINANCE', 'PENDING_MANAGEMENT', 'PENDING_RISK'].includes(o.status || '')).length;
  const activeCount = orders.filter((o) => o.status === 'PROCESSING' || o.status === 'DELIVERED').length;
  const totalCredit = customers.reduce((s, c) => s + outstandingCreditFor(orders, c), 0);

  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bgPage }}
      contentContainerStyle={{ paddingBottom: 40 }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={t.colors.accent}
          colors={[t.colors.accent]}
        />
      }
    >
      {/* ── Pill Tab Filter Bar ── */}
      <View
        style={{
          backgroundColor: t.colors.bgHeader,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.border,
        }}
      >
        <SegmentedPillTabs
          tabs={HUB_TABS}
          active={activeTab}
          onChange={setActiveTab}
        />
      </View>

      <View style={{ gap: t.spacing.xl, padding: t.spacing.lg }}>
        {/* ── Hero Card ── */}
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Marketing & Sales Live Hub
                </Text>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: '#FFFFFF', marginTop: 2 }}>
                {loading ? '—' : activeCount}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {loading ? '' : `${customers.length} registered client${customers.length === 1 ? '' : 's'} · ${orders.length} total orders`}
              </Text>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>

        {/* ── Aczone 2×2 Metric Grid ── */}
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Pending Review"
              value={loading ? '—' : pendingCount}
              sublabel="Awaiting approvals"
              icon={<Clock size={20} color={t.colors.action.amber} />}
              tone="warning"
              onPress={() => navigation.navigate('CreditRequests')}
            />
            <MetricCard
              label="Active Clients"
              value={loading ? '—' : customers.length}
              sublabel="Directory list"
              icon={<Users size={20} color={t.colors.action.blue} />}
              tone="info"
              onPress={() => navigation.navigate('RegisterCustomer')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Credit Exposure"
              value={loading ? '—' : `GHS ${(totalCredit / 1000).toFixed(1)}k`}
              sublabel="Outstanding receivables"
              icon={<CreditCard size={20} color={t.colors.action.rose} />}
              tone="danger"
              onPress={() => navigation.navigate('CreditRequests')}
            />
            <MetricCard
              label="Price Catalog"
              value={loading ? '—' : `${products.length} Items`}
              sublabel="Active product rates"
              icon={<Tag size={20} color={t.colors.action.emerald} />}
              tone="success"
              onPress={() => navigation.navigate('PriceCatalog')}
            />
          </View>
        </View>

        {/* ── Quick Action Tiles ── */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Quick Actions" subtitle="Create orders or register new clients" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {[
              { label: 'New Order', subTab: 'CreateOrder', icon: ShoppingCart, color: '#10B981' },
              { label: 'Register Client', subTab: 'RegisterCustomer', icon: Users, color: '#3B82F6' },
              { label: 'Sales History', subTab: 'Overview', icon: TrendingUp, color: '#8B5CF6' },
              { label: 'Credit Request', subTab: 'CreditRequests', icon: CreditCard, color: '#F43F5E' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Pressable
                  key={a.label}
                  onPress={() => navigation.navigate(a.subTab)}
                  style={({ pressed }) => [
                    {
                      width: '48.5%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.spacing.sm,
                      backgroundColor: t.colors.bgCard,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: t.colors.border,
                      paddingVertical: 14,
                      paddingHorizontal: t.spacing.md,
                      opacity: pressed ? 0.85 : 1,
                    },
                    t.shadow('card'),
                  ]}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${a.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color={a.color} strokeWidth={2.2} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Aczone Compact Data Cards: Featured Pricing ── */}
        {products.length > 0 && (
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Active Products & Pricing" subtitle="Official approved catalog price sheet" />
              <Pressable onPress={() => navigation.navigate('PriceCatalog')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>View all</Text>
                <ArrowRight size={14} color={t.colors.accent} />
              </Pressable>
            </View>
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
              {products.map((p, idx) => {
                const isLast = idx === products.length - 1;
                return (
                  <View
                    key={p.product_name}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.spacing.md,
                      paddingVertical: 12,
                      paddingHorizontal: t.spacing.lg,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: t.colors.border,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${t.colors.accent}14`, alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={18} color={t.colors.accent} strokeWidth={2} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary }} numberOfLines={1}>
                      {p.product_name}
                    </Text>
                    <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.darkMode ? '#2D3748' : '#F3F4F6' }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
                        GHS {Number(p.unit_price || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Grouped Action Hub ── */}
        <ModuleLauncher dept={dept} exclude={['Overview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Animated.ScrollView>
  );
}
