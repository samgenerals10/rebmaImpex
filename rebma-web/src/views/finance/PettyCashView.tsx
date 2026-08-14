import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, Plus, Upload, Camera, AlertTriangle, MoreVertical } from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

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

const INITIAL_FLOAT = 0;

const CATEGORIES = ['Admin', 'Transport', 'Maintenance', 'Utilities', 'Other'];

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const mapPettyCash = (e: any): PettyCashEntry => ({
  id: e.id,
  date: e.date || e.created_at?.split('T')[0] || '',
  description: e.description || '',
  amount: e.amount || 0,
  disbursedTo: e.disbursed_to || e.disbursedTo || '',
  category: e.category || 'Other',
  receipt: e.receipt || false,
  balanceAfter: e.balance_after || e.balanceAfter || 0,
  type: e.type || 'disbursement'
});

export default function FinancePettyCashView({ addNotification, currentUser }: Props) {
  const { rows: entries, setRows: setEntries, loading, hasMore, total, loadMore } = usePaginatedQuery<PettyCashEntry>({
    table: 'finance_petty_cash',
    pageSize: 100,
    map: mapPettyCash,
  });
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<PettyCashEntry | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ amount: '', description: '', disbursedTo: '', category: 'Admin', notes: '' });
  const [showDisbForm, setShowDisbForm] = useState(false);
  const [showReplenForm, setShowReplenForm] = useState(false);
  const [form, setForm] = useState({ amount: '', description: '', disbursedTo: '', category: 'Admin', notes: '' });
  const [replenForm, setReplenForm] = useState({ amount: '', reason: '' });

  const currentFloat = entries.length > 0 ? entries[0].balanceAfter : INITIAL_FLOAT;
  const totalDisbursed = entries.filter(e => e.type === 'disbursement').reduce((s, e) => s + e.amount, 0);
  const LOW_THRESHOLD = 3000;

  const filtered = entries.filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.disbursedTo.toLowerCase().includes(search.toLowerCase()));

  const [submitting, setSubmitting] = useState(false);

  function openEditForm(e: PettyCashEntry) {
    setEditEntry(e);
    setEditForm({
      amount: String(e.amount),
      description: e.description,
      disbursedTo: e.disbursedTo,
      category: e.category,
      notes: ''
    });
    setShowEditForm(true);
    setMenuOpen(null);
  }

  async function updateEntry() {
    if (!editEntry || !editForm.amount || !editForm.description || !editForm.disbursedTo) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const updatedAmount = parseFloat(editForm.amount) || 0;
      const diff = updatedAmount - editEntry.amount;
      const updatedBalance = editEntry.balanceAfter - diff;
      const { error } = await supabase.from('finance_petty_cash')
        .update({
          amount: updatedAmount,
          description: editForm.description,
          disbursed_to: editForm.disbursedTo,
          category: editForm.category,
          balance_after: updatedBalance,
          notes: editForm.notes || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', editEntry.id);
      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === editEntry.id ? { ...e, amount: updatedAmount, description: editForm.description, disbursedTo: editForm.disbursedTo, category: editForm.category, balanceAfter: updatedBalance } : e));
      addNotification?.('Petty cash entry updated successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Petty cash ${editEntry.id} updated`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
      setShowEditForm(false);
      setEditEntry(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update entry.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEntry(id: string) {
    if (submitting) return;
    if (!await window.confirm('Are you sure you want to delete this entry?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('finance_petty_cash').delete().eq('id', id);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
      addNotification?.('Entry deleted successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Petty cash ${id} deleted`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry.');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  }

  async function disburse() {
    if (!form.amount || !form.description || !form.disbursedTo) return;
    if (submitting) return;
    const amount = parseFloat(form.amount);
    if (amount > currentFloat) { addNotification?.('Insufficient float balance'); return; }
    setSubmitting(true);
    try {
      // Atomic server-side function — computes the new balance and inserts
      // in one step, so two concurrent disbursements can't both read the
      // same starting float (see supabase_atomic_functions.sql).
      const { data: newRow, error } = await supabase.rpc('disburse_petty_cash', {
        p_amount: amount,
        p_description: form.description,
        p_disbursed_to: form.disbursedTo,
        p_category: form.category,
        p_notes: form.notes || null,
      });
      if (error) throw error;

      const entry: PettyCashEntry = { id: newRow.id, date: (newRow.timestamp || newRow.created_at || '').slice(0, 10), description: form.description, amount, disbursedTo: form.disbursedTo, category: form.category, receipt: false, balanceAfter: newRow.balance_after, type: 'disbursement' };
      setEntries(prev => [entry, ...prev]);
      addNotification?.(`Petty cash disbursed: GHS ${amount.toLocaleString()} to ${form.disbursedTo}`);
      setShowDisbForm(false);
      setForm({ amount: '', description: '', disbursedTo: '', category: 'Admin', notes: '' });
    } catch (e: any) {
      alert(e.message || 'Failed to disburse petty cash.');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestReplenishment() {
    if (!replenForm.amount || !replenForm.reason) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('float_requests').insert([{
        department: 'FINANCE',
        requested_by: currentUser?.fullName || 'Finance',
        amount: parseFloat(replenForm.amount),
        reason: replenForm.reason,
        status: 'PENDING_MANAGEMENT',
      }]);
      if (error) throw error;
      await supabase.from('supplier_order_notifications').insert([{ message: `Petty cash replenishment request: GHS ${replenForm.amount} needed. Reason: ${replenForm.reason}`, notified_department: 'MANAGEMENT', read: false }]);
      addNotification?.(`Replenishment request sent to Management: GHS ${replenForm.amount}`);
      setShowReplenForm(false);
      setReplenForm({ amount: '', reason: '' });
    } catch (e: any) {
      alert(e.message || 'Failed to request replenishment.');
    } finally {
      setSubmitting(false);
    }
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
          <p className="text-3xl font-bold">GHS <CountUp value={currentFloat} /></p>
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
          <p className="text-2xl font-bold text-[var(--text-primary)]">GHS <CountUp value={totalDisbursed} /></p>
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
        <ResponsiveDataView
          columns={[
            { key: 'description', label: 'Description', primary: true },
            { key: 'type', label: 'Type', status: true, render: e => <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.type === 'replenishment' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{e.type}</span> },
            { key: 'amount', label: 'Amount', render: e => <span className={`font-semibold ${e.type === 'replenishment' ? 'text-green-500' : 'text-red-500'}`}>{e.type === 'replenishment' ? '+' : '-'}GHS {e.amount.toLocaleString()}</span> },
            { key: 'date', label: 'Date' },
            { key: 'disbursedTo', label: 'Disbursed To' },
            { key: 'category', label: 'Category', render: e => <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">{e.category}</span> },
            { key: 'receipt', label: 'Receipt', render: e => e.receipt ? '✅' : '—' },
            { key: 'balanceAfter', label: 'Balance After', render: e => `GHS ${e.balanceAfter.toLocaleString()}` },
          ] as DataColumn<typeof entries[number]>[]}
          data={filtered}
          rowKey={e => e.id}
          loading={loading}
          emptyIcon={<AlertTriangle size={20} className="opacity-60" />}
          emptyTitle="No petty cash entries found"
          renderActions={e => (
            <div className="relative">
              <button onClick={() => setMenuOpen(menuOpen === e.id ? null : e.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
              {menuOpen === e.id && (
                <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]">
                  <button onClick={() => openEditForm(e)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Edit Entry</button>
                  <button onClick={() => deleteEntry(e.id)} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-[var(--bg-input)]">Delete Entry</button>
                </div>
              )}
            </div>
          )}
        />
        {!loading && entries.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            <span>Showing {entries.length}{typeof total === 'number' ? ` of ${total.toLocaleString()}` : ''}</span>
            {hasMore && (
              <button onClick={loadMore} className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:opacity-90 font-medium">Load more</button>
            )}
          </div>
        )}
      </div>

      <SidePanel
        open={showDisbForm}
        onClose={() => setShowDisbForm(false)}
        title="Record Disbursement"
        subtitle={`Available float: GHS ${currentFloat.toLocaleString()}`}
        footer={
          <>
            <button onClick={() => setShowDisbForm(false)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={disburse} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">{submitting ? 'Saving...' : 'Save Disbursement'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-form-group">
              <label className="erp-label">Amount (GHS)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="erp-input" />
            </div>
            <div className="erp-form-group">
              <label className="erp-label">Category</label>
              <SearchableDropdown value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            </div>
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="erp-input" />
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Disbursed To</label>
            <input value={form.disbursedTo} onChange={e => setForm(f => ({ ...f, disbursedTo: e.target.value }))} className="erp-input" />
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Receipt</label>
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs cursor-pointer"><Upload size={12} /> Upload<input type="file" accept="image/*,.pdf" className="hidden" /></label>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs cursor-pointer"><Camera size={12} /> Camera<input type="file" accept="image/*" capture="environment" className="hidden" /></label>
            </div>
          </div>
        </div>
      </SidePanel>

      <SidePanel
        open={showReplenForm}
        onClose={() => setShowReplenForm(false)}
        title="Request Replenishment"
        footer={
          <>
            <button onClick={() => setShowReplenForm(false)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={requestReplenishment} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">{submitting ? 'Sending...' : 'Send Request'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="erp-form-group">
            <label className="erp-label">Amount Needed (GHS)</label>
            <input type="number" value={replenForm.amount} onChange={e => setReplenForm(f => ({ ...f, amount: e.target.value }))} className="erp-input" />
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Reason</label>
            <textarea value={replenForm.reason} onChange={e => setReplenForm(f => ({ ...f, reason: e.target.value }))} rows={3} className="erp-input resize-none" />
          </div>
        </div>
      </SidePanel>

      <SidePanel
        open={showEditForm && !!editEntry}
        onClose={() => setShowEditForm(false)}
        title="Edit Petty Cash Entry"
        footer={
          <>
            <button onClick={() => setShowEditForm(false)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={updateEntry} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-form-group">
              <label className="erp-label">Amount (GHS)</label>
              <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="erp-input" />
            </div>
            <div className="erp-form-group">
              <label className="erp-label">Category</label>
              <SearchableDropdown value={editForm.category} onChange={v => setEditForm(f => ({ ...f, category: v }))} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            </div>
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Description</label>
            <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="erp-input" />
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Disbursed To</label>
            <input value={editForm.disbursedTo} onChange={e => setEditForm(f => ({ ...f, disbursedTo: e.target.value }))} className="erp-input" />
          </div>
          <div className="erp-form-group">
            <label className="erp-label">Notes (optional)</label>
            <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="erp-input resize-none" />
          </div>
        </div>
      </SidePanel>
    </div>
  );
}
