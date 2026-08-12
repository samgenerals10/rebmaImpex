import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Package, PackageCheck, AlertTriangle, BarChart2, Download, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';
import SidePanel from '../../components/ui/SidePanel';

interface AddNotificationProps { addNotification: (msg: string) => void; }

// KPI detail modal row types
interface CargoRow { date: string; product: string; quantity: number; supplier: string; status: string; }

function KpiDetailModal({ title, rows, onClose }: { title: string; rows: CargoRow[]; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter(r =>
    !search || r.product.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier.toLowerCase().includes(search.toLowerCase()) || r.status.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <SidePanel open onClose={onClose} title={title} width="lg">
        <div className="flex flex-col h-full -mx-5 -my-4">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter records…"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none" />
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--bg)] border-b border-[var(--border)]">
                <tr>{['Date','Product','Quantity','Supplier','Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.length === 0
                  ? <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">No records found.</td></tr>
                  : filtered.map((r, i) => (
                    <tr key={i} className="hover:bg-[var(--accent-light)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">{r.date}</td>
                      <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">{r.product}</td>
                      <td className="px-4 py-2.5 font-mono text-[var(--accent)]">{r.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.supplier}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">{filtered.length} records</div>
        </div>
    </SidePanel>
  );
}

const COLORS = ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-[var(--text-primary)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AnalyticsView({ addNotification }: AddNotificationProps) {
  const [loading, setLoading] = useState(true);
  const [totalCargo, setTotalCargo] = useState(0);
  const [totalReleased, setTotalReleased] = useState(0);
  const [totalDiscrepancies, setTotalDiscrepancies] = useState(0);
  const [cargoInflow, setCargoInflow] = useState<{ month: string; inflow: number; released: number }[]>([]);
  const [stockStatus, setStockStatus] = useState<{ name: string; count: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [topProducts, setTopProducts] = useState<{ rank: number; name: string; received: number; receivedCount: number; releasedQty: number; releasedCount: number; status: string }[]>([]);
  const [allCargoRows, setAllCargoRows] = useState<CargoRow[]>([]);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // KPI counts
        const [cargoRes, releasedRes, discrepancyRes] = await Promise.all([
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }),
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).not('discrepancies', 'is', null),
        ]);
        setTotalCargo(cargoRes.count ?? 0);
        setTotalReleased(releasedRes.count ?? 0);
        setTotalDiscrepancies(discrepancyRes.count ?? 0);

        // Cargo inflow chart — group by month
        const { data: cargoRows } = await supabase
          .from('cargo_intake')
          .select('created_at, status')
          .order('created_at', { ascending: true });

        if (cargoRows && cargoRows.length > 0) {
          const monthMap: Record<string, { inflow: number; released: number }> = {};
          for (const row of cargoRows as { created_at: string; status: string }[]) {
            const m = MONTHS_SHORT[new Date(row.created_at).getMonth()];
            if (!monthMap[m]) monthMap[m] = { inflow: 0, released: 0 };
            monthMap[m].inflow++;
            if (row.status === 'APPROVED') monthMap[m].released++;
          }
          const last6: { month: string; inflow: number; released: number }[] = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
            const k = MONTHS_SHORT[d.getMonth()];
            return { month: k, inflow: monthMap[k]?.inflow || 0, released: monthMap[k]?.released || 0 };
          });
          setCargoInflow(last6);
        }

        // Stock trend from stock_items
        const { data: stockRows } = await supabase
          .from('stock')
          .select('quantity, minimum_level, maximum_level');
        if (stockRows && stockRows.length > 0) {
          const items = stockRows as { quantity: number; minimum_level: number; maximum_level: number }[];
          const inStock = items.filter(s => s.quantity > (s.minimum_level || 0)).length;
          const lowStock = items.filter(s => s.quantity > 0 && s.quantity <= (s.minimum_level || 0)).length;
          const outOfStock = items.filter(s => s.quantity <= 0).length;
          setStockStatus([
            { name: 'In Stock', count: inStock },
            { name: 'Low Stock', count: lowStock },
            { name: 'Out of Stock', count: outOfStock },
          ]);
        }

        // Category breakdown from stock_items
        const { data: catRows } = await supabase
          .from('stock')
          .select('category');
        if (catRows && catRows.length > 0) {
          const catMap: Record<string, number> = {};
          for (const r of catRows as { category: string }[]) {
            const cat = r.category || 'Uncategorised';
            catMap[cat] = (catMap[cat] || 0) + 1;
          }
          const total = Object.values(catMap).reduce((a, b) => a + b, 0);
          setCategoryBreakdown(
            Object.entries(catMap)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([name, count], i) => ({
                name,
                value: Math.round((count / total) * 100),
                color: COLORS[i % COLORS.length],
              }))
          );
        }

        // Top products by volume from cargo_intake — use actual quantities
        const { data: productRows } = await supabase
          .from('cargo_intake')
          .select('product_name, status, quantity, created_at, supplier_name, company, discrepancies');
        if (productRows && productRows.length > 0) {
          const rows = productRows as { product_name: string; status: string; quantity: any; created_at: string; supplier_name?: string; company?: string; discrepancies?: string }[];
          const prodMap: Record<string, { received: number; receivedCount: number; releasedQty: number; releasedCount: number }> = {};
          const cargoRowsArr: CargoRow[] = [];
          for (const r of rows) {
            const name = r.product_name || 'Unknown';
            const qty = Number(r.quantity || 1);
            if (!prodMap[name]) prodMap[name] = { received: 0, receivedCount: 0, releasedQty: 0, releasedCount: 0 };
            prodMap[name].received += qty;
            prodMap[name].receivedCount++;
            if (r.status === 'APPROVED') { prodMap[name].releasedQty += qty; prodMap[name].releasedCount++; }
            cargoRowsArr.push({
              date: (r.created_at || '').slice(0, 10),
              product: name,
              quantity: qty,
              supplier: r.supplier_name || r.company || '—',
              status: r.status || '—',
            });
          }
          setAllCargoRows(cargoRowsArr);
          const sorted = Object.entries(prodMap)
            .sort((a, b) => b[1].received - a[1].received)
            .slice(0, 10)
            .map(([name, d], i) => ({
              rank: i + 1,
              name,
              received: d.received,
              receivedCount: d.receivedCount,
              releasedQty: d.releasedQty,
              releasedCount: d.releasedCount,
              status: d.releasedQty >= d.received ? 'Healthy' : d.releasedQty === 0 ? 'Out of Stock' : 'Low Stock',
            }));
          setTopProducts(sorted);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleExport = () => {
    exportToCSV(
      cargoInflow.map(d => ({ Month: d.month, 'Cargo Inflow': d.inflow, Released: d.released })),
      ['Month', 'Cargo Inflow', 'Released'],
      'operations_analytics'
    );
    addNotification('Operations analytics exported to CSV.');
  };

  const kpiCards = [
    { label: 'Total Cargo Intakes', value: totalCargo, icon: Package, color: 'var(--accent)', kpiKey: 'all' },
    { label: 'Released to Dispatch', value: totalReleased, icon: PackageCheck, color: '#10b981', kpiKey: 'released' },
    { label: 'Discrepancies Reported', value: totalDiscrepancies, icon: AlertTriangle, color: '#f59e0b', kpiKey: 'discrepancies' },
    { label: 'Avg. Processing Time', value: '—', icon: Clock, color: '#8b5cf6', kpiKey: null },
  ];

  const getModalRows = (kpiKey: string | null): CargoRow[] => {
    if (kpiKey === 'all') return allCargoRows;
    if (kpiKey === 'released') return allCargoRows.filter(r => r.status === 'APPROVED');
    if (kpiKey === 'discrepancies') return allCargoRows.filter(r => r.status !== 'APPROVED' && r.status !== '—');
    return [];
  };

  const getModalTitle = (kpiKey: string | null): string => {
    if (kpiKey === 'all') return 'All Cargo Intakes';
    if (kpiKey === 'released') return 'Released to Dispatch';
    if (kpiKey === 'discrepancies') return 'Discrepancies Reported';
    return '';
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Operations Analytics</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Cargo flow, stock trends, discrepancy tracking & fulfillment performance</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-opacity cursor-pointer shadow"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const clickable = card.kpiKey !== null;
          return (
            <button key={card.label}
              onClick={() => clickable && setActiveKpi(card.kpiKey)}
              className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)] text-left w-full transition-colors ${clickable ? 'hover:border-[var(--accent)] cursor-pointer' : 'cursor-default'}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">{card.label}</p>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
              </div>
              {loading ? (
                <div className="animate-pulse h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              ) : (
                <p className="text-2xl font-bold text-[var(--text-primary)]">{typeof card.value === 'number' ? <CountUp value={card.value} /> : card.value}</p>
              )}
              {clickable && !loading && <p className="text-[10px] text-[var(--text-muted)] mt-1">Click to view details</p>}
            </button>
          );
        })}
      </div>

      {/* KPI detail modal */}
      {activeKpi && (
        <KpiDetailModal
          title={getModalTitle(activeKpi)}
          rows={getModalRows(activeKpi)}
          onClose={() => setActiveKpi(null)}
        />
      )}

      {/* Cargo Inflow vs Release Velocity */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Cargo Inflow vs Release Velocity</h2>
        </div>
        {loading ? (
          <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ) : cargoInflow.every(d => d.inflow === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart2 className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-gray-500">No cargo data yet</p>
            <p className="text-xs text-gray-400 mt-1">Data will appear as cargo is logged</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={cargoInflow} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="releasedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Area type="monotone" dataKey="inflow" name="Cargo Inflow" stroke="var(--accent)" fill="url(#inflowGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="released" name="Released" stroke="#10b981" fill="url(#releasedGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row: Stock Status Trend + Category Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Current Stock Status</h2>
          {loading ? (
            <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : stockStatus.every(s => s.count === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-gray-400">No stock data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stockStatus} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Items" radius={[3,3,0,0]}>
                  {stockStatus.map((s, i) => <Cell key={i} fill={s.name === 'In Stock' ? '#10b981' : s.name === 'Low Stock' ? '#f59e0b' : '#f43f5e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Stock by Category</h2>
          {loading ? (
            <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : categoryBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-gray-400">No category data yet</p>
              <p className="text-xs text-gray-400 mt-1">Add items to stock to see categories</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0}>
                    {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {categoryBreakdown.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-[var(--text-secondary)] truncate">{c.name}</span>
                    </div>
                    <span className="text-xs font-bold text-[var(--text-primary)]">{c.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Products by Volume — real cargo_intake data */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Top Products by Volume</h2>
          {topProducts.length > 0 && (
            <button
              onClick={() => exportToCSV(topProducts.map(r => ({ Rank: r.rank, Product: r.name, 'Qty Received': r.received, 'Deliveries': r.receivedCount, 'Qty Released': r.releasedQty, 'Releases': r.releasedCount, Status: r.status })), ['Rank','Product','Qty Received','Deliveries','Qty Released','Releases','Status'], 'top_products_by_volume')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent-light)] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-500">No products yet</p>
              <p className="text-xs text-gray-400 mt-1">Products will appear here as cargo is logged</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
                  {['Rank', 'Product', 'Total Received', 'Total Released', 'Status'].map(h => (
                    <th key={h} className="py-3 px-5 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {topProducts.map(row => (
                  <tr key={row.rank} className="hover:bg-[var(--accent-light)] transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-[var(--text-muted)]">#{row.rank}</td>
                    <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">{row.name}</td>
                    <td className="py-3.5 px-5 font-mono font-bold text-[var(--accent)]">{row.received.toLocaleString()} <span className="font-normal text-[var(--text-muted)] text-[10px]">(x{row.receivedCount})</span></td>
                    <td className="py-3.5 px-5 font-mono font-bold text-emerald-500">{row.releasedQty.toLocaleString()} <span className="font-normal text-[var(--text-muted)] text-[10px]">(x{row.releasedCount})</span></td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        row.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-600' :
                        row.status === 'Low Stock' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-rose-500/10 text-rose-600'
                      }`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-xs text-[var(--text-muted)] text-center pb-2">Loading analytics data...</p>
      )}
    </div>
  );
}
