// rebma-web/src/components/AczoneShell.tsx
// Full AC Zone template layout — wraps all departments when theme-aczone is active

import { useMemo } from 'react';
import {
  DollarSign, ShoppingBag, Users, BarChart3,
  TrendingUp, TrendingDown, MoreVertical, Package,
  Truck, ClipboardList, Star, AlertTriangle,
  CalendarCheck, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import type { CurrentUser } from '../types/erp';

interface AczoneShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

/* ── KPI data per department ── */
const getDeptKpis = (dept: string) => {
  switch (dept) {
    case 'CEO':
      return [
        { label: 'Total Revenue',    value: '₵1,248,580', trend: '+18.6%', up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [3,5,4,7,6,9,8] },
        { label: 'Total Orders',     value: '1,284',       trend: '+12.4%', up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: ShoppingBag, data: [2,4,3,6,5,7,6] },
        { label: 'Active Customers', value: '214',         trend: '+9.3%',  up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users,       data: [1,3,2,5,4,6,5] },
        { label: 'Avg. Order Value', value: '₵972',        trend: '-4.2%',  up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3,   data: [8,6,7,5,6,4,5] },
      ];
    case 'MANAGEMENT':
      return [
        { label: 'Cargo Revenue',   value: '₵520,140', trend: '+14.2%', up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [3,5,4,7,6,9,8] },
        { label: 'Approvals',       value: '34',        trend: '+8.1%',  up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: ShoppingBag, data: [2,4,3,6,5,7,6] },
        { label: 'Active Vendors',  value: '18',        trend: '+5.6%',  up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users,       data: [1,3,2,5,4,6,5] },
        { label: 'Avg. Lead Time',  value: '1.4 days',  trend: '-12.5%', up: true,  iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3,   data: [8,6,7,5,4,4,3] },
      ];
    case 'MARKETING':
      return [
        { label: 'Sales Revenue',   value: '₵84,620',  trend: '+22.4%', up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [3,5,4,7,6,9,8] },
        { label: 'Total Orders',    value: '312',       trend: '+18.6%', up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: ShoppingBag, data: [2,4,3,6,5,7,6] },
        { label: 'Customers',       value: '156',       trend: '+9.8%',  up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users,       data: [1,3,2,5,4,6,5] },
        { label: 'Avg. Order Value',value: '₵271',      trend: '-2.1%',  up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3,   data: [8,6,7,5,6,4,5] },
      ];
    case 'HR':
      return [
        { label: 'Payroll Total',   value: '₵148,200', trend: '+4.2%',  up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [4,5,5,6,6,7,7] },
        { label: 'Total Staff',     value: '25',        trend: '+2',     up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: Users,       data: [2,3,3,4,4,5,5] },
        { label: 'Attendance Rate', value: '94%',       trend: '+1.2%',  up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3,   data: [6,7,6,7,8,8,9] },
        { label: 'Open Positions',  value: '3',         trend: '+1',     up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: ClipboardList, data: [2,2,3,3,3,4,3] },
      ];
    case 'OPERATIONS':
      return [
        { label: 'Stock Value',     value: '₵520,100', trend: '+6.4%',  up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [5,6,5,7,6,8,7] },
        { label: 'Ingestions',      value: '1,020T',   trend: '+9.1%',  up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: Package,     data: [3,4,3,6,5,7,6] },
        { label: 'Warehouses',      value: '3',         trend: '0%',     up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3,   data: [3,3,3,3,3,3,3] },
        { label: 'Defect Rate',     value: '0.8%',      trend: '-0.3%',  up: true,  iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [5,4,4,3,3,3,2] },
      ];
    case 'FINANCE':
      return [
        { label: 'Total Revenue',   value: '₵312,800', trend: '+6.2%',  up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [4,5,5,6,7,8,8] },
        { label: 'Invoices',        value: '48',        trend: '+12',    up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: ClipboardList, data: [3,4,4,5,5,6,6] },
        { label: 'Customers',       value: '38',        trend: '+4',     up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users,       data: [2,3,3,4,4,5,5] },
        { label: 'Avg. Invoice',    value: '₵6,516',    trend: '-5.1%',  up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3,   data: [8,7,7,6,6,5,6] },
      ];
    case 'DISPATCH':
      return [
        { label: 'Deliveries',      value: '8',         trend: '+2',     up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: Truck,       data: [3,4,3,5,4,6,5] },
        { label: 'Revenue',         value: '₵64,800',  trend: '+8.4%',  up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: DollarSign,  data: [2,3,3,5,4,6,5] },
        { label: 'On-Time Rate',    value: '91%',       trend: '+3%',    up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3,   data: [6,7,7,8,8,9,9] },
        { label: 'Avg. Distance',   value: '42 km',     trend: '-5km',   up: true,  iconBg: '#fce7f3', iconColor: '#ec4899', Icon: Star,        data: [7,6,6,5,5,5,4] },
      ];
    case 'LOGISTICS':
      return [
        { label: 'Fleet Revenue',   value: '₵92,400',  trend: '+11.2%', up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [4,5,4,6,5,7,6] },
        { label: 'Active Trucks',   value: '6',         trend: '0',      up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: Truck,       data: [3,3,3,3,3,3,3] },
        { label: 'Route Efficiency','value': '88%',     trend: '+2%',    up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3,   data: [6,7,7,8,8,8,9] },
        { label: 'Fuel Cost',       value: '₵4,200',   trend: '-₵300',  up: true,  iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [6,5,5,4,4,4,3] },
      ];
    case 'PRODUCTION':
      return [
        { label: 'Batch Revenue',   value: '₵186,400', trend: '+7.8%',  up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [4,5,5,6,6,7,7] },
        { label: 'Batches',         value: '14',        trend: '+3',     up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: Package,     data: [3,4,3,5,4,5,5] },
        { label: 'Completion Rate', value: '96%',       trend: '+2%',    up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3,   data: [7,7,8,8,9,9,9] },
        { label: 'Material Waste',  value: '3.1%',      trend: '-0.4%',  up: true,  iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [5,5,4,4,3,3,3] },
      ];
    case 'RECEPTION':
      return [
        { label: 'Visitors Today',  value: '14',        trend: '+4',     up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: Users,       data: [2,4,3,5,4,6,5] },
        { label: 'Check-ins',       value: '11',        trend: '+2',     up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: ClipboardList, data: [2,3,3,4,4,5,4] },
        { label: 'Avg. Visit',      value: '28 min',    trend: '-4min',  up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3,   data: [7,6,6,5,5,4,4] },
        { label: 'Pending Badges',  value: '3',         trend: '+1',     up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [1,2,2,3,3,3,3] },
      ];
    default:
      return [
        { label: 'Total Revenue',    value: '₵248,580', trend: '+18.6%', up: true,  iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign,  data: [3,5,4,7,6,9,8] },
        { label: 'Total Orders',     value: '1,284',     trend: '+12.4%', up: true,  iconBg: '#ffedd5', iconColor: '#f97316', Icon: ShoppingBag, data: [2,4,3,6,5,7,6] },
        { label: 'Active Customers', value: '214',       trend: '+9.3%',  up: true,  iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users,       data: [1,3,2,5,4,6,5] },
        { label: 'Avg. Order Value', value: '₵972',      trend: '-4.2%',  up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3,   data: [8,6,7,5,6,4,5] },
      ];
  }
};

/* ── Sales overview chart data ── */
const salesChartData = [
  { day: 'Mon', value: 3200 },
  { day: 'Tue', value: 4800 },
  { day: 'Wed', value: 5600 },
  { day: 'Thu', value: 8200 },
  { day: 'Fri', value: 7400 },
  { day: 'Sat', value: 9100 },
  { day: 'Sun', value: 8600 },
];

/* ── Recent orders per department ── */
const getRecentOrders = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { name: 'Cocoa Batch #14',      id: '#ORD-4821', status: 'Completed',  time: '12:45 PM', amount: '₵12,400' },
        { name: 'Palm Oil Shipment',    id: '#ORD-4820', status: 'Processing', time: '12:30 PM', amount: '₵8,750'  },
        { name: 'Maize Consignment',    id: '#ORD-4819', status: 'On the Way', time: '12:15 PM', amount: '₵5,200'  },
        { name: 'Cashew Export',        id: '#ORD-4818', status: 'Completed',  time: '12:05 PM', amount: '₵3,100'  },
        { name: 'Shea Butter Batch',    id: '#ORD-4817', status: 'Cancelled',  time: '11:50 AM', amount: '₵9,600'  },
      ];
    case 'MARKETING':
      return [
        { name: 'Bulk Order — Accra Mart', id: '#SAL-301', status: 'Completed',  time: '12:45 PM', amount: '₵6,800' },
        { name: 'Retail — Kumasi Depot',   id: '#SAL-300', status: 'Processing', time: '12:30 PM', amount: '₵2,100' },
        { name: 'Corporate — Golden Gate', id: '#SAL-299', status: 'On the Way', time: '12:15 PM', amount: '₵14,200'},
        { name: 'Online — WebPortal #88',  id: '#SAL-298', status: 'Cancelled',  time: '12:05 PM', amount: '₵480'   },
        { name: 'Promo — Suame Cluster',   id: '#SAL-297', status: 'Completed',  time: '11:50 AM', amount: '₵3,950' },
      ];
    case 'DISPATCH':
    case 'LOGISTICS':
      return [
        { name: 'Tema–Accra Express',   id: '#DSP-201', status: 'Completed',  time: '12:45 PM', amount: '₵1,200' },
        { name: 'Kumasi Depot Run',     id: '#DSP-200', status: 'Processing', time: '12:30 PM', amount: '₵2,400' },
        { name: 'Takoradi Delivery',    id: '#DSP-199', status: 'On the Way', time: '12:15 PM', amount: '₵960'   },
        { name: 'Sunyani Route',        id: '#DSP-198', status: 'Cancelled',  time: '12:05 PM', amount: '₵1,800' },
        { name: 'Cape Coast Express',   id: '#DSP-197', status: 'Completed',  time: '11:50 AM', amount: '₵740'   },
      ];
    default:
      return [
        { name: 'Operation Batch — Zone A', id: '#ACT-101', status: 'Completed',  time: '12:45 PM', amount: '₵4,200' },
        { name: 'Stock Update — WH3',       id: '#ACT-100', status: 'Processing', time: '12:30 PM', amount: '₵1,800' },
        { name: 'Request — Finance Dept',   id: '#ACT-099', status: 'On the Way', time: '12:15 PM', amount: '₵9,500' },
        { name: 'Vendor Clearance — Port B',id: '#ACT-098', status: 'Completed',  time: '12:05 PM', amount: '₵660'   },
        { name: 'Audit Entry — Q2',         id: '#ACT-097', status: 'Cancelled',  time: '11:50 AM', amount: '₵2,300' },
      ];
  }
};

