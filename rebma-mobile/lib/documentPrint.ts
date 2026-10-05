// rebma-mobile/lib/documentPrint.ts
//
// Phone versions of the laptop's branded Proforma Invoice and Receipt
// (rebma-web/src/views/ceo/InvoicesView.tsx printProforma and
// rebma-web/src/views/finance/ReceiptsView.tsx printReceipt): same layout,
// printed through the phone's own print dialog, which can also save a PDF.
import * as Print from 'expo-print';
import QRCode from 'qrcode';
import type { DocumentTemplate } from '../components/shared/DocumentTemplatesEditor';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

// Relative logo paths live on the web app; use its address when set.
function logoSrc(url: string): string {
  if (!url) return API_BASE ? `${API_BASE}/logo.png` : '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return API_BASE ? API_BASE + url : '';
}

// An email address is never put inside a QR code (phones read it as a mail link).
function safeDisplayName(name: string | null | undefined, fallback: string): string {
  if (!name || !name.trim()) return fallback;
  return name.includes('@') ? fallback : name;
}

export interface OrderLineItem { productName: string; quantity: number; unitPrice?: number; lineTotal?: number; [key: string]: any }

const BRAND = { green: '#1a5c32', blue: '#29a9dc', lime: '#7fc241' };

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function threeDigitsToWords(n: number): string {
  let out = '';
  if (n >= 100) { out += `${ONES[Math.floor(n / 100)]} Hundred`; n %= 100; if (n) out += ' '; }
  if (n >= 20) { out += TENS[Math.floor(n / 10)]; if (n % 10) out += `-${ONES[n % 10]}`; }
  else if (n > 0) { out += ONES[n]; }
  return out;
}
function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let scaleIdx = 0;
  const parts: string[] = [];
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) parts.unshift(`${threeDigitsToWords(chunk)}${scales[scaleIdx] ? ' ' + scales[scaleIdx] : ''}`);
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return parts.join(' ');
}
function amountToWords(amount: number): string {
  const cedis = Math.floor(amount);
  const pesewas = Math.round((amount - cedis) * 100);
  const cedisWords = `${numberToWords(cedis)} Ghana Cedi${cedis === 1 ? '' : 's'}`;
  return pesewas > 0 ? `${cedisWords}, ${numberToWords(pesewas)} Pesewa${pesewas === 1 ? '' : 's'} Only` : `${cedisWords} Only`;
}

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
  // Captured from the underlying order at the time the payment was
  // recorded — display-only here, not editable from this screen. To
  // correct it, fix the order/customer record it came from.
  customerPhone?: string;
}

export interface ProformaLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface ProformaRow {
  id: string;
  proforma_no: string;
  order_id: string | null;
  client_name: string;
  line_items: ProformaLineItem[];
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'CONVERTED';
  notes: string | null;
  created_at: string;
  // Captured when Marketing/CEO generates the invoice — display-only here,
  // not editable from this screen.
  contact_info?: { customerPhone?: string } | null;
}

