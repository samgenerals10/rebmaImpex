import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, MoreVertical, Eye, CheckCircle, Clock, XCircle, Smartphone } from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const MOCK: MomoTxn[] = [
  { id: '1', transactionId: 'MTN-2024120801', network: 'MTN', customerName: 'Kwame Adjei', momoNumber: '0244123456', amount: 28000, date: '2024-12-08', status: 'Verified', orderRef: 'ORD-2024-003' },
  { id: '2', transactionId: 'VOD-2024120702', network: 'Vodafone', customerName: 'Abena Mensah', momoNumber: '0207654321', amount: 15500, date: '2024-12-07', status: 'Verified', orderRef: 'ORD-2024-007' },
  { id: '3', transactionId: 'ATG-2024120603', network: 'AirtelTigo', customerName: 'Yaw Darko', momoNumber: '0277112233', amount: 9800, date: '2024-12-06', status: 'Pending', orderRef: 'ORD-2024-011' },
  { id: '4', transactionId: 'MTN-2024120504', network: 'MTN', customerName: 'Ama Sarpong', momoNumber: '0244987654', amount: 42000, date: '2024-12-05', status: 'Verified', orderRef: 'ORD-2024-014' },
  { id: '5', transactionId: 'VOD-2024120405', network: 'Vodafone', customerName: 'Kofi Owusu', momoNumber: '0201234567', amount: 7200, date: '2024-12-04', status: 'Failed', orderRef: 'ORD-2024-016' },
];

const NETWORK_COLORS: Record<string, string> = { MTN: '#f59e0b', Vodafone: '#ef4444', AirtelTigo: '#3b82f6' };
const STATUS_COLORS: Record<string, string> = { Verified: 'bg-green-100 text-green-700', Pending: 'bg-yellow-100 text-yellow-700', Failed: 'bg-red-100 text-red-700' };

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinanceMobileMoneyView({ addNotification, currentUser }: Props) {
  const [txns, setTxns] = useState<MomoTxn[]>(MOCK);
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MomoTxn | null>(null);

  const filtered = txns.filter(t => {
    const matchSearch = !search || t.customerName.toLowerCase().includes(search.toLowerCase()) || t.transactionId.toLowerCase().includes(search.toLowerCase());
    const matchNet = networkFilter === 'All' || t.network === networkFilter;
    return matchSearch && matchNet;
  });

  const byNetwork = ['MTN', 'Vodafone', 'AirtelTigo'].map(n => ({ name: n, value: txns.filter(t => t.network === n).reduce((s, t) => s + t.amount, 0), color: NETWORK_COLORS[n] }));
  const totalMoMo = txns.reduce((s, t) => s + t.amount, 0);

  function verify(id: string) {
    setTxns(prev => prev.map(t => t.id === id ? { ...t, status: 'Verified' } : t));
    const txn = txns.find(t => t.id === id);
    supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `MoMo transaction ${id} verified — ${txn?.transactionId}`, performed_by: currentUser?.fullName || 'Finance', created_at: new Date().toISOString() }]).then(() => {}, () => {});
    addNotification?.(`MoMo transaction verified: ${txn?.transactionId}`);
    setMenuOpen(null);
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
          { label: 'Total MoMo', value: `GHS ${(totalMoMo / 1000).toFixed(0)}K`, color: 'var(--accent)' },
          { label: 'MTN MoMo', value: `GHS ${(byNetwork[0].value / 1000).toFixed(0)}K`, color: '#f59e0b' },
          { label: 'Vodafone Cash', value: `GHS ${(byNetwork[1].value / 1000).toFixed(0)}K`, color: '#ef4444' },
          { label: 'AirtelTigo Money', value: `GHS ${(byNetwork[2].value / 1000).toFixed(0)}K`, color: '#3b82f6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}><Smartphone size={18} style={{ color }} /></div>
            <div><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="text-lg font-bold text-[var(--text-primary)]">{value}</p></div>
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
                  <span className="text-xs font-semibold text-[var(--text-primary)]">GHS {(n.value / 1000).toFixed(0)}K</span>
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
                          <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[140px]">
                            <button onClick={() => { setViewing(t); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)]">View Details</button>
                            {t.status === 'Pending' && <button onClick={() => verify(t.id)} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-[var(--bg-input)]">Verify</button>}
                            <button onClick={() => { window.print(); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Export Receipt</button>
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
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}
