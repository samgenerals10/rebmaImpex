// rebma-mobile/components/shared/TransactionsGrid.tsx
//
// Phase 7.4, D27. Ports rebma-web/src/views/ceo/TransactionsView.tsx — a
// unified ledger merged client-side from finance_payments, delivered/
// approved orders not yet in finance_payments (value recognition),
// finance_expenses, and general_purchases (exact merge logic verified
// against source). Read-only, no writes, no RPCs. Shared like WalletsGrid
// — a future CEO phase reuses this unmodified.
//
// Export (Gap-Closure Backlog, Item 1, D101): CSV keeps
// id/date/description/department/amount/type/account/status/source; PDF
// drops department/account/source — verbatim from TransactionsView.tsx:186/:191.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Download, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import MetricCard from '../ui/MetricCard';
import DataList, { type DataColumn } from '../ui/DataList';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import Button from '../ui/Button';
import SearchablePicker from '../ui/SearchablePicker';
import ExportSheet from './ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface Transaction {
  id: string;
  date: string;
  description: string;
  department: string;
  amount: number;
  type: 'in' | 'out';
  account: string;
  status: string;
  source: string;
}

function normaliseStatus(s: string): string {
  const up = (s || '').toUpperCase();
  if (up === 'CONFIRMED' || up === 'COMPLETED' || up === 'APPROVED' || up === 'DELIVERED') return 'completed';
  if (up === 'REJECTED' || up === 'FAILED') return 'failed';
  return 'pending';
}

