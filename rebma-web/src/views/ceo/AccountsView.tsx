// src/views/ceo/AccountsView.tsx
import { TrendingUp, TrendingDown, CreditCard, DollarSign, Building2, Landmark } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ACCOUNTS = [
  { name: 'GHS Main Account', type: 'Checking',  balance: 2_847_300, lastActivity: 'Today',     trend: 12.4,  icon: DollarSign, color: '#10b981' },
  { name: 'USD Operations',   type: 'FX Account', balance: 184_200,   lastActivity: 'Yesterday', trend: 5.1,   icon: CreditCard, color: '#6366f1' },
  { name: 'EUR Reserve',      type: 'Savings',    balance: 42_600,    lastActivity: '3 days ago',trend: -1.2,  icon: Landmark,   color: '#8b5cf6' },
  { name: 'Petty Cash',       type: 'Cash',       balance: 8_400,     lastActivity: 'Today',     trend: 0,     icon: Building2,  color: '#f59e0b' },
];

const SPENDING = [
  { name: 'Payroll',   value: 35 },
  { name: 'Suppliers', value: 28 },
  { name: 'Logistics', value: 18 },
  { name: 'Admin',     value: 12 },
  { name: 'Other',     value: 7  },
];

const COLORS = ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6'];

const QUICK_ACTIONS = [
  { label: 'Send Money',     color: 'bg-[var(--accent)] text-white' },
  { label: 'Receive',        color: 'bg-[var(--accent-light)] text-[var(--accent)]' },
  { label: 'Pay Bill',       color: 'bg-[var(--accent-light)] text-[var(--accent)]' },
  { label: 'Create Invoice', color: 'bg-[var(--accent-light)] text-[var(--accent)]' },
];

export default function AccountsView() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Accounts Overview</h2>
        <p className="text-xs text-[var(--text-muted)]">All company financial accounts</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a, i) => (
          <button key={i} className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity ${a.color}`}>{a.label}</button>
        ))}
      </div>

      {/* Account cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ACCOUNTS.map((acct, i) => {
          const Icon = acct.icon;
          return (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)] cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: acct.color + '20' }}>
                  <Icon className="w-5 h-5" style={{ color: acct.color }} />
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">{acct.type}</span>
              </div>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{acct.name}</p>
              <p className="text-xl font-extrabold text-[var(--text-primary)] mt-1 leading-none">
                GHS {acct.balance.toLocaleString()}
              </p>
              <div className={`flex items-center gap-1 mt-2 text-[10px] font-semibold ${acct.trend > 0 ? 'text-emerald-600' : acct.trend < 0 ? 'text-rose-500' : 'text-[var(--text-muted)]'}`}>
                {acct.trend > 0 ? <TrendingUp className="w-3 h-3" /> : acct.trend < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {acct.trend !== 0 ? `${acct.trend > 0 ? '+' : ''}${acct.trend}%` : 'No change'}
              </div>
              <p className="text-[9px] text-[var(--text-muted)] mt-1">Last activity: {acct.lastActivity}</p>
            </div>
          );
        })}
      </div>

      {/* Spending breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Spending Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={SPENDING} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {SPENDING.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Account Summary</h3>
          <div className="space-y-3">
            {ACCOUNTS.map((acct, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: acct.color }} />
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{acct.name}</span>
                </div>
                <span className="text-xs font-bold text-[var(--text-primary)]">GHS {acct.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">Total</span>
              <span className="text-sm font-extrabold text-[var(--accent)]">
                GHS {ACCOUNTS.reduce((s, a) => s + a.balance, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
