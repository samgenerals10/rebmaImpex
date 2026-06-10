// rebma-web/src/components/FoodieShell.tsx
// Full Foodie template layout — wraps all departments when theme-foodie is active

import { useMemo } from 'react';
import {
  ShoppingBag, DollarSign, Users, Star, TrendingUp, TrendingDown,
  MoreVertical, Bell, Search, Calendar, Package, Truck, BarChart3,
  ShieldCheck, Activity, Clipboard, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import type { CurrentUser } from '../types/erp';

interface FoodieShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

// Per-department KPI data adapted for REBMA IMPEX
const getDeptKpis = (dept: string) => {
  switch (dept) {
    case 'CEO':
      return [
        { label: 'Total Orders', value: '1,284', trend: '+12.5%', up: true, icon: ShoppingBag },
        { label: 'Revenue (GHS)', value: '₵248,520', trend: '+8.3%', up: true, icon: DollarSign },
        { label: 'Active Staff', value: '25', trend: '+2', up: true, icon: Users },
        { label: 'Avg. Rating', value: '4.8', trend: '+0.2', up: true, icon: Star },
      ];
    case 'MANAGEMENT':
      return [
        { label: 'Cargo Approvals', value: '34', trend: '+5', up: true, icon: Package },
        { label: 'Pending Credit', value: '7', trend: '-2', up: false, icon: ShieldCheck },
        { label: 'Active Vendors', value: '18', trend: '+3', up: true, icon: Users },
        { label: 'Avg. Approval Time', value: '1.4h', trend: '-0.3h', up: true, icon: Star },
      ];
    case 'HR':
      return [
        { label: 'Total Staff', value: '25', trend: '+2', up: true, icon: Users },
        { label: 'Attendance Rate', value: '94%', trend: '+1.2%', up: true, icon: Activity },
        { label: 'Pending Requests', value: '4', trend: '-1', up: true, icon: Clipboard },
        { label: 'Avg. Performance', value: '4.6', trend: '+0.1', up: true, icon: Star },
      ];
    case 'MARKETING':
      return [
        { label: 'Total Orders', value: '312', trend: '+18%', up: true, icon: ShoppingBag },
        { label: 'Revenue (GHS)', value: '₵84,600', trend: '+11%', up: true, icon: DollarSign },
        { label: 'New Customers', value: '28', trend: '+6', up: true, icon: Users },
        { label: 'Conversion Rate', value: '6.4%', trend: '+0.8%', up: true, icon: TrendingUp },
      ];
    case 'OPERATIONS':
      return [
        { label: 'Port Ingestions', value: '1,020T', trend: '+9%', up: true, icon: Package },
        { label: 'Stock Value (GHS)', value: '₵520,100', trend: '+4%', up: true, icon: DollarSign },
        { label: 'Active Warehouses', value: '3', trend: '0', up: true, icon: BarChart3 },
        { label: 'Defect Rate', value: '0.8%', trend: '-0.3%', up: true, icon: Star },
      ];
    case 'FINANCE':
      return [
        { label: 'Invoices Processed', value: '48', trend: '+12', up: true, icon: Clipboard },
        { label: 'Revenue (GHS)', value: '₵312,800', trend: '+6.2%', up: true, icon: DollarSign },
        { label: 'Outstanding', value: '₵18,400', trend: '-₵2,100', up: true, icon: ShieldCheck },
        { label: 'Avg. Payment Days', value: '4.2d', trend: '-0.8d', up: true, icon: Star },
      ];
    case 'DISPATCH':
      return [
        { label: 'Active Trucks', value: '1', trend: '0', up: true, icon: Truck },
        { label: 'Deliveries Today', value: '8', trend: '+2', up: true, icon: Package },
        { label: 'On-Time Rate', value: '91%', trend: '+3%', up: true, icon: TrendingUp },
        { label: 'Avg. Distance', value: '42km', trend: '-5km', up: true, icon: Star },
      ];
    case 'LOGISTICS':
      return [
        { label: 'Fleet Size', value: '6 Units', trend: '0', up: true, icon: Truck },
        { label: 'Maintenance Due', value: '2', trend: '+1', up: false, icon: Activity },
        { label: 'Fuel Cost (GHS)', value: '₵4,200', trend: '-₵300', up: true, icon: DollarSign },
        { label: 'Route Efficiency', value: '88%', trend: '+2%', up: true, icon: Star },
      ];
    case 'PRODUCTION':
      return [
        { label: 'Batch Orders', value: '14', trend: '+3', up: true, icon: Package },
        { label: 'Completion Rate', value: '96%', trend: '+2%', up: true, icon: Activity },
        { label: 'Material Waste', value: '3.1%', trend: '-0.4%', up: true, icon: Clipboard },
        { label: 'Avg. Output', value: '420kg', trend: '+30kg', up: true, icon: Star },
      ];
    case 'RECEPTION':
      return [
        { label: 'Visitors Today', value: '14', trend: '+4', up: true, icon: Users },
        { label: 'Check-ins', value: '11', trend: '+2', up: true, icon: Activity },
        { label: 'Pending Badges', value: '3', trend: '+1', up: false, icon: ShieldCheck },
        { label: 'Avg. Visit (min)', value: '28', trend: '-4', up: true, icon: Star },
      ];
    default:
      return [
        { label: 'Total Orders', value: '1,284', trend: '+12.5%', up: true, icon: ShoppingBag },
        { label: 'Revenue (GHS)', value: '₵248,520', trend: '+8.3%', up: true, icon: DollarSign },
        { label: 'Active Staff', value: '25', trend: '+2', up: true, icon: Users },
        { label: 'Avg. Rating', value: '4.8', trend: '+0.2', up: true, icon: Star },
      ];
  }
};

// Sales overview area chart data (weekly)
const salesData = [
  { day: 'Mon', value: 3200 },
  { day: 'Tue', value: 4800 },
  { day: 'Wed', value: 3900 },
  { day: 'Thu', value: 6100 },
  { day: 'Fri', value: 5200 },
  { day: 'Sat', value: 7800 },
  { day: 'Sun', value: 6400 },
];

// Revenue bar chart (monthly)
const revenueData = [
  { month: 'Jan', value: 18200 },
  { month: 'Feb', value: 22400 },
  { month: 'Mar', value: 19800 },
  { month: 'Apr', value: 26100 },
  { month: 'May', value: 24780 },
  { month: 'Jun', value: 28400 },
];

// Orders by category donut data (adapted for REBMA)
const categoryData = [
  { name: 'Import Orders', value: 38, color: '#7c3aed' },
  { name: 'Local Supply', value: 27, color: '#a78bfa' },
  { name: 'Export', value: 20, color: '#c4b5fd' },
  { name: 'Returns', value: 15, color: '#ede9fe' },
];

// Recent activity items per department
const getRecentItems = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { id: 'ORD-4821', item: 'Cocoa Batch #14 — Port Ingestion', time: '10 min ago', status: 'Delivered', amount: '₵12,400' },
        { id: 'ORD-4820', item: 'Palm Oil Shipment — Tema Port', time: '32 min ago', status: 'Processing', amount: '₵8,750' },
        { id: 'ORD-4819', item: 'Maize Consignment — Accra Hub', time: '1h ago', status: 'Delivered', amount: '₵5,200' },
        { id: 'ORD-4818', item: 'Cashew Export — Container A', time: '2h ago', status: 'Cancelled', amount: '₵3,100' },
        { id: 'ORD-4817', item: 'Shea Butter — Warehouse 2', time: '3h ago', status: 'Delivered', amount: '₵9,600' },
      ];
    case 'MARKETING':
      return [
        { id: 'SAL-301', item: 'Bulk Order — Accra Mart Ltd', time: '5 min ago', status: 'Delivered', amount: '₵6,800' },
        { id: 'SAL-300', item: 'Retail Order — Kumasi Depot', time: '45 min ago', status: 'Processing', amount: '₵2,100' },
        { id: 'SAL-299', item: 'Corporate Deal — Golden Gate', time: '2h ago', status: 'Delivered', amount: '₵14,200' },
        { id: 'SAL-298', item: 'Online Order — WebPortal #88', time: '3h ago', status: 'Cancelled', amount: '₵480' },
        { id: 'SAL-297', item: 'Promo Batch — Suame Cluster', time: '5h ago', status: 'Delivered', amount: '₵3,950' },
      ];
    case 'DISPATCH':
      return [
        { id: 'DSP-201', item: 'Truck L-404 — Tema to Accra', time: '8 min ago', status: 'Delivered', amount: '₵1,200' },
        { id: 'DSP-200', item: 'Truck L-402 — Kumasi Run', time: '1h ago', status: 'Processing', amount: '₵2,400' },
        { id: 'DSP-199', item: 'Van V-08 — Takoradi Delivery', time: '3h ago', status: 'Delivered', amount: '₵960' },
        { id: 'DSP-198', item: 'Truck L-401 — Sunyani Route', time: '5h ago', status: 'Cancelled', amount: '₵1,800' },
        { id: 'DSP-197', item: 'Van V-06 — Cape Coast', time: '6h ago', status: 'Delivered', amount: '₵740' },
      ];
    default:
      return [
        { id: 'ACT-101', item: 'Operation Batch — Zone A', time: '15 min ago', status: 'Delivered', amount: '₵4,200' },
        { id: 'ACT-100', item: 'Stock Update — Warehouse 3', time: '1h ago', status: 'Processing', amount: '₵1,800' },
        { id: 'ACT-099', item: 'Request Approved — Finance', time: '2h ago', status: 'Delivered', amount: '₵9,500' },
        { id: 'ACT-098', item: 'Vendor Clearance — Port B', time: '4h ago', status: 'Cancelled', amount: '₵660' },
        { id: 'ACT-097', item: 'Audit Entry — Compliance Q2', time: '6h ago', status: 'Delivered', amount: '₵2,300' },
      ];
  }
};

