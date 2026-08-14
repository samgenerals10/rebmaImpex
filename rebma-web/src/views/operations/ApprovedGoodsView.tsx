import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Search, Download, Package, PackageCheck, TicketCheck,
  ChevronUp, ChevronDown, Truck, Printer, AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { exportToCSV, safeDisplayName } from '../../utils/export';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import CountUp from '../../components/CountUp';
import { documentTemplates, type DocumentTemplate } from '../../services/apiClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';

// ── Brand colors from REBMA logo ──────────────────────────────────────────
const BRAND = {
  green:  '#1a5c32',
  blue:   '#29a9dc',
  lime:   '#7fc241',
  gold:   '#f59e0b',
};

// ── types ──────────────────────────────────────────────────────────────────
interface ApprovedGood {
  id: string; goodsCode: string; productName: string; quantity: number;
  unit: string; weight: number; supplier: string; portOfOrigin: string;
  destination: string; approvedAt: string;
}

interface ApprovedOrder {
  id: string; ticketNumber: string; clientName: string; productName: string;
  destination: string; totalAmount: number; status: string; paymentMode: string;
  createdAt: string; submittedBy: string; issuedBy: string; issuedByEmail: string;
  phone: string;
  destinationLat: number | null; destinationLng: number | null;
  metadata?: {
    items?: Array<{ productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
    [key: string]: any;
  } | null;
}

type GoodsSort = { field: keyof ApprovedGood; dir: 'asc' | 'desc' };
type OrderSort = { field: keyof ApprovedOrder; dir: 'asc' | 'desc' };

interface Props { addNotification?: (msg: string) => void; setActiveSubTab?: (t: string) => void }

// ── ticket printer ──────────────────────────────────────────────────────────
async function printOperationsTicket(order: ApprovedOrder, template: DocumentTemplate, dispatchedQty?: number, printedBy?: string, printEnabled: boolean = true) {
  const t = template;
  // Shown on the printed ticket itself exactly as before — an email here is
  // legitimate identification, not a bug. Only the copy embedded in the QR
  // payload gets sanitized, since that's the one iOS's scanner misreads as
  // a "Mail" action instead of showing the ticket content.
  const issuedBy = order.issuedBy && order.issuedBy !== '—' ? order.issuedBy : 'Pending record';
  const issuedByForQr = safeDisplayName(order.issuedBy, 'Pending record');
  const printedByForQr = printedBy ? safeDisplayName(printedBy, '') : '';
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(
      [
        'REBMA IMPEX GHANA LIMITED',
        `Ticket: ${order.ticketNumber}`,
        `Invoice Ref: ${order.ticketNumber}`,
        `Client: ${order.clientName}`,
        `Product: ${order.productName}`,
        dispatchedQty ? `Quantity: ${dispatchedQty}` : '',
        `Destination: ${order.destination}`,
        `Payment: ${order.paymentMode}`,
        `Status: ${order.status}`,
        `Issued by: ${issuedByForQr}`,
        printedByForQr ? `Printed by: ${printedByForQr}` : '',
      ].filter(Boolean).join('\n'),
      { width: 160, margin: 1, color: { dark: '#1a5c32', light: '#ffffff' } }
    );
  } catch (err) { console.error('QR generation failed for ticket', order.ticketNumber, err); qrDataUrl = ''; }

