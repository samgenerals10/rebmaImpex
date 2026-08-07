// src/views/ceo/AccountsView.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  RefreshCw, CreditCard, Banknote, Smartphone, Receipt, ShoppingCart, BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';

const PIE_COLORS = ['#1a5c32', '#29a9dc', '#7fc241', '#f59e0b', '#8b5cf6', '#ef4444'];

interface AccountsViewProps { setActiveSubTab?: (tab: string) => void; }

interface ModeBreak { mode: string; amount: number; count: number; }
interface MonthPoint { month: string; income: number; expenses: number; net: number; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: GHS {Number(p.value).toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function AccountsView({ setActiveSubTab }: AccountsViewProps) {
  const [loading, setLoading] = useState(true);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [creditOutstanding, setCreditOutstanding] = useState(0);
  const [modeBreaks, setModeBreaks] = useState<ModeBreak[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<{ name: string; value: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthPoint[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Headline totals + mode/category breakdowns come from real SQL
      // SUM()/GROUP BY over the full tables (get_finance_wallet_totals,
      // get_orders_financial_summary) rather than summing a capped window
      // client-side — those figures were silently wrong the moment real
      // volume passed 500/500/200 rows. The chart/recent-activity queries
      // below stay capped since they're explicitly "recent", not totals.
      const [paymentsRes, expensesRes, purchasesRes, totalsRes, ordersSummaryRes] = await Promise.all([
        supabase.from('finance_payments').select('amount, payment_mode, client_name, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('finance_expenses').select('amount, category, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('general_purchases').select('cost, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.rpc('get_finance_wallet_totals').single(),
        supabase.rpc('get_orders_financial_summary').single(),
      ]);

      const payments  = (paymentsRes.data  || []) as any[];
      const expenses  = (expensesRes.data  || []) as any[];
      const purchases = (purchasesRes.data || []) as any[];
      const totals = totalsRes.data as any;
      const ordersSummary = ordersSummaryRes.data as any;

      setTotalIn(Number(totals?.total_in || 0));
      setTotalOut(Number(totals?.total_out || 0));
      setTotalPurchases(Number(totals?.total_purchases || 0));
      setTotalRevenue(Number(ordersSummary?.total_revenue || 0));
      setPendingOrders(Number(ordersSummary?.pending_orders_count || 0));
      setCreditOutstanding(Number(ordersSummary?.credit_outstanding || 0));

      setModeBreaks(((totals?.mode_breakdown || []) as any[]).map(m => ({ mode: String(m.mode).replace(/_/g, ' '), amount: Number(m.amount), count: Number(m.count) })));
      setExpenseCategories(((totals?.expense_categories || []) as any[]).map(c => ({ name: c.name, value: Number(c.value) })));

      // ── Monthly trend (last 6 months) ────────────────────────────────────────
      const months: MonthPoint[] = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
        return { month: d.toLocaleDateString('en-GB', { month: 'short' }), income: 0, expenses: 0, net: 0 };
      });
      const monthKey = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short' });
      for (const p of payments) { const m = months.find(x => x.month === monthKey(p.created_at)); if (m) m.income += Number(p.amount || 0); }
      for (const e of expenses) { const m = months.find(x => x.month === monthKey(e.created_at)); if (m) m.expenses += Number(e.amount || 0); }
      for (const p of purchases) { const m = months.find(x => x.month === monthKey(p.created_at)); if (m) m.expenses += Number(p.cost || 0); }
      months.forEach(m => { m.net = m.income - m.expenses; });
      setMonthlyData(months);

      // ── Recent ────────────────────────────────────────────────────────────────
      setRecentPayments(payments.slice(0, 8));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const net = totalIn - totalOut - totalPurchases;
  const modeIcons: Record<string, any> = { CASH: Banknote, 'MOBILE MONEY': Smartphone, CHEQUE: CreditCard, CREDIT: Receipt };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Company Accounts</h2>
          <p className="text-xs text-[var(--text-muted)]">Live financial overview across all departments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setActiveSubTab?.('Wallets')} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Wallet className="w-3.5 h-3.5" /> Wallets
          </button>
        </div>
      </div>

      {/* Hero KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Received',     value: totalIn,       icon: ArrowDownLeft, color: '#10b981', bg: 'bg-emerald-50', sub: 'From all payments' },
          { label: 'Total Expenses',     value: totalOut + totalPurchases, icon: ArrowUpRight, color: '#ef4444', bg: 'bg-rose-50', sub: 'Expenses + purchases' },
          { label: 'Net Balance',        value: Math.abs(net), icon: net >= 0 ? TrendingUp : TrendingDown, color: net >= 0 ? '#10b981' : '#ef4444', bg: net >= 0 ? 'bg-emerald-50' : 'bg-rose-50', sub: net >= 0 ? 'Surplus' : 'Deficit' },
          { label: 'Order Revenue',      value: totalRevenue,  icon: BarChart2, color: '#1a5c32', bg: 'bg-[var(--accent-light)]', sub: `${pendingOrders} pending review` },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{k.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.bg}`}>
                  <Icon className="w-4 h-4" style={{ color: k.color }} />
                </div>
              </div>
              {loading
                ? <div className="animate-pulse h-7 w-32 bg-[var(--bg-input)] rounded" />
                : <p className="text-xl font-bold" style={{ color: k.color }}>GHS {k.value.toLocaleString()}</p>}
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Credit outstanding banner */}
      {creditOutstanding > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <CreditCard className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-700">
            Credit outstanding: <span className="font-extrabold">GHS {creditOutstanding.toLocaleString()}</span> from credit orders not yet delivered
          </p>
          <button onClick={() => setActiveSubTab?.('Transactions')} className="ml-auto text-xs text-amber-700 underline cursor-pointer whitespace-nowrap">View →</button>
        </div>
      )}

      {/* Monthly cash flow chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">6-Month Cash Flow</h3>
        {loading
          ? <div className="animate-pulse h-52 bg-[var(--bg-input)] rounded-xl" />
          : <ResponsiveContainer width="100%" height={210}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income"   name="Income"   fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="net"      name="Net"      fill="#29a9dc" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>}
      </div>

      {/* Payment mode breakdown + Expense categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment mode cards */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Payment Mode Breakdown</h3>
          {loading
            ? <div className="space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="animate-pulse h-12 bg-[var(--bg-input)] rounded-xl"/>)}</div>
            : modeBreaks.length === 0
              ? <p className="text-xs text-[var(--text-muted)] text-center py-8">No payments recorded yet</p>
              : <div className="space-y-3">
                  {modeBreaks.map((m, i) => {
                    const Icon = modeIcons[m.mode] || Banknote;
                    const pct = totalIn > 0 ? Math.round((m.amount / totalIn) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-light)] flex-shrink-0">
                          <Icon className="w-4 h-4 text-[var(--accent)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-semibold text-[var(--text-primary)] capitalize">{m.mode.toLowerCase()}</span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">GHS {m.amount.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{m.count} transactions · {pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Total Received</span>
                    <span className="text-sm font-extrabold text-emerald-600">GHS {totalIn.toLocaleString()}</span>
                  </div>
                </div>}
        </div>

        {/* Expense categories pie + list */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Expense Categories</h3>
          {loading
            ? <div className="animate-pulse h-48 bg-[var(--bg-input)] rounded-xl" />
            : expenseCategories.length === 0
              ? <p className="text-xs text-[var(--text-muted)] text-center py-8">No expense records yet</p>
              : <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={expenseCategories} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                        {expenseCategories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`GHS ${Number(v).toLocaleString()}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {expenseCategories.map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs text-[var(--text-secondary)]">{c.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">GHS {c.value.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Total Expenses</span>
                      <span className="text-sm font-extrabold text-rose-500">GHS {totalOut.toLocaleString()}</span>
                    </div>
                  </div>
                </>}
        </div>
      </div>

      {/* Net balance area chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Net Balance Trend</h3>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
            {net >= 0 ? 'Surplus' : 'Deficit'} · GHS {Math.abs(net).toLocaleString()}
          </span>
        </div>
        {loading
          ? <div className="animate-pulse h-36 bg-[var(--bg-input)] rounded-xl" />
          : <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#29a9dc" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#29a9dc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="net" name="Net" stroke="#29a9dc" strokeWidth={2} fill="url(#netGrad)" />
              </AreaChart>
            </ResponsiveContainer>}
      </div>

      {/* Recent payments */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Payments</h3>
          <button onClick={() => setActiveSubTab?.('Transactions')} className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer">View All →</button>
        </div>
        {loading
          ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><div key={i} className="animate-pulse h-10 bg-[var(--bg-input)] rounded-xl"/>)}</div>
          : recentPayments.length === 0
            ? <p className="text-xs text-[var(--text-muted)] text-center py-8">No payments recorded yet</p>
            : <div className="space-y-2">
                {recentPayments.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100 flex-shrink-0">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.client_name || 'Client'}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{(p.payment_mode || 'CASH').replace(/_/g,' ')} · {(p.created_at || '').slice(0,10)}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">+ GHS {Number(p.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>}
      </div>
    </div>
  );
}
