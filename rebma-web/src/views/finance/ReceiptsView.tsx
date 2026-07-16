// rebma-web/src/views/finance/ReceiptsView.tsx
// Every payment approval auto-generates a finance_payments row (the receipt)
// but there was nowhere in the app to actually see it — this is that page:
// a searchable, printable list of every receipt on record.
import { useEffect, useState, useCallback } from 'react';
import { Search, Receipt as ReceiptIcon, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';

const BRAND = { green: '#1a5c32', blue: '#29a9dc', lime: '#7fc241' };

interface ReceiptRow {
  id: string;
  clientName: string;
  amount: number;
  paymentMode: string;
  paymentType: string;
  orderId: string | null;
  invoiceNumber: string;
  recordedBy: string | null;
  status: string;
  createdAt: string;
}

// Same branded shell as the Operations dispatch ticket and the Proforma
// Invoice — logo, watermark, gradient stripe, QR verification — so a
// receipt carries the same security features as every other REBMA IMPEX
// document. invoiceNumber is the same ticket number issued elsewhere for
// this sale, not a separately generated id.
async function printReceipt(r: ReceiptRow) {
  let qrDataUrl = '';
  try {
    const QRCode = await import('qrcode');
    qrDataUrl = await QRCode.toDataURL(
      [
        'REBMA IMPEX GHANA LIMITED',
        `Receipt: ${r.invoiceNumber}`,
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

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Receipt ${r.invoiceNumber} — REBMA IMPEX</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#e8f4ea;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
    .ticket{background:#fff;width:580px;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(26,92,50,0.18);position:relative}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:62px;font-weight:900;color:rgba(26,92,50,0.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:4px;font-style:italic}
    .stripe{height:7px;background:linear-gradient(90deg,${BRAND.green},${BRAND.blue},${BRAND.lime})}
    .body{position:relative;z-index:1;padding:28px 34px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .brand{display:flex;align-items:center;gap:12px}
    .brand img{width:56px;height:56px;object-fit:contain}
    .brand-text .name{font-size:17px;font-weight:900;color:${BRAND.green};letter-spacing:.5px}
    .brand-text .sub{font-size:9px;font-weight:700;color:${BRAND.blue};letter-spacing:2px;text-transform:uppercase;margin-top:2px}
    .brand-text .addr{font-size:9px;color:#64748b;margin-top:4px}
    .ticket-meta{text-align:right}
    .ticket-meta .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:3px}
    .ticket-meta .tno{font-size:22px;font-weight:900;color:${BRAND.green};letter-spacing:1px}
    .ticket-meta .tdate{font-size:9px;color:#64748b;margin-top:3px}
    .div{height:1.5px;background:linear-gradient(90deg,${BRAND.green},${BRAND.blue},transparent);margin:16px 0;border:none;border-radius:99px}
    .status-banner{background:#f0fdf4;border:1.5px solid #16653430;border-radius:10px;padding:11px 16px;margin:14px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .sb-item .sl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:3px}
    .sb-item .sv{font-size:13px;font-weight:800;color:#166534}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:14px}
    .field{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
    .field .fl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:4px}
    .field .fv{font-size:13px;font-weight:700;color:#1e293b;line-height:1.3}
    .amount-box{background:linear-gradient(135deg,${BRAND.green},#2d7a50);border-radius:11px;padding:16px 18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
    .amount-box .dl{font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
    .amount-box .dv{font-size:22px;font-weight:800;color:#fff}
    .amount-box .dseal{border:1.5px solid rgba(255,255,255,0.5);border-radius:8px;padding:6px 13px;font-size:9px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.12em;text-align:center}
    .amount-box .dseal small{display:block;font-size:7.5px;font-weight:500;opacity:.7;margin-top:1px;text-transform:none;letter-spacing:0}
    .perf{display:flex;align-items:center;margin:0 -34px 14px;overflow:hidden}
    .perf-line{flex:1;border-top:2px dashed #cbd5e1}
    .perf-circle{width:22px;height:22px;border-radius:50%;background:#e8f4ea;flex-shrink:0}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;border-top:1px dashed #e2e8f0}
    .legal{font-size:8px;color:#94a3b8;line-height:1.8;max-width:310px}
    .legal strong{color:#64748b}
    .qr-wrap{text-align:center}
    .qr-wrap img{width:92px;height:92px;border:2px solid #e2e8f0;border-radius:8px}
    .ql{font-size:7.5px;color:#94a3b8;margin-top:3px}
    .ql2{font-size:7px;color:${BRAND.green};font-weight:700;margin-top:1px}
    .foot-bar{background:#f8fafc;border-top:1px solid #e2e8f0;padding:9px 34px;display:flex;justify-content:space-between;align-items:center}
    .foot-bar span{font-size:8.5px;color:#94a3b8}
    .foot-bar .brand-slug{color:${BRAND.green};font-weight:700}
    @media print{body{background:#fff;padding:0}.ticket{margin:0;box-shadow:none;border-radius:0;width:100%}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}.amount-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
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
            <div class="tno">${r.invoiceNumber}</div>
            <div class="tdate">${dateStr} ${timeStr}</div>
          </div>
        </div>

        <hr class="div"/>

        <div class="status-banner">
          <div class="sb-item">
            <div class="sl">Client / Customer</div>
            <div class="sv" style="font-size:12px">${r.clientName}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Status</div>
            <div class="sv">${r.status}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Recorded By (Finance)</div>
            <div class="sv" style="font-size:11px">${r.recordedBy || 'Finance'}</div>
          </div>
        </div>

        <div class="grid">
          <div class="field">
            <div class="fl">Payment Mode</div>
            <div class="fv">${r.paymentMode}</div>
          </div>
          <div class="field">
            <div class="fl">Payment Type</div>
            <div class="fv">${r.paymentType}</div>
          </div>
          <div class="field full" style="grid-column:1/-1">
            <div class="fl">Order Reference</div>
            <div class="fv">${r.orderId || '—'}</div>
          </div>
        </div>

        <div class="amount-box">
          <div>
            <div class="dl">Amount Paid</div>
            <div class="dv">GHS ${r.amount.toLocaleString()}</div>
          </div>
          <div class="dseal">PAYMENT<br/>VERIFIED<small>REBMA IMPEX</small></div>
        </div>

        <div class="perf">
          <div class="perf-circle"></div>
          <div class="perf-line"></div>
          <div class="perf-circle"></div>
        </div>

        <div class="footer">
          <div class="legal">
            This receipt is issued by <strong>REBMA IMPEX Ghana Limited</strong> Finance.<br/>
            It confirms payment has been received and recorded against the order referenced above.<br/>
            Ticket / Invoice ref: <strong>${r.invoiceNumber}</strong> — scan QR to match against the dispatch ticket and invoice.
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
        <span>REBMA IMPEX Ghana Limited · Receipt ${r.invoiceNumber} · ${new Date().toLocaleDateString('en-GB')}</span>
        <span class="brand-slug">rebmaimpex.com</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center">
      <button onclick="window.print()" style="background:${BRAND.green};color:#fff;border:none;padding:11px 30px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print Receipt</button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:11px 26px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=700,height=860');
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
        invoiceNumber: r.invoice_number || r.id,
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
    r.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.orderId || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  const handlePrintReceipt = (r: ReceiptRow) => {
    printReceipt(r);
    addNotification?.(`Opened receipt ${r.invoiceNumber} for printing.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Receipts</h2>
          <p className="text-xs text-[var(--text-muted)]">{filtered.length} receipt{filtered.length !== 1 ? 's' : ''} · GHS {totalAmount.toLocaleString()} total</p>
        </div>
        <button
          onClick={() => { exportToCSV(filtered.map(r => ({ Invoice: r.invoiceNumber, Client: r.clientName, Amount: r.amount, PaymentMode: r.paymentMode, PaymentType: r.paymentType, OrderId: r.orderId || '', RecordedBy: r.recordedBy || '', Status: r.status, Date: r.createdAt })), ['Invoice', 'Client', 'Amount', 'PaymentMode', 'PaymentType', 'OrderId', 'RecordedBy', 'Status', 'Date'], 'receipts'); addNotification?.('Exported CSV.'); }}
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
          placeholder="Search client, invoice#, order#…"
          className="w-full sm:w-96 pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
              {['Invoice', 'Client', 'Amount', 'Payment', 'Order Ref', 'Recorded By', 'Status', 'Date', ''].map(h => (
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
                  <td className="px-3 py-2 font-mono font-semibold text-[var(--text-primary)] whitespace-nowrap">{r.invoiceNumber}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{r.clientName}</td>
                  <td className="px-3 py-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap">{r.paymentMode} · {r.paymentType}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] font-mono">{r.orderId || '—'}</td>
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