export async function printProforma(r: ProformaRow, issuedBy: string, template: DocumentTemplate, printEnabled: boolean = true) {
  if (!printEnabled) throw new Error('Printing is currently turned off by the CEO.');
  const GREEN = '#1a5c32', BLUE = '#29a9dc', LIME = '#7fc241';
  const t = template;
  const customerPhone = r.contact_info?.customerPhone || '';
  // Shown on the printed invoice itself exactly as before — an email here is
  // legitimate identification, not a bug. Only the copy embedded in the QR
  // payload gets sanitized, since that's the one iOS's scanner misreads as
  // a "Mail" action instead of showing the invoice content.
  const issuedByForQr = safeDisplayName(issuedBy, 'REBMA IMPEX Staff');
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toString(
      `REBMA IMPEX GHANA LIMITED\nProforma: ${r.proforma_no}\nCustomer: ${r.client_name}\nGrand Total: ${r.currency} ${Number(r.grand_total).toLocaleString()}\nIssued by: ${issuedByForQr}`,
      { type: 'svg', width: 110, margin: 1, color: { dark: GREEN, light: '#ffffff' } }
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
          <img src="${logoSrc(t.logoUrl)}" alt="${t.companyName}"/>
          <div class="logo-block">
            <div class="company">${t.companyName}</div>
            <div class="tagline">Ghana Limited</div>
            <div class="address">${t.companyAddress}<br/>${t.companyPhone ? `Tel: ${t.companyPhone}` : ''}${t.companyPhone && t.companyEmail ? ' &bull; ' : ''}${t.companyEmail || ''}</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-label">${t.subtitle}</div>
          <div class="inv-no">${r.proforma_no}</div>
          <div class="inv-date">Issued: ${dateStr}</div>
          <span class="badge">Not a Tax Invoice</span>
        </div>
      </div>
      <hr class="divider"/>
      <div class="bill-box">
        <div class="blabel">Prepared For</div>
        <div class="bname">${r.client_name}</div>
        ${customerPhone ? `<div style="font-size:12px;color:#64748b;margin-top:3px">Tel: ${customerPhone}</div>` : ''}
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
          ${t.footerNote}<br/>
          Issued by ${issuedBy}, ${t.companyName} Ghana Limited.
        </div>
        <div class="qr-block">
          ${qrDataUrl ? `<div class="qr-svg">${qrDataUrl}</div>` : ''}
          <div class="qlabel">Scan to verify</div>
        </div>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin:16px 0 32px">
  </div>
  </body></html>`;
  await Print.printAsync({ html });
}

export async function printReceipt(r: ReceiptRow, lineItems: OrderLineItem[] | null, template: DocumentTemplate, printEnabled: boolean = true) {
  if (!printEnabled) throw new Error('Printing is currently turned off by the CEO.');
  const t = template;
  // Shown on the printed receipt itself exactly as before — including a raw
  // email if that's what's on file, which is legitimate identification, not
  // a bug. Only the copy embedded in the QR payload gets sanitized, since
  // that's the one iOS's scanner misreads as a "Mail" action.
  const recordedBy = r.recordedBy || 'Account Department';
  const recordedByForQr = safeDisplayName(r.recordedBy, 'Account Department');
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toString(
      [
        'REBMA IMPEX GHANA LIMITED',
        `Receipt: ${r.receiptNumber}`,
        `Client: ${r.clientName}`,
        `Amount: GHS ${r.amount.toLocaleString()}`,
        `Payment: ${r.paymentMode}, ${r.paymentType}`,
        `Recorded by: ${recordedByForQr}`,
        `Status: ${r.status}`,
      ].join('\n'),
      { type: 'svg', width: 110, margin: 1, color: { dark: BRAND.green, light: '#ffffff' } }
    );
  } catch (err) { console.error('QR generation failed for receipt', r.receiptNumber, err); qrDataUrl = ''; }

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
    : `<tr><td colspan="4" class="it-empty">Payment for Order ${r.orderId || '—'}. Itemized breakdown not available for this record.</td></tr>`;

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
    .details-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
    .details-grid .fld{background:#f8fafc;border:1px solid #eef2f6;border-radius:9px;padding:8px 12px}
    .details-grid .fld.full{grid-column:1/-1}
    .details-grid .fl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#94a3b8;margin-bottom:2px}
    .details-grid .fv{font-size:12px;font-weight:700;color:#1e293b}
    .items{width:100%;border-collapse:collapse;margin-bottom:10px}
    .items thead th{background:#f0fdf4;color:${BRAND.green};font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:9px 10px;border-bottom:1.5px solid #16653430}
    .items thead th.it-num{text-align:right}
    .items td{padding:9px 10px;font-size:11.5px;color:#1e293b;border-bottom:1px solid #f1f5f9}
    .items td.it-num{text-align:right;font-variant-numeric:tabular-nums}
    .items td.it-total{font-weight:700}
    .items td.it-empty{color:#94a3b8;font-style:italic;font-size:10.5px;padding:16px 10px;text-align:center}
    .summary{display:flex;justify-content:space-between;align-items:center;gap:16px;background:linear-gradient(135deg,${BRAND.green},#2d7a50);border-radius:12px;padding:14px 18px;margin-bottom:14px}
    .summary .sw{color:rgba(255,255,255,0.85);font-size:11px;line-height:1.5;max-width:280px}
    .summary .sw b{color:#fff}
    .summary .sr{text-align:right}
    .summary .sl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,0.65);margin-bottom:3px}
    .summary .sv{font-size:22px;font-weight:900;color:#fff;white-space:nowrap}
    .verified{display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #16653430;border-radius:99px;padding:5px 14px;font-size:9.5px;font-weight:800;color:${BRAND.green};text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}
    .thanks{font-size:11px;color:#475569;margin-bottom:16px}
    .thanks b{color:${BRAND.green}}
    .perf{display:flex;align-items:center;margin:0 -34px 14px;overflow:hidden}
    .perf-line{flex:1;border-top:2px dashed #cbd5e1}
    .perf-circle{width:22px;height:22px;border-radius:50%;background:#e8f4ea;flex-shrink:0}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-top:6px}
    .legal{font-size:8px;color:#94a3b8;line-height:1.8;max-width:330px}
    .legal strong{color:#64748b}
    .qr-wrap{text-align:center}
    .qr-wrap img{width:92px;height:92px;border:2px solid #e2e8f0;border-radius:8px}
    .ql{font-size:7.5px;color:#94a3b8;margin-top:3px}
    .ql2{font-size:7px;color:${BRAND.green};font-weight:700;margin-top:1px}
    .foot-bar{background:#f8fafc;border-top:1px solid #e2e8f0;padding:9px 34px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}
    .foot-bar span{font-size:8.5px;color:#94a3b8}
    .foot-bar .brand-slug{color:${BRAND.green};font-weight:700}
    @media print{body{background:#fff;padding:0}.ticket{margin:0;box-shadow:none;border-radius:0;width:100%}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}.items thead th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
  </style></head><body>
  <div>
    <div class="ticket">
      <div class="stripe"></div>
      <div class="watermark">REBMA IMPEX</div>
      <div class="body">

        <div class="header">
          <div class="brand">
            <img src="${logoSrc(t.logoUrl)}" alt="${t.companyName}"/>
            <div class="brand-text">
              <div class="name">${t.companyName}</div>
              <div class="sub">${t.subtitle}</div>
              <div class="addr">${t.companyAddress}${t.companyPhone ? ` · Tel: ${t.companyPhone}` : ''}${t.companyEmail ? ` · ${t.companyEmail}` : ''}</div>
            </div>
          </div>
          <div class="ticket-meta">
            <div class="label">Receipt No.</div>
            <div class="tno">${r.receiptNumber}</div>
            <div class="tdate">${dateStr} ${timeStr}</div>
          </div>
        </div>

        <hr class="div"/>

        <div class="details-grid">
          <div class="fld"><div class="fl">Client</div><div class="fv">${r.clientName}</div></div>
          <div class="fld"><div class="fl">Customer Phone</div><div class="fv">${r.customerPhone || '—'}</div></div>
          <div class="fld"><div class="fl">Order Ref</div><div class="fv">${r.ticketNumber || r.orderId || '—'}</div></div>
          <div class="fld"><div class="fl">Payment Method</div><div class="fv">${r.paymentMode} · ${r.paymentType}</div></div>
          <div class="fld full"><div class="fl">Recorded By</div><div class="fv">${recordedBy}</div></div>
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

        <div class="summary">
          <div class="sw"><b>Amount in words:</b><br/>${amountToWords(r.amount)}</div>
          <div class="sr">
            <div class="sl">Amount Paid</div>
            <div class="sv">GHS ${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div class="verified">✓ Payment Verified, ${r.status}</div>

        <div class="perf">
          <div class="perf-circle"></div>
          <div class="perf-line"></div>
          <div class="perf-circle"></div>
        </div>

        <div class="footer">
          <div class="legal">
            ${t.footerNote}<br/>
            Receipt <strong>${r.receiptNumber}</strong> documents this payment; order ticket <strong>${r.ticketNumber || '—'}</strong> is a separate record. Scan the QR code to verify both match.
          </div>
          <div class="qr-wrap">
            ${qrDataUrl
              ? `<div class="qr-svg">${qrDataUrl}</div>`
              : `<div style="width:92px;height:92px;border:2px dashed #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8">QR</div>`}
            <div class="ql">Scan to verify</div>
            <div class="ql2">Matches ticket &amp; invoice</div>
          </div>
        </div>

      </div>
      <div class="foot-bar">
        <span>${t.companyName} Ghana Limited · Receipt ${r.receiptNumber} · ${new Date().toLocaleDateString('en-GB')}</span>
        <span class="brand-slug">${t.website}</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center">
    </div>
  </div>
  </body></html>`;

  await Print.printAsync({ html });
}
