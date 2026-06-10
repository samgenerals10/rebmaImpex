// rebma-web/src/components/LiamFinanceShell.tsx
// Full Liam Finance template layout — wraps all departments when theme-liamfinance is active

import { useState, useMemo } from 'react';
import {
  Send, ArrowDownToLine, ArrowLeftRight, PlusCircle, Receipt, FileText,
  Plus, ChevronRight, TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import type { CurrentUser } from '../types/erp';

interface LiamFinanceShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

/* ── Action buttons row — adapted per dept ── */
const getDeptActions = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { label: 'Send',          Icon: Send,            primary: true },
        { label: 'Request',       Icon: ArrowDownToLine, primary: false },
        { label: 'Transfer',      Icon: ArrowLeftRight,  primary: false },
        { label: 'Deposit',       Icon: PlusCircle,      primary: false },
        { label: 'Pay Vendor',    Icon: Receipt,         primary: false },
        { label: 'Create Invoice',Icon: FileText,        primary: false },
      ];
    case 'MARKETING':
      return [
        { label: 'New Order',     Icon: Send,            primary: true },
        { label: 'Invoice',       Icon: FileText,        primary: false },
        { label: 'Transfer',      Icon: ArrowLeftRight,  primary: false },
        { label: 'Deposit',       Icon: PlusCircle,      primary: false },
        { label: 'Pay Bill',      Icon: Receipt,         primary: false },
        { label: 'Export',        Icon: ArrowDownToLine, primary: false },
      ];
    case 'FINANCE':
      return [
        { label: 'Send',          Icon: Send,            primary: true },
        { label: 'Receive',       Icon: ArrowDownToLine, primary: false },
        { label: 'Transfer',      Icon: ArrowLeftRight,  primary: false },
        { label: 'Deposit',       Icon: PlusCircle,      primary: false },
        { label: 'Pay Bill',      Icon: Receipt,         primary: false },
        { label: 'Create Invoice',Icon: FileText,        primary: false },
      ];
    default:
      return [
        { label: 'Submit',        Icon: Send,            primary: true },
        { label: 'Request',       Icon: ArrowDownToLine, primary: false },
        { label: 'Transfer',      Icon: ArrowLeftRight,  primary: false },
        { label: 'Add Entry',     Icon: PlusCircle,      primary: false },
        { label: 'Pay Bill',      Icon: Receipt,         primary: false },
        { label: 'Report',        Icon: FileText,        primary: false },
      ];
  }
};

