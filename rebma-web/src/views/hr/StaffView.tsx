import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, MoreVertical, ChevronLeft, Mail, Phone, CreditCard,
  Calendar, Award, Clock, Edit2, UserX, Eye, TrendingUp, MapPin, Upload,
  FileText, ExternalLink, Download, Send, UserMinus, MessageCircle, Copy
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { StaffMember } from '../../types/erp';
import { hr } from '../../services/apiClient';
import { uploadFile, uploadPrivateFile, getSignedFileUrl } from '../../utils/uploadFile';
import { downloadRowPDF, exportToCSV } from '../../utils/export';
import { loadDirectory, STATUS_LABEL, KIND_LABEL, terminateApi, findPreviousHolders, type DirectoryRow, type PreviousHolder } from '../../utils/staffDirectory';
import { createNonAppStaff, setNonAppStaffStatus, type NonAppStaffRow } from '../../utils/nonAppStaff';
import { newSecureToken } from '../../utils/secureToken';
import DeletionRequestsPanel from '../../components/hr/DeletionRequestsPanel';
import EnrollmentSection from '../../components/hr/EnrollmentSection';
import SidePanel from '../../components/ui/SidePanel';
import AddressInput from '../../components/common/AddressInput';
import PasswordConfirmModal from '../../components/ui/PasswordConfirmModal';
import { callPrivilegedApi } from '../../utils/privilegedApi';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

const STAFF_CATEGORIES = ['Senior Staff', 'Junior Staff', 'Management', 'Contract Staff', 'Intern'];


const DEPARTMENTS = ['All', 'Admin & Warehouse', 'Account Department', 'HR', 'Marketing', 'Reception', 'Production', 'Management', 'Risk'];

// profiles.role has its own check constraint with specific casing/naming
// (e.g. 'receptionist' not 'Reception') — map the UI's department labels to it.
const DEPT_TO_ROLE: Record<string, string> = {
  'Admin & Warehouse': 'admin_warehouse', 'Account Department': 'finance', HR: 'HR',
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
  dateOfBirth: p.date_of_birth || undefined,
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
  currentUser?: { id?: string; fullName: string; department: string; isAdmin?: boolean } | null;
}