  const statusColors: Record<string, [string, string]> = {
    APPROVED:        ['#f0fdf4', '#166534'],
    PROCESSING:      ['#eff6ff', '#1e40af'],
    OUT_FOR_DELIVERY:['#fefce8', '#92400e'],
    DELIVERED:       ['#f0fdf4', '#166534'],
  };
  const [sBg, sColor] = statusColors[order.status] || ['#f8fafc', '#334155'];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Ops Ticket ${order.ticketNumber} — REBMA IMPEX</title>
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
            <img src="${t.logoUrl.startsWith('http') || t.logoUrl.startsWith('data:') ? t.logoUrl : window.location.origin + t.logoUrl}" alt="${t.companyName}"/>
            <div class="brand-text">
              <div class="name">${t.companyName}</div>
              <div class="sub">${t.subtitle}</div>
              <div class="addr">${t.companyAddress}${t.companyPhone ? ` · Tel: ${t.companyPhone}` : ''}${t.companyEmail ? ` · ${t.companyEmail}` : ''}</div>
            </div>
          </div>
          <div class="ticket-meta">
            <div class="label">Ticket No.</div>
            <div class="tno">${order.ticketNumber || `TKT-${order.id.slice(0, 6).toUpperCase()}`}</div>
            <div class="tdate">${new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
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
            <div class="sl">Payment Mode</div>
            <div class="sv">${order.paymentMode}</div>
          </div>
          <div class="sb-item">
            <div class="sl">Issued By (Finance)</div>
            <div class="sv" style="font-size:11px">${issuedBy}</div>
          </div>
          ${printedBy ? `<div class="sb-item"><div class="sl">Printed By (Ops)</div><div class="sv" style="font-size:11px">${printedBy}</div></div>` : ''}
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
            <div class="dl">Operations Action Required</div>
            <div class="dv">Verify → Load Goods → Release to Dispatch Driver</div>
          </div>
          <div class="dseal">OPS VERIFIED<small>REBMA IMPEX</small></div>
        </div>

        <div class="perf">
          <div class="perf-circle"></div>
          <div class="perf-line"></div>
          <div class="perf-circle"></div>
        </div>

        <div class="footer">
          <div class="legal">
            ${t.footerNote}<br/>
            Invoice ref: <strong>${order.ticketNumber}</strong> — scan QR to match against customer invoice.
          </div>
          <div class="qr-wrap">
            ${qrDataUrl
              ? `<img src="${qrDataUrl}" alt="Ticket QR"/>`
              : `<div style="width:92px;height:92px;border:2px dashed #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8">QR</div>`}
            <div class="ql">Scan to verify</div>
            <div class="ql2">Matches customer invoice</div>
          </div>
        </div>

      </div>
      <div class="foot-bar">
        <span>${t.companyName} Ghana Limited · Ticket ${order.ticketNumber} · ${new Date().toLocaleDateString('en-GB')}</span>
        <span class="brand-slug">${t.website}</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center">
      ${printEnabled ? `<button onclick="window.print()" style="background:${BRAND.green};color:#fff;border:none;padding:11px 30px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print Ticket</button>` : `<button disabled title="Printing is currently disabled by the CEO" style="background:#cbd5e1;color:#64748b;border:none;padding:11px 30px;border-radius:9px;font-size:13px;font-weight:700;cursor:not-allowed">🖨 Print (disabled)</button>`}
      <button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:11px 26px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=700,height=860');
  if (win) { win.document.write(html); win.document.close(); }
  else { alert('Your browser blocked the ticket pop-up. Please allow pop-ups for this site, then try again.'); }
}

// ── helpers ────────────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    APPROVED:         'bg-emerald-100 text-emerald-700',
    PROCESSING:       'bg-indigo-100 text-indigo-700',
    OUT_FOR_DELIVERY: 'bg-amber-100 text-amber-700',
    DELIVERED:        'bg-emerald-100 text-emerald-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

// ── component ──────────────────────────────────────────────────────────────
export default function ApprovedGoodsView({ addNotification, setActiveSubTab: _sat }: Props) {
  const { getSetting } = useCeoSettings();
  const [goods, setGoods] = useState<ApprovedGood[]>([]);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);
  // Orders already handed to a driver (a delivery_logs row exists) — since
  // an order no longer flips to OUT_FOR_DELIVERY the instant it's dispatched
  // (that now only happens once the driver actually starts moving), status
  // alone can't tell "not yet dispatched" from "dispatched, driver not
  // moving yet" apart. This does.
  const [dispatchedOrderIds, setDispatchedOrderIds] = useState<Set<string>>(new Set());
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [goodsSearch, setGoodsSearch] = useState('');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'goods' | 'orders'>('orders');
  const [goodsSort, setGoodsSort] = useState<GoodsSort>({ field: 'approvedAt', dir: 'desc' });
  const [orderSort, setOrderSort] = useState<OrderSort>({ field: 'createdAt', dir: 'desc' });

