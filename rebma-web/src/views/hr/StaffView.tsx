import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, MoreVertical, ChevronLeft, Mail, Phone, CreditCard,
  Calendar, Award, Clock, Edit2, UserX, Eye, TrendingUp, MapPin, Upload,
  FileText, ExternalLink, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { StaffMember } from '../../types/erp';
import { hr } from '../../services/apiClient';
import { uploadFile, uploadPrivateFile, getSignedFileUrl } from '../../utils/uploadFile';
import { downloadRowPDF } from '../../utils/export';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

const STAFF_CATEGORIES = ['Senior Staff', 'Junior Staff', 'Management', 'Contract Staff', 'Intern'];


const DEPARTMENTS = ['All', 'Admin & Warehouse', 'Finance', 'HR', 'Marketing', 'Reception', 'Production', 'Management', 'Risk'];

// profiles.role has its own check constraint with specific casing/naming
// (e.g. 'receptionist' not 'Reception') — map the UI's department labels to it.
const DEPT_TO_ROLE: Record<string, string> = {
  'Admin & Warehouse': 'admin_warehouse', Finance: 'finance', HR: 'HR',
  Marketing: 'marketing', Reception: 'receptionist', Production: 'production', Management: 'management',
  Risk: 'risk',
};
const ROLE_TO_DEPT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DEPT_TO_ROLE).map(([dept, role]) => [role.toLowerCase(), dept])),
  // Phase 5 merge — existing staff keep their literal stored role (no bulk
  // migration), so these legacy roles must still resolve to the merged
  // department's label rather than falling through to the raw role string.
  operations: 'Admin & Warehouse', dispatch: 'Admin & Warehouse', logistics: 'Admin & Warehouse',
};
const roleToDeptLabel = (role: string) => ROLE_TO_DEPT[String(role || '').toLowerCase()] || role || 'Admin & Warehouse';

const statusColor = (s: string) => {
  if (s === 'ACTIVE') return { bg: 'rgba(16,185,129,0.12)', color: '#10b981' };
  if (s === 'SUSPENDED') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
  return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
};

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const mapStaffRow = (p: any): StaffMember => ({
  id: p.id,
  fullName: p.full_name || 'Employee',
  email: p.email || '',
  department: roleToDeptLabel(p.role), // role column holds department!
  role: p.is_admin ? 'CEO' : (p.metadata?.role || 'Staff'),
  phone: p.phone || '',
  ghanaCard: p.ghana_card_id || '',
  joinedAt: p.created_at ? p.created_at.split('T')[0] : '',
  status: p.status || 'ACTIVE',
  photo: p.photo || undefined,
  employeeNumber: p.employee_number || undefined,
  resumeUrl: p.resume_url || undefined,
  address: p.address || undefined,
  hrRemarks: p.hr_remarks || undefined,
  guarantorName: p.guarantor_name || undefined,
  guarantorPhone: p.guarantor_phone || undefined,
  guarantorRelationship: p.guarantor_relationship || undefined,
  guarantorIdNumber: p.guarantor_id_number || undefined,
  guarantorAddress: p.guarantor_address || undefined,
  staffCategory: p.staff_category || undefined,
  performanceTaskScore: p.performance_task_score ?? undefined,
  performanceTeamScore: p.performance_team_score ?? undefined,
  performanceQualityScore: p.performance_quality_score ?? undefined,
  performanceNotes: p.performance_notes || undefined,
  performanceReviewedBy: p.performance_reviewed_by || undefined,
  performanceReviewedAt: p.performance_reviewed_at || undefined,
});

interface Props {
  staffList: StaffMember[];
  addNotification: (msg: string) => void;
  currentUser?: { fullName: string; department: string; isAdmin?: boolean } | null;
}

