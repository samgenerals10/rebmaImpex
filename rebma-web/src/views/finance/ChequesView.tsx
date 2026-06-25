import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, MoreVertical, Plus, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';

interface Cheque {
  id: string;
  chequeNumber: string;
  bankName: string;
  accountName: string;
  amount: number;
  chequeDate: string;
  expectedClearing: string;
  status: 'Received' | 'Deposited' | 'Cleared' | 'Bounced';
  customerRef: string;
  orderRef: string;
}


const STATUS_COLORS: Record<string, string> = {
  Received: 'bg-blue-100 text-blue-700',
  Deposited: 'bg-yellow-100 text-yellow-700',
  Cleared: 'bg-green-100 text-green-700',
  Bounced: 'bg-red-100 text-red-700',
};

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinanceChequesView({ addNotification, currentUser }: Props) {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('finance_cheques')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) {
          setCheques(data.map((c: any) => ({
            id: c.id,
            chequeNumber: c.cheque_number || c.chequeNumber || '',
            bankName: c.bank_name || c.bankName || '',
            accountName: c.account_name || c.accountName || '',
            amount: c.amount || 0,
            chequeDate: c.cheque_date || c.chequeDate || '',
            expectedClearing: c.expected_clearing || c.expectedClearing || '',
            status: c.status || 'Received',
            customerRef: c.customer_ref || c.customerRef || '',
            orderRef: c.order_ref || c.orderRef || ''
          } as Cheque)));
        }
      } catch {
        setCheques([]);
      }
      setLoading(false);
    };
    load();
  }, []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ chequeNumber: '', bankName: '', accountName: '', accountNumber: '', amount: '', chequeDate: '', expectedClearing: '', orderRef: '' });
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const [editCheque, setEditCheque] = useState<Cheque | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ chequeNumber: '', bankName: '', accountName: '', accountNumber: '', amount: '', chequeDate: '', expectedClearing: '', orderRef: '' });

  const filtered = cheques.filter(c => {
    const matchSearch = !search || c.chequeNumber.toLowerCase().includes(search.toLowerCase()) || c.accountName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function updateStatus(id: string, status: Cheque['status']) {
    setCheques(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    const cheque = cheques.find(c => c.id === id);
    if (status === 'Bounced' && cheque) {
      supabase.from('supplier_order_notifications').insert([
        { order_id: cheque.orderRef, message: `⚠️ CHEQUE BOUNCED: Cheque #${cheque.chequeNumber} from ${cheque.accountName} for GHS ${cheque.amount.toLocaleString()} has bounced. Immediate action required.`, notified_department: 'MANAGEMENT', read: false },
        { order_id: cheque.orderRef, message: `⚠️ CHEQUE BOUNCED: Cheque #${cheque.chequeNumber} from ${cheque.accountName} for GHS ${cheque.amount.toLocaleString()} has bounced. Immediate action required.`, notified_department: 'CEO', read: false },
      ]).then(() => {}, () => {});
      addNotification?.(`⚠️ Cheque #${cheque.chequeNumber} marked as BOUNCED. Management and CEO notified.`);
    } else {
      addNotification?.(`Cheque #${cheques.find(c => c.id === id)?.chequeNumber} marked as ${status}`);
    }
    supabase.from('finance_cheques').update({ status }).eq('id', id).then(() => {}, () => {});
    supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Cheque ${id} status updated to ${status}`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]).then(() => {}, () => {});
    setMenuOpen(null);
  }

  function openEditForm(c: Cheque) {
    setEditCheque(c);
    setEditForm({
      chequeNumber: c.chequeNumber,
      bankName: c.bankName,
      accountName: c.accountName,
      accountNumber: '',
      amount: String(c.amount),
      chequeDate: c.chequeDate,
      expectedClearing: c.expectedClearing,
      orderRef: c.orderRef
    });
    setShowEditForm(true);
    setMenuOpen(null);
  }

  async function updateCheque() {
    if (!editCheque || !editForm.chequeNumber || !editForm.bankName || !editForm.accountName) return;
    try {
      const updatedAmount = parseFloat(editForm.amount) || 0;
      const { error } = await supabase.from('finance_cheques')
        .update({
          cheque_number: editForm.chequeNumber,
          bank_name: editForm.bankName,
          account_name: editForm.accountName,
          account_number: editForm.accountNumber || undefined,
          amount: updatedAmount,
          cheque_date: editForm.chequeDate,
          expected_clearing: editForm.expectedClearing,
          order_ref: editForm.orderRef,
          updated_at: new Date().toISOString()
        })
        .eq('id', editCheque.id);
      if (error) throw error;
      setCheques(prev => prev.map(c => c.id === editCheque.id ? { ...c, chequeNumber: editForm.chequeNumber, bankName: editForm.bankName, accountName: editForm.accountName, amount: updatedAmount, chequeDate: editForm.chequeDate, expectedClearing: editForm.expectedClearing, orderRef: editForm.orderRef } : c));
      addNotification?.('Cheque updated successfully.');
      supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Cheque ${editCheque.id} updated`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]).then(() => {}, () => {});
    } catch (err: any) {
      alert(err.message || 'Failed to update cheque.');
    }
    setShowEditForm(false);
    setEditCheque(null);
  }

  async function deleteCheque(id: string) {
    if (!window.confirm('Are you sure you want to delete this cheque?')) return;
    try {
      const { error } = await supabase.from('finance_cheques').delete().eq('id', id);
      if (error) throw error;
      setCheques(prev => prev.filter(c => c.id !== id));
      addNotification?.('Cheque deleted successfully.');
      supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Cheque ${id} deleted`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]).then(() => {}, () => {});
    } catch (err: any) {
      alert(err.message || 'Failed to delete cheque.');
    }
    setMenuOpen(null);
  }

  function addCheque() {
    const entry: Cheque = { id: Date.now().toString(), chequeNumber: form.chequeNumber, bankName: form.bankName, accountName: form.accountName, amount: parseFloat(form.amount) || 0, chequeDate: form.chequeDate, expectedClearing: form.expectedClearing, status: 'Received', customerRef: form.accountName, orderRef: form.orderRef };
    setCheques(prev => [entry, ...prev]);
    supabase.from('finance_cheques').insert([{
      cheque_number: form.chequeNumber,
      bank_name: form.bankName,
      account_name: form.accountName,
      account_number: form.accountNumber,
      amount: parseFloat(form.amount) || 0,
      cheque_date: form.chequeDate,
      expected_clearing: form.expectedClearing,
      customer_ref: form.accountName,
      order_ref: form.orderRef,
      status: 'Received',
      recorded_by: currentUser?.fullName || 'Finance',
      timestamp: new Date().toISOString()
    }]).then(() => {}, () => {});
    addNotification?.(`Cheque #${form.chequeNumber} added to register`);
    setShowForm(false);
    setForm({ chequeNumber: '', bankName: '', accountName: '', accountNumber: '', amount: '', chequeDate: '', expectedClearing: '', orderRef: '' });
  }

  const totals = { total: cheques.length, cleared: cheques.filter(c => c.status === 'Cleared').length, pending: cheques.filter(c => ['Received', 'Deposited'].includes(c.status)).length, bounced: cheques.filter(c => c.status === 'Bounced').length };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cheque Register</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track all received cheques and clearance status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filtered.map(c => ({ Cheque: c.chequeNumber, Bank: c.bankName, Account: c.accountName, Amount: c.amount, Date: c.chequeDate, Clearing: c.expectedClearing, Status: c.status })), ['Cheque', 'Bank', 'Account', 'Amount', 'Date', 'Clearing', 'Status'], 'cheque_register')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><Download size={14} /> Export</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}><Plus size={14} /> Add Cheque</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Received', value: totals.total, color: 'var(--accent)', Icon: CheckCircle },
          { label: 'Cleared', value: totals.cleared, color: '#10b981', Icon: CheckCircle },
          { label: 'Pending Clearance', value: totals.pending, color: '#f59e0b', Icon: Clock },
          { label: 'Bounced', value: totals.bounced, color: '#ef4444', Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}><Icon size={18} style={{ color }} /></div>
            <div><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="text-xl font-bold text-[var(--text-primary)]">{value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by cheque number or account..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none">
          {['All', 'Received', 'Deposited', 'Cleared', 'Bounced'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6">{[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
            <CheckCircle size={32} className="opacity-30 mb-2" />
            <p className="text-sm">No cheques found</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">{['Cheque #', 'Bank', 'Account Name', 'Amount', 'Date', 'Expected Clearing', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[var(--bg-input)] group cursor-pointer" onClick={() => setSelectedCheque(c)}>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{c.chequeNumber}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{c.bankName}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{c.accountName}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">GHS {c.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{c.chequeDate}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{c.expectedClearing}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                      {menuOpen === c.id && (
                        <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px]">
                          {c.status !== 'Cleared' && <button onClick={() => updateStatus(c.id, 'Cleared')} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Mark Cleared</button>}
                          {c.status !== 'Bounced' && <button onClick={() => updateStatus(c.id, 'Bounced')} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[var(--bg-input)]">Mark Bounced</button>}
                          {c.status === 'Received' && <button onClick={() => updateStatus(c.id, 'Deposited')} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Mark Deposited</button>}
                          <button onClick={() => openEditForm(c)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Edit Cheque</button>
                          <button onClick={() => deleteCheque(c.id)} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-[var(--bg-input)]">Delete Cheque</button>
                          <button onClick={() => { window.print(); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export PDF</button>
                        </div>
                      )}
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
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">Add New Cheque</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Cheque Number', key: 'chequeNumber' }, { label: 'Bank Name', key: 'bankName' },
                { label: 'Account Name', key: 'accountName' }, { label: 'Account Number', key: 'accountNumber' },
                { label: 'Amount (GHS)', key: 'amount', type: 'number' }, { label: 'Order Reference', key: 'orderRef' },
                { label: 'Cheque Date', key: 'chequeDate', type: 'date' }, { label: 'Expected Clearing', key: 'expectedClearing', type: 'date' },
              ].map(({ label, key, type }) => (
                <div key={key}><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label><input type={type || 'text'} value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={addCheque} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}>Add to Register</button>
            </div>
          </div>
        </div>
      )}

      {selectedCheque && (
        <EntityDetailPanel
          title={`Cheque #${selectedCheque.chequeNumber}`}
          subtitle={selectedCheque.bankName}
          badgeText={selectedCheque.status}
          badgeStyle={
            selectedCheque.status === 'Cleared' ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' } :
            selectedCheque.status === 'Bounced' ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444' } :
            selectedCheque.status === 'Deposited' ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' } :
            { background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }
          }
          fields={[
            { label: 'Cheque Number', value: selectedCheque.chequeNumber, highlight: true },
            { label: 'Amount', value: `GHS ${selectedCheque.amount.toLocaleString()}`, highlight: true },
            { label: 'Bank Name', value: selectedCheque.bankName },
            { label: 'Account Name', value: selectedCheque.accountName },
            { label: 'Cheque Date', value: selectedCheque.chequeDate },
            { label: 'Expected Clearing', value: selectedCheque.expectedClearing },
            { label: 'Order Reference', value: selectedCheque.orderRef || '—' },
            { label: 'Status', value: selectedCheque.status },
          ]}
          onClose={() => setSelectedCheque(null)}
          actions={
            <>
              <button onClick={() => { openEditForm(selectedCheque); setSelectedCheque(null); }} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-input)]">Edit</button>
              <button onClick={() => setSelectedCheque(null)} className="px-4 py-2 rounded-xl text-white text-sm font-medium cursor-pointer" style={{ background: 'var(--accent)' }}>Close</button>
            </>
          }
        />
      )}

      {showEditForm && editCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEditForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">Edit Cheque</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Cheque Number', key: 'chequeNumber' }, { label: 'Bank Name', key: 'bankName' },
                { label: 'Account Name', key: 'accountName' }, { label: 'Account Number', key: 'accountNumber' },
                { label: 'Amount (GHS)', key: 'amount', type: 'number' }, { label: 'Order Reference', key: 'orderRef' },
                { label: 'Cheque Date', key: 'chequeDate', type: 'date' }, { label: 'Expected Clearing', key: 'expectedClearing', type: 'date' },
              ].map(({ label, key, type }) => (
                <div key={key}><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label><input type={type || 'text'} value={(editForm as Record<string, string>)[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" /></div>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowEditForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={updateCheque} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
