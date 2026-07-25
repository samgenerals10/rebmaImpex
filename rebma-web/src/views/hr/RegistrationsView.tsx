import React, { useState, useEffect } from 'react';
import {
  UserPlus, CheckCircle, XCircle, Search, Filter, Clock,
  Copy, Eye, EyeOff, X, Mail, Phone, CreditCard, Building2, Calendar,
  Edit, Trash2
} from 'lucide-react';
import type { PendingRegistration } from '../../types/erp';
import { supabase } from '../../lib/supabaseClient';
import CountUp from '../../components/CountUp';
import { useFullscreenToggle, FullscreenButton } from '../../components/global/FullscreenToggle';

const DEPARTMENTS = ['All', 'Operations', 'Finance', 'Logistics', 'HR', 'Marketing', 'Reception', 'Production', 'Management', 'Dispatch'];
const STATUSES = ['All', 'PENDING', 'APPROVED', 'REJECTED'];

const deptToRole = (dept: string): string => {
  const map: Record<string, string> = {
    'HR': 'HR',
    'Operations': 'operations',
    'Finance': 'finance',
    'Logistics': 'logistics',
    'Marketing': 'marketing',
    'Reception': 'receptionist',
    'Production': 'production',
    'Management': 'management',
    'Dispatch': 'dispatch'
  };
  return map[dept] || 'Staff';
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface Props {
  pendingRegistrations: PendingRegistration[];
  addNotification: (msg: string) => void;
  onApprove: (reg: PendingRegistration, pw: string, token: string) => void;
  onDeny: (reg: PendingRegistration) => void;
}

interface CredPopup {
  show: boolean;
  fullName: string;
  email: string;
  password: string;
  magicLink: string;
}

export default function RegistrationsView({ pendingRegistrations, addNotification, onApprove, onDeny }: Props) {
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [submitting, setSubmitting] = useState(false);
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [credPopup, setCredPopup] = useState<CredPopup | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [detailReg, setDetailReg] = useState<PendingRegistration | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<PendingRegistration | null>(null);
  const tableFullscreen = useFullscreenToggle();

  // Management and HR registrations are the CEO's call, not HR's — HR has no
  // action to take on them, so keep them out of this queue entirely.
  const CEO_ONLY_DEPARTMENTS = ['MANAGEMENT', 'HR'];
  const awaitingCeo = pendingRegistrations.filter(r => r.status === 'PENDING' && CEO_ONLY_DEPARTMENTS.includes(r.department)).length;

  useEffect(() => {
    setRegistrations(pendingRegistrations.filter(r => !CEO_ONLY_DEPARTMENTS.includes(r.department)));
  }, [pendingRegistrations]);

  const filtered = registrations.filter(r => {
    const matchSearch = r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.ghanaCard.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || r.department === deptFilter;
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const pending = registrations.filter(r => r.status === 'PENDING').length;
  const approved = registrations.filter(r => r.status === 'APPROVED').length;
  const rejected = registrations.filter(r => r.status === 'REJECTED').length;

  const handleApprove = async (reg: PendingRegistration) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const pw = generatePassword();
      const token = `https://rebma.app/magic?token=${Math.random().toString(36).slice(2)}`;
      await onApprove(reg, pw, token);
      setCredPopup({ show: true, fullName: reg.fullName, email: reg.email, password: pw, magicLink: token });
      addNotification(`${reg.fullName} approved and credentials generated`);
    } catch (e: any) {
      alert(e.message || 'Failed to approve registration');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  };

  const handleDeny = async () => {
    if (!denyId) return;
    if (submitting) return;
    const reg = registrations.find(r => r.id === denyId);
    if (!reg) return;
    setSubmitting(true);
    try {
      await onDeny(reg);
      addNotification(`${reg.fullName} registration denied`);
      setDenyId(null);
      setDenyReason('');
    } catch (e: any) {
      alert(e.message || 'Failed to deny registration');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  };

  const handleEditClick = (reg: PendingRegistration) => {
    setEditForm(reg);
    setShowEdit(true);
  };

  const handleEditSave = async () => {
    if (!editForm) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const role = deptToRole(editForm.department);
      const { error } = await supabase.from('profiles').update({
        full_name: editForm.fullName,
        email: editForm.email,
        role: role,
        ghana_card_id: editForm.ghanaCard,
        phone: editForm.phone || null
      }).eq('id', editForm.id);

      if (!error) {
        setRegistrations(prev => prev.map(r => r.id === editForm.id ? editForm : r));
        addNotification(`Updated registration for ${editForm.fullName}`);
        setShowEdit(false);
        setEditForm(null);
      } else {
        alert(error.message || 'Failed to update registration');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating registration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (submitting) return;
    if (!await confirm('Are you sure you want to delete this registration request?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) {
        setRegistrations(prev => prev.filter(r => r.id !== id));
        addNotification('Registration request deleted');
      } else {
        alert(error.message || 'Failed to delete registration');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting registration');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'APPROVED') return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Approved' };
    if (status === 'REJECTED') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Rejected' };
    return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pending' };
  };

  return (
    <div className="p-4 lg:p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[var(--accent)]" />
            Staff Registrations
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Review and approve new staff registration requests</p>
        </div>
      </div>

      {awaitingCeo > 0 && (
        <div className="text-xs text-[var(--text-secondary)] bg-[var(--accent-light)] border border-[var(--border)] rounded-xl px-3 py-2">
          {awaitingCeo} Management/HR registration{awaitingCeo === 1 ? '' : 's'} awaiting CEO approval — not shown here.
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: pendingRegistrations.length, color: 'var(--accent)' },
          { label: 'Pending', value: pending, color: '#f59e0b' },
          { label: 'Approved', value: approved, color: '#10b981' },
          { label: 'Rejected', value: rejected, color: '#ef4444' },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3.5">
            <p className="text-2xl font-bold text-[var(--text-primary)]" style={{ color: card.color }}><CountUp value={card.value} /></p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, Ghana Card..."
            className="bg-transparent border-none outline-none text-[var(--text-primary)] text-xs w-full" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs">
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs">
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <FullscreenButton expanded={tableFullscreen.expanded} onClick={tableFullscreen.toggle} />
      </div>

      {/* Table */}
      <div className={`bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden ${tableFullscreen.expanded ? `${tableFullscreen.fullscreenClass} p-4` : 'rounded-2xl'}`}>
        {tableFullscreen.expanded && (
          <div className="flex justify-end mb-3"><FullscreenButton expanded onClick={tableFullscreen.toggle} /></div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] font-semibold">
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-left">Email</th>
                <th className="py-3 px-4 text-left hidden sm:table-cell">Department</th>
                <th className="py-3 px-4 text-left hidden md:table-cell">Ghana Card</th>
                <th className="py-3 px-4 text-left hidden lg:table-cell">Submitted</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(reg => {
                const sb = statusBadge(reg.status);
                return (
                  <tr key={reg.id} className="hover:bg-[var(--accent-light)] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {reg.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[var(--text-primary)]">{reg.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{reg.email}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary)] hidden sm:table-cell">{reg.department}</td>
                    <td className="py-3 px-4 font-mono text-[var(--text-muted)] hidden md:table-cell">{reg.ghanaCard}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)] hidden lg:table-cell">{reg.submittedAt?.slice(0, 10) || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>
                        {sb.label}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setDetailReg(reg)}
                          className="w-7 h-7 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] cursor-pointer transition-colors" title="View Details">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {reg.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleApprove(reg)}
                              className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/20 cursor-pointer transition-colors" title="Approve">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setDenyId(reg.id); setDenyReason(''); }}
                              className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500/20 cursor-pointer transition-colors" title="Deny">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleEditClick(reg)}
                          className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500/20 cursor-pointer transition-colors" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(reg.id)}
                          className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500/20 cursor-pointer transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">No registrations found</div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">Showing {filtered.length} of {pendingRegistrations.length} records</p>
        </div>
      </div>

      {/* Deny reason modal */}
      {denyId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-[var(--text-primary)] mb-3">Deny Registration</h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">Please provide a reason for denying this registration:</p>
            <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} rows={3} placeholder="Reason..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm resize-none outline-none" />
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => setDenyId(null)} disabled={submitting}
                className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent-light)] cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDeny} disabled={submitting}
                className="px-4 py-2 text-xs bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 cursor-pointer disabled:opacity-50">
                {submitting ? 'Denying...' : 'Confirm Deny'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailReg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Registration Detail</h3>
              <button onClick={() => setDetailReg(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-lg">
                {detailReg.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)]">{detailReg.fullName}</p>
                <p className="text-xs text-[var(--text-muted)]">{detailReg.department}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { icon: Mail, label: 'Email', value: detailReg.email },
                { icon: Phone, label: 'Phone', value: detailReg.phone || '—' },
                { icon: CreditCard, label: 'Ghana Card', value: detailReg.ghanaCard },
                { icon: Building2, label: 'Department', value: detailReg.department },
                { icon: Calendar, label: 'Submitted', value: detailReg.submittedAt?.slice(0, 10) || '—' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2.5 text-sm">
                  <item.icon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span className="text-[var(--text-muted)] text-xs w-20 shrink-0">{item.label}</span>
                  <span className="text-[var(--text-primary)] font-medium">{item.value}</span>
                </div>
              ))}
            </div>
            {detailReg.status === 'PENDING' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => { handleApprove(detailReg); setDetailReg(null); }} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-xl text-sm font-semibold cursor-pointer hover:bg-emerald-500/20 disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => { setDetailReg(null); setDenyId(detailReg.id); }} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-xl text-sm font-semibold cursor-pointer hover:bg-rose-500/20 disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> Deny
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credentials Popup */}
      {credPopup?.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
              <h3 className="font-bold text-lg text-emerald-500">Account Credentials Generated</h3>
              <button onClick={() => setCredPopup(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              <strong className="text-[var(--text-primary)]">{credPopup.fullName}</strong> ({credPopup.email})
            </p>
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-emerald-500 font-mono flex-1 break-all select-all">
                    {showPw ? credPopup.password : '••••••••••'}
                  </p>
                  <button onClick={() => setShowPw(p => !p)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="border-t border-[var(--border)] pt-2">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-1">Magic Link</p>
                <p className="text-[11px] text-blue-500 break-all select-all">{credPopup.magicLink}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  const text = `Dear ${credPopup.fullName},\n\nYour REBMA IMPEX account has been approved!\n\nEmail: ${credPopup.email}\nTemporary Password: ${credPopup.password}\n\nMagic Link: ${credPopup.magicLink}\n\nPlease reset your password upon first login.\n\nRebma Impex Ghana Ltd.`;
                  navigator.clipboard.writeText(text);
                  addNotification('Credentials copied to clipboard');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold text-sm cursor-pointer flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" /> Copy Credentials
              </button>
              <button onClick={() => setCredPopup(null)}
                className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-sm cursor-pointer hover:bg-[var(--accent-light)]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showEdit && editForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Edit Registration Detail</h3>
              <button onClick={() => { setShowEdit(false); setEditForm(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Full Name</label>
                <input value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Email</label>
                <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Phone</label>
                <input value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Department / Role</label>
                <select value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none">
                  {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Ghana Card ID</label>
                <input value={editForm.ghanaCard} onChange={e => setEditForm({ ...editForm, ghanaCard: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 font-mono text-[var(--text-primary)] text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => { setShowEdit(false); setEditForm(null); }} disabled={submitting}
                className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--accent-light)] cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={submitting}
                className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-xl font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
