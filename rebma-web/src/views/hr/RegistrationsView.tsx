import React, { useState, useEffect } from 'react';
import {
  UserPlus, CheckCircle, XCircle, Search, Filter, Clock,
  Copy, Eye, EyeOff, Mail, Phone, CreditCard, Building2, Calendar,
  Edit, Trash2, Send
} from 'lucide-react';
import { hr } from '../../services/apiClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import { approvalTimeLeft } from '../../utils/registration';
import type { PendingRegistration } from '../../types/erp';
import { supabase } from '../../lib/supabaseClient';
import CountUp from '../../components/CountUp';
import { useFullscreenToggle, FullscreenButton } from '../../components/global/FullscreenToggle';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

const DEPARTMENTS = ['All', 'Admin & Warehouse', 'Account Department', 'HR', 'Marketing', 'Reception', 'Production', 'Management'];
const STATUSES = ['All', 'PENDING', 'APPROVED', 'REJECTED'];

const deptToRole = (dept: string): string => {
  const map: Record<string, string> = {
    'HR': 'HR',
    'Admin & Warehouse': 'admin_warehouse',
    'Account Department': 'finance',
    'Marketing': 'marketing',
    'Reception': 'receptionist',
    'Production': 'production',
    'Management': 'management',
  };
  return map[dept] || 'Staff';
};

interface Props {
  pendingRegistrations: PendingRegistration[];
  addNotification: (msg: string) => void;
  onApprove: (reg: PendingRegistration) => unknown;
  onDeny: (reg: PendingRegistration) => void;
  isAdmin?: boolean;
}

interface CredPopup {
  show: boolean;
  fullName: string;
  email: string;
  password: string;
  signInLink: string;
}

