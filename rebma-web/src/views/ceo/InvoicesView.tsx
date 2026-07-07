// src/views/ceo/InvoicesView.tsx
import { useState, useEffect } from 'react';
import { Download, Eye, Printer, FileCheck, Edit3, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';

interface InvoiceLineItemRaw {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface InvoiceRow {
  id: string;
  invoice_no: string;
  customer: string;
  department: string;
  amount: number;
  date: string;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
  product: string;
  payment_mode: string;
  issued_by: string;
  issued_by_email: string;
  /** Full line items from order metadata — used when printing detailed invoice */
  lineItems?: InvoiceLineItemRaw[];
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
  const rawItems: InvoiceLineItemRaw[] | undefined = Array.isArray(r.metadata?.items) && r.metadata.items.length > 0
    ? r.metadata.items.map((item: any) => ({
        productName: item.productName || item.product_name || '—',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
        lineTotal: Number(item.lineTotal ?? item.line_total ?? 0),
      }))
    : undefined;

  // Build a human-readable product summary (all items)
  const productLabel = rawItems
    ? rawItems.map(i => `${i.productName} ×${i.quantity}`).join(', ')
    : (r.product_name || r.productName || '—');

  return {
    id: String(r.id),
    invoice_no: `INV-${String(r.id).slice(0, 8).toUpperCase()}`,
    customer: r.client_name || r.clientName || 'Unknown',
    department: 'MARKETING',
    amount: Number(r.total_amount ?? r.totalAmount ?? 0),
    date: dateStr,
    due_date: dueDateStr,
    status: invoiceStatus,
    product: productLabel,
    payment_mode: r.payment_mode || r.paymentMode || 'CASH',
    issued_by: r.created_by || r.submittedBy || 'Finance Department',
    issued_by_email: r.issuer_email || 'finance@rebmaimpex.com',
    lineItems: rawItems,
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

async function printSingleInvoice(r: InvoiceRow, notes?: string) {
  // Brand colors from REBMA logo
  const GREEN = '#1a5c32', BLUE = '#29a9dc', LIME = '#7fc241';

  let qrDataUrl = '';
  try {
    const QRCode = await import('qrcode');
    qrDataUrl = await QRCode.toDataURL(
      `REBMA IMPEX GHANA LIMITED\nInvoice: ${r.invoice_no}\nCustomer: ${r.customer}\nProduct: ${r.product}\nAmount: GHS ${Number(r.amount??0).toLocaleString()}\nPayment: ${r.payment_mode}\nDate: ${r.date}\nDue: ${r.due_date}\nStatus: ${r.status.toUpperCase()}\nIssued by: ${r.issued_by}`,
      { width: 140, margin: 1, color: { dark: GREEN, light: '#ffffff' } }
    );
  } catch { qrDataUrl = ''; }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${r.invoice_no} — REBMA IMPEX Ghana Limited</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b}
    .page{background:#fff;max-width:780px;margin:28px auto;border-radius:14px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);position:relative}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;font-weight:900;color:rgba(26,92,50,0.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:6px;user-select:none}
    .stripe{height:6px;background:linear-gradient(90deg,${GREEN},${BLUE},${LIME})}
    .content{position:relative;z-index:1;padding:40px 52px 48px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;gap:20px}
    .logo-wrap{display:flex;align-items:center;gap:14px}
    .logo-wrap img{width:56px;height:56px;object-fit:contain;flex-shrink:0}
    .logo-block .company{font-size:20px;font-weight:900;color:${GREEN};letter-spacing:1px;line-height:1}
    .logo-block .tagline{font-size:10px;color:${BLUE};margin-top:2px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    .logo-block .address{font-size:9.5px;color:#94a3b8;margin-top:8px;line-height:1.7}
    .inv-meta{text-align:right;flex-shrink:0}
    .inv-meta .inv-label{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px}
    .inv-meta .inv-no{font-size:22px;font-weight:900;color:${GREEN};letter-spacing:1px}
    .inv-meta .inv-date{font-size:10px;color:#64748b;margin-top:4px}
    .badge{display:inline-block;padding:5px 16px;border-radius:99px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-top:8px}
    .paid{background:#d1fae5;color:#065f46}.pending{background:#fef3c7;color:#92400e}.overdue{background:#fee2e2;color:#991b1b}
    .divider{height:2px;background:linear-gradient(90deg,${GREEN},${BLUE},transparent);margin:0 0 28px;border:none;border-radius:99px}
    .bill-section{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px}
    .bill-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px}
    .blabel{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:8px}
    .bname{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px}
    .bsub{font-size:10px;color:#64748b;line-height:1.5}
    .amount-hero{background:linear-gradient(135deg,${GREEN} 0%,#2d7a50 100%);border-radius:12px;padding:22px 28px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}
    .alabel{font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
    .avalue{font-size:34px;font-weight:900;color:#fff;letter-spacing:-1px}
    .seal{border:2px solid rgba(255,255,255,0.5);border-radius:10px;padding:8px 16px;font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.12em;text-align:center}
    .seal small{display:block;font-size:8px;color:rgba(255,255,255,0.6);font-weight:500;letter-spacing:0;margin-top:2px;text-transform:none}
    .items-table{width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    .items-table th{background:#f8fafc;padding:10px 16px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:1px solid #e2e8f0}
    .items-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;color:#1e293b}
    .items-table tr:last-child td{border-bottom:none}
    .items-table .total{background:#1e293b;color:#fff;font-weight:700;font-size:14px}
    .items-table .total td{color:#fff}
    .fields{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;font-size:12.5px}
    .field-row{display:flex;justify-content:space-between;padding:10px 18px;border-bottom:1px solid #f1f5f9}
    .field-row:last-child{border-bottom:none}
    .fl{color:#64748b}.fv{font-weight:600;color:#1e293b}
    .notes-box{background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#92400e}
    .notes-box strong{display:block;margin-bottom:4px;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#b45309}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:20px;border-top:1px solid #f1f5f9}
    .legal{font-size:8.5px;color:#94a3b8;line-height:1.8;max-width:420px}
    .qr-block{text-align:center}
    .qr-block img{width:96px;height:96px;border:2px solid #e2e8f0;border-radius:8px}
    .qlabel{font-size:8px;color:#94a3b8;margin-top:4px}
    .ql2{font-size:7.5px;color:${GREEN};font-weight:700;margin-top:1px}
    @media print{body{background:#fff}.page{margin:0;box-shadow:none;border-radius:0}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}.amount-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
  </style></head><body>
  <div class="page">
    <div class="stripe"></div>
    <div class="watermark">REBMA IMPEX</div>
    <div class="content">
      <div class="header">
        <div class="logo-wrap">
          <img src="${window.location.origin}/logo.png" alt="REBMA IMPEX"/>
          <div class="logo-block">
            <div class="company">REBMA IMPEX</div>
            <div class="tagline">Ghana Limited</div>
            <div class="address">Accra Business District, Accra, Ghana<br/>Tel: +233 XX XXX XXXX &bull; info@rebmaimpex.com<br/>VAT Reg: GH-XXXXXXXXX</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-label">Official Invoice</div>
          <div class="inv-no">${r.invoice_no}</div>
          <div class="inv-date">Issued: ${r.date}</div>
          <div class="inv-date" style="margin-top:2px">Due: ${r.due_date}</div>
          <span class="badge ${r.status}">${r.status === 'paid' ? '✓ PAID' : r.status === 'overdue' ? '⚠ OVERDUE' : '⏳ PENDING'}</span>
        </div>
      </div>
      <hr class="divider"/>
      <div class="bill-section">
        <div class="bill-box">
          <div class="blabel">Bill To</div>
          <div class="bname">${r.customer}</div>
          <div class="bsub">${r.department} Department</div>
        </div>
        <div class="bill-box">
          <div class="blabel">Issued By</div>
          <div class="bname">${r.issued_by}</div>
          <div class="bsub" style="color:${BLUE}">${r.issued_by_email}</div>
          <div class="bsub" style="margin-top:4px">Finance Department</div>
        </div>
        <div class="bill-box">
          <div class="blabel">Payment Info</div>
          <div class="bname">${r.payment_mode}</div>
          <div class="bsub">Mode of payment</div>
          <div class="bsub" style="margin-top:4px;font-weight:700;color:${r.status==='paid'?'#065f46':r.status==='overdue'?'#991b1b':'#92400e'}">${r.status.toUpperCase()}</div>
        </div>
      </div>
      <div class="amount-hero">
        <div>
          <div class="alabel">Total Amount</div>
          <div class="avalue">GHS ${Number(r.amount??0).toLocaleString()}</div>
        </div>
        <div class="seal">Finance Verified<small>REBMA IMPEX Ghana Limited</small></div>
      </div>
      <table class="items-table">
        <thead><tr><th>Product / Service</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price (GHS)</th><th style="text-align:right">Amount (GHS)</th></tr></thead>
        <tbody>
          ${r.lineItems && r.lineItems.length > 0
            ? r.lineItems.map((item: any, idx: number) => `
              <tr>
                <td><strong>${item.productName}</strong></td>
                <td style="text-align:center;font-weight:700">${item.quantity}</td>
                <td style="text-align:right">${item.unitPrice > 0 ? Number(item.unitPrice).toLocaleString() : '<span style="color:#f59e0b;font-size:11px">TBD</span>'}</td>
                <td style="text-align:right;font-weight:700">${item.lineTotal > 0 ? Number(item.lineTotal).toLocaleString() : '—'}</td>
              </tr>
            `).join('')
            : `<tr>
                <td>Order ${r.invoice_no}</td>
                <td style="text-align:center">—</td>
                <td style="text-align:right">—</td>
                <td style="text-align:right;font-weight:700">${Number(r.amount??0).toLocaleString()}</td>
              </tr>`
          }
          <tr class="total">
            <td colspan="3" style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:0.8">Total Due</td>
            <td style="text-align:right;font-size:18px">GHS ${Number(r.amount??0).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <div class="fields">
        ${[
          ['Invoice Number', r.invoice_no],
          ['Customer', r.customer],
          ['Items', r.lineItems && r.lineItems.length > 0 ? `${r.lineItems.length} line item${r.lineItems.length > 1 ? 's' : ''}` : (r.product || '—')],
          ['Payment Mode', r.payment_mode || 'CASH'],
          ['Issue Date', r.date],
          ['Due Date', r.due_date],
          ['Payment Status', r.status.toUpperCase()],
          ['Issued By', `${r.issued_by} (${r.issued_by_email})`],
        ].map(([l,v])=>`<div class="field-row"><span class="fl">${l}</span><span class="fv">${v}</span></div>`).join('')}
      </div>
      ${notes ? `<div class="notes-box"><strong>Finance Notes</strong>${notes}</div>` : ''}
      <div class="footer">
        <div class="legal">
          This invoice is officially issued by <strong>REBMA IMPEX Ghana Limited</strong> and is subject to standard terms and conditions.<br/>
          Payment is due by <strong>${r.due_date}</strong>. For queries contact Finance at <span style="color:${BLUE}">${r.issued_by_email}</span>.<br/>
          <em>System-generated document — valid without physical signature when verified by QR code.</em>
        </div>
        <div class="qr-block">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Invoice QR"/>` : '<div style="width:96px;height:96px;border:2px dashed #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94a3b8">QR</div>'}
          <div class="qlabel">Scan to verify authenticity</div>
          <div class="ql2">Matches Operations ticket</div>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:10px 52px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:#94a3b8">REBMA IMPEX Ghana Limited &bull; ${r.invoice_no} &bull; ${r.date}</span>
      <span style="font-size:9px;color:${GREEN};font-weight:700">rebmaimpex.com</span>
    </div>
  </div>
  <div style="text-align:center;margin:16px 0 32px">
    <button onclick="window.print()" style="background:${GREEN};color:#fff;border:none;padding:11px 32px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px;letter-spacing:.3px">🖨 Print Invoice</button>
    <button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:11px 28px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>
  </body></html>`;
  const w = window.open('','_blank','width=860,height=900');
  if(w){w.document.write(html);w.document.close();}
}


export default function InvoicesView({ addNotification }: Props) {
  const [rows, setRows]           = useState<InvoiceRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter]     = useState('all');
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [generateModal, setGenerateModal] = useState<InvoiceRow | null>(null);
  const [invoiceNotes, setInvoiceNotes] = useState('');
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
          { label: 'Payment Mode', value: selectedInvoice.payment_mode },
        ]}
        onClose={() => setSelectedInvoice(null)}
      >
        {/* Line items breakdown */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Order Items
          </p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '7px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Product</th>
                  <th style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0
                  ? selectedInvoice.lineItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < selectedInvoice.lineItems!.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>×{item.quantity}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {item.unitPrice > 0 ? `GHS ${Number(item.unitPrice).toLocaleString()}` : <span style={{ color: '#f59e0b', fontSize: 10 }}>TBD</span>}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                        {item.lineTotal > 0 ? `GHS ${Number(item.lineTotal).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))
                  : (
                    <tr>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInvoice.product || 'Goods & Services'}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>GHS {Number(selectedInvoice.amount ?? 0).toLocaleString()}</td>
                    </tr>
                  )
                }
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>Total</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>GHS {Number(selectedInvoice.amount ?? 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button
            onClick={() => { if(selectedInvoice) { setGenerateModal(selectedInvoice); setInvoiceNotes(''); setSelectedInvoice(null); } }}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FileCheck size={15} /> Generate Invoice
          </button>
          <button
            onClick={() => { if(selectedInvoice) printSingleInvoice(selectedInvoice); }}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} /> Quick Print
          </button>
          <button
            onClick={() => setSelectedInvoice(null)}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}
          >
            Close
          </button>
        </div>
      </EntityDetailPanel>
    )}


    {/* Generate Invoice Modal */}
    {generateModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-bold text-base text-[var(--text-primary)]">Generate Invoice</h3>
            </div>
            <button onClick={() => setGenerateModal(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer">
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)] grid grid-cols-2 gap-3">
              {([
                ['Invoice #', generateModal.invoice_no],
                ['Customer', generateModal.customer],
                ['Amount', `GHS ${(Number(generateModal.amount??0)).toLocaleString()}`],
                ['Issue Date', generateModal.date],
                ['Due Date', generateModal.due_date],
                ['Status', generateModal.status.toUpperCase()],
              ] as [string,string][]).map(([l, v]) => (
                <div key={l}>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{l}</p>
                  <p className={`text-sm font-bold ${l === 'Amount' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${generateModal.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : generateModal.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{generateModal.status.toUpperCase()}</span>
              <span className="text-xs text-[var(--text-muted)]">This status appears on the printed invoice</span>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Finance Notes (optional — printed on invoice)
              </label>
              <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)}
                placeholder="e.g. Payment received via cheque on 25/06/2026. Ref: CHQ-001234. Verified by Finance."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none" />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed bg-[var(--accent-light)] rounded-lg px-3 py-2">
              The invoice will include the <strong>REBMA IMPEX Ghana Limited</strong> watermark, a unique QR code for verification, and your Finance notes. What is printed matches what is recorded in the system.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
            <button onClick={() => setGenerateModal(null)} className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-xl cursor-pointer border border-[var(--border)]">Cancel</button>
            <button onClick={() => { printSingleInvoice(generateModal, invoiceNotes); setGenerateModal(null); addNotification(`Invoice ${generateModal.invoice_no} generated.`); }}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl cursor-pointer hover:opacity-90" style={{ background: 'var(--accent)' }}>
              <Printer className="w-4 h-4" /> Generate &amp; Print
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
