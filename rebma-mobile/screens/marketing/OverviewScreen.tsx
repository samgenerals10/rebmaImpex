// rebma-mobile/screens/marketing/OverviewScreen.tsx
// Ports: rebma-web/src/views/marketing/OverviewView.tsx (746 lines) — real
// live-query aggregates (orders/customers/goods_prices_catalog/stock),
// confirmed no mock-seeded chart chrome here (unlike some other
// departments' Overview dashboards) except two cosmetic hardcoded delta
// labels (+14.2%, +8.2%) which are fake strings, not computed — not
// ported. Web's realtime subscription (orders/stock/goods_prices) is
// dropped for the same reason TrackingScreen's D8 dropped one — a plain
// fetch on mount/refresh is this app's established mobile pattern; "Quick
// Actions" are pure navigation (no inline forms on web either), and the
// module launcher (D13) covers the same "get to any sub-tab" job.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingCart, Users, TrendingUp, CreditCard } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { outstandingCreditFor, type OrderLike, type CustomerLike } from '../../utils/customerRating';
import { useTheme } from '../../theme/ThemeProvider';
import { useUIStore } from '../../store/uiStore';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

interface OrderRow extends OrderLike {
  id: string;
}
interface CustomerRow extends CustomerLike {}
interface ProductRow {
  product_name: string;
  unit_price: number;
}

const QUICK_ACTIONS = [
  { label: 'New Order', subTab: 'CreateOrder', icon: ShoppingCart },
  { label: 'Add Customer', subTab: 'RegisterCustomer', icon: Users },
  { label: 'View Orders', subTab: 'SalesHistory', icon: TrendingUp },
  { label: 'Credit Request', subTab: 'CreditRequests', icon: CreditCard },
];

export default function OverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const dept = getDepartmentEntry(activeDepartment || 'MARKETING');

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Pending Orders" value={loading ? '—' : pendingCount} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Active Orders" value={loading ? '—' : activeCount} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Customers" value={loading ? '—' : customers.length} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Credit Outstanding" value={loading ? '—' : `GHS ${totalCredit.toLocaleString()}`} tone="danger" /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Quick Actions</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <View key={a.subTab} style={{ width: '47%' }}>
                  <Button variant="ghost" icon={<Icon size={14} color={t.colors.textSecondary} />} label={a.label} onPress={() => navigation.navigate(a.subTab)} fullWidth />
                </View>
              );
            })}
          </View>
        </Card>

        {products.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Products Available to Sell</Text>
            <View style={{ gap: t.spacing.sm }}>
              {products.map((p) => (
                <View key={p.product_name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: t.spacing.xs, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{p.product_name}</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {Number(p.unit_price || 0).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <ModuleLauncher dept={dept} exclude={['Overview']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
