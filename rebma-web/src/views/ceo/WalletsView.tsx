// src/views/ceo/WalletsView.tsx
import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

interface Payment {
  id: string;
  client_name: string;
  amount: number;
  payment_mode: string;
  created_at: string;
  status: string;
  recorded_by?: string;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  created_at: string;
  status: string;
}

interface Purchase {
  id: string;
  item_name: string;
  cost: number;
  created_at: string;
  status: string;
}

interface MonthlyFlow { name: string; In: number; Out: number; }

interface WalletsViewProps {
  setActiveSubTab?: (tab: string) => void;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function WalletsView({ setActiveSubTab }: WalletsViewProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [chartData, setChartData] = useState<MonthlyFlow[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [momoTotal, setMomoTotal] = useState(0);
  const [chequeTotal, setChequeTotal] = useState(0);
  const [bankTotal, setBankTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [paymentsRes, expensesRes, purchasesRes] = await Promise.all([
          supabase.from('finance_payments').select('id, client_name, amount, payment_mode, created_at, status, recorded_by').order('created_at', { ascending: false }),
          supabase.from('finance_expenses').select('id, category, description, amount, created_at, status').order('created_at', { ascending: false }),
          supabase.from('general_purchases').select('id, item_name, cost, created_at, status').order('created_at', { ascending: false }),
        ]);

        const payRows = (paymentsRes.data as Payment[]) ?? [];
        const expRows = (expensesRes.data as Expense[]) ?? [];
        const purRows = (purchasesRes.data as Purchase[]) ?? [];

        setPayments(payRows);
        setExpenses(expRows);

        const getMode = (mode: string) => {
          if (!mode) return '';
          const m = mode.toUpperCase().replace(/[\s_-]/g, '');
          if (m === 'CASH') return 'CASH';
          if (m === 'MOBILEMONEY' || m === 'MOMO') return 'MOBILE_MONEY';
          if (m === 'CHEQUE' || m === 'CHECK') return 'CHEQUE';
          if (m === 'BANKTRANSFER' || m === 'BANK') return 'BANK_TRANSFER';
          return m;
        };

        let total = 0, cash = 0, momo = 0, cheque = 0, bank = 0;
        for (const p of payRows) {
          const amt = Number(p.amount || 0);
          total += amt;
          const mode = getMode(p.payment_mode);
          if (mode === 'CASH') cash += amt;
          else if (mode === 'MOBILE_MONEY') momo += amt;
          else if (mode === 'CHEQUE') cheque += amt;
          else if (mode === 'BANK_TRANSFER') bank += amt;
        }
        setTotalIn(total);
        setCashTotal(cash);
        setMomoTotal(momo);
        setChequeTotal(cheque);
        setBankTotal(bank);

        // Total outflows = expenses + approved purchases
        const expOut = expRows.filter(e => e.status !== 'Rejected').reduce((s, e) => s + Number(e.amount || 0), 0);
        const purOut = purRows.filter(p => p.status === 'APPROVED').reduce((s, p) => s + Number(p.cost || 0), 0);
        setTotalOut(expOut + purOut);

        // Build monthly chart — last 6 months
        const monthInMap: Record<string, number> = {};
        const monthOutMap: Record<string, number> = {};

        for (const p of payRows) {
          const k = MONTHS_SHORT[new Date(p.created_at).getMonth()];
          monthInMap[k] = (monthInMap[k] || 0) + Number(p.amount || 0);
        }
        for (const e of expRows) {
          if (e.status !== 'Rejected') {
            const k = MONTHS_SHORT[new Date(e.created_at).getMonth()];
            monthOutMap[k] = (monthOutMap[k] || 0) + Number(e.amount || 0);
          }
        }
        for (const p of purRows) {
          if (p.status === 'APPROVED') {
            const k = MONTHS_SHORT[new Date(p.created_at).getMonth()];
            monthOutMap[k] = (monthOutMap[k] || 0) + Number(p.cost || 0);
          }
        }

        const last6: MonthlyFlow[] = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
          const k = MONTHS_SHORT[d.getMonth()];
          return {
            name: k,
            In: Math.round((monthInMap[k] || 0) / 1000),
            Out: Math.round((monthOutMap[k] || 0) / 1000),
          };
        });
        setChartData(last6);
      } catch {
        setPayments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const net = totalIn - totalOut;

  const WALLET_CARDS = [
    { name: 'Cash Payments',  currency: 'GHS', balance: cashTotal,   color: 'from-blue-700 to-indigo-800',   sub: 'Cash receipts' },
    { name: 'Mobile Money',   currency: 'GHS', balance: momoTotal,   color: 'from-violet-700 to-purple-800', sub: 'MoMo receipts' },
    { name: 'Cheque Payments',currency: 'GHS', balance: chequeTotal, color: 'from-amber-600 to-orange-700',  sub: 'Cheque receipts' },
    { name: 'Bank Transfer',  currency: 'GHS', balance: bankTotal,   color: 'from-cyan-700 to-blue-800',     sub: 'Bank transfer receipts' },
  ];

  const [selected, setSelected] = useState(0);

  const recentAll = [
    ...payments.slice(0, 8).map(p => ({ id: p.id, label: p.client_name || 'Payment', sub: p.payment_mode || 'CASH', amount: p.amount, type: 'in' as const, date: p.created_at })),
    ...expenses.slice(0, 5).map(e => ({ id: e.id, label: e.description || e.category, sub: e.category, amount: e.amount, type: 'out' as const, date: e.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Company Wallets</h2>
        <p className="text-xs text-[var(--text-muted)]">All company accounts and balances — live from finance records</p>
      </div>

      {/* Total hero */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-emerald-700 rounded-2xl p-5 text-white shadow-[var(--box-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Total Money In</p>
        {loading ? (
          <div className="animate-pulse h-10 w-48 bg-white/20 rounded-xl mt-1" />
        ) : (
          <p className="text-4xl font-extrabold tracking-tight">GHS {totalIn.toLocaleString()}</p>
        )}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span className="opacity-80">{payments.length} payment records</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-300" />
            <span className="opacity-80">Out: GHS {totalOut.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {net >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-300" /> : <TrendingDown className="w-3.5 h-3.5 text-red-300" />}
            <span className="opacity-80">Net: GHS {net.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Account cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {WALLET_CARDS.map((acct, i) => (
          <button key={i} onClick={() => setSelected(i)}
            className={`rounded-2xl p-5 text-left cursor-pointer transition-all bg-gradient-to-br ${acct.color} ${selected === i ? 'ring-2 ring-[var(--accent)] ring-offset-2 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest">{acct.name}</p>
            {loading ? (
              <div className="animate-pulse h-7 w-32 bg-white/20 rounded mt-2" />
            ) : (
              <p className="text-2xl font-extrabold text-white mt-1">{acct.currency} {(Number(acct.balance ?? 0)).toLocaleString()}</p>
            )}
            <p className="text-[10px] text-white/50 mt-3">{acct.sub}</p>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Money In vs Out — Last 6 Months</h3>
        <p className="text-[10px] text-[var(--text-muted)] mb-4">In = payments received · Out = expenses + approved purchases (GHS thousands)</p>
        {loading ? (
          <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ) : chartData.every(d => d.In === 0 && d.Out === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Wallet className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No transaction data yet</p>
            <p className="text-xs text-gray-400 mt-1">Finance records will appear here as payments and expenses are logged</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="K" />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`GHS ${((Number(v) || 0) * 1000).toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="In"  name="Money In"  fill="var(--accent)" radius={[4,4,0,0]} />
              <Bar dataKey="Out" name="Money Out" fill="#ef4444"       radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Activity</h3>
          <button onClick={() => setActiveSubTab?.('Transactions')} className="text-xs text-[var(--accent)] font-semibold hover:underline cursor-pointer">View All →</button>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        ) : recentAll.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">No transactions yet</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500">Finance records payments as orders are approved</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {recentAll.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--accent-light)] transition-colors cursor-pointer" onClick={() => setActiveSubTab?.('Transactions')}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'in' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    {t.type === 'in'
                      ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      : <ArrowUpRight className="w-4 h-4 text-rose-500" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{t.label || '—'}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {t.sub}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {t.type === 'in' ? '+' : '-'} GHS {(t.amount || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
