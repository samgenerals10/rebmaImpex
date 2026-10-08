// rebma-mobile/screens/hr/StaffScreen.tsx
// Ports: rebma-web/src/views/hr/StaffView.tsx (906 lines, read in full) —
// the centerpiece of Phase 7.7 (D50). Paginated staff directory
// (usePaginatedQuery, D49), full profile detail (Attendance/Leave/
// Performance tabs), HR Remarks edit, Performance edit (3 HR-set scores +
// a real attendance-computed score), résumé upload (D52). Edit Staff is a
// plain, unblocked `profiles` update. Add Staff needs the privileged
// register-staff-user API — wired via lib/apiBase.ts (D53), fails with a
// clear message until EXPO_PUBLIC_API_BASE_URL is configured.
//
// "Export Performance Report" (Gap-Closure Backlog, Item 1): a
// single-record PDF, verbatim field set from StaffView.tsx:601-616's
// downloadRowPDF call, reusing this screen's own already-computed
// attendanceScore/overall values (no new aggregation logic).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { UserPlus, FileText, ExternalLink, Edit2, UserX, UserCheck as UserCheckIcon, Download, UserMinus, Send, Copy, MessageCircle, Fingerprint } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabaseClient';
import { newSecureToken } from '../../lib/secureToken';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
import { updateStaffDetails, updatePerformance } from '../../lib/hrActions';
import { createNonAppStaff, setNonAppStaffStatus, type NonAppStaffRow } from '../../lib/nonAppStaff';
import { loadDirectory, STATUS_LABEL, KIND_LABEL, terminateApi, findPreviousHolders, type DirectoryRow, type PreviousHolder } from '../../lib/staffDirectory';
import { getCeoSetting } from '../../lib/ceoSetting';
import { pickDocument, pickOrCaptureImage } from '../../lib/media';
import { uploadToPrivateBucket, getSignedUrl } from '../../lib/storage';
import { exportFieldValueDocument } from '../../lib/exportEngine';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import ProgressBar from '../../components/ui/ProgressBar';
import Tabs from '../../components/ui/Tabs';
import PasswordConfirmSheet from '../../components/shared/PasswordConfirmSheet';
import DeletionRequestsPanel from '../../components/shared/DeletionRequestsPanel';
import EnrollmentSection from '../../components/shared/EnrollmentSection';
import ExportSheet from '../../components/shared/ExportSheet';
import { useAuthStore } from '../../store/authStore';
import AddressInput from '../../components/shared/AddressInput';

const DEPARTMENTS = ['Admin & Warehouse', 'Account Department', 'HR', 'Marketing', 'Reception', 'Production', 'Management', 'Risk'];
const DEPT_TO_ROLE: Record<string, string> = {
  'Admin & Warehouse': 'admin_warehouse', 'Account Department': 'finance', HR: 'HR',
  Marketing: 'marketing', Reception: 'receptionist', Production: 'production', Management: 'management',
  Risk: 'risk',
};
const ROLE_TO_DEPT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DEPT_TO_ROLE).map(([dept, role]) => [role.toLowerCase(), dept])),
  operations: 'Admin & Warehouse', dispatch: 'Admin & Warehouse', logistics: 'Admin & Warehouse',
};
const roleToDeptLabel = (role: string) => ROLE_TO_DEPT[String(role || '').toLowerCase()] || role || 'Admin & Warehouse';
const STAFF_CATEGORIES = ['Senior Staff', 'Junior Staff', 'Management', 'Contract Staff', 'Intern'];

interface StaffMember {
  id: string; fullName: string; email: string; department: string; role: string; phone: string; ghanaCard: string;
  joinedAt: string; status: string; employeeNumber?: string; resumeUrl?: string; photo?: string; address?: string; hrRemarks?: string; dateOfBirth?: string;
  guarantorName?: string; guarantorPhone?: string; guarantorRelationship?: string; guarantorIdNumber?: string; guarantorAddress?: string;
  staffCategory?: string; performanceTaskScore?: number; performanceTeamScore?: number; performanceQualityScore?: number;
  performanceNotes?: string; performanceReviewedBy?: string; performanceReviewedAt?: string;
}

function mapStaffRow(p: any): StaffMember {
  return {
    id: p.id, fullName: p.full_name || 'Employee', email: p.email || '', department: roleToDeptLabel(p.role),
    role: p.is_admin ? 'CEO' : (p.metadata?.role || 'Staff'), phone: p.phone || '', ghanaCard: p.ghana_card_id || '',
    joinedAt: p.created_at ? p.created_at.split('T')[0] : '', status: p.status || 'ACTIVE',
    employeeNumber: p.employee_number || undefined, resumeUrl: p.resume_url || undefined, photo: p.photo || undefined, address: p.address || undefined,
    dateOfBirth: p.date_of_birth || undefined,
    hrRemarks: p.hr_remarks || undefined, guarantorName: p.guarantor_name || undefined, guarantorPhone: p.guarantor_phone || undefined,
    guarantorRelationship: p.guarantor_relationship || undefined, guarantorIdNumber: p.guarantor_id_number || undefined,
    guarantorAddress: p.guarantor_address || undefined, staffCategory: p.staff_category || undefined,
    performanceTaskScore: p.performance_task_score ?? undefined, performanceTeamScore: p.performance_team_score ?? undefined,
    performanceQualityScore: p.performance_quality_score ?? undefined, performanceNotes: p.performance_notes || undefined,
    performanceReviewedBy: p.performance_reviewed_by || undefined, performanceReviewedAt: p.performance_reviewed_at || undefined,
  };
}

const blankForm = {
  fullName: '', email: '', department: 'Admin & Warehouse', role: '', phone: '', ghanaCard: '', address: '', staffCategory: '',
  guarantorName: '', guarantorPhone: '', guarantorRelationship: '', guarantorIdNumber: '', guarantorAddress: '', dateOfBirth: '',
};

