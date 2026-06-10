// rebma-web/src/components/FinloFlashShell.tsx
// Full Finlo Flash template — wraps all departments when theme-finloflash is active

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, MoreHorizontal, Plus, ChevronRight,
  SlidersHorizontal, Ship, ShieldCheck, Truck, Package, DollarSign,
  Info, CircleCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { CurrentUser } from '../types/erp';

interface FinloFlashShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

// ─── Chart data ───────────────────────────────────────────────────────────────

const earningData = [
  { month: 'Jan', value: 38400 },
  { month: 'Feb', value: 29200 },
  { month: 'Mar', value: 45100 },
  { month: 'Apr', value: 36800 },
  { month: 'May', value: 52400 },
  { month: 'Jun', value: 44600 },
];

const cashFlowData = [
  { month: 'Jan',  income: 8200,  expense: 5400,  savings: 2800  },
  { month: 'Feb',  income: 11400, expense: 7200,  savings: 4200  },
  { month: 'Mar',  income: 9800,  expense: 6100,  savings: 3700  },
  { month: 'Apr',  income: 14200, expense: 8900,  savings: 5300  },
  { month: 'May',  income: 12600, expense: 7800,  savings: 4800  },
  { month: 'Jun',  income: 16800, expense: 10200, savings: 6600  },
  { month: 'Jul',  income: 13400, expense: 8600,  savings: 4800  },
  { month: 'Aug',  income: 28600, expense: 18200, savings: 10400 },
  { month: 'Sep',  income: 15200, expense: 9400,  savings: 5800  },
  { month: 'Oct',  income: 11800, expense: 7200,  savings: 4600  },
  { month: 'Nov',  income: 9600,  expense: 6100,  savings: 3500  },
  { month: 'Dec',  income: 18400, expense: 11200, savings: 7200  },
];

// ─── Per-department data helpers ─────────────────────────────────────────────

const getDeptEarning = (dept: string) => {
  const map: Record<string, { value: string; change: string; up: boolean }> = {
    CEO:        { value: '₵520,140', change: '+8.3%', up: true  },
    MANAGEMENT: { value: '₵284,300', change: '+5.1%', up: true  },
    MARKETING:  { value: '₵148,200', change: '+11.4%', up: true },
    OPERATIONS: { value: '₵312,600', change: '+4.2%', up: true  },
    FINANCE:    { value: '₵248,780', change: '+6.8%', up: true  },
    HR:         { value: '₵98,400',  change: '-1.2%', up: false },
    PRODUCTION: { value: '₵186,500', change: '+7.6%', up: true  },
    RECEPTION:  { value: '₵42,100',  change: '+2.3%', up: true  },
    DISPATCH:   { value: '₵94,800',  change: '+3.4%', up: true  },
    LOGISTICS:  { value: '₵164,200', change: '+5.9%', up: true  },
  };
  return map[dept] ?? map['CEO'];
};

const getDeptSpending = (dept: string) => {
  const map: Record<string, { total: string; change: string; up: boolean; breakdown: { name: string; amount: string; value: number; color: string }[] }> = {
    CEO:        { total: '₵210,500', change: '-3.2%', up: false, breakdown: [
      { name: 'Port Handling',        amount: '₵84,200', value: 50, color: '#f97316' },
      { name: 'Freight & Logistics',  amount: '₵68,100', value: 32, color: '#fdba74' },
      { name: 'Staff & Admin',        amount: '₵58,200', value: 18, color: '#e5e7eb' },
    ]},
    MANAGEMENT: { total: '₵124,800', change: '+1.5%', up: true, breakdown: [
      { name: 'Cargo Clearance',      amount: '₵52,400', value: 52, color: '#f97316' },
      { name: 'Vendor Payments',      amount: '₵42,600', value: 30, color: '#fdba74' },
      { name: 'Overheads',            amount: '₵29,800', value: 18, color: '#e5e7eb' },
    ]},
    FINANCE:    { total: '₵98,400',  change: '-1.8%', up: false, breakdown: [
      { name: 'Invoice Payments',     amount: '₵42,800', value: 56, color: '#f97316' },
      { name: 'Bank Charges',         amount: '₵24,200', value: 28, color: '#fdba74' },
      { name: 'Misc. Fees',           amount: '₵31,400', value: 16, color: '#e5e7eb' },
    ]},
    MARKETING:  { total: '₵64,200',  change: '+2.4%', up: true, breakdown: [
      { name: 'Promotions',           amount: '₵28,400', value: 44, color: '#f97316' },
      { name: 'Customer Acquisition', amount: '₵22,100', value: 34, color: '#fdba74' },
      { name: 'Platform Fees',        amount: '₵13,700', value: 22, color: '#e5e7eb' },
    ]},
    OPERATIONS: { total: '₵142,600', change: '-0.9%', up: false, breakdown: [
      { name: 'Warehouse Costs',      amount: '₵68,200', value: 48, color: '#f97316' },
      { name: 'Equipment',            amount: '₵46,100', value: 32, color: '#fdba74' },
      { name: 'Utilities',            amount: '₵28,300', value: 20, color: '#e5e7eb' },
    ]},
    PRODUCTION: { total: '₵86,400',  change: '+3.1%', up: true, breakdown: [
      { name: 'Raw Materials',        amount: '₵44,800', value: 52, color: '#f97316' },
      { name: 'Labour',               amount: '₵24,600', value: 28, color: '#fdba74' },
      { name: 'Machinery',            amount: '₵17,000', value: 20, color: '#e5e7eb' },
    ]},
  };
  return map[dept] ?? map['CEO'];
};

