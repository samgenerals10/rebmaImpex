// src/views/ceo/InvoicesView.tsx
import { useState, useEffect } from 'react';
import { Download, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';

interface InvoiceRow {
  id: string;
  invoice_no: string;
  customer: string;
  department: string;
  amount: number;
  date: string;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
}

const STATUS_STYLES = {
  paid:    'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-700',
};

interface Props { addNotification: (msg: string) => void }

export default function InvoicesView({ addNotification }: Props) {
  const [rows, setRows]           = useState<InvoiceRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter]     = useState('all');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('date', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error loading invoices:', error);
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
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    if (search && !r.invoice_no.toLowerCase().includes(search.toLowerCase()) &&
        !r.customer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPaid    = rows.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const totalPending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const totalOverdue = rows.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0);

  const departments  = Array.from(new Set(rows.map(r => r.department)));
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">All Invoices</h2>
          <p className="text-xs text-[var(--text-muted)]">Invoice ledger across all departments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { exportToCSV(filtered, ['invoice_no','customer','department','amount','date','due_date','status'], 'invoices'); addNotification('Exported CSV.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => { exportToPDF('All Invoices', filtered, ['Invoice#','Customer','Amount','Status']); addNotification('Exported PDF.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Paid',    value: `GHS ${totalPaid.toLocaleString()}`,    cls: 'text-emerald-600', badge: 'bg-emerald-100' },
          { label: 'Pending', value: `GHS ${totalPending.toLocaleString()}`, cls: 'text-amber-600',   badge: 'bg-amber-100'   },
          { label: 'Overdue', value: `GHS ${totalOverdue.toLocaleString()}`, cls: 'text-rose-600',    badge: 'bg-rose-100'    },
        ].map((s, i) => (
          <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{rows.filter(r => r.status === s.label.toLowerCase()).length} invoices</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search invoice / customer…"
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] w-52" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['Invoice#','Customer','Department','Amount','Date','Due Date','Status',''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">
                        No invoices found. Use client-side controls or connect to a live data source.
                      </td>
                    </tr>
                  ) : paginated.map(row => (
                    <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer" onClick={() => setSelectedInvoice(row)}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[var(--accent)]">{row.invoice_no}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium whitespace-nowrap">{row.customer}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{row.department}</td>
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)] whitespace-nowrap">GHS {row.amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{row.due_date}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${STATUS_STYLES[row.status]}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedInvoice(row)} className="p-1 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer text-[var(--accent)]" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-muted)]">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)]">Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)]">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>

    {selectedInvoice && (
      <EntityDetailPanel
        title={selectedInvoice.invoice_no}
        subtitle={selectedInvoice.customer}
        badgeText={selectedInvoice.status}
        badgeStyle={
          selectedInvoice.status === 'paid'    ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' } :
          selectedInvoice.status === 'overdue' ? { background: 'rgba(239,68,68,0.12)',  color: '#ef4444' } :
          { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
        }
        fields={[
          { label: 'Invoice No',  value: selectedInvoice.invoice_no, highlight: true },
          { label: 'Amount',      value: `GHS ${selectedInvoice.amount.toLocaleString()}`, highlight: true },
          { label: 'Customer',    value: selectedInvoice.customer },
          { label: 'Department',  value: selectedInvoice.department },
          { label: 'Issue Date',  value: selectedInvoice.date },
          { label: 'Due Date',    value: selectedInvoice.due_date },
          { label: 'Status',      value: selectedInvoice.status },
        ]}
        onClose={() => setSelectedInvoice(null)}
        actions={
          <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 rounded-xl text-white text-sm font-medium cursor-pointer" style={{ background: 'var(--accent)' }}>Close</button>
        }
      />
    )}
  );
}
