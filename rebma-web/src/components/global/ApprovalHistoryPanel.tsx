// rebma-web/src/components/global/ApprovalHistoryPanel.tsx
// Dept-scoped "previous approvals" list, sourced from global_audit_history —
// every approval flow in the app already logs there (Cargo Intake, Credit
// Order, Production Request, Material Requisition, Float Request, etc.), so
// this reads it back for whichever department is doing the approving today
// (CEO already had an inline version of this; Management and Finance didn't).
import { useEffect, useState, useCallback } from 'react';
import { History, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  department: string;
  title?: string;
}

interface HistoryRow {
  id: string;
  action: string;
  details: string | null;
  performed_by: string | null;
  timestamp: string;
}

export default function ApprovalHistoryPanel({ department, title = 'Previous Approvals' }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .eq('department', department)
        .order('timestamp', { ascending: false })
        .limit(30);
      setRows(data || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [department]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('approval-history-' + department.toLowerCase() + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_audit_history' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, department]);

  if (!loading && rows.length === 0) return null;

  const visible = expanded ? rows : rows.slice(0, 5);

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--box-shadow)', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <History size={15} color="var(--text-muted)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
      </div>
      <div>
        {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 20px' }}>Loading…</p>}
        {!loading && visible.map(row => {
          const isReject = /reject/i.test(row.action);
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
              {isReject
                ? <XCircle size={14} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                : <CheckCircle size={14} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{row.action}</p>
                {row.details && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{row.details}</p>}
                <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                  {row.performed_by || 'System'} · {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {rows.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'var(--bg-input)', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {expanded ? <>Show less <ChevronUp size={13} /></> : <>Show all {rows.length} <ChevronDown size={13} /></>}
        </button>
      )}
    </div>
  );
}