const getUpcomingBills = (dept: string) => {
  const common = [
    { Icon: Ship,         iconBg: '#dbeafe', iconColor: '#1d4ed8', name: 'GPHA Port Levy',            date: 'Jun 28, 2026', amount: '₵8,400.00'  },
    { Icon: ShieldCheck,  iconBg: '#dcfce7', iconColor: '#16a34a', name: 'Customs Duty — Batch 14',   date: 'Jun 30, 2026', amount: '₵12,500.00' },
    { Icon: Truck,        iconBg: '#fee2e2', iconColor: '#dc2626', name: 'Freight Forwarding Fee',    date: 'Jul 4, 2026',  amount: '₵5,200.00'  },
  ];
  const finance = [
    { Icon: DollarSign,   iconBg: '#fef9c3', iconColor: '#ca8a04', name: 'Bank Facility Charge',      date: 'Jun 28, 2026', amount: '₵3,200.00'  },
    { Icon: ShieldCheck,  iconBg: '#dcfce7', iconColor: '#16a34a', name: 'Tax Filing Fee',             date: 'Jul 1, 2026',  amount: '₵6,800.00'  },
    { Icon: Package,      iconBg: '#ede9fe', iconColor: '#7c3aed', name: 'Audit Service Invoice',      date: 'Jul 15, 2026', amount: '₵11,400.00' },
  ];
  return dept === 'FINANCE' ? finance : common;
};

