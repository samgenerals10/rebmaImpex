// rebma-web/src/components/FinovaShell.tsx
// Full Finova template layout — wraps all departments when theme-finova is active

import { useMemo } from 'react';
import {
  Eye, ArrowRight, TrendingUp, TrendingDown,
  Send, Download, CreditCard, Smartphone,
  ShoppingCart, Coffee, Zap, MoreHorizontal,
  Package, Truck, Users, DollarSign, BarChart3,
  Activity, Clipboard, ShieldCheck, Star, Lock
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import type { CurrentUser } from '../types/erp';

interface FinovaShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

/* ─────────────────────────────────────────────
   Per-department financial summary data
   Tailored to REBMA IMPEX import/export ops
   ───────────────────────────────────────────── */
const getDeptSummary = (dept: string) => {
  switch (dept) {
    case 'CEO':
      return {
        totalBalance: '₵1,248,580',
        availableBalance: '₵980,750',
        savingsLabel: 'Port Revenue',
        savingsValue: '₵624,500',
        savingsAcct: '•••• 4521',
        checkingLabel: 'Operational Cash',
        checkingValue: '₵312,800',
        checkingAcct: '•••• 8834',
        totalSpend: '₵86,240',
        spendTrend: '-4.2%',
        spendUp: true,
      };
    case 'MANAGEMENT':
      return {
        totalBalance: '₵520,140',
        availableBalance: '₵418,750',
        savingsLabel: 'Cargo Approvals',
        savingsValue: '₵284,300',
        savingsAcct: '•••• 2210',
        checkingLabel: 'Credit Pool',
        checkingValue: '₵98,640',
        checkingAcct: '•••• 7743',
        totalSpend: '₵42,800',
        spendTrend: '-2.1%',
        spendUp: true,
      };
    case 'MARKETING':
      return {
        totalBalance: '₵84,620',
        availableBalance: '₵72,100',
        savingsLabel: 'Sales Revenue',
        savingsValue: '₵56,400',
        savingsAcct: '•••• 3341',
        checkingLabel: 'Campaign Budget',
        checkingValue: '₵18,200',
        checkingAcct: '•••• 9921',
        totalSpend: '₵12,400',
        spendTrend: '+8.3%',
        spendUp: false,
      };
    case 'FINANCE':
      return {
        totalBalance: '₵312,800',
        availableBalance: '₵298,450',
        savingsLabel: 'Invoice Ledger',
        savingsValue: '₵198,600',
        savingsAcct: '•••• 5512',
        checkingLabel: 'Payables',
        checkingValue: '₵84,200',
        checkingAcct: '•••• 6630',
        totalSpend: '₵58,400',
        spendTrend: '-6.2%',
        spendUp: true,
      };
    case 'HR':
      return {
        totalBalance: '₵148,200',
        availableBalance: '₵126,800',
        savingsLabel: 'Payroll Reserve',
        savingsValue: '₵98,400',
        savingsAcct: '•••• 1124',
        checkingLabel: 'Benefits Fund',
        checkingValue: '₵28,400',
        checkingAcct: '•••• 4480',
        totalSpend: '₵18,600',
        spendTrend: '+1.4%',
        spendUp: false,
      };
    case 'OPERATIONS':
      return {
        totalBalance: '₵520,100',
        availableBalance: '₵484,200',
        savingsLabel: 'Stock Value',
        savingsValue: '₵384,400',
        savingsAcct: '•••• 3318',
        checkingLabel: 'Ops Budget',
        checkingValue: '₵136,600',
        checkingAcct: '•••• 7744',
        totalSpend: '₵34,200',
        spendTrend: '-3.8%',
        spendUp: true,
      };
    case 'DISPATCH':
      return {
        totalBalance: '₵64,800',
        availableBalance: '₵52,400',
        savingsLabel: 'Fuel Reserve',
        savingsValue: '₵28,400',
        savingsAcct: '•••• 8821',
        checkingLabel: 'Maintenance',
        checkingValue: '₵12,600',
        checkingAcct: '•••• 2211',
        totalSpend: '₵8,200',
        spendTrend: '-1.8%',
        spendUp: true,
      };
    case 'LOGISTICS':
      return {
        totalBalance: '₵92,400',
        availableBalance: '₵78,600',
        savingsLabel: 'Fleet Fund',
        savingsValue: '₵58,400',
        savingsAcct: '•••• 5560',
        checkingLabel: 'Route Budget',
        checkingValue: '₵20,200',
        checkingAcct: '•••• 3319',
        totalSpend: '₵14,600',
        spendTrend: '-2.4%',
        spendUp: true,
      };
    case 'PRODUCTION':
      return {
        totalBalance: '₵186,400',
        availableBalance: '₵162,800',
        savingsLabel: 'Material Fund',
        savingsValue: '₵128,200',
        savingsAcct: '•••• 4490',
        checkingLabel: 'Production Cost',
        checkingValue: '₵44,600',
        checkingAcct: '•••• 8821',
        totalSpend: '₵24,400',
        spendTrend: '-0.8%',
        spendUp: true,
      };
    case 'RECEPTION':
      return {
        totalBalance: '₵12,400',
        availableBalance: '₵10,800',
        savingsLabel: 'Petty Cash',
        savingsValue: '₵6,200',
        savingsAcct: '•••• 1120',
        checkingLabel: 'Operations',
        checkingValue: '₵4,200',
        checkingAcct: '•••• 3340',
        totalSpend: '₵1,400',
        spendTrend: '+2.1%',
        spendUp: false,
      };
    default:
      return {
        totalBalance: '₵248,580',
        availableBalance: '₵198,750',
        savingsLabel: 'Revenue Account',
        savingsValue: '₵148,450',
        savingsAcct: '•••• 4567',
        checkingLabel: 'Operations',
        checkingValue: '₵62,800',
        checkingAcct: '•••• 8834',
        totalSpend: '₵28,400',
        spendTrend: '-3.5%',
        spendUp: true,
      };
  }
};

// Transaction overview line chart data (monthly)
const txData = [
  { date: '01 May', amount: 3200 },
  { date: '08 May', amount: 5800 },
  { date: '15 May', amount: 4200 },
  { date: '22 May', amount: 7400 },
  { date: '29 May', amount: 6800 },
];

// Spending breakdown donut data — adapted to REBMA
const getSpendBreakdown = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { name: 'Port Operations', value: 35, color: '#3b82f6' },
        { name: 'Procurement', value: 25, color: '#22c55e' },
        { name: 'Logistics', value: 20, color: '#f59e0b' },
        { name: 'Admin & Legal', value: 12, color: '#8b5cf6' },
        { name: 'Others', value: 8, color: '#94a3b8' },
      ];
    case 'MARKETING':
      return [
        { name: 'Campaigns', value: 40, color: '#3b82f6' },
        { name: 'Customer Orders', value: 28, color: '#22c55e' },
        { name: 'Events', value: 18, color: '#f59e0b' },
        { name: 'Digital Ads', value: 10, color: '#8b5cf6' },
        { name: 'Others', value: 4, color: '#94a3b8' },
      ];
    case 'HR':
      return [
        { name: 'Payroll', value: 55, color: '#3b82f6' },
        { name: 'Benefits', value: 22, color: '#22c55e' },
        { name: 'Training', value: 12, color: '#f59e0b' },
        { name: 'Recruitment', value: 8, color: '#8b5cf6' },
        { name: 'Others', value: 3, color: '#94a3b8' },
      ];
    case 'DISPATCH':
    case 'LOGISTICS':
      return [
        { name: 'Fuel', value: 42, color: '#3b82f6' },
        { name: 'Maintenance', value: 28, color: '#22c55e' },
        { name: 'Tolls & Fees', value: 18, color: '#f59e0b' },
        { name: 'Insurance', value: 8, color: '#8b5cf6' },
        { name: 'Others', value: 4, color: '#94a3b8' },
      ];
    default:
      return [
        { name: 'Operations', value: 35, color: '#3b82f6' },
        { name: 'Procurement', value: 25, color: '#22c55e' },
        { name: 'Staff', value: 15, color: '#f59e0b' },
        { name: 'Utilities', value: 15, color: '#8b5cf6' },
        { name: 'Others', value: 10, color: '#94a3b8' },
      ];
  }
};

