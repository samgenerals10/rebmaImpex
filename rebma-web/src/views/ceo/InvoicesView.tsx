// src/views/ceo/InvoicesView.tsx
import { useState, useEffect } from 'react';
import { Download, Eye, Printer, Plus, X, Trash2, Pencil } from 'lucide-react';
import QRCode from 'qrcode';
import { invoices as invoicesApi } from '../../services/apiClient';
import { exportToCSV, safeDisplayName } from '../../utils/export';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';
import DocumentContactEditModal, { DEFAULT_COMPANY_CONTACT, type DocumentContactInfo } from '../../components/global/DocumentContactEditModal';
import type { CurrentUser } from '../../types/erp';

interface LineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface ProformaRow {
  id: string;
  proforma_no: string;
  order_id: string | null;
  client_name: string;
  line_items: LineItem[];
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'CONVERTED';
  notes: string | null;
  created_at: string;
  contact_info?: DocumentContactInfo | null;
}

const STATUS_STYLES: Record<ProformaRow['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
};

interface Props {
  addNotification: (msg: string) => void;
  currentUser?: CurrentUser | null;
}

async function printProforma(r: ProformaRow, issuedBy: string, contact?: DocumentContactInfo) {
  const GREEN = '#1a5c32', BLUE = '#29a9dc', LIME = '#7fc241';
  const c: DocumentContactInfo = contact || r.contact_info || { customerPhone: '', ...DEFAULT_COMPANY_CONTACT };
  // Shown on the printed invoice itself exactly as before — an email here is
  // legitimate identification, not a bug. Only the copy embedded in the QR
  // payload gets sanitized, since that's the one iOS's scanner misreads as
  // a "Mail" action instead of showing the invoice content.
  const issuedByForQr = safeDisplayName(issuedBy, 'REBMA IMPEX Staff');
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(
      `REBMA IMPEX GHANA LIMITED\nProforma: ${r.proforma_no}\nCustomer: ${r.client_name}\nGrand Total: ${r.currency} ${Number(r.grand_total).toLocaleString()}\nIssued by: ${issuedByForQr}`,
      { width: 140, margin: 1, color: { dark: GREEN, light: '#ffffff' } }
    );
  } catch (err) { console.error('QR generation failed for proforma', r.proforma_no, err); qrDataUrl = ''; }

  const dateStr = new Date(r.created_at).toISOString().split('T')[0];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Proforma ${r.proforma_no} — REBMA IMPEX Ghana Limited</title><style>
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
    .badge{display:inline-block;padding:5px 16px;border-radius:99px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-top:8px;background:#fef3c7;color:#92400e}
    .divider{height:2px;background:linear-gradient(90deg,${GREEN},${BLUE},transparent);margin:0 0 28px;border:none;border-radius:99px}
    .bill-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:28px}
    .blabel{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:8px}
    .bname{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:3px}
    .items-table{width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    .items-table th{background:#f8fafc;padding:10px 16px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;border-bottom:1px solid #e2e8f0}
    .items-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;color:#1e293b}
    .items-table tr:last-child td{border-bottom:none}
    .items-table .total{background:#1e293b;color:#fff;font-weight:700;font-size:14px}
    .items-table .total td{color:#fff}
    .notes-box{background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#92400e}
    .notes-box strong{display:block;margin-bottom:4px;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#b45309}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:20px;border-top:1px solid #f1f5f9}
    .legal{font-size:8.5px;color:#94a3b8;line-height:1.8;max-width:420px}
    .qr-block{text-align:center}
    .qr-block img{width:96px;height:96px;border:2px solid #e2e8f0;border-radius:8px}
    .qlabel{font-size:8px;color:#94a3b8;margin-top:4px}
    @media print{body{background:#fff}.page{margin:0;box-shadow:none;border-radius:0}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
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
            <div class="address">${c.companyAddress}<br/>${c.companyPhone ? `Tel: ${c.companyPhone}` : ''}${c.companyPhone && c.companyEmail ? ' &bull; ' : ''}${c.companyEmail || ''}</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-label">Proforma Invoice — Quote Only</div>
          <div class="inv-no">${r.proforma_no}</div>
          <div class="inv-date">Issued: ${dateStr}</div>
          <span class="badge">Not a Tax Invoice</span>
        </div>
      </div>
      <hr class="divider"/>
      <div class="bill-box">
        <div class="blabel">Prepared For</div>
        <div class="bname">${r.client_name}</div>
        ${c.customerPhone ? `<div style="font-size:12px;color:#64748b;margin-top:3px">Tel: ${c.customerPhone}</div>` : ''}
      </div>
      <table class="items-table">
        <thead><tr><th>Product / Service</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price (${r.currency})</th><th style="text-align:right">Amount (${r.currency})</th></tr></thead>
        <tbody>
          ${r.line_items.map(item => `
            <tr>
              <td><strong>${item.productName}</strong></td>
              <td style="text-align:center;font-weight:700">${item.quantity}</td>
              <td style="text-align:right">${Number(item.unitPrice).toLocaleString()}</td>
              <td style="text-align:right;font-weight:700">${(item.quantity * item.unitPrice).toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr><td colspan="3" style="text-align:right;color:#64748b">Subtotal</td><td style="text-align:right">${Number(r.subtotal).toLocaleString()}</td></tr>
          <tr><td colspan="3" style="text-align:right;color:#64748b">Tax</td><td style="text-align:right">${Number(r.tax_amount).toLocaleString()}</td></tr>
          <tr class="total">
            <td colspan="3" style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:0.8">Grand Total</td>
            <td style="text-align:right;font-size:18px">${r.currency} ${Number(r.grand_total).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      ${r.notes ? `<div class="notes-box"><strong>Notes</strong>${r.notes}</div>` : ''}
      <div class="footer">
        <div class="legal">
          This is a <strong>proforma invoice</strong> — a quotation only, not a demand for payment or a tax invoice.
          Prices are valid for 14 days from the issue date above.<br/>
          Issued by ${issuedBy}, REBMA IMPEX Ghana Limited.
        </div>
        <div class="qr-block">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Proforma QR"/>` : ''}
          <div class="qlabel">Scan to verify</div>
        </div>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin:16px 0 32px">
    <button onclick="window.print()" style="background:${GREEN};color:#fff;border:none;padding:11px 32px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print</button>
    <button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:11px 28px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=860,height=900');
  if (w) { w.document.write(html); w.document.close(); }
  else { alert('Your browser blocked the invoice pop-up. Please allow pop-ups for this site, then try again.'); }
}

const emptyLine = (): LineItem => ({ productName: '', quantity: 1, unitPrice: 0 });

export default function InvoicesView({ addNotification, currentUser }: Props) {
  const [rows, setRows] = useState<ProformaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProformaRow | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [contactEditTarget, setContactEditTarget] = useState<ProformaRow | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await invoicesApi.listProformas();
      setRows(data as ProformaRow[]);
    } catch (e) {
      console.error('Error loading proforma invoices:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search && !r.proforma_no.toLowerCase().includes(search.toLowerCase()) &&
        !r.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setLineItems([emptyLine()]);
    setNotes('');
  };

  const subtotal = lineItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxAmount = subtotal * 0.15;
  const grandTotal = subtotal + taxAmount;

  const handleGenerate = async () => {
    if (submitting) return;
    if (!clientName.trim()) { addNotification('Client name is required.'); return; }
    const validItems = lineItems.filter(i => i.productName.trim() && i.quantity > 0);
    if (validItems.length === 0) { addNotification('Add at least one line item.'); return; }

    setSubmitting(true);
    try {
      const created = await invoicesApi.createProforma({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        lineItems: validItems,
        notes: notes.trim() || undefined,
      });
      addNotification(`Proforma ${created.proforma_no} generated.`);
      setShowGenerate(false);
      resetForm();
      await load();
      if (created) printProforma(created as ProformaRow, currentUser?.fullName || 'REBMA IMPEX Staff');
    } catch (e: any) {
      addNotification(e.message || 'Failed to generate proforma invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveContact = async (info: DocumentContactInfo) => {
    if (!contactEditTarget || savingContact) return;
    setSavingContact(true);
    try {
      await invoicesApi.updateContactInfo(contactEditTarget.id, info);
      setRows(prev => prev.map(r => r.id === contactEditTarget.id ? { ...r, contact_info: info } : r));
      setSelected(prev => prev && prev.id === contactEditTarget.id ? { ...prev, contact_info: info } : prev);
      addNotification(`Contact details updated for ${contactEditTarget.proforma_no}.`);
      setContactEditTarget(null);
    } catch (e: any) {
      addNotification(e.message || 'Failed to save contact details.');
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Proforma Invoices</h2>
          <p className="text-xs text-[var(--text-muted)]">Generate a quote for a customer before payment is made</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { exportToCSV(filtered, ['proforma_no', 'client_name', 'grand_total', 'status', 'created_at'], 'proforma_invoices'); addNotification('Exported CSV.'); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => { resetForm(); setShowGenerate(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Generate Proforma Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search proforma # / customer…"
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] w-56" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="CONVERTED">Converted</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['Proforma#', 'Customer', 'Grand Total', 'Date', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                  ))
                : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">No proforma invoices generated yet.</td></tr>
                  ) : filtered.map(row => (
                    <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer" onClick={() => setSelected(row)}>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[var(--accent)]">{row.proforma_no}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)] font-medium whitespace-nowrap">{row.client_name}</td>
                      <td className="px-4 py-2.5 font-bold text-[var(--text-primary)] whitespace-nowrap">{row.currency} {Number(row.grand_total).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{new Date(row.created_at).toISOString().split('T')[0]}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${STATUS_STYLES[row.status]}`}>{row.status}</span></td>
                      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelected(row)} className="p-1 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer text-[var(--accent)]" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {selected && (
      <EntityDetailPanel
        title={selected.proforma_no}
        subtitle={selected.client_name}
        badgeText={selected.status}
        badgeStyle={
          selected.status === 'CONVERTED' ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' } :
          selected.status === 'SENT' ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' } :
          { background: 'rgba(100,116,139,0.12)', color: '#64748b' }
        }
        fields={[
          { label: 'Proforma No', value: selected.proforma_no, highlight: true },
          { label: 'Grand Total', value: `${selected.currency} ${Number(selected.grand_total).toLocaleString()}`, highlight: true },
          { label: 'Customer', value: selected.client_name },
          { label: 'Subtotal', value: `${selected.currency} ${Number(selected.subtotal).toLocaleString()}` },
          { label: 'Tax', value: `${selected.currency} ${Number(selected.tax_amount).toLocaleString()}` },
          { label: 'Issued', value: new Date(selected.created_at).toISOString().split('T')[0] },
        ]}
        onClose={() => setSelected(null)}
      >
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Line Items</p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)' }}>
                  <th style={{ textAlign: 'left', padding: '7px 12px', fontSize: 10, color: 'var(--text-muted)' }}>Product</th>
                  <th style={{ textAlign: 'center', padding: '7px 8px', fontSize: 10, color: 'var(--text-muted)' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '7px 12px', fontSize: 10, color: 'var(--text-muted)' }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '7px 12px', fontSize: 10, color: 'var(--text-muted)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selected.line_items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{item.productName}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>×{item.quantity}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{selected.currency} {Number(item.unitPrice).toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{selected.currency} {(item.quantity * item.unitPrice).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => printProforma(selected, currentUser?.fullName || 'REBMA IMPEX Staff')}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} /> Print / Share
          </button>
          <button
            onClick={() => setContactEditTarget(selected)}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Pencil size={14} /> Edit Contact
          </button>
          <button onClick={() => setSelected(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>Close</button>
        </div>
      </EntityDetailPanel>
    )}

    {contactEditTarget && (
      <DocumentContactEditModal
        title="Edit Invoice Contact Details"
        documentLabel={contactEditTarget.proforma_no}
        initial={contactEditTarget.contact_info || { customerPhone: '', ...DEFAULT_COMPANY_CONTACT }}
        issuedByName={currentUser?.fullName || 'REBMA IMPEX Staff'}
        department={currentUser?.department || 'Marketing'}
        saving={savingContact}
        onSave={handleSaveContact}
        onClose={() => setContactEditTarget(null)}
      />
    )}

    {showGenerate && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h3 className="font-bold text-base text-[var(--text-primary)]">Generate Proforma Invoice</h3>
            <button onClick={() => setShowGenerate(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">Client Name</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Customer or company name"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">Client Phone <span className="font-normal text-[var(--text-muted)]">(optional, editable later)</span></label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="e.g. +233 24 123 4567"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Line Items</label>
                <button onClick={() => setLineItems(prev => [...prev, emptyLine()])} className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer">+ Add item</button>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input value={item.productName} onChange={e => setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, productName: e.target.value } : it))}
                      placeholder="Product / service" className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none" />
                    <input type="number" min={1} value={item.quantity} onChange={e => setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) || 0 } : it))}
                      placeholder="Qty" className="w-16 px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none" />
                    <input type="number" min={0} value={item.unitPrice} onChange={e => setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: Number(e.target.value) || 0 } : it))}
                      placeholder="Unit price" className="w-24 px-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none" />
                    <button onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))} disabled={lineItems.length === 1}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] space-y-1 text-xs">
              <div className="flex justify-between text-[var(--text-secondary)]"><span>Subtotal</span><span>GHS {subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-[var(--text-secondary)]"><span>Tax (15%)</span><span>GHS {taxAmount.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold text-[var(--text-primary)] text-sm pt-1 border-t border-[var(--border)]"><span>Grand Total</span><span>GHS {grandTotal.toLocaleString()}</span></div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
            <button onClick={() => setShowGenerate(false)} className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-xl cursor-pointer border border-[var(--border)]">Cancel</button>
            <button onClick={handleGenerate} disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl cursor-pointer hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              <Printer className="w-4 h-4" /> {submitting ? 'Generating…' : 'Generate & Print'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