export default function StaffView({ staffList: propStaff, addNotification, currentUser }: Props) {
  const isHrOrAdmin = currentUser?.isAdmin || currentUser?.department === 'HR' || currentUser?.department === 'MANAGEMENT';
  // Step 4: one list for everyone (app users, staff without the app,
  // unused invites, former staff), loaded by utils/staffDirectory.ts.
  const [directory, setDirectory] = useState<DirectoryRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const reloadDirectory = async () => {
    try {
      const rows = await loadDirectory();
      setDirectory(rows);
      setStaff(rows.filter(r => r.kind === 'app').map(r => mapStaffRow(r.raw)));
      setStaffError(null);
    } catch (e: any) {
      setStaffError(e.message || 'Could not load staff.');
    } finally {
      setLoadingStaff(false);
    }
  };
  useEffect(() => { reloadDirectory(); }, []);
  const [kindFilter, setKindFilter] = useState('All');
  const [enrollFilter, setEnrollFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [selectedOther, setSelectedOther] = useState<DirectoryRow | null>(null);
  const [terminating, setTerminating] = useState<DirectoryRow | null>(null);
  // Hiring into a department and role where someone was terminated: HR
  // picks Continue previous work or Start new (api/approve-user.ts carries
  // out Continue once the new person is approved).
  const [previousHolders, setPreviousHolders] = useState<PreviousHolder[]>([]);
  const [continueFromId, setContinueFromId] = useState('');
  const [workChoice, setWorkChoice] = useState<'continue' | 'start_new' | null>(null);
  const [resendingInvite, setResendingInvite] = useState(false);
  // "Send sign-in notice again": re-sends the approved email and text.
  const [sendingNotice, setSendingNotice] = useState(false);
  const [noticeResult, setNoticeResult] = useState<{ ok: boolean; text: string } | null>(null);
  const sendSignInNotice = async (userId: string) => {
    if (sendingNotice) return;
    setSendingNotice(true);
    setNoticeResult(null);
    try {
      const res: any = await callPrivilegedApi('/api/send-approval-notice', { userId });
      setNoticeResult({ ok: !!res?.success, text: res?.message || 'Done.' });
    } catch (err: any) {
      setNoticeResult({ ok: false, text: `Could not send: ${err.message}` });
      addNotification(`Sign-in notice failed: ${err.message}`);
    } finally {
      setSendingNotice(false);
    }
  };
  const [resent, setResent] = useState<{ name: string; message: string; link: string; phone: string } | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Current');
  const [roleFilter, setRoleFilter] = useState('');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  // The sign-in notice result belongs to one person; clear it on switching.
  useEffect(() => { setNoticeResult(null); }, [selected?.id]);
  const [profileTab, setProfileTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const blankForm = {
    fullName: '', email: '', department: 'Admin & Warehouse', role: '', phone: '', ghanaCard: '',
    address: '', staffCategory: '', guarantorName: '', guarantorPhone: '', guarantorRelationship: '', guarantorIdNumber: '', guarantorAddress: '',
    dateOfBirth: '',
  };
  // Not everyone hired uses the app. "Employee number only" issues a real
  // employee number for attendance devices, with no invite and no app
  // account (same as the phone; utils/nonAppStaff.ts).
  const [appAccessMode, setAppAccessMode] = useState<'full' | 'none'>('full');
  const [createdNonAppStaff, setCreatedNonAppStaff] = useState<NonAppStaffRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [totalOnLeave, setTotalOnLeave] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Why Save didn't go through, shown right above the Save button. These
  // messages used to go only to a pop-up hidden behind the open form, so
  // Save looked like it did nothing.
  const [formError, setFormError] = useState('');
  const fail = (msg: string) => { setFormError(msg); addNotification(msg); };

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
  useEffect(() => {
    setWorkChoice(null);
    if (!showAdd || appAccessMode !== 'full' || !form.role.trim()) { setPreviousHolders([]); setContinueFromId(''); return; }
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    findPreviousHolders(dbDept, form.role).then(list => {
      const sorted = [...list].sort((a, b) => b.leftOn.localeCompare(a.leftOn));
      setPreviousHolders(sorted);
      setContinueFromId(sorted[0]?.id || '');
    }).catch(() => setPreviousHolders([]));
  }, [showAdd, appAccessMode, form.department, form.role]);

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

  const filtered = directory.filter(r => {
    const q = search.toLowerCase();
    if (q && !(r.fullName.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q) || (r.employeeNumber || '').toLowerCase().includes(q) || (r.phone || '').includes(q))) return false;
    if (deptFilter !== 'All' && r.department !== deptFilter) return false;
    if (kindFilter !== 'All' && r.kind !== kindFilter) return false;
    if (statusFilter === 'Current' && (r.status === 'TERMINATED' || r.status === 'REJECTED')) return false;
    if (statusFilter !== 'All' && statusFilter !== 'Current' && r.status !== statusFilter) return false;
    if (roleFilter && !(r.role || '').toLowerCase().includes(roleFilter.toLowerCase())) return false;
    if (enrollFilter === 'Enrolled' && r.devices.length === 0) return false;
    if (enrollFilter === 'Not enrolled' && (r.devices.length > 0 || r.kind === 'invite')) return false;
    return true;
  }).sort((a, b) =>
    sortBy === 'newest' ? b.joinedAt.localeCompare(a.joinedAt)
    : sortBy === 'number' ? (a.employeeNumber || '~').localeCompare(b.employeeNumber || '~')
    : a.fullName.localeCompare(b.fullName));

  const totalActive = staff.filter(s => s.status === 'ACTIVE').length;
  const totalSuspended = staff.filter(s => s.status === 'SUSPENDED').length;

  const openEdit = (s: StaffMember) => {
    setFormError('');
    setEditTarget(s);
    setForm({
      fullName: s.fullName, email: s.email, department: s.department, role: s.role, phone: s.phone, ghanaCard: s.ghanaCard,
      address: s.address || '', staffCategory: s.staffCategory || '',
      guarantorName: s.guarantorName || '', guarantorPhone: s.guarantorPhone || '', guarantorRelationship: s.guarantorRelationship || '',
      guarantorIdNumber: s.guarantorIdNumber || '', guarantorAddress: s.guarantorAddress || '',
      dateOfBirth: s.dateOfBirth || '',
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
  const handleSaveNonAppStaff = async () => {
    if (submitting) return;
    setFormError('');
    if (!form.fullName.trim()) { fail('Full name is required.'); return; }
    setSubmitting(true);
    try {
      const dbDept = DEPT_TO_ROLE[form.department] || form.department;
      const created = await createNonAppStaff({
        fullName: form.fullName.trim(), department: dbDept, role: form.role || undefined, phone: form.phone || undefined,
        address: form.address || undefined, staffCategory: form.staffCategory || undefined,
        guarantorName: form.guarantorName || undefined, guarantorPhone: form.guarantorPhone || undefined,
        guarantorRelationship: form.guarantorRelationship || undefined, guarantorIdNumber: form.guarantorIdNumber || undefined,
        guarantorAddress: form.guarantorAddress || undefined, dateOfBirth: form.dateOfBirth || undefined,
        photo: photoDataUrl || undefined,
      }, currentUser?.fullName || null);
      setShowAdd(false);
      setCreatedNonAppStaff(created);
      setForm(blankForm);
      setPhotoDataUrl(null);
      setResumeUrl(null);
      reloadDirectory();
    } catch (err: any) {
      fail(`Could not save the employee: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAdd = async () => {
    if (appAccessMode === 'none') return handleSaveNonAppStaff();
    if (submitting) return;
    setFormError('');
    if (!form.fullName.trim()) { fail('Full name is required.'); return; }
    if (!form.email.trim()) { fail('Email is required.'); return; }
    // The live staff_invites.role column is required (found in live
    // testing on the phone), so ask for it clearly instead of failing on a
    // raw database error.
    if (!form.role.trim()) { fail('Role is required. Choose one, or add a role for this department.'); return; }
    // Someone joining HR is invited by the CEO, by email (the database
    // enforces this too, supabase_staff_lifecycle.sql).
    if (form.department === 'HR' && !currentUser?.isAdmin) {
      fail('Someone joining HR is invited by the CEO. The CEO adds them here and sends the link to their email.');
      return;
    }
    if (previousHolders.length > 0 && !workChoice) {
      fail('Someone was in this department and role before. Choose Continue previous work or Start new.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'hr_can_invite_staff').maybeSingle();
      if (gate?.setting_value === false) {
        fail('Inviting new staff is currently turned off by the CEO in Control Center.');
        setSubmitting(false);
        return;
      }

      const token = await newSecureToken();
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
        date_of_birth: form.dateOfBirth || null,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
        // The live column holds the account id (uuid), not a name; sending
        // a name failed with "invalid input syntax for type uuid" on the
        // phone in live testing.
        created_by: currentUser?.id || null,
        ...(workChoice === 'continue' && continueFromId ? {
          continue_from_id: continueFromId,
          continue_from_name: previousHolders.find(h => h.id === continueFromId)?.name || null,
        } : {}),
      } as any).select().single();
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
      reloadDirectory();
    } catch (err: any) {
      fail(`Could not save the candidate: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget || submitting) return;
    setFormError('');
    if (!form.fullName.trim()) { fail('Full name is required.'); return; }
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
          date_of_birth: form.dateOfBirth || null,
        } as any)
        .eq('id', editTarget.id);

      if (error) throw error;

      const updated = { ...editTarget, ...form, resumeUrl: resumeUrl || undefined, photo: photoDataUrl || undefined };
      setStaff(prev => prev.map(s => s.id === editTarget.id ? updated : s));
      reloadDirectory();
      if (selected?.id === editTarget.id) setSelected(updated);
      addNotification(`${form.fullName} updated`);
      setEditTarget(null);
    } catch (err: any) {
      fail(`Could not update the staff member: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Suspend / Reactivate go through the server (api/set-user-status.ts):
  // it checks the password, locks or unlocks sign-in, ends open sessions
  // and logs it. HR may only do this to ordinary staff; HR, Management and
  // CEO accounts are the CEO's to manage, so the option is hidden there.
  const [statusPending, setStatusPending] = useState<{ member: StaffMember; action: 'suspend' | 'reactivate' } | null>(null);
  const canChangeStatus = (s: StaffMember) => {
    if (s.role === 'CEO') return false;
    if (s.status !== 'ACTIVE' && s.status !== 'SUSPENDED') return false;
    if (currentUser?.isAdmin) return true;
    if (currentUser?.department !== 'HR') return false;
    return s.department !== 'HR' && s.department !== 'Management';
  };

  const handleSuspend = (s: StaffMember) => {
    setMenuOpen(null);
    setStatusPending({ member: s, action: s.status === 'SUSPENDED' ? 'reactivate' : 'suspend' });
  };

  const runStatusChange = async (password: string) => {
    const pending = statusPending;
    if (!pending) return;
    const res = await callPrivilegedApi<{ status?: string; message?: string }>('/api/set-user-status', { userId: pending.member.id, action: pending.action, password });
    const newStatus = (res.status || (pending.action === 'suspend' ? 'SUSPENDED' : 'ACTIVE')) as StaffMember['status'];
    setStaff(prev => prev.map(m => m.id === pending.member.id ? { ...m, status: newStatus } : m));
    reloadDirectory();
    if (selected?.id === pending.member.id) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    setStatusPending(null);
    addNotification(res.message || `${pending.member.fullName} ${pending.action === 'suspend' ? 'suspended' : 'reactivated'}`);
  };

  // Phase 8: replaces the old "here are the credentials" modal. HR picks
  // one or more real channels; each shows the exact message before
  // anything goes out, and a plain input if a contact detail is missing.
  // Same panel as the phone (rebma-mobile StaffScreen): one tap sends by
  // email and SMS (each line then says whether it went out), and WhatsApp
  // opens with the same message, including the app download link.
  const [appDownloadUrl, setAppDownloadUrl] = useState('');
  const [sendResult, setSendResult] = useState<{ email?: { sent: boolean; reason?: string }; sms?: { sent: boolean; reason?: string } } | null>(null);
  // Shown under the Send button; a pop-up would be hidden behind this panel.
  const [sendError, setSendError] = useState('');
  // The invite message HR has changed in the Send panel. null = nobody has
  // edited it yet, so the standard message (and designed email) is used.
  const [editedInviteMessage, setEditedInviteMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!createdInvite) return;
    setSendResult(null);
    setEditedInviteMessage(null);
    (supabase as any).from('ceo_settings').select('setting_value').eq('setting_key', 'app_download_url').maybeSingle()
      .then(({ data }: any) => {
        let v = data?.setting_value;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* plain text */ } }
        setAppDownloadUrl(String(v || '').trim());
      });
  }, [createdInvite?.id]);

  const SendInvitePanel = () => {
    if (!createdInvite) return null;
    const link = `${window.location.origin}/register?token=${createdInvite.token}`;
    // Same two-step wording as the email (api/_shared/mailer.ts).
    const steps = appDownloadUrl
      ? `1. Download the Rebma app: ${appDownloadUrl}\n2. Open the app, tap Register on the sign-in page, and paste this link: ${link}`
      : `Open the Rebma app, tap Register on the sign-in page, and paste this link: ${link}`;
    const defaultMessage = `Hi ${createdInvite.fullName}, you have been invited to join Rebma Impex.\n\n${steps}\n\nWhen you register you choose your own password. Your registration then waits for approval, and you will get an email as soon as you can sign in. The link expires in 7 days, and once you register it must be approved within 12 hours.`;
    const message = editedInviteMessage ?? defaultMessage;

    const sendEmailAndSms = async () => {
      setSendingEmail(true);
      setSendError('');
      setSendResult(null);
      try {
        const res: any = await callPrivilegedApi('/api/send-staff-invite-email', { inviteId: createdInvite.id, channels: ['email', 'sms'], ...(editedInviteMessage !== null ? { message: editedInviteMessage } : {}) });
        setSendResult({ email: res?.email, sms: res?.sms });
        reloadDirectory();
      } catch (err: any) {
        setSendError(`Could not send: ${err.message}`);
        addNotification(`Send failed: ${err.message}`);
      } finally {
        setSendingEmail(false);
      }
    };

    const openWhatsapp = () => {
      const num = sendWhatsappNumber.replace(/[^0-9+]/g, '');
      if (!num) { addNotification('Enter a WhatsApp number first.'); return; }
      window.open(`https://wa.me/${num.replace(/^0/, '233').replace('+', '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    };

    const resultLine = (label: string, r?: { sent: boolean; reason?: string }) => !r ? null : (
      <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: r.sent ? '#10b981' : '#ef4444' }}>
        {r.sent ? `${label}: sent` : `${label}: not sent. ${r.reason || ''}`}
      </p>
    );

    return (
      <SidePanel
        open={!!createdInvite}
        onClose={() => setCreatedInvite(null)}
        title="Send Invite"
        footer={<button onClick={() => setCreatedInvite(null)} className="erp-btn erp-btn-primary w-full">Done</button>}
      >
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 1rem' }}>Saved. Choose how to send the link to {createdInvite.fullName}.</p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>Email: {createdInvite.email || 'none on file'}</p>
            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 13 }}>SMS: {createdInvite.phone || 'no phone on file'}</p>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message (you can edit it)</label>
            <textarea
              value={message}
              onChange={e => setEditedInviteMessage(e.target.value)}
              rows={9}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)', margin: '0 0 6px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 0 10px' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep the link in the message. The email also gets a Register button.</span>
              {editedInviteMessage !== null && (
                <button type="button" onClick={() => setEditedInviteMessage(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reset to standard</button>
              )}
            </div>
            <button type="button" onClick={sendEmailAndSms} disabled={sendingEmail} className="erp-btn erp-btn-primary" style={{ width: '100%' }}>{sendingEmail ? 'Sending…' : 'Send by Email and SMS'}</button>
            {sendError && (
              <p role="alert" style={{ margin: '8px 0 0', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{sendError}</p>
            )}
            {sendResult && (
              <div style={{ marginTop: 6 }}>
                {resultLine('Email', sendResult.email)}
                {resultLine('SMS', sendResult.sms)}
              </div>
            )}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 13 }}>WhatsApp</p>
            <input value={sendWhatsappNumber} onChange={e => setSendWhatsappNumber(e.target.value)} placeholder="WhatsApp number (e.g. 0244123456)"
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
            <button type="button" onClick={openWhatsapp} className="erp-btn erp-btn-primary" style={{ width: '100%' }}>Open WhatsApp to Send</button>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>Opens your own WhatsApp with the message ready. You tap Send.</p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <code style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>{link}</code>
            <button type="button" onClick={() => { navigator.clipboard.writeText(link); addNotification('Link copied'); }} className="erp-btn erp-btn-ghost">Copy Link</button>
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
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {formError && (
            <p role="alert" style={{ margin: 0, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{formError}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => { setFormError(''); onClose(); }} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>Cancel</button>
            <button onClick={onSave} disabled={submitting} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: submitting ? 0.5 : 1 }}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      }
    >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {title === 'Add Staff' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>App Access</label>
              <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
                {([['full', 'Full App Account'], ['none', 'Employee # Only']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setAppAccessMode(v)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${appAccessMode === v ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                    style={appAccessMode === v ? { background: 'var(--accent)' } : undefined}>{label}</button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {appAccessMode === 'none' ? 'Only an employee number is issued, for attendance devices. No invite and no app account.' : 'Sends an invite link to register and download the app.'}
              </p>
            </div>
          )}
          {(['fullName', 'email', 'phone', 'ghanaCard'] as const).filter(f => !(title === 'Add Staff' && appAccessMode === 'none' && (f === 'email' || f === 'ghanaCard'))).map(field => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {field === 'fullName' ? 'Full Name' : field === 'ghanaCard' ? 'Ghana Card' : field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                value={form[field]}
                disabled={submitting}
                placeholder={({ fullName: 'e.g. Kofi Mensah', email: 'e.g. kofi@yourcompany.com', phone: 'e.g. 0244123456', ghanaCard: 'e.g. GHA-123456789-0' } as Record<string, string>)[field]}
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
          {title === 'Add Staff' && appAccessMode === 'full' && previousHolders.length > 0 && (
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Someone was here before</p>
              <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>
                {previousHolders.length === 1
                  ? `${previousHolders[0].name} was ${form.role} in ${form.department} and was terminated${previousHolders[0].leftOn ? ` on ${previousHolders[0].leftOn}` : ''}.`
                  : `${previousHolders.length} people were ${form.role} in ${form.department} before.`} Should this new person continue that work or start new?
              </p>
              {previousHolders.length > 1 && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Continue whose work?</label>
                  <SearchableDropdown value={continueFromId} onChange={setContinueFromId}
                    options={previousHolders.map(h => ({ value: h.id, label: h.name, sublabel: h.leftOn ? `Left ${h.leftOn}` : undefined }))} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {([['continue', 'Continue previous work'], ['start_new', 'Start new']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setWorkChoice(v)}
                    style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: workChoice === v ? 'none' : '1px solid var(--border)', background: workChoice === v ? 'var(--accent)' : 'transparent', color: workChoice === v ? '#fff' : 'var(--text-secondary)' }}>
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                {workChoice === 'continue'
                  ? "Once they are approved, the open work the previous person was handling becomes theirs: open tasks, their spreadsheets, and the open orders, customers and cargo they looked after. Chats and meetings stay private. Past work keeps the previous person's name."
                  : workChoice === 'start_new'
                    ? 'Nothing is moved. All the previous work stays in the system for the department.'
                    : 'Pick one to continue.'}
              </p>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Staff Category</label>
            <SearchableDropdown
              value={form.staffCategory}
              onChange={v => setForm(p => ({ ...p, staffCategory: v }))}
              options={STAFF_CATEGORIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Date of Birth (for birthday wishes)</label>
            <input
              type="date"
              value={form.dateOfBirth}
              disabled={submitting}
              placeholder="YYYY-MM-DD"
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', opacity: submitting ? 0.5 : 1 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Address</label>
            <AddressInput
              value={form.address}
              disabled={submitting}
              placeholder="E.g., House No. 12, East Legon, Accra"
              onChange={v => setForm(p => ({ ...p, address: v }))}
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
                  {field === 'guarantorAddress' ? (
                    <AddressInput
                      value={form.guarantorAddress}
                      disabled={submitting}
                      placeholder="e.g. Plot 4, Tema Community 9"
                      onChange={v => setForm(p => ({ ...p, guarantorAddress: v }))}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', opacity: submitting ? 0.5 : 1 }}
                    />
                  ) : (
                  <input
                    value={form[field]}
                    disabled={submitting}
                    placeholder={({ guarantorName: 'e.g. Ama Owusu', guarantorPhone: 'e.g. 0201234567', guarantorRelationship: 'e.g. Aunt', guarantorIdNumber: 'e.g. GHA-987654321-0' } as Record<string, string>)[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', opacity: submitting ? 0.5 : 1 }}
                  />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
    </SidePanel>
  );

  // ── Step 4: the one staff list ──────────────────────────────────────
  const callerIsCeo = !!currentUser?.isAdmin;
  const callerIsHr = currentUser?.department === 'HR';
  const canManagePeople = callerIsCeo || callerIsHr;
  const ceoOnlyDept = (r: { department?: string; departmentCode?: string }) =>
    r.department === 'HR' || r.department === 'Management' || r.department === 'CEO'
    || ['hr', 'management', 'ceo'].includes(String(r.departmentCode || '').toLowerCase());
  const rowFor = (kind: 'app' | 'no_app', id: string) => directory.find(r => r.key === `${kind}:${id}`);

  // The CEO terminates someone at once, with his password. Nothing is
  // deleted: all their work stays in the system (api/terminate-user.ts).
  const canTerminate = (r: DirectoryRow) =>
    callerIsCeo && r.kind !== 'invite' && !r.isCeo && r.status !== 'TERMINATED' && r.id !== currentUser?.id;
  const startTerminate = (r: DirectoryRow) => { setMenuOpen(null); setTerminating(r); };
  const runTerminate = async (password: string) => {
    if (!terminating) return;
    const res = await terminateApi.terminate({ kind: terminating.kind as 'app' | 'no_app', id: terminating.id }, password);
    setTerminating(null);
    setSelected(null);
    setSelectedOther(null);
    addNotification(res.message);
    reloadDirectory();
  };

  const openRow = (r: DirectoryRow) => {
    setMenuOpen(null);
    if (r.kind === 'app') setSelected(staff.find(m => m.id === r.id) || mapStaffRow(r.raw));
    else setSelectedOther(r);
  };

  const resendInvite = async (r: DirectoryRow) => {
    if (resendingInvite) return;
    setResendingInvite(true);
    try {
      const res: any = await callPrivilegedApi('/api/resend-invite', { inviteId: r.id });
      setSelectedOther(null);
      setResent({ name: r.fullName, message: res?.message || 'A new link is ready.', link: res?.link || '', phone: res?.phone || r.phone || '' });
      reloadDirectory();
    } catch (e: any) {
      addNotification(`Could not resend the link: ${e.message}`);
    } finally {
      setResendingInvite(false);
    }
  };

  const toggleNonAppStatus = async (r: DirectoryRow) => {
    const next = r.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await setNonAppStaffStatus(r.id, next);
      setSelectedOther(prev => (prev && prev.id === r.id ? { ...prev, status: next } : prev));
      addNotification(`${r.fullName} ${next === 'SUSPENDED' ? 'suspended' : 'reactivated'}`);
      reloadDirectory();
    } catch (e: any) {
      addNotification(`Error updating status: ${e.message}`);
    }
  };

  const dirStatusStyle = (st: string) =>
    st === 'ACTIVE' ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981' }
    : st === 'SUSPENDED' || st === 'BLOCKED' ? { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' }
    : st === 'TERMINATED' ? { bg: 'var(--bg-input)', color: 'var(--text-muted)' }
    : st === 'INVITED' ? { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };

  const PersonPhoto = ({ name, photo, size = 34 }: { name: string; photo?: string; size?: number }) => photo ? (
    <img src={photo} alt={name} onClick={e => { e.stopPropagation(); window.open(photo, '_blank', 'noopener,noreferrer'); }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', cursor: 'zoom-in', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );

  const formerStaffBlock = (r: DirectoryRow | undefined) => {
    if (!r || r.status !== 'TERMINATED') return null;
    return (
      <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Former staff</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Terminated. They can no longer sign in. All the work they did stays in the system for their department.
        </p>
      </div>
    );
  };

  const exportDirectory = () => exportToCSV(filtered.map(r => ({
    fullName: r.fullName, type: KIND_LABEL[r.kind], status: STATUS_LABEL[r.status] || r.status, employeeNumber: r.employeeNumber || '',
    department: r.department, role: r.role || '', email: r.email || '', phone: r.phone || '', devices: r.devices.join('; '), joinedAt: r.joinedAt,
  })), ['fullName', 'type', 'status', 'employeeNumber', 'department', 'role', 'email', 'phone', 'devices', 'joinedAt'], 'staff_directory');

  // Panels shared by the list and the profile views.
  const extraPanels = () => (
    <>
      <SidePanel open={!!selectedOther} onClose={() => setSelectedOther(null)} title={selectedOther?.fullName || ''}
        subtitle={selectedOther ? `${KIND_LABEL[selectedOther.kind]}${selectedOther.department ? `, ${selectedOther.department}` : ''}` : undefined}>
        {selectedOther && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PersonPhoto name={selectedOther.fullName} photo={selectedOther.photo} size={52} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOther.fullName}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{selectedOther.kind === 'invite' ? 'Invited, not registered yet' : (selectedOther.employeeNumber || 'No employee number')}</p>
                <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: dirStatusStyle(selectedOther.status).bg, color: dirStatusStyle(selectedOther.status).color }}>{STATUS_LABEL[selectedOther.status] || selectedOther.status}</span>
              </div>
            </div>
            {formerStaffBlock(selectedOther)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {([
                ['Role', selectedOther.role], ['Phone', selectedOther.phone], ['Email', selectedOther.email],
                ['Address', selectedOther.raw?.address], ['Staff category', selectedOther.raw?.staff_category],
                ['Date of birth', selectedOther.raw?.date_of_birth], ['Added', selectedOther.joinedAt],
                ...(selectedOther.kind === 'invite' ? [['Link expires', selectedOther.raw?.expires_at ? new Date(selectedOther.raw.expires_at).toLocaleDateString() : ''], ['Sent by', (selectedOther.raw?.sent_via || []).join(', ') || 'Not sent yet']] : []),
                ['Guarantor', selectedOther.raw?.guarantor_name], ['Guarantor phone', selectedOther.raw?.guarantor_phone],
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
            {selectedOther.kind === 'no_app' && (
              <EnrollmentSection personKind="no_app" personId={selectedOther.id} employeeNumber={selectedOther.employeeNumber} canEdit={canManagePeople} enrolledBy={currentUser?.fullName || 'HR'} addNotification={addNotification} onChanged={reloadDirectory} />
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedOther.kind === 'invite' && canManagePeople && (
                <button onClick={() => resendInvite(selectedOther)} disabled={resendingInvite} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: resendingInvite ? 0.6 : 1 }}>
                  <Send size={13} /> {resendingInvite ? 'Sending…' : 'Resend link'}
                </button>
              )}
              {selectedOther.kind === 'no_app' && canManagePeople && (selectedOther.status === 'ACTIVE' || selectedOther.status === 'SUSPENDED') && (callerIsCeo || !ceoOnlyDept(selectedOther)) && (
                <button onClick={() => toggleNonAppStatus(selectedOther)} style={{ padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {selectedOther.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                </button>
              )}
              {canTerminate(selectedOther) && (
                <button onClick={() => startTerminate(selectedOther)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <UserMinus size={13} /> Terminate
                </button>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      <SidePanel open={!!resent} onClose={() => setResent(null)} title="Link Resent" subtitle={resent?.name}
        footer={<button onClick={() => setResent(null)} className="erp-btn erp-btn-primary w-full">Done</button>}>
        {resent && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{resent.message}</p>
            {resent.link && (
              <>
                <p style={{ margin: 0, fontSize: 12, wordBreak: 'break-all', color: 'var(--text-primary)', userSelect: 'all' }}>{resent.link}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {resent.phone && (
                    <button onClick={() => {
                      const digits = resent.phone.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '233');
                      const text = `Hi ${resent.name}, here is your new Rebma Impex registration link. Open the Rebma app, tap Register and paste it: ${resent.link}`;
                      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                    }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: 'none', background: '#25D366', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      <MessageCircle size={13} /> Send on WhatsApp
                    </button>
                  )}
                  <button onClick={() => { navigator.clipboard.writeText(resent.link); addNotification('Link copied'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <Copy size={13} /> Copy link
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </SidePanel>

      <SidePanel open={!!createdNonAppStaff} onClose={() => setCreatedNonAppStaff(null)} title="Employee Number Issued"
        footer={<button onClick={() => setCreatedNonAppStaff(null)} className="erp-btn erp-btn-primary w-full">Done</button>}>
        {createdNonAppStaff && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{createdNonAppStaff.employeeNumber}</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Assigned to {createdNonAppStaff.fullName}. No invite was sent and no app account was created. Enroll this exact employee number on their attendance device.
            </p>
          </div>
        )}
      </SidePanel>

      <PasswordConfirmModal
        open={!!terminating}
        onClose={() => setTerminating(null)}
        title="Confirm Termination"
        description={terminating ? `Terminate ${terminating.fullName}? They can no longer sign in. Nothing is deleted: all their work stays in the system. Type your password to confirm it is you.` : ''}
        confirmLabel="Terminate"
        danger
        onConfirm={runTerminate}
      />
    </>
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
              { icon: <Award size={14} />, label: 'Employee Number', value: selected.employeeNumber || 'Not set' },
              { icon: <Mail size={14} />, label: 'Email', value: selected.email },
              { icon: <Phone size={14} />, label: 'Phone', value: selected.phone },
              { icon: <CreditCard size={14} />, label: 'Ghana Card', value: selected.ghanaCard },
              { icon: <MapPin size={14} />, label: 'Address', value: selected.address || 'Not set' },
              { icon: <Calendar size={14} />, label: 'Joined', value: selected.joinedAt },
              { icon: <Calendar size={14} />, label: 'Date of Birth', value: selected.dateOfBirth || 'Not set' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '0.75rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{item.icon}{item.label}</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {(() => {
          const r = rowFor('app', selected.id);
          const m = staff.find(x => x.id === selected.id) || selected;
          return (
            <>
              {formerStaffBlock(r)}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
                {isHrOrAdmin && selected.status !== 'TERMINATED' && (
                  <button onClick={() => openEdit(m)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <Edit2 size={13} /> Edit
                  </button>
                )}
                {isHrOrAdmin && String(m.status).toUpperCase() === 'ACTIVE' && (
                  <button onClick={() => sendSignInNotice(m.id)} disabled={sendingNotice} title="Email and text them the sign-in details and app download link again"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: sendingNotice ? 0.6 : 1 }}>
                    <Send size={13} /> {sendingNotice ? 'Sending...' : 'Send sign-in notice again'}
                  </button>
                )}
                {canChangeStatus(m) && (
                  <button onClick={() => handleSuspend(m)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <UserX size={13} /> {m.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                  </button>
                )}
                {r && canTerminate(r) && (
                  <button onClick={() => startTerminate(r)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <UserMinus size={13} /> Terminate
                  </button>
                )}
              </div>
              {noticeResult && (
                <p role="status" style={{ margin: '-0.5rem 0 1rem', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: noticeResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: noticeResult.ok ? '#059669' : '#dc2626' }}>{noticeResult.text}</p>
              )}
              {selected.role !== 'CEO' && (
                <div style={{ marginBottom: '1rem' }}>
                  <EnrollmentSection personKind="app" personId={selected.id} employeeNumber={selected.employeeNumber} canEdit={canManagePeople} enrolledBy={currentUser?.fullName || 'HR'} addNotification={addNotification} onChanged={reloadDirectory} />
                </div>
              )}
            </>
          );
        })()}

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
              downloadRowPDF(`Performance Report: ${selected.fullName}`, {
                'Employee Number': selected.employeeNumber || 'Not set',
                'Full Name': selected.fullName,
                'Department': selected.department,
                'Role': selected.role,
                'Overall Score': overall !== null ? `${overall}%` : 'Not yet reviewed',
                'Attendance (computed)': attendanceScore !== null ? `${attendanceScore}%` : 'No attendance records',
                'Task Completion': selected.performanceTaskScore !== undefined ? `${selected.performanceTaskScore}%` : 'Not yet reviewed',
                'Team Collaboration': selected.performanceTeamScore !== undefined ? `${selected.performanceTeamScore}%` : 'Not yet reviewed',
                'Quality of Work': selected.performanceQualityScore !== undefined ? `${selected.performanceQualityScore}%` : 'Not yet reviewed',
                'Notes': selected.performanceNotes || 'Not set',
                'Reviewed By': selected.performanceReviewedBy || 'Not set',
                'Reviewed At': selected.performanceReviewedAt ? new Date(selected.performanceReviewedAt).toLocaleString() : 'Not set',
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
        {extraPanels()}
        {showAdd && FormModal({ title: "Add Staff", onClose: () => setShowAdd(false), onSave: handleSaveAdd })}
        {SendInvitePanel()}
        {editTarget && FormModal({ title: "Edit Staff", onClose: () => setEditTarget(null), onSave: handleSaveEdit })}

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
                <input placeholder="0 to 100"
                  type="number" min={0} max={100}
                  value={perfDraft[field]}
                  onChange={e => setPerfDraft(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Review Notes</label>
              <textarea placeholder="Write review notes"
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
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Everyone in one list: app users, staff without the app, invites and former staff.</p>
        </div>
        <button onClick={() => { setForm(blankForm); setResumeUrl(null); setPhotoDataUrl(null); setAppAccessMode('full'); setFormError(''); setShowAdd(true); }}
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

      {canManagePeople && (
        <div style={{ marginBottom: '1rem' }}>
          <DeletionRequestsPanel callerIsCeo={callerIsCeo} callerId={currentUser?.id} addNotification={addNotification} onChanged={reloadDirectory} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone or employee number..."
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </div>
        <SearchableDropdown value={kindFilter} onChange={setKindFilter} options={[{ value: 'All', label: 'All types' }, { value: 'app', label: 'App users' }, { value: 'no_app', label: 'No app' }, { value: 'invite', label: 'Invited' }]} className="w-36" />
        <SearchableDropdown value={deptFilter} onChange={setDeptFilter} options={['All', ...Array.from(new Set(directory.map(r => r.department).filter(Boolean))).sort()].map(d => ({ value: d, label: d === 'All' ? 'All departments' : d }))} className="w-44" />
        <SearchableDropdown value={statusFilter} onChange={setStatusFilter} options={[
          { value: 'Current', label: 'Current staff' }, { value: 'All', label: 'Everyone' },
          ...['ACTIVE', 'SUSPENDED', 'BLOCKED', 'PENDING_APPROVAL', 'INVITED', 'EXPIRED', 'TERMINATED'].map(st => ({ value: st, label: STATUS_LABEL[st] })),
        ]} className="w-40" />
        <SearchableDropdown value={enrollFilter} onChange={setEnrollFilter} options={['All', 'Enrolled', 'Not enrolled'].map(v => ({ value: v, label: v === 'All' ? 'Any enrollment' : v }))} className="w-40" />
        <SearchableDropdown value={sortBy} onChange={setSortBy} options={[{ value: 'name', label: 'Sort by name' }, { value: 'newest', label: 'Newest first' }, { value: 'number', label: 'By employee number' }]} className="w-44" />
        <input value={roleFilter} onChange={e => setRoleFilter(e.target.value)} placeholder="Filter by role..."
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: 13, minWidth: 140 }} />
        <button onClick={exportDirectory} disabled={filtered.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loadingStaff ? (
          <div style={{ padding: '1rem' }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
          </div>
        ) : (
        <>
        <div style={{ padding: '0.75rem' }}>
          <ResponsiveDataView<DirectoryRow>
            columns={[
              {
                key: 'fullName', label: 'Name', primary: true, render: r => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PersonPhoto name={r.fullName} photo={r.photo} />
                    <div>
                      <div style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{KIND_LABEL[r.kind]}{r.employeeNumber ? ` · ${r.employeeNumber}` : ''}</div>
                    </div>
                  </div>
                )
              },
              { key: 'department', label: 'Department', render: r => r.department || 'Not set' },
              { key: 'role', label: 'Role', render: r => r.role || 'Not set' },
              { key: 'phone', label: 'Phone', mobileHidden: true, render: r => r.phone || 'Not set' },
              { key: 'devices', label: 'Devices', render: r => (r.kind === 'invite' ? 'Not set' : r.devices.length ? r.devices.join(', ') : 'Not enrolled') },
              {
                key: 'status', label: 'Status', status: true, render: r => {
                  const sc = dirStatusStyle(r.status);
                  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{STATUS_LABEL[r.status] || r.status}</span>;
                }
              },
              { key: 'joinedAt', label: 'Added' },
            ]}
            data={filtered}
            rowKey={r => r.key}
            onRowClick={openRow}
            emptyTitle={staffError ? 'Couldn’t load staff' : directory.length === 0 ? 'No staff members yet' : 'No one matches'}
            emptyDescription={staffError || (directory.length === 0 ? 'They will appear here once added' : undefined)}
            renderActions={r => (
              <div style={{ position: 'relative' }}>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === r.key ? null : r.key); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                  <MoreVertical size={16} />
                </button>
                {menuOpen === r.key && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--box-shadow)', zIndex: 50, minWidth: 170 }}>
                    <button onClick={() => openRow(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
                      <Eye size={14} /> {r.kind === 'invite' ? 'View invite' : 'View Profile'}
                    </button>
                    {r.kind === 'app' && (() => { const m = staff.find(x => x.id === r.id); return m ? (
                      <>
                        <button onClick={() => openEdit(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
                          <Edit2 size={14} /> Edit
                        </button>
                        {canChangeStatus(m) && (
                          <button onClick={() => handleSuspend(m)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                            <UserX size={14} /> {m.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                          </button>
                        )}
                      </>
                    ) : null; })()}
                    {r.kind === 'invite' && canManagePeople && (
                      <button onClick={() => { setMenuOpen(null); resendInvite(r); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13 }}>
                        <Send size={14} /> Resend link
                      </button>
                    )}
                    {canTerminate(r) && (
                      <button onClick={() => startTerminate(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                        <UserMinus size={14} /> Terminate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          />
        </div>
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {directory.length} people
        </div>
        </>
        )}
      </div>

      {showAdd && FormModal({ title: "Add Staff", onClose: () => setShowAdd(false), onSave: handleSaveAdd })}
        {SendInvitePanel()}
      {editTarget && FormModal({ title: "Edit Staff", onClose: () => setEditTarget(null), onSave: handleSaveEdit })}
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(null)} />}
      {extraPanels()}
      <PasswordConfirmModal
        open={!!statusPending}
        onClose={() => setStatusPending(null)}
        title={statusPending?.action === 'reactivate' ? 'Confirm Reactivation' : 'Confirm Suspension'}
        description={statusPending
          ? (statusPending.action === 'reactivate'
            ? `Reactivate ${statusPending.member.fullName}? They can sign in again. Type your password to confirm it is you.`
            : `Suspend ${statusPending.member.fullName}? They are signed out everywhere and cannot sign in until reactivated. Type your password to confirm it is you.`)
          : ''}
        confirmLabel={statusPending?.action === 'reactivate' ? 'Reactivate' : 'Suspend'}
        danger={statusPending?.action === 'suspend'}
        onConfirm={runStatusChange}
      />
    </div>
  );
}
