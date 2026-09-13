// rebma-mobile/screens/hr/LeaveManagementScreen.tsx
// Ports: rebma-web/src/views/hr/LeaveManagementView.tsx (610 lines, read
// in full) — D55. Only the real "Requests" tab: full CRUD against
// leave_requests. Web's "Calendar" tab is fixed to a hardcoded date
// (new Date('2026-06-14')) and its "Balances" tab is an 8-row hardcoded
// mock array — both confirmed non-real and dropped, matching the
// established D16 "don't port mock/seed UI" precedent.
import { useCallback, useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { CheckCircle, XCircle, Trash2, Edit2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';

const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Emergency'];
const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning'> = { APPROVED: 'success', REJECTED: 'danger', PENDING: 'warning' };

interface LeaveRequest {
  id: string; employeeName: string; department: string; leaveType: string; startDate: string; endDate: string;
  days: number; reason: string; status: string; rejectionReason?: string;
}

function mapToUI(db: any): LeaveRequest {
  return {
    id: db.id, employeeName: db.staff_name || '', department: db.department || '', leaveType: db.leave_type || 'Annual',
    startDate: db.start_date || '', endDate: db.end_date || '', days: db.days_count || 0, reason: db.reason || '',
    status: db.status || 'PENDING', rejectionReason: db.rejection_reason,
  };
}
function mapToDB(ui: Partial<LeaveRequest>): Record<string, any> {
  const db: Record<string, any> = {};
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
}
function calcDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

const blankForm = { employeeName: '', department: '', leaveType: 'Annual', startDate: '', endDate: '', reason: '' };

export default function LeaveManagementScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [showForm, setShowForm] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(blankForm);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canApprove = profile?.isAdmin || profile?.department === 'HR';

  const load = useCallback(async () => {
    const { data } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    setLeaves((data || []).map(mapToUI));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = leaves.filter((l) => {
    const q = search.toLowerCase();
    return !q || l.employeeName.toLowerCase().includes(q) || l.department.toLowerCase().includes(q);
  });

  const approve = async (l: LeaveRequest) => {
    setSubmitting(true);
    try {
      await supabase.from('leave_requests').update({ status: 'APPROVED' }).eq('id', l.id);
      setLeaves((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: 'APPROVED' } : x)));
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to approve request.');
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await supabase.from('leave_requests').update({ status: 'REJECTED', rejection_reason: rejectReason }).eq('id', selected.id);
      setLeaves((prev) => prev.map((x) => (x.id === selected.id ? { ...x, status: 'REJECTED', rejectionReason: rejectReason } : x)));
      setSelected(null);
      setShowReject(false);
      setRejectReason('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reject request.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAdd = () => { setForm(blankForm); setShowForm('add'); };
  const openEdit = (l: LeaveRequest) => {
    setForm({ employeeName: l.employeeName, department: l.department, leaveType: l.leaveType, startDate: l.startDate, endDate: l.endDate, reason: l.reason });
    setShowForm('edit');
  };

  const saveForm = async () => {
    setSubmitting(true);
    try {
      const days = calcDays(form.startDate, form.endDate);
      if (showForm === 'add') {
        const dbData = mapToDB({ ...form, days, status: 'PENDING' });
        const { data: inserted, error } = await supabase.from('leave_requests').insert([dbData]).select().single();
        if (error) throw error;
        setLeaves((prev) => [mapToUI(inserted), ...prev]);
      } else if (selected) {
        const updated = { ...selected, ...form, days };
        const { error } = await supabase.from('leave_requests').update(mapToDB(updated)).eq('id', selected.id);
        if (error) throw error;
        setLeaves((prev) => prev.map((l) => (l.id === selected.id ? updated : l)));
        setSelected(updated);
      }
      setShowForm(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Leave Request', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('leave_requests').delete().eq('id', id);
        if (error) { Alert.alert('Error', error.message); return; }
        setLeaves((prev) => prev.filter((l) => l.id !== id));
        setSelected(null);
      } },
    ]);
  };

  const columns: DataColumn<LeaveRequest>[] = [
    { key: 'employeeName', label: 'Employee', primary: true },
    { key: 'status', label: 'Status', status: true, render: (l) => <Badge tone={STATUS_TONE[l.status] || 'muted'} label={l.status} size="xs" /> },
    { key: 'leaveType', label: 'Type' },
    { key: 'startDate', label: 'From' },
    { key: 'endDate', label: 'To' },
    { key: 'days', label: 'Days', render: (l) => String(l.days) },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Submit Leave Request" onPress={openAdd} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search by employee or department..." />
        <DataList columns={columns} data={filtered} rowKey={(l) => l.id} loading={loading} emptyTitle="No leave requests" onRowPress={setSelected} />
      </View>

      <Sheet open={!!selected && !showReject} onClose={() => setSelected(null)} title={selected?.employeeName} subtitle={selected?.leaveType} side="bottom" maxHeight={480}>
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <Input value={selected.reason} editable={false} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} />
            {selected.rejectionReason ? <Input value={`Reason: ${selected.rejectionReason}`} editable={false} /> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {selected.status === 'PENDING' && canApprove && (
                <>
                  <Button label="Approve" size="sm" icon={<CheckCircle size={13} color="#fff" />} onPress={() => approve(selected)} loading={submitting} disabled={submitting} />
                  <Button label="Reject" size="sm" variant="danger" icon={<XCircle size={13} color="#fff" />} onPress={() => setShowReject(true)} disabled={submitting} />
                </>
              )}
              <Button label="Edit" size="sm" variant="ghost" icon={<Edit2 size={12} color={t.colors.textSecondary} />} onPress={() => openEdit(selected)} />
              <Button label="Delete" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => handleDelete(selected.id)} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet open={showReject} onClose={() => setShowReject(false)} title="Reject Leave Request" side="bottom" maxHeight={320}
        footer={<Button label="Confirm Reject" variant="danger" onPress={reject} loading={submitting} disabled={submitting} fullWidth />}>
        <Field label="Reason"><Input value={rejectReason} onChangeText={setRejectReason} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
      </Sheet>

      <Sheet open={!!showForm} onClose={() => setShowForm(null)} title={showForm === 'add' ? 'Submit Leave Request' : 'Edit Leave Request'} side="bottom" maxHeight={560}
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={saveForm} loading={submitting} disabled={submitting} fullWidth />}>
        <Field label="Employee Name"><Input value={form.employeeName} onChangeText={(v) => setForm((f) => ({ ...f, employeeName: v }))} /></Field>
        <Field label="Department"><Input value={form.department} onChangeText={(v) => setForm((f) => ({ ...f, department: v }))} /></Field>
        <Field label="Leave Type"><SearchablePicker value={form.leaveType} onChange={(v) => setForm((f) => ({ ...f, leaveType: v }))} options={LEAVE_TYPES.map((l) => ({ value: l, label: l }))} /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Start Date"><Input value={form.startDate} onChangeText={(v) => setForm((f) => ({ ...f, startDate: v }))} placeholder="YYYY-MM-DD" /></Field></View>
          <View style={{ flex: 1 }}><Field label="End Date"><Input value={form.endDate} onChangeText={(v) => setForm((f) => ({ ...f, endDate: v }))} placeholder="YYYY-MM-DD" /></Field></View>
        </View>
        <Field label="Reason"><Input value={form.reason} onChangeText={(v) => setForm((f) => ({ ...f, reason: v }))} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} /></Field>
      </Sheet>
    </Screen>
  );
}
