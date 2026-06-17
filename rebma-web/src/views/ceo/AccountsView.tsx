// src/views/ceo/AccountsView.tsx
import { useState, useEffect } from 'react';
import { Wallet, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

const COLORS = ['#10b981','#6366f1','#f59e0b','#ef4444','#8b5cf6'];

interface ExpenseSlice { name: string; value: number; }

interface AccountsViewProps {
  setActiveSubTab?: (tab: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Send Money',     color: 'bg-[var(--accent)] text-white' },
  { label: 'Receive',        color: 'bg-[var(--accent-light)] text-[var(--accent)]' },
  { label: 'Pay Bill',       color: 'bg-[var(--accent-light)] text-[var(--accent)]' },
  { label: 'Create Invoice', color: 'bg-[var(--accent-light)] text-[var(--accent)]' },
];

export default function AccountsView({ setActiveSubTab }: AccountsViewProps) {
  const [spending, setSpending] = useState<ExpenseSlice[]>([]);
  const [loadingSpending, setLoadingSpending] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('finance_expenses')
          .select('category, amount');
        if (data && data.length > 0) {
          const map: Record<string, number> = {};
          for (const row of data as { category: string; amount: number }[]) {
            const cat = row.category || 'Other';
            map[cat] = (map[cat] || 0) + (row.amount || 0);
          }
          setSpending(Object.entries(map).map(([name, value]) => ({ name, value })));
        }
      } catch {
        setSpending([]);
      } finally {
        setLoadingSpending(false);
      }
    })();
  }, []);

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

      {/* Account balances — managed by Finance */}
      <div className="flex flex-col items-center justify-center py-12 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <Wallet className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">No account data yet</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">Finance will update account balances</p>
        <button
          onClick={() => setActiveSubTab?.('Wallets')}
          className="mt-4 px-4 py-2 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
        >
          View Wallets →
        </button>
      </div>

      {/* Spending breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Spending Breakdown</h3>
          {loadingSpending ? (
            <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : spending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <PieIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No expense data yet</p>
              <p className="text-xs text-gray-400 mt-1">Finance will record expenses as they occur</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={spending} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {spending.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Expense Categories</h3>
          {loadingSpending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse h-8 bg-slate-100 dark:bg-slate-800 rounded" />)}
            </div>
          ) : spending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-gray-400">No expense categories recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {spending.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{s.name}</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">GHS {s.value.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">Total</span>
                <span className="text-sm font-extrabold text-[var(--accent)]">
                  GHS {spending.reduce((s, a) => s + a.value, 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
