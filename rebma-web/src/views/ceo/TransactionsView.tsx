// src/views/ceo/TransactionsView.tsx
import { useState, useEffect } from 'react';
import { Download, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';

interface Transaction {
  id: string;
  date: string;
  description: string;
  department: string;
  amount: number;
  type: 'in' | 'out';
  account: string;
  status: 'completed' | 'pending' | 'failed';
}

const STATUS_STYLES = {
  completed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-rose-100 text-rose-700',
};

interface Props { addNotification: (msg: string) => void }

export default function TransactionsView({ addNotification }: Props) {
  const [rows, setRows]           = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]           = useState(0);
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error loading transactions:', error);
      }
      setRows(data || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (fromDate && r.date < fromDate) return false;
    if (toDate   && r.date > toDate)   return false;
    return true;
  });

  const totalIn  = filtered.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
  const totalOut = filtered.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
  const net      = totalIn - totalOut;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const departments = Array.from(new Set(rows.map(r => r.department)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">All Transactions</h2>
          <p className="text-xs text-[var(--text-muted)]">Complete transaction ledger across all departments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { exportToCSV(filtered, ['id','date','description','department','amount','type','account','status'], 'transactions'); addNotification('Exported CSV.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => { exportToPDF('All Transactions', filtered, ['ID','Date','Description','Amount','Type','Status']); addNotification('Exported PDF.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total In',    value: `GHS ${totalIn.toLocaleString()}`,  icon: ArrowDownLeft,  cls: 'text-emerald-600' },
          { label: 'Total Out',   value: `GHS ${totalOut.toLocaleString()}`, icon: ArrowUpRight,   cls: 'text-rose-500' },
          { label: 'Net',         value: `GHS ${net.toLocaleString()}`,      icon: net >= 0 ? TrendingUp : TrendingDown, cls: net >= 0 ? 'text-emerald-600' : 'text-rose-500' },
          { label: 'This Period', value: `${filtered.length} txns`,          icon: TrendingUp,     cls: 'text-[var(--accent)]' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{s.label}</p>
                <Icon className={`w-4 h-4 ${s.cls}`} />
              </div>
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
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
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as any); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="all">All Types</option>
          <option value="in">Money In</option>
          <option value="out">Money Out</option>
        </select>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['ID','Date','Description','Department','Amount','Type','Account','Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    No transactions recorded. Create a transaction to test this view.
                  </td>
                </tr>
              ) : paginated.map(row => (
                <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-semibold text-[var(--accent)]">{row.id}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium">{row.description}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{row.department}</td>
                  <td className="px-4 py-2.5 font-bold whitespace-nowrap" style={{ color: row.type === 'in' ? 'var(--accent)' : '#ef4444' }}>
                    {row.type === 'in' ? '+' : '-'} GHS {row.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${row.type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                      {row.type === 'in' ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                      {row.type === 'in' ? 'In' : 'Out'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{row.account}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${STATUS_STYLES[row.status]}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)]">Page {page + 1} of {totalPages} · {filtered.length} records</span>
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
