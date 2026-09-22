// rebma-mobile/screens/marketing/OverviewScreen.tsx
// Ports: rebma-web/src/views/marketing/OverviewView.tsx (746 lines)
// Redesigned with Aczone Design System v2:
//   - Collapsible floating header via useCollapsibleHeader
//   - Horizontal Segmented Pill Tabs for hub section filtering
//   - Hero Card, 2x2 Metric Grid, Aczone Compact Data Cards
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingCart, Users, TrendingUp, CreditCard, Clock, Package, Tag, ArrowRight, History } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { outstandingCreditFor, type OrderLike, type CustomerLike } from '../../utils/customerRating';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import MetricCard from '../../components/ui/MetricCard';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';
import Tabs from '../../components/ui/Tabs';
import Badge, { statusTone } from '../../components/ui/Badge';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import IconActionButton from '../../components/ui/IconActionButton';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';
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
  { value: 'overview', label: 'Overview' },
  { value: 'orders', label: 'Orders' },
  { value: 'clients', label: 'Clients' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'tools', label: 'All Tools' },
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
  const [timelineTarget, setTimelineTarget] = useState<OrderRow | null>(null);

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

  const ordersColumns: DataColumn<OrderRow>[] = [
    { key: 'client_name', label: 'Client', primary: true, render: (o) => o.client_name || 'Walk-in' },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone={statusTone(o.status)} label={o.status || '—'} size="xs" /> },
    { key: 'total_amount', label: 'Amount', render: (o) => `GHS ${Number(o.total_amount || 0).toLocaleString()}` },
    { key: 'payment_mode', label: 'Payment', render: (o) => o.payment_mode || '—' },
    { key: 'created_at', label: 'Date', render: (o) => (o.created_at ? new Date(o.created_at).toLocaleDateString() : '—') },
  ];

  const clientsColumns: DataColumn<CustomerRow>[] = [
    { key: 'name', label: 'Name', primary: true },
    {
      key: 'outstanding', label: 'Outstanding', status: true,
      render: (c) => {
        const owed = outstandingCreditFor(orders, c);
        return <Badge tone={owed > 0 ? 'warning' : 'success'} label={owed > 0 ? `GHS ${owed.toLocaleString()}` : 'Clear'} size="xs" />;
      },
    },
  ];

  return (
    <Screen
      padded={false}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      {/* ── Pill Tab Filter Bar ── */}
      <View
        style={{
          backgroundColor: t.colors.bgHeader,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.border,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.sm,
        }}
      >
        <Tabs
          variant="chips"
          options={HUB_TABS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      <View style={{ gap: t.spacing.xl, padding: t.spacing.lg }}>
        {activeTab === 'overview' && (
          <>
            {/* Marketing & Sales snapshot — two clickable tiles, not one
                oversized banner (per direct correction: a full-bleed color
                block that does nothing on tap doesn't belong in a mobile app). */}
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <MetricCard
                  emphasis="primary"
                  tone="accent"
                  label="Active Orders"
                  value={loading ? '—' : activeCount}
                  sublabel={`${orders.length} total orders`}
                  icon={<TrendingUp size={18} color={t.colors.accent} />}
                  onPress={() => setActiveTab('orders')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <MetricCard
                  emphasis="primary"
                  tone="info"
                  label="Clients"
                  value={loading ? '—' : customers.length}
                  sublabel="Registered customers"
                  icon={<Users size={18} color={t.colors.status.info.text} />}
                  onPress={() => setActiveTab('clients')}
                />
              </View>
            </View>

            {/* Key Metrics — 4 across, per direct correction */}
            <View style={{ gap: t.spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <View style={{ flex: 1 }}>
                <MetricCard
                  emphasis="compact"
                  label="Pending"
                  value={loading ? '—' : pendingCount}
                  sublabel="Approvals"
                  icon={<Clock size={14} color={t.colors.action.amber} />}
                  tone="warning"
                  onPress={() => navigation.navigate('CreditRequests')}
                />
                </View>
                <View style={{ flex: 1 }}>
                <MetricCard
                  emphasis="compact"
                  label="Clients"
                  value={loading ? '—' : customers.length}
                  sublabel="Directory"
                  icon={<Users size={14} color={t.colors.action.blue} />}
                  tone="info"
                  onPress={() => setActiveTab('clients')}
                />
                </View>
                <View style={{ flex: 1 }}>
                <MetricCard
                  emphasis="compact"
                  label="Credit"
                  value={loading ? '—' : `GHS ${(totalCredit / 1000).toFixed(1)}k`}
                  sublabel="Receivables"
                  icon={<CreditCard size={14} color={t.colors.action.rose} />}
                  tone="danger"
                  onPress={() => navigation.navigate('CreditRequests')}
                />
                </View>
                <View style={{ flex: 1 }}>
                <MetricCard
                  emphasis="compact"
                  label="Catalog"
                  value={loading ? '—' : `${products.length}`}
                  sublabel="Products"
                  icon={<Tag size={14} color={t.colors.action.emerald} />}
                  tone="success"
                  onPress={() => setActiveTab('pricing')}
                />
                </View>
              </View>
            </View>

            {/* ── Quick Action Tiles ── */}
            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader title="Quick Actions" subtitle="Create orders or register new clients" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {[
                  { label: 'New Order', action: () => navigation.navigate('CreateOrder'), icon: ShoppingCart, color: '#10B981' },
                  { label: 'Register Client', action: () => navigation.navigate('RegisterCustomer'), icon: Users, color: '#3B82F6' },
                  { label: 'Sales History', action: () => setActiveTab('orders'), icon: TrendingUp, color: '#8B5CF6' },
                  { label: 'Credit Request', action: () => navigation.navigate('CreditRequests'), icon: CreditCard, color: '#F43F5E' },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <Pressable
                      key={a.label}
                      onPress={a.action}
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
          </>
        )}

        {activeTab === 'orders' && (
          <View style={{ gap: t.spacing.sm }}>
            <SectionHeader title="Orders" subtitle={`${orders.length} total`} />
            <DataList
              collapsible
              columns={ordersColumns}
              data={[...orders].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))}
              rowKey={(o) => o.id}
              loading={loading}
              emptyTitle="No orders yet"
              renderActions={(o) => (
                <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
                  <IconActionButton icon={History} tone="info" accessibilityLabel="View Timeline" onPress={() => setTimelineTarget(o)} />
                </View>
              )}
            />
          </View>
        )}

        {activeTab === 'clients' && (
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Clients" subtitle={`${customers.length} registered`} />
              <Pressable onPress={() => navigation.navigate('RegisterCustomer')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>Manage</Text>
                <ArrowRight size={14} color={t.colors.accent} />
              </Pressable>
            </View>
            <DataList
              collapsible
              columns={clientsColumns}
              data={customers}
              rowKey={(c) => c.id}
              loading={loading}
              emptyTitle="No clients registered yet"
            />
          </View>
        )}

        {/* ── Aczone Compact Data Cards: Featured Pricing ── */}
        {activeTab === 'pricing' && (
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Active Products & Pricing" subtitle="Official approved catalog price sheet" />
              <Pressable onPress={() => navigation.navigate('PriceCatalog')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>View all</Text>
                <ArrowRight size={14} color={t.colors.accent} />
              </Pressable>
            </View>
            {products.length > 0 ? (
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
            ) : (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No priced products yet.</Text>
            )}
          </View>
        )}

        {/* ── Grouped Action Hub ── */}
        {activeTab === 'tools' && (
          <ModuleLauncher dept={dept} exclude={['Overview']} onSelect={(id) => navigation.navigate(id)} />
        )}
      </View>

      <RequestTimelineSheet
        open={!!timelineTarget}
        onClose={() => setTimelineTarget(null)}
        referenceId={timelineTarget?.id || ''}
      />
    </Screen>
  );
}
