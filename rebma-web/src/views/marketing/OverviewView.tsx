import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  ShoppingCart, UserPlus, ClipboardList, CreditCard, FileText, BarChart2,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, MoreVertical,
  Package, Clock, CheckCircle, Truck
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import type { Order, Customer } from '../../types/erp';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
  ordersList?: Order[];
  customersList?: Customer[];
}

const SALES_DATA = [
  { d: 'Mon', value: 42000 }, { d: 'Tue', value: 68000 }, { d: 'Wed', value: 55000 },
  { d: 'Thu', value: 91000 }, { d: 'Fri', value: 78000 }, { d: 'Sat', value: 110000 }, { d: 'Sun', value: 94000 },
];
const REVENUE_DATA = [
  { week: 'W1', revenue: 180000 }, { week: 'W2', revenue: 240000 },
  { week: 'W3', revenue: 195000 }, { week: 'W4', revenue: 310000 },
];
const PRODUCT_PIE = [
  { name: 'Hydraulic Fittings', value: 38, color: '#10b981' },
  { name: 'PVC Pipes', value: 27, color: '#3b82f6' },
  { name: 'Steel Pipes', value: 22, color: '#f59e0b' },
  { name: 'Other', value: 13, color: '#94a3b8' },
];
const STATUS_PIE = [
  { name: 'Delivered', value: 45, color: '#10b981' },
  { name: 'In Progress', value: 28, color: '#6366f1' },
  { name: 'Pending', value: 20, color: '#f59e0b' },
  { name: 'Rejected', value: 7, color: '#ef4444' },
];
const CUST_GROWTH = [
  { month: 'Jul', n: 3 }, { month: 'Aug', n: 5 }, { month: 'Sep', n: 4 },
  { month: 'Oct', n: 8 }, { month: 'Nov', n: 6 }, { month: 'Dec', n: 9 },
];
const PAYMENT_PIE = [
  { name: 'Cash', value: 45, color: '#10b981' },
  { name: 'Cheque', value: 25, color: '#3b82f6' },
  { name: 'Mobile Money', value: 20, color: '#f59e0b' },
  { name: 'Credit', value: 10, color: '#8b5cf6' },
];
const CREDIT_MOCK = [
  { id: 'CR-001', customer: 'Accra Builders Ltd', amount: 45000, date: '2024-12-08', status: 'Pending Management' },
  { id: 'CR-002', customer: 'Kumasi Traders Co.', amount: 28000, date: '2024-12-07', status: 'Management Approved' },
  { id: 'CR-003', customer: 'Takoradi Ventures', amount: 62000, date: '2024-12-06', status: 'Finance Processing' },
];
const TOP_PRODUCTS = [
  { name: 'Hydraulic Hose Fittings', orders: 34, qty: 4200, revenue: 399000 },
  { name: 'PVC Pipe Fittings', orders: 28, qty: 8500, revenue: 289000 },
  { name: 'Steel Pipe 3/4"', orders: 22, qty: 3100, revenue: 372000 },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING_FINANCE: 'bg-yellow-100 text-yellow-700',
  PENDING_MANAGEMENT: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-teal-100 text-teal-700',
  DELIVERED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING_FINANCE: 'Finance Review',
  PENDING_MANAGEMENT: 'Mgmt Review',
  APPROVED: 'Approved',
  PROCESSING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
};

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const Tt = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: GHS {p.value.toLocaleString()}</p>)}
    </div>
  );
};

