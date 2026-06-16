import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, Plus, Upload, Camera, AlertTriangle } from 'lucide-react';
import { exportToCSV } from '../../utils/export';

interface PettyCashEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  disbursedTo: string;
  category: string;
  receipt: boolean;
  balanceAfter: number;
  type: 'disbursement' | 'replenishment';
}

const INITIAL_FLOAT = 15000;

const CATEGORIES = ['Admin', 'Transport', 'Maintenance', 'Utilities', 'Other'];

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinancePettyCashView({ addNotification, currentUser }: Props) {
  const [entries, setEntries] = useState<PettyCashEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('finance_petty_cash')
          .select('*')
          .order('created_at', { ascending: false });
        setEntries((data ?? []) as PettyCashEntry[]);
      } catch {
        setEntries([]);
      }
      setLoading(false);
    };
    load();
  }, []);
  const [search, setSearch] = useState('');
  const [showDisbForm, setShowDisbForm] = useState(false);
  const [showReplenForm, setShowReplenForm] = useState(false);
  const [form, setForm] = useState({ amount: '', description: '', disbursedTo: '', category: 'Admin', notes: '' });
  const [replenForm, setReplenForm] = useState({ amount: '', reason: '' });

  const currentFloat = entries.length > 0 ? entries[0].balanceAfter : INITIAL_FLOAT;
  const totalDisbursed = entries.filter(e => e.type === 'disbursement').reduce((s, e) => s + e.amount, 0);
  const LOW_THRESHOLD = 3000;

  const filtered = entries.filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.disbursedTo.toLowerCase().includes(search.toLowerCase()));

  function disburse() {
    if (!form.amount || !form.description || !form.disbursedTo) return;
    const amount = parseFloat(form.amount);
    if (amount > currentFloat) { addNotification?.('Insufficient float balance'); return; }
    const newBalance = currentFloat - amount;
    const entry: PettyCashEntry = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), description: form.description, amount, disbursedTo: form.disbursedTo, category: form.category, receipt: false, balanceAfter: newBalance, type: 'disbursement' };
    setEntries(prev => [entry, ...prev]);
    supabase.from('finance_petty_cash').insert([{ ...form, amount, balance_after: newBalance, type: 'disbursement', recorded_by: currentUser?.fullName || 'Finance', created_at: new Date().toISOString() }]).then(() => {}, () => {});
    addNotification?.(`Petty cash disbursed: GHS ${amount.toLocaleString()} to ${form.disbursedTo}`);
    setShowDisbForm(false);
    setForm({ amount: '', description: '', disbursedTo: '', category: 'Admin', notes: '' });
  }

  function requestReplenishment() {
    if (!replenForm.amount || !replenForm.reason) return;
    supabase.from('supplier_order_notifications').insert([{ order_id: 'petty_cash', message: `Petty cash replenishment request: GHS ${replenForm.amount} needed. Reason: ${replenForm.reason}`, notified_department: 'MANAGEMENT', read: false }]).then(() => {}, () => {});
    addNotification?.(`Replenishment request sent to Management: GHS ${replenForm.amount}`);
    setShowReplenForm(false);
    setReplenForm({ amount: '', reason: '' });
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Petty Cash Management</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track petty cash float and disbursements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filtered.map(e => ({ Date: e.date, Description: e.description, Amount: e.amount, To: e.disbursedTo, Category: e.category, Balance: e.balanceAfter, Type: e.type })), ['Date', 'Description', 'Amount', 'To', 'Category', 'Balance', 'Type'], 'petty_cash')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><Download size={14} /> Export</button>
          <button onClick={() => setShowDisbForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}><Plus size={14} /> Disbursement</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-2xl p-5 text-white ${currentFloat < LOW_THRESHOLD ? 'bg-red-500' : ''}`} style={currentFloat >= LOW_THRESHOLD ? { background: 'linear-gradient(135deg, var(--accent)CC, var(--accent))' } : {}}>
          <p className="text-xs text-white/70 mb-1">Current Float</p>
          <p className="text-3xl font-bold">GHS {currentFloat.toLocaleString()}</p>
          {currentFloat < LOW_THRESHOLD && (
            <div className="flex items-center gap-1.5 mt-2">
              <AlertTriangle size={12} /><span className="text-xs">Low float — replenishment needed</span>
            </div>
          )}
          {currentFloat < LOW_THRESHOLD && (
            <button onClick={() => setShowReplenForm(true)} className="mt-3 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-medium hover:bg-white/30">Request Replenishment</button>
          )}
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <p className="text-xs text-[var(--text-muted)] mb-1">Total Disbursed This Month</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">GHS {totalDisbursed.toLocaleString()}</p>
        </div>
        {currentFloat >= LOW_THRESHOLD && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex items-end">
            <button onClick={() => setShowReplenForm(true)} className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">+ Request Replenishment</button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6">{[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
            <AlertTriangle size={32} className="opacity-30 mb-2" />
            <p className="text-sm">No petty cash entries found</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">{['Date', 'Description', 'Amount', 'Disbursed To', 'Category', 'Receipt', 'Balance After', 'Type'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(e => (
                <tr key={e.id} className={`hover:bg-[var(--bg-input)] ${e.type === 'replenishment' ? 'bg-green-50/30' : ''}`}>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{e.description}</td>
                  <td className={`px-4 py-3 font-semibold ${e.type === 'replenishment' ? 'text-green-500' : 'text-red-500'}`}>{e.type === 'replenishment' ? '+' : '-'}GHS {e.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{e.disbursedTo}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">{e.category}</span></td>
                  <td className="px-4 py-3 text-center">{e.receipt ? '✅' : '—'}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">GHS {e.balanceAfter.toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.type === 'replenishment' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{e.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {showDisbForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDisbForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">Record Disbursement</h3>
            <p className="text-xs text-[var(--text-muted)] mb-5">Available float: <strong className="text-[var(--text-primary)]">GHS {currentFloat.toLocaleString()}</strong></p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount (GHS)</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Disbursed To</label><input value={form.disbursedTo} onChange={e => setForm(f => ({ ...f, disbursedTo: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Receipt</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs cursor-pointer"><Upload size={12} /> Upload<input type="file" accept="image/*,.pdf" className="hidden" /></label>
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs cursor-pointer"><Camera size={12} /> Camera<input type="file" accept="image/*" capture="environment" className="hidden" /></label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowDisbForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={disburse} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}>Save Disbursement</button>
            </div>
          </div>
        </div>
      )}

      {showReplenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowReplenForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Request Replenishment</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount Needed (GHS)</label><input type="number" value={replenForm.amount} onChange={e => setReplenForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Reason</label><textarea value={replenForm.reason} onChange={e => setReplenForm(f => ({ ...f, reason: e.target.value }))} rows={3} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none" /></div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-4">
              <button onClick={() => setShowReplenForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={requestReplenishment} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}>Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
