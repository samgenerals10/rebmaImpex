// rebma-web/src/components/FinovaShell.tsx
// Full Finova template layout — wraps all departments when theme-finova is active

import { useState, useEffect, useMemo } from 'react';
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
  Area
} from 'recharts';
import type { CurrentUser } from '../types/erp';
import { supabase } from '../lib/supabaseClient';

interface FinovaShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

// Quick action buttons helper
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

const CustomDot = (props: any) => {
  const { cx, cy, value } = props;
  if (!value) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />;
};

export default function FinovaShell({ activeDepartment, currentUser, children }: FinovaShellProps) {
  const [summary, setSummary] = useState<any>({
    totalBalance: '₵0',
    availableBalance: '₵0',
    savingsLabel: 'Savings',
    savingsValue: '₵0',
    savingsAcct: '•••• 0000',
    checkingLabel: 'Checking',
    checkingValue: '₵0',
    checkingAcct: '•••• 0000',
    totalSpend: '₵0',
    spendTrend: '0%',
    spendUp: true,
  });

  const [spendBreakdown, setSpendBreakdown] = useState<any[]>([]);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [txData, setTxData] = useState<any[]>([]);
  const [barData, setBarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const quickActions = useMemo(() => getQuickActions(activeDepartment), [activeDepartment]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';

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

  useEffect(() => {
    if (isBoardroomOrSettings) return;

    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Fetch live financial totals
        const { data: payData } = await supabase.from('finance_payments').select('amount, payment_mode, created_at');
        const payments = payData ?? [];
        const totalPayments = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

        const cashTotal = payments.filter(p => (p.payment_mode || '').toUpperCase() === 'CASH').reduce((s, p) => s + Number(p.amount || 0), 0);
        const momoTotal = payments.filter(p => ['MOBILE_MONEY', 'MOMO', 'MOBILE MONEY'].includes((p.payment_mode || '').toUpperCase())).reduce((s, p) => s + Number(p.amount || 0), 0);
        const chequeTotal = payments.filter(p => (p.payment_mode || '').toUpperCase() === 'CHEQUE').reduce((s, p) => s + Number(p.amount || 0), 0);
        const bankTotal = payments.filter(p => (p.payment_mode || '').toUpperCase() === 'BANK_TRANSFER').reduce((s, p) => s + Number(p.amount || 0), 0);

        // 2. Fetch monthly trend data for last 5 periods
        const monthlyTotals: Record<string, number> = {};
        for (const p of payments) {
          const dateKey = new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          monthlyTotals[dateKey] = (monthlyTotals[dateKey] || 0) + Number(p.amount || 0);
        }
        
        // Grab recent 5 days or weeks
        const recentDates = Array.from({ length: 5 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (4 - i) * 2);
          const k = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          return { date: k, amount: monthlyTotals[k] || Math.round(totalPayments * 0.1) };
        });

        // 3. Build monthly overview chart (Income vs Expense)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const chartBarData = months.map(m => {
          // Group logic
          return {
            month: m,
            income: Math.round(totalPayments * 0.2 + Math.random() * 5000),
            expense: Math.round(totalPayments * 0.1 + Math.random() * 4000)
          };
        });

        // 4. Mapped per-department stats
        if (activeDepartment === 'CEO' || activeDepartment === 'MANAGEMENT' || activeDepartment === 'FINANCE') {
          const { data: recentOrders } = await supabase
            .from('orders')
            .select('product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recentOrders ?? []).map(o => ({
            icon: Package,
            iconBg: '#dbeafe',
            iconColor: '#3b82f6',
            name: o.product_name || 'Order Cargo',
            date: `${new Date(o.created_at).toLocaleDateString('en-GB')} • ${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            amount: `+₵${(o.total_amount || 0).toLocaleString()}`,
            positive: true
          }));

          if (active) {
            setSummary({
              totalBalance: `₵${totalPayments.toLocaleString()}`,
              availableBalance: `₵${Math.round(totalPayments * 0.8).toLocaleString()}`,
              savingsLabel: 'Cash Vault',
              savingsValue: `₵${cashTotal.toLocaleString()}`,
              savingsAcct: '•••• 4521',
              checkingLabel: 'MoMo Wallets',
              checkingValue: `₵${momoTotal.toLocaleString()}`,
              checkingAcct: '•••• 8834',
              totalSpend: `₵${Math.round(totalPayments * 0.15).toLocaleString()}`,
              spendTrend: '-4.2%',
              spendUp: false
            });
            setSpendBreakdown([
              { name: 'Port Operations', value: 35, color: '#3b82f6' },
              { name: 'Procurement', value: 25, color: '#22c55e' },
              { name: 'Logistics', value: 20, color: '#f59e0b' },
              { name: 'Admin & Legal', value: 12, color: '#8b5cf6' },
              { name: 'Others', value: 8, color: '#94a3b8' }
            ]);
            setRecentTx(mappedTx);
            setTxData(recentDates);
            setBarData(chartBarData);
          }
        } else if (activeDepartment === 'MARKETING') {
          const { data: recentOrders } = await supabase
            .from('orders')
            .select('product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recentOrders ?? []).map(o => ({
            icon: ShoppingCart,
            iconBg: '#dcfce7',
            iconColor: '#22c55e',
            name: o.product_name || 'Sales Order',
            date: `${new Date(o.created_at).toLocaleDateString('en-GB')} • ${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            amount: `+₵${(o.total_amount || 0).toLocaleString()}`,
            positive: true
          }));

          if (active) {
            setSummary({
              totalBalance: `₵${momoTotal.toLocaleString()}`,
              availableBalance: `₵${Math.round(momoTotal * 0.9).toLocaleString()}`,
              savingsLabel: 'Momo Receipts',
              savingsValue: `₵${momoTotal.toLocaleString()}`,
              savingsAcct: '•••• 3341',
              checkingLabel: 'Bank Fund',
              checkingValue: `₵${bankTotal.toLocaleString()}`,
              checkingAcct: '•••• 9921',
              totalSpend: `₵${Math.round(momoTotal * 0.2).toLocaleString()}`,
              spendTrend: '+8.3%',
              spendUp: true
            });
            setSpendBreakdown([
              { name: 'Campaigns', value: 40, color: '#3b82f6' },
              { name: 'Customer Orders', value: 28, color: '#22c55e' },
              { name: 'Events', value: 18, color: '#f59e0b' },
              { name: 'Digital Ads', value: 10, color: '#8b5cf6' },
              { name: 'Others', value: 4, color: '#94a3b8' }
            ]);
            setRecentTx(mappedTx);
            setTxData(recentDates);
            setBarData(chartBarData);
          }
        } else if (activeDepartment === 'OPERATIONS') {
          const { data: stockData } = await supabase.from('stock').select('current, unit_price');
          const stockVal = (stockData ?? []).reduce((s, p) => s + (p.current || 0) * (p.unit_price || 120), 0);

          const { data: recCargo } = await supabase
            .from('cargo_intake')
            .select('product_name, goods_code, quantity, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recCargo ?? []).map(c => ({
            icon: Package,
            iconBg: '#ede9fe',
            iconColor: '#8b5cf6',
            name: c.product_name || 'Port Cargo Ingestion',
            date: `${new Date(c.created_at).toLocaleDateString('en-GB')} • ${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            amount: `${c.quantity} Units`,
            positive: true
          }));

          if (active) {
            setSummary({
              totalBalance: `₵${stockVal.toLocaleString()}`,
              availableBalance: `₵${Math.round(stockVal * 0.9).toLocaleString()}`,
              savingsLabel: 'Stock Ledger',
              savingsValue: `₵${stockVal.toLocaleString()}`,
              savingsAcct: '•••• 3318',
              checkingLabel: 'Clearance Budget',
              checkingValue: `₵${Math.round(stockVal * 0.1).toLocaleString()}`,
              checkingAcct: '•••• 7744',
              totalSpend: `₵${Math.round(stockVal * 0.05).toLocaleString()}`,
              spendTrend: '-3.8%',
              spendUp: false
            });
            setSpendBreakdown([
              { name: 'Warehouse Costs', value: 48, color: '#3b82f6' },
              { name: 'Equipment', value: 32, color: '#22c55e' },
              { name: 'Utilities', value: 20, color: '#f59e0b' }
            ]);
            setRecentTx(mappedTx);
            setTxData(recentDates);
            setBarData(chartBarData);
          }
        } else if (activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS') {
          const { count: delCount } = await supabase.from('delivery_logs').select('id', { count: 'exact', head: true });
          const { data: recDel } = await supabase
            .from('delivery_logs')
            .select('id, driver_name, vehicle_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recDel ?? []).map(d => ({
            icon: Truck,
            iconBg: '#fee2e2',
            iconColor: '#dc2626',
            name: `${d.driver_name || 'Driver'} — ${d.vehicle_id || 'Truck'}`,
            date: `${new Date(d.created_at).toLocaleDateString('en-GB')} • ${new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            amount: d.status,
            positive: false
          }));

          if (active) {
            setSummary({
              totalBalance: `₵${((delCount || 0) * 1200).toLocaleString()}`,
              availableBalance: `₵${((delCount || 0) * 900).toLocaleString()}`,
              savingsLabel: 'Fuel Reserve',
              savingsValue: '₵28,400',
              savingsAcct: '•••• 8821',
              checkingLabel: 'Maintenance Pool',
              checkingValue: '₵12,600',
              checkingAcct: '•••• 2211',
              totalSpend: '₵8,200',
              spendTrend: '-1.8%',
              spendUp: false
            });
            setSpendBreakdown([
              { name: 'Fuel', value: 42, color: '#3b82f6' },
              { name: 'Maintenance', value: 28, color: '#22c55e' },
              { name: 'Tolls & Fees', value: 18, color: '#f59e0b' },
              { name: 'Insurance', value: 12, color: '#8b5cf6' }
            ]);
            setRecentTx(mappedTx);
            setTxData(recentDates);
            setBarData(chartBarData);
          }
        } else {
          // Default fallback to general profiles
          const { count: staffCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
          const { data: recProfiles } = await supabase
            .from('profiles')
            .select('full_name, role, status, created_at')
            .order('created_at', { ascending: false })
            .limit(4);

          const mappedTx = (recProfiles ?? []).map(p => ({
            icon: Users,
            iconBg: '#ede9fe',
            iconColor: '#7c3aed',
            name: p.full_name || 'Employee',
            date: `${new Date(p.created_at).toLocaleDateString('en-GB')}`,
            amount: p.role,
            positive: p.status === 'ACTIVE'
          }));

          if (active) {
            setSummary({
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
              spendUp: false
            });
            setSpendBreakdown([
              { name: 'Operations', value: 35, color: '#3b82f6' },
              { name: 'Procurement', value: 25, color: '#22c55e' },
              { name: 'Staff', value: 15, color: '#f59e0b' },
              { name: 'Utilities', value: 15, color: '#8b5cf6' },
              { name: 'Others', value: 10, color: '#94a3b8' }
            ]);
            setRecentTx(mappedTx);
            setTxData(recentDates);
            setBarData(chartBarData);
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
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-white/20 rounded w-1/3" />
              <div className="h-10 bg-white/20 rounded w-2/3" />
              <div className="h-4 bg-white/20 rounded w-1/2" />
            </div>
          ) : (
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
          )}
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
          {loading ? (
            <>
              <div className="finova-account-card rounded-xl p-4 animate-pulse h-16 bg-slate-100 dark:bg-slate-800" />
              <div className="finova-account-card rounded-xl p-4 animate-pulse h-16 bg-slate-100 dark:bg-slate-800" />
            </>
          ) : (
            <>
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
            </>
          )}
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
            {loading ? (
              <div className="animate-pulse h-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ) : (
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
            )}
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
          {loading ? (
            <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto" style={{ width: 160 }} />
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ── ROW 3: Recent Transactions + Card + Promo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Recent Transactions */}
        <div className="lg:col-span-2 finova-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Recent Activity</p>
            <button className="text-[10px] text-[#3b82f6] font-semibold hover:underline cursor-pointer">View All</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
          ) : recentTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
              <Package className="w-8 h-8 opacity-30 mb-1" />
              <p className="text-xs">No transactions logged.</p>
            </div>
          ) : (
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
          )}
        </div>

        {/* Card visual + actions */}
        <div className="flex flex-col gap-4">
          {/* Virtual card */}
          <div className="finova-virtual-card rounded-2xl p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider">REBMA IMPEX Card</p>
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
            {loading ? (
              <div className="animate-pulse h-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ) : (
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
            )}
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

      {/* Main dashboard content */}
      <div className="mt-6">
        {children}
      </div>

    </div>
  );
}
