// rebma-mobile/screens/finance/ReceiptsScreen.tsx
// Ports: rebma-web/src/views/finance/ReceiptsView.tsx — searchable list of
// past finance_payments. Web's row action opens a branded printable
// receipt (QR code, amount-in-words, popup + window.print()) — out of
// scope per D100 (mechanism 3, needs its own QR-rendering dependency
// decision); the record itself and its detail are fully preserved.
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 UniversalExportModal
// screens — CSV+PDF+DOC, branded, columns verbatim from ReceiptsView.tsx:279-290
// (tabular list export only — the QR-bearing single-receipt document stays
// out of scope, same as the print action above).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface PaymentRow {
  id: string;
  client_name: string | null;
  amount: number;
  payment_mode: string;
  payment_type: string | null;
  invoice_number: string | null;
  order_ref: string | null;
  order_id: string | null;
  receipt_number: string | null;
  recorded_by: string | null;
  status: string | null;
  created_at: string;
}

export default function ReceiptsScreen() {
  const t = useTheme();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<PaymentRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('finance_payments')
      .select('id, client_name, amount, payment_mode, payment_type, invoice_number, order_ref, order_id, receipt_number, recorded_by, status, created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setPayments(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => !q || (p.client_name || '').toLowerCase().includes(q) || (p.receipt_number || '').toLowerCase().includes(q));
  }, [payments, search]);

  const columns: DataColumn<PaymentRow>[] = [
    { key: 'client_name', label: 'Client', primary: true, render: (p) => p.client_name || '—' },
    { key: 'status', label: 'Status', status: true, render: (p) => <Badge tone={p.status === 'CONFIRMED' ? 'success' : 'muted'} label={p.status || 'CONFIRMED'} /> },
    { key: 'amount', label: 'Amount', render: (p) => `GHS ${Number(p.amount || 0).toLocaleString()}` },
    { key: 'payment_mode', label: 'Mode', render: (p) => (p.payment_mode || '').replace(/_/g, ' ') },
    { key: 'created_at', label: 'Date', render: (p) => new Date(p.created_at).toLocaleDateString() },
  ];

  // Verbatim from ReceiptsView.tsx:279-290, receiptNumber/ticketNumber
  // mapping matching that file's own fallback chain (:306-308).
  const exportColumns: ExportColumn[] = [
    { key: 'receiptNumber', label: 'Receipt #', render: (p) => p.receipt_number || p.invoice_number || p.id },
    { key: 'ticketNumber', label: 'Order Ticket', render: (p) => p.invoice_number || p.order_ref || '' },
    { key: 'client_name', label: 'Client', render: (p) => p.client_name || '' },
    { key: 'amount', label: 'Amount (GHS)', render: (p) => Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
    { key: 'payment_mode', label: 'Payment Mode' },
    { key: 'payment_type', label: 'Payment Type', render: (p) => p.payment_type || '' },
    { key: 'order_id', label: 'Order ID', render: (p) => p.order_id || '—' },
    { key: 'recorded_by', label: 'Recorded By', render: (p) => p.recorded_by || '—' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Date', render: (p) => new Date(p.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Search receipts…" />
        <DataList columns={columns} data={filtered} rowKey={(p) => p.id} loading={loading} emptyTitle="No payments recorded yet" onRowPress={setDetail} />
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.client_name || 'Receipt'} subtitle={detail?.receipt_number || detail?.invoice_number || undefined} side="bottom" maxHeight={520}>
        {detail && (
          <SheetSection label="Payment Details">
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.accent, marginBottom: t.spacing.sm }}>GHS {Number(detail.amount || 0).toLocaleString()}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Mode: {(detail.payment_mode || '').replace(/_/g, ' ')}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Type: {detail.payment_type || '—'}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Recorded by: {detail.recorded_by || '—'}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Date: {new Date(detail.created_at).toLocaleString()}</Text>
          </SheetSection>
        )}
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Receipts"
        data={filtered}
        columns={exportColumns}
        formats={['csv', 'pdf', 'doc']}
        letterhead="branded"
      />
    </Screen>
  );
}
