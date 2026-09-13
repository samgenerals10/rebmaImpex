// rebma-web/src/components/global/RequestTimelinePanel.tsx
//
// A different question than ApprovalHistoryPanel.tsx: that one answers "what
// has my department decided lately" (flat, dept-filtered). This answers
// "what happened to THIS ONE request" — filtered by reference_id, no
// department filter, chronological ascending, so one cargo intake's row can
// carry Operations' submission, Risk's return, Operations' resubmission,
// and Risk's approval on one connected list, even though those decisions
// were made by different departments (Phase 6).
import { useEffect, useState, useCallback } from 'react';
import { History, CheckCircle, XCircle, RotateCcw, ArrowUpCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import SidePanel from '../ui/SidePanel';

interface Props {
  open: boolean;
  onClose: () => void;
  referenceId: string;
  displayId?: string;
}

interface TimelineRow {
  id: string;
  action: string;
  department: string;
  performed_by: string | null;
  details: string | null;
  timestamp: string;
}

function iconFor(action: string) {
  if (/reject/i.test(action)) return { Icon: XCircle, color: '#dc2626' };
  if (/return/i.test(action)) return { Icon: RotateCcw, color: '#f97316' };
  if (/escalate/i.test(action)) return { Icon: ArrowUpCircle, color: '#6366f1' };
  if (/approve/i.test(action)) return { Icon: CheckCircle, color: '#059669' };
  return { Icon: Clock, color: 'var(--text-muted)' };
}

export default function RequestTimelinePanel({ open, onClose, referenceId, displayId }: Props) {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!referenceId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .eq('reference_id', referenceId)
        .order('timestamp', { ascending: true });
      setRows(data || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [referenceId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useRealtimeChannel(
    'request-timeline-' + (referenceId || 'none'),
    [{ table: 'global_audit_history', event: 'INSERT' }],
    () => { if (open) load(); }
  );

  return (
    <SidePanel open={open} onClose={onClose} title="Request Timeline" subtitle={displayId}>
      <div className="p-5">
        {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}
        {!loading && rows.length === 0 && (
          <div className="text-center py-8">
            <History size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No timeline entries yet for this request.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Decisions recorded before this feature shipped are not linked.</p>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" />
            <div className="space-y-5">
              {rows.map(row => {
                const { Icon, color } = iconFor(row.action);
                return (
                  <div key={row.id} className="relative">
                    <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{row.action}</p>
                    {row.details && <p className="text-xs text-[var(--text-secondary)] mt-1">{row.details}</p>}
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {row.performed_by || 'System'} · {row.department} · {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
