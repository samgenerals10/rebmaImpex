import { useState } from 'react';
import { TrendingUp, TrendingDown, Download, BarChart2, Users, ShoppingCart, DollarSign } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import { exportToCSV } from '../../utils/export';

const PERIODS = ['7D', '30D', '90D', '12M'] as const;
type Period = typeof PERIODS[number];

const DATA: Record<Period, {
  sales: { label: string; value: number }[];
  customers: { label: string; value: number }[];
}> = {
  '7D': {
    sales: [
      { label: 'Mon', value: 42000 }, { label: 'Tue', value: 68000 }, { label: 'Wed', value: 55000 },
      { label: 'Thu', value: 91000 }, { label: 'Fri', value: 78000 }, { label: 'Sat', value: 110000 }, { label: 'Sun', value: 94000 },
    ],
    customers: [
      { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 0 },
      { label: 'Thu', value: 3 }, { label: 'Fri', value: 1 }, { label: 'Sat', value: 2 }, { label: 'Sun', value: 1 },
    ],
  },
  '30D': {
    sales: [
      { label: 'W1', value: 280000 }, { label: 'W2', value: 340000 }, { label: 'W3', value: 295000 }, { label: 'W4', value: 410000 },
    ],
    customers: [
      { label: 'W1', value: 3 }, { label: 'W2', value: 5 }, { label: 'W3', value: 4 }, { label: 'W4', value: 8 },
    ],
  },
  '90D': {
    sales: [
      { label: 'Oct', value: 880000 }, { label: 'Nov', value: 1050000 }, { label: 'Dec', value: 925000 },
    ],
    customers: [
      { label: 'Oct', value: 8 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 5 },
    ],
  },
  '12M': {
    sales: [
      { label: 'Jan', value: 680000 }, { label: 'Feb', value: 720000 }, { label: 'Mar', value: 810000 },
      { label: 'Apr', value: 760000 }, { label: 'May', value: 920000 }, { label: 'Jun', value: 870000 },
      { label: 'Jul', value: 990000 }, { label: 'Aug', value: 1050000 }, { label: 'Sep', value: 980000 },
      { label: 'Oct', value: 880000 }, { label: 'Nov', value: 1050000 }, { label: 'Dec', value: 925000 },
    ],
    customers: [
      { label: 'Jan', value: 2 }, { label: 'Feb', value: 3 }, { label: 'Mar', value: 4 },
      { label: 'Apr', value: 3 }, { label: 'May', value: 6 }, { label: 'Jun', value: 5 },
      { label: 'Jul', value: 7 }, { label: 'Aug', value: 8 }, { label: 'Sep', value: 6 },
      { label: 'Oct', value: 8 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 5 },
    ],
  },
};

const KPI: Record<Period, { revenue: number; orders: number; customers: number; avgOrder: number; rChange: string; oChange: string; cChange: string; aChange: string }> = {
  '7D':  { revenue: 438000, orders: 18, customers: 10, avgOrder: 24333, rChange: '+14.2%', oChange: '+5', cChange: '+2', aChange: '+8.5%' },
  '30D': { revenue: 1325000, orders: 48, customers: 20, avgOrder: 27604, rChange: '+8.7%', oChange: '+12', cChange: '+8', aChange: '+3.2%' },
  '90D': { revenue: 2855000, orders: 132, customers: 24, avgOrder: 21628, rChange: '+11.3%', oChange: '+28', cChange: '+15', aChange: '-2.1%' },
  '12M': { revenue: 10715000, orders: 487, customers: 24, avgOrder: 22000, rChange: '+19.4%', oChange: '+87', cChange: '+24', aChange: '+6.8%' },
};

const PRODUCTS = [
  { rank: 1, name: 'Hydraulic Hose Fittings', orders: 34, revenue: 399000, change: 12.4 },
  { rank: 2, name: 'PVC Pipe Fittings Set', orders: 28, revenue: 289000, change: 8.1 },
  { rank: 3, name: 'Steel Pipe 3/4"', orders: 22, revenue: 372000, change: 5.6 },
  { rank: 4, name: 'Copper Tubing 1/2"', orders: 19, revenue: 180500, change: -2.3 },
  { rank: 5, name: 'Gate Valve 2"', orders: 15, revenue: 142000, change: 15.9 },
];

const TOP_CUSTOMERS = [
  { name: 'Tema Industrial Ltd', orders: 12, revenue: 480000, lastOrder: '2024-12-09', status: 'Active' },
  { name: 'Accra Builders Co.', orders: 9, revenue: 310000, lastOrder: '2024-12-08', status: 'Active' },
  { name: 'Kumasi Contractors', orders: 7, revenue: 245000, lastOrder: '2024-12-07', status: 'Active' },
  { name: 'Takoradi Ventures', orders: 6, revenue: 198000, lastOrder: '2024-12-06', status: 'Credit' },
  { name: 'Cape Coast Supplies', orders: 5, revenue: 167000, lastOrder: '2024-12-05', status: 'Active' },
];

