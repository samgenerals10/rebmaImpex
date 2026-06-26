import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Search, Download, Package, PackageCheck, TicketCheck,
  ChevronUp, ChevronDown, Truck, Printer, X, AlertCircle,
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

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
}

type GoodsSort = { field: keyof ApprovedGood; dir: 'asc' | 'desc' };
type OrderSort = { field: keyof ApprovedOrder; dir: 'asc' | 'desc' };

interface Props { addNotification?: (msg: string) => void; setActiveSubTab?: (t: string) => void }

// ── ticket printer ──────────────────────────────────────────────────────────
async function printOperationsTicket(order: ApprovedOrder) {
  let qrDataUrl = '';
  try {
    const QRCode = await import('qrcode');
    // Same QR payload as the invoice so they can be matched by scanning
    qrDataUrl = await QRCode.toDataURL(
      `REBMA IMPEX GHANA LIMITED\nTicket: ${order.ticketNumber}\nInvoice Ref: ${order.ticketNumber}\nClient: ${order.clientName}\nProduct: ${order.productName}\nDestination: ${order.destination}\nPayment: ${order.paymentMode}\nIssued by: ${order.issuedBy}`,
      { width: 160, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } }
    );
  } catch { qrDataUrl = ''; }

  const logoSvg = `<svg width="44" height="44" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><polygon points="24,2 44,13 44,35 24,46 4,35 4,13" fill="#e91e8c" opacity="0.12"/><polygon points="24,6 40,15 40,33 24,42 8,33 8,15" fill="none" stroke="#e91e8c" stroke-width="1.5"/><text x="24" y="30" font-family="Arial Black,sans-serif" font-size="18" font-weight="900" fill="#e91e8c" text-anchor="middle">R</text></svg>`;

  const statusColors: Record<string, string> = {
    APPROVED: '#065f46', PROCESSING: '#1e40af', OUT_FOR_DELIVERY: '#92400e', DELIVERED: '#065f46',
  };
  const statusBg: Record<string, string> = {
    APPROVED: '#d1fae5', PROCESSING: '#dbeafe', OUT_FOR_DELIVERY: '#fef3c7', DELIVERED: '#d1fae5',
  };
  const sColor = statusColors[order.status] || '#334155';
  const sBg = statusBg[order.status] || '#f1f5f9';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Ops Ticket ${order.ticketNumber} — REBMA IMPEX</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
    .ticket{background:#fff;width:560px;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,0.18);position:relative}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64px;font-weight:900;color:rgba(233,30,140,0.05);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:4px}
    .stripe{height:6px;background:linear-gradient(90deg,#e91e8c,#7c3aed,#3b82f6)}
    .body{position:relative;z-index:1;padding:28px 32px}
    /* header */
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .brand{display:flex;align-items:center;gap:10px}
    .brand-text .name{font-size:16px;font-weight:900;color:#1e293b;letter-spacing:.5px}
    .brand-text .sub{font-size:9px;font-weight:700;color:#e91e8c;letter-spacing:2px;text-transform:uppercase}
    .ticket-type{text-align:right}
    .ticket-type .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:3px}
    .ticket-type .tno{font-size:20px;font-weight:900;color:#e91e8c;letter-spacing:1px}
    /* divider */
    .div{height:1.5px;background:linear-gradient(90deg,#e91e8c,#7c3aed,transparent);margin:16px 0;border:none;border-radius:99px}
    /* perforated edge */
    .perf{display:flex;align-items:center;gap:0;margin:0 -32px;overflow:hidden}
    .perf-line{flex:1;border-top:2px dashed #e2e8f0}
    .perf-circle{width:24px;height:24px;border-radius:50%;background:#e2e8f0;flex-shrink:0}
    /* status banner */
    .status-banner{background:${sBg};border:1.5px solid ${sColor}30;border-radius:10px;padding:10px 16px;margin:16px 0;display:flex;align-items:center;justify-content:space-between}
    .status-banner .slabel{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b}
    .status-banner .sval{font-size:13px;font-weight:800;color:${sColor};letter-spacing:.05em}
    /* info grid */
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
    .field{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
    .field .fl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:4px}
    .field .fv{font-size:13px;font-weight:700;color:#1e293b;line-height:1.3}
    .field.full{grid-column:1/-1}
    /* dispatch box */
    .dispatch-box{background:linear-gradient(135deg,#1e293b,#334155);border-radius:10px;padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
    .dispatch-box .dl{font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
    .dispatch-box .dv{font-size:15px;font-weight:800;color:#fff}
    .dispatch-box .dseal{border:1.5px solid rgba(233,30,140,0.6);border-radius:8px;padding:6px 12px;font-size:9px;font-weight:800;color:#e91e8c;text-transform:uppercase;letter-spacing:.1em}
    /* footer */
    .footer{display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;border-top:1px dashed #e2e8f0}
    .legal{font-size:8px;color:#94a3b8;line-height:1.8;max-width:300px}
    .qr-wrap{text-align:center}
    .qr-wrap img{width:88px;height:88px;border:2px solid #e2e8f0;border-radius:8px}
    .qr-wrap .ql{font-size:7.5px;color:#94a3b8;margin-top:3px}
    .qr-wrap .ql2{font-size:7px;color:#e91e8c;font-weight:700}
    /* print */
    @media print{body{background:#fff;padding:0}.ticket{margin:0;box-shadow:none;border-radius:0;width:100%}.stripe{-webkit-print-color-adjust:exact;print-color-adjust:exact}.dispatch-box{-webkit-print-color-adjust:exact;print-color-adjust:exact}button{display:none!important}}
  </style></head><body>
  <div>
    <div class="ticket">
      <div class="stripe"></div>
      <div class="watermark">REBMA IMPEX</div>
      <div class="body">
        <div class="header">
          <div class="brand">
            ${logoSvg}
            <div class="brand-text">
              <div class="name">REBMA IMPEX</div>
              <div class="sub">Operations Dispatch Ticket</div>
            </div>
          </div>
          <div class="ticket-type">
            <div class="label">Ticket No.</div>
            <div class="tno">${order.ticketNumber || `TKT-${order.id.slice(0, 6).toUpperCase()}`}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:3px">${new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        <hr class="div"/>

        <div class="status-banner">
          <div>
            <div class="slabel">Order Status</div>
            <div class="sval">${order.status.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div class="slabel">Payment</div>
            <div class="sval">${order.paymentMode}</div>
          </div>
          <div>
            <div class="slabel">Issued By</div>
            <div class="sval" style="font-size:11px">${order.issuedBy}</div>
          </div>
        </div>

        <div class="grid">
          <div class="field">
            <div class="fl">Client Name</div>
            <div class="fv">${order.clientName}</div>
          </div>
          <div class="field">
            <div class="fl">Product / Item</div>
            <div class="fv">${order.productName || '—'}</div>
          </div>
          <div class="field full">
            <div class="fl">Destination / Delivery Address</div>
            <div class="fv">${order.destination || 'To be confirmed'}</div>
          </div>
        </div>

        <div class="dispatch-box">
          <div>
            <div class="dl">Operations Action</div>
            <div class="dv">Load → Verify → Release to Dispatch</div>
          </div>
          <div class="dseal">OPS VERIFIED</div>
        </div>

        <!-- perforated tear line -->
        <div class="perf" style="margin-bottom:14px">
          <div class="perf-circle"></div>
          <div class="perf-line"></div>
          <div class="perf-circle"></div>
        </div>

        <div class="footer">
          <div class="legal">
            This ticket is issued by <strong>REBMA IMPEX Ghana Limited</strong> Operations.<br/>
            It authorises the dispatch of the above goods to the stated destination.<br/>
            Invoice ref: <strong>${order.ticketNumber}</strong> — scan QR to verify against invoice.<br/>
            Issuer: ${order.issuedBy} &bull; ${order.issuedByEmail}
          </div>
          <div class="qr-wrap">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Ticket QR"/>` : '<div style="width:88px;height:88px;border:2px dashed #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8">QR</div>'}
            <div class="ql">Scan to verify</div>
            <div class="ql2">Matches invoice QR</div>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-top:16px;display:flex;gap:10px;justify-content:center">
      <button onclick="window.print()" style="background:#e91e8c;color:#fff;border:none;padding:10px 28px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print Ticket</button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:10px 24px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=680,height=820');
  if (win) { win.document.write(html); win.document.close(); }
}

// ── helpers ────────────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    APPROVED: 'bg-emerald-100 text-emerald-700',
    PROCESSING: 'bg-indigo-100 text-indigo-700',
    OUT_FOR_DELIVERY: 'bg-amber-100 text-amber-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

const SortIco = ({ field, sort }: { field: string; sort: { field: string; dir: string } }) =>
  sort.field === field
    ? (sort.dir === 'asc' ? <ChevronUp size={10} className="text-[var(--accent)]" /> : <ChevronDown size={10} className="text-[var(--accent)]" />)
    : <span className="text-[var(--text-muted)] opacity-40 text-[9px]">↕</span>;

// ── component ──────────────────────────────────────────────────────────────
export default function ApprovedGoodsView({ addNotification, setActiveSubTab }: Props) {
  const [goods, setGoods] = useState<ApprovedGood[]>([]);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [goodsSearch, setGoodsSearch] = useState('');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'goods' | 'orders'>('orders');
  const [goodsSort, setGoodsSort] = useState<GoodsSort>({ field: 'approvedAt', dir: 'desc' });
  const [orderSort, setOrderSort] = useState<OrderSort>({ field: 'createdAt', dir: 'desc' });

  // Dispatch modal state
  const [dispatchTarget, setDispatchTarget] = useState<ApprovedOrder | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ vehicleId: '', driverName: '' });
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [{ data: cargoData }, { data: ordersData }] = await Promise.all([
          supabase.from('cargo_intake').select('*').eq('status', 'APPROVED').order('updated_at', { ascending: false }).limit(200),
          supabase.from('orders').select('*').in('status', ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED']).order('created_at', { ascending: false }).limit(200),
        ]);

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
          issuedBy: r.issued_by || r.created_by || 'Finance Department',
          issuedByEmail: r.issuer_email || 'finance@rebmaimpex.com',
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── dispatch action ────────────────────────────────────────────────────
  const handleDispatch = async () => {
    if (!dispatchTarget) return;
    setDispatching(true);
    try {
      // 1. Create delivery_log entry
      await supabase.from('delivery_logs').insert({
        order_id: dispatchTarget.id,
        vehicle_id: dispatchForm.vehicleId || 'TBD',
        driver_name: dispatchForm.driverName || null,
        status: 'ASSIGNED',
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).then(() => {}, () => {});

      // 2. Move order to OUT_FOR_DELIVERY
      await supabase.from('orders')
        .update({ status: 'OUT_FOR_DELIVERY', updated_at: new Date().toISOString() })
        .eq('id', dispatchTarget.id)
        .then(() => {}, () => {});

      // 3. Refresh local state
      setOrders(prev => prev.map(o =>
        o.id === dispatchTarget.id ? { ...o, status: 'OUT_FOR_DELIVERY' } : o
      ));

      addNotification?.(`Order ${dispatchTarget.ticketNumber} loaded to Dispatch.`);
      setDispatchTarget(null);
      setDispatchForm({ vehicleId: '', driverName: '' });
    } catch (e: any) {
      alert(e.message || 'Failed to send to dispatch.');
    }
    setDispatching(false);
  };

  // ── sort / filter ──────────────────────────────────────────────────────
  const toggleGoodsSort = (field: keyof ApprovedGood) =>
    setGoodsSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  const toggleOrderSort = (field: keyof ApprovedOrder) =>
    setOrderSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });

  const filteredGoods = [...goods]
    .filter(g => !goodsSearch || g.productName.toLowerCase().includes(goodsSearch.toLowerCase()) || g.goodsCode.toLowerCase().includes(goodsSearch.toLowerCase()) || g.supplier.toLowerCase().includes(goodsSearch.toLowerCase()))
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
  const pendingDispatch = orders.filter(o => o.status === 'APPROVED').length;
  const inTransit = orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length;

  const th = (label: string, field: string, sort: any, toggle: (f: any) => void, colorClass?: string) => (
    <th key={label} onClick={() => toggle(field)}
      className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-[var(--accent-light)] transition-colors ${colorClass || 'text-[var(--text-muted)]'}`}>
      <span className="inline-flex items-center gap-1">{label} <SortIco field={field} sort={sort} /></span>
    </th>
  );

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
          { label: 'Approved Cargo Batches', value: goods.length, color: '#3b82f6', icon: <Package size={16} /> },
          { label: 'Total Port Units', value: totalGoodsQty.toLocaleString(), color: 'var(--accent)', icon: <PackageCheck size={16} /> },
          { label: 'Awaiting Dispatch', value: pendingDispatch, color: '#f59e0b', icon: <TicketCheck size={16} />, alert: pendingDispatch > 0 },
          { label: 'In Transit', value: inTransit, color: '#10b981', icon: <Truck size={16} /> },
        ].map(c => (
          <div key={c.label} className={`bg-[var(--bg-card)] border rounded-2xl p-4 shadow-[var(--box-shadow)] ${(c as any).alert ? 'border-amber-400' : 'border-[var(--border)]'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide leading-tight">{c.label}</p>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
            {(c as any).alert && (
              <p className="text-[9px] text-amber-600 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={9} /> Action required</p>
            )}
          </div>
        ))}
      </div>

      {/* Workflow note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Truck size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-blue-800">Operations Workflow</p>
          <p className="text-[11px] text-blue-700 mt-0.5">
            Finance approves payment → order appears here with <strong>APPROVED</strong> status →
            Operations verifies & clicks <strong>"Load to Dispatch"</strong> → Dispatch team picks it up →
            Driver delivers and marks <strong>DELIVERED</strong>.
            Print the <strong>Ticket</strong> (for Operations) and the <strong>Invoice</strong> (for Marketing to hand to customer).
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { key: 'orders' as const, label: `Orders Ready for Dispatch (${orders.length})` },
          { key: 'goods' as const, label: `Port-Approved Cargo (${goods.length})` },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === t.key ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
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
                  className="pl-8 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-52" />
              </div>
              <select value={ordersStatusFilter} onChange={e => setOrdersStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer">
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved — Awaiting Dispatch</option>
                <option value="PROCESSING">Processing</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            <button onClick={() => exportToCSV(filteredOrders.map(o => ({ Ticket: o.ticketNumber, Client: o.clientName, Product: o.productName, Status: o.status, Date: o.createdAt })), ['Ticket','Client','Product','Status','Date'], 'approved_orders')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer whitespace-nowrap">
              <Download size={13} /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--bg)]">
                <tr>
                  {th('Ticket #', 'ticketNumber', orderSort, toggleOrderSort)}
                  {th('Client', 'clientName', orderSort, toggleOrderSort)}
                  {th('Product', 'productName', orderSort, toggleOrderSort)}
                  {th('Destination', 'destination', orderSort, toggleOrderSort)}
                  {th('Payment', 'paymentMode', orderSort, toggleOrderSort)}
                  {th('Status', 'status', orderSort, toggleOrderSort)}
                  {th('Date', 'createdAt', orderSort, toggleOrderSort)}
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">No approved orders found.</td></tr>
                ) : filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-[var(--accent-light)] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">{o.ticketNumber || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{o.clientName}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{o.productName || '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{o.destination || '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{o.paymentMode}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusBadge(o.status)}`}>{o.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{o.createdAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Print Ticket */}
                        <button onClick={() => printOperationsTicket(o)}
                          title="Print Operations Ticket"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--accent-light)] cursor-pointer whitespace-nowrap transition-colors">
                          <Printer size={11} /> Ticket
                        </button>
                        {/* Load to Dispatch — only for APPROVED orders */}
                        {o.status === 'APPROVED' && (
                          <button onClick={() => setDispatchTarget(o)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--accent)] text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer whitespace-nowrap transition-opacity">
                            <Truck size={11} /> Dispatch
                          </button>
                        )}
                        {o.status === 'OUT_FOR_DELIVERY' && (
                          <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1"><Truck size={9} /> In Transit</span>
                        )}
                        {o.status === 'DELIVERED' && (
                          <span className="text-[9px] font-bold text-emerald-600">✓ Delivered</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              {filteredOrders.length} orders · {pendingDispatch} awaiting dispatch · {inTransit} in transit
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
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <button onClick={() => exportToCSV(filteredGoods.map(g => ({ 'Goods Code': g.goodsCode, Product: g.productName, Qty: g.quantity, Unit: g.unit, Supplier: g.supplier, 'Approved On': g.approvedAt })), ['Goods Code','Product','Qty','Unit','Supplier','Approved On'], 'approved_cargo')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer whitespace-nowrap">
              <Download size={13} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--bg)]">
                <tr>
                  {th('Goods Code', 'goodsCode', goodsSort, toggleGoodsSort)}
                  {th('Product', 'productName', goodsSort, toggleGoodsSort)}
                  {th('Quantity', 'quantity', goodsSort, toggleGoodsSort)}
                  {th('Supplier', 'supplier', goodsSort, toggleGoodsSort)}
                  {th('Port of Origin', 'portOfOrigin', goodsSort, toggleGoodsSort)}
                  {th('Destination', 'destination', goodsSort, toggleGoodsSort)}
                  {th('Approved On', 'approvedAt', goodsSort, toggleGoodsSort)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                  ))
                ) : filteredGoods.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">No approved cargo yet.</td></tr>
                ) : filteredGoods.map(g => (
                  <tr key={g.id} className="hover:bg-[var(--accent-light)] transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-[var(--accent)]">{g.goodsCode}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)] flex items-center gap-2"><Package size={11} className="text-[var(--text-muted)]" />{g.productName}</td>
                    <td className="px-4 py-3 font-bold text-blue-500">{g.quantity.toLocaleString()} <span className="font-normal text-[var(--text-muted)]">{g.unit}</span></td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{g.supplier}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{g.portOfOrigin}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{g.destination}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{g.approvedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredGoods.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              {filteredGoods.length} batches · {totalGoodsQty.toLocaleString()} total units
            </div>
          )}
        </div>
      )}

      {/* ── DISPATCH MODAL ── */}
      {dispatchTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 w-full max-w-md shadow-2xl border border-[var(--border)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Load to Dispatch</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Confirm vehicle and driver to release this order</p>
              </div>
              <button onClick={() => setDispatchTarget(null)} className="p-1.5 hover:bg-[var(--bg)] rounded-lg cursor-pointer"><X size={16} className="text-[var(--text-muted)]" /></button>
            </div>

            {/* Order summary */}
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 mb-5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Ticket</span>
                <span className="font-mono font-bold text-emerald-600">{dispatchTarget.ticketNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Client</span>
                <span className="font-semibold text-[var(--text-primary)]">{dispatchTarget.clientName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Product</span>
                <span className="text-[var(--text-secondary)]">{dispatchTarget.productName || '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Destination</span>
                <span className="text-[var(--text-secondary)]">{dispatchTarget.destination || '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Payment</span>
                <span className="font-semibold text-[var(--accent)]">{dispatchTarget.paymentMode}</span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Vehicle ID / Plate Number</label>
                <input value={dispatchForm.vehicleId} onChange={e => setDispatchForm(f => ({ ...f, vehicleId: e.target.value }))}
                  placeholder="e.g. GH-1234-22"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Driver Name <span className="font-normal text-[var(--text-muted)]">(optional)</span></label>
                <input value={dispatchForm.driverName} onChange={e => setDispatchForm(f => ({ ...f, driverName: e.target.value }))}
                  placeholder="e.g. Kofi Mensah"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDispatchTarget(null)}
                className="flex-1 py-2.5 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer">Cancel</button>
              <button onClick={handleDispatch} disabled={dispatching}
                className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-xl text-xs font-bold hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                <Truck size={13} /> {dispatching ? 'Sending…' : 'Confirm & Load to Dispatch'}
              </button>
            </div>

            <p className="text-[10px] text-[var(--text-muted)] text-center mt-3">
              This will move the order to <strong>OUT_FOR_DELIVERY</strong> and notify the Dispatch team.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
