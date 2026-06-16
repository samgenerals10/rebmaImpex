// src/views/ceo/ApprovalsView.tsx
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Download } from 'lucide-react';
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

  const load = async () => {
    setLoading(true);
    try {
      // Query pending credit orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id,client_name,total_amount,created_at,status')
        .eq('payment_mode', 'CREDIT')
        .eq('status', 'PENDING_MANAGEMENT')
        .limit(50);

      // Query pending cargo intakes
      const { data: cargo } = await supabase
        .from('cargo_intake')
        .select('id,product_name,company,quantity,created_at,status')
        .eq('status', 'PENDING_APPROVAL')
        .limit(50);

      // Query pending registrations from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,full_name,role,created_at,status')
        .eq('status', 'PENDING_APPROVAL')
        .limit(50);

      const approvals: Approval[] = [
        ...(orders || []).map((o: any) => ({
          id: o.id,
          type: 'credit' as const,
          requester: o.client_name || 'Unknown Client',
          department: 'MARKETING',
          description: `Credit terms request for ${o.client_name}`,
          amount: Number(o.total_amount || 0),
          date_submitted: o.created_at?.split('T')[0] || '',
          status: 'pending' as const,
        })),
        ...(cargo || []).map((c: any) => ({
          id: c.id,
          type: 'cargo' as const,
          requester: c.company || 'Unknown Supplier',
          department: 'OPERATIONS',
          description: `Intake of ${c.product_name || 'Goods'} - Qty: ${c.quantity || 0}`,
          date_submitted: c.created_at?.split('T')[0] || '',
          status: 'pending' as const,
        })),
        ...(profiles || []).map((p: any) => ({
          id: p.id,
          type: 'registration' as const,
          requester: p.full_name || 'New Employee',
          department: 'HR',
          description: `Sign-up approval for role: ${p.role}`,
          date_submitted: p.created_at?.split('T')[0] || '',
          status: 'pending' as const,
        })),
      ];

      setRows(approvals);

      // Load history from global audit logs
      const { data: auditLogs } = await supabase
        .from('global_audit_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      const historyLogs: Approval[] = (auditLogs || []).map((log: any) => ({
        id: log.id,
        type: log.action.toLowerCase().includes('price') ? 'price'
              : log.action.toLowerCase().includes('cargo') ? 'cargo'
              : log.action.toLowerCase().includes('payment') ? 'payment'
              : log.action.toLowerCase().includes('credit') ? 'credit'
              : 'registration',
        requester: log.performed_by || 'System',
        department: log.department || 'GENERAL',
        description: log.details || log.action,
        date_submitted: log.timestamp ? log.timestamp.split('T')[0] : '',
        status: log.action.toLowerCase().includes('reject') ? 'rejected' : 'approved',
      }));

      setHistory(historyLogs);
    } catch (e) {
      console.error('Error loading approvals queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = rows.filter(r => tab === 'all' || r.type === tab);

  const handleApprove = async (id: string) => {
    const item = rows.find(r => r.id === id);
    if (!item) return;
    try {
      if (item.type === 'credit') {
        await supabase.from('orders').update({ status: 'APPROVED' }).eq('id', id);
      } else if (item.type === 'cargo') {
        await supabase.from('cargo_intake').update({ status: 'APPROVED' }).eq('id', id);
      } else if (item.type === 'registration') {
        await supabase.from('profiles').update({ status: 'ACTIVE' }).eq('id', id);
      }

      await supabase.from('global_audit_history').insert({
        action: `Approved ${item.type} request`,
        department: item.department,
        performed_by: currentUser?.fullName || 'CEO',
        details: item.description,
      });

      addNotification(`Approved ${item.type} request successfully.`);
      setRows(prev => prev.filter(r => r.id !== id));
      load(); // Refresh queue and history
    } catch (e) {
      console.error(e);
      addNotification('Approval action failed.');
    }
  };

  const handleReject = async (id: string) => {
    const item = rows.find(r => r.id === id);
    if (!item) return;
    try {
      if (item.type === 'credit') {
        await supabase.from('orders').update({ status: 'REJECTED' }).eq('id', id);
      } else if (item.type === 'cargo') {
        await supabase.from('cargo_intake').update({ status: 'REJECTED' }).eq('id', id);
      } else if (item.type === 'registration') {
        await supabase.from('profiles').update({ status: 'REJECTED' }).eq('id', id);
      }

      await supabase.from('global_audit_history').insert({
        action: `Rejected ${item.type} request`,
        department: item.department,
        performed_by: currentUser?.fullName || 'CEO',
        details: item.description,
      });

      addNotification(`Rejected ${item.type} request.`);
      setRows(prev => prev.filter(r => r.id !== id));
      load(); // Refresh queue and history
    } catch (e) {
      console.error(e);
      addNotification('Rejection action failed.');
    }
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
        <div className="flex flex-col items-center py-16 text-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
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
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${TYPE_STYLES[item.type] || 'bg-slate-100 text-slate-700'}`}>{item.type}</span>
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
      {history.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 text-center text-xs text-[var(--text-muted)]">
          No approval history logged in audit logs.
        </div>
      ) : (
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
