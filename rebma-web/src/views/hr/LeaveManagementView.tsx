import React, { useState, useEffect } from 'react';
import { Plus, X, CheckCircle, XCircle, Clock, Calendar, Users, Filter, LayoutList, CalendarDays, Wallet, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';

interface LeaveRequest {
  id: string;
  employeeName: string;
  department: string;
  leaveType: 'Annual' | 'Sick' | 'Personal' | 'Emergency';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}


const DEPARTMENTS = ['All', 'Operations', 'Finance', 'Logistics', 'HR', 'Marketing', 'Reception', 'Production', 'Management'];
const LEAVE_TYPES = ['All', 'Annual', 'Sick', 'Personal', 'Emergency'];
const STATUSES = ['All', 'PENDING', 'APPROVED', 'REJECTED'];

const leaveTypeBadge = (type: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Annual: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    Sick: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    Personal: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    Emergency: { bg: 'rgba(220,38,38,0.15)', color: '#dc2626' },
  };
  return map[type] || { bg: 'var(--bg)', color: 'var(--text-secondary)' };
};

const statusBadge = (status: string) => {
  if (status === 'APPROVED') return { bg: 'rgba(16,185,129,0.12)', color: '#10b981' };
  if (status === 'REJECTED') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
  return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
};

interface Props {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const LEAVE_BALANCES = [
  { name: 'Kwame Mensah', dept: 'Operations', annual: 21, used: 5, sick: 10, usedSick: 2 },
  { name: 'Abena Owusu', dept: 'Finance', annual: 21, used: 7, sick: 10, usedSick: 4 },
  { name: 'Kofi Asante', dept: 'Logistics', annual: 21, used: 1, sick: 10, usedSick: 0 },
  { name: 'Ama Boateng', dept: 'HR', annual: 21, used: 3, sick: 10, usedSick: 1 },
  { name: 'Yaw Darko', dept: 'Marketing', annual: 21, used: 8, sick: 10, usedSick: 3 },
  { name: 'Nana Agyei', dept: 'Production', annual: 21, used: 4, sick: 10, usedSick: 5 },
  { name: 'Kojo Amponsah', dept: 'Logistics', annual: 21, used: 2, sick: 10, usedSick: 1 },
  { name: 'Adwoa Sarpong', dept: 'Operations', annual: 21, used: 0, sick: 10, usedSick: 0 },
];

function CalendarView({ leaves }: { leaves: LeaveRequest[] }) {
  const today = new Date('2026-06-14');
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

  const leavesThisMonth = leaves.filter(l => {
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    return l.status === 'APPROVED' && (start.getMonth() === month || end.getMonth() === month);
  });

  const getLeaveForDay = (day: number) => {
    const date = new Date(year, month, day);
    return leavesThisMonth.filter(l => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      return date >= start && date <= end;
    });
  };

  const typeColor: Record<string, string> = { Annual: '#6366f1', Sick: '#ef4444', Personal: '#f59e0b', Emergency: '#dc2626' };

