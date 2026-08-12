// src/views/finance/RecurringView.tsx
import { useState, useEffect } from 'react';
import { Plus, Pencil, Pause, Trash2, Check, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';

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
        setRows(data ?? []);
      } catch { setRows([]); }
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
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No recurring payments found</p>
        </div>
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

      <SidePanel
        open={modal.open}
        onClose={() => setModal({ open: false, ...blank })}
        title={`${modal.id ? 'Edit' : 'New'} Recurring Payment`}
        footer={
          <>
            <button onClick={() => setModal({ open: false, ...blank })} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={save} disabled={saving || !modal.name.trim()} className="erp-btn erp-btn-primary disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="erp-form-group">
            <label className="erp-label">Payment Name</label>
            <input value={modal.name} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} placeholder="Payment name…" className="erp-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-form-group">
              <label className="erp-label">Amount (GHS)</label>
              <input type="number" value={modal.amount} onChange={e => setModal(m => ({ ...m, amount: e.target.value }))} className="erp-input" />
            </div>
            <div className="erp-form-group">
              <label className="erp-label">Frequency</label>
              <SearchableDropdown value={modal.frequency} onChange={v => setModal(m => ({ ...m, frequency: v as any }))} options={Object.entries(FREQ_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </div>
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Next Payment Date</label>
            <input type="date" value={modal.next_date} onChange={e => setModal(m => ({ ...m, next_date: e.target.value }))} className="erp-input" />
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Category</label>
            <input value={modal.category} onChange={e => setModal(m => ({ ...m, category: e.target.value }))} placeholder="Category…" className="erp-input" />
          </div>
        </div>
      </SidePanel>
    </div>
  );
}
