import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Search, Download, Eye, MoreVertical, ArrowLeft, CreditCard,
  DollarSign, AlertTriangle, CheckCircle, Send, RefreshCw, Phone
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

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

export default function FinanceCreditMgmtView({ addNotification, currentUser }: Props) {
  const [items, setItems] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('orders').select('*').eq('payment_mode', 'CREDIT').order('created_at', { ascending: false });
        if (data) {
          const today = new Date();
          setItems(data.map((o: any) => {
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
            } as CreditEntry;
          }));
        }
      } catch {
        // show empty state
      }
      setLoading(false);
    };
    load();
  }, []);
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

  function sendReminder() {
    if (!reminderModal) return;
    supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Payment reminder sent to ${reminderModal.customerName} via ${reminderType} for order ${reminderModal.orderRef}`, performed_by: currentUser?.fullName || 'Finance', created_at: new Date().toISOString() }]).then(() => {}, () => {});
    addNotification?.(`Reminder sent to ${reminderModal.customerName} via ${reminderType}`);
    setReminderModal(null);
  }

  function recordPayment() {
    if (!payModal || !payAmount) return;
    const amount = parseFloat(payAmount);
    setItems(prev => prev.map(i => {
      if (i.id !== payModal.id) return i;
      const newPaid = i.amountPaid + amount;
      const newOutstanding = Math.max(0, i.outstanding - amount);
      return { ...i, amountPaid: newPaid, outstanding: newOutstanding, status: newOutstanding === 0 ? 'Paid' : i.status };
    }));
    supabase.from('finance_payments').insert([{ client_name: payModal.customerName, amount, payment_mode: 'CASH', order_ref: payModal.orderRef, payment_type: 'CREDIT_SETTLEMENT', recorded_by: currentUser?.fullName || 'Finance', created_at: payDate }]).then(() => {}, () => {});
    addNotification?.(`Payment of GHS ${amount.toLocaleString()} recorded for ${payModal.customerName}`);
    setPayModal(null);
    setPayAmount('');
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
              { label: 'Credit Amount', value: `GHS ${selected.creditAmount.toLocaleString()}` },
              { label: 'Amount Paid', value: `GHS ${selected.amountPaid.toLocaleString()}` },
              { label: 'Outstanding', value: `GHS ${selected.outstanding.toLocaleString()}` },
              { label: 'Due Date', value: selected.dueDate },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-input)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{value}</p>
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
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Download size={14} /> Print Statement</button>
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
          { label: 'Total Extended', value: `GHS ${(totalExtended / 1000).toFixed(0)}K`, color: 'var(--accent)', icon: CreditCard },
          { label: 'Total Collected', value: `GHS ${(totalCollected / 1000).toFixed(0)}K`, color: '#10b981', icon: CheckCircle },
          { label: 'Outstanding', value: `GHS ${(outstanding / 1000).toFixed(0)}K`, color: '#ef4444', icon: AlertTriangle },
          { label: 'Overdue Accounts', value: overdueCount, color: '#f59e0b', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">{label}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or order..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none">
          {['All', 'Current', 'Due Soon', 'Overdue', 'Paid'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No credit records yet</p>
            <p className="text-sm mt-1">They will appear here once added</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Customer', 'Order Ref', 'Credit Amount', 'Paid', 'Outstanding', 'Due Date', 'Overdue', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-[var(--bg-input)] cursor-pointer group" onClick={() => setSelected(item)}>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{item.customerName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{item.orderRef}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">GHS {item.creditAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-500 font-medium">GHS {item.amountPaid.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: item.outstanding > 0 ? '#ef4444' : 'var(--text-primary)' }}>GHS {item.outstanding.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{item.dueDate}</td>
                  <td className="px-4 py-3">{item.daysOverdue > 0 ? <span className="text-red-500 font-semibold text-xs">{item.daysOverdue}d</span> : <span className="text-[var(--text-muted)] text-xs">—</span>}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>{item.status}</span></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelected(item)} title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
                      <button onClick={() => openReminder(item)} title="Remind"><Send size={14} className="text-blue-500" /></button>
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                        {menuOpen === item.id && (
                          <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px]" onClick={() => setMenuOpen(null)}>
                            <button onClick={() => setSelected(item)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                            {item.outstanding > 0 && <button onClick={() => setPayModal(item)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Record Payment</button>}
                            <button onClick={() => openReminder(item)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Send Reminder</button>
                            <button onClick={() => window.print()} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export PDF</button>
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

      {reminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setReminderModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">Send Payment Reminder</h3>
            <div className="flex items-center gap-2 mb-4">
              {(['whatsapp', 'email'] as const).map(t => (
                <button key={t} onClick={() => setReminderType(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${reminderType === t ? 'text-white' : 'border border-[var(--border)] text-[var(--text-secondary)]'}`} style={reminderType === t ? { background: 'var(--accent)' } : {}}>{t === 'whatsapp' ? '📱 WhatsApp' : '📧 Email'}</button>
              ))}
            </div>
            <textarea value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} rows={6} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none mb-4" />
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setReminderModal(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={sendReminder} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}><Send size={14} /> Send</button>
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">Record Payment</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{payModal.customerName} — Outstanding: GHS {payModal.outstanding.toLocaleString()}</p>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount (GHS)</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={String(payModal.outstanding)} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Date</label><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-4">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Cancel</button>
              <button onClick={recordPayment} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: 'var(--accent)' }}>Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