const PAYMENT_PIE = [
  { name: 'Cash', value: 45, color: '#10b981' },
  { name: 'Cheque', value: 25, color: '#3b82f6' },
  { name: 'Mobile Money', value: 20, color: '#f59e0b' },
  { name: 'Credit', value: 10, color: '#8b5cf6' },
];

const STATUS_FUNNEL = [
  { name: 'Created', count: 487, pct: 100 },
  { name: 'Sent to Finance', count: 452, pct: 92.8 },
  { name: 'Finance Approved', count: 401, pct: 82.3 },
  { name: 'Prepared', count: 380, pct: 78.0 },
  { name: 'Delivered', count: 348, pct: 71.5 },
];

const Tt = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color || 'var(--accent)' }} className="font-medium">{p.name}: {typeof p.value === 'number' && p.value > 1000 ? `GHS ${p.value.toLocaleString()}` : p.value}</p>)}
    </div>
  );
};

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function MarketingAnalyticsView({ addNotification, currentUser }: Props) {
  const [period, setPeriod] = useState<Period>('30D');
  const kpi = KPI[period];
  const d = DATA[period];

  function exportTopCustomers() {
    exportToCSV(
      TOP_CUSTOMERS.map(c => ({ Name: c.name, Orders: c.orders, Revenue: c.revenue, 'Last Order': c.lastOrder, Status: c.status })),
      ['Name', 'Orders', 'Revenue', 'Last Order', 'Status'],
      'top_customers'
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Marketing Analytics</h1>
          <p className="text-sm text-[var(--text-secondary)]">Sales performance and trends</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${period === p ? 'text-white border-transparent' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'}`} style={period === p ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `GHS ${(kpi.revenue / 1000).toFixed(0)}K`, change: kpi.rChange, icon: DollarSign },
          { label: 'Total Orders', value: kpi.orders, change: kpi.oChange, icon: ShoppingCart },
          { label: 'New Customers', value: kpi.customers, change: kpi.cChange, icon: Users },
          { label: 'Avg Order Value', value: `GHS ${(kpi.avgOrder / 1000).toFixed(1)}K`, change: kpi.aChange, icon: BarChart2 },
        ].map(({ label, value, change, icon: Icon }) => {
          const up = change.startsWith('+');
          return (
            <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                  <Icon size={14} style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
              <div className="flex items-center gap-1 mt-1">
                {up ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-400" />}
                <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>{change}</span>
                <span className="text-xs text-[var(--text-muted)]">vs prev period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Trend + Product Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Sales Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.sales}>
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<Tt />} />
                <Bar dataKey="value" name="Sales" fill="var(--accent)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Product Performance</h3>
          <div className="space-y-3">
            {PRODUCTS.map(p => {
              const maxRev = PRODUCTS[0].revenue;
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#8b5cf6'][p.rank - 1] }}>
                    {p.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium flex items-center gap-0.5 ${p.change > 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {p.change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {Math.abs(p.change)}%
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">GHS {(p.revenue / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.revenue / maxRev) * 100}%`, background: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#8b5cf6'][p.rank - 1] }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Customer Growth + Payment Methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Customer Growth</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.customers}>
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tt />} />
                <Line type="monotone" dataKey="value" name="New Customers" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Payment Methods</h3>
          <div className="flex items-center gap-5">
            <div style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PAYMENT_PIE} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                    {PAYMENT_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {PAYMENT_PIE.map(p => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-sm text-[var(--text-secondary)]">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Funnel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Order Status Funnel</h3>
        <div className="space-y-3">
          {STATUS_FUNNEL.map((s, i) => {
            const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#10b981'];
            return (
              <div key={s.name} className="flex items-center gap-4">
                <div className="w-28 text-sm text-[var(--text-secondary)] text-right flex-shrink-0">{s.name}</div>
                <div className="flex-1 bg-[var(--bg-input)] rounded-full h-7 relative overflow-hidden">
                  <div className="h-full rounded-full flex items-center justify-end pr-3 transition-all" style={{ width: `${s.pct}%`, background: colors[i] }}>
                    <span className="text-xs font-bold text-white">{s.count}</span>
                  </div>
                </div>
                <div className="w-14 text-right text-xs text-[var(--text-muted)] flex-shrink-0">{s.pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--text-primary)]">Top Customers</h3>
          <button onClick={exportTopCustomers} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <Download size={12} /> Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['#', 'Customer', 'Total Orders', 'Revenue', 'Last Order', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {TOP_CUSTOMERS.map((c, i) => (
                <tr key={c.name} className="hover:bg-[var(--bg-input)]">
                  <td className="px-4 py-3 text-[var(--text-muted)]">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c.orders}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">GHS {c.revenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{c.lastOrder}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
