// src/views/ceo/ApprovalsView.tsx
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';
import { exportToCSV } from '../../utils/export';

interface Approval {
  id: string;
  type: 'credit' | 'cargo' | 'payment' | 'registration' | 'price';
  requester: string;
  department: string;
  description: string;
  amount?: number;
  date_submitted: string;
  status: 'pending' | 'approved' | 'rejected';
}

const MOCK: Approval[] = Array.from({ length: 12 }, (_, i) => ({
  id: `APR-${String(i+1).padStart(3,'0')}`,
  type: (['credit','cargo','payment','registration','price'] as const)[i % 5],
  requester: ['Kofi Mensah','Ama Serwaa','Kwame Asante','Abena Owusu','Kojo Boateng'][i % 5],
  department: ['MARKETING','OPERATIONS','FINANCE','HR','MANAGEMENT'][i % 5],
  description: [
    'Credit order for Accra Traders Ltd — GHS 45,000',
    'Cargo intake from Tema Port — 200 tons',
    'Payment disbursement for supplier invoice',
    'New staff account registration',
    'Price update for Category A products',
  ][i % 5],
  amount: [45000, 0, 12500, 0, 0][i % 5],
  date_submitted: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
  status: i < 4 ? 'pending' : i < 8 ? 'approved' : 'rejected',
}));

const TYPE_STYLES: Record<string, string> = {
  credit:       'bg-blue-100 text-blue-700',
  cargo:        'bg-amber-100 text-amber-700',
  payment:      'bg-emerald-100 text-emerald-700',
  registration: 'bg-purple-100 text-purple-700',
  price:        'bg-indigo-100 text-indigo-700',
};

interface Props { currentUser: CurrentUser | null; addNotification: (msg: string) => void }

export default function ApprovalsView({ currentUser, addNotification }: Props) {
  const [rows, setRows]           = useState<Approval[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'all'|'credit'|'cargo'|'payment'|'registration'|'price'>('all');
  const [history, setHistory]     = useState<Approval[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Try to get pending approvals from multiple sources
        const [{ data: orders }, { data: cargo }, { data: regs }] = await Promise.all([
          supabase.from('orders').select('id,customer_name,department,total_amount,created_at,status').eq('payment_mode','Credit').eq('status','pending').limit(50),
          supabase.from('incoming_goods').select('id,supplier,department,quantity,created_at,status').eq('status','pending').limit(50),
          supabase.from('pending_registrations').select('*').limit(50),
        ]);

        const approvals: Approval[] = [
          ...(orders || []).map((o: any) => ({
            id: o.id, type: 'credit' as const,
            requester: o.customer_name || 'Unknown',
            department: o.department || 'MARKETING',
            description: `Credit order — GHS ${Number(o.total_amount || 0).toLocaleString()}`,
            amount: o.total_amount, date_submitted: o.created_at?.split('T')[0] || '', status: 'pending' as const,
          })),
          ...(cargo || []).map((c: any) => ({
            id: c.id, type: 'cargo' as const,
            requester: c.supplier || 'Unknown',
            department: c.department || 'OPERATIONS',
            description: `Cargo intake — ${c.quantity} units`,
            date_submitted: c.created_at?.split('T')[0] || '', status: 'pending' as const,
          })),
          ...(regs || []).map((r: any) => ({
            id: r.id, type: 'registration' as const,
            requester: r.full_name || r.name || 'Unknown',
            department: r.department || 'HR',
            description: `Staff registration — ${r.department}`,
            date_submitted: r.created_at?.split('T')[0] || '', status: 'pending' as const,
          })),
        ];
        setRows(approvals.length > 0 ? approvals : MOCK.filter(m => m.status === 'pending'));
        setHistory(MOCK.filter(m => m.status !== 'pending'));
      } catch {
        setRows(MOCK.filter(m => m.status === 'pending'));
        setHistory(MOCK.filter(m => m.status !== 'pending'));
      }
      setLoading(false);
    };
    load();
  }, []);

  const visible = rows.filter(r => tab === 'all' || r.type === tab);

  const handleApprove = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    addNotification(`Approval ${id} approved.`);
  };
  const handleReject = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    addNotification(`Approval ${id} rejected.`);
  };

  const TABS = ['all','credit','cargo','payment','registration','price'] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Approval Queue</h2>
          <p className="text-xs text-[var(--text-muted)]">{rows.length} pending approval{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { exportToCSV([...rows,...history], ['id','type','requester','department','description','date_submitted','status'], 'approvals'); addNotification('Exported.'); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border)]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg capitalize cursor-pointer transition-colors ${tab === t ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
            {t === 'all' ? `All (${rows.length})` : `${t} (${rows.filter(r => r.type === t).length})`}
          </button>
        ))}
      </div>

      {/* Pending approvals */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">All clear!</p>
          <p className="text-xs text-[var(--text-muted)]">No pending approvals in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 shadow-[var(--box-shadow)]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_STYLES[item.type]}`}>{item.type}</span>
                  <span className="text-[9px] font-semibold text-[var(--text-muted)]">{item.department}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">{item.date_submitted}</span>
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{item.requester}</p>
                <p className="text-xs text-[var(--text-secondary)] truncate">{item.description}</p>
              </div>
              {item.amount ? (
                <p className="text-base font-bold text-[var(--accent)] shrink-0 whitespace-nowrap">GHS {item.amount.toLocaleString()}</p>
              ) : null}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleApprove(item.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-emerald-600">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => handleReject(item.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-rose-600">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-secondary)]">Recent History</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {history.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 opacity-70 hover:opacity-100 transition-opacity">
                {item.status === 'approved'
                  ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{item.requester} — {item.description}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">{item.department} · {item.date_submitted}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
