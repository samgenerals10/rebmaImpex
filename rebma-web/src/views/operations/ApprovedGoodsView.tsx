// Operations view: approved cargo + approved orders (transferred from dashboard)
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, Package, PackageCheck, TicketCheck, ChevronUp, ChevronDown, MoreVertical } from 'lucide-react';
import { exportToCSV } from '../../utils/export';

interface ApprovedGood {
  id: string;
  goodsCode: string;
  productName: string;
  quantity: number;
  unit: string;
  weight: number;
  supplier: string;
  portOfOrigin: string;
  destination: string;
  approvedAt: string;
}

interface ApprovedOrder {
  id: string;
  ticketNumber: string;
  clientName: string;
  productName: string;
  destination: string;
  totalAmount: number;
  status: string;
  paymentMode: string;
  createdAt: string;
  submittedBy: string;
}

type GoodsSort = { field: keyof ApprovedGood; dir: 'asc' | 'desc' };
type OrderSort = { field: keyof ApprovedOrder; dir: 'asc' | 'desc' };

interface Props {
  addNotification?: (msg: string) => void;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    APPROVED: 'bg-emerald-100 text-emerald-700',
    PROCESSING: 'bg-indigo-100 text-indigo-700',
    OUT_FOR_DELIVERY: 'bg-blue-100 text-blue-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

export default function ApprovedGoodsView({ addNotification }: Props) {
  const [goods, setGoods] = useState<ApprovedGood[]>([]);
  const [orders, setOrders] = useState<ApprovedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [goodsSearch, setGoodsSearch] = useState('');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'goods' | 'orders'>('goods');
  const [goodsSort, setGoodsSort] = useState<GoodsSort>({ field: 'approvedAt', dir: 'desc' });
  const [orderSort, setOrderSort] = useState<OrderSort>({ field: 'createdAt', dir: 'desc' });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setActiveMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

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
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleGoodsSort = (field: keyof ApprovedGood) => {
    setGoodsSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  };
  const toggleOrderSort = (field: keyof ApprovedOrder) => {
    setOrderSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  };

  const SortIco = ({ field, sort }: { field: string; sort: { field: string; dir: string } }) =>
    sort.field === field
      ? (sort.dir === 'asc' ? <ChevronUp size={10} className="text-[var(--accent)]" /> : <ChevronDown size={10} className="text-[var(--accent)]" />)
      : <span className="text-[var(--text-muted)] opacity-40 text-[9px]">↕</span>;

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
      const matchSearch = !ordersSearch || o.clientName.toLowerCase().includes(q) || o.ticketNumber.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q);
      const matchStatus = ordersStatusFilter === 'ALL' || o.status === ordersStatusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const va = a[orderSort.field], vb = b[orderSort.field];
      const c = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return orderSort.dir === 'asc' ? c : -c;
    });

  const totalGoodsQty = goods.reduce((s, g) => s + g.quantity, 0);
  const totalOrdersValue = orders.reduce((s, o) => s + o.totalAmount, 0);

  const th = (label: string, field: string, sort: any, toggle: (f: any) => void) => (
    <th key={label} onClick={() => toggle(field)}
      className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-[var(--accent-light)] transition-colors">
      <span className="inline-flex items-center gap-1">{label} <SortIco field={field} sort={sort} /></span>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Approved Goods</h2>
        <p className="text-xs text-[var(--text-muted)]">Management-approved cargo and all fulfilled orders with ticket numbers</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Approved Cargo Batches', value: goods.length, color: '#3b82f6', icon: <Package size={16} /> },
          { label: 'Total Port Units', value: totalGoodsQty.toLocaleString(), color: 'var(--accent)', icon: <PackageCheck size={16} /> },
          { label: 'Approved Orders', value: orders.length, color: '#10b981', icon: <TicketCheck size={16} /> },
          { label: 'Orders Value (GHS)', value: totalOrdersValue.toLocaleString(), color: '#8b5cf6', icon: <TicketCheck size={16} /> },
        ].map(c => (
          <div key={c.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide leading-tight">{c.label}</p>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-fit">
        {([{ key: 'goods', label: `Port-Approved Cargo (${goods.length})` }, { key: 'orders', label: `Orders with Tickets (${orders.length})` }] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeTab === t.key ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* GOODS TAB */}
      {activeTab === 'goods' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={goodsSearch} onChange={e => setGoodsSearch(e.target.value)} placeholder="Search product, code, supplier…"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <button onClick={() => { exportToCSV(filteredGoods.map(g => ({ 'Goods Code': g.goodsCode, Product: g.productName, Qty: g.quantity, Unit: g.unit, Weight: g.weight + 'T', Supplier: g.supplier, 'Port of Origin': g.portOfOrigin, 'Approved On': g.approvedAt })), ['Goods Code','Product','Qty','Unit','Weight','Supplier','Port of Origin','Approved On'], 'approved_cargo'); addNotification?.('Exported.'); }}
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
                  {th('Weight', 'weight', goodsSort, toggleGoodsSort)}
                  {th('Supplier', 'supplier', goodsSort, toggleGoodsSort)}
                  {th('Port of Origin', 'portOfOrigin', goodsSort, toggleGoodsSort)}
                  {th('Destination', 'destination', goodsSort, toggleGoodsSort)}
                  {th('Approved On', 'approvedAt', goodsSort, toggleGoodsSort)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                  ))
                ) : filteredGoods.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">No approved cargo yet. Management must approve cargo intake records first.</td></tr>
                ) : filteredGoods.map(g => (
                  <tr key={g.id} className="hover:bg-[var(--accent-light)] transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono font-semibold text-[var(--accent)]">{g.goodsCode}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      <div className="flex items-center gap-2"><Package size={11} className="text-[var(--text-muted)] flex-shrink-0" />{g.productName}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-500">{g.quantity.toLocaleString()} <span className="font-normal text-[var(--text-muted)]">{g.unit}</span></td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{g.weight}T</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{g.supplier}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{g.portOfOrigin}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{g.destination}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{g.approvedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredGoods.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              Showing {filteredGoods.length} of {goods.length} approved cargo batches · Total: {totalGoodsQty.toLocaleString()} units
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
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
                <option value="APPROVED">Approved</option>
                <option value="PROCESSING">Processing</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            <button onClick={() => { exportToCSV(filteredOrders.map(o => ({ Ticket: o.ticketNumber, Client: o.clientName, Product: o.productName, Amount: o.totalAmount, Status: o.status, Date: o.createdAt })), ['Ticket','Client','Product','Amount','Status','Date'], 'approved_orders'); addNotification?.('Exported orders.'); }}
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
                  {th('Amount (GHS)', 'totalAmount', orderSort, toggleOrderSort)}
                  {th('Payment', 'paymentMode', orderSort, toggleOrderSort)}
                  {th('Status', 'status', orderSort, toggleOrderSort)}
                  {th('Date', 'createdAt', orderSort, toggleOrderSort)}
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
                    <td className="px-4 py-3 font-bold font-mono text-[var(--text-primary)]">{o.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{o.paymentMode}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusBadge(o.status)}`}>{o.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{o.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredOrders.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              Showing {filteredOrders.length} of {orders.length} orders · Total value: GHS {totalOrdersValue.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
