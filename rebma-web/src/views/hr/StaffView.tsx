import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, MoreVertical, ChevronLeft, Mail, Phone, CreditCard,
  Calendar, Award, Clock, X, Edit2, UserX, Eye, TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { StaffMember } from '../../types/erp';


const DEPARTMENTS = ['All', 'Operations', 'Finance', 'Logistics', 'HR', 'Marketing', 'Reception', 'Production', 'Management'];

// profiles.role has its own check constraint with specific casing/naming
// (e.g. 'receptionist' not 'Reception') — map the UI's department labels to it.
const DEPT_TO_ROLE: Record<string, string> = {
  Operations: 'operations', Finance: 'finance', Logistics: 'logistics', HR: 'HR',
  Marketing: 'marketing', Reception: 'receptionist', Production: 'production', Management: 'management',
};
const ROLE_TO_DEPT: Record<string, string> = Object.fromEntries(
  Object.entries(DEPT_TO_ROLE).map(([dept, role]) => [role.toLowerCase(), dept])
);
const roleToDeptLabel = (role: string) => ROLE_TO_DEPT[String(role || '').toLowerCase()] || role || 'Operations';

const statusColor = (s: string) => {
  if (s === 'ACTIVE') return { bg: 'rgba(16,185,129,0.12)', color: '#10b981' };
  if (s === 'SUSPENDED') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
  return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
};

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

interface Props {
  staffList: StaffMember[];
  addNotification: (msg: string) => void;
}