export default function MarketingOverviewView({ addNotification, setActiveSubTab, currentUser, ordersList = [], customersList = [] }: Props) {
  const firstName = currentUser?.fullName?.split(' ')[0] || 'Marketing';
  const [salesPeriod, setSalesPeriod] = useState('This Week');
  const [revPeriod, setRevPeriod] = useState('This Month');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const totalOrders = ordersList.length || 48;
  const totalCustomers = customersList.length || 24;
  const pendingFinance = ordersList.filter(o => o.status === 'PENDING_FINANCE').length || 5;
  const revenue = ordersList.filter(o => ['APPROVED', 'PROCESSING', 'DELIVERED'].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0) || 925000;

  const recentOrders = (ordersList.length > 0 ? ordersList : [
    { id: 'ORD-2024-001', clientName: 'Tema Industrial Ltd', productName: 'Steel Pipes', totalAmount: 120000, status: 'PENDING_FINANCE', createdAt: new Date(Date.now() - 2e6).toISOString(), paymentMode: 'CASH' },
    { id: 'ORD-2024-002', clientName: 'Accra Builders Co.', productName: 'PVC Pipes', totalAmount: 45000, status: 'APPROVED', createdAt: new Date(Date.now() - 5e6).toISOString(), paymentMode: 'CHEQUE' },
    { id: 'ORD-2024-003', clientName: 'Kumasi Contractors', productName: 'Hydraulic Fittings', totalAmount: 28000, status: 'DELIVERED', createdAt: new Date(Date.now() - 9e6).toISOString(), paymentMode: 'CASH' },
    { id: 'ORD-2024-004', clientName: 'Cape Coast Ventures', productName: 'Copper Wire', totalAmount: 52000, status: 'PENDING_MANAGEMENT', createdAt: new Date(Date.now() - 15e6).toISOString(), paymentMode: 'CREDIT' },
    { id: 'ORD-2024-005', clientName: 'Ho Supplies Ltd', productName: 'Valve Gates', totalAmount: 10500, status: 'PROCESSING', createdAt: new Date(Date.now() - 20e6).toISOString(), paymentMode: 'MOBILE_MONEY' },
  ] as Order[]).slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)]">Here's your sales overview today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={() => addNotification?.('Dashboard refreshed')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'New Order', tab: 'CreateOrder', icon: ShoppingCart },
          { label: 'Add Customer', tab: 'RegisterCustomer', icon: UserPlus },
          { label: 'View Orders', tab: 'CreateOrder', icon: ClipboardList },
          { label: 'Credit Request', tab: 'CreditRequests', icon: CreditCard },
          { label: 'Invoices', tab: 'Invoices', icon: FileText },
          { label: 'Analytics', tab: 'MktAnalytics', icon: BarChart2 },
        ].map(({ label, tab, icon: Icon }) => (
          <button key={label} onClick={() => setActiveSubTab?.(tab)} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: totalOrders, change: '+12%', up: true, sub: 'vs last week', tab: 'CreateOrder' },
          { label: 'Total Customers', value: totalCustomers, change: '+3 new', up: true, sub: 'this month', tab: 'RegisterCustomer' },
          { label: 'Pending Finance', value: pendingFinance, change: pendingFinance > 5 ? '! high' : 'normal', up: pendingFinance <= 5, sub: 'awaiting review', tab: 'CreateOrder' },
          { label: 'Revenue Generated', value: `GHS ${(revenue / 1000).toFixed(0)}K`, change: '+8.2%', up: true, sub: 'approved orders', tab: 'MktAnalytics' },
        ].map(({ label, value, change, up, sub, tab }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer hover:border-[var(--accent)] transition-colors" onClick={() => setActiveSubTab?.(tab)}>
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>{change}</span>
              <span className="text-xs text-[var(--text-muted)]">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2 - Sales Overview + Orders by Category */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Sales Overview</h3>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">GHS 438,000 <span className="text-sm font-normal text-green-500">+14.2%</span></p>
            </div>
            <select value={salesPeriod} onChange={e => setSalesPeriod(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none">
              {['This Week', 'This Month', '6 Months', 'Year'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SALES_DATA}>
                <defs>
                  <linearGradient id="mktSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<Tt />} />
                <Area type="monotone" dataKey="value" name="Sales" stroke="var(--accent)" strokeWidth={2} fill="url(#mktSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Orders by Product</h3>
            <button onClick={() => setActiveSubTab?.('MktAnalytics')} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All</button>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative" style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PRODUCT_PIE} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={62} strokeWidth={0}>
                    {PRODUCT_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-lg font-bold text-[var(--text-primary)]">{totalOrders}</p>
                <p className="text-xs text-[var(--text-muted)]">orders</p>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {PRODUCT_PIE.map(p => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-xs text-[var(--text-secondary)] truncate max-w-[110px]">{p.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3 - Recent Orders + Top Products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Recent Orders</h3>
            <button onClick={() => setActiveSubTab?.('CreateOrder')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All <ArrowRight size={12} /></button>
          </div>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl group hover:bg-[var(--border)] transition-colors cursor-pointer" onClick={() => setActiveSubTab?.('CreateOrder')}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>{initials(order.clientName)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{order.clientName}</p>
                  <p className="text-xs text-[var(--text-muted)]">{order.id} · {order.productName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {order.totalAmount.toLocaleString()}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || ''}`}>{STATUS_LABELS[order.status] || order.status}</span>
                </div>
                <div className="relative opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === order.id ? null : order.id); }} className="p-1 rounded-lg hover:bg-[var(--bg-card)]"><MoreVertical size={12} className="text-[var(--text-muted)]" /></button>
                  {menuOpen === order.id && (
                    <div className="absolute right-0 top-6 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setActiveSubTab?.('CreateOrder'); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                      <button onClick={() => { setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Track Order</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Top Products</h3>
            <button onClick={() => setActiveSubTab?.('MktAnalytics')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All <ArrowRight size={12} /></button>
          </div>
          <div className="space-y-3">
            {TOP_PRODUCTS.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: ['#10b981', '#6366f1', '#f59e0b'][i] }}>#{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{p.orders} orders · {p.qty} units</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {(p.revenue / 1000).toFixed(0)}K</p>
                  <TrendingUp size={11} className="text-green-500 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 4 - Revenue Overview */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Revenue Overview</h3>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">GHS 925,000 <span className="text-sm font-normal text-green-500">+8.2%</span></p>
          </div>
          <select value={revPeriod} onChange={e => setRevPeriod(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none">
            {['This Month', 'This Quarter', 'This Year'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={REVENUE_DATA}>
              <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<Tt />} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROW 5 - Order Pipeline + Credit Requests */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Order Pipeline</h3>
          <div className="flex items-center gap-6">
            <div className="relative" style={{ width: 130, height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={STATUS_PIE} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={62} strokeWidth={0}>
                    {STATUS_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-lg font-bold text-[var(--text-primary)]">{totalOrders}</p>
                <p className="text-xs text-[var(--text-muted)]">total</p>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {STATUS_PIE.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-[var(--text-secondary)]">{s.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Credit Requests</h3>
            <button onClick={() => setActiveSubTab?.('CreditRequests')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>View All <ArrowRight size={12} /></button>
          </div>
          {CREDIT_MOCK.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-[var(--text-muted)]"><CheckCircle size={28} className="opacity-30 mb-2" /><p className="text-sm">No pending credit requests</p></div>
          ) : (
            <div className="space-y-2">
              {CREDIT_MOCK.map(cr => (
                <div key={cr.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl cursor-pointer hover:bg-[var(--border)]" onClick={() => setActiveSubTab?.('CreditRequests')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{cr.customer}</p>
                    <p className="text-xs text-[var(--text-muted)]">{cr.id} · {cr.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">GHS {cr.amount.toLocaleString()}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cr.status === 'Pending Management' ? 'bg-yellow-100 text-yellow-700' : cr.status === 'Management Approved' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{cr.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 6 - Customer Growth + Payment Methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[var(--text-primary)]">Customer Growth</h3>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{totalCustomers} <span className="text-sm font-normal text-green-500">+3 this month</span></p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CUST_GROWTH}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="n" name="New Customers" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Payment Methods</h3>
          <div className="flex items-center gap-5">
            <div style={{ width: 120, height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PAYMENT_PIE} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={58} strokeWidth={0}>
                    {PAYMENT_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {PAYMENT_PIE.map(p => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-xs text-[var(--text-secondary)]">{p.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