  return (
    <div>
      <h3 className="font-bold text-[var(--text-primary)] mb-4">{monthName}</h3>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-[var(--text-muted)] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayLeaves = getLeaveForDay(day);
          const isToday = day === today.getDate();
          return (
            <div key={day}
              className={`min-h-14 rounded-xl p-1 border text-xs ${isToday ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] bg-[var(--bg)]'}`}>
              <div className={`text-right font-bold mb-0.5 ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{day}</div>
              <div className="space-y-0.5">
                {dayLeaves.slice(0, 2).map((l, li) => (
                  <div key={li} className="text-[9px] font-semibold px-1 py-0.5 rounded truncate"
                    style={{ background: `${typeColor[l.leaveType] || 'var(--accent)'}20`, color: typeColor[l.leaveType] || 'var(--accent)' }}>
                    {l.employeeName.split(' ')[0]}
                  </div>
                ))}
                {dayLeaves.length > 2 && (
                  <div className="text-[9px] text-[var(--text-muted)] px-1">+{dayLeaves.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const mapToUI = (db: any): LeaveRequest => ({
  id: db.id,
  employeeName: db.staff_name || '',
  department: db.department || '',
  leaveType: (db.leave_type || 'Annual') as LeaveRequest['leaveType'],
  startDate: db.start_date || '',
  endDate: db.end_date || '',
  days: db.days_count || 0,
  reason: db.reason || '',
  status: (db.status || 'PENDING') as LeaveRequest['status'],
  rejectionReason: db.rejection_reason
});

const mapToDB = (ui: Partial<LeaveRequest>) => {
  const db: any = {};
  if (ui.id !== undefined) db.id = ui.id;
  if (ui.employeeName !== undefined) db.staff_name = ui.employeeName;
  if (ui.department !== undefined) db.department = ui.department;
  if (ui.leaveType !== undefined) db.leave_type = ui.leaveType;
  if (ui.startDate !== undefined) db.start_date = ui.startDate;
  if (ui.endDate !== undefined) db.end_date = ui.endDate;
  if (ui.days !== undefined) db.days_count = ui.days;
  if (ui.reason !== undefined) db.reason = ui.reason;
  if (ui.status !== undefined) db.status = ui.status;
  if (ui.rejectionReason !== undefined) db.rejection_reason = ui.rejectionReason;
  return db;
};

export default function LeaveManagementView({ currentUser, addNotification }: Props) {
  const [activeTab, setActiveTab] = useState<'requests' | 'calendar' | 'balances'>('requests');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deptFilter, setDeptFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<LeaveRequest | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ employeeName: '', department: 'Operations', leaveType: 'Annual' as LeaveRequest['leaveType'], startDate: '', endDate: '', reason: '' });
  const [viewLeave, setViewLeave] = useState<LeaveRequest | null>(null);

  const canApprove = currentUser?.isAdmin || currentUser?.department === 'HR';

  useEffect(() => {
    const load = async () => {
      setLoadingLeaves(true);
      try {
        const { data } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
        if (data) setLeaves(data.map(mapToUI));
      } catch {
        // show empty state
      }
      setLoadingLeaves(false);
    };
    load();
  }, []);

  const filtered = leaves.filter(l => {
    const matchDept = deptFilter === 'All' || l.department === deptFilter;
    const matchType = typeFilter === 'All' || l.leaveType === typeFilter;
    const matchStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchDept && matchType && matchStatus;
  });

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.floor(diff / 86400000) + 1);
  };

  const handleApprove = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('leave_requests').update({ status: 'APPROVED' }).eq('id', id);
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'APPROVED' } : l));
      addNotification('Leave request approved');
    } catch (e: any) {
      alert(e.message || 'Failed to approve request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('leave_requests').update({ status: 'REJECTED', rejection_reason: rejectReason }).eq('id', rejectId);
      setLeaves(prev => prev.map(l => l.id === rejectId ? { ...l, status: 'REJECTED', rejectionReason: rejectReason } : l));
      addNotification('Leave request rejected');
      setRejectId(null);
      setRejectReason('');
    } catch (e: any) {
      alert(e.message || 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const days = calcDays(form.startDate, form.endDate);
      const newLeave: LeaveRequest = { id: Date.now().toString(), ...form, days, status: 'PENDING' };
      const dbData = mapToDB(newLeave);
      const { error } = await supabase.from('leave_requests').insert([dbData]);
      if (!error) {
        setLeaves(prev => [newLeave, ...prev]);
        addNotification(`Leave request submitted for ${form.employeeName}`);
        setShowAdd(false);
        setForm({ employeeName: '', department: 'Operations', leaveType: 'Annual', startDate: '', endDate: '', reason: '' });
      } else {
        alert(error.message || 'Failed to submit leave request');
      }
    } catch (e: any) {
      alert(e.message || 'Error submitting leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (leave: LeaveRequest) => {
    setEditForm(leave);
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (!editForm) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const days = calcDays(editForm.startDate, editForm.endDate);
      const updated = { ...editForm, days };
      const dbData = mapToDB(updated);
      const { error } = await supabase.from('leave_requests').update(dbData).eq('id', editForm.id);
      if (!error) {
        setLeaves(prev => prev.map(l => l.id === editForm.id ? updated : l));
        addNotification(`Leave request updated for ${editForm.employeeName}`);
        setShowEdit(false);
        setEditForm(null);
      } else {
        alert(error.message || 'Failed to update leave request');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (submitting) return;
    if (!await confirm('Are you sure you want to delete this leave request?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id);
      if (!error) {
        setLeaves(prev => prev.filter(l => l.id !== id));
        addNotification('Leave request deleted');
      } else {
        alert(error.message || 'Failed to delete leave request');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPending = leaves.filter(l => l.status === 'PENDING').length;
  const totalApproved = leaves.filter(l => l.status === 'APPROVED').length;
  const onLeaveNow = leaves.filter(l => l.status === 'APPROVED' && l.startDate <= '2026-06-12' && l.endDate >= '2026-06-12').length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 22 }}>Leave Management</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Manage employee leave requests</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <Plus size={16} /> New Leave Request
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {[
          { id: 'requests' as const, label: 'Requests', icon: <LayoutList size={14} /> },
          { id: 'calendar' as const, label: 'Calendar', icon: <CalendarDays size={14} /> },
          { id: 'balances' as const, label: 'Leave Balances', icon: <Wallet size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13,
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)' }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'requests' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Requests', value: leaves.length, color: 'var(--accent)', icon: <Calendar size={18} /> },
          { label: 'Pending', value: totalPending, color: '#f59e0b', icon: <Clock size={18} /> },
          { label: 'Approved', value: totalApproved, color: '#10b981', icon: <CheckCircle size={18} /> },
          { label: 'On Leave Now', value: onLeaveNow, color: '#6366f1', icon: <Users size={18} /> },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }}>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }}>
          {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loadingLeaves ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)
        ) : null}
        {!loadingLeaves && filtered.map(leave => {
          const ltc = leaveTypeBadge(leave.leaveType);
          const sc = statusBadge(leave.status);
          return (
            <div key={leave.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setViewLeave(leave)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{leave.employeeName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{leave.department}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ltc.bg, color: ltc.color }}>{leave.leaveType}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{leave.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {leave.startDate} → {leave.endDate}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{leave.days} day{leave.days !== 1 ? 's' : ''}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{leave.reason}</p>
                  {leave.rejectionReason && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>Rejection reason: {leave.rejectionReason}</p>
                  )}
                </div>
                {canApprove && leave.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleApprove(leave.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 1rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button onClick={() => setRejectId(leave.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, marginLeft: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleEditClick(leave)}
                    style={{ padding: '0.4rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)' }}
                    title="Edit Request">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDeleteClick(leave.id)}
                    style={{ padding: '0.4rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}
                    title="Delete Request">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {rejectId === leave.id && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    rows={2}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button onClick={handleReject}
                      style={{ padding: '0.4rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      Confirm Reject
                    </button>
                    <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                      style={{ padding: '0.4rem 1rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!loadingLeaves && filtered.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
            {leaves.length === 0 ? 'No leave requests yet — they will appear here once submitted' : 'No leave requests found'}
          </div>
        )}
      </div>
      </>}

      {activeTab === 'calendar' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', border: '1px solid var(--border)' }}>
          <CalendarView leaves={leaves} />
        </div>
      )}

      {activeTab === 'balances' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Leave Balances — {new Date().getFullYear()}</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Employee', 'Department', 'Annual (Total)', 'Annual (Used)', 'Annual (Remaining)', 'Sick (Total)', 'Sick (Used)', 'Sick (Remaining)'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEAVE_BALANCES.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{row.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{row.dept}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{row.annual}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>{row.used}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontSize: 13, fontWeight: 700 }}>{row.annual - row.used}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{row.sick}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{row.usedSick}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontSize: 13, fontWeight: 700 }}>{row.sick - row.usedSick}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewLeave && (() => {
        const ltc = leaveTypeBadge(viewLeave.leaveType);
        return (
          <EntityDetailPanel
            title={viewLeave.employeeName}
            subtitle={`${viewLeave.department} · ${viewLeave.leaveType} Leave`}
            badgeText={viewLeave.status}
            badgeStyle={(() => { const s = statusBadge(viewLeave.status); return { background: s.bg, color: s.color }; })()}
            fields={[
              { label: 'Leave Type', value: viewLeave.leaveType },
              { label: 'Days', value: `${viewLeave.days} day${viewLeave.days !== 1 ? 's' : ''}` },
              { label: 'Start Date', value: viewLeave.startDate },
              { label: 'End Date', value: viewLeave.endDate },
              { label: 'Department', value: viewLeave.department },
              { label: 'Status', value: viewLeave.status },
              { label: 'Reason', value: viewLeave.reason },
              ...(viewLeave.rejectionReason ? [{ label: 'Rejection Reason', value: viewLeave.rejectionReason }] : []),
            ]}
            onClose={() => setViewLeave(null)}
            actions={
              <>
                {canApprove && viewLeave.status === 'PENDING' && (
                  <>
                    <button onClick={() => { handleApprove(viewLeave.id); setViewLeave(null); }} style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, color: '#10b981', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Approve</button>
                    <button onClick={() => { setRejectId(viewLeave.id); setViewLeave(null); }} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Reject</button>
                  </>
                )}
                <button onClick={() => setViewLeave(null)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>
              </>
            }
          />
        );
      })()}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 480, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>New Leave Request</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Employee Name</label>
                <input value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Department</label>
                <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14 }}>
                  {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Leave Type</label>
                <select value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value as LeaveRequest['leaveType'] }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14 }}>
                  {['Annual', 'Sick', 'Personal', 'Emergency'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Reason</label>
                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={3}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>Cancel</button>
              <button onClick={handleAdd} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 480, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Edit Leave Request</h3>
              <button onClick={() => { setShowEdit(false); setEditForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Employee Name</label>
                <input value={editForm.employeeName} onChange={e => setEditForm(p => p ? ({ ...p, employeeName: e.target.value }) : null)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Department</label>
                <select value={editForm.department} onChange={e => setEditForm(p => p ? ({ ...p, department: e.target.value }) : null)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14 }}>
                  {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Leave Type</label>
                <select value={editForm.leaveType} onChange={e => setEditForm(p => p ? ({ ...p, leaveType: e.target.value as LeaveRequest['leaveType'] }) : null)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14 }}>
                  {['Annual', 'Sick', 'Personal', 'Emergency'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Start Date</label>
                  <input type="date" value={editForm.startDate} onChange={e => setEditForm(p => p ? ({ ...p, startDate: e.target.value }) : null)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>End Date</label>
                  <input type="date" value={editForm.endDate} onChange={e => setEditForm(p => p ? ({ ...p, endDate: e.target.value }) : null)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Reason</label>
                <textarea value={editForm.reason} onChange={e => setEditForm(p => p ? ({ ...p, reason: e.target.value }) : null)} rows={3}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm(p => p ? ({ ...p, status: e.target.value as LeaveRequest['status'] }) : null)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14 }}>
                  {['PENDING', 'APPROVED', 'REJECTED'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {editForm.status === 'REJECTED' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Rejection Reason</label>
                  <textarea value={editForm.rejectionReason || ''} onChange={e => setEditForm(p => p ? ({ ...p, rejectionReason: e.target.value }) : null)} rows={2}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowEdit(false); setEditForm(null); }} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>Cancel</button>
              <button onClick={handleEditSave} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