// Top items per department
const getTopItems = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
    case 'OPERATIONS':
      return [
        { name: 'Cocoa Beans (Grade A)', count: '312 orders', rating: 4.9 },
        { name: 'Palm Oil (Refined)', count: '248 orders', rating: 4.7 },
        { name: 'Maize (Yellow Dent)', count: '196 orders', rating: 4.8 },
        { name: 'Shea Butter (Raw)', count: '154 orders', rating: 4.6 },
      ];
    case 'MARKETING':
      return [
        { name: 'Cocoa Export Bundle', count: '89 clients', rating: 4.9 },
        { name: 'Bulk Grain Package', count: '74 clients', rating: 4.7 },
        { name: 'Corporate Supply Deal', count: '52 clients', rating: 4.8 },
        { name: 'Palm Oil Retail Pack', count: '48 clients', rating: 4.6 },
      ];
    case 'DISPATCH':
    case 'LOGISTICS':
      return [
        { name: 'Tema–Accra Express Route', count: '142 runs', rating: 4.8 },
        { name: 'Kumasi Depot Run', count: '98 runs', rating: 4.6 },
        { name: 'Cape Coast Delivery', count: '76 runs', rating: 4.7 },
        { name: 'Takoradi Port Route', count: '64 runs', rating: 4.9 },
      ];
    default:
      return [
        { name: 'Cocoa Beans (Grade A)', count: '312 orders', rating: 4.9 },
        { name: 'Palm Oil (Refined)', count: '248 orders', rating: 4.7 },
        { name: 'Maize (Yellow Dent)', count: '196 orders', rating: 4.8 },
        { name: 'Shea Butter (Raw)', count: '154 orders', rating: 4.6 },
      ];
  }
};