export default function StaffView({ staffList: propStaff, addNotification, currentUser }: Props) {
  const isHrOrAdmin = currentUser?.isAdmin || currentUser?.department === 'HR' || currentUser?.department === 'MANAGEMENT';
  const { rows: staff, setRows: setStaff, loading: loadingStaff, hasMore, total, loadMore } = usePaginatedQuery<StaffMember>({
    table: 'profiles',
    pageSize: 100,
    map: mapStaffRow,
  });
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [profileTab, setProfileTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const blankForm = {
    fullName: '', email: '', department: 'Admin & Warehouse', role: '', phone: '', ghanaCard: '',
    address: '', staffCategory: '', guarantorName: '', guarantorPhone: '', guarantorRelationship: '', guarantorIdNumber: '', guarantorAddress: '',
  };
  const [form, setForm] = useState(blankForm);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [totalOnLeave, setTotalOnLeave] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Registration is invite-only now (Phase 8) — Add Staff no longer
  // creates a live account. It writes a staff_invites row, notifies Risk,
  // and opens this Send panel so HR can push the link out. Replaces the
  // old "here are the new credentials" modal entirely.
  const [createdInvite, setCreatedInvite] = useState<{ id: string; token: string; email: string; fullName: string; phone: string; whatsapp: string } | null>(null);
  const [sendChannels, setSendChannels] = useState({ email: true, sms: false, whatsapp: false });
  const [sendSmsNumber, setSendSmsNumber] = useState('');
  const [sendWhatsappNumber, setSendWhatsappNumber] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Department-scoped Role dropdown (Phase 8) — replaces the old free-text
  // Role field. Falls back to just the department name if nothing's been
  // defined for it yet.
  const [departmentRoles, setDepartmentRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  useEffect(() => {
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    supabase.from('department_roles').select('role_name').eq('department', dbDept).order('role_name')
      .then(({ data }) => setDepartmentRoles((data || []).map(r => r.role_name)));
  }, [form.department]);
  const addDepartmentRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    const { error } = await supabase.from('department_roles').insert({ department: dbDept, role_name: name });
    if (!error) {
      setDepartmentRoles(prev => [...prev, name].sort());
      setForm(p => ({ ...p, role: name }));
      setNewRoleName('');
    } else {
      addNotification(`Could not add role: ${error.message}`);
    }
  };

  // resumeUrl/selected.resumeUrl now hold a private-bucket PATH, not a
  // directly-openable URL — a fresh signed URL is resolved on demand each
  // time "View" is clicked, matching the chat-attachments precedent.
  const viewResume = async (path: string) => {
    const url = await getSignedFileUrl('staff-resumes', path);
    if (!url) { addNotification(`Could not open resume. It may have been removed.`); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // HR Remarks edit modal
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [remarksDraft, setRemarksDraft] = useState('');

  // Performance edit modal
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [perfDraft, setPerfDraft] = useState({ taskScore: '', teamScore: '', qualityScore: '', notes: '' });

  // Detail loading state
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    // Bounded to leave that actually overlaps today, rather than pulling
    // every leave request ever filed company-wide just to count the ones
    // currently active.
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .then(({ count, error }) => {
        if (!error && typeof count === 'number') setTotalOnLeave(count);
      });
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
    setForm({
      fullName: s.fullName, email: s.email, department: s.department, role: s.role, phone: s.phone, ghanaCard: s.ghanaCard,
      address: s.address || '', staffCategory: s.staffCategory || '',
      guarantorName: s.guarantorName || '', guarantorPhone: s.guarantorPhone || '', guarantorRelationship: s.guarantorRelationship || '',
      guarantorIdNumber: s.guarantorIdNumber || '', guarantorAddress: s.guarantorAddress || '',
    });
    setResumeUrl(s.resumeUrl || null);
    setPhotoDataUrl(s.photo || null);
    setMenuOpen(null);
  };

  // Phase 8: Add Staff no longer creates a live account. It writes one
  // staff_invites row carrying everything HR just entered, notifies Risk,
  // and hands off to the Send panel — HR picks the channel(s) next. The
  // candidate only ever confirms this record via the link; they never
  // type any of it themselves.
  const handleSaveAdd = async () => {
    if (submitting) return;
    if (!form.email.trim()) { addNotification('Email is required.'); return; }
    setSubmitting(true);
    try {
      const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'hr_can_invite_staff').maybeSingle();
      if (gate?.setting_value === false) {
        addNotification('Inviting new staff is currently disabled by the CEO.');
        setSubmitting(false);
        return;
      }

      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const dbDept = DEPT_TO_ROLE[form.department] || form.department;
      const { data: inviteRow, error: inviteError } = await supabase.from('staff_invites').insert({
        token,
        email: form.email.trim().toLowerCase(),
        full_name: form.fullName,
        department: dbDept,
        role: form.role || null,
        phone: form.phone || null,
        photo: photoDataUrl,
        resume_url: resumeUrl,
        address: form.address || null,
        staff_category: form.staffCategory || null,
        guarantor_name: form.guarantorName || null,
        guarantor_phone: form.guarantorPhone || null,
        guarantor_relationship: form.guarantorRelationship || null,
        guarantor_id_number: form.guarantorIdNumber || null,
        guarantor_address: form.guarantorAddress || null,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
        created_by: currentUser?.fullName || null,
      }).select().single();
      if (inviteError) throw inviteError;

      // Risk sees everything about this candidate, not a summary — the
      // notification just points them at it.
      await supabase.from('supplier_order_notifications').insert({
        message: `New recruitment record from HR: ${form.fullName} (${form.role || dbDept}). Résumé and photo available for review.`,
        notified_department: 'RISK',
        read: false,
      });

      addNotification(`Candidate record saved for ${form.fullName} and ready to send.`);
      setShowAdd(false);
      setCreatedInvite({ id: inviteRow.id, token, email: form.email.trim().toLowerCase(), fullName: form.fullName, phone: form.phone, whatsapp: form.phone });
      setSendWhatsappNumber(form.phone);
      setSendSmsNumber(form.phone);
      setForm(blankForm);
      setResumeUrl(null);
      setPhotoDataUrl(null);
    } catch (err: any) {
      addNotification(`Error saving candidate: ${err.message}`);
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
          ghana_card_id: form.ghanaCard,
          address: form.address || null,
          resume_url: resumeUrl || null,
          photo: photoDataUrl || null,
          staff_category: form.staffCategory || null,
          guarantor_name: form.guarantorName || null,
          guarantor_phone: form.guarantorPhone || null,
          guarantor_relationship: form.guarantorRelationship || null,
          guarantor_id_number: form.guarantorIdNumber || null,
          guarantor_address: form.guarantorAddress || null,
        })
        .eq('id', editTarget.id);

      if (error) throw error;

      const updated = { ...editTarget, ...form, resumeUrl: resumeUrl || undefined, photo: photoDataUrl || undefined };
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

  // Phase 8: replaces the old "here are the credentials" modal. HR picks
  // one or more real channels; each shows the exact message before
  // anything goes out, and a plain input if a contact detail is missing.
  const SendInvitePanel = () => {
    if (!createdInvite) return null;
    const link = `${window.location.origin}/register?token=${createdInvite.token}`;
    const message = `Hi ${createdInvite.fullName}, HR has approved your registration with Rebma Impex. Complete your registration here: ${link}\n\nThis link expires in 7 days.`;

    const sendEmail = async () => {
      setSendingEmail(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const res = await fetch('/api/send-staff-invite-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}) },
          body: JSON.stringify({ inviteId: createdInvite.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send email.');
        addNotification(`Invite emailed to ${createdInvite.email}.`);
      } catch (err: any) {
        addNotification(`Email send failed: ${err.message}`);
      } finally {
        setSendingEmail(false);
      }
    };

    const openWhatsapp = () => {
      const num = sendWhatsappNumber.replace(/[^0-9+]/g, '');
      if (!num) { addNotification('Enter a WhatsApp number first.'); return; }
      window.open(`https://wa.me/${num.replace(/^0/, '233').replace('+', '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    };

    return (
      <SidePanel
        open={!!createdInvite}
        onClose={() => setCreatedInvite(null)}
        title="Send Invite"
        footer={<button onClick={() => setCreatedInvite(null)} className="erp-btn erp-btn-primary w-full">Done</button>}
      >
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 1rem' }}>Saved. Choose how to send the link to {createdInvite.fullName}, any combination.</p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={sendChannels.email} onChange={e => setSendChannels(p => ({ ...p, email: e.target.checked }))} />
              Email — {createdInvite.email}
            </label>
            {sendChannels.email && (
              <>
                <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>{message}</pre>
                <button type="button" onClick={sendEmail} disabled={sendingEmail} className="erp-btn erp-btn-primary" style={{ width: '100%' }}>{sendingEmail ? 'Sending…' : 'Send Email'}</button>
              </>
            )}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              <input type="checkbox" checked={sendChannels.whatsapp} onChange={e => setSendChannels(p => ({ ...p, whatsapp: e.target.checked }))} />
              WhatsApp
            </label>
            {sendChannels.whatsapp && (
              <>
                <input value={sendWhatsappNumber} onChange={e => setSendWhatsappNumber(e.target.value)} placeholder="WhatsApp number (e.g. 0244123456)"
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>{message}</pre>
                <button type="button" onClick={openWhatsapp} className="erp-btn erp-btn-primary" style={{ width: '100%' }}>Open WhatsApp to Send</button>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>Opens your own WhatsApp with the message ready, so you can tap Send.</p>
              </>
            )}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem', opacity: 0.6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
              <input type="checkbox" disabled />
              SMS
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>Not configured yet. Needs an SMS gateway account connected.</p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>{link}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(link)} className="erp-btn erp-btn-ghost">Copy Link</button>
          </div>
        </div>
      </SidePanel>
    );
  };

  const FormModal = ({ title, onClose, onSave }: { title: string; onClose: () => void; onSave: () => void }) => (
    <SidePanel
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button onClick={onClose} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>Cancel</button>
          <button onClick={onSave} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: submitting ? 0.5 : 1 }}>{submitting ? 'Saving...' : 'Save'}</button>
        </>
      }
    >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(['fullName', 'email', 'phone', 'ghanaCard'] as const).map(field => (
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
            <SearchableDropdown
              value={form.department}
              onChange={v => { setForm(p => ({ ...p, department: v, role: '' })); }}
              options={DEPARTMENTS.filter(d => d !== 'All').map(d => ({ value: d, label: d }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Role (within {form.department})</label>
            <SearchableDropdown
              value={form.role}
              onChange={v => setForm(p => ({ ...p, role: v }))}
              options={(departmentRoles.length ? departmentRoles : [form.department]).map(r => ({ value: r, label: r }))}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                value={newRoleName}
                disabled={submitting}
                placeholder="Add a new role for this department"
                onChange={e => setNewRoleName(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }}
              />
              <button type="button" onClick={addDepartmentRole} disabled={submitting || !newRoleName.trim()}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                Add
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Staff Category</label>
            <SearchableDropdown
              value={form.staffCategory}
              onChange={v => setForm(p => ({ ...p, staffCategory: v }))}
              options={STAFF_CATEGORIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Address</label>
            <input
              value={form.address}
              disabled={submitting}
              placeholder="E.g., House No. 12, East Legon, Accra"
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', opacity: submitting ? 0.5 : 1 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Profile Picture</label>
            {photoDataUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <img src={photoDataUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(photoDataUrl, '_blank', 'noopener,noreferrer')} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>Photo uploaded</span>
                <button type="button" onClick={() => setPhotoDataUrl(null)} style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.5rem 0.75rem', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {uploadingPhoto ? 'Uploading…' : <><Upload size={13} /> Upload Profile Picture</>}
                <input
                  type="file"
                  accept="image/*"
                  disabled={submitting || uploadingPhoto}
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingPhoto(true);
                    const reader = new FileReader();
                    reader.onload = () => { setPhotoDataUrl(reader.result as string); setUploadingPhoto(false); };
                    reader.onerror = () => { addNotification('Photo upload failed.'); setUploadingPhoto(false); };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Resume / CV</label>
            {resumeUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.5rem 0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}><FileText size={13} /> Resume uploaded</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => viewResume(resumeUrl!)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View</button>
                  <button type="button" onClick={() => setResumeUrl(null)} style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                </div>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.5rem 0.75rem', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {uploadingResume ? 'Uploading…' : <><Upload size={13} /> Upload Resume/CV</>}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  disabled={submitting || uploadingResume}
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingResume(true);
                    try {
                      // Private bucket — stores the raw storage path, not
                      // a public URL. resumeUrl keeps its name for minimal
                      // diff even though it now holds a path.
                      const path = await uploadPrivateFile(file, 'staff-resumes', editTarget?.id || `new-${Date.now()}`);
                      if (!path) throw new Error('Upload failed.');
                      setResumeUrl(path);
                    } catch (err: any) {
                      addNotification(`Resume upload failed: ${err.message || 'Unknown error'}`);
                    } finally {
                      setUploadingResume(false);
                    }
                  }}
                />
              </label>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Guarantee Information</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {([
                ['guarantorName', 'Guarantor Name'],
                ['guarantorPhone', 'Guarantor Phone'],
                ['guarantorRelationship', 'Relationship'],
                ['guarantorIdNumber', 'Guarantor ID Number'],
                ['guarantorAddress', 'Guarantor Address'],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
                  <input
                    value={form[field]}
                    disabled={submitting}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', opacity: submitting ? 0.5 : 1 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
    </SidePanel>
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
            {selected.photo ? (
              <img
                src={selected.photo}
                alt={selected.fullName}
                onClick={() => window.open(selected.photo, '_blank', 'noopener,noreferrer')}
                title="Click to view full size"
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', border: '1px solid var(--border)' }}
              />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                {initials(selected.fullName)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontWeight: 700 }}>{selected.fullName}</h2>
              <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 14 }}>{selected.role} · {selected.department}</p>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>{selected.status}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
            {[
              { icon: <Award size={14} />, label: 'Employee Number', value: selected.employeeNumber || '—' },
              { icon: <Mail size={14} />, label: 'Email', value: selected.email },
              { icon: <Phone size={14} />, label: 'Phone', value: selected.phone },
              { icon: <CreditCard size={14} />, label: 'Ghana Card', value: selected.ghanaCard },
              { icon: <MapPin size={14} />, label: 'Address', value: selected.address || '—' },
              { icon: <Calendar size={14} />, label: 'Joined', value: selected.joinedAt },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{item.icon}{item.label}</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {(selected.resumeUrl || selected.guarantorName || selected.guarantorPhone || selected.guarantorIdNumber) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {selected.resumeUrl && (
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}><FileText size={16} /> Resume / CV</span>
                <button type="button" onClick={() => viewResume(selected.resumeUrl!)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  View <ExternalLink size={11} />
                </button>
              </div>
            )}
            {(selected.guarantorName || selected.guarantorPhone || selected.guarantorIdNumber) && (
              <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Guarantee Information</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: 12 }}>
                  {[
                    ['Name', selected.guarantorName], ['Phone', selected.guarantorPhone],
                    ['Relationship', selected.guarantorRelationship], ['ID Number', selected.guarantorIdNumber],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k}><span style={{ color: 'var(--text-muted)' }}>{k}: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span></div>
                  ))}
                  {selected.guarantorAddress && (
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Address: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selected.guarantorAddress}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--border)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>HR Remarks</p>
            {isHrOrAdmin && (
              <button onClick={() => { setRemarksDraft(selected.hrRemarks || ''); setRemarksModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
                <Edit2 size={12} /> Edit
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: selected.hrRemarks ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
            {selected.hrRemarks || 'No remarks on file.'}
          </p>
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
            <div style={{ padding: '0.75rem' }}>
              <ResponsiveDataView<any>
                columns={[
                  { key: 'date', label: 'Date', primary: true },
                  { key: 'check_in_time', label: 'Check-In', render: a => a.check_in_time || '--' },
                  {
                    key: 'status', label: 'Status', status: true, render: a => {
                      const isPresent = a.status === 'PRESENT' || a.status === 'present' || a.status === 'LATE' || a.status === 'late';
                      const ac = isPresent ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981' } : { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
                      return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ac.bg, color: ac.color }}>{a.status}</span>;
                    }
                  },
                ]}
                data={attendance}
                rowKey={a => String(a.id ?? a.date)}
                loading={loadingDetails}
                emptyTitle="No attendance records"
                emptyDescription="No attendance records found for this staff member"
              />
            </div>
          )}
          {profileTab === 'leave' && (
            <div style={{ padding: '0.75rem' }}>
              <ResponsiveDataView<any>
                columns={[
                  { key: 'leave_type', label: 'Type', primary: true },
                  { key: 'start_date', label: 'Start' },
                  { key: 'end_date', label: 'End' },
                  { key: 'days_count', label: 'Days' },
                  {
                    key: 'status', label: 'Status', status: true, render: l => {
                      const isApproved = l.status === 'Approved' || l.status === 'APPROVED' || l.status === 'approved';
                      const lc = isApproved ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981' } : { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
                      return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: lc.bg, color: lc.color }}>{l.status}</span>;
                    }
                  },
                ]}
                data={leaves}
                rowKey={l => String(l.id ?? l.start_date)}
                loading={loadingDetails}
                emptyTitle="No leave requests"
                emptyDescription="No leave requests found for this staff member"
              />
            </div>
          )}
          {profileTab === 'performance' && (() => {
            const presentCount = attendance.filter(a => {
              const s = String(a.status || '').toUpperCase();
              return s === 'PRESENT' || s === 'LATE';
            }).length;
            const attendanceScore = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : null;
            const metrics = [
              { label: 'Attendance', score: attendanceScore, real: true },
              { label: 'Task Completion', score: selected.performanceTaskScore ?? null, real: false },
              { label: 'Team Collaboration', score: selected.performanceTeamScore ?? null, real: false },
              { label: 'Quality of Work', score: selected.performanceQualityScore ?? null, real: false },
            ];
            const setScores = metrics.filter(m => m.score !== null).map(m => m.score as number);
            const overall = setScores.length > 0 ? Math.round(setScores.reduce((s, v) => s + v, 0) / setScores.length) : null;

            const exportReport = () => {
              downloadRowPDF(`Performance Report — ${selected.fullName}`, {
                'Employee Number': selected.employeeNumber || '—',
                'Full Name': selected.fullName,
                'Department': selected.department,
                'Role': selected.role,
                'Overall Score': overall !== null ? `${overall}%` : 'Not yet reviewed',
                'Attendance (computed)': attendanceScore !== null ? `${attendanceScore}%` : 'No attendance records',
                'Task Completion': selected.performanceTaskScore !== undefined ? `${selected.performanceTaskScore}%` : 'Not yet reviewed',
                'Team Collaboration': selected.performanceTeamScore !== undefined ? `${selected.performanceTeamScore}%` : 'Not yet reviewed',
                'Quality of Work': selected.performanceQualityScore !== undefined ? `${selected.performanceQualityScore}%` : 'Not yet reviewed',
                'Notes': selected.performanceNotes || '—',
                'Reviewed By': selected.performanceReviewedBy || '—',
                'Reviewed At': selected.performanceReviewedAt ? new Date(selected.performanceReviewedAt).toLocaleString() : '—',
              });
              addNotification('Performance report downloaded.');
            };

            return (
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: '1rem' }}>
                  {isHrOrAdmin && (
                    <button onClick={() => { setPerfDraft({ taskScore: String(selected.performanceTaskScore ?? ''), teamScore: String(selected.performanceTeamScore ?? ''), qualityScore: String(selected.performanceQualityScore ?? ''), notes: selected.performanceNotes || '' }); setPerfModalOpen(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <Edit2 size={12} /> Edit Performance
                    </button>
                  )}
                  <button onClick={exportReport}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    <Download size={12} /> Export Performance Report
                  </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Overall Performance Score</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>{overall !== null ? `${overall}%` : 'Not yet reviewed'}</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${overall ?? 0}%`, background: 'var(--accent)', borderRadius: 5 }} />
                  </div>
                </div>
                {metrics.map(m => (
                  <div key={m.label} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{m.label}{m.real ? ' (from attendance records)' : ''}</span>
                      <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{m.score !== null ? `${m.score}%` : 'Not yet reviewed'}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${m.score ?? 0}%`, background: 'var(--accent)', borderRadius: 3, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <p style={{ margin: 0, color: selected.performanceNotes ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {selected.performanceNotes ? `Notes: ${selected.performanceNotes}` : 'No review notes on file.'}
                  </p>
                  {selected.performanceReviewedBy && (
                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: 11 }}>
                      Last reviewed by {selected.performanceReviewedBy}{selected.performanceReviewedAt ? ` on ${new Date(selected.performanceReviewedAt).toLocaleDateString()}` : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        {showAdd && <FormModal title="Add Staff" onClose={() => setShowAdd(false)} onSave={handleSaveAdd} />}
        <SendInvitePanel />
        {editTarget && <FormModal title="Edit Staff" onClose={() => setEditTarget(null)} onSave={handleSaveEdit} />}

        <SidePanel
          open={remarksModalOpen}
          onClose={() => setRemarksModalOpen(false)}
          title="Edit HR Remarks"
          footer={
            <>
              <button onClick={() => setRemarksModalOpen(false)} className="erp-btn erp-btn-ghost">Cancel</button>
              <button
                onClick={async () => {
                  if (!selected) return;
                  try {
                    await hr.updateStaffDetails(selected.id, { hrRemarks: remarksDraft });
                    const updated = { ...selected, hrRemarks: remarksDraft || undefined };
                    setSelected(updated);
                    setStaff(prev => prev.map(s => s.id === selected.id ? updated : s));
                    setRemarksModalOpen(false);
                    addNotification('HR remarks updated.');
                  } catch (err: any) {
                    addNotification(`Failed to update remarks: ${err.message}`);
                  }
                }}
                className="erp-btn erp-btn-primary"
              >
                Save
              </button>
            </>
          }
        >
          <textarea
            value={remarksDraft}
            onChange={e => setRemarksDraft(e.target.value)}
            rows={5}
            placeholder="Internal HR notes about this employee..."
            style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
          />
        </SidePanel>

        <SidePanel
          open={perfModalOpen}
          onClose={() => setPerfModalOpen(false)}
          title="Edit Performance Scores"
          footer={
            <>
              <button onClick={() => setPerfModalOpen(false)} className="erp-btn erp-btn-ghost">Cancel</button>
              <button
                onClick={async () => {
                  if (!selected) return;
                  try {
                    await hr.updatePerformance(selected.id, {
                      taskScore: perfDraft.taskScore === '' ? null : Math.max(0, Math.min(100, Number(perfDraft.taskScore) || 0)),
                      teamScore: perfDraft.teamScore === '' ? null : Math.max(0, Math.min(100, Number(perfDraft.teamScore) || 0)),
                      qualityScore: perfDraft.qualityScore === '' ? null : Math.max(0, Math.min(100, Number(perfDraft.qualityScore) || 0)),
                      notes: perfDraft.notes,
                    }, currentUser?.fullName || 'HR');
                    const updated = {
                      ...selected,
                      performanceTaskScore: perfDraft.taskScore === '' ? undefined : Number(perfDraft.taskScore),
                      performanceTeamScore: perfDraft.teamScore === '' ? undefined : Number(perfDraft.teamScore),
                      performanceQualityScore: perfDraft.qualityScore === '' ? undefined : Number(perfDraft.qualityScore),
                      performanceNotes: perfDraft.notes || undefined,
                      performanceReviewedBy: currentUser?.fullName || 'HR',
                      performanceReviewedAt: new Date().toISOString(),
                    };
                    setSelected(updated);
                    setStaff(prev => prev.map(s => s.id === selected.id ? updated : s));
                    setPerfModalOpen(false);
                    addNotification('Performance scores updated.');
                  } catch (err: any) {
                    addNotification(`Failed to update performance: ${err.message}`);
                  }
                }}
                className="erp-btn erp-btn-primary"
              >
                Save
              </button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {([
              ['taskScore', 'Task Completion (0-100)'],
              ['teamScore', 'Team Collaboration (0-100)'],
              ['qualityScore', 'Quality of Work (0-100)'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
                <input
                  type="number" min={0} max={100}
                  value={perfDraft[field]}
                  onChange={e => setPerfDraft(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Review Notes</label>
              <textarea
                value={perfDraft.notes}
                onChange={e => setPerfDraft(p => ({ ...p, notes: e.target.value }))}
                rows={4}
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
          </div>
        </SidePanel>
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
        <button onClick={() => { setForm(blankForm); setResumeUrl(null); setPhotoDataUrl(null); setShowAdd(true); }}
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
        <SearchableDropdown value={deptFilter} onChange={setDeptFilter} options={DEPARTMENTS.map(d => ({ value: d, label: d }))} className="w-40" />
        <SearchableDropdown value={statusFilter} onChange={setStatusFilter} options={['All', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => ({ value: s, label: s }))} className="w-36" />
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
        <div style={{ padding: '0.75rem' }}>
          <ResponsiveDataView<StaffMember>
            columns={[
              {
                key: 'fullName', label: 'Name', primary: true, render: s => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {initials(s.fullName)}
                    </div>
                    <span style={{ whiteSpace: 'nowrap' }}>{s.fullName}</span>
                  </div>
                )
              },
              { key: 'email', label: 'Email' },
              { key: 'department', label: 'Department' },
              { key: 'role', label: 'Role' },
              { key: 'phone', label: 'Phone' },
              {
                key: 'status', label: 'Status', status: true, render: s => {
                  const sc = statusColor(s.status);
                  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{s.status}</span>;
                }
              },
              { key: 'joinedAt', label: 'Joined' },
            ]}
            data={filtered}
            rowKey={s => s.id}
            onRowClick={s => setSelected(s)}
            emptyTitle={staff.length === 0 ? 'No staff members yet' : 'No staff members found'}
            emptyDescription={staff.length === 0 ? 'They will appear here once added' : undefined}
            renderActions={s => (
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
            )}
          />
        </div>
        {!loadingStaff && staff.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Showing {staff.length}{typeof total === 'number' ? ` of ${total.toLocaleString()}` : ''}</span>
            {hasMore && (
              <button onClick={loadMore} style={{ padding: '0.4rem 0.75rem', borderRadius: 8, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Load more</button>
            )}
          </div>
        )}
        </>
        )}
      </div>

      {showAdd && <FormModal title="Add Staff" onClose={() => setShowAdd(false)} onSave={handleSaveAdd} />}
        <SendInvitePanel />
      {editTarget && <FormModal title="Edit Staff" onClose={() => setEditTarget(null)} onSave={handleSaveEdit} />}
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
