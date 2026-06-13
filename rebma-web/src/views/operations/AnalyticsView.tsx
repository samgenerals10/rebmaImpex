import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Package, PackageCheck, AlertTriangle, BarChart2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface AddNotificationProps { addNotification: (msg: string) => void; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const thisMonth = new Date().getMonth();

const cargoInflow = MONTHS.slice(0, thisMonth + 1).map((m, i) => ({
  month: m,
  inflow: Math.round(120 + Math.random() * 200 + i * 15),
  released: Math.round(80 + Math.random() * 150 + i * 12),
}));

const stockTrend = MONTHS.slice(0, thisMonth + 1).map((m, i) => ({
  month: m,
  inStock: Math.round(60 + Math.random() * 20 + i * 2),
  lowStock: Math.round(5 + Math.random() * 8),
  outOfStock: Math.round(1 + Math.random() * 4),
}));

const categoryBreakdown = [
  { name: 'Raw Materials', value: 34, color: '#6366f1' },
  { name: 'Components',    value: 22, color: '#10b981' },
  { name: 'Chemicals',     value: 18, color: '#f59e0b' },
  { name: 'Equipment',     value: 14, color: '#f43f5e' },
  { name: 'Electrical',    value: 8,  color: '#8b5cf6' },
  { name: 'Safety',        value: 4,  color: '#06b6d4' },
];

const discrepancyTrend = MONTHS.slice(0, thisMonth + 1).map((m, i) => ({
  month: m,
  reported: Math.round(2 + Math.random() * 6),
  resolved: Math.round(1 + Math.random() * 5),
}));

const fulfillmentRate = MONTHS.slice(0, thisMonth + 1).map((m, i) => ({
  month: m,
  rate: Math.min(100, Math.round(78 + Math.random() * 15 + i * 0.5)),
}));

const KPI_CARDS = [
  { label: 'Total Cargo Intakes', value: 248, change: +12, icon: Package, color: 'var(--accent)' },
  { label: 'Released to Dispatch', value: 191, change: +8, icon: PackageCheck, color: '#10b981' },
  { label: 'Discrepancies Reported', value: 34, change: -5, icon: AlertTriangle, color: '#f59e0b' },
  { label: 'Avg. Processing Time', value: '2.4 days', change: -0.3, icon: TrendingDown, color: '#8b5cf6' },
];

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
  const [totalCargo, setTotalCargo] = useState(248);
  const [totalReleased, setTotalReleased] = useState(191);
  const [totalDiscrepancies, setTotalDiscrepancies] = useState(34);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cargoRes, releasedRes, discrepancyRes] = await Promise.all([
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }),
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).not('discrepancies', 'is', null),
        ]);
        if ((cargoRes.count ?? 0) > 0) setTotalCargo(cargoRes.count!);
        if ((releasedRes.count ?? 0) > 0) setTotalReleased(releasedRes.count!);
        if ((discrepancyRes.count ?? 0) > 0) setTotalDiscrepancies(discrepancyRes.count!);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleExport = () => {
    const rows = cargoInflow.map(d => `${d.month},${d.inflow},${d.released}`);
    const csv = ['Month,Cargo Inflow,Released', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'operations_analytics.csv'; a.click();
    URL.revokeObjectURL(url);
    addNotification('Operations analytics exported to CSV.');
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
        {KPI_CARDS.map((card, i) => {
          const Icon = card.icon;
          const displayValue = i === 0 ? totalCargo : i === 1 ? totalReleased : i === 2 ? totalDiscrepancies : card.value;
          const isPositive = typeof card.change === 'number' ? (i === 2 ? card.change < 0 : card.change > 0) : false;
          return (
            <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">{card.label}</p>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{typeof card.change === 'number' ? `${card.change > 0 ? '+' : ''}${card.change}` : card.change} vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cargo Inflow vs Release Velocity */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
        <div className="flex items-center gap-2 mb-5">
          <BarChart2 className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Cargo Inflow vs Release Velocity</h2>
        </div>
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
      </div>

      {/* Row: Stock Status Trend + Category Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Stock Status Over Time */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Stock Status Trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stockTrend} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Bar dataKey="inStock" name="In Stock" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="lowStock" name="Low Stock" fill="#f59e0b" radius={[3,3,0,0]} />
              <Bar dataKey="outOfStock" name="Out of Stock" fill="#f43f5e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown Pie */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Stock by Category</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0}>
                  {categoryBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {categoryBreakdown.map(c => (
                <div key={c.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs text-[var(--text-secondary)] truncate">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row: Discrepancy Trend + Fulfillment Rate */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Discrepancy Trend */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Discrepancy Reports</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={discrepancyTrend} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Bar dataKey="reported" name="Reported" fill="#f59e0b" radius={[3,3,0,0]} />
              <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fulfillment Rate */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Fulfillment Rate (%)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fulfillmentRate} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="fulfillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="rate" name="Fulfillment %" stroke="#8b5cf6" fill="url(#fulfillGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Top Products by Volume</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
                {['Rank', 'Product', 'Total Received', 'Total Released', 'Discrepancies', 'Status'].map(h => (
                  <th key={h} className="py-3 px-5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[
                { rank: 1, name: 'Industrial Steel Pipes', received: 450, released: 420, disc: 2, status: 'Healthy' },
                { rank: 2, name: 'Palm Oil Barrels (200L)', received: 380, released: 351, disc: 5, status: 'Healthy' },
                { rank: 3, name: 'Hydraulic Hose Fittings', received: 300, released: 268, disc: 12, status: 'Low Stock' },
                { rank: 4, name: 'Generator Parts Kit', received: 120, released: 110, disc: 1, status: 'Healthy' },
                { rank: 5, name: 'Chemical Drums (20L)', received: 100, released: 100, disc: 8, status: 'Out of Stock' },
              ].map(row => (
                <tr key={row.rank} className="hover:bg-[var(--accent-light)] transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-[var(--text-muted)]">#{row.rank}</td>
                  <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">{row.name}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-[var(--accent)]">{row.received.toLocaleString()}</td>
                  <td className="py-3.5 px-5 font-mono font-bold text-emerald-500">{row.released.toLocaleString()}</td>
                  <td className="py-3.5 px-5 font-mono text-rose-500">{row.disc}</td>
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
        </div>
      </div>

      {loading && (
        <p className="text-xs text-[var(--text-muted)] text-center pb-2">Refreshing live data...</p>
      )}
    </div>
  );
}
