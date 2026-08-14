// src/views/ceo/TransactionsView.tsx
import { useState, useEffect } from 'react';
import { Download, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import { exportToCSV, exportToPDF } from '../../utils/export';

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

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  Approved:  'bg-emerald-100 text-emerald-700',
  APPROVED:  'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  Pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-rose-100 text-rose-700',
  Rejected:  'bg-rose-100 text-rose-700',
  REJECTED:  'bg-rose-100 text-rose-700',
};

const normaliseStatus = (s: string) => {
  if (!s) return 'pending';
  const l = s.toLowerCase();
  if (l === 'approved' || l === 'completed') return 'completed';
  if (l === 'rejected' || l === 'failed') return 'failed';
  return 'pending';
};

interface Props { addNotification: (msg: string) => void }

export default function TransactionsView({ addNotification }: Props) {
  const [rows, setRows]             = useState<Transaction[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage]             = useState(0);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    try {
      const [paymentsRes, expensesRes, purchasesRes, ordersRes] = await Promise.all([
        supabase.from('finance_payments')
          .select('id, client_name, amount, payment_mode, created_at, status, recorded_by, order_id')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('finance_expenses')
          .select('id, category, description, amount, created_at, status, submitted_by')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('general_purchases')
          .select('id, item_name, cost, created_at, status, supplier')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('orders')
          .select('id, ticket_number, client_name, total_amount, created_at, status, payment_mode')
          .in('status', ['DELIVERED', 'APPROVED', 'OUT_FOR_DELIVERY'])
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const txns: Transaction[] = [];

      // Money IN — finance_payments
      for (const p of (paymentsRes.data || []) as any[]) {
        txns.push({
          id: `pay-${p.id}`,
          date: (p.created_at || '').slice(0, 10),
          description: `Payment from ${p.client_name || 'Client'}`,
          department: 'FINANCE',
          amount: Number(p.amount || 0),
          type: 'in',
          account: (p.payment_mode || 'CASH').replace(/_/g, ' '),
          status: normaliseStatus(p.status || 'completed'),
          source: 'Payments',
        });
      }

      // Money IN — delivered/approved orders not yet in finance_payments (value recognition)
      const paymentOrderIds = new Set((paymentsRes.data || []).map((p: any) => p.order_id).filter(Boolean));
      for (const o of (ordersRes.data || []) as any[]) {
        if (paymentOrderIds.has(o.id)) continue; // already counted via payment
        txns.push({
          id: `ord-${o.id}`,
          date: (o.created_at || '').slice(0, 10),
          description: `Order ${o.ticket_number || o.id} — ${o.client_name || ''}`,
          department: 'MARKETING',
          amount: Number(o.total_amount || 0),
          type: 'in',
          account: (o.payment_mode || 'CASH').replace(/_/g, ' '),
          status: o.status === 'DELIVERED' ? 'completed' : 'pending',
          source: 'Orders',
        });
      }

      // Money OUT — finance_expenses
      for (const e of (expensesRes.data || []) as any[]) {
        txns.push({
          id: `exp-${e.id}`,
          date: (e.created_at || '').slice(0, 10),
          description: e.description || e.category || 'Expense',
          department: 'FINANCE',
          amount: Number(e.amount || 0),
          type: 'out',
          account: e.category || 'Expense',
          status: normaliseStatus(e.status || 'pending'),
          source: 'Expenses',
        });
      }

      // Money OUT — general_purchases
      for (const p of (purchasesRes.data || []) as any[]) {
        txns.push({
          id: `gp-${p.id}`,
          date: (p.created_at || '').slice(0, 10),
          description: `Purchase: ${p.item_name || 'Item'}${p.supplier ? ` from ${p.supplier}` : ''}`,
          department: 'OPERATIONS',
          amount: Number(p.cost || 0),
          type: 'out',
          account: 'Purchase',
          status: normaliseStatus(p.status || 'pending'),
          source: 'Purchases',
        });
      }

      // Sort newest first
      txns.sort((a, b) => b.date.localeCompare(a.date));
      setRows(txns);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
    if (fromDate && r.date < fromDate) return false;
    if (toDate   && r.date > toDate)   return false;
    return true;
  });

  const totalIn  = filtered.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
  const totalOut = filtered.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
  const net      = totalIn - totalOut;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const departments = Array.from(new Set(rows.map(r => r.department))).sort();
  const sources     = Array.from(new Set(rows.map(r => r.source))).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">All Transactions</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Live ledger — payments, expenses &amp; purchases · {rows.length} records
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => { exportToCSV(filtered, ['id','date','description','department','amount','type','account','status','source'], 'transactions'); addNotification('Exported CSV.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => { exportToPDF('All Transactions', filtered, ['id','date','description','amount','type','status']); addNotification('Exported PDF.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total In',    value: `GHS ${totalIn.toLocaleString()}`,  icon: ArrowDownLeft,  cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Out',   value: `GHS ${totalOut.toLocaleString()}`, icon: ArrowUpRight,   cls: 'text-rose-500',    bg: 'bg-rose-50' },
          { label: 'Net Balance', value: `GHS ${Math.abs(net).toLocaleString()}`, icon: net >= 0 ? TrendingUp : TrendingDown, cls: net >= 0 ? 'text-emerald-600' : 'text-rose-500', bg: net >= 0 ? 'bg-emerald-50' : 'bg-rose-50' },
          { label: 'Transactions',value: `${filtered.length} records`,       icon: TrendingUp,     cls: 'text-[var(--accent)]', bg: 'bg-[var(--accent-light)]' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{s.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <Icon className={`w-4 h-4 ${s.cls}`} />
                </div>
              </div>
              {loading
                ? <div className="animate-pulse h-6 w-28 bg-[var(--bg-input)] rounded" />
                : <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>}
              {i === 2 && !loading && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{net >= 0 ? 'Surplus' : 'Deficit'}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3">
        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
        <SearchableDropdown
          value={typeFilter}
          onChange={v => { setTypeFilter(v as any); setPage(0); }}
          options={[{ value: 'all', label: 'All Types' }, { value: 'in', label: 'Money In' }, { value: 'out', label: 'Money Out' }]}
          className="w-36"
        />
        <SearchableDropdown
          value={deptFilter}
          onChange={v => { setDeptFilter(v); setPage(0); }}
          options={[{ value: 'all', label: 'All Departments' }, ...departments.map(d => ({ value: d, label: d }))]}
          className="w-44"
        />
        <SearchableDropdown
          value={sourceFilter}
          onChange={v => { setSourceFilter(v); setPage(0); }}
          options={[{ value: 'all', label: 'All Sources' }, ...sources.map(s => ({ value: s, label: s }))]}
          className="w-40"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="p-3">
          <ResponsiveDataView<Transaction>
            columns={[
              { key: 'description', label: 'Description', primary: true },
              { key: 'date', label: 'Date', render: row => <span className="font-mono">{row.date}</span> },
              { key: 'department', label: 'Department', render: row => <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--accent-light)] text-[var(--accent)]">{row.department}</span> },
              { key: 'source', label: 'Source', render: row => <span className="text-[10px]">{row.source}</span> },
              {
                key: 'amount', label: 'Amount', render: row => (
                  <span className="font-bold whitespace-nowrap" style={{ color: row.type === 'in' ? '#059669' : '#ef4444' }}>
                    {row.type === 'in' ? '+' : '-'} GHS {(Number(row.amount ?? 0)).toLocaleString()}
                  </span>
                )
              },
              {
                key: 'type', label: 'Type', render: row => (
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${row.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                    {row.type === 'in' ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                    {row.type === 'in' ? 'In' : 'Out'}
                  </span>
                )
              },
              { key: 'account', label: 'Account' },
              {
                key: 'status', label: 'Status', status: true, render: row => (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${STATUS_STYLES[row.status] || 'bg-slate-100 text-slate-500'}`}>
                    {row.status}
                  </span>
                )
              },
            ]}
            data={paginated}
            rowKey={row => row.id}
            loading={loading}
            emptyTitle="No transactions found for the selected filters"
          />
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)]">
              Page {page + 1} of {totalPages} · {filtered.length} records
            </span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)]">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)]">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
