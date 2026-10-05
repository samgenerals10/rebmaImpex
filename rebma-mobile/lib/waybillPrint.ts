// rebma-mobile/lib/waybillPrint.ts
//
// Phone version of rebma-web/src/utils/waybillPrint.ts: the same Waybill
// document, printed through the phone's own print dialog (which can also
// save it as a PDF). Only Risk makes and prints waybills. The first print
// for a delivery creates its waybill number; later prints reuse it.
import * as Print from 'expo-print';
import QRCode from 'qrcode';
import { supabase } from './supabaseClient';
import { getDocumentTemplate } from '../components/shared/DocumentTemplatesEditor';

const BRAND = {
  green:  '#1a5c32',
  blue:   '#29a9dc',
  lime:   '#7fc241',
  gold:   '#f59e0b',
};

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

/** True when this delivery already has a waybill number. */
export async function waybillExists(deliveryLogId: string): Promise<boolean> {
  const { data } = await supabase.from('waybills').select('id').eq('delivery_log_id', deliveryLogId).limit(1);
  return !!(data && data.length > 0);
}

/**
 * Makes (on first print) and prints the waybill for one delivery. Throws
 * with a plain message if something is missing or Risk access is denied.
 */
export async function printWaybillForDelivery(
  deliveryLogId: string,
  opts: { containerNumber?: string; printedBy?: string; printEnabled?: boolean } = {},
): Promise<void> {
  const { containerNumber: containerInput, printedBy, printEnabled = true } = opts;
  if (!printEnabled) throw new Error('Printing is currently turned off by the CEO.');

  const { data: deliveryLog } = await supabase.from('delivery_logs').select('*').eq('id', deliveryLogId).maybeSingle();
  if (!deliveryLog?.order_id) throw new Error('This delivery is not linked to an order, so it has no waybill.');
  const { data: o } = await supabase.from('orders').select('*').eq('id', deliveryLog.order_id).maybeSingle();
  if (!o) throw new Error('The order for this delivery could not be found.');

  const order = {
    id: o.id as string,
    ticketNumber: (o.ticket_number || '') as string,
    clientName: (o.client_name || '') as string,
    productName: (o.product_name || '') as string,
    destination: (o.destination || deliveryLog.delivery_address || '') as string,
    status: (o.status || '') as string,
    createdAt: o.created_at as string,
    issuedBy: (o.finance_approved_by || '') as string,
    phone: (o.phone || '') as string,
    metadata: (o.metadata || null) as { items?: Array<{ productName: string; quantity: number }> } | null,
  };
  const dispatchedQty = order.metadata?.items && order.metadata.items.length > 0
    ? order.metadata.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
    : Number(o.quantity || 1);
  const vehicleId = deliveryLog.vehicle_id && deliveryLog.vehicle_id !== 'TBD' ? deliveryLog.vehicle_id : '';
  const driverName = deliveryLog.driver_name || '';

  // Get or create the waybill (database allows this for Risk and the CEO only).
  let waybillNumber = '';
  let containerNumber = '';
  const { data: existing } = await supabase.from('waybills').select('*').eq('delivery_log_id', deliveryLogId).limit(1);
  if (existing && existing[0]) {
    waybillNumber = existing[0].waybill_number || '';
    containerNumber = existing[0].container_number || '';
  } else {
    const { data: created, error } = await supabase.from('waybills').insert({
      order_id: order.id,
      delivery_log_id: deliveryLogId,
      container_number: containerInput?.trim() || null,
      created_by: printedBy || null,
    }).select();
    if (error) throw new Error(`The waybill could not be created: ${error.message}`);
    waybillNumber = created?.[0]?.waybill_number || '';
    containerNumber = created?.[0]?.container_number || '';
  }

  const t = await getDocumentTemplate('WAYBILL');
  const logoSrc = t.logoUrl.startsWith('http') || t.logoUrl.startsWith('data:')
    ? t.logoUrl
    : (API_BASE ? API_BASE + (t.logoUrl || '/logo.png') : '');

  const issuedBy = order.issuedBy && order.issuedBy !== '—' ? order.issuedBy : 'Pending record';
  let qrSvg = '';
  try {
    // Same JSON the Scanner reads on both apps.
    qrSvg = await QRCode.toString(
      JSON.stringify({ waybillNumber: waybillNumber || null, orderId: order.id, containerNumber: containerNumber || null }),
      { type: 'svg', margin: 1, color: { dark: '#1a5c32', light: '#ffffff' } },
    );
  } catch {
    qrSvg = '';
  }

  const statusColors: Record<string, [string, string]> = {
    APPROVED:        ['#f0fdf4', '#166534'],
    PROCESSING:      ['#eff6ff', '#1e40af'],
    OUT_FOR_DELIVERY:['#fefce8', '#92400e'],
    DELIVERED:       ['#f0fdf4', '#166534'],
  };
  const [sBg, sColor] = statusColors[order.status] || ['#f8fafc', '#334155'];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Waybill ${waybillNumber || order.ticketNumber} — REBMA IMPEX</title>
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
    .brand-text .addr{font-size:9px;color:#64748b;margin-top:4px;line-height:1.6}
    .ticket-meta{text-align:right}
    .ticket-meta .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:3px}
    .ticket-meta .tno{font-size:22px;font-weight:900;color:${BRAND.green};letter-spacing:1px}
    .ticket-meta .tdate{font-size:9px;color:#64748b;margin-top:3px}
    .div{height:1.5px;background:linear-gradient(90deg,${BRAND.green},${BRAND.blue},transparent);margin:16px 0;border:none;border-radius:99px}
    .status-banner{background:${sBg};border:1.5px solid ${sColor}30;border-radius:10px;padding:11px 16px;margin:14px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .sb-item .sl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:3px}
    .sb-item .sv{font-size:13px;font-weight:800;color:${sColor}}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:14px}
    .field{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
    .field .fl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:4px}
    .field .fv{font-size:13px;font-weight:700;color:#1e293b;line-height:1.3}
    .field.full{grid-column:1/-1}
    .dispatch-box{background:linear-gradient(135deg,${BRAND.green},#2d7a50);border-radius:11px;padding:14px 18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
    .dispatch-box .dl{font-size:9px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
    .dispatch-box .dv{font-size:14px;font-weight:800;color:#fff}
    .dispatch-box .dseal{border:1.5px solid rgba(255,255,255,0.5);border-radius:8px;padding:6px 13px;font-size:9px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.12em;text-align:center}
    .dseal small{display:block;font-size:7.5px;font-weight:500;opacity:.7;margin-top:1px;text-transform:none;letter-spacing:0}
    .perf{display:flex;align-items:center;margin:0 -34px 14px;overflow:hidden}
    .perf-line{flex:1;border-top:2px dashed #cbd5e1}
    .perf-circle{width:22px;height:22px;border-radius:50%;background:#e8f4ea;flex-shrink:0}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;border-top:1px dashed #e2e8f0}
    .legal{font-size:8px;color:#94a3b8;line-height:1.8;max-width:310px}
    .legal strong{color:#64748b}
    .legal .email{color:${BRAND.blue};font-weight:600}
    .qr-wrap{text-align:center}
    .qr-wrap img{width:92px;height:92px;border:2px solid #e2e8f0;border-radius:8px}
    .qr-svg svg{width:92px;height:92px;border:2px solid #e2e8f0;border-radius:8px}
    .ql{font-size:7.5px;color:#94a3b8;margin-top:3px}
    .ql2{font-size:7px;color:${BRAND.green};font-weight:700;margin-top:1px}
    .foot-bar{background:#f8fafc;border-top:1px solid #e2e8f0;padding:9px 34px;display:flex;justify-content:space-between;align-items:center}
    .foot-bar span{font-size:8.5px;color:#94a3b8}
    .foot-bar .brand-slug{color:${BRAND.green};font-weight:700}
    @media print{body{background:#fff;padding:0}.ticket{margin:0;box-shadow:none;border-radius:0;width:100%}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}.dispatch-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
  </style></head><body>
  <div>
    <div class="ticket">
      <div class="stripe"></div>
      <div class="watermark">REBMA IMPEX</div>
      <div class="body">

        <div class="header">
          <div class="brand">
            ${logoSrc ? `<img src="${logoSrc}" alt="${t.companyName}"/>` : ''}
            <div class="brand-text">
              <div class="name">${t.companyName}</div>
              <div class="sub">${t.subtitle}</div>
              <div class="addr">${t.companyAddress}${t.companyPhone ? ` · Tel: ${t.companyPhone}` : ''}${t.companyEmail ? ` · ${t.companyEmail}` : ''}</div>
            </div>
          </div>
          <div class="ticket-meta">
            <div class="label">Waybill No.</div>
            <div class="tno">${waybillNumber || 'Not yet dispatched'}</div>
            <div class="tdate">Ref: ${order.ticketNumber || `TKT-${order.id.slice(0, 6).toUpperCase()}`} · ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <hr class="div"/>

        <div class="status-banner">
          <div class="sb-item">
            <div class="sl">Client / Customer</div>
            <div class="sv" style="font-size:12px">${order.clientName}</div>
          </div>
          ${order.phone ? `<div class="sb-item"><div class="sl">Customer Phone</div><div class="sv" style="font-size:11px">${order.phone}</div></div>` : ''}
          <div class="sb-item">
            <div class="sl">Status</div>
            <div class="sv">${order.status.replace(/_/g, ' ')}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Container No.</div>
            <div class="sv">${containerNumber || '—'}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Vehicle</div>
            <div class="sv" style="font-size:11px">${vehicleId || 'Not yet dispatched'}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Driver</div>
            <div class="sv" style="font-size:11px">${driverName || 'Not yet assigned'}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Issued By (Account Department)</div>
            <div class="sv" style="font-size:11px">${issuedBy}</div>
          </div>
          ${printedBy ? `<div class="sb-item"><div class="sl">Printed By (Risk)</div><div class="sv" style="font-size:11px">${printedBy}</div></div>` : ''}
        </div>

        ${(() => {
          const items = (order.metadata?.items && order.metadata.items.length > 0)
            ? order.metadata.items
            : [{ productName: order.productName || 'Item', quantity: dispatchedQty || null }];
          const totalQty = (items as any[]).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
          return `
        <div class="field full" style="background: #fafdfb; border: 1px solid #d1fae5; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
          <div class="fl" style="color: ${BRAND.green}; font-weight: 800; font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px;">Itemized Loading Dispatch List</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="border-bottom: 1.5px solid #d1fae5; color: #2d7a50; font-weight: 700; text-transform: uppercase; font-size: 8px; letter-spacing: 0.05em;">
                <th style="text-align: left; padding: 4px 0;">Item Description</th>
                <th style="text-align: right; padding: 4px 0;">Qty to Load</th>
                <th style="text-align: right; padding: 4px 0;">Delivery Destination</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr style="border-bottom: 1px solid #e6f7ed;">
                  <td style="text-align: left; padding: 6px 0; font-weight: 650; color: #1e293b;">${item.productName}</td>
                  <td style="text-align: right; padding: 6px 0; font-weight: 800; color: ${BRAND.green}; font-family: monospace; font-size: 12px;">${item.quantity != null ? Number(item.quantity).toLocaleString() : '—'}</td>
                  <td style="text-align: right; padding: 6px 0; font-weight: 650; color: #1e293b;">${order.destination || 'To be confirmed by Operations'}</td>
                </tr>
              `).join('')}
            </tbody>
            ${items.length > 1 ? `<tfoot><tr><td style="padding-top:6px;font-weight:800;color:#1e293b;">Total</td><td style="text-align:right;padding-top:6px;font-weight:800;color:${BRAND.green};font-family:monospace;">${totalQty.toLocaleString()}</td><td></td></tr></tfoot>` : ''}
          </table>
        </div>
        `; })()}

        <div class="dispatch-box">
          <div>
            <div class="dl">Released by Risk</div>
            <div class="dv">Goods checked and handed to the driver</div>
          </div>
          <div class="dseal">RISK RELEASED<small>REBMA IMPEX</small></div>
        </div>

        <div class="perf">
          <div class="perf-circle"></div>
          <div class="perf-line"></div>
          <div class="perf-circle"></div>
        </div>

        <div class="footer">
          <div class="legal">
            ${t.footerNote}<br/>
            Invoice ref: <strong>${order.ticketNumber}</strong>. Scan the QR code to match it against the customer invoice.
          </div>
          <div class="qr-wrap">
            ${qrSvg
              ? `<div class="qr-svg">${qrSvg}</div>`
              : `<div style="width:92px;height:92px;border:2px dashed #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8">QR</div>`}
            <div class="ql">Scan to verify</div>
            <div class="ql2">Matches customer invoice</div>
          </div>
        </div>

      </div>
      <div class="foot-bar">
        <span>${t.companyName} Ghana Limited · Waybill ${waybillNumber || order.ticketNumber} · ${new Date().toLocaleDateString('en-GB')}</span>
        <span class="brand-slug">${t.website}</span>
      </div>
    </div>
  </div>
  </body></html>`;

  await Print.printAsync({ html });
}
