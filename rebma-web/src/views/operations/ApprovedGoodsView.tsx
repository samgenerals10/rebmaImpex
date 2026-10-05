import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Search, Download, Package, PackageCheck, TicketCheck,
  ChevronUp, ChevronDown, Truck, AlertCircle,
} from 'lucide-react';
import { exportToCSV, safeDisplayName } from '../../utils/export';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import CountUp from '../../components/CountUp';
import CountBadge from '../../components/ui/CountBadge';

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
  // vehicleId/driverName removed from this form (Phase 9) — Admin & Warehouse
  // no longer assigns either; Risk does, once the order lands in their
  // Dispatch queue as PENDING_ASSIGNMENT.
  const [dispatchForm, setDispatchForm] = useState({ containerNumber: '' });
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
      // Phase 9: Admin & Warehouse no longer assigns a vehicle or driver
      // here — that's Risk's job now. Always lands as PENDING_ASSIGNMENT,
      // which is exactly the status Risk's relocated "Assign Driver" queue
      // already reads (assignDriverToDelivery() in apiClient.ts).
      const { data: dispatchInsertRows, error: dispatchInsertError } = await supabase.from('delivery_logs').insert({
        order_id: dispatchTarget.id,
        customer_name: dispatchTarget.clientName,
        delivery_address: dispatchTarget.destination,
        destination_lat: dispatchTarget.destinationLat,
        destination_lng: dispatchTarget.destinationLng,
        vehicle_id: 'TBD',
        driver_name: null,
        status: 'PENDING_ASSIGNMENT',
        updated_at: new Date().toISOString(),
      }).select();
      if (dispatchInsertError) throw dispatchInsertError;

      // The waybill is made and printed by Risk, not here
      // (utils/waybillPrint.ts, from Risk's Deliveries screen).

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
        details: `Order ${dispatchTarget.ticketNumber} loaded to dispatch. Product: ${dispatchTarget.productName}, Qty: ${totalQty}, Client: ${dispatchTarget.clientName}, Destination: ${dispatchTarget.destination}. Sent to Risk for vehicle and driver assignment.`,
        timestamp: new Date().toISOString(),
      });

      // 5. Update local state
      setDispatchedOrderIds(prev => new Set(prev).add(dispatchTarget.id));

      addNotification?.(`Order ${dispatchTarget.ticketNumber} sent to Risk for vehicle and driver assignment.`);
      setDispatchTarget(null);
      setDispatchForm({ containerNumber: '' });
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
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide leading-tight">{c.label}</p>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: c.color }}><CountUp value={c.value} /></p>
            {(c as any).alert && (
              <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={9} /> Action required</p>
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
            Account Department approves payment, then order appears here as <strong>APPROVED</strong>
            Operations verifies quantity, clicks <strong>"Load to Dispatch"</strong>
            stock ledger updated → Risk assigns vehicle and driver → Driver delivers → <strong>DELIVERED</strong>.
            Print the <strong>Waybill</strong> (Ops keeps, travels with the shipment) · <strong>Invoice</strong> goes via Marketing to customer.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { key: 'orders' as const, label: 'Orders Ready for Dispatch', count: orders.length },
          { key: 'goods' as const, label: 'Port-Approved Cargo', count: goods.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} title={t.key === 'orders' ? 'Orders Account Department has approved, ready to load and hand to Dispatch' : 'Cargo intake approved by Management, awaiting warehouse processing'}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === t.key ? 'text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            style={activeTab === t.key ? { background: 'var(--accent)' } : {}}>
            {t.label}<CountBadge count={t.count} />
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
                { key: 'status', label: 'Status', status: true, render: o => <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(o.status)}`}>{o.status.replace(/_/g, ' ')}</span> },
                { key: 'createdAt', label: 'Date' },
              ]}
              data={filteredOrders}
              rowKey={o => o.id}
              loading={loading}
              emptyTitle="No approved orders found"
              renderActions={o => (
                <div className="flex items-center gap-2">
                  {(o.status === 'APPROVED' || o.status === 'PROCESSING') && !dispatchedOrderIds.has(o.id) && (
                    <button onClick={() => { setDispatchTarget(o); setDispatchForm({ containerNumber: '' }); }}
                      title="Confirm goods are ready. Risk assigns the vehicle and driver next"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer whitespace-nowrap transition-opacity"
                      style={{ background: 'var(--accent)' }}>
                      <Truck size={11} /> Dispatch
                    </button>
                  )}
                  {(o.status === 'APPROVED' || o.status === 'PROCESSING') && dispatchedOrderIds.has(o.id) && (
                    <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Truck size={9} /> Assigned, awaiting pickup</span>
                  )}
                  {o.status === 'OUT_FOR_DELIVERY' && (
                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><Truck size={9} /> In Transit</span>
                  )}
                  {o.status === 'DELIVERED' && (
                    <span className="text-[10px] font-bold" style={{ color: BRAND.green }}>✓ Delivered</span>
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
        subtitle="Confirm goods are checked and ready. Risk assigns the vehicle and driver next"
        footer={
          <>
            <button onClick={() => setDispatchTarget(null)} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={handleDispatch} disabled={dispatching}
              title="Creates a delivery log and hands this order to Risk to assign a vehicle and driver"
              className="erp-btn erp-btn-primary disabled:opacity-50">
              <Truck size={13} /> {dispatching ? 'Sending…' : 'Confirm & Send to Risk for Dispatch'}
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
              <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-[11px] text-[var(--text-muted)]">
                Vehicle and driver are no longer assigned here. Risk picks them once this order lands in their Dispatch queue.
              </div>
            </div>

            {currentUserEmail && (
              <div className="text-[10px] text-[var(--text-muted)] mb-4 px-1">
                This action will be attributed to: <strong className="text-[var(--text-secondary)]">{currentUserEmail}</strong>
              </div>
            )}

            <p className="text-[10px] text-[var(--text-muted)] text-center">
              Marked ready for dispatch. Risk assigns the vehicle and driver next. Stock was already deducted at Account Department approval. Audit trail recorded
            </p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