// Quick action buttons
const getQuickActions = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { label: 'Send Funds', icon: Send },
        { label: 'Receive', icon: Download },
        { label: 'Pay Vendor', icon: CreditCard },
        { label: 'Reports', icon: BarChart3 },
      ];
    case 'MARKETING':
      return [
        { label: 'New Order', icon: ShoppingCart },
        { label: 'Invoice', icon: CreditCard },
        { label: 'Customer', icon: Users },
        { label: 'Reports', icon: BarChart3 },
      ];
    case 'DISPATCH':
    case 'LOGISTICS':
      return [
        { label: 'Dispatch', icon: Truck },
        { label: 'Fuel Log', icon: Zap },
        { label: 'Route', icon: Activity },
        { label: 'Reports', icon: BarChart3 },
      ];
    case 'HR':
      return [
        { label: 'Payroll', icon: DollarSign },
        { label: 'Attendance', icon: Clipboard },
        { label: 'Staff', icon: Users },
        { label: 'Reports', icon: BarChart3 },
      ];
    default:
      return [
        { label: 'New Entry', icon: Send },
        { label: 'Receive', icon: Download },
        { label: 'Process', icon: CreditCard },
        { label: 'Reports', icon: BarChart3 },
      ];
  }
};

// Recent transactions adapted per dept
const getRecentTx = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { icon: Package, iconBg: '#dbeafe', iconColor: '#3b82f6', name: 'Cocoa Port Clearance', date: 'Jun 10, 2026 • 10:45 AM', amount: '+₵84,200', positive: true },
        { icon: ShoppingCart, iconBg: '#dcfce7', iconColor: '#22c55e', name: 'Palm Oil Procurement', date: 'Jun 10, 2026 • 09:20 AM', amount: '-₵22,600', positive: false },
        { icon: Truck, iconBg: '#fef3c7', iconColor: '#f59e0b', name: 'Logistics Settlement', date: 'Jun 09, 2026 • 04:00 PM', amount: '-₵8,400', positive: false },
        { icon: DollarSign, iconBg: '#f0fdf4', iconColor: '#22c55e', name: 'Client Payment — Accra Mart', date: 'Jun 09, 2026 • 02:30 PM', amount: '+₵46,800', positive: true },
      ];
    case 'MARKETING':
      return [
        { icon: ShoppingCart, iconBg: '#dbeafe', iconColor: '#3b82f6', name: 'Bulk Order — Accra Mart', date: 'Jun 10, 2026 • 11:00 AM', amount: '+₵12,400', positive: true },
        { icon: Coffee, iconBg: '#fef3c7', iconColor: '#f59e0b', name: 'Client Meeting Expense', date: 'Jun 10, 2026 • 09:30 AM', amount: '-₵840', positive: false },
        { icon: Zap, iconBg: '#f0fdf4', iconColor: '#22c55e', name: 'Online Sale — WebPortal', date: 'Jun 09, 2026 • 03:15 PM', amount: '+₵4,200', positive: true },
        { icon: CreditCard, iconBg: '#ede9fe', iconColor: '#8b5cf6', name: 'Campaign Ad Spend', date: 'Jun 09, 2026 • 01:00 PM', amount: '-₵2,100', positive: false },
      ];
    case 'FINANCE':
      return [
        { icon: DollarSign, iconBg: '#dcfce7', iconColor: '#22c55e', name: 'Invoice #INV-2841 Cleared', date: 'Jun 10, 2026 • 10:00 AM', amount: '+₵38,400', positive: true },
        { icon: CreditCard, iconBg: '#fef3c7', iconColor: '#f59e0b', name: 'Vendor Payment — TradeCo', date: 'Jun 10, 2026 • 09:00 AM', amount: '-₵14,200', positive: false },
        { icon: Download, iconBg: '#dbeafe', iconColor: '#3b82f6', name: 'Bank Transfer Received', date: 'Jun 09, 2026 • 04:45 PM', amount: '+₵62,000', positive: true },
        { icon: ShieldCheck, iconBg: '#ede9fe', iconColor: '#8b5cf6', name: 'Compliance Fee Q2', date: 'Jun 09, 2026 • 02:00 PM', amount: '-₵3,200', positive: false },
      ];
    default:
      return [
        { icon: Package, iconBg: '#dbeafe', iconColor: '#3b82f6', name: 'Operation Batch — Zone A', date: 'Jun 10, 2026 • 10:00 AM', amount: '+₵18,400', positive: true },
        { icon: ShoppingCart, iconBg: '#dcfce7', iconColor: '#22c55e', name: 'Stock Procurement', date: 'Jun 10, 2026 • 09:00 AM', amount: '-₵6,200', positive: false },
        { icon: DollarSign, iconBg: '#fef3c7', iconColor: '#f59e0b', name: 'Revenue Credit', date: 'Jun 09, 2026 • 03:00 PM', amount: '+₵42,600', positive: true },
        { icon: Zap, iconBg: '#ede9fe', iconColor: '#8b5cf6', name: 'Utility & Services', date: 'Jun 09, 2026 • 01:30 PM', amount: '-₵1,840', positive: false },
      ];
  }
};

