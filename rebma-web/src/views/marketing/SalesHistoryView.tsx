import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, TrendingUp, Users, Package, RefreshCw, Search, Filter, X } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import type { Order } from '../../types/erp';
import InvoiceLineItems, { getLineItems } from '../../components/InvoiceLineItems';

const STATUS_STYLES: Record<string, string> = {
  PENDING_FINANCE:     'bg-amber-100 text-amber-700',
  PENDING_MANAGEMENT:  'bg-blue-100 text-blue-700',
  APPROVED:            'bg-emerald-100 text-emerald-700',
  DELIVERED:           'bg-emerald-100 text-emerald-700',
  REJECTED:            'bg-rose-100 text-rose-700',
  PROCESSING:          'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY:    'bg-violet-100 text-violet-700',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_FINANCE: 'Pending Finance', PENDING_MANAGEMENT: 'Pending Mgmt',
  APPROVED: 'Approved', DELIVERED: 'Delivered', REJECTED: 'Rejected',
  PROCESSING: 'Processing', OUT_FOR_DELIVERY: 'Out for Delivery',
};

const PIE_COLORS = ['#1a5c32','#29a9dc','#7fc241','#f59e0b','#8b5cf6','#ef4444'];

function mapOrder(r: any): Order {
  return {
    id: String(r.id || ''),
    ticketNumber: r.ticket_number || r.ticketNumber || r.id,
    clientName: r.client_name || r.clientName || '',
    productName: r.product_name || r.productName || '',
    destination: r.destination || '',
    paymentMode: r.payment_mode || r.paymentMode || 'CASH',
    totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
    status: r.status || 'PENDING_FINANCE',
    createdAt: r.created_at || r.createdAt || '',
    products: r.product_name || r.productName || r.products || '',
    submittedBy: r.created_by || r.submittedBy || '',
    metadata: r.metadata || null,
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1 font-semibold">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: GHS {Number(p.value || 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

interface Props {
  ordersList: Order[];
  addNotification: (msg: string) => void;
}

export default function SalesHistoryView({ ordersList, addNotification }: Props) {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'sales' | 'credit'>('sales');
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMode, setFilterMode]     = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000)
      .then(({ data }) => {
        const mapped = (data ?? []).map(mapOrder);
        setOrders(mapped.length > 0 ? mapped : ordersList);
        setLoading(false);
      }, () => {
        setOrders(ordersList);
        setLoading(false);
      });
  }, [ordersList]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const completed = useMemo(() =>
    orders.filter(o => ['DELIVERED','APPROVED','OUT_FOR_DELIVERY','PROCESSING'].includes(o.status)),
  [orders]);

  const totalRevenue = useMemo(() =>
    completed.reduce((s, o) => s + o.totalAmount, 0), [completed]);

  const avgOrder = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0;

  // Monthly chart — last 6 months
  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const monthOrders = orders.filter(o => {
        const od = new Date(o.createdAt);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      });
      return {
        month: label,
        revenue: monthOrders.filter(o => ['DELIVERED','APPROVED'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0),
        orders: monthOrders.length,
      };
    });
  }, [orders]);

  const bestMonth = monthlyData.reduce((b, m) => m.revenue > b.revenue ? m : b, { month: '—', revenue: 0, orders: 0 });

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    for (const o of completed) {
      const k = o.clientName || 'Unknown';
      if (!map[k]) map[k] = { revenue: 0, count: 0 };
      map[k].revenue += o.totalAmount;
      map[k].count   += 1;
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [completed]);

  // Top products — expand metadata.items for multi-product orders
  const topProducts = useMemo(() => {
    const map: Record<string, { revenue: number; count: number }> = {};
    for (const o of completed) {
      const items = getLineItems(o);
      if (items && items.length > 0) {
        // Multi-item order: attribute each product's lineTotal individually
        for (const item of items) {
          const k = item.productName || 'Unknown';
          if (!map[k]) map[k] = { revenue: 0, count: 0 };
          map[k].revenue += item.lineTotal || 0;
          map[k].count += item.quantity || 1;
        }
      } else {
        // Legacy order: use productName + totalAmount
        const k = o.productName || 'Unknown';
        if (!map[k]) map[k] = { revenue: 0, count: 0 };
        map[k].revenue += o.totalAmount;
        map[k].count += 1;
      }
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [completed]);

  // Payment mode pie
  const modeData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of completed) { const m = o.paymentMode || 'CASH'; map[m] = (map[m] || 0) + o.totalAmount; }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [completed]);

  // Credit orders
  const creditOrders  = useMemo(() => orders.filter(o => o.paymentMode === 'CREDIT'), [orders]);
  const creditPending  = creditOrders.filter(o => ['PENDING_FINANCE','PENDING_MANAGEMENT'].includes(o.status)).length;
  const creditApproved = creditOrders.filter(o => ['APPROVED','DELIVERED'].includes(o.status)).length;
  const creditRejected = creditOrders.filter(o => o.status === 'REJECTED').length;
  const creditValue    = creditOrders.reduce((s, o) => s + o.totalAmount, 0);

  // Filtered list for sales table
  const tableRows = useMemo(() => {
    const q = search.toLowerCase();
    return completed.filter(o => {
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
      if (filterMode !== 'ALL' && o.paymentMode !== filterMode) return false;
      if (q && !o.clientName.toLowerCase().includes(q) && !(o.productName || '').toLowerCase().includes(q) && !(o.ticketNumber || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [completed, search, filterStatus, filterMode]);

  const exportCSV = () => {
    const rows = tableRows.map(o => [o.ticketNumber || o.id, o.clientName, o.productName || '', o.totalAmount, o.paymentMode, o.status, (o.createdAt || '').split('T')[0]]);
    const csv = [['Invoice#','Customer','Product','Amount','Payment','Status','Date'], ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'sales_history.csv'; a.click();
    addNotification('Sales history exported.');
  };

  const allStatuses = ['ALL', ...Array.from(new Set(completed.map(o => o.status)))];
  const allModes    = ['ALL', ...Array.from(new Set(orders.map(o => o.paymentMode)))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Sales History & Credit Requests</h2>
          <p className="text-xs text-[var(--text-muted)]">Revenue analytics and credit tracking — {orders.length} total orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] rounded-xl">
            {(['sales', 'credit'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${tab === t ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {t === 'sales' ? 'Sales History' : `Credit (${creditOrders.length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="animate-pulse h-24 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]" />)}
        </div>
      ) : tab === 'sales' ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: `GHS ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Completed Orders', value: completed.length.toString(), icon: Package, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent-light)]' },
              { label: 'Avg Order Value', value: `GHS ${avgOrder.toLocaleString()}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Best Month', value: bestMonth.month, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', sub: `GHS ${bestMonth.revenue.toLocaleString()}` },
            ].map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)] flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{c.label}</p>
                    <p className={`text-base font-extrabold truncate ${c.color}`}>{c.value}</p>
                    {'sub' in c && <p className="text-[10px] text-[var(--text-muted)]">{c.sub}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Revenue chart */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Revenue — Last 6 Months</p>
            <p className="text-[10px] text-[var(--text-muted)] mb-4">Approved + delivered orders · GHS</p>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top customers + Top products + Payment mode */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top customers */}
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[var(--accent)]" />
                <p className="text-sm font-bold text-[var(--text-primary)]">Top Customers</p>
              </div>
              {topCustomers.length === 0
                ? <p className="text-xs text-[var(--text-muted)] text-center py-6">No data yet</p>
                : <div className="space-y-3">
                    {topCustomers.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{c.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{c.count} order{c.count !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">GHS {c.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>}
            </div>

            {/* Top products */}
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-[var(--accent)]" />
                <p className="text-sm font-bold text-[var(--text-primary)]">Top Products</p>
              </div>
              {topProducts.length === 0
                ? <p className="text-xs text-[var(--text-muted)] text-center py-6">No data yet</p>
                : <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name || '—'}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{p.count} sold</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">GHS {p.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>}
            </div>

            {/* Payment mode pie */}
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
              <p className="text-sm font-bold text-[var(--text-primary)] mb-3">Payment Modes</p>
              {modeData.length === 0
                ? <p className="text-xs text-[var(--text-muted)] text-center py-6">No data yet</p>
                : <>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={modeData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                          {modeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`GHS ${Number(v).toLocaleString()}`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {modeData.map((m, i) => (
                        <div key={m.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="text-[10px] text-[var(--text-secondary)]">{m.name.replace(/_/g,' ')}</span></div>
                          <span className="text-[10px] font-bold text-[var(--text-primary)]">GHS {m.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>}
            </div>
          </div>

          {/* Monthly orders bar */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Orders per Month</p>
            <p className="text-[10px] text-[var(--text-muted)] mb-4">Total orders placed (all statuses)</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="orders" name="Orders" fill="#29a9dc" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sales table with search + filter */}
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Sales Records ({tableRows.length})</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, product…"
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] w-44" />
                </div>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="pl-7 pr-2 py-1.5 text-xs rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] cursor-pointer appearance-none">
                    {allStatuses.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : STATUS_LABEL[s] || s}</option>)}
                  </select>
                </div>
                <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
                  className="px-2 py-1.5 text-xs rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] cursor-pointer appearance-none">
                  {allModes.map(m => <option key={m} value={m}>{m === 'ALL' ? 'All Modes' : m.replace(/_/g,' ')}</option>)}
                </select>
                <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Invoice #','Customer','Product','Amount (GHS)','Payment','Status','Date'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold text-[var(--text-muted)] whitespace-nowrap uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-[var(--text-muted)] text-sm">No records match your filters.</td></tr>
                  ) : tableRows.map(o => (
                    <tr key={o.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-input)] transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td className="py-3 px-3 font-mono text-[10px] text-[var(--text-secondary)]">{o.ticketNumber || o.id}</td>
                      <td className="py-3 px-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">{o.clientName || '—'}</td>
                      <td className="py-3 px-3 max-w-[180px]"><InvoiceLineItems order={o} compact /></td>
                      <td className="py-3 px-3 font-bold text-emerald-600 whitespace-nowrap">{Number(o.totalAmount ?? 0).toLocaleString()}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] whitespace-nowrap text-xs">{(o.paymentMode || '').replace(/_/g,' ')}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[o.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-muted)] whitespace-nowrap text-[11px]">{(o.createdAt || '').split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ── Credit tab ── */
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Credit Requests', value: creditOrders.length, color: 'text-[var(--text-primary)]' },
              { label: 'Pending',               value: creditPending,       color: 'text-amber-600' },
              { label: 'Approved',              value: creditApproved,      color: 'text-emerald-600' },
              { label: 'Rejected',              value: creditRejected,      color: 'text-rose-600' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 shadow-[var(--box-shadow)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {creditValue > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700">Total credit value outstanding: <span className="font-extrabold">GHS {creditValue.toLocaleString()}</span></p>
            </div>
          )}

          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 shadow-[var(--box-shadow)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-4">Credit Requests ({creditOrders.length})</p>
            {creditOrders.length === 0 ? (
              <p className="text-center py-8 text-sm text-[var(--text-muted)]">No credit requests found.</p>
            ) : (
              <div className="space-y-3">
                {creditOrders.map(o => (
                  <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">{o.ticketNumber || o.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[o.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[o.status] || o.status}</span>
                      </div>
                      <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{o.clientName}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{o.productName || '—'} · Submitted {(o.createdAt || '').split('T')[0]}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-emerald-600 text-sm whitespace-nowrap">GHS {Number(o.totalAmount ?? 0).toLocaleString()}</span>
                      <button onClick={() => addNotification(`Tracking order ${o.ticketNumber || o.id}.`)}
                        className="px-3 py-1.5 rounded-xl border border-[var(--accent)] text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors whitespace-nowrap cursor-pointer">
                        Track
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Order detail side-panel ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setSelectedOrder(null)}>
          <div
            className="w-full max-w-xl rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">Invoice Details</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{selectedOrder.ticketNumber || selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]">
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Customer', selectedOrder.clientName],
                  ['Destination', selectedOrder.destination || '—'],
                  ['Payment Mode', (selectedOrder.paymentMode || '').replace(/_/g,' ')],
                  ['Date', (selectedOrder.createdAt || '').split('T')[0]],
                  ['Status', selectedOrder.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-[var(--text-muted)]">{k}</p>
                    <p className="font-semibold text-[var(--text-primary)]">{v}</p>
                  </div>
                ))}
              </div>

              {/* Line items */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Invoice Items</p>
                <InvoiceLineItems order={selectedOrder} />
              </div>
            </div>

            <div className="px-6 py-4 shrink-0 border-t border-[var(--border)]">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
