// rebma-mobile/screens/finance/StatementScreen.tsx
// Ports: rebma-web/src/views/finance/StatementView.tsx — explodes every
// order into one row per product line item (with a live stock lookup per
// product), joined client-side. Read-only.
//
// Export (Gap-Closure Backlog, Item 1): two genuinely different shapes on
// one screen, both ported — whole-table CSV (ticketNumber/date/
// productName/quantity/clientName/destination/paymentMode/status/
// stockRemaining, verbatim from StatementView.tsx's export) AND a
// per-row single-record PDF (downloadRowPDF-equivalent) reached from the
// detail Sheet, not a table PDF.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import ExportSheet from '../../components/shared/ExportSheet';
import { exportFieldValueDocument, type ExportColumn } from '../../lib/exportEngine';

interface StatementRow {
  key: string;
  orderId: string;
  ticketNumber: string | null;
  date: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  clientName: string;
  destination: string | null;
  paymentMode: string;
  status: string;
  stockRemaining: number | null;
}

export default function StatementScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<StatementRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [rowExporting, setRowExporting] = useState(false);

  const load = useCallback(async () => {
    const [ordersRes, stockRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('stock').select('product_name, quantity'),
    ]);
    const orders = ordersRes.data || [];
    const stock = stockRes.data || [];
    const stockFor = (productName: string) => {
      const key = productName.toLowerCase().trim();
      const row = stock.find((s: any) => String(s.product_name || '').toLowerCase().trim() === key);
      return row ? Number(row.quantity) || 0 : null;
    };

    const out: StatementRow[] = [];
    for (const o of orders as any[]) {
      const items = Array.isArray(o.metadata?.items) && o.metadata.items.length > 0
        ? o.metadata.items
        : [{ productName: o.product_name || 'Generic Goods', quantity: o.quantity || 1, unitPrice: 0 }];
      items.forEach((item: any, idx: number) => {
        const productName = item.productName || item.product_name || o.product_name || 'Generic Goods';
        out.push({
          key: `${o.id}-${idx}`,
          orderId: o.id,
          ticketNumber: o.ticket_number || null,
          date: o.created_at,
          productName,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
          lineTotal: Number(item.lineTotal ?? item.line_total ?? (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
          clientName: o.client_name || 'Unknown',
          destination: o.destination || null,
          paymentMode: o.payment_mode || 'CASH',
          status: o.status || 'PENDING_FINANCE',
          stockRemaining: stockFor(productName),
        });
      });
    }
    setRows(out);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.productName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q) || (r.ticketNumber || '').toLowerCase().includes(q));
  }, [rows, search]);

  const columns: DataColumn<StatementRow>[] = [
    { key: 'productName', label: 'Product', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status.replace(/_/g, ' ')} /> },
    { key: 'clientName', label: 'Client' },
    { key: 'lineTotal', label: 'Amount', render: (r) => `GHS ${r.lineTotal.toLocaleString()}` },
    { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} (${r.stockRemaining ?? '—'} in stock)` },
  ];

  // Verbatim from StatementView.tsx's own whole-table CSV export.
  const exportColumns: ExportColumn[] = [
    { key: 'ticketNumber', label: 'ticketNumber', render: (r) => r.ticketNumber || '' },
    { key: 'date', label: 'date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'productName', label: 'productName' },
    { key: 'quantity', label: 'quantity' },
    { key: 'clientName', label: 'clientName' },
    { key: 'destination', label: 'destination', render: (r) => r.destination || '' },
    { key: 'paymentMode', label: 'paymentMode' },
    { key: 'status', label: 'status' },
    { key: 'stockRemaining', label: 'stockRemaining', render: (r) => r.stockRemaining != null ? String(r.stockRemaining) : '' },
  ];

  const downloadRowPdf = async () => {
    if (!detail) return;
    setRowExporting(true);
    try {
      await exportFieldValueDocument('pdf', `Statement — ${detail.productName}`, {
        'Ticket': detail.ticketNumber || '—',
        'Product': detail.productName,
        'Client': detail.clientName,
        'Destination': detail.destination || '—',
        'Payment Mode': detail.paymentMode,
        'Quantity': detail.quantity,
        'Unit Price': `GHS ${detail.unitPrice.toLocaleString()}`,
        'Line Total': `GHS ${detail.lineTotal.toLocaleString()}`,
        'Status': detail.status.replace(/_/g, ' '),
        'Stock Remaining': detail.stockRemaining ?? '—',
      });
    } finally {
      setRowExporting(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export CSV" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Search statement…" />
        <DataList columns={columns} data={filtered} rowKey={(r) => r.key} loading={loading} emptyTitle="No line items found" onRowPress={setDetail} />
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.productName} subtitle={detail?.ticketNumber || undefined} side="bottom" maxHeight={520}
        footer={<Button label={rowExporting ? 'Preparing…' : 'Download PDF'} size="sm" icon={<Download size={13} color="#fff" />} onPress={downloadRowPdf} loading={rowExporting} disabled={rowExporting} fullWidth />}
      >
        {detail && (
          <SheetSection label="Line Item">
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Client: {detail.clientName}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Destination: {detail.destination || '—'}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Payment: {detail.paymentMode}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Unit Price: GHS {detail.unitPrice.toLocaleString()} × {detail.quantity}</Text>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }}>Line Total: GHS {detail.lineTotal.toLocaleString()}</Text>
          </SheetSection>
        )}
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Statement"
        data={filtered}
        columns={exportColumns}
        formats={['csv']}
      />
    </Screen>
  );
}
