// Cross-department real-time activity feed reading from global_audit_history
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Activity, RefreshCw, User, Clock, Lock } from 'lucide-react';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import SearchableDropdown from '../ui/SearchableDropdown';

interface AuditEntry {
  id: string;
  action: string;
  department: string;
  performedBy: string;
  userId: string;
  details: string;
  timestamp: string;
}

const DEPT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  OPERATIONS:  { bg: '#f0fdf4', text: '#166534', dot: '#16a34a' },
  FINANCE:     { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
  MARKETING:   { bg: '#fefce8', text: '#854d0e', dot: '#f59e0b' },
  MANAGEMENT:  { bg: '#faf5ff', text: '#6b21a8', dot: '#9333ea' },
  DISPATCH:    { bg: '#fff7ed', text: '#9a3412', dot: '#ea580c' },
  PRODUCTION:  { bg: '#f0f9ff', text: '#0c4a6e', dot: '#0284c7' },
  HR:          { bg: '#fdf2f8', text: '#831843', dot: '#db2777' },
  CEO:         { bg: '#f8fafc', text: '#1e293b', dot: '#334155' },
  LOGISTICS:   { bg: '#ecfdf5', text: '#065f46', dot: '#059669' },
};

const ACTION_ICONS: Record<string, string> = {
  LOG_PORT_INTAKE: '📦',
  APPROVE_CARGO:   '✅',
  REJECT_CARGO:    '❌',
  DISPATCH_ORDER:  '🚚',
  APPROVE_ORDER:   '✅',
  REJECT_ORDER:    '❌',
  CREATE_ORDER:    '🛒',
  LOG_PAYMENT:     '💳',
  APPROVE_PAYMENT: '✅',
  STOCK_ADJUST:    '📊',
  STOCK_REMOVE:    '📤',
  STOCK_ADD:       '📥',
  CREATE_INVOICE:  '🧾',
  PRINT_TICKET:    '🎫',
};

function fmtAgo(iso: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

interface Props {
  /** Filter to specific departments — omit for all */
  departments?: string[];
  /** Max number of entries to show */
  limit?: number;
  /** Compact single-column mode */
  compact?: boolean;
  title?: string;
  /** Viewer's own department/isAdmin — used to enforce audit_log_access */
  viewerDepartment?: string;
  viewerIsAdmin?: boolean;
}

export default function ActivityFeed({ departments, limit = 30, compact = false, title = 'Live Activity Feed', viewerDepartment, viewerIsAdmin }: Props) {
  const { getSetting } = useCeoSettings();
  const accessLevel = getSetting('audit_log_access', 'management_and_above');
  const isManagementOrAbove = viewerDepartment === 'MANAGEMENT' || viewerDepartment === 'CEO';
  // ceo_only is implicitly covered — only viewerIsAdmin ever satisfies it.
  const accessAllowed = !!viewerIsAdmin
    || accessLevel === 'all_staff'
    || (accessLevel === 'management_and_above' && isManagementOrAbove);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Stable string key so inline array literals don't trigger infinite re-renders
  const deptsKey = departments ? [...departments].sort().join(',') : '';

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('global_audit_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit * 2);

      if (deptsKey) {
        q = q.in('department', deptsKey.split(','));
      }

      const { data } = await q;
      const mapped: AuditEntry[] = (data || []).map((r: any) => ({
        id: String(r.id),
        action: r.action || '',
        department: r.department || 'SYSTEM',
        performedBy: r.performed_by || r.user_id || 'Unknown',
        userId: r.user_id || '',
        details: r.details || '',
        timestamp: r.timestamp || r.created_at || '',
      }));
      setEntries(mapped);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('ActivityFeed load error', e);
    }
    setLoading(false);
  }, [deptsKey, limit]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Deterministic name keyed by filter — instances with the same
  // deptsKey+limit now genuinely share one subscription instead of each
  // minting its own random-suffixed channel.
  useRealtimeChannel(
    `activity-feed-${deptsKey || 'all'}-${limit}`,
    [{ table: 'global_audit_history', event: 'INSERT' }],
    (_table, payload) => {
      const r = payload.new as any;
      if (deptsKey && !deptsKey.split(',').includes(r.department)) return;
      const entry: AuditEntry = {
        id: String(r.id),
        action: r.action || '',
        department: r.department || 'SYSTEM',
        performedBy: r.performed_by || r.user_id || 'Unknown',
        userId: r.user_id || '',
        details: r.details || '',
        timestamp: r.timestamp || r.created_at || '',
      };
      setEntries(prev => [entry, ...prev].slice(0, limit));
    }
  );

  const allDepts = ['ALL', ...Array.from(new Set(entries.map(e => e.department))).sort()];

  const filtered = entries
    .filter(e => deptFilter === 'ALL' || e.department === deptFilter)
    .slice(0, limit);

  if (!accessAllowed) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] p-6 flex flex-col items-center text-center gap-2">
        <Lock size={18} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)]">The audit log is currently restricted by the CEO to {accessLevel === 'ceo_only' ? 'the CEO only' : 'Management and above'}.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[var(--accent)]" />
            <span className="text-xs font-bold text-[var(--text-primary)]">{title}</span>
          </div>
          <button onClick={loadEntries} className="text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-[var(--bg)] rounded-lg animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-4 text-xs text-[var(--text-muted)]">No activity yet</div>
        ) : filtered.map(e => {
          const dc = DEPT_COLORS[e.department] || DEPT_COLORS.CEO;
          return (
            <div key={e.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: dc.dot }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: dc.dot }}>{e.department}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">·</span>
                  <span className="text-[9px] text-[var(--text-muted)]">{fmtAgo(e.timestamp)}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">{e.details}</p>
                <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                  <User size={8} /> {e.performedBy}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
            <Activity size={14} className="text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
            <p className="text-[10px] text-[var(--text-muted)]">
              Updated {fmtAgo(lastRefresh.toISOString())} · {filtered.length} entries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Department filter */}
          <SearchableDropdown
            value={deptFilter}
            onChange={setDeptFilter}
            className="min-w-[140px] text-[10px]"
            options={allDepts.map(d => ({ value: d, label: d === 'ALL' ? 'All Departments' : d }))}
          />
          <button onClick={loadEntries} title="Refresh"
            className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer transition-colors text-[var(--text-muted)] hover:text-[var(--accent)]">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-[var(--border)] max-h-[480px] overflow-y-auto">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--bg)] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[var(--bg)] rounded animate-pulse w-1/3" />
                <div className="h-3 bg-[var(--bg)] rounded animate-pulse w-3/4" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)]">
            <Activity size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">No activity recorded yet</p>
          </div>
        ) : filtered.map(e => {
          const dc = DEPT_COLORS[e.department] || DEPT_COLORS.CEO;
          const icon = ACTION_ICONS[e.action] || '🔔';
          return (
            <div key={e.id} className="px-5 py-3 hover:bg-[var(--bg)] transition-colors group">
              <div className="flex items-start gap-3">
                {/* Icon dot */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: dc.bg, border: `1.5px solid ${dc.dot}30` }}>
                  {icon}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: dc.bg, color: dc.text }}>
                      {e.department}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                      {e.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] ml-auto flex items-center gap-1">
                      <Clock size={8} />{fmtAgo(e.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-snug">{e.details}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <User size={9} className="text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)]">{e.performedBy}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {filtered.length >= limit && (
        <div className="px-5 py-3 border-t border-[var(--border)] text-center">
          <p className="text-[10px] text-[var(--text-muted)]">Showing latest {limit} entries</p>
        </div>
      )}
    </div>
  );
}