/* ── Top items per department ── */
const getTopItems = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
    case 'OPERATIONS':
      return [
        { num: 1, numColor: '#7c3aed', name: 'Cocoa Beans (Grade A)', count: '312 orders', price: '₵4,800/ton' },
        { num: 2, numColor: '#f97316', name: 'Palm Oil (Refined)',     count: '248 orders', price: '₵2,400/barrel' },
        { num: 3, numColor: '#14b8a6', name: 'Maize (Yellow Dent)',    count: '196 orders', price: '₵1,200/bag' },
      ];
    case 'MARKETING':
      return [
        { num: 1, numColor: '#7c3aed', name: 'Cocoa Export Bundle',    count: '89 clients',  price: '₵9,600' },
        { num: 2, numColor: '#f97316', name: 'Bulk Grain Package',      count: '74 clients',  price: '₵4,800' },
        { num: 3, numColor: '#14b8a6', name: 'Corporate Supply Deal',   count: '52 clients',  price: '₵14,200' },
      ];
    case 'DISPATCH':
    case 'LOGISTICS':
      return [
        { num: 1, numColor: '#7c3aed', name: 'Tema–Accra Express',     count: '142 runs',    price: '₵1,200/run' },
        { num: 2, numColor: '#f97316', name: 'Kumasi Depot Route',      count: '98 runs',     price: '₵2,400/run' },
        { num: 3, numColor: '#14b8a6', name: 'Cape Coast Express',      count: '76 runs',     price: '₵960/run' },
      ];
    default:
      return [
        { num: 1, numColor: '#7c3aed', name: 'Cocoa Beans (Grade A)',  count: '312 orders', price: '₵4,800/ton' },
        { num: 2, numColor: '#f97316', name: 'Palm Oil (Refined)',      count: '248 orders', price: '₵2,400/barrel' },
        { num: 3, numColor: '#14b8a6', name: 'Maize (Yellow Dent)',     count: '196 orders', price: '₵1,200/bag' },
      ];
  }
};

