// src/views/ceo/InvoicesView.tsx
import { useState, useEffect } from 'react';
import { Download, Eye, Printer } from 'lucide-react';
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


function orderToInvoice(r: any): InvoiceRow {
  const createdAt = r.created_at || r.createdAt || new Date().toISOString();
  const dateStr = createdAt.split('T')[0];
  const due = new Date(createdAt);
  due.setDate(due.getDate() + 30);
  const dueDateStr = due.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const orderStatus = r.status || '';
  const invoiceStatus: InvoiceRow['status'] =
    orderStatus === 'DELIVERED' ? 'paid' :
    dueDateStr < today ? 'overdue' : 'pending';
  return {
    id: String(r.id),
    invoice_no: `INV-${String(r.id).slice(0, 8).toUpperCase()}`,
    customer: r.client_name || r.clientName || 'Unknown',
    department: 'MARKETING',
    amount: Number(r.total_amount ?? r.totalAmount ?? 0),
    date: dateStr,
    due_date: dueDateStr,
    status: invoiceStatus,
  };
}

const STATUS_STYLES = {
  paid:    'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-700',
};

interface Props { addNotification: (msg: string) => void }

function printInvoices(rows: InvoiceRow[]) {
  const html = `<html><head><title>Invoices</title><style>
    body{font-family:sans-serif;padding:24px;color:#111}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f1f5f9;text-align:left;padding:8px 12px;border-bottom:2px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
    td{padding:8px 12px;border-bottom:1px solid #e2e8f0}
    h1{font-size:20px;margin-bottom:4px}
    .meta{color:#64748b;font-size:12px;margin-bottom:20px}
    .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
    .paid{background:#d1fae5;color:#065f46}.pending{background:#fef3c7;color:#92400e}.overdue{background:#fee2e2;color:#991b1b}
    @media print{button{display:none}}
  </style></head><body>
  <h1>Invoice Ledger</h1>
  <p class="meta">Printed ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} &mdash; ${rows.length} invoices</p>
  <table><thead><tr><th>Invoice #</th><th>Customer</th><th>Dept</th><th>Amount (GHS)</th><th>Date</th><th>Due Date</th><th>Status</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td><b>${r.invoice_no}</b></td><td>${r.customer}</td><td>${r.department}</td><td><b>${Number(r.amount??0).toLocaleString()}</b></td><td>${r.date}</td><td>${r.due_date}</td><td><span class="badge ${r.status}">${r.status}</span></td></tr>`).join('')}
  </tbody></table></body></html>`;
  const w = window.open('','_blank','width=900,height=700');
  if(w){w.document.write(html);w.document.close();w.onload=()=>w.print();}
}

function printSingleInvoice(r: InvoiceRow) {
  const html = `<html><head><title>Invoice ${r.invoice_no}</title><style>
    body{font-family:sans-serif;padding:40px;color:#111;max-width:600px;margin:0 auto}
    h1{font-size:28px;color:#1e293b;margin:0}
    .sub{color:#64748b;font-size:14px;margin-top:4px}
    .badge{display:inline-block;padding:4px 14px;border-radius:99px;font-size:13px;font-weight:700;margin-top:12px}
    .paid{background:#d1fae5;color:#065f46}.pending{background:#fef3c7;color:#92400e}.overdue{background:#fee2e2;color:#991b1b}
    .divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
    .label{color:#64748b}.value{font-weight:600;color:#1e293b}
    .amount{font-size:32px;font-weight:800;color:#0f172a;margin-top:8px}
    @media print{button{display:none}}
  </style></head><body>
  <h1>${r.invoice_no}</h1>
  <p class="sub">${r.customer} &mdash; ${r.department}</p>
  <span class="badge ${r.status}">${r.status.toUpperCase()}</span>
  <hr class="divider"/>
  <p class="amount">GHS ${Number(r.amount??0).toLocaleString()}</p>
  <hr class="divider"/>
  ${[['Issue Date',r.date],['Due Date',r.due_date],['Customer',r.customer],['Department',r.department],['Status',r.status]].map(([l,v])=>`<div class="row"><span class="label">${l}</span><span class="value">${v}</span></div>`).join('')}
  </body></html>`;
  const w = window.open('','_blank','width=700,height=600');
  if(w){w.document.write(html);w.document.close();w.onload=()=>w.print();}
}


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
        .from('orders')
        .select('*')
        .in('status', ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'])
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error loading orders for invoices:', error);
      }
      setRows((data || []).map(orderToInvoice));
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
    <>
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
          <button onClick={() => { printInvoices(filtered); addNotification('Printing invoices…'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Printer className="w-3.5 h-3.5" /> Print All
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
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)] whitespace-nowrap">GHS {(Number(row.amount ?? 0)).toLocaleString()}</td>
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
          { label: 'Amount',      value: `GHS ${(Number(selectedInvoice.amount ?? 0)).toLocaleString()}`, highlight: true },
          { label: 'Customer',    value: selectedInvoice.customer },
          { label: 'Department',  value: selectedInvoice.department },
          { label: 'Issue Date',  value: selectedInvoice.date },
          { label: 'Due Date',    value: selectedInvoice.due_date },
          { label: 'Status',      value: selectedInvoice.status },
        ]}
        onClose={() => setSelectedInvoice(null)}
        actions={
          <div className="flex gap-2">
            <button onClick={() => { if(selectedInvoice) printSingleInvoice(selectedInvoice); }} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium cursor-pointer flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><Printer className="w-4 h-4" /> Print</button>
            <button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 rounded-xl text-white text-sm font-medium cursor-pointer" style={{ background: 'var(--accent)' }}>Close</button>
          </div>
        }
      />
    )}
    </>
  );
}