// Bar chart data for dept overview
const barData = [
  { month: 'Jan', income: 48000, expense: 32000 },
  { month: 'Feb', income: 62000, expense: 40000 },
  { month: 'Mar', income: 54000, expense: 36000 },
  { month: 'Apr', income: 78000, expense: 44000 },
  { month: 'May', income: 86000, expense: 42000 },
  { month: 'Jun', income: 72000, expense: 38000 },
];

const CustomDot = (props: any) => {
  const { cx, cy, value } = props;
  if (!value) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />;
};

export default function FinovaShell({ activeDepartment, currentUser, children }: FinovaShellProps) {
  const summary = useMemo(() => getDeptSummary(activeDepartment), [activeDepartment]);
  const spendBreakdown = useMemo(() => getSpendBreakdown(activeDepartment), [activeDepartment]);
  const quickActions = useMemo(() => getQuickActions(activeDepartment), [activeDepartment]);
  const recentTx = useMemo(() => getRecentTx(activeDepartment), [activeDepartment]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';
  if (isBoardroomOrSettings) return <>{children}</>;

  const deptSubtitle: Record<string, string> = {
    CEO: 'Here\'s what\'s happening with your operations today.',
    MANAGEMENT: 'Here\'s your cargo and approvals overview.',
    MARKETING: 'Here\'s what\'s happening with your sales today.',
    HR: 'Here\'s your workforce and payroll overview.',
    OPERATIONS: 'Here\'s your warehouse and stock overview.',
    FINANCE: 'Here\'s what\'s happening with your finances today.',
    PRODUCTION: 'Here\'s your production line overview.',
    RECEPTION: 'Here\'s today\'s visitor and desk overview.',
    DISPATCH: 'Here\'s your fleet and dispatch overview.',
    LOGISTICS: 'Here\'s your logistics and supply chain overview.',
  };

  return (
    <div className="finova-shell pb-10">

      {/* ── GREETING ─────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">
          {greeting}, {currentUser?.fullName?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          {deptSubtitle[activeDepartment] || 'Here\'s your department overview.'}
        </p>
      </div>

      {/* ── ROW 1: Balance + Accounts + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Total Balance Card — blue/purple gradient */}
        <div className="finova-balance-card relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">Total Balance</p>
                <Eye className="w-3.5 h-3.5 text-white/60 cursor-pointer" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{summary.totalBalance}</h2>
              <p className="text-[11px] text-white/70 mt-2">
                Available Balance <span className="font-bold text-white/90">{summary.availableBalance}</span>
              </p>
            </div>
            <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer shrink-0">
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
          {/* Card chip illustration */}
          <div className="absolute bottom-4 right-4 opacity-20">
            <div className="w-20 h-14 rounded-lg border-2 border-white relative">
              <div className="absolute top-2 left-2 w-5 h-4 rounded-sm border border-white/60 bg-white/20" />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/8 pointer-events-none" />
          <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* Savings + Checking account cards */}
        <div className="flex flex-col gap-3">
          <div className="finova-account-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[rgba(59,130,246,0.12)] flex items-center justify-center shrink-0">
              <CreditCard className="w-4.5 h-4.5 text-[#3b82f6]" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] font-medium">{summary.savingsLabel}</p>
              <p className="text-base font-bold text-[var(--text-primary)]">{summary.savingsValue}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">{summary.savingsAcct}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
          <div className="finova-account-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[rgba(34,197,94,0.12)] flex items-center justify-center shrink-0">
              <DollarSign className="w-4.5 h-4.5 text-[#22c55e]" style={{ width: 18, height: 18 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] font-medium">{summary.checkingLabel}</p>
              <p className="text-base font-bold text-[var(--text-primary)]">{summary.checkingValue}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">{summary.checkingAcct}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="finova-card rounded-2xl p-5">
          <p className="text-xs font-bold text-[var(--text-primary)] mb-4">Quick Actions</p>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-11 h-11 rounded-full bg-[var(--bg-page)] group-hover:bg-[rgba(59,130,246,0.1)] flex items-center justify-center transition-colors border border-[var(--border)]">
                    <Icon className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[#3b82f6] transition-colors" />
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] font-medium text-center leading-tight">{action.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Transaction Overview + Spending Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Transaction Overview chart */}
        <div className="lg:col-span-2 finova-card rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[var(--text-primary)]">Transaction Overview</p>
                <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-muted)] rounded-lg px-2 py-0.5 outline-none cursor-pointer">
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>This Quarter</option>
                </select>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-extrabold text-[var(--text-primary)]">{summary.totalSpend}</h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Total Spend <span className={`font-bold ml-1 ${summary.spendUp ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {summary.spendTrend}
                  </span>
                  <span className="ml-1">vs last month</span>
                </p>
              </div>
            </div>
          </div>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={txData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="finovaLineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11 }}
                  formatter={(v) => [`₵${Number(v).toLocaleString()}`, 'Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={0} fill="url(#finovaLineGrad)" />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5} dot={<CustomDot />} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending Breakdown donut */}
        <div className="finova-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">Spending Breakdown</p>
            <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-muted)] rounded-lg px-2 py-0.5 outline-none cursor-pointer">
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>
          <div className="h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spendBreakdown}
                  cx="50%" cy="50%"
                  innerRadius={46} outerRadius={64}
                  paddingAngle={3} dataKey="value"
                  strokeWidth={0}
                >
                  {spendBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v}%`, '']} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-lg font-extrabold text-[var(--text-primary)]">{summary.totalSpend}</p>
              <p className="text-[9px] text-[var(--text-muted)]">Total Spend</p>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {spendBreakdown.map((d, i) => (
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

      {/* ── ROW 3: Recent Transactions + Card + Promo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Recent Transactions */}
        <div className="lg:col-span-2 finova-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Recent Transactions</p>
            <button className="text-[10px] text-[#3b82f6] font-semibold hover:underline cursor-pointer">View All</button>
          </div>
          <div className="space-y-3">
            {recentTx.map((tx, i) => {
              const Icon = tx.icon;
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: tx.iconBg }}>
                    <Icon style={{ width: 16, height: 16, color: tx.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{tx.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{tx.date}</p>
                  </div>
                  <span className={`text-[11px] font-bold shrink-0 ${tx.positive ? 'text-emerald-600' : 'text-[var(--text-primary)]'}`}>
                    {tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card visual + actions */}
        <div className="flex flex-col gap-4">
          {/* Virtual card */}
          <div className="finova-virtual-card rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider">REBMA IMPEX Card</p>
              {/* VISA-style text */}
              <span className="text-base font-extrabold text-white italic tracking-wider opacity-80">VISA</span>
            </div>
            <div>
              <p className="text-[11px] font-mono text-white/60 mb-1">•••• •••• •••• 4567</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-white/50">Available Limit</p>
                  <p className="text-sm font-bold text-white">₵48,320 / ₵80,000</p>
                </div>
                <MoreHorizontal className="w-4 h-4 text-white/60" />
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/8 pointer-events-none" />
          </div>
          {/* Card actions */}
          <div className="finova-card rounded-xl p-3 grid grid-cols-4 gap-1">
            {[
              { label: 'Lock Card', icon: Lock },
              { label: 'Card Details', icon: CreditCard },
              { label: 'Statements', icon: Clipboard },
              { label: 'More', icon: MoreHorizontal },
            ].map((action, i) => {
              const Icon = action.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-page)] group-hover:bg-[rgba(59,130,246,0.1)] flex items-center justify-center transition-colors">
                    <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[#3b82f6] transition-colors" />
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)] font-medium text-center leading-tight">{action.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ROW 4: Income vs Expense bar + Promo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Income vs Expense chart */}
        <div className="lg:col-span-2 finova-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Financial Overview</p>
              <p className="text-[11px] text-[var(--text-muted)]">Income vs Expenses — Last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block" />Income</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fca5a5] inline-block" />Expenses</span>
            </div>
          </div>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11 }}
                  formatter={(v) => [`₵${Number(v).toLocaleString()}`, '']}
                />
                <Bar dataKey="income" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" fill="#fca5a5" radius={[5, 5, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan your dream promo card */}
        <div className="finova-promo-card rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Star className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <h3 className="text-base font-extrabold text-white leading-snug mb-2">Plan your<br />growth strategy</h3>
            <p className="text-[11px] text-white/70 mb-4">We're here to help you achieve your business goals with smart insights.</p>
            <button className="bg-white text-[#2563eb] text-[11px] font-bold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors cursor-pointer">
              Explore Analytics
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
