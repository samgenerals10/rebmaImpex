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
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { UserPlus, FileText, ExternalLink, Edit2, UserX, UserCheck as UserCheckIcon, Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
import { updateStaffDetails, updatePerformance } from '../../lib/hrActions';
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
import { useAuthStore } from '../../store/authStore';

const DEPARTMENTS = ['Admin & Warehouse', 'Finance', 'HR', 'Marketing', 'Reception', 'Production', 'Management', 'Risk'];
const DEPT_TO_ROLE: Record<string, string> = {
  'Admin & Warehouse': 'admin_warehouse', Finance: 'finance', HR: 'HR',
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
  joinedAt: string; status: string; employeeNumber?: string; resumeUrl?: string; photo?: string; address?: string; hrRemarks?: string;
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
  guarantorName: '', guarantorPhone: '', guarantorRelationship: '', guarantorIdNumber: '', guarantorAddress: '',
};

export default function StaffScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const { rows: staff, setRows: setStaff, loading, hasMore, total, reload, loadMore } = usePaginatedQuery<StaffMember>({
    table: 'profiles', pageSize: 100, map: mapStaffRow,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [profileTab, setProfileTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showForm, setShowForm] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(blankForm);
  const [resumeUri, setResumeUri] = useState<{ uri: string; mimeType: string } | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Phase 8: Add Staff no longer creates a live account. It writes one
  // staff_invites row, notifies Risk, and opens this Send panel so HR can
  // push the link out — replaces the old "here are the credentials" sheet.
  const [createdInvite, setCreatedInvite] = useState<{ id: string; token: string; email: string; fullName: string } | null>(null);
  const [sendWhatsappNumber, setSendWhatsappNumber] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Department-scoped Role dropdown (Phase 8) — falls back to just the
  // department name if nothing's been defined for it yet.
  const [departmentRoles, setDepartmentRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  useEffect(() => {
    const dbDept = DEPT_TO_ROLE[form.department] || form.department;
    supabase.from('department_roles').select('role_name').eq('department', dbDept).order('role_name')
      .then(({ data }) => setDepartmentRoles((data || []).map((r: any) => r.role_name)));
  }, [form.department]);
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

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchDept = deptFilter === 'All' || s.department === deptFilter;
    return matchSearch && matchDept;
  });

  const openAdd = () => { setShowForm('add'); setForm(blankForm); setResumeUri(null); setResumeUrl(null); setPhotoDataUrl(null); };
  const openEdit = (s: StaffMember) => {
    setForm({
      fullName: s.fullName, email: s.email, department: s.department, role: s.role || '', phone: s.phone, ghanaCard: s.ghanaCard,
      address: s.address || '', staffCategory: s.staffCategory || '', guarantorName: s.guarantorName || '',
      guarantorPhone: s.guarantorPhone || '', guarantorRelationship: s.guarantorRelationship || '',
      guarantorIdNumber: s.guarantorIdNumber || '', guarantorAddress: s.guarantorAddress || '',
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
    if (!url) { Alert.alert('Unavailable', 'Could not open resume — it may have been removed.'); return; }
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
  const handleSaveAdd = async () => {
    if (submitting) return;
    if (!form.email.trim()) { Alert.alert('Missing Info', 'Email is required.'); return; }
    setSubmitting(true);
    try {
      const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'hr_can_invite_staff').maybeSingle();
      if (gate?.setting_value === false) {
        Alert.alert('Disabled', 'Inviting new staff is currently disabled by the CEO.');
        setSubmitting(false);
        return;
      }

      const finalResumeUrl = resumeUri ? await uploadResumeIfNeeded(`new-${Date.now()}`) : null;
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const dbDept = DEPT_TO_ROLE[form.department] || form.department;
      const { data: inviteRow, error: inviteError } = await supabase.from('staff_invites').insert({
        token, email: form.email.trim().toLowerCase(), full_name: form.fullName, department: dbDept, role: form.role || null,
        phone: form.phone || null, photo: photoDataUrl, resume_url: finalResumeUrl, address: form.address || null,
        staff_category: form.staffCategory || null, guarantor_name: form.guarantorName || null, guarantor_phone: form.guarantorPhone || null,
        guarantor_relationship: form.guarantorRelationship || null, guarantor_id_number: form.guarantorIdNumber || null,
        guarantor_address: form.guarantorAddress || null, status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), created_by: profile?.fullName || null,
      }).select().single();
      if (inviteError) throw inviteError;

      await supabase.from('supplier_order_notifications').insert({
        message: `New recruitment record from HR: ${form.fullName} (${form.role || dbDept}). Résumé and photo available for review.`,
        notified_department: 'RISK', read: false,
      });

      setShowForm(null);
      setCreatedInvite({ id: inviteRow.id, token, email: form.email.trim().toLowerCase(), fullName: form.fullName });
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
        guarantor_address: form.guarantorAddress || null,
      }).eq('id', selected.id);
      if (error) throw error;
      const updated: StaffMember = { ...selected, ...form, resumeUrl: finalResumeUrl || undefined, photo: photoDataUrl || undefined };
      setStaff((prev) => prev.map((s) => (s.id === selected.id ? updated : s)));
      setSelected(updated);
      setShowForm(null);
    } catch (e: any) {
      Alert.alert('Error Updating Staff', e.message || 'Failed to update staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuspend = async (s: StaffMember) => {
    const newStatus = s.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', s.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setStaff((prev) => prev.map((m) => (m.id === s.id ? { ...m, status: newStatus } : m)));
    if (selected?.id === s.id) setSelected((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const saveRemarks = async () => {
    if (!selected) return;
    try {
      await updateStaffDetails(selected.id, { hrRemarks: remarksDraft });
      const updated = { ...selected, hrRemarks: remarksDraft || undefined };
      setSelected(updated);
      setStaff((prev) => prev.map((s) => (s.id === selected.id ? updated : s)));
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
      setPerfOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update performance.');
    }
  };

  const columns: DataColumn<StaffMember>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'status', label: 'Status', status: true, render: (s) => <Badge tone={s.status === 'ACTIVE' ? 'success' : s.status === 'SUSPENDED' ? 'danger' : 'warning'} label={s.status} size="xs" /> },
    { key: 'department', label: 'Department' },
    { key: 'employeeNumber', label: 'Employee #', render: (s) => s.employeeNumber || '—' },
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
      await exportFieldValueDocument('pdf', `Performance Report — ${selected.fullName}`, {
        'Employee Number': selected.employeeNumber || '—',
        'Full Name': selected.fullName,
        'Department': selected.department,
        'Role': selected.role || '—',
        'Overall Score': overall !== null ? `${overall}%` : 'Not yet reviewed',
        'Attendance (computed)': attendanceScore !== null ? `${attendanceScore}%` : 'No attendance records',
        'Task Completion': selected.performanceTaskScore != null ? `${selected.performanceTaskScore}%` : 'Not yet reviewed',
        'Team Collaboration': selected.performanceTeamScore != null ? `${selected.performanceTeamScore}%` : 'Not yet reviewed',
        'Quality of Work': selected.performanceQualityScore != null ? `${selected.performanceQualityScore}%` : 'Not yet reviewed',
        'Notes': selected.performanceNotes || '—',
        'Reviewed By': selected.performanceReviewedBy || '—',
        'Reviewed At': selected.performanceReviewedAt ? new Date(selected.performanceReviewedAt).toLocaleString() : '—',
      });
    } finally {
      setPerfExporting(false);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); reload().finally(() => setRefreshing(false)); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Staff" icon={<UserPlus size={14} color="#fff" />} onPress={openAdd} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{total != null ? `${total} staff` : ''}</Text>
        <Input value={search} onChangeText={setSearch} placeholder="Search by name or email..." />
        <SearchablePicker value={deptFilter} onChange={setDeptFilter} options={['All', ...DEPARTMENTS].map((d) => ({ value: d, label: d }))} />
        <DataList
          columns={columns}
          data={filtered}
          rowKey={(s) => s.id}
          loading={loading && staff.length === 0}
          emptyTitle="No staff found"
          onRowPress={(s) => { setSelected(s); setProfileTab('attendance'); }}
        />
        {hasMore && !loading && <Button label="Load More" variant="ghost" onPress={() => loadMore()} fullWidth />}
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

            <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
              {(['attendance', 'leave', 'performance'] as const).map((tab) => (
                <Pressable key={tab} onPress={() => setProfileTab(tab)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: t.radius.pill, backgroundColor: profileTab === tab ? t.colors.accent : t.colors.bgCard, borderWidth: 1, borderColor: profileTab === tab ? t.colors.accent : t.colors.border }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: profileTab === tab ? t.colors.onAccent : t.colors.textSecondary, textTransform: 'capitalize' }}>{tab}</Text>
                </Pressable>
              ))}
            </View>

            {profileTab === 'attendance' && (
              <DataList
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
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: t.colors.bgPage, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${m.score ?? 0}%`, backgroundColor: t.colors.accent, borderRadius: 3 }} />
                      </View>
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

            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(selected)} />
              <Button label={selected.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'} size="sm" variant={selected.status === 'SUSPENDED' ? 'primary' : 'danger'}
                icon={selected.status === 'SUSPENDED' ? <UserCheckIcon size={13} color="#fff" /> : <UserX size={13} color="#fff" />}
                onPress={() => handleSuspend(selected)} />
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
        <Field label="Full Name"><Input value={form.fullName} onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))} /></Field>
        <Field label="Email"><Input value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Field label="Department"><SearchablePicker value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v, role: '' }))} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} /></Field>
        <Field label={`Role (within ${form.department})`}>
          <SearchablePicker value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={(departmentRoles.length ? departmentRoles : [form.department]).map((r) => ({ value: r, label: r }))} />
          <View style={{ flexDirection: 'row', gap: t.spacing.xs, marginTop: t.spacing.xs }}>
            <Input value={newRoleName} onChangeText={setNewRoleName} placeholder="Add a new role for this department" style={{ flex: 1 }} />
            <Button label="Add" variant="ghost" size="sm" onPress={addDepartmentRole} disabled={!newRoleName.trim()} />
          </View>
        </Field>
        <Field label="Profile Picture — optional">
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
        <Field label="Phone"><Input value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" /></Field>
        <Field label="Ghana Card"><Input value={form.ghanaCard} onChangeText={(v) => setForm((f) => ({ ...f, ghanaCard: v }))} /></Field>
        <Field label="Address"><Input value={form.address} onChangeText={(v) => setForm((f) => ({ ...f, address: v }))} /></Field>
        <Field label="Staff Category"><SearchablePicker value={form.staffCategory} onChange={(v) => setForm((f) => ({ ...f, staffCategory: v }))} options={STAFF_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Select category" /></Field>
        <SheetSection label="Guarantee Information">
          <Field label="Guarantor Name"><Input value={form.guarantorName} onChangeText={(v) => setForm((f) => ({ ...f, guarantorName: v }))} /></Field>
          <Field label="Guarantor Phone"><Input value={form.guarantorPhone} onChangeText={(v) => setForm((f) => ({ ...f, guarantorPhone: v }))} keyboardType="phone-pad" /></Field>
          <Field label="Relationship"><Input value={form.guarantorRelationship} onChangeText={(v) => setForm((f) => ({ ...f, guarantorRelationship: v }))} /></Field>
          <Field label="Guarantor ID Number"><Input value={form.guarantorIdNumber} onChangeText={(v) => setForm((f) => ({ ...f, guarantorIdNumber: v }))} /></Field>
          <Field label="Guarantor Address"><Input value={form.guarantorAddress} onChangeText={(v) => setForm((f) => ({ ...f, guarantorAddress: v }))} /></Field>
        </SheetSection>
        <Field label="Résumé / CV — optional">
          <Button label={resumeUri ? resumeUri.uri.split('/').pop() || 'Selected' : resumeUrl ? 'Replace File' : 'Attach File'} variant="ghost" onPress={captureResume} />
        </Field>
      </Sheet>

      {/* Phase 8: replaces the old "here are the credentials" sheet. HR
          picks a real channel; each shows the exact message before
          anything goes out. */}
      <Sheet open={!!createdInvite} onClose={() => setCreatedInvite(null)} title="Send Invite" side="bottom" maxHeight={520}
        footer={<Button label="Done" onPress={() => setCreatedInvite(null)} fullWidth />}>
        {createdInvite && (() => {
          const link = `${process.env.EXPO_PUBLIC_APP_URL || 'https://rebma-impex.vercel.app'}/register?token=${createdInvite.token}`;
          const message = `Hi ${createdInvite.fullName}, HR has approved your registration with Rebma Impex. Complete your registration here: ${link}\n\nThis link expires in 7 days.`;
          const sendEmail = async () => {
            setSendingEmail(true);
            try {
              await callPrivilegedApi('/api/send-staff-invite-email', { inviteId: createdInvite.id });
              Alert.alert('Sent', `Invite emailed to ${createdInvite.email}.`);
            } catch (e: any) {
              Alert.alert('Email Failed', e instanceof ApiNotConfiguredError ? e.message : (e.message || 'Failed to send email.'));
            } finally {
              setSendingEmail(false);
            }
          };
          const openWhatsapp = () => {
            const num = sendWhatsappNumber.replace(/[^0-9+]/g, '');
            if (!num) { Alert.alert('Missing Number', 'Enter a WhatsApp number first.'); return; }
            Linking.openURL(`https://wa.me/${num.replace(/^0/, '233').replace('+', '')}?text=${encodeURIComponent(message)}`);
          };
          return (
            <View style={{ gap: t.spacing.md }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Saved. Choose how to send the link to {createdInvite.fullName}.</Text>

              <Card tone="inset">
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: t.spacing.xs }}>Email — {createdInvite.email}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textSecondary, marginBottom: t.spacing.sm }}>{message}</Text>
                <Button label={sendingEmail ? 'Sending…' : 'Send Email'} onPress={sendEmail} loading={sendingEmail} disabled={sendingEmail} fullWidth />
              </Card>

              <Card tone="inset">
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: t.spacing.xs }}>WhatsApp</Text>
                <Input value={sendWhatsappNumber} onChangeText={setSendWhatsappNumber} placeholder="WhatsApp number" keyboardType="phone-pad" style={{ marginBottom: t.spacing.sm }} />
                <Button label="Open WhatsApp to Send" onPress={openWhatsapp} fullWidth />
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.xs }}>Opens your own WhatsApp with the message ready — you tap Send.</Text>
              </Card>

              <Card tone="inset">
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted }}>SMS — not configured yet</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>Needs an SMS gateway account connected.</Text>
              </Card>
            </View>
          );
        })()}
      </Sheet>

      <Sheet open={remarksOpen} onClose={() => setRemarksOpen(false)} title="Edit HR Remarks" side="bottom" maxHeight={360}
        footer={<Button label="Save" onPress={saveRemarks} fullWidth />}>
        <Input value={remarksDraft} onChangeText={setRemarksDraft} multiline numberOfLines={5} style={{ minHeight: 120, textAlignVertical: 'top' }} placeholder="Internal HR notes about this employee..." />
      </Sheet>

      <Sheet open={perfOpen} onClose={() => setPerfOpen(false)} title="Edit Performance Scores" side="bottom" maxHeight={480}
        footer={<Button label="Save" onPress={savePerformance} fullWidth />}>
        <Field label="Task Completion %"><Input value={perfDraft.taskScore} onChangeText={(v) => setPerfDraft((f) => ({ ...f, taskScore: v }))} keyboardType="numeric" /></Field>
        <Field label="Team Collaboration %"><Input value={perfDraft.teamScore} onChangeText={(v) => setPerfDraft((f) => ({ ...f, teamScore: v }))} keyboardType="numeric" /></Field>
        <Field label="Quality of Work %"><Input value={perfDraft.qualityScore} onChangeText={(v) => setPerfDraft((f) => ({ ...f, qualityScore: v }))} keyboardType="numeric" /></Field>
        <Field label="Notes"><Input value={perfDraft.notes} onChangeText={(v) => setPerfDraft((f) => ({ ...f, notes: v }))} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
      </Sheet>
    </Screen>
  );
}
