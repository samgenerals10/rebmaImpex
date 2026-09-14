// rebma-mobile/screens/marketing/SalesHistoryScreen.tsx
// Ports: rebma-web/src/views/marketing/SalesHistoryView.tsx's "Sales
// History" tab — KPI tiles + trend chart + top customers/products +
// filterable order table. Data is the whole `orders` table, not scoped
// to Marketing's own submissions (confirmed by reading the source).
// Row press opens a read-only line-item detail, matching web's
// "Invoice Details" side panel. Web's paginated "Load more" is omitted —
// this screen fetches a capped recent set (300 rows), consistent with
// every other mobile list screen in this app.
//
// Export (Gap-Closure Backlog, Item 1): CSV only, matching web exactly —
// SalesHistoryView.tsx's own exportCSV() is a second, independent CSV
// implementation (not even exportToCSV) with no PDF path at all, so no
// PDF option is added here (D101 — don't invent a format web never had).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface OrderRow {
  id: string;
  ticket_number: string | null;
  client_name: string;
  product_name: string | null;
  total_amount: number;
  status: string;
  payment_mode: string;
  created_at: string;
  metadata: any;
}

export default function SalesHistoryScreen() {
  const t = useTheme();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState<'sales' | 'credit'>('sales');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, ticket_number, client_name, product_name, total_amount, status, payment_mode, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setOrders(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) map[o.client_name] = (map[o.client_name] || 0) + Number(o.total_amount || 0);
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);

  const bestMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const key = (o.created_at || '').slice(0, 7);
      if (!key) continue;
      map[key] = (map[key] || 0) + Number(o.total_amount || 0);
    }
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return { month: '—', revenue: 0 };
    const [key, revenue] = entries[0];
    const d = new Date(`${key}-01`);
    return { month: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), revenue };
  }, [orders]);

  // Credit tab — matches web's own SalesHistoryView.tsx exactly, incl. the
  // "Track" button, which is a fake local toast on web itself (addNotification
  // with no real navigation), not a working tracker.
  const creditOrders = useMemo(() => orders.filter((o) => o.payment_mode === 'CREDIT'), [orders]);
  const creditPending = creditOrders.filter((o) => ['PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(o.status)).length;
  const creditApproved = creditOrders.filter((o) => ['APPROVED', 'DELIVERED'].includes(o.status)).length;
  const creditRejected = creditOrders.filter((o) => o.status === 'REJECTED').length;
  const creditValue = creditOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch = !q || o.client_name.toLowerCase().includes(q) || (o.ticket_number || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const statusOptions = useMemo(() => {
    const set = new Set(orders.map((o) => o.status));
    return [{ value: 'ALL', label: 'All Status' }, ...Array.from(set).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))];
  }, [orders]);

  const columns: DataColumn<OrderRow>[] = [
    { key: 'client_name', label: 'Client', primary: true },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone={statusTone(o.status)} label={o.status.replace(/_/g, ' ')} /> },
    { key: 'ticket_number', label: 'Ticket', render: (o) => o.ticket_number || '—' },
    { key: 'total_amount', label: 'Amount', render: (o) => `GHS ${Number(o.total_amount || 0).toLocaleString()}` },
    { key: 'payment_mode', label: 'Payment', render: (o) => o.payment_mode || '—' },
  ];

  const items = detail?.metadata?.items || [];

  // Verbatim from SalesHistoryView.tsx:173-178's own exportCSV().
  const exportColumns: ExportColumn[] = [
    { key: 'Invoice#', label: 'Invoice#', render: (o) => o.ticket_number || o.id },
    { key: 'Customer', label: 'Customer', render: (o) => o.client_name },
    { key: 'Product', label: 'Product', render: (o) => o.product_name || '—' },
    { key: 'Amount', label: 'Amount', render: (o) => Number(o.total_amount || 0).toLocaleString() },
    { key: 'Payment', label: 'Payment', render: (o) => o.payment_mode || '—' },
    { key: 'Status', label: 'Status', render: (o) => o.status },
    { key: 'Date', label: 'Date', render: (o) => new Date(o.created_at).toLocaleDateString() },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', backgroundColor: t.colors.bgInput, borderRadius: t.radius.md, padding: 3 }}>
            {(['sales', 'credit'] as const).map((k) => (
              <Button key={k} label={k === 'sales' ? 'Sales History' : `Credit (${creditOrders.length})`} size="sm" variant={tab === k ? 'primary' : 'ghost'} onPress={() => setTab(k)} style={{ borderWidth: 0 }} />
            ))}
          </View>
          {tab === 'sales' && <Button label="Export CSV" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />}
        </View>

        {tab === 'sales' ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
              <View style={{ width: '47%' }}><MetricCard label="Total Revenue" value={loading ? '—' : `GHS ${totalRevenue.toLocaleString()}`} tone="accent" /></View>
              <View style={{ width: '47%' }}><MetricCard label="Completed Orders" value={loading ? '—' : deliveredCount} /></View>
              <View style={{ width: '47%' }}><MetricCard label="Avg Order Value" value={loading ? '—' : `GHS ${avgOrderValue.toFixed(0)}`} /></View>
              <View style={{ width: '47%' }}><MetricCard label="Best Month" value={loading ? '—' : bestMonth.month} sublabel={loading ? undefined : `GHS ${bestMonth.revenue.toLocaleString()}`} /></View>
            </View>

            {!loading && topCustomers.length > 0 && (
              <Card>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Top Customers</Text>
                <BarChart data={topCustomers.map(([name, amount]) => ({ label: name, value: amount, formattedValue: `GHS ${amount.toLocaleString()}` }))} />
              </Card>
            )}

            <Input value={search} onChangeText={setSearch} placeholder="Search orders…" />
            <SearchablePicker label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
            <DataList columns={columns} data={filtered} rowKey={(o) => o.id} loading={loading} emptyTitle="No orders found" onRowPress={setDetail} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
              <View style={{ width: '47%' }}><MetricCard label="Total Credit Requests" value={loading ? '—' : creditOrders.length} /></View>
              <View style={{ width: '47%' }}><MetricCard label="Pending" value={loading ? '—' : creditPending} tone="warning" /></View>
              <View style={{ width: '47%' }}><MetricCard label="Approved" value={loading ? '—' : creditApproved} tone="accent" /></View>
              <View style={{ width: '47%' }}><MetricCard label="Rejected" value={loading ? '—' : creditRejected} tone="danger" /></View>
            </View>

            {creditValue > 0 && (
              <Card style={{ backgroundColor: t.colors.status.warning.bg, borderColor: t.colors.status.warning.text + '40' }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.status.warning.text }}>
                  Total credit value outstanding: <Text style={{ fontFamily: t.font.extrabold }}>GHS {creditValue.toLocaleString()}</Text>
                </Text>
              </Card>
            )}

            <Card>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Credit Requests ({creditOrders.length})</Text>
              {creditOrders.length === 0 ? (
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No credit requests found.</Text>
              ) : (
                <View style={{ gap: t.spacing.sm }}>
                  {creditOrders.map((o) => (
                    <View key={o.id} style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, padding: t.spacing.md, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.label9.size, color: t.colors.textMuted }}>{o.ticket_number || o.id}</Text>
                        <Badge tone={statusTone(o.status)} label={o.status.replace(/_/g, ' ')} size="xs" />
                      </View>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{o.client_name}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.label9.size, color: t.colors.textMuted }}>{o.product_name || '—'} · Submitted {(o.created_at || '').slice(0, 10)}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.status.success.text }}>GHS {Number(o.total_amount || 0).toLocaleString()}</Text>
                        <Button label="Track" size="sm" variant="ghost" onPress={() => Alert.alert('Tracking', `Tracking order ${o.ticket_number || o.id}.`)} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.client_name} subtitle={detail?.ticket_number || undefined} side="bottom" maxHeight={600}>
        {detail && (
          <>
            <SheetSection label="Order Summary">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Status: {detail.status.replace(/_/g, ' ')}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Payment: {detail.payment_mode}</Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }}>Total: GHS {Number(detail.total_amount || 0).toLocaleString()}</Text>
            </SheetSection>
            {items.length > 0 && (
              <SheetSection label="Line Items">
                {items.map((item: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{item.productName} × {item.quantity}</Text>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {Number(item.lineTotal || 0).toLocaleString()}</Text>
                  </View>
                ))}
              </SheetSection>
            )}
          </>
        )}
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Sales History"
        data={filtered}
        columns={exportColumns}
        formats={['csv']}
      />
    </Screen>
  );
}
