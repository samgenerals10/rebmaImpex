import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, AlertCircle, CheckCircle, Clock, Bell,
  TrendingDown, UserX, Calendar, MessageSquare, Filter, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';
import CountUp from '../../components/CountUp';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';

type AlertLevel = 'critical' | 'high' | 'medium' | 'low';
type AlertStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

interface PerformanceAlert {
  id: string;
  staffName: string;
  department: string;
  role: string;
  issue: string;
  details: string;
  level: AlertLevel;
  status: AlertStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}


const LEVEL_CONFIG: Record<AlertLevel, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  critical: { bg: 'rgba(220,38,38,0.12)', color: '#dc2626', icon: <AlertTriangle className="w-4 h-4" />, label: 'Critical' },
  high: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', icon: <AlertCircle className="w-4 h-4" />, label: 'High' },
  medium: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', icon: <Clock className="w-4 h-4" />, label: 'Medium' },
  low: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', icon: <Bell className="w-4 h-4" />, label: 'Low' },
};

const STATUS_CONFIG: Record<AlertStatus, { bg: string; color: string; label: string }> = {
  OPEN: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Open' },
  IN_REVIEW: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: 'In Review' },
  RESOLVED: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Resolved' },
};

interface Props {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

export default function PerformanceAlertsView({ currentUser, addNotification }: Props) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'All' | AlertLevel>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | AlertStatus>('All');
  const [selected, setSelected] = useState<PerformanceAlert | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('performance_alerts')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) {
          const mapped: PerformanceAlert[] = data.map((p: any) => ({
            id: p.id,
            staffName: p.title || 'System Alert',
            department: p.department || 'General',
            role: p.alert_type || 'alert',
            issue: p.alert_type ? p.alert_type.replace('_', ' ').toUpperCase() : 'ALERT',
            details: p.description || '',
            level: (p.severity || 'medium') as AlertLevel,
            status: p.resolved ? 'RESOLVED' : 'OPEN',
            createdAt: p.created_at ? p.created_at.split('T')[0] : '',
            notes: p.notes || ''
          }));
          setAlerts(mapped);
        }
      } catch (err: any) {
        addNotification(`Error loading performance alerts: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = alerts.filter(a => {
    const matchSearch = a.staffName.toLowerCase().includes(search.toLowerCase()) ||
      a.department.toLowerCase().includes(search.toLowerCase()) ||
      a.issue.toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === 'All' || a.level === levelFilter;
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchSearch && matchLevel && matchStatus;
  });

  const counts = {
    total: alerts.length,
    critical: alerts.filter(a => a.level === 'critical').length,
    open: alerts.filter(a => a.status === 'OPEN').length,
    resolved: alerts.filter(a => a.status === 'RESOLVED').length,
  };

  const handleUpdateStatus = async (alert: PerformanceAlert, status: AlertStatus) => {
    if (submitting) return;
    setSubmitting(true);
    const isResolved = status === 'RESOLVED';
    try {
      const { error } = await supabase
        .from('performance_alerts')
        .update({ 
          resolved: isResolved,
          notes: notes || alert.notes
        })
        .eq('id', alert.id);
      if (error) throw error;

      await supabase.from('global_audit_history').insert([{
        department: 'HR',
        action: `Performance alert ${isResolved ? 'resolved' : 'updated'}: ${alert.staffName}`,
        performed_by: currentUser?.fullName || 'HR Admin',
        timestamp: new Date().toISOString(),
      }]);

      const updated: PerformanceAlert = {
        ...alert,
        status,
        notes: notes || alert.notes,
        resolvedAt: isResolved ? new Date().toISOString().split('T')[0] : alert.resolvedAt,
        resolvedBy: isResolved ? (currentUser?.fullName || 'HR Admin') : alert.resolvedBy,
      };

      setAlerts(prev => prev.map(a => a.id === alert.id ? updated : a));
      if (selected?.id === alert.id) setSelected(updated);
      addNotification(`Alert for ${alert.staffName} marked as ${status}`);
      setNotes('');
    } catch (err: any) {
      addNotification(`Error updating alert status: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Performance Alerts
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Monitor and resolve staff performance issues</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Alerts', value: counts.total, color: 'var(--accent)' },
          { label: 'Critical', value: counts.critical, color: '#dc2626' },
          { label: 'Open', value: counts.open, color: '#f59e0b' },
          { label: 'Resolved', value: counts.resolved, color: '#10b981' },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3.5">
            <p className="text-2xl font-bold" style={{ color: card.color }}><CountUp value={card.value} /></p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff, dept, issue..."
            className="bg-transparent border-none outline-none text-[var(--text-primary)] text-xs w-full" />
        </div>
        <SearchableDropdown
          value={levelFilter}
          onChange={v => setLevelFilter(v as any)}
          options={['All', 'critical', 'high', 'medium', 'low'].map(l => ({ value: l, label: l === 'All' ? 'All Levels' : l.charAt(0).toUpperCase() + l.slice(1) }))}
          className="w-36"
        />
        <SearchableDropdown
          value={statusFilter}
          onChange={v => setStatusFilter(v as any)}
          options={['All', 'OPEN', 'IN_REVIEW', 'RESOLVED'].map(s => ({ value: s, label: s === 'All' ? 'All Statuses' : s.replace('_', ' ') }))}
          className="w-40"
        />
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 animate-pulse h-24 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No alerts found</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">All clear — no performance issues match your filters</p>
          </div>
        ) : (
          filtered.map(alert => {
            const lc = LEVEL_CONFIG[alert.level];
            const sc = STATUS_CONFIG[alert.status];
            return (
              <div key={alert.id}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(alert)}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: lc.bg, color: lc.color }}>
                    {lc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-[var(--text-primary)]">{alert.staffName}</span>
                      <span className="text-xs text-[var(--text-muted)]">· {alert.department}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: lc.bg, color: lc.color }}>
                        {lc.label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] font-medium">{alert.issue}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{alert.details}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {alert.createdAt}
                      </span>
                      {alert.resolvedAt && (
                        <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Resolved {alert.resolvedAt} by {alert.resolvedBy}
                        </span>
                      )}
                    </div>
                  </div>
                  {alert.status !== 'RESOLVED' && (
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {alert.status === 'OPEN' && (
                        <button onClick={() => handleUpdateStatus(alert, 'IN_REVIEW')}
                          className="text-xs px-2 py-1 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg font-semibold cursor-pointer hover:opacity-80">
                          Review
                        </button>
                      )}
                      <button onClick={() => handleUpdateStatus(alert, 'RESOLVED')}
                        className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-semibold cursor-pointer hover:bg-emerald-500/20">
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail modal */}
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Alert Detail"
      >
        {selected && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-lg shrink-0">
                {selected.staffName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)]">{selected.staffName}</p>
                <p className="text-xs text-[var(--text-muted)]">{selected.role} · {selected.department}</p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: LEVEL_CONFIG[selected.level].bg, color: LEVEL_CONFIG[selected.level].color }}>
                {LEVEL_CONFIG[selected.level].label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_CONFIG[selected.status].bg, color: STATUS_CONFIG[selected.status].color }}>
                {STATUS_CONFIG[selected.status].label}
              </span>
            </div>
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] mb-3">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{selected.issue}</p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{selected.details}</p>
            </div>
            {selected.notes && (
              <div className="bg-[var(--accent-light)] rounded-xl p-3 border border-[var(--border)] mb-3">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">HR Notes</p>
                <p className="text-xs text-[var(--text-primary)]">{selected.notes}</p>
              </div>
            )}
            {selected.status !== 'RESOLVED' && (
              <div className="space-y-2">
                <label className="block text-xs text-[var(--text-secondary)] font-semibold">Add Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add resolution notes..." disabled={submitting}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm resize-none outline-none disabled:opacity-50" />
                <div className="flex gap-2">
                  {selected.status === 'OPEN' && (
                    <button onClick={() => handleUpdateStatus(selected, 'IN_REVIEW')} disabled={submitting}
                      className="flex-1 py-2 bg-[var(--accent-light)] text-[var(--accent)] rounded-xl text-xs font-semibold cursor-pointer hover:opacity-80 disabled:opacity-50">
                      Mark In Review
                    </button>
                  )}
                  <button onClick={() => handleUpdateStatus(selected, 'RESOLVED')} disabled={submitting}
                    className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-xl text-xs font-semibold cursor-pointer hover:bg-emerald-500/20 disabled:opacity-50">
                    {submitting ? 'Updating...' : 'Mark Resolved'}
                  </button>
                </div>
              </div>
            )}
            {selected.resolvedAt && (
              <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Resolved on {selected.resolvedAt} by {selected.resolvedBy}
              </p>
            )}
          </>
        )}
      </SidePanel>
    </div>
  );
}
