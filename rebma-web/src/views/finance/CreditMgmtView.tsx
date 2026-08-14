import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import {
  Search, Download, Eye, MoreVertical, ArrowLeft, CreditCard,
  DollarSign, AlertTriangle, CheckCircle, Send, RefreshCw, Phone
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

interface CreditEntry {
  id: string;
  customerName: string;
  orderRef: string;
  creditAmount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string;
  daysOverdue: number;
  status: 'Current' | 'Due Soon' | 'Overdue' | 'Paid';
  phone?: string;
}


const STATUS_COLORS: Record<string, string> = {
  Current: 'bg-green-100 text-green-700',
  'Due Soon': 'bg-yellow-100 text-yellow-700',
  Overdue: 'bg-red-100 text-red-700',
  Paid: 'bg-gray-100 text-gray-600',
};

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const mapCreditEntry = (o: any): CreditEntry => {
  const today = new Date();
  const due = new Date(o.due_date || o.created_at);
  const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
  const outstanding = (o.total_amount || 0) - (o.amount_paid || 0);
  let status: CreditEntry['status'] = 'Current';
  if (o.amount_paid >= o.total_amount) status = 'Paid';
  else if (diffDays > 0) status = 'Overdue';
  else if (diffDays > -7) status = 'Due Soon';
  return {
    id: o.id,
    customerName: o.client_name || o.clientName || '',
    orderRef: o.ticket_number || o.ticketNumber || o.id,
    creditAmount: o.total_amount || o.totalAmount || 0,
    amountPaid: o.amount_paid || 0,
    outstanding,
    dueDate: o.due_date || o.created_at?.split('T')[0] || '',
    daysOverdue: diffDays > 0 ? diffDays : 0,
    status,
    phone: o.phone || '',
  };
};

const creditOrdersOnly = (q: any) => q.eq('payment_mode', 'CREDIT');

export default function FinanceCreditMgmtView({ addNotification, currentUser }: Props) {
  const { getSetting } = useCeoSettings();
  const handlePrint = () => {
    if (!getSetting('print_enabled', true)) { addNotification?.('Printing is currently disabled by the CEO.'); return; }
    window.print();
  };
  const { rows: items, setRows: setItems, loading, hasMore, total, loadMore } = usePaginatedQuery<CreditEntry>({
    table: 'orders',
    pageSize: 100,
    applyFilters: creditOrdersOnly,
    map: mapCreditEntry,
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<CreditEntry | null>(null);
  const [reminderModal, setReminderModal] = useState<CreditEntry | null>(null);
  const [reminderType, setReminderType] = useState<'email' | 'whatsapp'>('whatsapp');
  const [reminderMsg, setReminderMsg] = useState('');
  const [payModal, setPayModal] = useState<CreditEntry | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [editItem, setEditItem] = useState<CreditEntry | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ clientName: '', totalAmount: '', amountPaid: '', dueDate: '', phone: '' });

  const filtered = items.filter(i => {
    const matchSearch = !search || i.customerName.toLowerCase().includes(search.toLowerCase()) || i.orderRef.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalExtended = items.reduce((s, i) => s + i.creditAmount, 0);
  const totalCollected = items.reduce((s, i) => s + i.amountPaid, 0);
  const outstanding = items.reduce((s, i) => s + i.outstanding, 0);
  const overdueCount = items.filter(i => i.status === 'Overdue').length;

  function openReminder(item: CreditEntry) {
    setReminderModal(item);
    setReminderMsg(`Dear ${item.customerName},\n\nYour payment of GHS ${item.outstanding.toLocaleString()} for order ${item.orderRef} was due on ${item.dueDate}. Please make payment at your earliest convenience.\n\nREBMA IMPEX Finance Department.`);
  }

  const [submitting, setSubmitting] = useState(false);

  async function sendReminder() {
    if (!reminderModal) return;
    if (!getSetting('payment_reminders_enabled', true)) { addNotification?.('Payment reminders are currently disabled by the CEO.'); return; }
    if (reminderType === 'whatsapp' && !getSetting('whatsapp_enabled', true)) { addNotification?.('WhatsApp is currently disabled by the CEO — switch to Email.'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Payment reminder sent to ${reminderModal.customerName} via ${reminderType} for order ${reminderModal.orderRef}`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
      if (error) throw error;
      addNotification?.(`Reminder sent to ${reminderModal.customerName} via ${reminderType}`);
      setReminderModal(null);
    } catch (e: any) {
      alert(e.message || 'Failed to send reminder.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditForm(item: CreditEntry) {
    setEditItem(item);
    setEditForm({
      clientName: item.customerName,
      totalAmount: String(item.creditAmount),
      amountPaid: String(item.amountPaid),
      dueDate: item.dueDate,
      phone: item.phone || ''
    });
    setShowEditForm(true);
    setMenuOpen(null);
  }

  async function updateCredit() {
    if (!editItem || !editForm.clientName || !editForm.totalAmount) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const totalAmt = parseFloat(editForm.totalAmount) || 0;
      const amtPaid = parseFloat(editForm.amountPaid) || 0;
      const outstanding = totalAmt - amtPaid;
      const { error } = await supabase.from('orders')
        .update({
          client_name: editForm.clientName,
          total_amount: totalAmt,
          amount_paid: amtPaid,
          due_date: editForm.dueDate || null,
          phone: editForm.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editItem.id);
      if (error) throw error;

      setItems(prev => prev.map(i => {
        if (i.id !== editItem.id) return i;
        const today = new Date();
        const due = new Date(editForm.dueDate || today);
        const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
        let status: CreditEntry['status'] = 'Current';
        if (amtPaid >= totalAmt) status = 'Paid';
        else if (diffDays > 0) status = 'Overdue';
        else if (diffDays > -7) status = 'Due Soon';

        return {
          ...i,
          customerName: editForm.clientName,
          creditAmount: totalAmt,
          amountPaid: amtPaid,
          outstanding,
          dueDate: editForm.dueDate,
          daysOverdue: diffDays > 0 ? diffDays : 0,
          status,
          phone: editForm.phone
        };
      }));
      addNotification?.('Credit order updated successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Credit order ${editItem.id} updated`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
      setShowEditForm(false);
      setEditItem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update credit order.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCredit(id: string) {
    if (submitting) return;
    if (!await window.confirm('Are you sure you want to delete this credit order record?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== id));
      addNotification?.('Credit order deleted successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Credit order ${id} deleted`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete credit order.');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  }

  async function recordPayment() {
    if (!payModal || !payAmount) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const amount = parseFloat(payAmount);
      // Atomic server-side function — locks the order row, adds the
      // payment to amount_paid, and records the finance_payments row in
      // one transaction. The old code only updated local React state and
      // never wrote amount_paid to the database at all (see
      // supabase_atomic_functions.sql).
      const { data: updatedOrder, error } = await supabase.rpc('record_credit_payment', {
        p_order_id: payModal.id,
        p_amount: amount,
        p_payment_date: payDate,
      });
      if (error) throw error;

      setItems(prev => prev.map(i => {
        if (i.id !== payModal.id) return i;
        const newPaid = updatedOrder.amount_paid ?? (i.amountPaid + amount);
        const newOutstanding = Math.max(0, i.creditAmount - newPaid);
        return { ...i, amountPaid: newPaid, outstanding: newOutstanding, status: newOutstanding === 0 ? 'Paid' : i.status };
      }));
      addNotification?.(`Payment of GHS ${amount.toLocaleString()} recorded for ${payModal.customerName}`);
      setPayModal(null);
      setPayAmount('');
    } catch (e: any) {
      alert(e.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (selected) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium">
          <ArrowLeft size={16} /> Back to Credit Management
        </button>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{selected.customerName}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{selected.orderRef}</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Credit Amount', value: selected.creditAmount, isAmount: true },
              { label: 'Amount Paid', value: selected.amountPaid, isAmount: true },
              { label: 'Outstanding', value: selected.outstanding, isAmount: true },
              { label: 'Due Date', value: selected.dueDate, isAmount: false },
            ].map(({ label, value, isAmount }) => (
              <div key={label} className="bg-[var(--bg-input)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {isAmount ? <>GHS <CountUp value={value as number} /></> : value}
                </p>
              </div>
            ))}
          </div>
          {selected.daysOverdue > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              ⚠️ This account is <strong>{selected.daysOverdue} days overdue</strong>. Immediate action required.
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => openReminder(selected)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Send size={14} /> Send Reminder</button>
            {selected.outstanding > 0 && <button onClick={() => { setPayModal(selected); setSelected(null); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}><DollarSign size={14} /> Record Payment</button>}
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Download size={14} /> Print Statement</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Credit Management</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track outstanding credit and payment collections</p>
        </div>
        <button onClick={() => exportToCSV(filtered.map(i => ({ Customer: i.customerName, Order: i.orderRef, 'Credit Amount': i.creditAmount, Paid: i.amountPaid, Outstanding: i.outstanding, 'Due Date': i.dueDate, Status: i.status })), ['Customer', 'Order', 'Credit Amount', 'Paid', 'Outstanding', 'Due Date', 'Status'], 'credit_management')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <Download size={14} /> Export
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Extended', value: totalExtended, prefix: 'GHS ', color: 'var(--accent)', icon: CreditCard },
          { label: 'Total Collected', value: totalCollected, prefix: 'GHS ', color: '#10b981', icon: CheckCircle },
          { label: 'Outstanding', value: outstanding, prefix: 'GHS ', color: '#ef4444', icon: AlertTriangle },
          { label: 'Overdue Accounts', value: overdueCount, prefix: '', color: '#f59e0b', icon: AlertTriangle },
        ].map(({ label, value, prefix, color, icon: Icon }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]"><CountUp value={value} prefix={prefix} /></p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or order..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <SearchableDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          options={['All', 'Current', 'Due Soon', 'Overdue', 'Paid'].map(s => ({ value: s, label: s }))}
          className="w-44"
        />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <ResponsiveDataView
          columns={[
            { key: 'customerName', label: 'Customer', primary: true },
            { key: 'orderRef', label: 'Order Ref', render: item => <span className="font-mono">{item.orderRef}</span> },
            { key: 'creditAmount', label: 'Credit Amount', render: item => `GHS ${item.creditAmount.toLocaleString()}` },
            { key: 'amountPaid', label: 'Paid', render: item => <span className="text-green-500 font-medium">GHS {item.amountPaid.toLocaleString()}</span> },
            { key: 'outstanding', label: 'Outstanding', render: item => <span className="font-semibold" style={{ color: item.outstanding > 0 ? '#ef4444' : 'var(--text-primary)' }}>GHS {item.outstanding.toLocaleString()}</span> },
            { key: 'dueDate', label: 'Due Date' },
            { key: 'daysOverdue', label: 'Overdue', render: item => item.daysOverdue > 0 ? <span className="text-red-500 font-semibold text-xs">{item.daysOverdue}d</span> : <span className="text-[var(--text-muted)] text-xs">—</span> },
            { key: 'status', label: 'Status', status: true, render: item => <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>{item.status}</span> },
          ] as DataColumn<CreditEntry>[]}
          data={filtered}
          rowKey={item => item.id}
          onRowClick={item => setSelected(item)}
          loading={loading}
          emptyIcon={<CreditCard size={20} className="opacity-60" />}
          emptyTitle="No credit records yet"
          emptyDescription="They will appear here once added"
          renderActions={item => (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelected(item)} title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
              <button onClick={() => openReminder(item)} title="Remind"><Send size={14} className="text-blue-500" /></button>
              <div className="relative">
                <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                {menuOpen === item.id && (
                  <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px]">
                    <button onClick={(e) => { e.stopPropagation(); setSelected(item); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] font-medium">View Details</button>
                    {item.outstanding > 0 && <button onClick={(e) => { e.stopPropagation(); setPayModal(item); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Record Payment</button>}
                    <button onClick={(e) => { e.stopPropagation(); openReminder(item); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Send Reminder</button>
                    <button onClick={(e) => { e.stopPropagation(); openEditForm(item); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Edit Credit Order</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteCredit(item.id); }} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-[var(--bg-input)]">Delete Credit</button>
                    <button onClick={(e) => { e.stopPropagation(); handlePrint(); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export PDF</button>
                  </div>
                )}
              </div>
            </div>
          )}
        />
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            <span>Showing {items.length}{typeof total === 'number' ? ` of ${total.toLocaleString()}` : ''}</span>
            {hasMore && (
              <button onClick={loadMore} className="px-3 py-1.5 rounded-lg bg-[var(--bg-input)] text-[var(--text-secondary)] hover:opacity-90 font-medium">Load more</button>
            )}
          </div>
        )}
      </div>

      <SidePanel
        open={!!reminderModal}
        onClose={() => setReminderModal(null)}
        title="Send Payment Reminder"
        subtitle={reminderModal ? reminderModal.customerName : undefined}
        footer={
          <>
            <button onClick={() => setReminderModal(null)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={sendReminder} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50"><Send size={14} /> {submitting ? 'Sending...' : 'Send'}</button>
          </>
        }
      >
        <div className="flex items-center gap-2 mb-4">
          {(['whatsapp', 'email'] as const).map(t => (
            <button key={t} onClick={() => setReminderType(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${reminderType === t ? 'text-white' : 'border border-[var(--border)] text-[var(--text-secondary)]'}`} style={reminderType === t ? { background: 'var(--accent)' } : {}}>{t === 'whatsapp' ? '📱 WhatsApp' : '📧 Email'}</button>
          ))}
        </div>
        <textarea value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} rows={6} className="erp-input resize-none" />
      </SidePanel>

      <SidePanel
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Record Payment"
        subtitle={payModal ? `${payModal.customerName}. Outstanding: GHS ${payModal.outstanding.toLocaleString()}` : undefined}
        footer={
          <>
            <button onClick={() => setPayModal(null)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={recordPayment} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">{submitting ? 'Saving...' : 'Save Payment'}</button>
          </>
        }
      >
        <div className="erp-form-group">
          <label className="erp-label">Amount (GHS)</label>
          <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={payModal ? String(payModal.outstanding) : ''} className="erp-input" />
        </div>
        <div className="erp-form-group">
          <label className="erp-label">Date</label>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="erp-input" />
        </div>
      </SidePanel>

      <SidePanel
        open={showEditForm && !!editItem}
        onClose={() => setShowEditForm(false)}
        title="Edit Credit Order"
        footer={
          <>
            <button onClick={() => setShowEditForm(false)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={updateCredit} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="erp-form-group">
            <label className="erp-label">Customer Name</label>
            <input value={editForm.clientName} onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))} className="erp-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-form-group">
              <label className="erp-label">Total Amount (GHS)</label>
              <input type="number" value={editForm.totalAmount} onChange={e => setEditForm(f => ({ ...f, totalAmount: e.target.value }))} className="erp-input" />
            </div>
            <div className="erp-form-group">
              <label className="erp-label">Amount Paid (GHS)</label>
              <input type="number" value={editForm.amountPaid} onChange={e => setEditForm(f => ({ ...f, amountPaid: e.target.value }))} className="erp-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="erp-form-group">
              <label className="erp-label">Due Date</label>
              <input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className="erp-input" />
            </div>
            <div className="erp-form-group">
              <label className="erp-label">Phone Number</label>
              <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="erp-input" />
            </div>
          </div>
        </div>
      </SidePanel>
    </div>
  );
}
