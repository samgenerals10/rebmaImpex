import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Download, BarChart2, Users, ShoppingCart, DollarSign, ShoppingBag } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import { exportToCSV } from '../../utils/export';
import { supabase } from '../../lib/supabaseClient';

const COLORS = ['#10b981','#6366f1','#f59e0b','#3b82f6','#8b5cf6','#ec4899'];

const Tt = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color || 'var(--accent)' }} className="font-medium">{p.name}: {typeof p.value === 'number' && p.value > 1000 ? `GHS ${p.value.toLocaleString()}` : p.value}</p>)}
    </div>
  );
};

interface TopProduct { rank: number; name: string; orders: number; revenue: number; }
interface TopCustomer { name: string; orders: number; revenue: number; lastOrder: string; status: string; }
interface SalesPoint { label: string; value: number; }
interface CustomerPoint { label: string; value: number; }
interface PaymentSlice { name: string; value: number; color: string; }
interface FunnelStage { name: string; count: number; pct: number; }

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function MarketingAnalyticsView({ addNotification, currentUser }: Props) {
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [salesTrend, setSalesTrend] = useState<SalesPoint[]>([]);
  const [customerGrowth, setCustomerGrowth] = useState<CustomerPoint[]>([]);
  const [paymentPie, setPaymentPie] = useState<PaymentSlice[]>([]);
  const [statusFunnel, setStatusFunnel] = useState<FunnelStage[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Orders for revenue, funnel, top products
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_amount, status, created_at, client_name, product_name, payment_mode')
          .order('created_at', { ascending: false });

        const orderList = (orders as { id: string; total_amount: number; status: string; created_at: string; client_name: string; product_name: string; payment_mode: string }[]) ?? [];

        setTotalOrders(orderList.length);
        const rev = orderList.reduce((s, o) => s + (o.total_amount || 0), 0);
        setTotalRevenue(rev);
        setAvgOrderValue(orderList.length > 0 ? Math.round(rev / orderList.length) : 0);

        // Sales trend — last 6 months
        const monthMap: Record<string, number> = {};
        const custMonthMap: Record<string, Set<string>> = {};
        for (const o of orderList) {
          const m = MONTHS_SHORT[new Date(o.created_at).getMonth()];
          monthMap[m] = (monthMap[m] || 0) + (o.total_amount || 0);
          if (!custMonthMap[m]) custMonthMap[m] = new Set();
          if (o.client_name) custMonthMap[m].add(o.client_name);
        }
        const last6 = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
          const k = MONTHS_SHORT[d.getMonth()];
          return { label: k, value: monthMap[k] || 0 };
        });
        setSalesTrend(last6);
        setCustomerGrowth(last6.map(pt => ({ label: pt.label, value: custMonthMap[pt.label]?.size || 0 })));

        // Payment methods pie
        const pmMap: Record<string, number> = {};
        for (const o of orderList) {
          const pm = o.payment_mode || 'Unknown';
          pmMap[pm] = (pmMap[pm] || 0) + 1;
        }
        const pmTotal = orderList.length || 1;
        const piColors = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899'];
        setPaymentPie(
          Object.entries(pmMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count], i) => ({
              name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              value: Math.round((count / pmTotal) * 100),
              color: piColors[i % piColors.length],
            }))
        );

        // Status funnel
        const statusCounts: Record<string, number> = {};
        for (const o of orderList) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        const funnelStages = [
          { key: null, name: 'Created' },
          { key: 'PENDING_FINANCE', name: 'Sent to Finance' },
          { key: 'finance_approved', name: 'Finance Approved' },
          { key: 'PREPARED', name: 'Prepared' },
          { key: 'DELIVERED', name: 'Delivered' },
        ];
        const total = orderList.length || 1;
        setStatusFunnel(funnelStages.map(stage => {
          const count = stage.key === null
            ? orderList.length
            : statusCounts[stage.key] || 0;
          return { name: stage.name, count, pct: Math.round((count / total) * 100) };
        }));

        // Top products from orders
        const prodMap: Record<string, { orders: number; revenue: number }> = {};
        for (const o of orderList) {
          const name = o.product_name || 'Unnamed Product';
          if (!prodMap[name]) prodMap[name] = { orders: 0, revenue: 0 };
          prodMap[name].orders++;
          prodMap[name].revenue += o.total_amount || 0;
        }
        setTopProducts(
          Object.entries(prodMap)
            .sort((a, b) => b[1].orders - a[1].orders)
            .slice(0, 5)
            .map(([name, d], i) => ({ rank: i + 1, name, orders: d.orders, revenue: d.revenue }))
        );

        // Top customers by revenue
        const custMap: Record<string, { orders: number; revenue: number; lastOrder: string; status: string }> = {};
        for (const o of orderList) {
          const name = o.client_name || 'Unknown';
          if (!custMap[name]) custMap[name] = { orders: 0, revenue: 0, lastOrder: o.created_at, status: 'Active' };
          custMap[name].orders++;
          custMap[name].revenue += o.total_amount || 0;
          if (o.created_at > custMap[name].lastOrder) custMap[name].lastOrder = o.created_at;
        }
        setTopCustomers(
          Object.entries(custMap)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5)
            .map(([name, d]) => ({
              name,
              orders: d.orders,
              revenue: d.revenue,
              lastOrder: new Date(d.lastOrder).toLocaleDateString('en-GB'),
              status: d.status,
            }))
        );

        // Total unique customers from customers table
        const { count: custCount } = await supabase
          .from('customers')
          .select('id', { count: 'exact', head: true });
        setTotalCustomers(custCount ?? 0);

      } catch {}
      setLoading(false);
    })();
  }, []);

  function exportTopCustomers() {
    exportToCSV(
      topCustomers.map(c => ({ Name: c.name, Orders: c.orders, Revenue: c.revenue, 'Last Order': c.lastOrder, Status: c.status })),
      ['Name', 'Orders', 'Revenue', 'Last Order', 'Status'],
      'top_customers'
    );
  }

  const kpiCards = [
    { label: 'Total Revenue', value: loading ? '—' : `GHS ${(totalRevenue / 1000).toFixed(1)}K`, icon: DollarSign },
    { label: 'Total Orders', value: loading ? '—' : totalOrders, icon: ShoppingCart },
    { label: 'Total Customers', value: loading ? '—' : totalCustomers, icon: Users },
    { label: 'Avg Order Value', value: loading ? '—' : `GHS ${(avgOrderValue / 1000).toFixed(1)}K`, icon: BarChart2 },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Marketing Analytics</h1>
          <p className="text-sm text-[var(--text-secondary)]">Sales performance and trends — live from Supabase</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                <Icon size={14} style={{ color: 'var(--accent)' }} />
              </div>
            </div>
            {loading ? (
              <div className="animate-pulse h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            ) : (
              <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Sales Trend + Product Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Sales Trend (Last 6 Months)</h3>
          {loading ? (
            <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : salesTrend.every(d => d.value === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <BarChart2 className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No sales data yet</p>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<Tt />} />
                  <Bar dataKey="value" name="Sales (GHS)" fill="var(--accent)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Top Products by Orders</h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-8 bg-slate-100 dark:bg-slate-800 rounded" />)}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ShoppingBag className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No product data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map(p => {
                const maxOrders = topProducts[0].orders || 1;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: COLORS[p.rank - 1] || COLORS[0] }}>
                      {p.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                        <span className="text-xs text-[var(--text-secondary)] flex-shrink-0 ml-2">GHS {(p.revenue / 1000).toFixed(1)}K</span>
                      </div>
                      <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(p.orders / maxOrders) * 100}%`, background: COLORS[p.rank - 1] || COLORS[0] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Customer Growth + Payment Methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Order Activity by Month</h3>
          {loading ? (
            <div className="animate-pulse h-44 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : customerGrowth.every(d => d.value === 0) ? (
            <div className="flex flex-col items-center justify-center h-44 text-center">
              <Users className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No activity data yet</p>
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customerGrowth}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<Tt />} />
                  <Line type="monotone" dataKey="value" name="Unique Clients" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Payment Methods</h3>
          {loading ? (
            <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : paymentPie.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm text-gray-400">No payment data yet</p>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <div style={{ width: 130, height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentPie} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} strokeWidth={0}>
                      {paymentPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5">
                {paymentPie.map(p => (
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
          )}
        </div>
      </div>

      {/* Order Status Funnel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Order Status Funnel</h3>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-7 bg-slate-100 dark:bg-slate-800 rounded" />)}
          </div>
        ) : statusFunnel.every(s => s.count === 0) ? (
          <div className="text-center py-8 text-gray-400 text-sm">No order funnel data yet</div>
        ) : (
          <div className="space-y-3">
            {statusFunnel.map((s, i) => {
              const fColors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#10b981'];
              return (
                <div key={s.name} className="flex items-center gap-4">
                  <div className="w-28 text-sm text-[var(--text-secondary)] text-right flex-shrink-0">{s.name}</div>
                  <div className="flex-1 bg-[var(--bg-input)] rounded-full h-7 relative overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-3 transition-all" style={{ width: `${Math.max(s.pct, 2)}%`, background: fColors[i] }}>
                      <span className="text-xs font-bold text-white">{s.count}</span>
                    </div>
                  </div>
                  <div className="w-14 text-right text-xs text-[var(--text-muted)] flex-shrink-0">{s.pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Customers Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--text-primary)]">Top Customers by Revenue</h3>
          {topCustomers.length > 0 && (
            <button onClick={exportTopCustomers} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">
              <Download size={12} /> Export
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-100 dark:bg-slate-800 rounded" />)}
            </div>
          ) : topCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-500">No customer data yet</p>
              <p className="text-xs text-gray-400 mt-1">Customers will appear here as orders are placed</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['#', 'Customer', 'Total Orders', 'Revenue', 'Last Order', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {topCustomers.map((c, i) => (
                  <tr key={c.name} className="hover:bg-[var(--bg-input)]">
                    <td className="px-4 py-3 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{c.name}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{c.orders}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">GHS {c.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{c.lastOrder}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
