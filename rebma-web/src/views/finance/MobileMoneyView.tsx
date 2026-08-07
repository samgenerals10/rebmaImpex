import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, MoreVertical, Eye, CheckCircle, Clock, XCircle, Smartphone } from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import CountUp from '../../components/CountUp';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';

interface MomoTxn {
  id: string;
  transactionId: string;
  network: 'MTN' | 'Vodafone' | 'AirtelTigo';
  customerName: string;
  momoNumber: string;
  amount: number;
  date: string;
  status: 'Verified' | 'Pending' | 'Failed';
  orderRef?: string;
}

const NETWORK_COLORS: Record<string, string> = { MTN: '#f59e0b', Vodafone: '#ef4444', AirtelTigo: '#3b82f6' };
const STATUS_COLORS: Record<string, string> = { Verified: 'bg-green-100 text-green-700', Pending: 'bg-yellow-100 text-yellow-700', Failed: 'bg-red-100 text-red-700' };

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinanceMobileMoneyView({ addNotification, currentUser }: Props) {
  const { getSetting } = useCeoSettings();
  const handlePrint = () => {
    if (!getSetting('print_enabled', true)) { addNotification?.('Printing is currently disabled by the CEO.'); return; }
    window.print();
  };
  const [txns, setTxns] = useState<MomoTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MomoTxn | null>(null);
  const [editTxn, setEditTxn] = useState<MomoTxn | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ transactionId: '', network: 'MTN' as MomoTxn['network'], customerName: '', momoNumber: '', amount: '', date: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('finance_payments')
          .select('*')
          .ilike('payment_mode', 'mobile_money')
          .order('created_at', { ascending: false });
        if (data) {
          setTxns(data.map((p: any) => ({
            id: p.id,
            transactionId: p.transaction_id || p.id,
            network: (p.network || 'MTN') as any,
            customerName: p.client_name,
            momoNumber: p.momo_number || 'N/A',
            amount: Number(p.amount) || 0,
            date: p.created_at?.split('T')[0] || '',
            status: (p.status || 'Verified') as any,
            orderRef: p.order_id || undefined
          })));
        }
      } catch {
        setTxns([]);
      }
      setLoading(false);
    };
    load();

    const channel = supabase.channel('mobile-money-realtime-' + Math.random().toString(36).substring(7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_payments' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = txns.filter(t => {
    const matchSearch = !search || t.customerName.toLowerCase().includes(search.toLowerCase()) || t.transactionId.toLowerCase().includes(search.toLowerCase());
    const matchNet = networkFilter === 'All' || t.network === networkFilter;
    return matchSearch && matchNet;
  });

  const byNetwork = ['MTN', 'Vodafone', 'AirtelTigo'].map(n => ({ name: n, value: txns.filter(t => t.network === n).reduce((s, t) => s + t.amount, 0), color: NETWORK_COLORS[n] }));
  const totalMoMo = txns.reduce((s, t) => s + t.amount, 0);

  const [submitting, setSubmitting] = useState(false);

  async function verify(id: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const txn = txns.find(t => t.id === id);
      const { error } = await supabase.from('finance_payments').update({ status: 'Verified' }).eq('id', id);
      if (error) throw error;
      setTxns(prev => prev.map(t => t.id === id ? { ...t, status: 'Verified' } : t));
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${id} verified — ${txn?.transactionId}`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
      addNotification?.(`MoMo transaction verified: ${txn?.transactionId}`);
    } catch (e: any) {
      alert(e.message || 'Failed to verify transaction.');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  }

  function openEditForm(t: MomoTxn) {
    setEditTxn(t);
    setEditForm({
      transactionId: t.transactionId,
      network: t.network,
      customerName: t.customerName,
      momoNumber: t.momoNumber,
      amount: String(t.amount),
      date: t.date
    });
    setShowEditForm(true);
    setMenuOpen(null);
  }

  async function updateTxn() {
    if (!editTxn || !editForm.transactionId || !editForm.customerName || !editForm.amount) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const updatedAmount = parseFloat(editForm.amount) || 0;
      const { error } = await supabase.from('finance_payments')
        .update({
          transaction_id: editForm.transactionId,
          network: editForm.network,
          client_name: editForm.customerName,
          momo_number: editForm.momoNumber,
          amount: updatedAmount,
          created_at: editForm.date ? new Date(editForm.date).toISOString() : undefined
        })
        .eq('id', editTxn.id);
      if (error) throw error;
      setTxns(prev => prev.map(t => t.id === editTxn.id ? { ...t, transactionId: editForm.transactionId, network: editForm.network, customerName: editForm.customerName, momoNumber: editForm.momoNumber, amount: updatedAmount, date: editForm.date } : t));
      addNotification?.('MoMo transaction updated successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${editTxn.id} updated`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
      setShowEditForm(false);
      setEditTxn(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTxn(id: string) {
    if (submitting) return;
    if (!await window.confirm('Are you sure you want to delete this transaction record?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('finance_payments').delete().eq('id', id);
      if (error) throw error;
      setTxns(prev => prev.filter(t => t.id !== id));
      addNotification?.('Transaction record deleted successfully.');
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${id} deleted`, performed_by: currentUser?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction.');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  }


  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mobile Money Records</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track and verify all MoMo transactions</p>
        </div>
        <button onClick={() => exportToCSV(filtered.map(t => ({ TxnID: t.transactionId, Network: t.network, Customer: t.customerName, Number: t.momoNumber, Amount: t.amount, Date: t.date, Status: t.status })), ['TxnID', 'Network', 'Customer', 'Number', 'Amount', 'Date', 'Status'], 'momo_records')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><Download size={14} /> Export</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total MoMo', value: totalMoMo, color: 'var(--accent)' },
          { label: 'MTN MoMo', value: byNetwork[0].value, color: '#f59e0b' },
          { label: 'Vodafone Cash', value: byNetwork[1].value, color: '#ef4444' },
          { label: 'AirtelTigo Money', value: byNetwork[2].value, color: '#3b82f6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}><Smartphone size={18} style={{ color }} /></div>
            <div><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="text-lg font-bold text-[var(--text-primary)]">GHS <CountUp value={value} /></p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Network Breakdown</h3>
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={byNetwork} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={52} strokeWidth={0}>{byNetwork.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {byNetwork.map(n => (
                <div key={n.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: n.color }} /><span className="text-xs text-[var(--text-secondary)]">{n.name}</span></div>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">GHS <CountUp value={n.value} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex items-center gap-3 flex-wrap self-start">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by transaction ID or customer..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <select value={networkFilter} onChange={e => setNetworkFilter(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none">
            {['All', 'MTN', 'Vodafone', 'AirtelTigo'].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">{['Transaction ID', 'Network', 'Customer', 'MoMo Number', 'Amount', 'Date', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-[var(--bg-input)] group">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{t.transactionId}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium text-white" style={{ background: NETWORK_COLORS[t.network] }}>{t.network}</span></td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{t.customerName}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">{t.momoNumber}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">GHS {t.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setViewing(t)} title="View"><Eye size={14} style={{ color: 'var(--accent)' }} /></button>
                      {t.status === 'Pending' && <button onClick={() => verify(t.id)} title="Verify"><CheckCircle size={14} className="text-green-500" /></button>}
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"><MoreVertical size={14} className="text-[var(--text-muted)]" /></button>
                        {menuOpen === t.id && (
                          <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[150px]">
                            <button onClick={() => { setViewing(t); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                            {t.status === 'Pending' && <button onClick={() => verify(t.id)} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Verify</button>}
                            <button onClick={() => openEditForm(t)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">Edit Txn</button>
                            <button onClick={() => deleteTxn(t.id)} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-[var(--bg-input)]">Delete Txn</button>
                            <button onClick={() => { handlePrint(); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export Receipt</button>
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
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">MoMo Transaction Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Transaction ID', value: viewing.transactionId },
                { label: 'Network', value: viewing.network },
                { label: 'Customer', value: viewing.customerName },
                { label: 'MoMo Number', value: viewing.momoNumber },
                { label: 'Amount', value: `GHS ${viewing.amount.toLocaleString()}` },
                { label: 'Date', value: viewing.date },
                { label: 'Order Reference', value: viewing.orderRef || '—' },
                { label: 'Status', value: viewing.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <span className="text-xs text-[var(--text-muted)]">{label}</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              {viewing.status === 'Pending' && <button onClick={() => { verify(viewing.id); setViewing(null); }} className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium">Verify</button>}
              <button onClick={() => setViewing(null)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)]">Close</button>
            </div>
          </div>
        </div>
      )}
      {showEditForm && editTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEditForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">Edit MoMo Transaction</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Transaction ID</label><input value={editForm.transactionId} onChange={e => setEditForm(f => ({ ...f, transactionId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Network</label><select value={editForm.network} onChange={e => setEditForm(f => ({ ...f, network: e.target.value as any }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]">{['MTN', 'Vodafone', 'AirtelTigo'].map(n => <option key={n}>{n}</option>)}</select></div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Customer Name</label><input value={editForm.customerName} onChange={e => setEditForm(f => ({ ...f, customerName: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">MoMo Number</label><input value={editForm.momoNumber} onChange={e => setEditForm(f => ({ ...f, momoNumber: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
                <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Amount (GHS)</label><input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
              </div>
              <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Date</label><input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" /></div>
            </div>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowEditForm(false)} disabled={submitting} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">Cancel</button>
              <button onClick={updateTxn} disabled={submitting} className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--accent)' }}>{submitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