/* ── Status badge styles ── */
const statusStyle: Record<string, string> = {
  'Completed':  'aczone-badge-completed',
  'Processing': 'aczone-badge-processing',
  'On the Way': 'aczone-badge-onway',
  'Cancelled':  'aczone-badge-cancelled',
};

/* ── Tiny sparkline component ── */
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 36, gap = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * gap},${h - ((v - min) / range) * (h - 6) - 3}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Last dot */}
      <circle
        cx={(data.length - 1) * gap}
        cy={h - ((data[data.length - 1] - min) / range) * (h - 6) - 3}
        r="3.5" fill={color}
      />
    </svg>
  );
};

export default function AczoneShell({ activeDepartment, currentUser, children }: AczoneShellProps) {
  const kpis = useMemo(() => getDeptKpis(activeDepartment), [activeDepartment]);
  const recentOrders = useMemo(() => getRecentOrders(activeDepartment), [activeDepartment]);
  const topItems = useMemo(() => getTopItems(activeDepartment), [activeDepartment]);

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';
  if (isBoardroomOrSettings) return <>{children}</>;

  const deptTitle: Record<string, string> = {
    CEO: 'CEO Command', MANAGEMENT: 'Management', MARKETING: 'Marketing',
    HR: 'Human Resources', OPERATIONS: 'Operations', FINANCE: 'Finance',
    PRODUCTION: 'Production', RECEPTION: 'Reception', DISPATCH: 'Dispatch',
    LOGISTICS: 'Logistics',
  };

  const salesSummary: Record<string, { value: string; trend: string }> = {
    CEO:        { value: '₵1,248,580', trend: '+18.6%' },
    MANAGEMENT: { value: '₵520,140',   trend: '+14.2%' },
    MARKETING:  { value: '₵84,620',    trend: '+22.4%' },
    HR:         { value: '₵148,200',   trend: '+4.2%'  },
    OPERATIONS: { value: '₵520,100',   trend: '+6.4%'  },
    FINANCE:    { value: '₵312,800',   trend: '+6.2%'  },
    PRODUCTION: { value: '₵186,400',   trend: '+7.8%'  },
    RECEPTION:  { value: '₵12,400',    trend: '+2.1%'  },
    DISPATCH:   { value: '₵64,800',    trend: '+8.4%'  },
    LOGISTICS:  { value: '₵92,400',    trend: '+11.2%' },
  };
  const sale = salesSummary[activeDepartment] || salesSummary.CEO;

  const reservationsLabel: Record<string, { count: string; label: string; trend: string }> = {
    CEO:        { count: '34',  label: 'Port Batches',     trend: '+12% vs yesterday' },
    MANAGEMENT: { count: '12',  label: 'Pending Approvals',trend: '+3 vs yesterday'   },
    MARKETING:  { count: '28',  label: 'Active Deals',     trend: '+15% vs yesterday' },
    HR:         { count: '6',   label: 'Pending Requests', trend: '+1 vs yesterday'   },
    OPERATIONS: { count: '1,020',label: 'Tons Ingested',   trend: '+9% vs yesterday'  },
    FINANCE:    { count: '48',  label: 'Invoices Today',   trend: '+12 vs yesterday'  },
    PRODUCTION: { count: '14',  label: 'Active Batches',   trend: '+3 vs yesterday'   },
    RECEPTION:  { count: '14',  label: 'Visitors Today',   trend: '+15% vs yesterday' },
    DISPATCH:   { count: '8',   label: 'Deliveries Today', trend: '+2 vs yesterday'   },
    LOGISTICS:  { count: '6',   label: 'Active Routes',    trend: '0 vs yesterday'    },
  };
  const resv = reservationsLabel[activeDepartment] || reservationsLabel.CEO;

  const stockAlerts: Record<string, string> = {
    CEO: '3', MANAGEMENT: '2', OPERATIONS: '5', PRODUCTION: '4',
    FINANCE: '1', MARKETING: '2', HR: '0', RECEPTION: '1',
    DISPATCH: '2', LOGISTICS: '3',
  };
  const stockCount = stockAlerts[activeDepartment] || '3';

  return (
    <div className="aczone-shell pb-10">

      {/* ── GREETING ─────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Welcome back, {currentUser?.fullName?.split(' ')[0] || 'there'}! 👋
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Here's what's happening with your {deptTitle[activeDepartment]?.toLowerCase() || 'department'} today.
        </p>
      </div>

      {/* ── 4 KPI CARDS ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, i) => {
          const Icon = kpi.Icon;
          return (
            <div key={i} className="aczone-kpi-card">
              <div className="flex items-start justify-between">
                {/* Soft circle icon */}
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: kpi.iconBg }}>
                  <Icon className="w-5 h-5" style={{ color: kpi.iconColor }} />
                </div>
                {/* Sparkline right */}
                <Sparkline data={kpi.data} color={kpi.iconColor} />
              </div>
              <div className="mt-3">
                <p className="text-[11px] text-[var(--text-muted)] font-medium">{kpi.label}</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] mt-0.5">{kpi.value}</h3>
                <p className={`flex items-center gap-1 text-[11px] font-semibold mt-1 ${kpi.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {kpi.up
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />}
                  <span>{kpi.trend}</span>
                  <span className="text-[var(--text-muted)] font-normal">vs yesterday</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SALES OVERVIEW + RECENT ORDERS ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Sales Overview — area chart */}
        <div className="lg:col-span-2 aczone-card rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Sales Overview</p>
              <div className="flex items-baseline gap-3 mt-1">
                <h3 className="text-2xl font-extrabold text-[var(--text-primary)]">{sale.value}</h3>
                <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-500">
                  <TrendingUp className="w-3 h-3" /> {sale.trend}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">vs last week</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select className="text-[11px] border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-secondary)] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer font-medium">
                <option>This Week</option>
                <option>Last Week</option>
                <option>This Month</option>
              </select>
              <button className="p-1.5 rounded-lg hover:bg-[var(--bg-page)] transition-colors cursor-pointer">
                <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aczoneAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.20} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
                <XAxis
                  dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const isThursday = payload.value === 'Thu';
                    return (
                      <g transform={`translate(${x},${y})`}>
                        {isThursday && (
                          <rect x={-18} y={2} width={36} height={18} rx={9} fill="#7c3aed" />
                        )}
                        <text x={0} y={14} textAnchor="middle" fill={isThursday ? '#fff' : 'var(--text-muted)'} fontSize={11} fontWeight={isThursday ? 700 : 400}>
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v === 0 ? '0' : `${v/1000}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 11, color: '#fff', padding: '4px 10px' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ display: 'none' }}
                  formatter={(v) => [`₵${Number(v).toLocaleString()}`, '']}
                  cursor={{ stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#aczoneAreaGrad)"
                  dot={{ fill: '#7c3aed', strokeWidth: 2, stroke: '#fff', r: 4 }}
                  activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="aczone-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Recent Orders</p>
            <button className="text-[11px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">View all</button>
          </div>
          <div className="space-y-3">
            {recentOrders.map((order, i) => (
              <div key={i} className="flex items-center gap-3">
                {/* Item icon placeholder */}
                <div className="w-9 h-9 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-[#7c3aed]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{order.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{order.id}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusStyle[order.status] || ''}`}>
                    {order.status}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">{order.time}</span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{order.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TOP ITEMS + RESERVATIONS + LOW STOCK ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Top Items */}
        <div className="lg:col-span-2 aczone-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS' ? 'Top Routes' : 'Top Items'}
            </p>
            <button className="text-[11px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">View all</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topItems.map((item, i) => (
              <div key={i} className="aczone-top-item-card rounded-xl p-4">
                {/* Numbered badge + icon placeholder */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                    style={{ background: item.numColor }}>
                    {item.num}
                  </div>
                </div>
                {/* Icon circle */}
                <div className="w-14 h-14 rounded-xl bg-[#ede9fe] flex items-center justify-center mb-3 mx-auto">
                  <Package className="w-6 h-6 text-[#7c3aed]" />
                </div>
                <p className="text-[11px] font-bold text-[var(--text-primary)] text-center leading-snug mb-1">{item.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] text-center mb-1">{item.count}</p>
                <p className="text-[12px] font-extrabold text-[#7c3aed] text-center">{item.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reservations Today + Low Stock */}
        <div className="flex flex-col gap-4">
          {/* Reservations / Batches today */}
          <div className="aczone-card rounded-2xl p-5 flex-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ede9fe] flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 text-[#7c3aed]" />
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">{resv.label}</p>
                <h3 className="text-3xl font-extrabold text-[var(--text-primary)] leading-none mt-1">{resv.count}</h3>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 mt-1.5">
                  <TrendingUp className="w-3 h-3" /> {resv.trend}
                </p>
              </div>
            </div>
          </div>

          {/* Low Stock / Alerts */}
          <div className="aczone-card rounded-2xl p-5 flex-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fce7f3] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#ec4899]" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-[var(--text-muted)] font-medium">
                  {activeDepartment === 'OPERATIONS' || activeDepartment === 'PRODUCTION' ? 'Low Stock Items' : 'Active Alerts'}
                </p>
                <h3 className="text-3xl font-extrabold text-[var(--text-primary)] leading-none mt-1">
                  {stockCount} <span className="text-base font-semibold text-[var(--text-muted)]">Items</span>
                </h3>
                <button className="mt-2 text-[10px] font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1">
                  View Details <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