const statusColor: Record<string, string> = {
  Delivered: 'bg-emerald-100 text-emerald-700',
  Processing: 'bg-amber-100 text-amber-700',
  Cancelled: 'bg-rose-100 text-rose-700',
};

// Render star rating
const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5 text-amber-400 text-[10px]">
    {[1,2,3,4,5].map(i => (
      <span key={i} className={i <= Math.round(rating) ? 'opacity-100' : 'opacity-25'}>★</span>
    ))}
    <span className="text-[10px] text-[var(--text-muted)] ml-1 font-medium">{rating}</span>
  </span>
);

// Icon avatar with solid purple circle (Foodie style)
const FoodieIcon = ({ Icon }: { Icon: React.ElementType }) => (
  <div className="w-11 h-11 rounded-full bg-[#7c3aed] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.35)]">
    <Icon className="w-5 h-5 text-white" />
  </div>
);

// Mini line sparkline for KPI cards
const Sparkline = ({ up }: { up: boolean }) => {
  const points = up
    ? [[0,20],[10,16],[20,18],[30,10],[40,14],[50,6],[60,10],[70,4]]
    : [[0,4],[10,8],[20,6],[30,14],[40,10],[50,18],[60,12],[70,20]];
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return (
    <svg width="72" height="24" viewBox="0 0 72 24" fill="none">
      <path d={d} stroke={up ? '#7c3aed' : '#f43f5e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function FoodieShell({ activeDepartment, currentUser, children }: FoodieShellProps) {
  const kpis = useMemo(() => getDeptKpis(activeDepartment), [activeDepartment]);
  const recentItems = useMemo(() => getRecentItems(activeDepartment), [activeDepartment]);
  const topItems = useMemo(() => getTopItems(activeDepartment), [activeDepartment]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const deptLabel: Record<string, string> = {
    CEO: 'operations', MANAGEMENT: 'cargo approvals', MARKETING: 'sales pipeline',
    HR: 'workforce', OPERATIONS: 'warehouse floor', FINANCE: 'ledgers',
    PRODUCTION: 'production line', RECEPTION: 'visitor desk', DISPATCH: 'fleet',
    LOGISTICS: 'logistics network', BOARDROOM: 'boardroom', SETTINGS: 'settings',
  };

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';

  if (isBoardroomOrSettings) {
    return <>{children}</>;
  }

  return (
    <div className="foodie-shell pb-8">
      {/* ── GREETING ROW ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">
            {greeting}, {currentUser?.fullName?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Here's what's happening with your {deptLabel[activeDepartment] || 'department'} today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] font-medium shadow-[var(--shadow-card)]">
            <Calendar className="w-3.5 h-3.5 text-[#7c3aed]" />
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className="foodie-kpi-card">
              <div className="flex items-start justify-between mb-3">
                <FoodieIcon Icon={Icon} />
                <MoreVertical className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-[var(--text-muted)] font-medium mb-1">{kpi.label}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-none mb-2">{kpi.value}</h3>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${kpi.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {kpi.trend}
                </span>
                <Sparkline up={kpi.up} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CHARTS ROW ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Sales Overview — area chart */}
        <div className="lg:col-span-2 foodie-chart-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Sales Overview</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Weekly transaction volume</p>
            </div>
            <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-lg px-2 py-1 outline-none cursor-pointer">
              <option>This Week</option>
              <option>Last Week</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="foodieGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#foodieGrad)" dot={false} activeDot={{ r: 5, fill: '#7c3aed' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Category — donut */}
        <div className="foodie-chart-card">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Orders by Category</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Distribution this month</p>
          </div>
          <div className="h-36 sm:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {categoryData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-[var(--text-secondary)]">{d.name}</span>
                </div>
                <span className="font-semibold text-[var(--text-primary)]">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROMO / ALERT CARD ──────────────────────────── */}
      <div className="foodie-promo-card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2">Port Alert</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
              Tema Port Clearance<br className="hidden sm:block" /> — Priority Queue Open
            </h3>
            <p className="text-white/75 text-xs mt-1 max-w-xs">Expedited clearance available for REBMA IMPEX cargo until end of day. 50% reduced handling fees apply.</p>
          </div>
          <button className="shrink-0 bg-white text-[#7c3aed] text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors shadow-lg cursor-pointer flex items-center gap-1.5">
            Learn More <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── RECENT ORDERS + TOP ITEMS ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 foodie-chart-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Orders</h3>
            <button className="text-[10px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">See All</button>
          </div>
          <div className="space-y-3">
            {recentItems.map((item, i) => (
              <div key={i} className="foodie-order-row">
                {/* Icon placeholder */}
                <div className="w-9 h-9 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-[#7c3aed]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{item.item}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{item.id} · {item.time}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{item.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Items */}
        <div className="foodie-chart-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Top Items</h3>
            <button className="text-[10px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">View All</button>
          </div>
          <div className="space-y-3">
            {topItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0 text-sm font-bold text-[#7c3aed]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                  <Stars rating={item.rating} />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] shrink-0">{item.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── REVENUE OVERVIEW ────────────────────────────── */}
      <div className="foodie-chart-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wide">Revenue Overview</p>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">₵248,780</h2>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" /> +23.1%
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">vs. same period last year</p>
          </div>
          <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-lg px-2 py-1 outline-none cursor-pointer self-start">
            <option>Last 6 Months</option>
            <option>This Year</option>
            <option>Last Year</option>
          </select>
        </div>
        <div className="h-44 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(v) => [`₵${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
