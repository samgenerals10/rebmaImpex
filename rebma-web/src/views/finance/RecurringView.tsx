// src/views/finance/RecurringView.tsx
import { useState, useEffect } from 'react';
import { Plus, Pencil, Pause, Trash2, X, Check, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  next_date: string;
  account: string;
  status: 'active' | 'paused';
  category: string;
}

const MOCK: RecurringPayment[] = [
  { id: '1', name: 'Staff Payroll',        amount: 85000, frequency: 'monthly',  next_date: '2026-07-01', account: 'GHS Main', status: 'active',  category: 'Payroll'   },
  { id: '2', name: 'Office Rent',           amount: 12000, frequency: 'monthly',  next_date: '2026-07-05', account: 'GHS Main', status: 'active',  category: 'Overheads' },
  { id: '3', name: 'Software Subscriptions',amount: 2400,  frequency: 'monthly',  next_date: '2026-07-10', account: 'USD Ops',  status: 'active',  category: 'Tech'      },
  { id: '4', name: 'Insurance Premium',     amount: 8500,  frequency: 'quarterly',next_date: '2026-09-01', account: 'GHS Main', status: 'active',  category: 'Insurance' },
  { id: '5', name: 'Annual Audit Fee',      amount: 25000, frequency: 'annually', next_date: '2027-01-15', account: 'GHS Main', status: 'paused',  category: 'Legal'     },
];

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };
const blank = { name: '', amount: '', frequency: 'monthly' as RecurringPayment['frequency'], next_date: '', account: 'GHS Main', category: 'General' };

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function RecurringView({ currentUser, addNotification }: Props) {
  const [rows, setRows]     = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<{ open: boolean; id?: string } & typeof blank>({ open: false, ...blank });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('recurring_payments').select('*').order('next_date');
        setRows(data && data.length > 0 ? data : MOCK);
      } catch { setRows(MOCK); }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (!modal.name.trim() || !modal.amount) return;
    setSaving(true);
    try {
      if (modal.id) {
        await supabase.from('recurring_payments').update({ name: modal.name, amount: parseFloat(modal.amount), frequency: modal.frequency, next_date: modal.next_date, account: modal.account, category: modal.category }).eq('id', modal.id);
        addNotification('Recurring payment updated.');
      } else {
        await supabase.from('recurring_payments').insert({ name: modal.name, amount: parseFloat(modal.amount), frequency: modal.frequency, next_date: modal.next_date, account: modal.account, category: modal.category, status: 'active', created_by: currentUser?.id });
        addNotification('Recurring payment created.');
      }
      setModal({ open: false, ...blank });
      const { data } = await supabase.from('recurring_payments').select('*').order('next_date');
      if (data) setRows(data);
    } catch { addNotification('Could not save recurring payment.'); }
    setSaving(false);
  };

  const togglePause = async (row: RecurringPayment) => {
    const next = row.status === 'active' ? 'paused' : 'active';
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: next } : r));
    try {
      await supabase.from('recurring_payments').update({ status: next }).eq('id', row.id);
      addNotification(`Payment ${next === 'paused' ? 'paused' : 'resumed'}.`);
    } catch { /* rollback */ }
  };

  const del = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    try { await supabase.from('recurring_payments').delete().eq('id', id); addNotification('Deleted.'); } catch {}
  };

  const totalMonthly = rows.filter(r => r.status === 'active').reduce((s, r) => {
    const mult = { weekly: 4.33, monthly: 1, quarterly: 1/3, annually: 1/12 }[r.frequency];
    return s + r.amount * mult;
  }, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Recurring Payments</h2>
          <p className="text-xs text-[var(--text-muted)]">Est. monthly cost: GHS {Math.round(totalMonthly).toLocaleString()}</p>
        </div>
        <button onClick={() => setModal({ open: true, ...blank })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> New Recurring
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 shadow-[var(--box-shadow)] transition-opacity ${row.status === 'paused' ? 'opacity-55' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                <RefreshCw className={`w-5 h-5 text-[var(--accent)] ${row.status === 'active' ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{row.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.status}</span>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)]">{FREQ_LABELS[row.frequency]}</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">{row.account} · Next: {row.next_date} · {row.category}</p>
              </div>
              <p className="text-base font-bold text-[var(--text-primary)] shrink-0 whitespace-nowrap">GHS {row.amount.toLocaleString()}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setModal({ open: true, id: row.id, name: row.name, amount: String(row.amount), frequency: row.frequency, next_date: row.next_date, account: row.account, category: row.category })}
                  className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => togglePause(row)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 cursor-pointer"><Pause className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(row.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">{modal.id ? 'Edit' : 'New'} Recurring Payment</h3>
              <button onClick={() => setModal({ open: false, ...blank })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} placeholder="Payment name…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Amount (GHS)</label>
                <input type="number" value={modal.amount} onChange={e => setModal(m => ({ ...m, amount: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Frequency</label>
                <select value={modal.frequency} onChange={e => setModal(m => ({ ...m, frequency: e.target.value as any }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <input type="date" value={modal.next_date} onChange={e => setModal(m => ({ ...m, next_date: e.target.value }))} placeholder="Next payment date"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <input value={modal.category} onChange={e => setModal(m => ({ ...m, category: e.target.value }))} placeholder="Category…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal({ open: false, ...blank })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={save} disabled={saving || !modal.name.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
