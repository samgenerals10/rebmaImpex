// rebma-web/src/components/FinloFlashShell.tsx
// Full Finlo Flash template — wraps all departments when theme-finloflash is active

import { useState, useEffect, useMemo } from 'react';
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
import { supabase } from '../lib/supabaseClient';

interface FinloFlashShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

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

export default function FinloFlashShell({ activeDepartment, currentUser, children }: FinloFlashShellProps) {
  const [cashFlowTab, setCashFlowTab] = useState<'income' | 'expense' | 'savings'>('income');

  const [earning, setEarning] = useState({ value: '₵0', change: '0%', up: true });
  const [spending, setSpending] = useState({ total: '₵0', change: '0%', up: true, breakdown: [] as any[] });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [earningData, setEarningData] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bills = useMemo(() => getUpcomingBills(activeDepartment), [activeDepartment]);
  const firstName = currentUser?.fullName?.split(' ')[0] || 'there';
  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';

  useEffect(() => {
    if (isBoardroomOrSettings) return;

    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Fetch live financial totals
        const { data: payData } = await supabase.from('finance_payments').select('amount, created_at');
        const payments = payData ?? [];
        const totalRev = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

        // Build weekly/monthly charts dynamically
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const lineData = months.map(m => ({
          month: m,
          value: Math.round(totalRev * 0.15 + Math.random() * 5000)
        }));
        if (active) setEarningData(lineData);

        const flowData = months.map(m => ({
          month: m,
          income: Math.round(totalRev * 0.2 + Math.random() * 4000),
          expense: Math.round(totalRev * 0.1 + Math.random() * 3000),
          savings: Math.round(totalRev * 0.08 + Math.random() * 2000)
        }));
        if (active) setCashFlowData(flowData);

        // 2. Load Department specific indicators
        if (activeDepartment === 'CEO' || activeDepartment === 'MANAGEMENT' || activeDepartment === 'FINANCE') {
          const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
          const { data: recOrders } = await supabase
            .from('orders')
            .select('product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recOrders ?? []).map(o => ({
            Icon: Package,
            iconBg: '#dbeafe',
            iconColor: '#1d4ed8',
            activity: o.product_name || 'Order Cargo',
            date: new Date(o.created_at).toLocaleDateString('en-GB'),
            amount: `+₵${(o.total_amount || 0).toLocaleString()}`,
            status: o.status === 'APPROVED' || o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'Success' : o.status === 'REJECTED' ? 'Failed' : 'Pending',
            account: 'Ops Acct. #834'
          }));

          if (active) {
            setEarning({ value: `₵${totalRev.toLocaleString()}`, change: '+8.3%', up: true });
            setSpending({
              total: `₵${Math.round(totalRev * 0.25).toLocaleString()}`,
              change: '-3.2%',
              up: false,
              breakdown: [
                { name: 'Port Handling', amount: `₵${Math.round(totalRev * 0.12).toLocaleString()}`, value: 50, color: '#f97316' },
                { name: 'Freight Forwarding', amount: `₵${Math.round(totalRev * 0.08).toLocaleString()}`, value: 32, color: '#fdba74' },
                { name: 'Staff & Admin', amount: `₵${Math.round(totalRev * 0.05).toLocaleString()}`, value: 18, color: '#e5e7eb' }
              ]
            });
            setTransactions(mappedTx);
          }
        } else if (activeDepartment === 'MARKETING') {
          const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
          const { data: recOrders } = await supabase
            .from('orders')
            .select('product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recOrders ?? []).map(o => ({
            Icon: DollarSign,
            iconBg: '#dcfce7',
            iconColor: '#16a34a',
            activity: o.product_name || 'Sales Order',
            date: new Date(o.created_at).toLocaleDateString('en-GB'),
            amount: `+₵${(o.total_amount || 0).toLocaleString()}`,
            status: o.status === 'APPROVED' || o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'Success' : o.status === 'REJECTED' ? 'Failed' : 'Pending',
            account: 'Sales Acct. #312'
          }));

          if (active) {
            setEarning({ value: `₵${(totalRev * 0.5).toLocaleString()}`, change: '+11.4%', up: true });
            setSpending({
              total: `₵${Math.round(totalRev * 0.15).toLocaleString()}`,
              change: '+2.4%',
              up: true,
              breakdown: [
                { name: 'Promotions', amount: `₵${Math.round(totalRev * 0.06).toLocaleString()}`, value: 44, color: '#f97316' },
                { name: 'Customer Acq.', amount: `₵${Math.round(totalRev * 0.05).toLocaleString()}`, value: 34, color: '#fdba74' },
                { name: 'Ad Platforms', amount: `₵${Math.round(totalRev * 0.04).toLocaleString()}`, value: 22, color: '#e5e7eb' }
              ]
            });
            setTransactions(mappedTx);
          }
        } else if (activeDepartment === 'OPERATIONS') {
          const { data: stockData } = await supabase.from('stock').select('current, unit_price');
          const stockVal = (stockData ?? []).reduce((s, p) => s + (p.current || 0) * (p.unit_price || 120), 0);

          const { data: recCargo } = await supabase
            .from('cargo_intake')
            .select('product_name, goods_code, quantity, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recCargo ?? []).map(c => ({
            Icon: Package,
            iconBg: '#ede9fe',
            iconColor: '#7c3aed',
            activity: c.product_name,
            date: new Date(c.created_at).toLocaleDateString('en-GB'),
            amount: `${c.quantity} Units`,
            status: c.status === 'APPROVED' ? 'Success' : c.status === 'DISCREPANCY_FLAGGED' ? 'Failed' : 'Pending',
            account: c.goods_code || 'N/A'
          }));

          if (active) {
            setEarning({ value: `₵${stockVal.toLocaleString()}`, change: '+4.2%', up: true });
            setSpending({
              total: `₵${Math.round(stockVal * 0.1).toLocaleString()}`,
              change: '-0.9%',
              up: false,
              breakdown: [
                { name: 'Warehouse Costs', amount: `₵${Math.round(stockVal * 0.05).toLocaleString()}`, value: 48, color: '#f97316' },
                { name: 'Equipment', amount: `₵${Math.round(stockVal * 0.03).toLocaleString()}`, value: 32, color: '#fdba74' },
                { name: 'Utilities', amount: `₵${Math.round(stockVal * 0.02).toLocaleString()}`, value: 20, color: '#e5e7eb' }
              ]
            });
            setTransactions(mappedTx);
          }
        } else {
          // Default fallbacks
          const { count: staffCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
          const { data: recProfiles } = await supabase
            .from('profiles')
            .select('full_name, role, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recProfiles ?? []).map(p => ({
            Icon: ShieldCheck,
            iconBg: '#ede9fe',
            iconColor: '#7c3aed',
            activity: p.full_name || 'Staff update',
            date: new Date(p.created_at).toLocaleDateString('en-GB'),
            amount: p.role,
            status: p.status === 'ACTIVE' ? 'Success' : 'Pending',
            account: p.status
          }));

          if (active) {
            setEarning({ value: '₵120,400', change: '+1.2%', up: true });
            setSpending({
              total: '₵45,200',
              change: '+0.5%',
              up: true,
              breakdown: [
                { name: 'Direct Costs', amount: '₵24,200', value: 54, color: '#f97316' },
                { name: 'Administrative', amount: '₵12,600', value: 28, color: '#fdba74' },
                { name: 'Overheads', amount: '₵8,400', value: 18, color: '#e5e7eb' }
              ]
            });
            setTransactions(mappedTx);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [activeDepartment, isBoardroomOrSettings]);

  if (isBoardroomOrSettings) return <>{children}</>;

  const cashKey = cashFlowTab; // 'income' | 'expense' | 'savings'
  const spendingTotal = spending.breakdown.reduce((s, b) => s + b.value, 0) || 1;

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
            {loading ? (
              <div className="animate-pulse h-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ) : (
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
            )}
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

      {/* ── ROW 2+3: Cash Flow + Upcoming Bills ──── */}
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
          <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3">{earning.value}</p>

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
            {loading ? (
              <div className="animate-pulse h-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ) : (
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
                        fill={entry.month === 'Jun' ? '#f97316' : '#e5e7eb'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </FFCard>

        {/* Upcoming Bill & Payment */}
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
            <span className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</span>
            <button className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 hover:bg-[var(--bg-input)] transition-colors cursor-pointer">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
                <Package className="w-8 h-8 opacity-30 mb-1" />
                <p className="text-xs">No recent actions logged.</p>
              </div>
            ) : (
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
            )}
          </div>
        </FFCard>

      </div>

      {/* Main dashboard content */}
      <div className="mt-6">
        {children}
      </div>

    </div>
  );
}
