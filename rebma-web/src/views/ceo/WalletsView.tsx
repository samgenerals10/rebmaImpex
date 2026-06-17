// src/views/ceo/WalletsView.tsx
import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Wallet } from 'lucide-react';
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

interface MonthlyFlow { name: string; In: number; Out: number; }

interface WalletsViewProps {
  setActiveSubTab?: (tab: string) => void;
}

export default function WalletsView({ setActiveSubTab }: WalletsViewProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [chartData, setChartData] = useState<MonthlyFlow[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [momoTotal, setMomoTotal] = useState(0);
  const [chequeTotal, setChequeTotal] = useState(0);
  const [bankTotal, setBankTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('finance_payments')
          .select('id, client_name, amount, payment_mode, created_at, status, recorded_by')
          .order('created_at', { ascending: false });
        const rows = (data as Payment[]) ?? [];
        setPayments(rows);

        const getMode = (mode: string) => {
          if (!mode) return '';
          const m = mode.toUpperCase().replace(/[\s_-]/g, '');
          if (m === 'CASH') return 'CASH';
          if (m === 'MOBILEMONEY' || m === 'MOMO') return 'MOBILE_MONEY';
          if (m === 'CHEQUE' || m === 'CHECK') return 'CHEQUE';
          if (m === 'BANKTRANSFER' || m === 'BANK') return 'BANK_TRANSFER';
          return m;
        };

        let total = 0;
        let cash = 0;
        let momo = 0;
        let cheque = 0;
        let bank = 0;

        for (const p of rows) {
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

        // Build monthly chart — last 6 months
        const monthMap: Record<string, { In: number; Out: number }> = {};
        for (const p of rows) {
          const key = new Date(p.created_at).toLocaleDateString('en-GB', { month: 'short' });
          if (!monthMap[key]) monthMap[key] = { In: 0, Out: 0 };
          monthMap[key].In += p.amount || 0;
        }
        const last6: MonthlyFlow[] = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
          const k = d.toLocaleDateString('en-GB', { month: 'short' });
          return { name: k, In: Math.round((monthMap[k]?.In || 0) / 1000), Out: 0 };
        });
        setChartData(last6);
      } catch {
        setPayments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const WALLET_CARDS = [
    { name: 'Cash Payments', currency: 'GHS', balance: cashTotal, color: 'from-blue-700 to-indigo-800', sub: 'Cash receipts' },
    { name: 'Mobile Money', currency: 'GHS', balance: momoTotal, color: 'from-violet-700 to-purple-800', sub: 'MoMo receipts' },
    { name: 'Cheque Payments', currency: 'GHS', balance: chequeTotal, color: 'from-amber-600 to-orange-700', sub: 'Cheque receipts' },
    { name: 'Bank Transfer', currency: 'GHS', balance: bankTotal, color: 'from-cyan-700 to-blue-800', sub: 'Bank transfer receipts' },
  ];

  const [selected, setSelected] = useState(0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Company Wallets</h2>
        <p className="text-xs text-[var(--text-muted)]">All company accounts and balances</p>
      </div>

      {/* Total hero */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-emerald-700 rounded-2xl p-5 text-white shadow-[var(--box-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Total Portfolio Value</p>
        {loading ? (
          <div className="animate-pulse h-10 w-48 bg-white/20 rounded-xl mt-1" />
        ) : (
          <p className="text-4xl font-extrabold tracking-tight">GHS {totalIn.toLocaleString()}</p>
        )}
        <div className="flex items-center gap-1 mt-2 text-xs">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="opacity-80">{payments.length} payment records — from finance_payments</span>
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
              <p className="text-2xl font-extrabold text-white mt-1">{acct.currency} {acct.balance.toLocaleString()}</p>
            )}
            <p className="text-[10px] text-white/50 mt-3">{acct.sub}</p>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Money In vs Out — Last 6 Months</h3>
        {loading ? (
          <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ) : chartData.every(d => d.In === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Wallet className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No transaction data yet</p>
            <p className="text-xs text-gray-400 mt-1">Finance will record payments as orders are approved</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="200%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} unit="K" />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`GHS ${((Number(v) || 0) * 1000).toLocaleString()}`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="In"  fill="var(--accent)" radius={[4,4,0,0]} />
              <Bar dataKey="Out" fill="#ef4444"       radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Wallet Transactions</h3>
          <button onClick={() => setActiveSubTab?.('Transactions')} className="text-xs text-[var(--accent)] font-semibold hover:underline cursor-pointer">View All →</button>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">No transactions yet</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500">Finance records payments as orders are approved</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {payments.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--accent-light)] transition-colors cursor-pointer" onClick={() => setActiveSubTab?.('Transactions')}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{t.client_name || 'Payment'}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {t.payment_mode || 'CASH'}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-600">+ GHS {(t.amount || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
