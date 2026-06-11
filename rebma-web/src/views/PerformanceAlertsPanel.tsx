// src/views/PerformanceAlertsPanel.tsx
import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, Check, Info } from 'lucide-react';
import { fetchPerformanceAlerts, runPerformanceAlerts, resolveAlert, type PerformanceAlert } from '../utils/performanceAlerts';
import type { CurrentUser } from '../types/erp';

interface Props {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const SEV_CONFIG = {
  critical: { color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200',     icon: AlertCircle, label: 'Critical' },
  high:     { color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle, label: 'High' },
  medium:   { color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',   icon: AlertTriangle, label: 'Medium' },
  low:      { color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',     icon: Info, label: 'Low' },
};

export default function PerformanceAlertsPanel({ currentUser, addNotification }: Props) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unresolved'>('unresolved');

  const load = async () => {
    setLoading(true);
    const data = await fetchPerformanceAlerts();
    setAlerts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async () => {
    setRunning(true);
    const newAlerts = await runPerformanceAlerts();
    addNotification(`Alert check complete — ${newAlerts.length} alert(s) triggered.`);
    await load();
    setRunning(false);
  };

  const resolve = async (id: string) => {
    if (!id) return;
    await resolveAlert(id);
    addNotification('Alert resolved.');
    await load();
  };

  const visible = alerts.filter(a => filter === 'all' || !a.resolved);
  const unresolvedCount = alerts.filter(a => !a.resolved).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Performance Alerts</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Automatic monitoring — department activity, attendance, and finance thresholds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-xl overflow-hidden text-[10px] font-semibold">
            {([['unresolved','Unresolved'],['all','All']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${filter === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {l} {v === 'unresolved' && unresolvedCount > 0 && `(${unresolvedCount})`}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            Run Check
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">All clear</p>
          <p className="text-xs text-[var(--text-muted)]">No {filter === 'unresolved' ? 'unresolved ' : ''}alerts. Run a check to refresh.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((alert, i) => {
            const sev = SEV_CONFIG[alert.severity] || SEV_CONFIG.low;
            const Icon = sev.icon;
            return (
              <div key={alert.id || i} className={`border rounded-2xl p-4 shadow-sm ${alert.resolved ? 'opacity-50' : ''} ${sev.bg}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${sev.bg}`}>
                    <Icon className={`w-4 h-4 ${sev.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{alert.title}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sev.bg} ${sev.color}`}>{sev.label}</span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)]">{alert.department}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{alert.description}</p>
                    {alert.threshold_value !== undefined && alert.actual_value !== undefined && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        Threshold: {alert.threshold_value} · Actual: {alert.actual_value}
                      </p>
                    )}
                    {alert.created_at && (
                      <p className="text-[9px] text-[var(--text-muted)] mt-1">
                        {new Date(alert.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    )}
                  </div>
                  {!alert.resolved && alert.id && (
                    <button onClick={() => resolve(alert.id!)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-emerald-500 text-white rounded-lg cursor-pointer hover:bg-emerald-600">
                      <Check className="w-3 h-3" /> Resolve
                    </button>
                  )}
                  {alert.resolved && <span className="text-[9px] font-bold text-emerald-600 shrink-0">Resolved</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supabase table hint */}
      <div className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text-muted)]">
        <p className="font-bold text-[var(--text-secondary)] mb-1">Supabase Table Required</p>
        Create <code className="bg-[var(--border)] px-1 rounded">performance_alerts</code> with columns: <code className="bg-[var(--border)] px-1 rounded">id uuid primary key default gen_random_uuid(), alert_type text, department text, severity text, title text, description text, threshold_value numeric, actual_value numeric, resolved boolean default false, created_at timestamptz default now()</code>. Enable RLS — authenticated users can SELECT; service role can INSERT/UPDATE.
      </div>
    </div>
  );
}
