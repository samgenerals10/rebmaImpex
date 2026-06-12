// src/views/ceo/WalletsView.tsx
import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface WalletAccount { name: string; currency: string; balance: number; masked: string; trend: number; color: string; }

const ACCOUNTS: WalletAccount[] = [
  { name: 'GHS Main Account', currency: 'GHS', balance: 2_847_300, masked: '•••• •••• •••• 4890', trend: 12.4, color: 'from-emerald-600 to-teal-700' },
  { name: 'USD Operations',   currency: 'USD', balance: 184_200,   masked: '•••• •••• •••• 7712', trend: 5.1,  color: 'from-blue-700 to-indigo-800' },
  { name: 'EUR Reserve',      currency: 'EUR', balance: 42_600,    masked: '•••• •••• •••• 3305', trend: -1.2, color: 'from-violet-700 to-purple-800' },
];

const RECENT_TXN = Array.from({ length: 10 }, (_, i) => ({
  id: `W${i}`, date: new Date(Date.now() - i * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  desc: ['Payroll Disbursement','Invoice Payment','Supplier Transfer','Customer Receipt','Forex Exchange'][i % 5],
  amount: Math.round(2000 + Math.random() * 20000), type: i % 3 === 0 ? 'out' : 'in' as 'in'|'out',
}));

const CHART_DATA = Array.from({ length: 6 }, (_, i) => {
  const m = new Date(); m.setMonth(m.getMonth() - (5 - i));
  return { name: m.toLocaleDateString('en-GB', { month: 'short' }), In: Math.round(300 + Math.random() * 400), Out: Math.round(150 + Math.random() * 300) };
});

export default function WalletsView() {
  const [selected, setSelected] = useState(0);
  const total = ACCOUNTS.reduce((s, a) => s + (a.currency === 'GHS' ? a.balance : a.balance * (a.currency === 'USD' ? 15 : 17)), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Company Wallets</h2>
        <p className="text-xs text-[var(--text-muted)]">All company accounts and balances</p>
      </div>

      {/* Total hero */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-emerald-700 rounded-2xl p-5 text-white shadow-[var(--box-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Total Portfolio Value</p>
        <p className="text-4xl font-extrabold tracking-tight">GHS {total.toLocaleString()}</p>
        <div className="flex items-center gap-1 mt-2 text-xs">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="opacity-80">+8.4% all-time — {ACCOUNTS.length} active accounts</span>
        </div>
      </div>

      {/* Account cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ACCOUNTS.map((acct, i) => (
          <button key={i} onClick={() => setSelected(i)}
            className={`rounded-2xl p-5 text-left cursor-pointer transition-all bg-gradient-to-br ${acct.color} ${selected === i ? 'ring-2 ring-[var(--accent)] ring-offset-2 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest">{acct.name}</p>
            <p className="text-2xl font-extrabold text-white mt-1">{acct.currency} {acct.balance.toLocaleString()}</p>
            <p className="text-[10px] font-mono text-white/50 mt-3">{acct.masked}</p>
            <div className={`flex items-center gap-0.5 mt-1 text-[10px] font-semibold ${acct.trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              <TrendingUp className="w-3 h-3" /> {acct.trend > 0 ? '+' : ''}{acct.trend}%
            </div>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Money In vs Out — Last 6 Months</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} unit="K" />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="In"  fill="var(--accent)" radius={[4,4,0,0]} />
            <Bar dataKey="Out" fill="#ef4444"       radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent transactions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Wallet Transactions</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {RECENT_TXN.map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--accent-light)] transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'in' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                  {t.type === 'in' ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{t.desc}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{t.date}</p>
                </div>
              </div>
              <p className={`text-sm font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {t.type === 'in' ? '+' : '-'} GHS {t.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