const getRecentTransactions = (dept: string) => {
  const map: Record<string, { Icon: React.ElementType; iconBg: string; iconColor: string; activity: string; date: string; amount: string; status: 'Success' | 'Pending' | 'Failed'; account: string }[]> = {
    CEO: [
      { Icon: Package,    iconBg: '#dbeafe', iconColor: '#1d4ed8', activity: 'Tema Port Clearance',     date: 'Jun 10.06.2026', amount: '+₵84,200', status: 'Success', account: 'Port Acct. #521'  },
      { Icon: DollarSign, iconBg: '#fee2e2', iconColor: '#dc2626', activity: 'Vendor Payment',           date: 'Jun 10.06.2026', amount: '+₵22,600', status: 'Success', account: 'Ops Acct. #834'  },
      { Icon: Truck,      iconBg: '#dcfce7', iconColor: '#16a34a', activity: 'Fleet Maintenance',        date: 'Jun 09.06.2026', amount: '-₵8,400',  status: 'Success', account: 'Main Acct. #098' },
      { Icon: Ship,       iconBg: '#fef9c3', iconColor: '#ca8a04', activity: 'Export Freight Fee',       date: 'Jun 09.06.2026', amount: '+₵36,200', status: 'Pending', account: 'Port Acct. #521'  },
    ],
    FINANCE: [
      { Icon: DollarSign, iconBg: '#dbeafe', iconColor: '#1d4ed8', activity: 'Invoice #INV-2284 Paid',  date: 'Jun 10.06.2026', amount: '+₵42,600', status: 'Success', account: 'Main Acct. #001'  },
      { Icon: ShieldCheck,iconBg: '#dcfce7', iconColor: '#16a34a', activity: 'Tax Remittance Q2',       date: 'Jun 10.06.2026', amount: '-₵18,200', status: 'Success', account: 'Tax Acct. #202'   },
      { Icon: Package,    iconBg: '#ede9fe', iconColor: '#7c3aed', activity: 'Audit Invoice #A-44',     date: 'Jun 09.06.2026', amount: '-₵11,400', status: 'Success', account: 'Ops Acct. #834'   },
      { Icon: DollarSign, iconBg: '#fee2e2', iconColor: '#dc2626', activity: 'Payroll Disbursement',    date: 'Jun 09.06.2026', amount: '-₵84,800', status: 'Pending', account: 'HR Acct. #550'    },
    ],
    MARKETING: [
      { Icon: Package,    iconBg: '#dbeafe', iconColor: '#1d4ed8', activity: 'Bulk Order — Accra Mart', date: 'Jun 10.06.2026', amount: '+₵28,400', status: 'Success', account: 'Sales Acct. #312' },
      { Icon: DollarSign, iconBg: '#dcfce7', iconColor: '#16a34a', activity: 'Retail Order — Kumasi',  date: 'Jun 10.06.2026', amount: '+₵12,100', status: 'Success', account: 'Sales Acct. #312' },
      { Icon: Ship,       iconBg: '#fef9c3', iconColor: '#ca8a04', activity: 'Corporate Deal — Golden', date: 'Jun 09.06.2026', amount: '+₵44,200', status: 'Pending', account: 'Main Acct. #001' },
      { Icon: Truck,      iconBg: '#fee2e2', iconColor: '#dc2626', activity: 'Promo Batch — Suame',     date: 'Jun 08.06.2026', amount: '+₵8,950',  status: 'Success', account: 'Sales Acct. #312' },
    ],
  };
  return map[dept] ?? map['CEO'];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FFCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`ff-card ${className}`}>{children}</div>
);