export default function StaffView({ staffList: propStaff, addNotification }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [profileTab, setProfileTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', department: 'Operations', role: '', phone: '', ghanaCard: '' });
  const [totalOnLeave, setTotalOnLeave] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null);

  // Detail loading state
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingStaff(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) {
          const mapped: StaffMember[] = data.map((p: any) => ({
            id: p.id,
            fullName: p.full_name || 'Employee',
            email: p.email || '',
            department: roleToDeptLabel(p.role), // role column holds department!
            role: p.is_ceo ? 'CEO' : (p.metadata?.role || 'Staff'),
            phone: p.phone || '',
            ghanaCard: p.ghana_card_id || '',
            joinedAt: p.created_at ? p.created_at.split('T')[0] : '',
            status: p.status || 'ACTIVE'
          }));
          setStaff(mapped);
        }

        // Fetch leave requests to compute dynamic On Leave count
        const { data: leavesData, error: leavesError } = await supabase
          .from('leave_requests')
          .select('status, start_date, end_date');
        if (leavesError) throw leavesError;
        if (leavesData) {
          const count = leavesData.filter((l: any) => 
            l.status === 'Approved' && 
            l.start_date <= new Date().toISOString().split('T')[0] &&
            l.end_date >= new Date().toISOString().split('T')[0]
          ).length;
          setTotalOnLeave(count);
        }
      } catch (err: any) {
        addNotification(`Error loading staff: ${err.message}`);
      }
      setLoadingStaff(false);
    };
    load();
  }, []);

  // Fetch attendance and leaves when a staff is selected
  useEffect(() => {
    if (!selected) {
      setAttendance([]);
      setLeaves([]);
      return;
    }
    const loadDetails = async () => {
      setLoadingDetails(true);
      try {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', selected.id)
          .order('date', { ascending: false });
        
        setAttendance(attData || []);

        const { data: leaveData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('staff_id', selected.id)
          .order('start_date', { ascending: false });
        
        setLeaves(leaveData || []);
      } catch (err: any) {
        console.error('Error loading details:', err);
      } finally {
        setLoadingDetails(false);
      }
    };
    loadDetails();
  }, [selected]);

  const filtered = staff.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || s.department === deptFilter;
    const matchStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchRole = !roleFilter || s.role.toLowerCase().includes(roleFilter.toLowerCase());
    return matchSearch && matchDept && matchStatus && matchRole;
  });

  const totalActive = staff.filter(s => s.status === 'ACTIVE').length;
  const totalSuspended = staff.filter(s => s.status === 'SUSPENDED').length;

  const openEdit = (s: StaffMember) => {
    setEditTarget(s);
    setForm({ fullName: s.fullName, email: s.email, department: s.department, role: s.role, phone: s.phone, ghanaCard: s.ghanaCard });
    setMenuOpen(null);
  };

  const handleSaveAdd = async () => {
    if (submitting) return;
    if (!form.email.trim()) { addNotification('Email is required.'); return; }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch('/api/register-staff-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          department: DEPT_TO_ROLE[form.department] || form.department,
          phone: form.phone,
          ghanaCardId: form.ghanaCard,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create staff account.');

      const newStaff: StaffMember = {
        id: json.userId,
        fullName: form.fullName,
        email: form.email,
        department: form.department,
        role: form.role,
        phone: form.phone,
        ghanaCard: form.ghanaCard,
        joinedAt: new Date().toISOString().split('T')[0],
        status: 'ACTIVE'
      };
      setStaff(prev => [newStaff, ...prev]);
      setNewCredentials({ email: json.email, password: json.password });
      addNotification(`Staff member ${form.fullName} added`);
      setShowAdd(false);
      setForm({ fullName: '', email: '', department: 'Operations', role: '', phone: '', ghanaCard: '' });
    } catch (err: any) {
      addNotification(`Error adding staff member: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.fullName,
          email: form.email,
          role: DEPT_TO_ROLE[form.department] || form.department, // department stored in role
          phone: form.phone,
          ghana_card_id: form.ghanaCard
        })
        .eq('id', editTarget.id);
      
      if (error) throw error;

      const updated = { ...editTarget, ...form };
      setStaff(prev => prev.map(s => s.id === editTarget.id ? updated : s));
      if (selected?.id === editTarget.id) setSelected(updated);
      addNotification(`${form.fullName} updated`);
      setEditTarget(null);
    } catch (err: any) {
      addNotification(`Error updating staff member: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspend = async (s: StaffMember) => {
    if (submitting) return;
    setSubmitting(true);
    const newStatus = s.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', s.id);
      if (error) throw error;

      setStaff(prev => prev.map(m => m.id === s.id ? { ...m, status: newStatus } : m));
      if (selected?.id === s.id) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
      addNotification(`${s.fullName} ${newStatus === 'SUSPENDED' ? 'suspended' : 'reactivated'}`);
      setMenuOpen(null);
    } catch (err: any) {
      addNotification(`Error updating status: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const CredentialsModal = () => newCredentials ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 440, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>Staff Account Created</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 1rem' }}>Share these credentials with the new staff member now — the password won't be shown again.</p>
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontFamily: 'monospace', fontSize: 13 }}>
          <p style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>Email: {newCredentials.email}</p>
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>Password: {newCredentials.password}</p>
        </div>
        <button onClick={() => setNewCredentials(null)} style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Done</button>
      </div>
    </div>
  ) : null;

  const FormModal = ({ title, onClose, onSave }: { title: string; onClose: () => void; onSave: () => void }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 500, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: submitting ? 0.5 : 1 }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(['fullName', 'email', 'role', 'phone', 'ghanaCard'] as const).map(field => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {field === 'fullName' ? 'Full Name' : field === 'ghanaCard' ? 'Ghana Card' : field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                value={form[field]}
                disabled={submitting}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', opacity: submitting ? 0.5 : 1 }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Department</label>
            <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} disabled={submitting}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, opacity: submitting ? 0.5 : 1 }}>
              {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>Cancel</button>
          <button onClick={onSave} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: submitting ? 0.5 : 1 }}>{submitting ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );

  if (selected) {
    const sc = statusColor(selected.status);
    return (
      <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: 14 }}>
          <ChevronLeft size={18} /> Back to Staff
        </button>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1.5rem', border: '1px solid var(--border)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
              {initials(selected.fullName)}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontWeight: 700 }}>{selected.fullName}</h2>
              <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 14 }}>{selected.role} · {selected.department}</p>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>{selected.status}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
            {[
              { icon: <Mail size={14} />, label: 'Email', value: selected.email },
              { icon: <Phone size={14} />, label: 'Phone', value: selected.phone },
              { icon: <CreditCard size={14} />, label: 'Ghana Card', value: selected.ghanaCard },
              { icon: <Calendar size={14} />, label: 'Joined', value: selected.joinedAt },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{item.icon}{item.label}</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          {(['attendance', 'leave', 'performance'] as const).map(t => (
            <button key={t} onClick={() => setProfileTab(t)}
              style={{ padding: '0.4rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13,
                background: profileTab === t ? 'var(--accent)' : 'transparent',
                color: profileTab === t ? '#fff' : 'var(--text-secondary)' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {profileTab === 'attendance' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Date', 'Check-In', 'Status'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loadingDetails ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }} className="animate-pulse">
                      Loading attendance records...
                    </td>
                  </tr>
                ) : attendance.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No attendance records found for this staff member
                    </td>
                  </tr>
                ) : (
                  attendance.map((a, i) => {
                    const isPresent = a.status === 'PRESENT' || a.status === 'present' || a.status === 'LATE' || a.status === 'late';
                    const ac = isPresent ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981' } : { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: 13 }}>{a.date}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{a.check_in_time || '--'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ac.bg, color: ac.color }}>{a.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
          {profileTab === 'leave' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Type', 'Start', 'End', 'Days', 'Status'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loadingDetails ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }} className="animate-pulse">
                      Loading leave requests...
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No leave requests found for this staff member
                    </td>
                  </tr>
                ) : (
                  leaves.map((l, i) => {
                    const isApproved = l.status === 'Approved' || l.status === 'APPROVED' || l.status === 'approved';
                    const lc = isApproved ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981' } : { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: 13 }}>{l.leave_type}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{l.start_date}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{l.end_date}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{l.days_count}</td>
                        <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: lc.bg, color: lc.color }}>{l.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
          {profileTab === 'performance' && (
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Overall Performance Score</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>87%</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '87%', background: 'var(--accent)', borderRadius: 5 }} />
                </div>
              </div>
              {[{ label: 'Attendance', score: 92 }, { label: 'Task Completion', score: 85 }, { label: 'Team Collaboration', score: 90 }, { label: 'Quality of Work', score: 82 }].map(m => (
                <div key={m.label} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{m.score}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${m.score}%`, background: 'var(--accent)', borderRadius: 3, opacity: 0.7 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Notes: Consistently meets targets. Recommended for Q3 performance bonus. Strong team player.</p>
              </div>
            </div>
          )}
        </div>
        {showAdd && <FormModal title="Add Staff" onClose={() => setShowAdd(false)} onSave={handleSaveAdd} />}
        <CredentialsModal />
        {editTarget && <FormModal title="Edit Staff" onClose={() => setEditTarget(null)} onSave={handleSaveEdit} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 22 }}>Staff Directory</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>{staff.length} total employees</p>
        </div>
        <button onClick={() => { setForm({ fullName: '', email: '', department: 'Operations', role: '', phone: '', ghanaCard: '' }); setShowAdd(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <Plus size={16} /> Add Staff
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Staff', value: staff.length, icon: <Users size={18} />, color: 'var(--accent)' },
          { label: 'Active', value: totalActive, icon: <Award size={18} />, color: '#10b981' },
          { label: 'On Leave', value: totalOnLeave, icon: <Calendar size={18} />, color: '#f59e0b' },
          { label: 'Suspended', value: totalSuspended, icon: <UserX size={18} />, color: '#ef4444' },
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

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }}>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13 }}>
          {['All', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={roleFilter} onChange={e => setRoleFilter(e.target.value)} placeholder="Filter by role..."
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13, minWidth: 140 }} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loadingStaff ? (
          <div style={{ padding: '1rem' }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
          </div>
        ) : (
        <>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['', 'Name', 'Email', 'Department', 'Role', 'Phone', 'Status', 'Joined', ''].map((h, i) => (
                  <th key={i} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const sc = statusColor(s.status);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => setSelected(s)}>
                    <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" style={{ accentColor: 'var(--accent)' }} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {initials(s.fullName)}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.fullName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{s.email}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{s.department}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13 }}>{s.role}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{s.phone}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{s.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: 13 }}>{s.joinedAt}</td>
                    <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                          <MoreVertical size={16} />
                        </button>
                        {menuOpen === s.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--box-shadow)', zIndex: 50, minWidth: 150 }}>
                            <button onClick={() => { setSelected(s); setMenuOpen(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
                              <Eye size={14} /> View Profile
                            </button>
                            <button onClick={() => openEdit(s)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
                              <Edit2 size={14} /> Edit
                            </button>
                            <button onClick={() => handleSuspend(s)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                              <UserX size={14} /> {s.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loadingStaff && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {staff.length === 0 ? 'No staff members yet — they will appear here once added' : 'No staff members found'}
          </div>
        )}
        </>
        )}
      </div>

      {showAdd && <FormModal title="Add Staff" onClose={() => setShowAdd(false)} onSave={handleSaveAdd} />}
        <CredentialsModal />
      {editTarget && <FormModal title="Edit Staff" onClose={() => setEditTarget(null)} onSave={handleSaveEdit} />}
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