export default function StaffScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  // Step 4: one list for everyone (app users, staff without the app,
  // unused invites, former staff), loaded by lib/staffDirectory.ts.
  const [directory, setDirectory] = useState<DirectoryRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const rows = await loadDirectory();
      setDirectory(rows);
      setStaff(rows.filter((r) => r.kind === 'app').map((r) => mapStaffRow(r.raw)));
      setStaffError(null);
    } catch (e: any) {
      setStaffError(e.message || 'Could not load staff.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const [kindFilter, setKindFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Current');
  const [enrollFilter, setEnrollFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [showExport, setShowExport] = useState(false);
  const [selectedOther, setSelectedOther] = useState<DirectoryRow | null>(null);
  const [terminating, setTerminating] = useState<DirectoryRow | null>(null);
  const [deletionRefresh, setDeletionRefresh] = useState(0);
  // Hiring into a department and role where someone was terminated: HR
  // picks Continue previous work or Start new (api/approve-user.ts carries
  // out Continue once the new person is approved).
  const [previousHolders, setPreviousHolders] = useState<PreviousHolder[]>([]);
  const [continueFromId, setContinueFromId] = useState('');
  const [workChoice, setWorkChoice] = useState<'continue' | 'start_new' | null>(null);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [resent, setResent] = useState<{ name: string; message: string; link: string; phone: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [statusPending, setStatusPending] = useState<{ member: StaffMember; action: 'suspend' | 'reactivate' } | null>(null);
  const [profileTab, setProfileTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showForm, setShowForm] = useState<'add' | 'edit' | null>(null);
  // Direct instruction: not everyone who's hired uses the app. Someone
  // who only needs a real employee number (for a peripheral like the
  // attendance fingerprint terminal to identify them by) gets one right
  // here, with no invite email and no app account created at all — see
  // lib/nonAppStaff.ts / supabase_peripheral_devices.sql for why this is
  // a separate table from staff_invites, not a variant of it.
  const [appAccessMode, setAppAccessMode] = useState<'full' | 'none'>('full');
  const [createdNonAppStaff, setCreatedNonAppStaff] = useState<NonAppStaffRow | null>(null);
  const [form, setForm] = useState(blankForm);
  const [resumeUri, setResumeUri] = useState<{ uri: string; mimeType: string } | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Phase 8: Add Staff no longer creates a live account. It writes one
  // staff_invites row, notifies Risk, and opens this Send panel so HR can
  // push the link out — replaces the old "here are the credentials" sheet.
  const [createdInvite, setCreatedInvite] = useState<{ id: string; token: string; email: string; phone: string; fullName: string } | null>(null);
  const [sendResult, setSendResult] = useState<{ email?: { sent: boolean; reason?: string }; sms?: { sent: boolean; reason?: string } } | null>(null);
  const [sendWhatsappNumber, setSendWhatsappNumber] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  // The invite message HR has changed in the Send panel. null = not edited,
  // so the standard message (and designed email) is used. Same as web.
  const [editedInviteMessage, setEditedInviteMessage] = useState<string | null>(null);
  useEffect(() => { setEditedInviteMessage(null); }, [createdInvite?.id]);
  // CEO's private Google Play link (Control Center → API Keys). Reloaded
  // each time an invite is created so a link saved mid-session shows up.
  const [appDownloadUrl, setAppDownloadUrl] = useState('');
  useEffect(() => {
    if (createdInvite) getCeoSetting<string>('app_download_url', '').then((v) => setAppDownloadUrl(String(v || '').trim()));
  }, [createdInvite]);

  // Department-scoped Role dropdown (Phase 8) — falls back to just the
  // department name if nothing's been defined for it yet.
  const [departmentRoles, setDepartmentRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  useEffect(() => {
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    supabase.from('department_roles').select('role_name').eq('department', dbDept).order('role_name')
      .then(({ data }) => setDepartmentRoles((data || []).map((r: any) => r.role_name)));
  }, [form.department]);
  useEffect(() => {
    setWorkChoice(null);
    if (showForm !== 'add' || appAccessMode !== 'full' || !form.role.trim()) { setPreviousHolders([]); setContinueFromId(''); return; }
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    findPreviousHolders(dbDept, form.role).then((list) => {
      const sorted = [...list].sort((a, b) => b.leftOn.localeCompare(a.leftOn));
      setPreviousHolders(sorted);
      setContinueFromId(sorted[0]?.id || '');
    }).catch(() => setPreviousHolders([]));
  }, [showForm, appAccessMode, form.department, form.role]);

  const addDepartmentRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    const { error } = await supabase.from('department_roles').insert({ department: dbDept, role_name: name });
    if (!error) {
      setDepartmentRoles((prev) => [...prev, name].sort());
      setForm((p) => ({ ...p, role: name }));
      setNewRoleName('');
    } else {
      Alert.alert('Error', `Could not add role: ${error.message}`);
    }
  };

  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarksDraft, setRemarksDraft] = useState('');
  const [perfOpen, setPerfOpen] = useState(false);
  const [perfDraft, setPerfDraft] = useState({ taskScore: '', teamScore: '', qualityScore: '', notes: '' });
  const [perfExporting, setPerfExporting] = useState(false);

  useEffect(() => {
    if (!selected) { setAttendance([]); setLeaves([]); return; }
    (async () => {
      setLoadingDetails(true);
      const [{ data: attData }, { data: leaveData }] = await Promise.all([
        supabase.from('attendance').select('*').eq('user_id', selected.id).order('date', { ascending: false }),
        supabase.from('leave_requests').select('*').eq('staff_id', selected.id).order('start_date', { ascending: false }),
      ]);
      setAttendance(attData || []);
      setLeaves(leaveData || []);
      setLoadingDetails(false);
    })();
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = directory.filter((r) => {
      if (q && !(r.fullName.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q) || (r.employeeNumber || '').toLowerCase().includes(q) || (r.phone || '').includes(q))) return false;
      if (deptFilter !== 'All' && r.department !== deptFilter) return false;
      if (kindFilter !== 'All' && r.kind !== kindFilter) return false;
      if (statusFilter === 'Current' && (r.status === 'TERMINATED' || r.status === 'REJECTED')) return false;
      if (statusFilter !== 'All' && statusFilter !== 'Current' && r.status !== statusFilter) return false;
      if (enrollFilter === 'Enrolled' && r.devices.length === 0) return false;
      if (enrollFilter === 'Not enrolled' && (r.devices.length > 0 || r.kind === 'invite')) return false;
      return true;
    });
    return [...list].sort((a, b) =>
      sortBy === 'newest' ? b.joinedAt.localeCompare(a.joinedAt)
      : sortBy === 'number' ? (a.employeeNumber || '~').localeCompare(b.employeeNumber || '~')
      : a.fullName.localeCompare(b.fullName));
  }, [directory, search, deptFilter, kindFilter, statusFilter, enrollFilter, sortBy]);


  const openAdd = () => { setShowForm('add'); setAppAccessMode('full'); setForm(blankForm); setResumeUri(null); setResumeUrl(null); setPhotoDataUrl(null); };
  const openEdit = (s: StaffMember) => {
    setForm({
      fullName: s.fullName, email: s.email, department: s.department, role: s.role || '', phone: s.phone, ghanaCard: s.ghanaCard,
      address: s.address || '', staffCategory: s.staffCategory || '', guarantorName: s.guarantorName || '',
      guarantorPhone: s.guarantorPhone || '', guarantorRelationship: s.guarantorRelationship || '',
      guarantorIdNumber: s.guarantorIdNumber || '', guarantorAddress: s.guarantorAddress || '', dateOfBirth: s.dateOfBirth || '',
    });
    setResumeUrl(s.resumeUrl || null);
    setResumeUri(null);
    setPhotoDataUrl(s.photo || null);
    setShowForm('edit');
  };

  const captureResume = async () => {
    const picked = await pickDocument();
    if (picked) setResumeUri(picked);
  };

  const capturePhoto = async () => {
    const uri = await pickOrCaptureImage();
    if (uri) setPhotoDataUrl(uri);
  };

  // resumeUrl/selected.resumeUrl now hold a private-bucket PATH, not a
  // directly-openable URL — resolved to a fresh signed URL on demand.
  const viewResume = async (path: string) => {
    const url = await getSignedUrl('staff-resumes', path);
    if (!url) { Alert.alert('Unavailable', 'Could not open resume. It may have been removed.'); return; }
    Linking.openURL(url);
  };

  const uploadResumeIfNeeded = async (staffId: string): Promise<string | null> => {
    if (!resumeUri) return resumeUrl;
    setUploadingResume(true);
    try {
      // Private bucket — returns the raw storage path, not a public URL.
      const path = await uploadToPrivateBucket(resumeUri.uri, 'staff-resumes', staffId, resumeUri.mimeType);
      return path;
    } finally {
      setUploadingResume(false);
    }
  };

  // Phase 8: Add Staff no longer creates a live account. It writes one
  // staff_invites row carrying everything HR just entered, notifies Risk,
  // and hands off to the Send panel. The candidate only ever confirms
  // this record via the link — they never type any of it themselves.
  // Employee-number-only path: no email required, no gate check (that
  // gate is specifically "can HR invite people into the app," which
  // doesn't apply here since nothing is being invited), no résumé/photo
  // upload skipped either — same real record, just no account attached.
  const handleSaveNonAppStaff = async () => {
    if (submitting) return;
    if (!form.fullName.trim()) { Alert.alert('Missing Info', 'Full name is required.'); return; }
    setSubmitting(true);
    try {
      const dbDept = DEPT_TO_ROLE[form.department] || form.department;
      const created = await createNonAppStaff({
        fullName: form.fullName, department: dbDept, role: form.role || undefined, phone: form.phone || undefined,
        address: form.address || undefined, staffCategory: form.staffCategory || undefined,
        guarantorName: form.guarantorName || undefined, guarantorPhone: form.guarantorPhone || undefined,
        guarantorRelationship: form.guarantorRelationship || undefined, guarantorIdNumber: form.guarantorIdNumber || undefined,
        guarantorAddress: form.guarantorAddress || undefined, dateOfBirth: form.dateOfBirth || undefined,
        photo: photoDataUrl || undefined,
      }, profile?.fullName || null);
      setShowForm(null);
      setCreatedNonAppStaff(created);
      setForm(blankForm);
      setPhotoDataUrl(null);
      reload();
    } catch (e: any) {
      Alert.alert('Error Saving Employee', e.message || 'Failed to save employee record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAdd = async () => {
    if (appAccessMode === 'none') return handleSaveNonAppStaff();
    if (submitting) return;
    if (!form.email.trim()) { Alert.alert('Missing Info', 'Email is required.'); return; }
    // Real, confirmed live-testing finding: staff_invites.role is
    // NOT NULL on the actual live table, but nothing in this form
    // enforced picking one before this — it would fail at Save with a
    // raw Postgres constraint error instead of a clear message pointed
    // at the actual missing field. Not required for the Employee-#-Only
    // path (non_app_staff.role has no such constraint).
    if (!form.role.trim()) { Alert.alert('Missing Info', 'Role is required.'); return; }
    // Someone joining HR is invited by the CEO, by email (the database
    // enforces this too, supabase_staff_lifecycle.sql).
    if (form.department === 'HR' && !profile?.isAdmin) {
      Alert.alert('CEO only', 'Someone joining HR is invited by the CEO. The CEO adds them here and sends the link to their email.');
      return;
    }
    if (previousHolders.length > 0 && !workChoice) {
      Alert.alert('Previous work', 'Someone was in this department and role before. Choose Continue previous work or Start new.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'hr_can_invite_staff').maybeSingle();
      if (gate?.setting_value === false) {
        Alert.alert('Disabled', 'Inviting new staff is currently disabled by the CEO.');
        setSubmitting(false);
        return;
      }

      const finalResumeUrl = resumeUri ? await uploadResumeIfNeeded(`new-${Date.now()}`) : null;
      const token = await newSecureToken();
      const dbDept = DEPT_TO_ROLE[form.department] || form.department;
      const { data: inviteRow, error: inviteError } = await supabase.from('staff_invites').insert({
        token, email: form.email.trim().toLowerCase(), full_name: form.fullName, department: dbDept, role: form.role || null,
        phone: form.phone || null, photo: photoDataUrl, resume_url: finalResumeUrl, address: form.address || null,
        staff_category: form.staffCategory || null, guarantor_name: form.guarantorName || null, guarantor_phone: form.guarantorPhone || null,
        guarantor_relationship: form.guarantorRelationship || null, guarantor_id_number: form.guarantorIdNumber || null,
        guarantor_address: form.guarantorAddress || null, date_of_birth: form.dateOfBirth || null, status: 'pending',
        // Real, confirmed live-testing finding: the migration file that
        // added this column (supabase_recruitment_invites.sql) declares
        // it `text`, but the column that actually exists on the live
        // table is `uuid` — "add column if not exists" is a no-op
        // against an already-existing column, type mismatch or not, so
        // the migration's own declared type was never what's really
        // there. Sending profile.fullName (a display name string like
        // "HR") failed with "invalid input syntax for type uuid" the
        // moment the earlier date_of_birth blocker was cleared. The
        // real user id is what a uuid column actually wants.
        expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), created_by: profile?.id || null,
        ...(workChoice === 'continue' && continueFromId ? {
          continue_from_id: continueFromId,
          continue_from_name: previousHolders.find((h) => h.id === continueFromId)?.name || null,
        } : {}),
      }).select().single();
      if (inviteError) throw inviteError;

      await supabase.from('supplier_order_notifications').insert({
        message: `New recruitment record from HR: ${form.fullName} (${form.role || dbDept}). Résumé and photo available for review.`,
        notified_department: 'RISK', read: false,
      });

      setShowForm(null);
      setCreatedInvite({ id: inviteRow.id, token, email: form.email.trim().toLowerCase(), phone: form.phone, fullName: form.fullName });
      reload();
      setSendResult(null);
      setSendWhatsappNumber(form.phone);
      setForm(blankForm);
      setResumeUri(null);
      setResumeUrl(null);
      setPhotoDataUrl(null);
    } catch (e: any) {
      Alert.alert('Error Saving Candidate', e.message || 'Failed to save candidate record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const finalResumeUrl = await uploadResumeIfNeeded(selected.id);
      const { error } = await supabase.from('profiles').update({
        full_name: form.fullName, email: form.email, role: DEPT_TO_ROLE[form.department] || form.department,
        phone: form.phone, ghana_card_id: form.ghanaCard, address: form.address || null, resume_url: finalResumeUrl || null,
        photo: photoDataUrl || null,
        staff_category: form.staffCategory || null, guarantor_name: form.guarantorName || null, guarantor_phone: form.guarantorPhone || null,
        guarantor_relationship: form.guarantorRelationship || null, guarantor_id_number: form.guarantorIdNumber || null,
        guarantor_address: form.guarantorAddress || null, date_of_birth: form.dateOfBirth || null,
      }).eq('id', selected.id);
      if (error) throw error;
      const updated: StaffMember = { ...selected, ...form, resumeUrl: finalResumeUrl || undefined, photo: photoDataUrl || undefined };
      setStaff((prev) => prev.map((s) => (s.id === selected.id ? updated : s)));
      reload();
      setSelected(updated);
      setShowForm(null);
    } catch (e: any) {
      Alert.alert('Error Updating Staff', e.message || 'Failed to update staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Suspend / Reactivate go through the server (api/set-user-status.ts):
  // it checks the password, locks or unlocks sign-in, ends open sessions
  // and logs it. HR may only do this to ordinary staff; HR, Management and
  // CEO accounts are the CEO's to manage. The detail sheet closes first
  // because iOS can't show two sheets at once.
  const canChangeStatus = (s: StaffMember) => {
    if (s.id === profile?.id || s.role === 'CEO') return false;
    if (profile?.isAdmin) return true;
    if (profile?.department !== 'HR') return false;
    return s.department !== 'HR' && s.department !== 'Management';
  };

  const handleSuspend = (s: StaffMember) => {
    const action = s.status === 'SUSPENDED' ? 'reactivate' : 'suspend';
    setSelected(null);
    setTimeout(() => setStatusPending({ member: s, action }), 350);
  };

  const runStatusChange = async (password: string) => {
    const pending = statusPending;
    if (!pending) return;
    try {
      const res: any = await callPrivilegedApi('/api/set-user-status', { userId: pending.member.id, action: pending.action, password });
      const newStatus = res?.status || (pending.action === 'suspend' ? 'SUSPENDED' : 'ACTIVE');
      setStaff((prev) => prev.map((m) => (m.id === pending.member.id ? { ...m, status: newStatus } : m)));
      reload();
      setStatusPending(null);
      Alert.alert('Done', res?.message || 'Status updated.');
    } catch (e: any) {
      throw new Error(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
    }
  };

  const saveRemarks = async () => {
    if (!selected) return;
    try {
      await updateStaffDetails(selected.id, { hrRemarks: remarksDraft });
      const updated = { ...selected, hrRemarks: remarksDraft || undefined };
      setSelected(updated);
      setStaff((prev) => prev.map((s) => (s.id === selected.id ? updated : s)));
      reload();
      setRemarksOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update remarks.');
    }
  };

  const savePerformance = async () => {
    if (!selected) return;
    try {
      const scores = {
        taskScore: perfDraft.taskScore === '' ? null : Math.max(0, Math.min(100, Number(perfDraft.taskScore) || 0)),
        teamScore: perfDraft.teamScore === '' ? null : Math.max(0, Math.min(100, Number(perfDraft.teamScore) || 0)),
        qualityScore: perfDraft.qualityScore === '' ? null : Math.max(0, Math.min(100, Number(perfDraft.qualityScore) || 0)),
        notes: perfDraft.notes,
      };
      await updatePerformance(selected.id, scores, profile?.fullName || 'HR');
      const updated: StaffMember = {
        ...selected,
        performanceTaskScore: scores.taskScore ?? undefined,
        performanceTeamScore: scores.teamScore ?? undefined,
        performanceQualityScore: scores.qualityScore ?? undefined,
        performanceNotes: perfDraft.notes || undefined,
        performanceReviewedBy: profile?.fullName || 'HR',
        performanceReviewedAt: new Date().toISOString(),
      };
      setSelected(updated);
      setStaff((prev) => prev.map((s) => (s.id === selected.id ? updated : s)));
      reload();
      setPerfOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update performance.');
    }
  };

  const columns: DataColumn<StaffMember>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'status', label: 'Status', status: true, render: (s) => <Badge tone={s.status === 'ACTIVE' ? 'success' : s.status === 'SUSPENDED' ? 'danger' : 'warning'} label={s.status} size="xs" /> },
    { key: 'department', label: 'Department' },
    { key: 'employeeNumber', label: 'Employee #', render: (s) => s.employeeNumber || 'Not set' },
  ];

  const isHrOrAdmin = profile?.isAdmin || profile?.department === 'HR' || profile?.department === 'MANAGEMENT';

  const presentCount = attendance.filter((a) => ['PRESENT', 'LATE'].includes(String(a.status || '').toUpperCase())).length;
  const attendanceScore = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : null;
  const perfMetrics = selected ? [
    { label: 'Attendance', score: attendanceScore, real: true },
    { label: 'Task Completion', score: selected.performanceTaskScore ?? null },
    { label: 'Team Collaboration', score: selected.performanceTeamScore ?? null },
    { label: 'Quality of Work', score: selected.performanceQualityScore ?? null },
  ] : [];
  const setScores = perfMetrics.filter((m) => m.score !== null).map((m) => m.score as number);
  const overall = setScores.length > 0 ? Math.round(setScores.reduce((s, v) => s + v, 0) / setScores.length) : null;

  const exportPerformanceReport = async () => {
    if (!selected) return;
    setPerfExporting(true);
    try {
      await exportFieldValueDocument('pdf', `Performance Report: ${selected.fullName}`, {
        'Employee Number': selected.employeeNumber || 'Not set',
        'Full Name': selected.fullName,
        'Department': selected.department,
        'Role': selected.role || 'Not set',
        'Overall Score': overall !== null ? `${overall}%` : 'Not yet reviewed',
        'Attendance (computed)': attendanceScore !== null ? `${attendanceScore}%` : 'No attendance records',
        'Task Completion': selected.performanceTaskScore != null ? `${selected.performanceTaskScore}%` : 'Not yet reviewed',
        'Team Collaboration': selected.performanceTeamScore != null ? `${selected.performanceTeamScore}%` : 'Not yet reviewed',
        'Quality of Work': selected.performanceQualityScore != null ? `${selected.performanceQualityScore}%` : 'Not yet reviewed',
        'Notes': selected.performanceNotes || 'Not set',
        'Reviewed By': selected.performanceReviewedBy || 'Not set',
        'Reviewed At': selected.performanceReviewedAt ? new Date(selected.performanceReviewedAt).toLocaleString() : 'Not set',
      });
    } finally {
      setPerfExporting(false);
    }
  };

  // ── Step 4: the one staff list ──────────────────────────────────────
  const callerIsCeo = !!profile?.isAdmin;
  const callerIsHr = profile?.department === 'HR';
  const canManagePeople = callerIsCeo || callerIsHr;
  const ceoOnlyDept = (r: { department?: string; departmentCode?: string }) =>
    r.department === 'HR' || r.department === 'Management' || r.department === 'CEO'
    || ['hr', 'management', 'ceo'].includes(String(r.departmentCode || '').toLowerCase());
  const rowFor = (kind: 'app' | 'no_app', id: string) => directory.find((r) => r.key === `${kind}:${id}`);

  // The CEO terminates someone at once, with his password. Nothing is
  // deleted: all their work stays in the system (api/terminate-user.ts).
  const canTerminate = (r: DirectoryRow) =>
    callerIsCeo && r.kind !== 'invite' && !r.isCeo && r.status !== 'TERMINATED' && r.id !== profile?.id;
  // iOS can't show two sheets at once: close the profile, then ask.
  const startTerminate = (r: DirectoryRow) => {
    setSelected(null);
    setSelectedOther(null);
    setTimeout(() => setTerminating(r), 350);
  };
  const runTerminate = async (password: string) => {
    if (!terminating) return;
    try {
      const res = await terminateApi.terminate({ kind: terminating.kind as 'app' | 'no_app', id: terminating.id }, password);
      setTerminating(null);
      Alert.alert('Terminated', res.message);
      reload();
    } catch (e: any) {
      throw new Error(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
    }
  };

  const openRow = (r: DirectoryRow) => {
    if (r.kind === 'app') {
      const member = staff.find((m) => m.id === r.id) || mapStaffRow(r.raw);
      setSelected(member);
      setProfileTab('attendance');
    } else {
      setSelectedOther(r);
    }
  };

  // "Send sign-in notice again": re-sends the approved email and text,
  // with the app download link (api/send-approval-notice.ts), same as web.
  const [sendingNotice, setSendingNotice] = useState(false);
  const sendSignInNotice = async (userId: string, name: string) => {
    if (sendingNotice) return;
    setSendingNotice(true);
    try {
      const res: any = await callPrivilegedApi('/api/send-approval-notice', { userId });
      Alert.alert(res?.success ? 'Sign-in notice sent' : 'Nothing was sent', `${name}: ${res?.message || 'Done.'}`);
    } catch (e: any) {
      Alert.alert('Could not send', e instanceof ApiNotConfiguredError ? e.message : (e.message || 'Could not send the sign-in notice.'));
    } finally {
      setSendingNotice(false);
    }
  };

  const resendInvite = async (r: DirectoryRow) => {
    if (resendingInvite) return;
    setResendingInvite(true);
    try {
      const res: any = await callPrivilegedApi('/api/resend-invite', { inviteId: r.id });
      setSelectedOther(null);
      setTimeout(() => setResent({ name: r.fullName, message: res?.message || 'A new link is ready.', link: res?.link || '', phone: res?.phone || r.phone || '' }), 350);
      reload();
    } catch (e: any) {
      Alert.alert('Could Not Resend', e instanceof ApiNotConfiguredError ? e.message : (e.message || 'Could not resend the link.'));
    } finally {
      setResendingInvite(false);
    }
  };

  const toggleNonAppStatus = async (r: DirectoryRow) => {
    const next = r.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await setNonAppStaffStatus(r.id, next);
      setSelectedOther((prev) => (prev && prev.id === r.id ? { ...prev, status: next } : prev));
      reload();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update status.');
    }
  };

  const statusTone = (st: string): 'success' | 'warning' | 'danger' | 'muted' | 'info' =>
    st === 'ACTIVE' ? 'success' : st === 'SUSPENDED' || st === 'BLOCKED' ? 'danger' : st === 'TERMINATED' ? 'muted' : st === 'INVITED' ? 'info' : 'warning';

  const directoryColumns: DataColumn<DirectoryRow>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={STATUS_LABEL[r.status] || r.status} size="xs" /> },
    { key: 'kind', label: 'Type', render: (r) => KIND_LABEL[r.kind] },
    { key: 'department', label: 'Department', render: (r) => r.department || 'Not set' },
    { key: 'role', label: 'Role', render: (r) => r.role || 'Not set' },
    { key: 'employeeNumber', label: 'Employee #', render: (r) => r.employeeNumber || 'Not set' },
    { key: 'devices', label: 'Devices', render: (r) => (r.kind === 'invite' ? 'Not set' : r.devices.length ? r.devices.join(', ') : 'Not enrolled') },
    { key: 'joinedAt', label: 'Added', render: (r) => r.joinedAt || 'Not set' },
  ];

  const formerStaffBlock = (r: DirectoryRow | undefined) => {
    if (!r || r.status !== 'TERMINATED') return null;
    return (
      <Card tone="inset">
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: 4 }}>Former staff</Text>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary }}>
          Terminated. They can no longer sign in. All the work they did stays in the system for their department.
        </Text>
      </Card>
    );
  };

  const exportColumns = [
    { key: 'fullName', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' },
    { key: 'employeeNumber', label: 'Employee No.' }, { key: 'department', label: 'Department' }, { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'devices', label: 'Devices' }, { key: 'joinedAt', label: 'Added' },
  ];
  const exportRows = filtered.map((r) => ({
    fullName: r.fullName, type: KIND_LABEL[r.kind], status: STATUS_LABEL[r.status] || r.status, employeeNumber: r.employeeNumber || '',
    department: r.department, role: r.role || '', email: r.email || '', phone: r.phone || '', devices: r.devices.join(', '), joinedAt: r.joinedAt,
  }));

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); setDeletionRefresh((n) => n + 1); reload().finally(() => setRefreshing(false)); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Staff" icon={<UserPlus size={14} color="#fff" />} onPress={openAdd} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        {canManagePeople && (
          <DeletionRequestsPanel callerIsCeo={callerIsCeo} callerId={profile?.id} refreshKey={deletionRefresh} onChanged={reload} />
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
            {loading ? '' : `${filtered.length} of ${directory.length} people`}
          </Text>
          <Button label="Export" size="sm" variant="ghost" icon={<Download size={12} color={t.colors.textSecondary} />} onPress={() => setShowExport(true)} disabled={filtered.length === 0} />
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Search name, email, phone or employee number..." />
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><SearchablePicker value={kindFilter} onChange={setKindFilter} options={[{ value: 'All', label: 'All types' }, { value: 'app', label: 'App users' }, { value: 'no_app', label: 'No app' }, { value: 'invite', label: 'Invited' }]} /></View>
          <View style={{ flex: 1 }}><SearchablePicker value={deptFilter} onChange={setDeptFilter} options={[{ value: 'All', label: 'All departments' }, ...Array.from(new Set(directory.map((r) => r.department).filter(Boolean))).sort().map((d) => ({ value: d, label: d }))]} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><SearchablePicker value={statusFilter} onChange={setStatusFilter} options={[
            { value: 'Current', label: 'Current staff' }, { value: 'All', label: 'Everyone' },
            ...['ACTIVE', 'SUSPENDED', 'BLOCKED', 'PENDING_APPROVAL', 'INVITED', 'EXPIRED', 'TERMINATED'].map((st) => ({ value: st, label: STATUS_LABEL[st] })),
          ]} /></View>
          <View style={{ flex: 1 }}><SearchablePicker value={enrollFilter} onChange={setEnrollFilter} options={['All', 'Enrolled', 'Not enrolled'].map((v) => ({ value: v, label: v === 'All' ? 'Any enrollment' : v }))} /></View>
          <View style={{ flex: 1 }}><SearchablePicker value={sortBy} onChange={setSortBy} options={[{ value: 'name', label: 'Sort: name' }, { value: 'newest', label: 'Sort: newest' }, { value: 'number', label: 'Sort: number' }]} /></View>
        </View>
        <DataList
          collapsible
          columns={directoryColumns}
          data={filtered}
          rowKey={(r) => r.key}
          rowThumbnail={(r) => <Avatar name={r.fullName} photo={r.photo} size={40} rounded="full" />}
          loading={loading && directory.length === 0}
          emptyTitle={staffError ? 'Couldn’t load staff' : 'No one matches'}
          emptyDescription={staffError || undefined}
          onRowPress={openRow}
        />
      </View>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.fullName}
        subtitle={selected?.department}
        badge={selected ? <Badge tone={selected.status === 'ACTIVE' ? 'success' : selected.status === 'SUSPENDED' ? 'danger' : 'warning'} label={selected.status} size="xs" /> : undefined}
        side="bottom"
        maxHeight={700}
      >
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Avatar name={selected.fullName} photo={selected.photo} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selected.fullName}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{selected.employeeNumber || 'No employee number'}</Text>
              </View>
            </View>

            {formerStaffBlock(rowFor('app', selected.id))}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
              {[['Email', selected.email], ['Phone', selected.phone], ['Ghana Card', selected.ghanaCard], ['Joined', selected.joinedAt], ['Address', selected.address]]
                .filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={{ width: '47%' }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{k}</Text>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>

            {(selected.guarantorName || selected.guarantorPhone) && (
              <SheetSection label="Guarantee Information">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
                  {[['Name', selected.guarantorName], ['Phone', selected.guarantorPhone], ['Relationship', selected.guarantorRelationship], ['ID Number', selected.guarantorIdNumber], ['Address', selected.guarantorAddress]]
                    .filter(([, v]) => v).map(([k, v]) => (
                    <View key={k} style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{k}</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{v}</Text>
                    </View>
                  ))}
                </View>
              </SheetSection>
            )}

            {selected.resumeUrl && (
              <Pressable onPress={() => viewResume(selected.resumeUrl!)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: t.colors.bgInput }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <FileText size={14} color={t.colors.accent} />
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Résumé / CV</Text>
                </View>
                <ExternalLink size={12} color={t.colors.accent} />
              </Pressable>
            )}

            <SheetSection label="HR Remarks">
              <View style={{ gap: t.spacing.sm }}>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: selected.hrRemarks ? t.colors.textSecondary : t.colors.textMuted }}>
                  {selected.hrRemarks || 'No remarks on file.'}
                </Text>
                {isHrOrAdmin && <Button label="Edit Remarks" size="sm" variant="ghost" onPress={() => { setRemarksDraft(selected.hrRemarks || ''); setRemarksOpen(true); }} />}
              </View>
            </SheetSection>

            {selected.role !== 'CEO' && (
              <EnrollmentSection personKind="app" personId={selected.id} employeeNumber={selected.employeeNumber} canEdit={canManagePeople} enrolledBy={profile?.fullName || 'HR'} onChanged={reload} />
            )}

            <Tabs
              variant="chips"
              value={profileTab}
              onChange={(v) => setProfileTab(v as 'attendance' | 'leave' | 'performance')}
              options={(['attendance', 'leave', 'performance'] as const).map((tab) => ({
                value: tab,
                label: tab.charAt(0).toUpperCase() + tab.slice(1),
              }))}
            />

            {profileTab === 'attendance' && (
              <DataList
                collapsible
                columns={[
                  { key: 'date', label: 'Date', primary: true },
                  { key: 'status', label: 'Status', status: true, render: (a: any) => <Badge tone={a.status === 'PRESENT' ? 'success' : 'warning'} label={a.status} size="xs" /> },
                ]}
                data={attendance}
                rowKey={(a: any) => a.id}
                loading={loadingDetails}
                emptyTitle="No attendance records"
              />
            )}
            {profileTab === 'leave' && (
              <DataList
                collapsible
                columns={[
                  { key: 'leave_type', label: 'Type', primary: true },
                  { key: 'status', label: 'Status', status: true, render: (l: any) => <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'danger' : 'warning'} label={l.status} size="xs" /> },
                  { key: 'start_date', label: 'From' },
                  { key: 'end_date', label: 'To' },
                ]}
                data={leaves}
                rowKey={(l: any) => l.id}
                loading={loadingDetails}
                emptyTitle="No leave requests"
              />
            )}
            {profileTab === 'performance' && (
              <View style={{ gap: t.spacing.md }}>
                <Card tone="inset">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Overall Performance</Text>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.accent }}>{overall !== null ? `${overall}%` : 'Not yet reviewed'}</Text>
                  </View>
                  {perfMetrics.map((m) => (
                    <View key={m.label} style={{ marginBottom: t.spacing.sm }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary }}>{m.label}{m.real ? ' (from attendance)' : ''}</Text>
                        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{m.score !== null ? `${m.score}%` : 'Not yet reviewed'}</Text>
                      </View>
                      <ProgressBar value={m.score ?? 0} showPercent={false} height={5} trackColor={t.colors.bgPage} />
                    </View>
                  ))}
                </Card>
                {selected.performanceNotes ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{selected.performanceNotes}</Text> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {isHrOrAdmin && (
                    <Button label="Edit Performance" size="sm" variant="ghost" icon={<Edit2 size={12} color={t.colors.textSecondary} />}
                      onPress={() => { setPerfDraft({ taskScore: String(selected.performanceTaskScore ?? ''), teamScore: String(selected.performanceTeamScore ?? ''), qualityScore: String(selected.performanceQualityScore ?? ''), notes: selected.performanceNotes || '' }); setPerfOpen(true); }}
                    />
                  )}
                  <Button label={perfExporting ? 'Preparing…' : 'Export Performance Report'} size="sm" variant="ghost" icon={<Download size={12} color={t.colors.textSecondary} />} onPress={exportPerformanceReport} loading={perfExporting} disabled={perfExporting} />
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(selected)} />
              {selected.status === 'ACTIVE' && (
                <Button label={sendingNotice ? 'Sending...' : 'Send sign-in notice again'} size="sm" icon={<Send size={13} color="#fff" />}
                  onPress={() => sendSignInNotice(selected.id, selected.fullName)} loading={sendingNotice} disabled={sendingNotice} />
              )}
              {canChangeStatus(selected) && (selected.status === 'ACTIVE' || selected.status === 'SUSPENDED') && (
                <Button label={selected.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'} size="sm" variant={selected.status === 'SUSPENDED' ? 'primary' : 'danger'}
                  icon={selected.status === 'SUSPENDED' ? <UserCheckIcon size={13} color="#fff" /> : <UserX size={13} color="#fff" />}
                  onPress={() => handleSuspend(selected)} />
              )}
              {(() => { const r = rowFor('app', selected.id); return r && canTerminate(r) ? (
                <Button label="Terminate" size="sm" variant="danger" icon={<UserMinus size={13} color="#fff" />} onPress={() => startTerminate(r)} />
              ) : null; })()}
            </View>
          </View>
        )}
      </Sheet>

      <Sheet
        open={!!showForm}
        onClose={() => setShowForm(null)}
        title={showForm === 'add' ? 'Add Staff' : 'Edit Staff'}
        side="bottom"
        maxHeight={720}
        footer={<Button label={submitting || uploadingResume ? 'Saving…' : 'Save'} onPress={showForm === 'add' ? handleSaveAdd : handleSaveEdit} loading={submitting || uploadingResume} disabled={submitting || uploadingResume} fullWidth />}
      >
        {showForm === 'add' && (
          <Field label="App Access" hint={appAccessMode === 'none' ? 'Only an employee number is issued. No invite email, no app account.' : 'Sends an invite link to register and download the app.'}>
            <Tabs
              variant="segmented"
              value={appAccessMode}
              onChange={(v) => setAppAccessMode(v as 'full' | 'none')}
              options={[{ value: 'full', label: 'Full App Account' }, { value: 'none', label: 'Employee # Only' }]}
            />
          </Field>
        )}
        <Field label="Full Name"><Input value={form.fullName} onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))} placeholder="e.g. Kofi Mensah" /></Field>
        {!(showForm === 'add' && appAccessMode === 'none') && (
          <Field label="Email"><Input value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" /></Field>
        )}
        <Field label="Department"><SearchablePicker value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v, role: '' }))} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} /></Field>
        <Field label={`Role (within ${form.department})`}>
          <SearchablePicker value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={(departmentRoles.length ? departmentRoles : [form.department]).map((r) => ({ value: r, label: r }))} />
          <View style={{ flexDirection: 'row', gap: t.spacing.xs, marginTop: t.spacing.xs }}>
            <Input value={newRoleName} onChangeText={setNewRoleName} placeholder="Add a new role for this department" style={{ flex: 1 }} />
            <Button label="Add" variant="ghost" size="sm" onPress={addDepartmentRole} disabled={!newRoleName.trim()} />
          </View>
        </Field>
        {showForm === 'add' && appAccessMode === 'full' && previousHolders.length > 0 && (
          <Card tone="inset" style={{ marginBottom: t.spacing.md }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: 4 }}>Someone was here before</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginBottom: t.spacing.sm }}>
              {previousHolders.length === 1
                ? `${previousHolders[0].name} was ${form.role} in ${form.department} and was terminated${previousHolders[0].leftOn ? ` on ${previousHolders[0].leftOn}` : ''}.`
                : `${previousHolders.length} people were ${form.role} in ${form.department} before.`} Should this new person continue that work or start new?
            </Text>
            {previousHolders.length > 1 && (
              <Field label="Continue whose work?">
                <SearchablePicker value={continueFromId} onChange={setContinueFromId}
                  options={previousHolders.map((h) => ({ value: h.id, label: h.name, sublabel: h.leftOn ? `Left ${h.leftOn}` : undefined }))} />
              </Field>
            )}
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Continue previous work" size="sm" variant={workChoice === 'continue' ? 'primary' : 'ghost'} onPress={() => setWorkChoice('continue')} fullWidth /></View>
              <View style={{ flex: 1 }}><Button label="Start new" size="sm" variant={workChoice === 'start_new' ? 'primary' : 'ghost'} onPress={() => setWorkChoice('start_new')} fullWidth /></View>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 6 }}>
              {workChoice === 'continue'
                ? 'Once they are approved, the open work the previous person was handling becomes theirs: open tasks, their spreadsheets, and the open orders, customers and cargo they looked after. Chats and meetings stay private. Past work keeps the previous person\'s name.'
                : workChoice === 'start_new'
                  ? 'Nothing is moved. All the previous work stays in the system for the department.'
                  : 'Pick one to continue.'}
            </Text>
          </Card>
        )}
        <Field label="Profile Picture (optional)">
          {photoDataUrl ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Avatar name={form.fullName || '?'} photo={photoDataUrl} size={36} />
              <Button label="Replace" variant="ghost" size="sm" onPress={capturePhoto} />
              <Button label="Remove" variant="ghost" size="sm" onPress={() => setPhotoDataUrl(null)} />
            </View>
          ) : (
            <Button label="Upload Photo" variant="ghost" onPress={capturePhoto} />
          )}
        </Field>
        <Field label="Phone"><Input value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" placeholder="0244000000" /></Field>
        <Field label="Ghana Card"><Input value={form.ghanaCard} onChangeText={(v) => setForm((f) => ({ ...f, ghanaCard: v }))} placeholder="GHA-000000000-0" /></Field>
        <Field label="Date of Birth" hint="YYYY-MM-DD"><Input value={form.dateOfBirth} onChangeText={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))} placeholder="1990-05-21" /></Field>
        <Field label="Address"><AddressInput value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="House number, street, town" /></Field>
        <Field label="Staff Category"><SearchablePicker value={form.staffCategory} onChange={(v) => setForm((f) => ({ ...f, staffCategory: v }))} options={STAFF_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Select category" /></Field>
        <SheetSection label="Guarantee Information">
          <Field label="Guarantor Name"><Input value={form.guarantorName} onChangeText={(v) => setForm((f) => ({ ...f, guarantorName: v }))} placeholder="e.g. Ama Owusu" /></Field>
          <Field label="Guarantor Phone"><Input value={form.guarantorPhone} onChangeText={(v) => setForm((f) => ({ ...f, guarantorPhone: v }))} keyboardType="phone-pad" placeholder="0244000000" /></Field>
          <Field label="Relationship"><Input value={form.guarantorRelationship} onChangeText={(v) => setForm((f) => ({ ...f, guarantorRelationship: v }))} placeholder="e.g. Sibling, Spouse" /></Field>
          <Field label="Guarantor ID Number"><Input value={form.guarantorIdNumber} onChangeText={(v) => setForm((f) => ({ ...f, guarantorIdNumber: v }))} placeholder="GHA-000000000-0" /></Field>
          <Field label="Guarantor Address"><AddressInput value={form.guarantorAddress} onChangeText={(v) => setForm((f) => ({ ...f, guarantorAddress: v }))} placeholder="House number, street, town" /></Field>
        </SheetSection>
        <Field label="Résumé / CV (optional)">
          <Button label={resumeUri ? resumeUri.uri.split('/').pop() || 'Selected' : resumeUrl ? 'Replace File' : 'Attach File'} variant="ghost" onPress={captureResume} />
        </Field>
      </Sheet>

      {/* Phase 8: replaces the old "here are the credentials" sheet. HR
          picks a real channel; each shows the exact message before
          anything goes out. */}
      <Sheet open={!!createdInvite} onClose={() => setCreatedInvite(null)} title="Send Invite" side="bottom" maxHeight={520}
        footer={<Button label="Done" onPress={() => setCreatedInvite(null)} fullWidth />}>
        {createdInvite && (() => {
          const link = `${process.env.EXPO_PUBLIC_APP_URL || 'https://app.rebmaimpex.com'}/register?token=${createdInvite.token}`;
          // Same two-step wording as the email (api/send-staff-invite-email.ts).
          const steps = appDownloadUrl
            ? `1. Download the Rebma app: ${appDownloadUrl}\n2. Open the app, tap Register on the sign-in page, and paste this link: ${link}`
            : `Open the Rebma app, tap Register on the sign-in page, and paste this link: ${link}`;
          const defaultMessage = `Hi ${createdInvite.fullName}, you have been invited to join Rebma Impex Ghana Limited.\n\n${steps}\n\nWhen you register you choose your own password. Your registration then waits for approval, and you will get an email as soon as you can sign in. The link expires in 7 days, and once you register it must be approved within 12 hours.`;
          const message = editedInviteMessage ?? defaultMessage;
          // One tap sends both: email (Gmail or Resend) and SMS (the Android SMS
          // phone). Each line below then says whether it actually went out.
          const sendEmailAndSms = async () => {
            setSendingEmail(true);
            try {
              const res: any = await callPrivilegedApi('/api/send-staff-invite-email', { inviteId: createdInvite.id, channels: ['email', 'sms'], ...(editedInviteMessage !== null ? { message: editedInviteMessage } : {}) });
              setSendResult({ email: res?.email, sms: res?.sms });
            } catch (e: any) {
              Alert.alert('Send Failed', e instanceof ApiNotConfiguredError ? e.message : (e.message || 'Failed to send the invite.'));
            } finally {
              setSendingEmail(false);
            }
          };
          const resultLine = (label: string, r?: { sent: boolean; reason?: string }) => !r ? null : (
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: r.sent ? t.colors.status.success.text : t.colors.status.danger.text, marginTop: 4 }}>
              {r.sent ? `${label}: sent` : `${label}: not sent. ${r.reason || ''}`}
            </Text>
          );
          const openWhatsapp = () => {
            const num = sendWhatsappNumber.replace(/[^0-9+]/g, '');
            if (!num) { Alert.alert('Missing Number', 'Enter a WhatsApp number first.'); return; }
            Linking.openURL(`https://wa.me/${num.replace(/^0/, '233').replace('+', '')}?text=${encodeURIComponent(message)}`);
          };
          return (
            <View style={{ gap: t.spacing.md }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Saved. Choose how to send the link to {createdInvite.fullName}.</Text>

              <Card tone="inset">
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Email: {createdInvite.email || 'none on file'}</Text>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: t.spacing.xs }}>SMS: {createdInvite.phone || 'no phone on file'}</Text>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Message (you can edit it)</Text>
                <Input value={message} onChangeText={setEditedInviteMessage} multiline numberOfLines={9} style={{ minHeight: 170, textAlignVertical: 'top', marginBottom: 4 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
                  <Text style={{ flex: 1, fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>Keep the link in the message. The email also gets a Register button.</Text>
                  {editedInviteMessage !== null && (
                    <Button label="Reset" size="sm" variant="ghost" onPress={() => setEditedInviteMessage(null)} />
                  )}
                </View>
                <Button label={sendingEmail ? 'Sending…' : 'Send by Email and SMS'} onPress={sendEmailAndSms} loading={sendingEmail} disabled={sendingEmail} fullWidth />
                {sendResult && (
                  <View style={{ marginTop: t.spacing.sm }}>
                    {resultLine('Email', sendResult.email)}
                    {resultLine('SMS', sendResult.sms)}
                  </View>
                )}
              </Card>

              <Card tone="inset">
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: t.spacing.xs }}>WhatsApp</Text>
                <Input value={sendWhatsappNumber} onChangeText={setSendWhatsappNumber} placeholder="WhatsApp number" keyboardType="phone-pad" style={{ marginBottom: t.spacing.sm }} />
                <Button label="Open WhatsApp to Send" onPress={openWhatsapp} fullWidth />
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.xs }}>Opens your own WhatsApp with the message ready. You tap Send.</Text>
              </Card>

            </View>
          );
        })()}
      </Sheet>

      <Sheet open={!!createdNonAppStaff} onClose={() => setCreatedNonAppStaff(null)} title="Employee Number Issued" side="bottom" maxHeight={320}
        footer={<Button label="Done" onPress={() => setCreatedNonAppStaff(null)} fullWidth />}>
        {createdNonAppStaff && (
          <View style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.lg }}>
            <Fingerprint size={32} color={t.colors.accent} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary }}>{createdNonAppStaff.employeeNumber}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center' }}>
              Assigned to {createdNonAppStaff.fullName}. No invite was sent and no app account was created. Enroll this exact employee number on their attendance device.
            </Text>
          </View>
        )}
      </Sheet>

      <Sheet open={remarksOpen} onClose={() => setRemarksOpen(false)} title="Edit HR Remarks" side="bottom" maxHeight={360}
        footer={<Button label="Save" onPress={saveRemarks} fullWidth />}>
        <Input value={remarksDraft} onChangeText={setRemarksDraft} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top' }} placeholder="Internal HR notes about this employee..." />
      </Sheet>

      <Sheet open={perfOpen} onClose={() => setPerfOpen(false)} title="Edit Performance Scores" side="bottom" maxHeight={480}
        footer={<Button label="Save" onPress={savePerformance} fullWidth />}>
        <Field label="Task Completion %"><Input value={perfDraft.taskScore} onChangeText={(v) => setPerfDraft((f) => ({ ...f, taskScore: v }))} keyboardType="numeric" placeholder="0-100" /></Field>
        <Field label="Team Collaboration %"><Input value={perfDraft.teamScore} onChangeText={(v) => setPerfDraft((f) => ({ ...f, teamScore: v }))} keyboardType="numeric" placeholder="0-100" /></Field>
        <Field label="Quality of Work %"><Input value={perfDraft.qualityScore} onChangeText={(v) => setPerfDraft((f) => ({ ...f, qualityScore: v }))} keyboardType="numeric" placeholder="0-100" /></Field>
        <Field label="Notes"><Input value={perfDraft.notes} onChangeText={(v) => setPerfDraft((f) => ({ ...f, notes: v }))} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} placeholder="Observations on this employee's performance..." /></Field>
      </Sheet>
      <PasswordConfirmSheet
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

      {/* Staff without the app, and unused invites */}
      <Sheet open={!!selectedOther} onClose={() => setSelectedOther(null)} title={selectedOther?.fullName}
        subtitle={selectedOther ? `${KIND_LABEL[selectedOther.kind]}${selectedOther.department ? `, ${selectedOther.department}` : ''}` : undefined}
        badge={selectedOther ? <Badge tone={statusTone(selectedOther.status)} label={STATUS_LABEL[selectedOther.status] || selectedOther.status} size="xs" /> : undefined}
        side="bottom" maxHeight={700}>
        {selectedOther && (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Avatar name={selectedOther.fullName} photo={selectedOther.photo} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selectedOther.fullName}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                  {selectedOther.kind === 'invite' ? 'Invited, not registered yet' : (selectedOther.employeeNumber || 'No employee number')}
                </Text>
              </View>
            </View>

            {formerStaffBlock(selectedOther)}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
              {([
                ['Role', selectedOther.role], ['Phone', selectedOther.phone], ['Email', selectedOther.email],
                ['Address', selectedOther.raw?.address], ['Staff category', selectedOther.raw?.staff_category],
                ['Date of birth', selectedOther.raw?.date_of_birth], ['Added', selectedOther.joinedAt],
                ...(selectedOther.kind === 'invite' ? [['Link expires', selectedOther.raw?.expires_at ? new Date(selectedOther.raw.expires_at).toLocaleDateString() : ''], ['Sent by', (selectedOther.raw?.sent_via || []).join(', ') || 'Not sent yet']] : []),
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={{ width: '47%' }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{k}</Text>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={2}>{v}</Text>
                </View>
              ))}
            </View>

            {(selectedOther.raw?.guarantor_name || selectedOther.raw?.guarantor_phone) && (
              <SheetSection label="Guarantee Information">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
                  {([['Name', selectedOther.raw?.guarantor_name], ['Phone', selectedOther.raw?.guarantor_phone], ['Relationship', selectedOther.raw?.guarantor_relationship], ['ID Number', selectedOther.raw?.guarantor_id_number], ['Address', selectedOther.raw?.guarantor_address]] as [string, string | undefined][])
                    .filter(([, v]) => v).map(([k, v]) => (
                    <View key={k} style={{ width: '47%' }}>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{k}</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{v}</Text>
                    </View>
                  ))}
                </View>
              </SheetSection>
            )}

            {selectedOther.kind === 'no_app' && (
              <EnrollmentSection personKind="no_app" personId={selectedOther.id} employeeNumber={selectedOther.employeeNumber} canEdit={canManagePeople} enrolledBy={profile?.fullName || 'HR'} onChanged={reload} />
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {selectedOther.kind === 'invite' && canManagePeople && (
                <Button label={resendingInvite ? 'Sending…' : 'Resend link'} size="sm" icon={<Send size={13} color="#fff" />} onPress={() => resendInvite(selectedOther)} loading={resendingInvite} disabled={resendingInvite} />
              )}
              {selectedOther.kind === 'no_app' && canManagePeople && (selectedOther.status === 'ACTIVE' || selectedOther.status === 'SUSPENDED') && (callerIsCeo || !ceoOnlyDept(selectedOther)) && (
                <Button label={selectedOther.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'} size="sm" variant={selectedOther.status === 'SUSPENDED' ? 'primary' : 'ghost'} onPress={() => toggleNonAppStatus(selectedOther)} />
              )}
              {canTerminate(selectedOther) && (
                <Button label="Terminate" size="sm" variant="danger" icon={<UserMinus size={13} color="#fff" />} onPress={() => startTerminate(selectedOther)} />
              )}
            </View>
          </View>
        )}
      </Sheet>

      <Sheet open={!!resent} onClose={() => setResent(null)} title="Link Resent" subtitle={resent?.name} side="bottom" maxHeight={380}
        footer={<Button label="Done" onPress={() => setResent(null)} fullWidth />}>
        {resent && (
          <View style={{ gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>{resent.message}</Text>
            {!!resent.link && (
              <>
                <Text selectable style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{resent.link}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {!!resent.phone && (
                    <Button label="Send on WhatsApp" size="sm" icon={<MessageCircle size={13} color="#fff" />} onPress={() => {
                      const digits = resent.phone.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '233');
                      const text = `Hi ${resent.name}, here is your new Rebma Impex registration link. Open the Rebma app, tap Register and paste it: ${resent.link}`;
                      Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`);
                    }} />
                  )}
                  <Button label="Copy link" size="sm" variant="ghost" icon={<Copy size={13} color={t.colors.textSecondary} />} onPress={async () => { await Clipboard.setStringAsync(resent.link); Alert.alert('Copied', 'Link copied.'); }} />
                </View>
              </>
            )}
          </View>
        )}
      </Sheet>

      <PasswordConfirmSheet
        open={!!terminating}
        onClose={() => setTerminating(null)}
        title="Confirm Termination"
        description={terminating ? `Terminate ${terminating.fullName}? They can no longer sign in. Nothing is deleted: all their work stays in the system. Type your password to confirm it is you.` : ''}
        confirmLabel="Terminate"
        danger
        onConfirm={runTerminate}
      />

      <ExportSheet open={showExport} onClose={() => setShowExport(false)} title="Staff" subtitle={`${exportRows.length} people`} data={exportRows} columns={exportColumns} />
    </Screen>
  );
}
