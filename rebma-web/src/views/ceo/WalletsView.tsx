// src/views/ceo/WalletsView.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  Wallet, Banknote, Smartphone, CreditCard, Building2, RefreshCw,
  ShoppingCart, Receipt,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';

interface WalletsViewProps { setActiveSubTab?: (tab: string) => void; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MODE_ICON: Record<string, any> = {
  CASH: Banknote, MOBILE_MONEY: Smartphone, CHEQUE: CreditCard,
  BANK_TRANSFER: Building2, CREDIT: Receipt,
};
const MODE_LABEL: Record<string, string> = {
  CASH: 'Cash', MOBILE_MONEY: 'Mobile Money', CHEQUE: 'Cheque',
  BANK_TRANSFER: 'Bank Transfer', CREDIT: 'Credit',
};
const MODE_GRADIENT: Record<string, string> = {
  CASH:          'from-[#1a5c32] to-emerald-600',
  MOBILE_MONEY:  'from-violet-600 to-purple-700',
  CHEQUE:        'from-amber-500 to-orange-600',
  BANK_TRANSFER: 'from-sky-600 to-cyan-700',
  CREDIT:        'from-rose-500 to-red-700',
};

const normalMode = (raw: string) => {
  if (!raw) return 'CASH';
  const m = raw.toUpperCase().replace(/[\s_-]/g, '');
  if (m === 'MOBILEMONEY' || m === 'MOMO') return 'MOBILE_MONEY';
  if (m === 'CHEQUE' || m === 'CHECK')     return 'CHEQUE';
  if (m === 'BANKTRANSFER' || m === 'BANK') return 'BANK_TRANSFER';
  if (m === 'CREDIT')                       return 'CREDIT';
  return 'CASH';
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-secondary)] mb-1 font-semibold">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: GHS {Number(p.value || 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function WalletsView({ setActiveSubTab }: WalletsViewProps) {
  const [loading, setLoading]       = useState(true);
  const [totalIn, setTotalIn]       = useState(0);
  const [totalOut, setTotalOut]     = useState(0);
  const [wallets, setWallets]       = useState<{ mode: string; amount: number; count: number }[]>([]);
  const [chartData, setChartData]   = useState<{ name: string; In: number; Out: number }[]>([]);
  const [netTrend, setNetTrend]     = useState<{ name: string; net: number }[]>([]);
  const [activity, setActivity]     = useState<any[]>([]);
  const [activeCard, setActiveCard] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsRes, expensesRes, purchasesRes] = await Promise.all([
        supabase.from('finance_payments')
          .select('id, client_name, amount, payment_mode, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('finance_expenses')
          .select('id, category, description, amount, created_at, status')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('general_purchases')
          .select('id, item_name, cost, created_at, status')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const pays  = (paymentsRes.data  || []) as any[];
      const exps  = (expensesRes.data  || []) as any[];
      const purch = (purchasesRes.data || []) as any[];

      // Headline totals + mode breakdown from real SQL SUM()/GROUP BY over
      // the full tables, not summed over this capped 500-row window —
      // those numbers were silently wrong once real volume passed the cap.
      const { data: totals } = await supabase.rpc('get_finance_wallet_totals').single();
      setTotalIn(Number((totals as any)?.total_in || 0));
      setTotalOut(Number((totals as any)?.total_out || 0));
      // Re-merge after normalization — the SQL groups by raw payment_mode
      // text, but variant spellings (e.g. "momo" vs "MOBILE_MONEY") should
      // land in the same bucket, same as the normalization this replaced.
      const normalizedModes: Record<string, { amount: number; count: number }> = {};
      for (const m of ((totals as any)?.mode_breakdown || []) as any[]) {
        const key = normalMode(m.mode);
        if (!normalizedModes[key]) normalizedModes[key] = { amount: 0, count: 0 };
        normalizedModes[key].amount += Number(m.amount || 0);
        normalizedModes[key].count += Number(m.count || 0);
      }
      setWallets(Object.entries(normalizedModes).map(([mode, v]) => ({ mode, ...v })).sort((a, b) => b.amount - a.amount));

      // ── Monthly bar chart — last 6 months ───────────────────────────────────
      const monthInMap: Record<string, number>  = {};
      const monthOutMap: Record<string, number> = {};
      for (const p of pays) {
        const k = MONTHS[new Date(p.created_at).getMonth()];
        monthInMap[k] = (monthInMap[k] || 0) + Number(p.amount || 0);
      }
      for (const e of exps) {
        if (e.status !== 'Rejected') {
          const k = MONTHS[new Date(e.created_at).getMonth()];
          monthOutMap[k] = (monthOutMap[k] || 0) + Number(e.amount || 0);
        }
      }
      for (const p of purch) {
        if (p.status === 'APPROVED') {
          const k = MONTHS[new Date(p.created_at).getMonth()];
          monthOutMap[k] = (monthOutMap[k] || 0) + Number(p.cost || 0);
        }
      }
      const last6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
        const k = MONTHS[d.getMonth()];
        return { name: k, In: monthInMap[k] || 0, Out: monthOutMap[k] || 0 };
      });
      setChartData(last6);
      setNetTrend(last6.map(m => ({ name: m.name, net: m.In - m.Out })));

      // ── Recent activity feed ─────────────────────────────────────────────────
      const feed = [
        ...pays.slice(0, 10).map((p: any) => ({
          id: `pay-${p.id}`, label: p.client_name || 'Payment',
          sub: (p.payment_mode || 'CASH').replace(/_/g, ' '),
          amount: Number(p.amount || 0), type: 'in', date: p.created_at,
        })),
        ...exps.slice(0, 6).map((e: any) => ({
          id: `exp-${e.id}`, label: e.description || e.category || 'Expense',
          sub: e.category || 'Expense',
          amount: Number(e.amount || 0), type: 'out', date: e.created_at,
        })),
        ...purch.slice(0, 4).map((p: any) => ({
          id: `gp-${p.id}`, label: `Purchase: ${p.item_name || 'Item'}`,
          sub: 'General Purchase',
          amount: Number(p.cost || 0), type: 'out', date: p.created_at,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 14);
      setActivity(feed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useRealtimeChannel('wallets-realtime', ['finance_payments', 'finance_expenses', 'general_purchases'], () => load());

  const net = totalIn - totalOut;
  const activeWallet = wallets[activeCard] || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Company Wallets</h2>
          <p className="text-xs text-[var(--text-muted)]">Live balances from all payment channels</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setActiveSubTab?.('Transactions')} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            All Transactions →
          </button>
        </div>
      </div>

      {/* Hero balance card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a5c32] to-emerald-700 rounded-2xl p-6 text-white shadow-[var(--box-shadow)]">
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

        <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Total Company Balance</p>
        {loading
          ? <div className="animate-pulse h-12 w-52 bg-white/20 rounded-xl mt-1" />
          : <p className="text-5xl font-extrabold tracking-tight">GHS {totalIn.toLocaleString()}</p>}

        <div className="flex flex-wrap gap-6 mt-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Money In</p>
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-green-300" />
              <span className="text-base font-bold">GHS {totalIn.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Money Out</p>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-red-300" />
              <span className="text-base font-bold">GHS {totalOut.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Net Balance</p>
            <div className="flex items-center gap-1.5">
              {net >= 0
                ? <TrendingUp className="w-4 h-4 text-green-300" />
                : <TrendingDown className="w-4 h-4 text-red-300" />}
              <span className={`text-base font-bold ${net >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                GHS {Math.abs(net).toLocaleString()} {net >= 0 ? '↑' : '↓'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet channel cards (selectable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse h-28 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]" />
            ))
          : wallets.length === 0
            ? (
              <div className="col-span-5 flex flex-col items-center py-8 text-[var(--text-muted)]">
                <Wallet className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No payment records yet</p>
              </div>
            )
            : wallets.map((w, i) => {
                const Icon = MODE_ICON[w.mode] || Wallet;
                const grad = MODE_GRADIENT[w.mode] || 'from-slate-600 to-slate-700';
                return (
                  <button
                    key={w.mode}
                    onClick={() => setActiveCard(i)}
                    className={`relative overflow-hidden bg-gradient-to-br ${grad} rounded-2xl p-4 text-left cursor-pointer transition-all
                      ${activeCard === i ? 'ring-2 ring-white/60 ring-offset-2 scale-[1.03]' : 'hover:scale-[1.02] opacity-90'}`}
                  >
                    <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="w-4 h-4 text-white/80" />
                      {activeCard === i && <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Selected</span>}
                    </div>
                    <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wide mb-1">{MODE_LABEL[w.mode] || w.mode}</p>
                    <p className="text-lg font-extrabold text-white leading-tight">GHS {w.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-white/50 mt-1">{w.count} transaction{w.count !== 1 ? 's' : ''}</p>
                  </button>
                );
              })}
      </div>

      {/* Selected wallet detail */}
      {!loading && activeWallet && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)] flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">{MODE_LABEL[activeWallet.mode] || activeWallet.mode} Channel</p>
            <p className="text-2xl font-extrabold text-[var(--text-primary)]">GHS {activeWallet.amount.toLocaleString()}</p>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Transactions</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{activeWallet.count}</p>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Share of total</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {totalIn > 0 ? Math.round((activeWallet.amount / totalIn) * 100) : 0}%
            </p>
          </div>
          <div className="flex-1 min-w-[120px]">
            <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${totalIn > 0 ? (activeWallet.amount / totalIn) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart — In vs Out */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Money In vs Out</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-4">Last 6 months — GHS</p>
          {loading
            ? <div className="animate-pulse h-44 bg-[var(--bg-input)] rounded-xl" />
            : <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="In"  name="Money In"  fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="Out" name="Money Out" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>}
        </div>

        {/* Area chart — Net trend */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Net Balance Trend</h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-4">Income minus expenses per month</p>
          {loading
            ? <div className="animate-pulse h-44 bg-[var(--bg-input)] rounded-xl" />
            : <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={netTrend}>
                  <defs>
                    <linearGradient id="netWalletGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#29a9dc" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#29a9dc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="net" name="Net Balance" stroke="#29a9dc" strokeWidth={2} fill="url(#netWalletGrad)" />
                </AreaChart>
              </ResponsiveContainer>}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Activity</h3>
            <p className="text-[10px] text-[var(--text-muted)]">Payments, expenses &amp; purchases</p>
          </div>
          <button onClick={() => setActiveSubTab?.('Transactions')} className="text-xs text-[var(--accent)] font-semibold hover:underline cursor-pointer">
            View All →
          </button>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="animate-pulse h-12 bg-[var(--bg-input)] rounded-xl" />)}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
            <Wallet className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-semibold">No transactions yet</p>
            <p className="text-xs opacity-70 mt-1">Finance records appear here as payments are logged</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {activity.map(t => (
              <div key={t.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
                onClick={() => setActiveSubTab?.('Transactions')}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'in' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                  {t.type === 'in'
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    : t.sub === 'General Purchase'
                      ? <ShoppingCart className="w-4 h-4 text-rose-500" />
                      : <ArrowUpRight className="w-4 h-4 text-rose-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{t.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{t.sub}
                  </p>
                </div>
                <span className={`text-sm font-extrabold whitespace-nowrap ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {t.type === 'in' ? '+' : '−'} GHS {t.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