export default function TransactionsGrid() {
  const t = useTheme();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [paymentsRes, expensesRes, purchasesRes, ordersRes] = await Promise.all([
      supabase.from('finance_payments').select('id, client_name, amount, payment_mode, created_at, status, order_id').order('created_at', { ascending: false }).limit(300),
      supabase.from('finance_expenses').select('id, category, description, amount, created_at, status').order('created_at', { ascending: false }).limit(300),
      supabase.from('general_purchases').select('id, item_name, cost, created_at, status, supplier').order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('id, ticket_number, client_name, total_amount, created_at, status, payment_mode').in('status', ['DELIVERED', 'APPROVED', 'OUT_FOR_DELIVERY']).order('created_at', { ascending: false }).limit(200),
    ]);

    const rows: Transaction[] = [];
    for (const p of paymentsRes.data || []) {
      rows.push({ id: `pay-${p.id}`, date: (p.created_at || '').slice(0, 10), description: `Payment from ${p.client_name || 'Client'}`, department: 'FINANCE', amount: Number(p.amount || 0), type: 'in', account: (p.payment_mode || 'CASH').replace(/_/g, ' '), status: normaliseStatus(p.status || 'completed'), source: 'Payments' });
    }
    const paymentOrderIds = new Set((paymentsRes.data || []).map((p: any) => p.order_id).filter(Boolean));
    for (const o of ordersRes.data || []) {
      if (paymentOrderIds.has(o.id)) continue;
      rows.push({ id: `ord-${o.id}`, date: (o.created_at || '').slice(0, 10), description: `Order ${o.ticket_number || o.id} — ${o.client_name || ''}`, department: 'MARKETING', amount: Number(o.total_amount || 0), type: 'in', account: (o.payment_mode || 'CASH').replace(/_/g, ' '), status: o.status === 'DELIVERED' ? 'completed' : 'pending', source: 'Orders' });
    }
    for (const e of expensesRes.data || []) {
      rows.push({ id: `exp-${e.id}`, date: (e.created_at || '').slice(0, 10), description: e.description || e.category || 'Expense', department: 'FINANCE', amount: Number(e.amount || 0), type: 'out', account: e.category || 'Expense', status: normaliseStatus(e.status || 'pending'), source: 'Expenses' });
    }
    for (const p of purchasesRes.data || []) {
      rows.push({ id: `gp-${p.id}`, date: (p.created_at || '').slice(0, 10), description: `Purchase: ${p.item_name || 'Item'}${p.supplier ? ` from ${p.supplier}` : ''}`, department: 'OPERATIONS', amount: Number(p.cost || 0), type: 'out', account: 'Purchase', status: normaliseStatus(p.status || 'pending'), source: 'Purchases' });
    }
    rows.sort((a, b) => b.date.localeCompare(a.date));
    setTxns(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const departments = useMemo(() => Array.from(new Set(txns.map((tx) => tx.department))).sort(), [txns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((tx) => {
      const matchesSearch = !q || tx.description.toLowerCase().includes(q);
      const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
      const matchesSource = sourceFilter === 'ALL' || tx.source === sourceFilter;
      const matchesDept = deptFilter === 'ALL' || tx.department === deptFilter;
      const matchesFrom = !fromDate || tx.date >= fromDate;
      const matchesTo = !toDate || tx.date <= toDate;
      return matchesSearch && matchesType && matchesSource && matchesDept && matchesFrom && matchesTo;
    });
  }, [txns, search, typeFilter, sourceFilter, deptFilter, fromDate, toDate]);

  const totalIn = filtered.filter((tx) => tx.type === 'in').reduce((s, tx) => s + tx.amount, 0);
  const totalOut = filtered.filter((tx) => tx.type === 'out').reduce((s, tx) => s + tx.amount, 0);
  const net = totalIn - totalOut;

  const columns: DataColumn<Transaction>[] = [
    { key: 'description', label: 'Description', primary: true },
    { key: 'type', label: 'Type', status: true, render: (tx) => <Badge tone={tx.type === 'in' ? 'success' : 'danger'} label={tx.type === 'in' ? 'IN' : 'OUT'} /> },
    { key: 'amount', label: 'Amount', render: (tx) => `GHS ${tx.amount.toLocaleString()}` },
    { key: 'source', label: 'Source' },
    { key: 'date', label: 'Date' },
  ];

  const csvColumns: ExportColumn[] = ['id', 'date', 'description', 'department', 'amount', 'type', 'account', 'status', 'source'].map((key) => ({ key, label: key }));
  const pdfColumns: ExportColumn[] = ['id', 'date', 'description', 'amount', 'type', 'status'].map((key) => ({ key, label: key }));

  return (
    <View style={{ gap: t.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing.sm }}>
        <Button label="Refresh" size="sm" variant="ghost" icon={<RefreshCw size={13} color={t.colors.textSecondary} />} onPress={load} />
        <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        <View style={{ width: '31%' }}><MetricCard label="Total In" value={loading ? '—' : `GHS ${totalIn.toLocaleString()}`} tone="accent" /></View>
        <View style={{ width: '31%' }}><MetricCard label="Total Out" value={loading ? '—' : `GHS ${totalOut.toLocaleString()}`} tone="danger" /></View>
        <View style={{ width: '31%' }}><MetricCard label="Net" value={loading ? '—' : `GHS ${net.toLocaleString()}`} /></View>
      </View>
      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{filtered.length} transactions</Text>

      <Input value={search} onChangeText={setSearch} placeholder="Search transactions…" />
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <View style={{ flex: 1 }}><Input value={fromDate} onChangeText={setFromDate} placeholder="From (YYYY-MM-DD)" /></View>
        <View style={{ flex: 1 }}><Input value={toDate} onChangeText={setToDate} placeholder="To (YYYY-MM-DD)" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
        <View style={{ flex: 1 }}>
          <SearchablePicker label="Type" value={typeFilter} onChange={setTypeFilter} options={[{ value: 'ALL', label: 'All Types' }, { value: 'in', label: 'Money In' }, { value: 'out', label: 'Money Out' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <SearchablePicker label="Source" value={sourceFilter} onChange={setSourceFilter} options={[{ value: 'ALL', label: 'All Sources' }, { value: 'Payments', label: 'Payments' }, { value: 'Orders', label: 'Orders' }, { value: 'Expenses', label: 'Expenses' }, { value: 'Purchases', label: 'Purchases' }]} />
        </View>
      </View>
      <SearchablePicker label="Department" value={deptFilter} onChange={setDeptFilter} options={[{ value: 'ALL', label: 'All Departments' }, ...departments.map((d) => ({ value: d, label: d }))]} />
      <DataList columns={columns} data={filtered} rowKey={(tx) => tx.id} loading={loading} emptyTitle="No transactions found" />

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="All Transactions"
        data={filtered}
        columns={csvColumns}
        pdfColumns={pdfColumns}
      />
    </View>
  );
}