/* ── Stacked card data per dept ── */
const getDeptCards = (dept: string) => {
  switch (dept) {
    case 'CEO':
      return [
        { label: 'Port Revenue',   value: '₵624,500', color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Operations',     value: '₵312,800', color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Export Account', value: '₵248,580', color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'MANAGEMENT':
      return [
        { label: 'Cargo Approvals',value: '₵284,300', color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Credit Pool',    value: '₵98,640',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Reserve Fund',   value: '₵62,400',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'MARKETING':
      return [
        { label: 'Sales Revenue',  value: '₵56,400',  color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Campaign Fund',  value: '₵18,200',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Customer Acct',  value: '₵10,020',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'FINANCE':
      return [
        { label: 'Invoice Ledger', value: '₵198,600', color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Payables',       value: '₵84,200',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Reserve',        value: '₵30,000',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'HR':
      return [
        { label: 'Payroll Reserve',value: '₵98,400',  color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Benefits Fund',  value: '₵28,400',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Training Fund',  value: '₵8,200',   color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'OPERATIONS':
      return [
        { label: 'Stock Value',    value: '₵384,400', color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Ops Budget',     value: '₵136,600', color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Reserve',        value: '₵42,000',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'DISPATCH':
      return [
        { label: 'Fuel Reserve',   value: '₵28,400',  color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Maintenance',    value: '₵12,600',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Fleet Budget',   value: '₵23,800',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'LOGISTICS':
      return [
        { label: 'Fleet Fund',     value: '₵58,400',  color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Route Budget',   value: '₵20,200',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Fuel Reserve',   value: '₵13,800',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'PRODUCTION':
      return [
        { label: 'Material Fund',  value: '₵128,200', color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Production Cost',value: '₵44,600',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Reserve',        value: '₵13,600',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    case 'RECEPTION':
      return [
        { label: 'Petty Cash',     value: '₵6,200',   color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Operations',     value: '₵4,200',   color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Reserve',        value: '₵2,000',   color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
    default:
      return [
        { label: 'Main Account',   value: '₵148,450', color: 'linear-gradient(135deg,#4f6ef7,#6366f1)' },
        { label: 'Operations',     value: '₵62,800',  color: 'linear-gradient(135deg,#f97316,#fb923c)' },
        { label: 'Reserve',        value: '₵37,330',  color: 'linear-gradient(135deg,#a855f7,#ec4899)' },
      ];
  }
};

const getWalletBalance = (dept: string): { value: string; trend: string } => {
  const map: Record<string, { value: string; trend: string }> = {
    CEO:        { value: '₵1,248,580', trend: '+32.8%' },
    MANAGEMENT: { value: '₵520,140',   trend: '+14.2%' },
    MARKETING:  { value: '₵84,620',    trend: '+22.4%' },
    FINANCE:    { value: '₵312,800',   trend: '+6.2%'  },
    HR:         { value: '₵148,200',   trend: '+4.2%'  },
    OPERATIONS: { value: '₵520,100',   trend: '+6.4%'  },
    DISPATCH:   { value: '₵64,800',    trend: '+8.4%'  },
    LOGISTICS:  { value: '₵92,400',    trend: '+11.2%' },
    PRODUCTION: { value: '₵186,400',   trend: '+7.8%'  },
    RECEPTION:  { value: '₵12,400',    trend: '+2.1%'  },
  };
  return map[dept] || { value: '₵248,580', trend: '+12.0%' };
};

/* ── Overview chart data — Current Year vs Last Year ── */
const overviewData = [
  { month: 'Jan', current: 1800, last: 2200 },
  { month: 'Feb', current: 2400, last: 3200 },
  { month: 'Mar', current: 2000, last: 2800 },
  { month: 'Apr', current: 3200, last: 3600 },
  { month: 'May', current: 2800, last: 4200 },
  { month: 'Jun', current: 3600, last: 3800 },
  { month: 'Jul', current: 4200, last: 3400 },
  { month: 'Aug', current: 3800, last: 2800 },
  { month: 'Sep', current: 4600, last: 3000 },
  { month: 'Oct', current: 4200, last: 2600 },
  { month: 'Nov', current: 4800, last: 2400 },
  { month: 'Dec', current: 5000, last: 2200 },
];

/* ── Budget data per dept ── */
const getBudget = (dept: string) => {
  const map: Record<string, { limit: string; spent: string; spentNum: number; totalNum: number; period: string }> = {
    CEO:        { limit: '₵120,000', spent: '₵98,400',  spentNum: 98400,  totalNum: 120000, period: 'Jun 1 – Jun 30, 2026' },
    MANAGEMENT: { limit: '₵60,000',  spent: '₵48,200',  spentNum: 48200,  totalNum: 60000,  period: 'Jun 1 – Jun 30, 2026' },
    MARKETING:  { limit: '₵24,000',  spent: '₵18,600',  spentNum: 18600,  totalNum: 24000,  period: 'Jun 1 – Jun 30, 2026' },
    FINANCE:    { limit: '₵80,000',  spent: '₵62,400',  spentNum: 62400,  totalNum: 80000,  period: 'Jun 1 – Jun 30, 2026' },
    HR:         { limit: '₵40,000',  spent: '₵34,800',  spentNum: 34800,  totalNum: 40000,  period: 'Jun 1 – Jun 30, 2026' },
    OPERATIONS: { limit: '₵90,000',  spent: '₵72,000',  spentNum: 72000,  totalNum: 90000,  period: 'Jun 1 – Jun 30, 2026' },
    DISPATCH:   { limit: '₵12,000',  spent: '₵9,800',   spentNum: 9800,   totalNum: 12000,  period: 'Jun 1 – Jun 30, 2026' },
    LOGISTICS:  { limit: '₵20,000',  spent: '₵16,400',  spentNum: 16400,  totalNum: 20000,  period: 'Jun 1 – Jun 30, 2026' },
    PRODUCTION: { limit: '₵48,000',  spent: '₵38,200',  spentNum: 38200,  totalNum: 48000,  period: 'Jun 1 – Jun 30, 2026' },
    RECEPTION:  { limit: '₵4,000',   spent: '₵2,800',   spentNum: 2800,   totalNum: 4000,   period: 'Jun 1 – Jun 30, 2026' },
  };
  return map[dept] || map.CEO;
};

/* ── Recent transactions per dept ── */
const getTransactions = (dept: string) => {
  switch (dept) {
    case 'CEO':
    case 'MANAGEMENT':
      return [
        { name: 'Tema Port Clearance',  date: 'Jun 10.06.2026', amount: '₵84,200.00', account: 'Port Acct...4521' },
        { name: 'Vendor Payment',       date: 'Jun 08.06.2026', amount: '₵22,600.00', account: 'Ops Acct...8834' },
        { name: 'Client Receipt',       date: 'Jun 06.06.2026', amount: '₵46,800.00', account: 'Main Acct...2987' },
      ];
    case 'MARKETING':
      return [
        { name: 'Bulk Order — Accra Mart', date: 'Jun 10.06.2026', amount: '₵12,400.00', account: 'Sales Acct...3341' },
        { name: 'Ad Campaign Spend',       date: 'Jun 08.06.2026', amount: '₵3,200.00',  account: 'Mktg Acct...9921' },
        { name: 'Corporate Deal',          date: 'Jun 06.06.2026', amount: '₵14,200.00', account: 'Main Acct...1124' },
      ];
    case 'FINANCE':
      return [
        { name: 'Invoice #INV-2841',    date: 'Jun 10.06.2026', amount: '₵38,400.00', account: 'Ledger...5512' },
        { name: 'Vendor TradeCo',       date: 'Jun 08.06.2026', amount: '₵14,200.00', account: 'Payable...6630' },
        { name: 'Bank Transfer',        date: 'Jun 06.06.2026', amount: '₵62,000.00', account: 'Main Acct...2987' },
      ];
    default:
      return [
        { name: 'Operation Batch A',   date: 'Jun 10.06.2026', amount: '₵18,400.00', account: 'Ops Acct...2987' },
        { name: 'Stock Procurement',   date: 'Jun 08.06.2026', amount: '₵6,200.00',  account: 'Main Acct...8686' },
        { name: 'Revenue Credit',      date: 'Jun 06.06.2026', amount: '₵42,600.00', account: 'Main Acct...1256' },
      ];
  }
};

/* ── Money movement bar data ── */
const moneyMovementData = [
  { week: 'W1',  value: 2400, highlight: false },
  { week: 'W2',  value: 3200, highlight: false },
  { week: 'W3',  value: 1800, highlight: false },
  { week: 'W4',  value: 4800, highlight: true  },
  { week: 'W5',  value: 2200, highlight: false },
  { week: 'W6',  value: 3600, highlight: false },
  { week: 'W7',  value: 2800, highlight: false },
  { week: 'W8',  value: 1600, highlight: false },
  { week: 'W9',  value: 2600, highlight: false },
  { week: 'W10', value: 3000, highlight: false },
];

/* ── Contacts for Quick Transfer ── */
const contacts = [
  { initials: 'KA', color: '#4f6ef7' },
  { initials: 'EB', color: '#f97316' },
  { initials: 'MO', color: '#ec4899' },
  { initials: 'TL', color: '#14b8a6' },
  { initials: 'GD', color: '#a855f7' },
  { initials: 'RB', color: '#f59e0b' },
];

/* ── Progress bar "dots" style ── */
const ProgressBar = ({ pct }: { pct: number }) => {
  const total = 40;
  const filled = Math.round((pct / 100) * total);
  return (
    <div className="flex gap-[3px] items-center my-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] flex-1 rounded-full transition-all"
          style={{ background: i < filled ? '#4f6ef7' : '#e2e8f0' }}
        />
      ))}
    </div>
  );
};

export default function LiamFinanceShell({ activeDepartment, currentUser, children }: LiamFinanceShellProps) {
  const [quickAmount, setQuickAmount] = useState('200.00');
  const [selectedContact, setSelectedContact] = useState(2);

  const actions = useMemo(() => getDeptActions(activeDepartment), [activeDepartment]);
  const cards = useMemo(() => getDeptCards(activeDepartment), [activeDepartment]);
  const wallet = useMemo(() => getWalletBalance(activeDepartment), [activeDepartment]);
  const budget = useMemo(() => getBudget(activeDepartment), [activeDepartment]);
  const transactions = useMemo(() => getTransactions(activeDepartment), [activeDepartment]);

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';
  if (isBoardroomOrSettings) return <>{children}</>;

  const budgetPct = Math.min(100, Math.round((budget.spentNum / budget.totalNum) * 100));
  const firstName = currentUser?.fullName?.split(' ')[0] || 'there';

  const deptLabel: Record<string, string> = {
    CEO: 'Portfolio', MANAGEMENT: 'Cargo Accounts', MARKETING: 'Sales Accounts',
    HR: 'Payroll Accounts', OPERATIONS: 'Stock Accounts', FINANCE: 'Finance Accounts',
    DISPATCH: 'Fleet Accounts', LOGISTICS: 'Logistics Accounts',
    PRODUCTION: 'Production Accounts', RECEPTION: 'Operations Accounts',
  };

  return (
    <div className="liam-shell pb-8">

      {/* ── ROW 1: Greeting + Action buttons ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
          Welcome Back, {firstName}!
        </h1>
        {/* Action pill buttons */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {actions.map((action, i) => {
            const Icon = action.Icon;
            return (
              <button
                key={i}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-semibold cursor-pointer transition-all border ${
                  action.primary
                    ? 'bg-[#4f6ef7] text-white border-[#4f6ef7] hover:bg-[#3b5ce8] shadow-md'
                    : 'bg-white text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-page)] hover:border-[#4f6ef7] hover:text-[#4f6ef7]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ROW 2: Card stack + Overview chart ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

        {/* Card Stack — left */}
        <div className="lg:col-span-2 liam-card rounded-2xl p-5">
          {/* Stacked cards */}
          <div className="relative h-28 mb-4">
            {cards.map((card, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 rounded-2xl px-4 py-3 flex items-center justify-between"
                style={{
                  background: card.color,
                  top: `${i * 18}px`,
                  zIndex: cards.length - i,
                  height: '64px',
                  opacity: 1 - i * 0.05,
                  transform: `scale(${1 - i * 0.02})`,
                  transformOrigin: 'top center',
                }}
              >
                <span className="text-[11px] font-semibold text-white/90">{card.label}</span>
                <span className="text-sm font-extrabold text-white">{card.value}</span>
              </div>
            ))}
          </div>

          {/* Cards count + add */}
          <div className="flex items-center justify-between mt-2 mb-3">
            <span className="text-[11px] text-[var(--text-muted)]">{cards.length} accounts</span>
            <button className="w-7 h-7 rounded-full bg-[#4f6ef7] flex items-center justify-center cursor-pointer hover:bg-[#3b5ce8] transition-colors">
              <Plus className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Wallet balance */}
          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-[11px] text-[#4f6ef7] font-semibold">
              {deptLabel[activeDepartment]} balance
              <span className="ml-1 text-emerald-500">{wallet.trend}</span>
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mt-1">{wallet.value}</h2>
          </div>
        </div>

        {/* Overview line chart — right */}
        <div className="lg:col-span-3 liam-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[var(--text-primary)]">Overview</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#4f6ef7] inline-block" />Current Year</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316] inline-block" />Last Year</span>
              </div>
              <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-muted)] rounded-lg px-2 py-1 outline-none cursor-pointer">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>This Year</option>
              </select>
            </div>
          </div>
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overviewData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v === 0 ? '0' : `${v/1000}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v, name) => [`₵${Number(v).toLocaleString()}`, name === 'current' ? 'Current Year' : 'Last Year']}
                />
                <Line type="monotone" dataKey="current" stroke="#4f6ef7" strokeWidth={2.5}
                  dot={{ fill: '#4f6ef7', strokeWidth: 2, stroke: 'white', r: 3.5 }}
                  activeDot={{ r: 5, fill: '#4f6ef7', stroke: 'white', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="last" stroke="#f97316" strokeWidth={2}
                  dot={{ fill: '#f97316', strokeWidth: 2, stroke: 'white', r: 3 }}
                  activeDot={{ r: 5, fill: '#f97316', stroke: 'white', strokeWidth: 2 }}
                  strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Budget Limit + Quick Transfer ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Monthly Budget Limit */}
        <div className="liam-card rounded-2xl p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Monthly spending limit</p>
              <div className="flex items-baseline gap-2 mt-2">
                <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">{budget.limit}</h2>
                <span className="text-sm text-[var(--text-muted)] font-medium">GHS</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-[var(--border)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#4f6ef7]" />
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-1">From {budget.period}</p>
          <ProgressBar pct={budgetPct} />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-secondary)]">Amount Spent <span className="font-bold text-[var(--text-primary)]">{budget.spent}</span></span>
            <span className="text-[var(--text-muted)]">Budget total <span className="font-bold text-[var(--text-primary)]">{budget.limit}</span></span>
          </div>
        </div>

        {/* Quick Transfer / Quick Actions */}
        <div className="liam-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Quick transfer</p>
            <button className="text-[11px] text-[#4f6ef7] font-semibold hover:underline cursor-pointer">See All Contacts</button>
          </div>
          {/* Contact avatars */}
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
            <button className="w-10 h-10 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center shrink-0 hover:border-[#4f6ef7] transition-colors cursor-pointer">
              <Plus className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
            {contacts.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedContact(i)}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white transition-all cursor-pointer ${
                  selectedContact === i ? 'ring-2 ring-offset-2 ring-[#4f6ef7] scale-110' : 'hover:scale-105'
                }`}
                style={{ background: c.color }}
              >
                {c.initials}
              </button>
            ))}
            <button className="w-10 h-10 rounded-full border border-[var(--border)] flex items-center justify-center shrink-0 hover:bg-[var(--bg-page)] transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
          {/* Amount + Send */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={quickAmount}
              onChange={e => setQuickAmount(e.target.value)}
              className="flex-1 text-xl font-extrabold text-[var(--text-primary)] bg-transparent outline-none border-b-2 border-[var(--border)] focus:border-[#4f6ef7] pb-1 transition-colors"
              placeholder="0.00"
            />
            <button className="bg-[#4f6ef7] text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-[#3b5ce8] transition-colors cursor-pointer shrink-0 shadow-md">
              Send
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 4: Transaction table + Money Movement ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Transaction table */}
        <div className="liam-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Transaction</p>
            <button className="text-[11px] text-[#4f6ef7] font-semibold hover:underline cursor-pointer">See all</button>
          </div>
          <div className="space-y-0">
            {/* Header row */}
            <div className="grid grid-cols-4 gap-2 pb-2 border-b border-[var(--border)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <span>Description</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Account</span>
            </div>
            {transactions.map((tx, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-page)] rounded-lg px-1 transition-colors">
                <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{tx.name}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{tx.date}</span>
                <span className="text-[11px] font-bold text-[var(--text-primary)] text-right">{tx.amount}</span>
                <span className="text-[10px] text-[var(--text-muted)] text-right truncate">{tx.account}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Money Movement bar chart */}
        <div className="liam-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-[var(--text-primary)]">Money movement</p>
            <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-muted)] rounded-lg px-2 py-1 outline-none cursor-pointer">
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          {/* Money in / out summary */}
          <div className="flex items-center justify-between mb-3 text-[11px]">
            <div>
              <p className="text-[var(--text-muted)]">Money in</p>
              <p className="text-base font-extrabold text-[var(--text-primary)]">₵40,000</p>
            </div>
            <div className="text-right">
              <p className="text-[var(--text-muted)]">Money Out</p>
              <p className="text-base font-extrabold text-[var(--text-primary)]">₵60,000</p>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moneyMovementData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }} barSize={14}>
                <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v === 0 ? '' : `${v/1000}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', borderColor: 'var(--border)', borderRadius: 8, fontSize: 10 }}
                  formatter={(v) => [`₵${Number(v).toLocaleString()}`, 'Amount']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {moneyMovementData.map((entry, i) => (
                    <Cell key={i} fill={entry.highlight ? '#4f6ef7' : '#dbeafe'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
