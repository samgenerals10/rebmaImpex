// rebma-mobile/screens/marketing/CreditRequestsScreen.tsx
// Ports: rebma-web/src/views/marketing/CreditRequestsView.tsx — read-only.
// No dedicated table: derived entirely from orders where
// payment_mode = 'CREDIT'. Status is a client-side mapping of the raw
// order status (confirmed by reading the source): COMPLETED→Completed,
// REJECTED→Rejected, APPROVED→'Management Approved', else 'Pending
// Management'. Marketing takes NO actions here — pure view of orders
// already pending Risk/Management/Finance decisions elsewhere.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Sheet, { SheetSection } from '../../components/ui/Sheet';

interface OrderRow {
  id: string;
  client_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  phone: string | null;
  metadata: any;
}

function creditStatusLabel(status: string) {
  if (status === 'COMPLETED' || status === 'DELIVERED') return 'Completed';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'APPROVED') return 'Management Approved';
  return 'Pending Management';
}
function creditStatusTone(status: string): 'success' | 'danger' | 'info' | 'warning' {
  if (status === 'COMPLETED' || status === 'DELIVERED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'APPROVED') return 'info';
  return 'warning';
}

export default function CreditRequestsScreen() {
  const t = useTheme();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<OrderRow | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, client_name, total_amount, status, created_at, phone, metadata')
      .eq('payment_mode', 'CREDIT')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setOrders(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => !q || o.client_name.toLowerCase().includes(q));
  }, [orders, search]);

  const columns: DataColumn<OrderRow>[] = [
    { key: 'client_name', label: 'Customer', primary: true },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone={creditStatusTone(o.status)} label={creditStatusLabel(o.status)} /> },
    { key: 'total_amount', label: 'Amount', render: (o) => `GHS ${Number(o.total_amount || 0).toLocaleString()}` },
    { key: 'created_at', label: 'Date', render: (o) => new Date(o.created_at).toLocaleDateString() },
  ];

  const ghanaCardFront = detail?.metadata?.ghana_card_front;
  const ghanaCardBack = detail?.metadata?.ghana_card_back;
  const customerPhoto = detail?.metadata?.customer_photo;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search customers…" />
        <DataList columns={columns} data={filtered} rowKey={(o) => o.id} loading={loading} emptyTitle="No credit requests found" onRowPress={setDetail} />
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.client_name} subtitle={detail ? creditStatusLabel(detail.status) : undefined} side="bottom" maxHeight={600}>
        {detail && (
          <>
            <SheetSection label="Request Summary">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Phone: {detail.phone || '—'}</Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }}>Amount: GHS {Number(detail.total_amount || 0).toLocaleString()}</Text>
            </SheetSection>
            {(ghanaCardFront || ghanaCardBack || customerPhoto) && (
              <SheetSection label="Identification on File">
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>Photo taken at order creation</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {ghanaCardFront && <Image source={{ uri: ghanaCardFront }} style={{ width: 100, height: 70, borderRadius: t.radius.sm }} resizeMode="cover" />}
                  {ghanaCardBack && <Image source={{ uri: ghanaCardBack }} style={{ width: 100, height: 70, borderRadius: t.radius.sm }} resizeMode="cover" />}
                  {customerPhoto && <Image source={{ uri: customerPhoto }} style={{ width: 70, height: 70, borderRadius: t.radius.sm }} resizeMode="cover" />}
                </View>
              </SheetSection>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}