export default function RegistrationsView({ pendingRegistrations, addNotification, onApprove, onDeny, isAdmin }: Props) {
  // New staff are approved by the CEO only by default (api/approve-user.ts
  // enforces the same). HR still sees who's waiting; the buttons would just
  // be refused, so they're hidden and a note is shown instead.
  const { getSetting } = useCeoSettings();
  const canDecide = !!isAdmin || getSetting('ceo_must_approve_registrations', true) === false;
  const [resending, setResending] = useState<string | null>(null);
  const [resent, setResent] = useState<{ name: string; message: string; link: string; phone: string } | null>(null);

  // Expired registration (not approved within 12 hours): clears the
  // expired sign-up and emails a fresh link. The link is shown too, for
  // when email isn't set up.
  const handleResend = async (reg: PendingRegistration) => {
    if (resending) return;
    setResending(reg.id);
    try {
      const res = await hr.resendInvite({ userId: reg.id });
      setRegistrations(prev => prev.filter(r => r.id !== reg.id));
      setDetailReg(null);
      setResent({ name: reg.fullName, message: res.message, link: res.link, phone: (res as any).phone || reg.phone || '' });
    } catch (e: any) {
      alert(e.message || 'Could not resend the link.');
    } finally {
      setResending(null);
    }
  };
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
      const res: any = await onApprove(reg);
      // null means it failed (already alerted). Someone who chose their own
      // password gets no temporary one, so there's nothing to show.
      if (res?.temporaryPassword) {
        setCredPopup({ show: true, fullName: reg.fullName, email: reg.email, password: res.temporaryPassword, signInLink: window.location.origin });
        addNotification(`${reg.fullName} approved and credentials generated`);
      }
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
          {awaitingCeo} Management/HR registration{awaitingCeo === 1 ? '' : 's'} awaiting CEO approval, not shown here.
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
        <SearchableDropdown value={deptFilter} onChange={setDeptFilter} options={DEPARTMENTS.map(d => ({ value: d, label: d }))} className="w-40" />
        <SearchableDropdown value={statusFilter} onChange={setStatusFilter} options={STATUSES.map(s => ({ value: s, label: s }))} className="w-36" />
        <FullscreenButton expanded={tableFullscreen.expanded} onClick={tableFullscreen.toggle} />
      </div>

      {/* Table */}
      <div className={`bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden ${tableFullscreen.expanded ? `${tableFullscreen.fullscreenClass} p-4` : 'rounded-2xl'}`}>
        {tableFullscreen.expanded && (
          <div className="flex justify-end mb-3"><FullscreenButton expanded onClick={tableFullscreen.toggle} /></div>
        )}
        <div className="p-3">
          <ResponsiveDataView<PendingRegistration> exportTitle="Registrations"
            columns={[
              {
                key: 'fullName', label: 'Name', primary: true, render: reg => (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {reg.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span>{reg.fullName}</span>
                  </div>
                )
              },
              { key: 'email', label: 'Email' },
              { key: 'department', label: 'Department' },
              { key: 'ghanaCard', label: 'Ghana Card', render: reg => <span className="font-mono">{reg.ghanaCard}</span> },
              { key: 'submittedAt', label: 'Submitted', render: reg => reg.submittedAt?.slice(0, 10) || 'Not set' },
              {
                key: 'status', label: 'Status', status: true, render: reg => {
                  if (reg.expired) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Expired</span>;
                  const left = reg.status === 'PENDING' ? approvalTimeLeft(reg.registeredAt) : null;
                  if (left) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{left}</span>;
                  const sb = statusBadge(reg.status);
                  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>;
                }
              },
            ]}
            data={filtered}
            rowKey={reg => reg.id}
            emptyTitle="No registrations found"
            renderActions={reg => (
              <>
                <button onClick={() => setDetailReg(reg)}
                  className="w-7 h-7 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] cursor-pointer transition-colors" title="View Details">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {reg.expired && (
                  <button onClick={() => handleResend(reg)} disabled={resending === reg.id}
                    className="h-7 px-2 rounded-lg bg-[var(--accent)] text-white flex items-center gap-1 text-[10px] font-bold hover:opacity-90 cursor-pointer disabled:opacity-50" title="Resend link">
                    <Send className="w-3.5 h-3.5" /> {resending === reg.id ? 'Sending…' : 'Resend link'}
                  </button>
                )}
                {reg.status === 'PENDING' && !reg.expired && canDecide && (
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
              </>
            )}
          />
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">Showing {filtered.length} of {pendingRegistrations.length} records</p>
        </div>
      </div>

      {/* Deny reason modal */}
      <SidePanel
        open={!!denyId}
        onClose={() => setDenyId(null)}
        title="Deny Registration"
        subtitle="Please provide a reason for denying this registration."
        footer={
          <>
            <button onClick={() => setDenyId(null)} disabled={submitting} className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={handleDeny} disabled={submitting} className="erp-btn erp-btn-danger disabled:opacity-50">
              {submitting ? 'Denying...' : 'Confirm Deny'}
            </button>
          </>
        }
      >
        <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} rows={3} placeholder="Reason..." className="erp-input resize-none" />
      </SidePanel>

      {/* Detail modal */}
      <SidePanel
        open={!!detailReg}
        onClose={() => setDetailReg(null)}
        title="Registration Detail"
      >
        {detailReg && (
          <>
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
                { icon: Phone, label: 'Phone', value: detailReg.phone || 'Not set' },
                { icon: CreditCard, label: 'Ghana Card', value: detailReg.ghanaCard },
                { icon: Building2, label: 'Department', value: detailReg.department },
                { icon: Calendar, label: 'Submitted', value: detailReg.submittedAt?.slice(0, 10) || 'Not set' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2.5 text-sm">
                  <item.icon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span className="text-[var(--text-muted)] text-xs w-20 shrink-0">{item.label}</span>
                  <span className="text-[var(--text-primary)] font-medium">{item.value}</span>
                </div>
              ))}
            </div>
            {detailReg.expired && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-rose-600">This registration expired because it was not approved within 12 hours. Resend the link so they can register again.</p>
                <button onClick={() => handleResend(detailReg)} disabled={!!resending}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50">
                  <Send className="w-4 h-4" /> {resending ? 'Sending…' : 'Resend link'}
                </button>
              </div>
            )}
            {detailReg.status === 'PENDING' && !detailReg.expired && !canDecide && (
              <p className="mt-4 text-xs font-semibold text-amber-600">Waiting for CEO approval.</p>
            )}
            {detailReg.status === 'PENDING' && !detailReg.expired && canDecide && (
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
          </>
        )}
      </SidePanel>

      <SidePanel open={!!resent} onClose={() => setResent(null)} title="Link Resent" subtitle={resent?.name}
        footer={<button onClick={() => setResent(null)} className="erp-btn erp-btn-ghost w-full">Done</button>}>
        {resent && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">{resent.message}</p>
            {resent.link && (
              <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-primary)] break-all select-all">{resent.link}</p>
                <button onClick={() => {
                  const digits = resent.phone.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '233');
                  const text = `Hi ${resent.name}, here is your new Rebma Impex registration link. Open the Rebma app, tap Register and paste it: ${resent.link}`;
                  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
                }}
                  className="shrink-0 px-2.5 py-1.5 text-[10px] font-semibold bg-emerald-500 text-white rounded-lg cursor-pointer hover:bg-emerald-600">
                  WhatsApp
                </button>
                <button onClick={() => { navigator.clipboard.writeText(resent.link); addNotification('Link copied'); }}
                  className="shrink-0 px-2.5 py-1.5 text-[10px] font-semibold bg-[var(--accent-light)] text-[var(--accent)] rounded-lg cursor-pointer hover:opacity-90">
                  <Copy className="w-3 h-3 inline mr-1" />Copy
                </button>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {/* Credentials Popup */}
      <SidePanel
        open={!!credPopup?.show}
        onClose={() => setCredPopup(null)}
        title="Account Credentials Generated"
      >
        {credPopup && (
          <>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              <strong className="text-[var(--text-primary)]">{credPopup.fullName}</strong> ({credPopup.email})
            </p>
            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Temporary Password</p>
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
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Sign-in Address</p>
                <p className="text-[11px] text-blue-500 break-all select-all">{credPopup.signInLink}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  const text = `Dear ${credPopup.fullName},\n\nYour REBMA IMPEX account has been approved!\n\nEmail: ${credPopup.email}\nTemporary Password: ${credPopup.password}\n\nSign in at: ${credPopup.signInLink}\n\nPlease reset your password upon first login.\n\nRebma Impex Ghana Ltd.`;
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
          </>
        )}
      </SidePanel>

      <SidePanel
        open={showEdit && !!editForm}
        onClose={() => { setShowEdit(false); setEditForm(null); }}
        title="Edit Registration Detail"
        footer={
          <>
            <button onClick={() => { setShowEdit(false); setEditForm(null); }} disabled={submitting}
              className="erp-btn erp-btn-ghost disabled:opacity-50">Cancel</button>
            <button onClick={handleEditSave} disabled={submitting} className="erp-btn erp-btn-primary disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        {editForm && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Full Name</label>
                <input placeholder="Enter full name" value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Email</label>
                <input placeholder="Enter email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Phone</label>
                <input placeholder="Enter phone" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Department / Role</label>
                <SearchableDropdown value={editForm.department} onChange={v => setEditForm({ ...editForm, department: v })} options={DEPARTMENTS.filter(d => d !== 'All').map(d => ({ value: d, label: d }))} />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Ghana Card ID</label>
                <input placeholder="Enter Ghana card ID" value={editForm.ghanaCard} onChange={e => setEditForm({ ...editForm, ghanaCard: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 font-mono text-[var(--text-primary)] text-sm outline-none" />
              </div>
            </div>
        )}
      </SidePanel>
    </div>
  );
}
