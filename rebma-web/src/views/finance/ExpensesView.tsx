import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, Plus, MoreVertical, CheckCircle, XCircle, Clock, Upload, Camera } from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt: boolean;
  submittedBy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}


const CATEGORY_COLORS: Record<string, string> = {
  Rent: 'bg-blue-100 text-blue-700',
  Utilities: 'bg-yellow-100 text-yellow-700',
  Transport: 'bg-green-100 text-green-700',
  Maintenance: 'bg-orange-100 text-orange-700',
  Admin: 'bg-purple-100 text-purple-700',
  Other: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const CATEGORIES = ['Rent', 'Utilities', 'Transport', 'Maintenance', 'Admin', 'Other'];

export default function FinanceExpensesView({ addNotification, currentUser }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingExpenses(true);
      try {
        const { data } = await supabase.from('finance_expenses').select('*').order('created_at', { ascending: false });
        if (data) {
          setExpenses(data.map((e: any) => ({
            id: e.id,
            category: e.category || 'Other',
            description: e.description || '',
            amount: e.amount || 0,
            date: e.date || e.created_at?.split('T')[0] || '',
            receipt: e.receipt || false,
            submittedBy: e.submitted_by || e.submittedBy || '',
            status: e.status || 'Pending',
          } as Expense)));
        }
      } catch {
        // show empty state
      }
      setLoadingExpenses(false);
    };
    load();
  }, []);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ category: 'Rent', description: '', amount: '', date: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const filtered = expenses.filter(e => {
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'All' || e.category === catFilter;
    const matchStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const totalThisMonth = expenses.reduce((s, e) => s + e.amount, 0);
  const approved = expenses.filter(e => e.status === 'Approved').reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter(e => e.status === 'Pending').length;
  const budget = 50000;
  const remaining = Math.max(0, budget - approved);

  async function updateStatus(id: string, status: 'Approved' | 'Rejected') {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('finance_expenses').update({ status }).eq('id', id);
      if (error) throw error;
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      addNotification?.(`Expense ${status.toLowerCase()}`);
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Expense ${id} ${status}`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    } catch (e: any) {
      alert(e.message || 'Failed to update expense status.');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  }

  function openEditForm(e: Expense) {
    setEditExpense(e);
    setEditForm({
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      date: e.date,
      notes: ''
    });
    setShowEditForm(true);
    setMenuOpen(null);
  }

  async function updateExpense() {
    if (!editExpense || !editForm.description || !editForm.amount || submitting) return;
    setSubmitting(true);
    try {
      const updatedAmount = parseFloat(editForm.amount);
      const { error } = await supabase.from('finance_expenses')
        .update({
          category: editForm.category,
          description: editForm.description,
          amount: updatedAmount,
          date: editForm.date,
          notes: editForm.notes || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', editExpense.id);
      if (error) throw error;
      setExpenses(prev => prev.map(e => e.id === editExpense.id ? { ...e, category: editForm.category, description: editForm.description, amount: updatedAmount, date: editForm.date } : e));
      addNotification?.('Expense updated successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Expense ${editExpense.id} updated`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
      setShowEditForm(false);
      setEditExpense(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update expense.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpense(id: string) {
    if (submitting) return;
    if (!await window.confirm('Are you sure you want to delete this expense?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
      addNotification?.('Expense deleted successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Expense ${id} deleted`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  }

  async function logExpense() {
    if (!form.description || !form.amount || submitting) return;
    setSubmitting(true);
    try {
      const entry: Expense = { id: Date.now().toString(), category: form.category, description: form.description, amount: parseFloat(form.amount), date: form.date, receipt: false, submittedBy: currentUser?.fullName || 'Finance', status: 'Pending' };
      setExpenses(prev => [entry, ...prev]);
      const { error } = await supabase.from('finance_expenses').insert([{
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        date: form.date,
        notes: form.notes,
        submitted_by: currentUser?.fullName || 'Finance',
        status: 'Pending',
      }]);
      if (error) throw error;
      addNotification?.(`Expense logged: ${form.description} — GHS ${parseFloat(form.amount).toLocaleString()}`);
      setShowForm(false);
      setForm({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to log expense.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Expense Management</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track and approve company expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filtered.map(e => ({ ID: e.id, Category: e.category, Description: e.description, Amount: e.amount, Date: e.date, Status: e.status, By: e.submittedBy })), ['ID', 'Category', 'Description', 'Amount', 'Date', 'Status', 'By'], 'expenses')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><Download size={14} /> Export</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}><Plus size={14} /> Log Expense</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total This Month', value: totalThisMonth, prefix: 'GHS ', color: 'var(--accent)' },
          { label: 'Approved', value: approved, prefix: 'GHS ', color: '#10b981' },
          { label: 'Pending Approval', value: pending, prefix: '', color: '#f59e0b' },
          { label: 'Budget Remaining', value: remaining, prefix: 'GHS ', color: remaining < 5000 ? '#ef4444' : '#6366f1' },
        ].map(({ label, value, prefix, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}><CountUp value={value} prefix={prefix} /></p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none">
          {['All', ...CATEGORIES].map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none">
          {['All', 'Pending', 'Approved', 'Rejected'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loadingExpenses ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No expenses yet</p>
            <p className="text-sm mt-1">They will appear here once added</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">{['Category', 'Description', 'Amount', 'Date', 'Receipt', 'By', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-[var(--bg-input)] group">
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[e.category] || ''}`}>{e.category}</span></td>
                  <td className="px-4 py-3 text-[var(--text-primary)] max-w-[200px]"><p className="truncate">{e.description}</p></td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">GHS {e.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 text-center">{e.receipt ? <CheckCircle size={14} className="text-green-500 mx-auto" /> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap text-xs">{e.submittedBy}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[e.status]}`}>{e.status}</span></td>
                  <td className="px-4 py-3" onClick={ep => ep.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {e.status === 'Pending' && <>
                        <button onClick={() => updateStatus(e.id, 'Approved')} title="Approve"><CheckCircle size={14} className="text-green-500" /></button>
                        <button onClick={() => updateStatus(e.id, 'Rejected')} title="Reject"><XCircle size={14} className="text-red-500" /></button>
                      </>}
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === e.id ? null : e.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                        {menuOpen === e.id && (
                          <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]">
                            {e.status === 'Pending' && <>
                              <button onClick={() => updateStatus(e.id, 'Approved')} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Approve</button>
                              <button onClick={() => updateStatus(e.id, 'Rejected')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[var(--bg-input)]">Reject</button>
                            </>}
                            <button onClick={() => openEditForm(e)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Edit Expense</button>
                            <button onClick={() => deleteExpense(e.id)} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-[var(--bg-input)]">Delete Expense</button>
                            <button onClick={() => { window.print(); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export PDF</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">Log Expense</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount (GHS)</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Receipt Upload</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--border)]"><Upload size={14} /> Upload<input type="file" accept="image/*,.pdf" className="hidden" /></label>
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--border)]"><Camera size={14} /> Camera<input type="file" accept="image/*" capture="environment" className="hidden" /></label>
                </div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none" /></div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button disabled={submitting} onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">Cancel</button>
              <button disabled={submitting} onClick={logExpense} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'var(--accent)' }}>
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditForm && editExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEditForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">Edit Expense</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Category</label><select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Description</label><input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount (GHS)</label><input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Date</label><input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Notes (optional)</label><textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none" /></div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button disabled={submitting} onClick={() => setShowEditForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">Cancel</button>
              <button disabled={submitting} onClick={updateExpense} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'var(--accent)' }}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