  // Dispatch modal
  const [dispatchTarget, setDispatchTarget] = useState<ApprovedOrder | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ vehicleId: '', driverName: '' });
  const [dispatching, setDispatching] = useState(false);

  // Get current logged-in user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail(data.user?.email || data.user?.id || 'Operations Staff');
      setCurrentUserId(data.user?.id || '');
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: cargoData }, { data: ordersData }, { data: deliveryLogRows }] = await Promise.all([
          supabase.from('cargo_intake').select('*').eq('status', 'APPROVED').order('updated_at', { ascending: false }).limit(200),
          supabase.from('orders').select('*').in('status', ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED']).order('created_at', { ascending: false }).limit(200),
          supabase.from('delivery_logs').select('order_id').not('order_id', 'is', null),
        ]);
        setDispatchedOrderIds(new Set((deliveryLogRows || []).map((d: any) => d.order_id).filter(Boolean)));

        setGoods((cargoData || []).map((r: any) => ({
          id: String(r.id),
          goodsCode: r.request_id || r.goods_code || String(r.id).slice(0, 8).toUpperCase(),
          productName: r.description || r.product_name || 'Unknown Product',
          quantity: Number(r.quantity ?? 0),
          unit: r.unit || 'units',
          weight: Number(r.weight_kg ?? r.weight ?? 0),
          supplier: r.supplier_name || r.company || '—',
          portOfOrigin: r.port_of_origin || r.country || '—',
          destination: r.destination || 'Accra Warehouse',
          approvedAt: (r.updated_at || r.created_at || '').slice(0, 10),
        })));

        setOrders((ordersData || []).map((r: any) => ({
          id: String(r.id),
          ticketNumber: r.ticket_number || r.ticketNumber || '',
          clientName: r.client_name || r.clientName || '',
          productName: r.product_name || r.productName || '',
          destination: r.destination || '',
          totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
          status: r.status || 'APPROVED',
          paymentMode: r.payment_mode || r.paymentMode || 'CASH',
          createdAt: (r.created_at || r.createdAt || '').slice(0, 10),
          submittedBy: r.created_by || r.submittedBy || '—',
          issuedBy: r.finance_approved_by || r.created_by || '—',
          issuedByEmail: r.finance_approved_by_email || '',
          phone: r.phone || '',
          destinationLat: r.destination_lat != null ? Number(r.destination_lat) : null,
          destinationLng: r.destination_lng != null ? Number(r.destination_lng) : null,
          metadata: r.metadata || null,
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── dispatch ──────────────────────────────────────────────────────────────
  const handleDispatch = async () => {
    if (!dispatchTarget) return;
    setDispatching(true);
    // Support both old (metadata.quantity) and new (metadata.items) order formats
    const meta = (dispatchTarget as any).metadata || {};
    const metaItems: { productName: string; quantity: number }[] = meta.items || [];
    const totalQty = metaItems.length > 0
      ? metaItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0)
      : Number(meta.quantity || (dispatchTarget as any).quantity || 1);

    try {
      // 1. Create delivery_log — this is the sole handoff point from
      // Operations to Dispatch (Finance's approval no longer creates one).
      // Driver name is optional here: if Operations names a driver on the
      // spot the delivery starts ASSIGNED, otherwise it lands as
      // PENDING_ASSIGNMENT so it shows up in Dispatch's own "Assign Driver"
      // queue for them to pick one.
      const { error: dispatchInsertError } = await supabase.from('delivery_logs').insert({
        order_id: dispatchTarget.id,
        customer_name: dispatchTarget.clientName,
        delivery_address: dispatchTarget.destination,
        destination_lat: dispatchTarget.destinationLat,
        destination_lng: dispatchTarget.destinationLng,
        vehicle_id: dispatchForm.vehicleId || 'TBD',
        driver_name: dispatchForm.driverName || null,
        status: dispatchForm.driverName ? 'ASSIGNED' : 'PENDING_ASSIGNMENT',
        updated_at: new Date().toISOString(),
      });
      if (dispatchInsertError) throw dispatchInsertError;

      // 2. Order stays at its current status (APPROVED/PROCESSING) — being
      // assigned a driver isn't the same as the driver actually moving.
      // dispatchedOrderIds (below) is what actually hides the Dispatch
      // button now; orders.status only becomes OUT_FOR_DELIVERY once the
      // driver starts sharing live location from their tracking screen.

      // Note: Stock table and stock ledger are updated immediately upon Finance payment approval.
      // Dispatch only updates delivery logs, global audits, and status to avoid double-deductions.

      // 4. Audit trail
      await supabase.from('global_audit_history').insert({
        action: 'DISPATCH_ORDER',
        department: 'OPERATIONS',
        performed_by: currentUserEmail,
        user_id: currentUserId,
        details: `Order ${dispatchTarget.ticketNumber} loaded to dispatch. Product: ${dispatchTarget.productName}, Qty: ${totalQty}, Client: ${dispatchTarget.clientName}, Destination: ${dispatchTarget.destination}. Vehicle: ${dispatchForm.vehicleId || 'TBD'}, Driver: ${dispatchForm.driverName || 'TBD'}.`,
        timestamp: new Date().toISOString(),
      });

      // 5. Update local state
      setDispatchedOrderIds(prev => new Set(prev).add(dispatchTarget.id));

      addNotification?.(`Order ${dispatchTarget.ticketNumber} assigned to a driver — will show Out for Delivery once they start the trip.`);
      setDispatchTarget(null);
      setDispatchForm({ vehicleId: '', driverName: '' });
    } catch (e: any) {
      alert(e.message || 'Failed to send to dispatch.');
    }
    setDispatching(false);
  };

  // ── sort / filter ──────────────────────────────────────────────────────
  const filteredGoods = [...goods]
    .filter(g => {
      const q = goodsSearch.toLowerCase();
      return !goodsSearch || g.productName.toLowerCase().includes(q) || g.goodsCode.toLowerCase().includes(q) || g.supplier.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const va = a[goodsSort.field], vb = b[goodsSort.field];
      const c = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return goodsSort.dir === 'asc' ? c : -c;
    });

  const filteredOrders = [...orders]
    .filter(o => {
      const q = ordersSearch.toLowerCase();
      const ms = !ordersSearch || o.clientName.toLowerCase().includes(q) || o.ticketNumber.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q);
      const mst = ordersStatusFilter === 'ALL' || o.status === ordersStatusFilter;
      return ms && mst;
    })
    .sort((a, b) => {
      const va = a[orderSort.field], vb = b[orderSort.field];
      const c = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return orderSort.dir === 'asc' ? c : -c;
    });

  const totalGoodsQty = goods.reduce((s, g) => s + g.quantity, 0);
  const pendingDispatch = orders.filter(o => (o.status === 'APPROVED' || o.status === 'PROCESSING') && !dispatchedOrderIds.has(o.id)).length;
  const inTransit = orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Approved Goods</h2>
        <p className="text-xs text-[var(--text-muted)]">Port-approved cargo and finance-cleared orders ready for dispatch</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Approved Cargo Batches', value: goods.length, color: BRAND.blue, icon: <Package size={16} /> },
          { label: 'Total Port Units', value: totalGoodsQty, color: BRAND.green, icon: <PackageCheck size={16} /> },
          { label: 'Awaiting Dispatch', value: pendingDispatch, color: BRAND.gold, icon: <TicketCheck size={16} />, alert: pendingDispatch > 0 },
          { label: 'In Transit', value: inTransit, color: BRAND.lime, icon: <Truck size={16} /> },
        ].map(c => (
          <div key={c.label} className={`bg-[var(--bg-card)] border rounded-2xl p-4 shadow-[var(--box-shadow)] ${(c as any).alert ? 'border-amber-400' : 'border-[var(--border)]'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide leading-tight">{c.label}</p>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: c.color }}><CountUp value={c.value} /></p>
            {(c as any).alert && (
              <p className="text-[9px] text-amber-600 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={9} /> Action required</p>
            )}
          </div>
        ))}
      </div>

      {/* Workflow banner */}
      <div className="flex items-start gap-3 border rounded-xl px-4 py-3" style={{ background: '#f0fdf4', borderColor: `${BRAND.green}40` }}>
        <Truck size={14} style={{ color: BRAND.green }} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold" style={{ color: BRAND.green }}>Operations Workflow</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#2d7a50' }}>
            Finance approves payment → order appears here as <strong>APPROVED</strong> →
            Operations verifies, enters quantity + vehicle, clicks <strong>"Load to Dispatch"</strong> →
            stock ledger updated → Dispatch team picks up → Driver delivers → <strong>DELIVERED</strong>.
            Print the <strong>Ticket</strong> (Ops keeps) · <strong>Invoice</strong> goes via Marketing to customer.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { key: 'orders' as const, label: `Orders Ready for Dispatch (${orders.length})` },
          { key: 'goods' as const, label: `Port-Approved Cargo (${goods.length})` },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} title={t.key === 'orders' ? 'Orders Finance has approved, ready to load and hand to Dispatch' : 'Cargo intake approved by Management, awaiting warehouse processing'}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === t.key ? 'text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            style={activeTab === t.key ? { background: 'var(--accent)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ORDERS TAB ── */}
      {activeTab === 'orders' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input value={ordersSearch} onChange={e => setOrdersSearch(e.target.value)} placeholder="Search client, ticket…"
                  className="pl-8 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none w-52" />
              </div>
              <SearchableDropdown
                value={ordersStatusFilter}
                onChange={setOrdersStatusFilter}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'APPROVED', label: 'Approved, Awaiting Dispatch' },
                  { value: 'PROCESSING', label: 'Processing' },
                  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
                  { value: 'DELIVERED', label: 'Delivered' },
                ]}
                className="w-56"
              />
              <SearchableDropdown
                value={orderSort.field}
                onChange={v => setOrderSort(s => ({ ...s, field: v as OrderSort['field'] }))}
                options={[
                  { value: 'ticketNumber', label: 'Sort: Ticket #' },
                  { value: 'clientName', label: 'Sort: Client' },
                  { value: 'productName', label: 'Sort: Product' },
                  { value: 'destination', label: 'Sort: Destination' },
                  { value: 'paymentMode', label: 'Sort: Payment' },
                  { value: 'issuedBy', label: 'Sort: Issued By' },
                  { value: 'status', label: 'Sort: Status' },
                  { value: 'createdAt', label: 'Sort: Date' },
                ]}
                className="w-40"
              />
              <button onClick={() => setOrderSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
                title="Toggle sort direction"
                className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">
                {orderSort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            <button onClick={() => exportToCSV(filteredOrders.map(o => ({ Ticket: o.ticketNumber, Client: o.clientName, Product: o.productName, Status: o.status, 'Issued By': o.issuedBy, Date: o.createdAt })), ['Ticket','Client','Product','Status','Issued By','Date'], 'approved_orders')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer whitespace-nowrap">
              <Download size={13} /> Export CSV
            </button>
          </div>

          <div className="p-3">
            <ResponsiveDataView<ApprovedOrder>
              columns={[
                { key: 'clientName', label: 'Client', primary: true },
                { key: 'ticketNumber', label: 'Ticket #', render: o => <span className="font-mono font-bold" style={{ color: BRAND.green }}>{o.ticketNumber || '—'}</span> },
                { key: 'productName', label: 'Product', render: o => o.productName || '—' },
                { key: 'destination', label: 'Destination', render: o => o.destination || '—' },
                { key: 'paymentMode', label: 'Payment' },
                { key: 'issuedBy', label: 'Issued By' },
                { key: 'status', label: 'Status', status: true, render: o => <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusBadge(o.status)}`}>{o.status.replace(/_/g, ' ')}</span> },
                { key: 'createdAt', label: 'Date' },
              ]}
              data={filteredOrders}
              rowKey={o => o.id}
              loading={loading}
              emptyTitle="No approved orders found"
              renderActions={o => (
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                      const totalQty = o.metadata?.items && o.metadata.items.length > 0
                        ? o.metadata.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
                        : Number(o.metadata?.quantity || (o as any).quantity || 1);
                      const template = await documentTemplates.get('TICKET');
                      printOperationsTicket(o, template, totalQty, currentUserEmail, getSetting('print_enabled', true));
                    }}
                    title="Print Operations Ticket"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--accent-light)] cursor-pointer whitespace-nowrap transition-colors">
                    <Printer size={11} /> Ticket
                  </button>
                  {(o.status === 'APPROVED' || o.status === 'PROCESSING') && !dispatchedOrderIds.has(o.id) && (
                    <button onClick={() => { setDispatchTarget(o); setDispatchForm({ vehicleId: '', driverName: '' }); }}
                      title="Assign a vehicle and driver, then release this order to Dispatch"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer whitespace-nowrap transition-opacity"
                      style={{ background: 'var(--accent)' }}>
                      <Truck size={11} /> Dispatch
                    </button>
                  )}
                  {(o.status === 'APPROVED' || o.status === 'PROCESSING') && dispatchedOrderIds.has(o.id) && (
                    <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><Truck size={9} /> Assigned — awaiting pickup</span>
                  )}
                  {o.status === 'OUT_FOR_DELIVERY' && (
                    <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1"><Truck size={9} /> In Transit</span>
                  )}
                  {o.status === 'DELIVERED' && (
                    <span className="text-[9px] font-bold" style={{ color: BRAND.green }}>✓ Delivered</span>
                  )}
                </div>
              )}
            />
          </div>

          {filteredOrders.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              {filteredOrders.length} orders · {pendingDispatch} awaiting dispatch · {inTransit} in transit
              {currentUserEmail && <span className="ml-3 opacity-60">Logged in as: {currentUserEmail}</span>}
            </div>
          )}
        </div>
      )}

      {/* ── GOODS TAB ── */}
      {activeTab === 'goods' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={goodsSearch} onChange={e => setGoodsSearch(e.target.value)} placeholder="Search product, code, supplier…"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SearchableDropdown
                value={goodsSort.field}
                onChange={v => setGoodsSort(s => ({ ...s, field: v as GoodsSort['field'] }))}
                options={[
                  { value: 'goodsCode', label: 'Sort: Goods Code' },
                  { value: 'productName', label: 'Sort: Product' },
                  { value: 'quantity', label: 'Sort: Quantity' },
                  { value: 'supplier', label: 'Sort: Supplier' },
                  { value: 'portOfOrigin', label: 'Sort: Port of Origin' },
                  { value: 'destination', label: 'Sort: Destination' },
                  { value: 'approvedAt', label: 'Sort: Approved On' },
                ]}
                className="w-44"
              />
              <button onClick={() => setGoodsSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
                title="Toggle sort direction"
                className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">
                {goodsSort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={() => exportToCSV(filteredGoods.map(g => ({ 'Goods Code': g.goodsCode, Product: g.productName, Qty: g.quantity, Unit: g.unit, Supplier: g.supplier, 'Approved On': g.approvedAt })), ['Goods Code','Product','Qty','Unit','Supplier','Approved On'], 'approved_cargo')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] cursor-pointer whitespace-nowrap">
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>
          <div className="p-3">
            <ResponsiveDataView<ApprovedGood>
              columns={[
                { key: 'productName', label: 'Product', primary: true, render: g => <div className="flex items-center gap-2"><Package size={11} className="text-[var(--text-muted)]" />{g.productName}</div> },
                { key: 'goodsCode', label: 'Goods Code', render: g => <span className="font-mono font-semibold" style={{ color: BRAND.green }}>{g.goodsCode}</span> },
                { key: 'quantity', label: 'Quantity', render: g => <span className="font-bold" style={{ color: BRAND.blue }}>{g.quantity.toLocaleString()} <span className="font-normal text-[var(--text-muted)]">{g.unit}</span></span> },
                { key: 'supplier', label: 'Supplier' },
                { key: 'portOfOrigin', label: 'Port of Origin' },
                { key: 'destination', label: 'Destination' },
                { key: 'approvedAt', label: 'Approved On' },
              ]}
              data={filteredGoods}
              rowKey={g => g.id}
              loading={loading}
              emptyTitle="No approved cargo yet"
            />
          </div>
          {filteredGoods.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              {filteredGoods.length} batches · {totalGoodsQty.toLocaleString()} total units
            </div>
          )}
        </div>
      )}

      {/* ── DISPATCH MODAL ── */}
      <SidePanel
        open={!!dispatchTarget}
        onClose={() => setDispatchTarget(null)}
        title="Load to Dispatch"
        subtitle="Confirm goods, vehicle and driver to release this order"
        footer={
          <>
            <button onClick={() => setDispatchTarget(null)} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={handleDispatch} disabled={dispatching}
              title="Deducts stock, creates a delivery log, and releases this order to the assigned driver"
              className="erp-btn erp-btn-primary disabled:opacity-50">
              <Truck size={13} /> {dispatching ? 'Sending…' : 'Confirm & Load to Dispatch'}
            </button>
          </>
        }
      >
        {dispatchTarget && (
          <div>
            {/* Order summary */}
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 mb-4 space-y-1.5">
              {[
                ['Ticket', dispatchTarget.ticketNumber],
                ['Client', dispatchTarget.clientName],
                ['Product', dispatchTarget.productName || '—'],
                ['Destination', dispatchTarget.destination || '—'],
                ['Payment Mode', dispatchTarget.paymentMode],
                ['Issued By', dispatchTarget.issuedBy],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{k}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{v}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 mb-5">
              {/* Read-only order quantity */}
              <div className="bg-[var(--accent-light)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Quantity (from order)</span>
                  <span className="font-bold" style={{ color: BRAND.green }}>
                    {Number((dispatchTarget as any)?.quantity || (dispatchTarget as any)?.metadata?.quantity || 'N/A').toLocaleString()} units
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">This quantity will be recorded as OUT in the stock ledger</p>
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Vehicle ID / Plate Number</label>
                <input value={dispatchForm.vehicleId} onChange={e => setDispatchForm(f => ({ ...f, vehicleId: e.target.value }))}
                  placeholder="e.g. GH-1234-22" className="erp-input" />
              </div>
              <div className="erp-form-group">
                <label className="erp-label">Driver Name <span className="font-normal normal-case text-[var(--text-muted)]">(optional)</span></label>
                <input value={dispatchForm.driverName} onChange={e => setDispatchForm(f => ({ ...f, driverName: e.target.value }))}
                  placeholder="e.g. Kofi Mensah" className="erp-input" />
              </div>
            </div>

            {currentUserEmail && (
              <div className="text-[10px] text-[var(--text-muted)] mb-4 px-1">
                This action will be attributed to: <strong className="text-[var(--text-secondary)]">{currentUserEmail}</strong>
              </div>
            )}

            <p className="text-[10px] text-[var(--text-muted)] text-center">
              Order to <strong>OUT_FOR_DELIVERY</strong>. Stock ledger REMOVE entry created. Audit trail recorded
            </p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