const StatusBadge = ({ status }: { status: 'Success' | 'Pending' | 'Failed' }) => {
  const styles = {
    Success: 'text-emerald-600 bg-emerald-50',
    Pending: 'text-amber-600 bg-amber-50',
    Failed:  'text-rose-600 bg-rose-50',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status]}`}>
      {status === 'Success' && <CircleCheck className="w-3 h-3" />}
      {status}
    </span>
  );
};

// Custom bar shape with rounded top corners + highlighted glow for August
const CustomBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const r = 5;
  return (
    <path
      d={`M${x},${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} H${x} Z`}
      fill={fill}
    />
  );
};

// ─── Main Shell ───────────────────────────────────────────────────────────────

export default function FinloFlashShell({ activeDepartment, currentUser, children }: FinloFlashShellProps) {
  const [cashFlowTab, setCashFlowTab] = useState<'income' | 'expense' | 'savings'>('income');

  const earning     = useMemo(() => getDeptEarning(activeDepartment),      [activeDepartment]);
  const spending    = useMemo(() => getDeptSpending(activeDepartment),     [activeDepartment]);
  const bills       = useMemo(() => getUpcomingBills(activeDepartment),    [activeDepartment]);
  const transactions = useMemo(() => getRecentTransactions(activeDepartment), [activeDepartment]);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'there';

  if (activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS') {
    return <>{children}</>;
  }

  const cashKey = cashFlowTab; // 'income' | 'expense' | 'savings'

  const spendingTotal = spending.breakdown.reduce((s, b) => s + b.value, 0);

  return (
    <div className="ff-shell pb-8">

      {/* ── GREETING ─────────────────────────────────────────────────────── */}
      <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-6">
        Welcome back, {firstName}! 👋
      </h1>

      {/* ── ROW 1: Earning Overview + Spending Overview ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

        {/* Earning Overview */}
        <FFCard className="lg:col-span-3">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
              Earning Overview
              <Info className="w-3.5 h-3.5 text-[var(--text-muted)] ml-0.5" />
            </div>
            <button className="flex items-center gap-1 text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
              This Month <ChevronRight className="w-3 h-3 -rotate-90" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{earning.value}</span>
            <span className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${earning.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {earning.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {earning.change}
            </span>
          </div>
          <div className="h-36 sm:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earningData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff', padding: '6px 12px' }}
                  labelStyle={{ color: '#9ca3af', fontWeight: 600 }}
                  formatter={(v: any) => [`₵${Number(v).toLocaleString()}`, '']}
                  labelFormatter={(l) => `${l} 2026`}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FFCard>

        {/* Spending Overview */}
        <FFCard className="lg:col-span-2">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
              Spending Overview
              <Info className="w-3.5 h-3.5 text-[var(--text-muted)] ml-0.5" />
            </div>
            <button className="flex items-center gap-1 text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
              This Month <ChevronRight className="w-3 h-3 -rotate-90" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">{spending.total}</span>
            <span className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${spending.up ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
              {spending.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {spending.change}
            </span>
          </div>

          <p className="text-xs font-semibold text-[var(--text-primary)] mb-3">Spending Breakdown</p>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
            {spending.breakdown.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">{b.name}</span>
                <span className="text-[10px] font-bold text-[var(--text-primary)]">{b.amount}</span>
              </div>
            ))}
          </div>

          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
            {spending.breakdown.map((b, i) => (
              <div
                key={i}
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(b.value / spendingTotal) * 100}%`, background: b.color }}
              />
            ))}
            <div className="flex-1 bg-[#f3f4f6] rounded-full" />
          </div>
        </FFCard>
      </div>

      {/* ── ROW 2+3: Cash Flow + Upcoming Bills (right col spans 2 rows) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

        {/* Cash Flow */}
        <FFCard className="lg:col-span-3">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
              Cash Flow
              <Info className="w-3.5 h-3.5 text-[var(--text-muted)] ml-0.5" />
            </div>
            <button className="flex items-center gap-1 text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
              Yearly <ChevronRight className="w-3 h-3 -rotate-90" />
            </button>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3">₵342,323.44</p>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4">
            {(['income', 'expense', 'savings'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCashFlowTab(t)}
                className={`capitalize text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  cashFlowTab === t
                    ? 'bg-[#111827] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 10, fontSize: 11, color: '#fff', padding: '6px 12px' }}
                  labelStyle={{ color: '#9ca3af', fontWeight: 600 }}
                  formatter={(v: any) => [`₵${Number(v).toLocaleString()}`, '']}
                  labelFormatter={(l) => `${l} 2026`}
                  cursor={false}
                />
                <Bar dataKey={cashKey} shape={<CustomBar />} maxBarSize={28}>
                  {cashFlowData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.month === 'Aug' ? '#f97316' : '#e5e7eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FFCard>

        {/* Upcoming Bill & Payment — spans 2 rows on desktop */}
        <FFCard className="lg:col-span-2 lg:row-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Upcoming Bill &amp; Payment</span>
            <button className="w-7 h-7 rounded-full bg-[var(--bg-input)] hover:bg-[var(--accent-light)] flex items-center justify-center transition-colors cursor-pointer">
              <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="flex-1 space-y-1">
            {bills.map((bill, i) => {
              const Icon = bill.Icon;
              return (
                <div key={i} className="group">
                  <div className="flex items-center gap-3 py-2.5 rounded-xl hover:bg-[var(--bg-input)] px-2 -mx-2 transition-colors cursor-pointer">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: bill.iconBg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: bill.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{bill.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{bill.date}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  </div>
                  <div className="flex items-center justify-between px-2 pb-2.5">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{bill.amount}</span>
                    <span className="text-[10px] font-semibold text-[#f97316] bg-orange-50 px-2 py-0.5 rounded-full">Scheduled</span>
                  </div>
                  {i < bills.length - 1 && <div className="h-px bg-[var(--border)] mx-2" />}
                </div>
              );
            })}
          </div>

          <button className="mt-4 w-full py-2.5 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
            View All
          </button>
        </FFCard>

        {/* Recent Transaction */}
        <FFCard className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Recent Transaction</span>
            <button className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Activity', 'Date', 'Total Amount', 'Status', ''].map((h, i) => (
                    <th key={i} className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide pb-2.5 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const Icon = tx.Icon;
                  return (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover-table-row)] transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: tx.iconBg }}
                          >
                            <Icon className="w-4 h-4" style={{ color: tx.iconColor }} />
                          </div>
                          <span className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">{tx.activity}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{tx.date}</td>
                      <td className="py-3 pr-4 text-[11px] font-bold text-[var(--text-primary)] whitespace-nowrap">{tx.amount}</td>
                      <td className="py-3 pr-4"><StatusBadge status={tx.status} /></td>
                      <td className="py-3">
                        <button className="p-1 rounded-lg hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
                          <MoreHorizontal className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FFCard>

      </div>
    </div>
  );
}
