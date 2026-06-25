import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, AlertCircle, CheckCircle, Clock, X, Bell,
  TrendingDown, UserX, Calendar, MessageSquare, Filter, Search
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

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

const MOCK_ALERTS: PerformanceAlert[] = [
  { id: '1', staffName: 'Efua Tetteh', department: 'Finance', role: 'Accountant', issue: 'Account suspended — pending review', details: 'Staff account was suspended on 2026-05-20 due to policy violation. HR review in progress.', level: 'critical', status: 'IN_REVIEW', createdAt: '2026-05-20' },
  { id: '2', staffName: 'Yaw Darko', department: 'Marketing', role: 'Marketing Lead', issue: 'Excessive absences (4 this month)', details: 'Employee has recorded 4 unscheduled absences in June 2026. Attendance rate has dropped to 72%.', level: 'high', status: 'OPEN', createdAt: '2026-06-10' },
  { id: '3', staffName: 'Kojo Amponsah', department: 'Logistics', role: 'Driver', issue: 'Late check-ins 3× this week', details: 'Employee checked in more than 30 minutes late on Mon, Wed, Fri this week. No approved leave on record.', level: 'medium', status: 'OPEN', createdAt: '2026-06-12' },
  { id: '4', staffName: 'Adwoa Sarpong', department: 'Operations', role: 'Operations Officer', issue: 'Task completion below target', details: 'Q2 task completion rate at 68%, below the 85% departmental target. Manager notified.', level: 'medium', status: 'OPEN', createdAt: '2026-06-08' },
  { id: '5', staffName: 'Kwesi Ofori', department: 'Marketing', role: 'Sales Representative', issue: 'Sales target missed 2 months in a row', details: 'April and May sales targets not met. Sales figures at 58% and 61% of quota respectively.', level: 'high', status: 'IN_REVIEW', createdAt: '2026-06-01' },
  { id: '6', staffName: 'Nana Agyei', department: 'Production', role: 'Production Supervisor', issue: 'Minor attendance issue resolved', details: 'Previous late arrival issue from March has been addressed. Staff returned to full attendance.', level: 'low', status: 'RESOLVED', createdAt: '2026-03-15', resolvedAt: '2026-04-01', resolvedBy: 'HR Admin' },
];

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
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
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
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as any)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs">
          {['All', 'critical', 'high', 'medium', 'low'].map(l => <option key={l} value={l}>{l === 'All' ? 'All Levels' : l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs">
          {['All', 'OPEN', 'IN_REVIEW', 'RESOLVED'].map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace('_', ' ')}</option>)}
        </select>
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
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Alert Detail</h3>
              <button onClick={() => setSelected(null)} className="text-[var(--text-muted)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
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
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add resolution notes..."
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm resize-none outline-none" />
                <div className="flex gap-2">
                  {selected.status === 'OPEN' && (
                    <button onClick={() => handleUpdateStatus(selected, 'IN_REVIEW')}
                      className="flex-1 py-2 bg-[var(--accent-light)] text-[var(--accent)] rounded-xl text-xs font-semibold cursor-pointer hover:opacity-80">
                      Mark In Review
                    </button>
                  )}
                  <button onClick={() => handleUpdateStatus(selected, 'RESOLVED')}
                    className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-xl text-xs font-semibold cursor-pointer hover:bg-emerald-500/20">
                    Mark Resolved
                  </button>
                </div>
              </div>
            )}
            {selected.resolvedAt && (
              <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Resolved on {selected.resolvedAt} by {selected.resolvedBy}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
