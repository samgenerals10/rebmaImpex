// rebma-mobile/screens/hr/AttendanceScreen.tsx
// Ports: rebma-web/src/views/hr/AttendanceView.tsx (494 lines, read in
// full) — D57. HR's company-wide oversight/edit tool, distinct from
// Reception's own personal GPS check-in screen (Phase 7.2) — two
// different real capabilities, no shared component. Paginated via
// usePaginatedQuery (D49), matching web's own real consumer of that hook.
// Edit/duplicate/manual-add/delete are all real, ported writes. Web's
// "Share" action uses navigator.clipboard (web-only, no real mobile
// equivalent installed) — dropped, same minimal-dependency precedent as
// DeptActivityGrid (Phase 7.5). Web's "Workplace Settings" modal is
// local-only state with no Supabase read/write behind it — confirmed
// non-functional, not ported.
import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Copy, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';

interface AttendanceRow {
  id: string; fullName: string; checkInTime: string; status: 'PRESENT' | 'LATE'; date: string;
}
function mapRow(a: any): AttendanceRow {
  return {
    id: a.id, fullName: a.user?.full_name || 'Unknown',
    checkInTime: a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    status: a.status, date: a.date || (a.check_in_time ? new Date(a.check_in_time).toLocaleDateString() : ''),
  };
}

export default function AttendanceScreen() {
  const t = useTheme();
  const { rows: records, setRows: setRecords, loading, hasMore, total, error: recordsError, reload, loadMore } = usePaginatedQuery<AttendanceRow>({
    table: 'attendance', select: '*, user:profiles(full_name)', pageSize: 100, orderColumn: 'check_in_time', map: mapRow,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState<AttendanceRow | null>(null);
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'LATE'>('PRESENT');
  const [editTime, setEditTime] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', checkInTime: '', status: 'PRESENT' as 'PRESENT' | 'LATE' });
  const [submitting, setSubmitting] = useState(false);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.fullName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openEdit = (r: AttendanceRow) => { setSelected(r); setEditStatus(r.status); setEditTime(r.checkInTime); setShowEdit(true); };

  const saveEdit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const recordDate = new Date();
      const [hours, minutes] = editTime.split(':');
      if (hours && minutes) recordDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const { error } = await supabase.from('attendance').update({ status: editStatus, check_in_time: recordDate.toISOString() }).eq('id', selected.id);
      if (error) throw error;
      setRecords((prev) => prev.map((r) => (r.id === selected.id ? { ...r, status: editStatus, checkInTime: editTime } : r)));
      setShowEdit(false);
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const duplicate = async (r: AttendanceRow) => {
    try {
      const { data: prof } = await supabase.from('profiles').select('id').ilike('full_name', r.fullName).limit(1);
      const userId = prof?.[0]?.id ?? null;
      const nowISO = new Date().toISOString();
      const { data: inserted, error } = await supabase.from('attendance').insert([{ user_id: userId, status: r.status, check_in_time: nowISO, date: nowISO.slice(0, 10) }]).select().single();
      if (error) throw error;
      setRecords((prev) => [{ ...r, id: inserted.id, checkInTime: new Date(nowISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: new Date(nowISO).toLocaleDateString() }, ...prev]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to duplicate log.');
    }
  };

  const handleDelete = (r: AttendanceRow) => {
    Alert.alert('Delete Log', 'Are you sure you want to delete this log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('attendance').delete().eq('id', r.id);
        if (error) { Alert.alert('Error', error.message); return; }
        setRecords((prev) => prev.filter((x) => x.id !== r.id));
      } },
    ]);
  };

  const saveAdd = async () => {
    if (!addForm.fullName) return;
    setSubmitting(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('id').ilike('full_name', addForm.fullName).limit(1);
      const userId = prof?.[0]?.id ?? null;
      const checkInDate = new Date();
      if (addForm.checkInTime) {
        const [hours, minutes] = addForm.checkInTime.split(':');
        checkInDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      }
      const { data: inserted, error } = await supabase.from('attendance').insert([{ user_id: userId, status: addForm.status, check_in_time: checkInDate.toISOString(), date: checkInDate.toISOString().slice(0, 10) }]).select().single();
      if (error) throw error;
      setRecords((prev) => [{ id: inserted.id, fullName: addForm.fullName, checkInTime: addForm.checkInTime || checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: addForm.status, date: checkInDate.toLocaleDateString() }, ...prev]);
      setShowAdd(false);
      setAddForm({ fullName: '', checkInTime: '', status: 'PRESENT' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add attendance log.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: DataColumn<AttendanceRow>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={r.status === 'PRESENT' ? 'success' : 'warning'} label={r.status} size="xs" /> },
    { key: 'date', label: 'Date' },
    { key: 'checkInTime', label: 'Check In' },
  ];

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); reload().finally(() => setRefreshing(false)); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Log" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{total != null ? `${total} records` : ''}</Text>
        <Input value={search} onChangeText={setSearch} placeholder="Search by name..." />
        <SearchablePicker value={statusFilter} onChange={setStatusFilter} options={['All', 'PRESENT', 'LATE'].map((s) => ({ value: s, label: s }))} />
        <DataList
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          loading={loading && records.length === 0}
          emptyTitle={recordsError ? 'Couldn’t load records' : 'No attendance records'}
          emptyDescription={recordsError || undefined}
          onRowPress={openEdit}
          renderActions={(r) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Duplicate" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => duplicate(r)} />
              <Button label="Delete" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => handleDelete(r)} />
            </View>
          )}
        />
        {hasMore && !loading && <Button label="Load More" variant="ghost" onPress={() => loadMore()} fullWidth />}
      </View>

      <Sheet open={showEdit} onClose={() => setShowEdit(false)} title="Edit Attendance" subtitle={selected?.fullName} side="bottom" maxHeight={360}
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={saveEdit} loading={submitting} disabled={submitting} fullWidth />}>
        <Field label="Status"><SearchablePicker value={editStatus} onChange={(v) => setEditStatus(v as 'PRESENT' | 'LATE')} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }]} /></Field>
        <Field label="Check-In Time"><Input value={editTime} onChangeText={setEditTime} placeholder="HH:MM" /></Field>
      </Sheet>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Attendance Log" side="bottom" maxHeight={420}
        footer={<Button label={submitting ? 'Saving…' : 'Add'} onPress={saveAdd} loading={submitting} disabled={submitting || !addForm.fullName} fullWidth />}>
        <Field label="Full Name"><Input value={addForm.fullName} onChangeText={(v) => setAddForm((f) => ({ ...f, fullName: v }))} /></Field>
        <Field label="Check-In Time" hint="Optional, defaults to now"><Input value={addForm.checkInTime} onChangeText={(v) => setAddForm((f) => ({ ...f, checkInTime: v }))} placeholder="HH:MM" /></Field>
        <Field label="Status"><SearchablePicker value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v as 'PRESENT' | 'LATE' }))} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }]} /></Field>
      </Sheet>
    </Screen>
  );
}
