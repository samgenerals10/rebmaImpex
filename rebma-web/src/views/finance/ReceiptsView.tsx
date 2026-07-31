// rebma-web/src/views/finance/ReceiptsView.tsx
// Every payment approval auto-generates a finance_payments row (the receipt)
// but there was nowhere in the app to actually see it — this is that page:
// a searchable, printable list of every receipt on record. Shared across
// Finance/Management/Marketing/CEO sidebars (same data, same component).
import { useEffect, useState, useCallback } from 'react';
import { Search, Receipt as ReceiptIcon, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import type { OrderLineItem } from '../../types/erp';

const BRAND = { green: '#1a5c32', blue: '#29a9dc', lime: '#7fc241' };

export interface ReceiptRow {
  id: string;
  clientName: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  orderId: string | null;
  ticketNumber: string;
  receiptNumber: string;
  recordedBy: string | null;
  status: string;
  createdAt: string;
}

// A receipt number distinct from the order's own dispatch ticket number —
// reusing the ticket number made every printed receipt read as a ticket,
// not a receipt, even though the two documents mean different things.
export function generateReceiptNumber(): string {
  return 'RCP-' + Math.floor(10000 + Math.random() * 90000);
}

// Same branded shell as the Operations dispatch ticket and the Proforma
// Invoice — logo, watermark, gradient stripe, QR verification — so a
// receipt carries the same security features as every other REBMA IMPEX
// document. Renders an itemized table when the underlying order's line
// items are available, rather than summary cards.
export async function printReceipt(r: ReceiptRow, lineItems: OrderLineItem[] | null) {
  let qrDataUrl = '';
  try {
    const QRCode = await import('qrcode');
    qrDataUrl = await QRCode.toDataURL(
      [
        'REBMA IMPEX GHANA LIMITED',
        `Receipt: ${r.receiptNumber}`,
        `Client: ${r.clientName}`,
        `Amount: GHS ${r.amount.toLocaleString()}`,
        `Payment: ${r.paymentMode} — ${r.paymentType}`,
        `Recorded by: ${r.recordedBy || 'Finance'}`,
        `Status: ${r.status}`,
      ].join('\n'),
      { width: 140, margin: 1, color: { dark: BRAND.green, light: '#ffffff' } }
    );
  } catch { qrDataUrl = ''; }

  const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const itemRows = (lineItems && lineItems.length > 0)
    ? lineItems.map(it => `
        <tr>
          <td class="it-name">${it.productName}</td>
          <td class="it-num">${it.quantity}</td>
          <td class="it-num">GHS ${Number(it.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td class="it-num it-total">GHS ${Number(it.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="it-empty">Payment for Order ${r.orderId || '—'} — itemized breakdown not available for this record.</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Receipt ${r.receiptNumber} — REBMA IMPEX</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#e8f4ea;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
    .ticket{background:#fff;width:620px;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(26,92,50,0.18);position:relative}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:62px;font-weight:900;color:rgba(26,92,50,0.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:4px;font-style:italic}
    .stripe{height:7px;background:linear-gradient(90deg,${BRAND.green},${BRAND.blue},${BRAND.lime})}
    .body{position:relative;z-index:1;padding:28px 34px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
    .brand{display:flex;align-items:center;gap:12px}
    .brand img{width:56px;height:56px;object-fit:contain}
    .brand-text .name{font-size:17px;font-weight:900;color:${BRAND.green};letter-spacing:.5px}
    .brand-text .sub{font-size:9px;font-weight:700;color:${BRAND.blue};letter-spacing:2px;text-transform:uppercase;margin-top:2px}
    .brand-text .addr{font-size:9px;color:#64748b;margin-top:4px}
    .ticket-meta{text-align:right}
    .ticket-meta .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:3px}
    .ticket-meta .tno{font-size:22px;font-weight:900;color:${BRAND.green};letter-spacing:1px}
    .ticket-meta .tdate{font-size:9px;color:#64748b;margin-top:3px}
    .div{height:1.5px;background:linear-gradient(90deg,${BRAND.green},${BRAND.blue},transparent);margin:14px 0;border:none;border-radius:99px}
    .info-row{display:flex;flex-wrap:wrap;gap:4px 22px;font-size:10.5px;color:#475569;margin-bottom:16px}
    .info-row b{color:#1e293b;font-weight:700}
    .items{width:100%;border-collapse:collapse;margin-bottom:8px}
    .items thead th{background:#f0fdf4;color:${BRAND.green};font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:8px 10px;border-bottom:1.5px solid #16653430}
    .items thead th.it-num{text-align:right}
    .items td{padding:8px 10px;font-size:11.5px;color:#1e293b;border-bottom:1px solid #f1f5f9}
    .items td.it-num{text-align:right;font-variant-numeric:tabular-nums}
    .items td.it-total{font-weight:700}
    .items td.it-empty{color:#94a3b8;font-style:italic;font-size:10.5px;padding:14px 10px}
    .totals{display:flex;justify-content:flex-end;margin-bottom:14px}
    .totals table{border-collapse:collapse}
    .totals td{padding:4px 10px;font-size:11px}
    .totals .tl{color:#64748b;text-align:right}
    .totals .tv{color:#1e293b;font-weight:700;text-align:right;min-width:90px}
    .totals .grand td{font-size:15px;font-weight:900;color:${BRAND.green};padding-top:8px;border-top:1.5px solid #16653430}
    .verified{display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #16653430;border-radius:99px;padding:5px 14px;font-size:9.5px;font-weight:800;color:${BRAND.green};text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px}
    .perf{display:flex;align-items:center;margin:0 -34px 14px;overflow:hidden}
    .perf-line{flex:1;border-top:2px dashed #cbd5e1}
    .perf-circle{width:22px;height:22px;border-radius:50%;background:#e8f4ea;flex-shrink:0}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;border-top:1px dashed #e2e8f0}
    .legal{font-size:8px;color:#94a3b8;line-height:1.8;max-width:330px}
    .legal strong{color:#64748b}
    .qr-wrap{text-align:center}
    .qr-wrap img{width:92px;height:92px;border:2px solid #e2e8f0;border-radius:8px}
    .ql{font-size:7.5px;color:#94a3b8;margin-top:3px}
    .ql2{font-size:7px;color:${BRAND.green};font-weight:700;margin-top:1px}
    .foot-bar{background:#f8fafc;border-top:1px solid #e2e8f0;padding:9px 34px;display:flex;justify-content:space-between;align-items:center}
    .foot-bar span{font-size:8.5px;color:#94a3b8}
    .foot-bar .brand-slug{color:${BRAND.green};font-weight:700}
    @media print{body{background:#fff;padding:0}.ticket{margin:0;box-shadow:none;border-radius:0;width:100%}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}.items thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
  </style></head><body>
  <div>
    <div class="ticket">
      <div class="stripe"></div>
      <div class="watermark">REBMA IMPEX</div>
      <div class="body">

        <div class="header">
          <div class="brand">
            <img src="${window.location.origin}/logo.png" alt="REBMA IMPEX"/>
            <div class="brand-text">
              <div class="name">REBMA IMPEX</div>
              <div class="sub">Official Payment Receipt</div>
              <div class="addr">Accra, Ghana</div>
            </div>
          </div>
          <div class="ticket-meta">
            <div class="label">Receipt No.</div>
            <div class="tno">${r.receiptNumber}</div>
            <div class="tdate">${dateStr} ${timeStr}</div>
          </div>
        </div>

        <hr class="div"/>

        <div class="info-row">
          <span>Client: <b>${r.clientName}</b></span>
          <span>Payment: <b>${r.paymentMode} · ${r.paymentType}</b></span>
          <span>Order Ref: <b>${r.ticketNumber || r.orderId || '—'}</b></span>
          <span>Recorded By: <b>${r.recordedBy || 'Finance'}</b></span>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th>Product</th>
              <th class="it-num">Qty</th>
              <th class="it-num">Unit Price</th>
              <th class="it-num">Line Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="totals">
          <table>
            <tr class="grand"><td class="tl">Amount Paid</td><td class="tv">GHS ${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
          </table>
        </div>

        <div class="verified">✓ Payment Verified — ${r.status}</div>

        <div class="perf">
          <div class="perf-circle"></div>
          <div class="perf-line"></div>
          <div class="perf-circle"></div>
        </div>

        <div class="footer">
          <div class="legal">
            This receipt is issued by <strong>REBMA IMPEX Ghana Limited</strong> Finance.<br/>
            It confirms payment has been received and recorded against the order referenced above.<br/>
            Receipt <strong>${r.receiptNumber}</strong> documents this payment; order ticket <strong>${r.ticketNumber || '—'}</strong> is a separate record — scan QR to verify both match.
          </div>
          <div class="qr-wrap">
            ${qrDataUrl
              ? `<img src="${qrDataUrl}" alt="Receipt QR"/>`
              : `<div style="width:92px;height:92px;border:2px dashed #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8">QR</div>`}
            <div class="ql">Scan to verify</div>
            <div class="ql2">Matches ticket &amp; invoice</div>
          </div>
        </div>

      </div>
      <div class="foot-bar">
        <span>REBMA IMPEX Ghana Limited · Receipt ${r.receiptNumber} · ${new Date().toLocaleDateString('en-GB')}</span>
        <span class="brand-slug">rebmaimpex.com</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center">
      <button onclick="window.print()" style="background:${BRAND.green};color:#fff;border:none;padding:11px 30px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print Receipt</button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:11px 26px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=740,height=900');
  if (win) { win.document.write(html); win.document.close(); }
}

interface Props {
  addNotification?: (msg: string) => void;
}

export default function FinanceReceiptsView({ addNotification }: Props) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('finance_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      setReceipts((data || []).map((r: any) => ({
        id: r.id,
        clientName: r.client_name || r.customer_name || 'Customer',
        amount: Number(r.amount || 0),
        paymentMode: r.payment_mode || 'CASH',
        paymentType: r.payment_type || 'Full Payment',
        orderId: r.order_id || null,
        ticketNumber: r.invoice_number || r.order_ref || '',
        receiptNumber: r.receipt_number || r.invoice_number || r.id,
        recordedBy: r.recorded_by || null,
        status: r.status || 'CONFIRMED',
        createdAt: r.created_at || '',
      })));
    } catch {
      setReceipts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('finance-receipts-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_payments' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const filtered = receipts.filter(r =>
    !search ||
    r.clientName.toLowerCase().includes(search.toLowerCase()) ||
    r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.orderId || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  const handlePrintReceipt = async (r: ReceiptRow) => {
    let lineItems: OrderLineItem[] | null = null;
    if (r.orderId) {
      try {
        const { data } = await supabase.from('orders').select('metadata').eq('id', r.orderId).limit(1);
        const items = data?.[0]?.metadata?.items;
        if (Array.isArray(items) && items.length > 0) lineItems = items;
      } catch { /* falls back to the no-items message on the receipt */ }
    }
    printReceipt(r, lineItems);
    addNotification?.(`Opened receipt ${r.receiptNumber} for printing.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Receipts</h2>
          <p className="text-xs text-[var(--text-muted)]">{filtered.length} receipt{filtered.length !== 1 ? 's' : ''} · GHS {totalAmount.toLocaleString()} total</p>
        </div>
        <button
          onClick={() => { exportToCSV(filtered.map(r => ({ Receipt: r.receiptNumber, OrderTicket: r.ticketNumber, Client: r.clientName, Amount: r.amount, PaymentMode: r.paymentMode, PaymentType: r.paymentType, OrderId: r.orderId || '', RecordedBy: r.recordedBy || '', Status: r.status, Date: r.createdAt })), ['Receipt', 'OrderTicket', 'Client', 'Amount', 'PaymentMode', 'PaymentType', 'OrderId', 'RecordedBy', 'Status', 'Date'], 'receipts'); addNotification?.('Exported CSV.'); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90 shrink-0"
        >
          Export CSV
        </button>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search client, receipt#, order#…"
          className="w-full sm:w-96 pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['Receipt #', 'Order Ticket', 'Client', 'Amount', 'Payment', 'Recorded By', 'Status', 'Date', ''].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-3 py-4"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-[var(--text-muted)]">No receipts found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  <td className="px-3 py-2 font-mono font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.receiptNumber}</td>
                  <td className="px-3 py-2 font-mono text-[var(--text-secondary)] whitespace-nowrap">{r.ticketNumber || '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{r.clientName}</td>
                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{r.paymentMode} · {r.paymentType}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.recordedBy || '—'}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">{r.status}</span></td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handlePrintReceipt(r)} className="p-1 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer text-[var(--accent)]" title="Print Receipt">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center py-6 text-[var(--text-muted)]">
          <ReceiptIcon className="w-8 h-8 opacity-30 mb-2" />
        </div>
      )}
    </div>
  );
}
