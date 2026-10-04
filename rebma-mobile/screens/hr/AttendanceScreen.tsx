// rebma-mobile/screens/hr/AttendanceScreen.tsx
// Ports: rebma-web/src/views/hr/AttendanceView.tsx (494 lines, read in
// full) — D57. HR's company-wide oversight/edit tool, distinct from
// Reception's own personal GPS check-in screen (Phase 7.2) — two
// different real capabilities, no shared component.
//
// Step 3: the table shows who each person is (photo, employee number,
// department, role, where the check-in came from), filtered by the shared
// calendar (one day or a range, with dots on days that have records:
// red if anyone was absent, amber if anyone was late). While the range
// includes today it refreshes every 10 seconds, so a device scan appears
// on its own. People are matched in lib/attendanceTable.ts.
//
// Add Device takes any device's details as typed text (make, model,
// serial), never a list, and shows each device's live health as reported
// by the office connector program.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Alert } from '../../lib/appAlert';
import { Copy, Trash2, Clock, Cpu, Plus, Eye, EyeOff, Pencil, RefreshCw } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { getApiBaseUrl } from '../../lib/apiBase';
import { getAttendanceRules, setAttendanceRules, DEFAULT_ATTENDANCE_RULES, type AttendanceRules } from '../../lib/attendanceRules';
import {
  listPeripheralDevices, createPeripheralDevice, updatePeripheralDevice, setPeripheralDeviceActive, deletePeripheralDevice,
  newDeviceSecret, deviceHealth, DEFAULT_FIELD_MAP,
  type PeripheralDeviceRow, type PeripheralDeviceFields, type ConnectionType, type ApiMode,
} from '../../lib/peripheralDevices';
import { loadAttendanceRange, loadMonthMarks, type AttendanceTableRow, type AttStatus } from '../../lib/attendanceTable';
import { dayKey } from '../../lib/dateRange';
import type { CalendarValue } from '../../components/ui/CalendarPicker';
import DateRangeField from '../../components/ui/DateRangeField';
import Avatar from '../../components/ui/Avatar';
import Tabs from '../../components/ui/Tabs';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import SectionHeader from '../../components/ui/SectionHeader';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';
import SearchSortBar from '../../components/ui/SearchSortBar';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';

type AttendanceRow = AttendanceTableRow;

interface DeviceFormState {
  deviceName: string; make: string; model: string; serialNumber: string; connectionType: ConnectionType; apiMode: ApiMode;
  ipAddress: string; port: string; apiUrl: string; authUsername: string; authPassword: string; apiToken: string;
  fmEmployee: string; fmTime: string; fmEvent: string; fmRecordsPath: string;
  department: string; notes: string;
}
const emptyDeviceForm = (): DeviceFormState => ({
  deviceName: '', make: '', model: '', serialNumber: '', connectionType: 'sdk', apiMode: 'push',
  ipAddress: '', port: '', apiUrl: '', authUsername: '', authPassword: '', apiToken: '',
  fmEmployee: DEFAULT_FIELD_MAP.employeeNumber, fmTime: DEFAULT_FIELD_MAP.timestamp, fmEvent: DEFAULT_FIELD_MAP.event, fmRecordsPath: '',
  department: '', notes: '',
});
// Plain note per connection setup.
function connectionNote(f: { connectionType: ConnectionType; apiMode?: ApiMode }): string {
  if (f.connectionType === 'sdk') {
    return 'The connector program on the office computer stays connected to this device and sends each scan the moment it happens. The make you type picks its driver. If it has none for that make, this device will show "No driver".';
  }
  return f.apiMode === 'pull'
    ? 'The connector program on the office computer reads this address every 10 seconds and picks up new check-ins.'
    : 'Paste the push address below into the device or its cloud portal (often called HTTP upload, event push, or callback URL). Each scan arrives the moment it happens. No connector program needed.';
}

const STATUS_COLOR_KEY: Record<AttStatus, 'danger' | 'warning' | 'success'> = { ABSENT: 'danger', LATE: 'warning', PRESENT: 'success' };
function worstStatus(statuses: AttStatus[]): AttStatus | null {
  if (!statuses.length) return null;
  if (statuses.includes('ABSENT')) return 'ABSENT';
  if (statuses.includes('LATE')) return 'LATE';
  return 'PRESENT';
}

export default function AttendanceScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const isFocused = useIsFocused();

  const todayKey = dayKey(new Date());
  const [range, setRange] = useState<CalendarValue>({ start: todayKey, end: todayKey });
  const [marks, setMarks] = useState<Record<string, AttStatus[]>>({});
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');

  const [selected, setSelected] = useState<AttendanceRow | null>(null);
  const [editStatus, setEditStatus] = useState<AttStatus>('PRESENT');
  const [editTime, setEditTime] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', employeeNumber: '', checkInTime: '', status: 'PRESENT' as AttStatus });
  const [submitting, setSubmitting] = useState(false);

  // Direct instruction: clock-in/clock-out/late times are set by HR, not
  // CEO — a small self-contained rules card right on HR's own attendance
  // screen (lib/attendanceRules.ts), read by Reception's check-in screen
  // and the device webhook to decide lateness.
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_ATTENDANCE_RULES);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    getAttendanceRules().then(setRules);
  }, []);

  // Devices are never hard-coded. The form takes any device's details as
  // typed text, whether it connects by SDK (the office connector stays
  // connected to it) or by API (it pushes to our webhook, or the connector
  // pulls from its JSON address). See lib/peripheralDevices.ts.
  const [devices, setDevices] = useState<PeripheralDeviceRow[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PeripheralDeviceRow | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(emptyDeviceForm());
  const [deviceSecret, setDeviceSecret] = useState('');
  const [secretVisible, setSecretVisible] = useState(false);
  const [savingDevice, setSavingDevice] = useState(false);
  const [savedDevice, setSavedDevice] = useState<PeripheralDeviceRow | null>(null);
  const setDf = (patch: Partial<DeviceFormState>) => setDeviceForm((f) => ({ ...f, ...patch }));

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      setDevices(await listPeripheralDevices('attendance'));
    } catch {
      // Non-fatal: the attendance table is the real screen; this section
      // just stays empty rather than blocking it.
    } finally {
      setLoadingDevices(false);
    }
  }, []);
  useEffect(() => { loadDevices(); }, [loadDevices]);

  const openAddDevice = async () => {
    setEditingDevice(null);
    setDeviceForm(emptyDeviceForm());
    setDeviceSecret('');
    setSecretVisible(true);
    setShowAddDevice(true);
    try {
      setDeviceSecret(await newDeviceSecret());
    } catch (e: any) {
      Alert.alert('Device secret', e.message);
    }
  };

  const openEditDevice = (d: PeripheralDeviceRow) => {
    const fm = d.fieldMap || DEFAULT_FIELD_MAP;
    setEditingDevice(d);
    setDeviceForm({
      deviceName: d.deviceName, make: d.make, model: d.model || '', serialNumber: d.serialNumber || '',
      connectionType: d.connectionType, apiMode: d.apiMode || 'push',
      ipAddress: d.ipAddress || '', port: d.port != null ? String(d.port) : '', apiUrl: d.apiUrl || '',
      authUsername: d.authUsername || '', authPassword: d.authPassword || '', apiToken: d.apiToken || '',
      fmEmployee: fm.employeeNumber, fmTime: fm.timestamp, fmEvent: fm.event, fmRecordsPath: fm.recordsPath || '',
      department: d.department || '', notes: d.notes || '',
    });
    setDeviceSecret(d.webhookSecret);
    setSecretVisible(false);
    setShowAddDevice(true);
  };

  // A new secret makes the old one stop working at once. For push devices
  // the push address must then be pasted into the device again.
  const replaceSecret = () => {
    Alert.alert('New secret', 'Make a new secret for this device? The old one stops working as soon as you save. A push device needs its new push address pasted in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make new secret', onPress: async () => {
        try {
          setDeviceSecret(await newDeviceSecret());
          setSecretVisible(true);
        } catch (e: any) {
          Alert.alert('Device secret', e.message);
        }
      } },
    ]);
  };

  const saveDevice = async () => {
    const f = deviceForm;
    if (!f.deviceName.trim()) { Alert.alert('Missing Info', 'Device Name is required.'); return; }
    if (!f.make.trim()) { Alert.alert('Missing Info', 'Enter the make of the device, as printed on it or its box.'); return; }
    if (f.connectionType === 'sdk' && !f.ipAddress.trim()) { Alert.alert('Missing Info', 'Enter the device IP address so the connector can reach it.'); return; }
    if (f.connectionType === 'api' && f.apiMode === 'pull' && !f.apiUrl.trim()) { Alert.alert('Missing Info', 'Enter the API address the connector should read from.'); return; }
    if (f.port && !/^\d+$/.test(f.port.trim())) { Alert.alert('Check Port', 'Port must be a number.'); return; }
    if (f.connectionType === 'api' && !f.fmEmployee.trim()) { Alert.alert('Missing Info', 'Tell us which field holds the employee number.'); return; }
    if (!deviceSecret) { Alert.alert('Device secret', 'The device secret has not been created yet. Close this form and open it again.'); return; }

    const fields: PeripheralDeviceFields = {
      deviceType: 'attendance', deviceName: f.deviceName.trim(), connectionType: f.connectionType,
      make: f.make.trim(), model: f.model.trim() || undefined, serialNumber: f.serialNumber.trim() || undefined,
      apiMode: f.connectionType === 'api' ? f.apiMode : undefined,
      ipAddress: f.ipAddress.trim() || undefined, port: f.port.trim() ? parseInt(f.port.trim(), 10) : undefined,
      apiUrl: f.apiUrl.trim() || undefined, authUsername: f.authUsername.trim() || undefined,
      authPassword: f.authPassword || undefined, apiToken: f.apiToken.trim() || undefined,
      fieldMap: {
        employeeNumber: f.fmEmployee.trim() || DEFAULT_FIELD_MAP.employeeNumber,
        timestamp: f.fmTime.trim() || DEFAULT_FIELD_MAP.timestamp,
        event: f.fmEvent.trim() || DEFAULT_FIELD_MAP.event,
        recordsPath: f.fmRecordsPath.trim(),
      },
      webhookSecret: deviceSecret, department: f.department.trim() || undefined, notes: f.notes.trim() || undefined,
    };

    setSavingDevice(true);
    try {
      if (editingDevice) {
        await updatePeripheralDevice(editingDevice.id, fields);
        setShowAddDevice(false);
      } else {
        const created = await createPeripheralDevice(fields, profile?.fullName || null);
        setShowAddDevice(false);
        setSavedDevice(created);
      }
      loadDevices();
    } catch (e: any) {
      Alert.alert(editingDevice ? 'Error Saving Device' : 'Error Adding Device', e.message || 'Failed to save device.');
    } finally {
      setSavingDevice(false);
    }
  };

  const copyText = async (value: string, what: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${what} copied.`);
  };

  const removeDevice = (d: PeripheralDeviceRow) => {
    Alert.alert('Remove Device', `Remove "${d.deviceName}"? Its secret stops working immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await deletePeripheralDevice(d.id);
          setDevices((prev) => prev.filter((x) => x.id !== d.id));
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to remove device.');
        }
      } },
    ]);
  };

  const toggleDeviceActive = async (d: PeripheralDeviceRow) => {
    try {
      await setPeripheralDeviceActive(d.id, !d.isActive);
      setDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, isActive: !x.isActive } : x)));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update device.');
    }
  };

  const apiBase = getApiBaseUrl();
  const pushUrlFor = (name: string, secret: string) =>
    apiBase ? `${apiBase}/api/attendance-device-webhook?device=${encodeURIComponent(name)}&key=${encodeURIComponent(secret)}` : '';

  const saveRules = async () => {
    setSavingRules(true);
    const { error } = await setAttendanceRules(rules, profile?.fullName || 'HR');
    setSavingRules(false);
    if (error) {
      Alert.alert('Save Failed', error);
      return;
    }
    Alert.alert('Saved', 'Attendance times updated. Check-ins and device scans use these from now on.');
  };

  const rangeStart = range.start || todayKey;
  const rangeEnd = range.end || range.start || todayKey;
  const isSingleDay = rangeStart === rangeEnd;
  const includesToday = rangeStart <= todayKey && todayKey <= rangeEnd;

  const loadRecords = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setRecords(await loadAttendanceRange(rangeStart, rangeEnd));
      setRecordsError(null);
    } catch (e: any) {
      if (!quiet) { setRecordsError(e.message); setRecords([]); }
    }
    setLoading(false);
    setRefreshing(false);
  }, [rangeStart, rangeEnd]);

  const loadMarksFor = useCallback(async (month: Date) => {
    setMarks(await loadMonthMarks(month.getFullYear(), month.getMonth()));
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadMarksFor(new Date(`${rangeStart}T12:00:00`)); }, [rangeStart, loadMarksFor]);

  // Device scans land in the table on their own while today is showing.
  useEffect(() => {
    if (!isFocused || !includesToday) return;
    const id = setInterval(() => { loadRecords(true); loadDevices(); }, 10_000);
    return () => clearInterval(id);
  }, [isFocused, includesToday, loadRecords, loadDevices]);

  const refreshAll = () => {
    setRefreshing(true);
    loadRecords();
    loadDevices();
    loadMarksFor(new Date(`${rangeStart}T12:00:00`));
  };

  const calendarMarks = useMemo(() => {
    const out: Record<string, { color?: string }> = {};
    for (const [day, statuses] of Object.entries(marks)) {
      const worst = worstStatus(statuses);
      if (worst) out[day] = { color: t.colors.status[STATUS_COLOR_KEY[worst]].text };
    }
    return out;
  }, [marks, t]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = records.filter((r) => {
      const matchSearch = !q
        || r.fullName.toLowerCase().includes(q)
        || (r.employeeNumber || '').toLowerCase().includes(q)
        || (r.department || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
    return [...list].sort((a, b) =>
      sortBy === 'name' ? a.fullName.localeCompare(b.fullName) : a.checkInSortKey.localeCompare(b.checkInSortKey)
    );
  }, [records, search, statusFilter, sortBy]);

  // HR adds and duplicates land on the one day showing, or today when a
  // multi-day range is showing.
  const entryDate = isSingleDay ? rangeStart : todayKey;
  const entryDateLabel = new Date(`${entryDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const openEdit = (r: AttendanceRow) => { setSelected(r); setEditStatus(r.status); setEditTime(r.checkInTime); setShowEdit(true); };

  const saveEdit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const recordDate = new Date(`${selected.date}T00:00:00`);
      const [hours, minutes] = editTime.split(':');
      if (hours && minutes) recordDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const { error } = await supabase.from('attendance').update({ status: editStatus, check_in_time: recordDate.toISOString() }).eq('id', selected.id);
      if (error) throw error;
      setShowEdit(false);
      setSelected(null);
      loadRecords(true);
      loadMarksFor(new Date(`${rangeStart}T12:00:00`));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  // Finds the person behind a typed name or employee number, so the new row
  // is linked to them and shows their photo.
  const findPerson = async (name: string, employeeNumber: string) => {
    if (employeeNumber) {
      const { data } = await supabase.from('profiles').select('id, full_name, employee_number').eq('employee_number', employeeNumber).limit(1);
      if (data?.[0]) return { userId: data[0].id as string, fullName: data[0].full_name as string, employeeNumber };
      const { data: others } = await supabase.from('non_app_staff').select('full_name, employee_number').eq('employee_number', employeeNumber).limit(1);
      if (others?.[0]) return { userId: null, fullName: others[0].full_name as string, employeeNumber };
    }
    const { data: prof } = await supabase.from('profiles').select('id, employee_number').ilike('full_name', name).limit(1);
    return { userId: (prof?.[0]?.id as string) ?? null, fullName: name, employeeNumber: (prof?.[0]?.employee_number as string) || employeeNumber || null };
  };

  const duplicate = async (r: AttendanceRow) => {
    try {
      const person = await findPerson(r.fullName, r.employeeNumber || '');
      const at = new Date(`${entryDate}T00:00:00`).toISOString();
      const { error } = await supabase.from('attendance').insert([{
        user_id: person.userId, staff_name: person.fullName, employee_number: person.employeeNumber,
        status: r.status, check_in_time: at, date: entryDate,
      }]);
      if (error) throw error;
      loadRecords(true);
      loadMarksFor(new Date(`${rangeStart}T12:00:00`));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to duplicate log.');
    }
  };

  const handleDelete = (r: AttendanceRow) => {
    Alert.alert('Delete Log', `Delete ${r.fullName}'s log for ${r.date}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('attendance').delete().eq('id', r.id);
        if (error) { Alert.alert('Error', error.message); return; }
        setRecords((prev) => prev.filter((x) => x.id !== r.id));
        loadMarksFor(new Date(`${rangeStart}T12:00:00`));
      } },
    ]);
  };

  const saveAdd = async () => {
    if (!addForm.fullName.trim() && !addForm.employeeNumber.trim()) return;
    setSubmitting(true);
    try {
      const person = await findPerson(addForm.fullName.trim(), addForm.employeeNumber.trim());
      const checkInDate = new Date(`${entryDate}T00:00:00`);
      if (addForm.checkInTime) {
        const [hours, minutes] = addForm.checkInTime.split(':');
        checkInDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      } else if (entryDate === todayKey) {
        checkInDate.setTime(Date.now());
      }
      const { error } = await supabase.from('attendance').insert([{
        user_id: person.userId, staff_name: person.fullName || addForm.fullName.trim(), employee_number: person.employeeNumber,
        status: addForm.status, check_in_time: checkInDate.toISOString(), date: entryDate,
      }]);
      if (error) throw error;
      setShowAdd(false);
      setAddForm({ fullName: '', employeeNumber: '', checkInTime: '', status: 'PRESENT' });
      loadRecords(true);
      loadMarksFor(new Date(`${rangeStart}T12:00:00`));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add attendance log.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusTone = (s: AttStatus) => (s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : 'danger');

  const columns: DataColumn<AttendanceRow>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status} size="xs" /> },
    { key: 'employeeNumber', label: 'Employee No.', render: (r) => r.employeeNumber || '—' },
    { key: 'department', label: 'Department', render: (r) => r.department || '—' },
    { key: 'role', label: 'Role', render: (r) => r.role || (r.hasAppAccount ? 'Staff' : 'No app account') },
    ...(isSingleDay ? [] : [{ key: 'date', label: 'Date', render: (r: AttendanceRow) => new Date(`${r.date}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' }) }]),
    { key: 'checkInTime', label: 'Check In' },
    { key: 'source', label: 'Source' },
    { key: 'lateReason', label: 'Late Reason', render: (r) => r.lateReason || '—' },
  ];

  const counts = { present: records.filter((r) => r.status === 'PRESENT').length, late: records.filter((r) => r.status === 'LATE').length, absent: records.filter((r) => r.status === 'ABSENT').length };
  const rangeText = isSingleDay
    ? new Date(`${rangeStart}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : `${new Date(`${rangeStart}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })} to ${new Date(`${rangeEnd}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <Screen refreshing={refreshing} onRefresh={refreshAll}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Log" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <Card>
          <SectionHeader title="Attendance" subtitle={`${rangeText}. ${counts.present} present, ${counts.late} late, ${counts.absent} absent.${includesToday ? ' Updates by itself.' : ''}`} />

          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Clock In"><Input value={rules.clockInTime} onChangeText={(v) => setRules((r) => ({ ...r, clockInTime: v }))} placeholder="08:00" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Clock Out"><Input value={rules.clockOutTime} onChangeText={(v) => setRules((r) => ({ ...r, clockOutTime: v }))} placeholder="17:00" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Late After"><Input value={rules.lateAfterTime} onChangeText={(v) => setRules((r) => ({ ...r, lateAfterTime: v }))} placeholder="09:00" /></Field>
            </View>
          </View>
          <Button label={savingRules ? 'Saving…' : 'Save Times'} icon={<Clock size={14} color={t.colors.onAccent} />} onPress={saveRules} loading={savingRules} disabled={savingRules} fullWidth />

          <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
            <DateRangeField
              value={range}
              onChange={setRange}
              mode="range"
              title="Pick a day or a range"
              marks={calendarMarks}
              onVisibleMonthChange={loadMarksFor}
            />
            <SearchSortBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, number or department..."
              sortOptions={[{ value: 'time', label: 'Time' }, { value: 'name', label: 'Name' }]}
              sortValue={sortBy}
              onSortChange={(v) => setSortBy(v as 'time' | 'name')}
              filterOptions={['All', 'PRESENT', 'LATE', 'ABSENT'].map((s) => ({ value: s, label: s }))}
              filterValue={statusFilter}
              onFilterChange={setStatusFilter}
              filterLabel="Status"
            />
          </View>
        </Card>

        <DataList
          collapsible
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          rowThumbnail={(r) => <Avatar name={r.fullName} photo={r.photo} size={40} rounded="full" />}
          loading={loading}
          emptyTitle={recordsError ? 'Couldn’t load records' : isSingleDay ? 'No attendance logged this day' : 'No attendance logged in this range'}
          emptyDescription={recordsError || undefined}
          onRowPress={openEdit}
          renderActions={(r) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Duplicate" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => duplicate(r)} />
              <Button label="Delete" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => handleDelete(r)} />
            </View>
          )}
        />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Cpu size={16} color={t.colors.accent} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Attendance Devices</Text>
            </View>
            <Button label="Add Device" size="sm" icon={<Plus size={12} color="#fff" />} onPress={openAddDevice} />
          </View>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
            Fingerprint, face and card terminals that check staff in by themselves. Add any device by typing its details, whether it connects by API or through its SDK.
          </Text>
          <DataList
            collapsible
            columns={[
              { key: 'deviceName', label: 'Device', primary: true },
              { key: 'isActive', label: 'Health', status: true, render: (d) => { const h = deviceHealth(d); return <Badge tone={h.tone} label={h.label} size="xs" />; } },
              { key: 'make', label: 'Make and Model', render: (d) => [d.make, d.model].filter(Boolean).join(' ') || '—' },
              { key: 'connectionType', label: 'Connection', render: (d) => d.connectionType === 'api' ? `API ${d.apiMode === 'pull' ? 'Pull' : 'Push'}` : 'SDK' },
              { key: 'ipAddress', label: 'Address', render: (d) => d.connectionType === 'api' ? (d.apiMode === 'pull' ? (d.apiUrl || 'Not set') : 'Webhook') : (d.ipAddress ? `${d.ipAddress}${d.port ? `:${d.port}` : ''}` : 'Not set') },
              { key: 'connectorMessage', label: 'Status', render: (d) => deviceHealth(d).detail },
              { key: 'lastSeenAt', label: 'Last Scan', render: (d) => d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Nothing yet' },
            ] as DataColumn<PeripheralDeviceRow>[]}
            data={devices}
            rowKey={(d) => d.id}
            loading={loadingDevices}
            emptyTitle="No devices added yet"
            onRowPress={openEditDevice}
            renderActions={(d) => (
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                <Button label="Edit" size="sm" variant="ghost" icon={<Pencil size={12} color={t.colors.textSecondary} />} onPress={() => openEditDevice(d)} />
                <Button label={d.isActive ? 'Deactivate' : 'Activate'} size="sm" variant="ghost" onPress={() => toggleDeviceActive(d)} />
                <Button label="Remove" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => removeDevice(d)} />
              </View>
            )}
          />
        </Card>
      </View>

      <Sheet open={showEdit} onClose={() => setShowEdit(false)} title="Edit Attendance" subtitle={selected ? `${selected.fullName}, ${selected.date}` : undefined} side="bottom" maxHeight={460}
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={saveEdit} loading={submitting} disabled={submitting} fullWidth />}>
        {selected && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.md }}>
            <Avatar name={selected.fullName} photo={selected.photo} size={56} rounded="full" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selected.fullName}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                {[selected.employeeNumber, selected.department, selected.role].filter(Boolean).join(' · ') || 'No staff record matched'}
              </Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Recorded by: {selected.source}</Text>
            </View>
          </View>
        )}
        <Field label="Status"><SearchablePicker value={editStatus} onChange={(v) => setEditStatus(v as AttStatus)} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }, { value: 'ABSENT', label: 'Absent' }]} /></Field>
        <Field label="Check-In Time"><Input value={editTime} onChangeText={setEditTime} placeholder="HH:MM" /></Field>
      </Sheet>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Attendance Log" subtitle={entryDateLabel} side="bottom" maxHeight={520}
        footer={<Button label={submitting ? 'Saving…' : 'Add'} onPress={saveAdd} loading={submitting} disabled={submitting || (!addForm.fullName.trim() && !addForm.employeeNumber.trim())} fullWidth />}>
        <Field label="Employee Number" hint="Optional. Links the log to the person so their photo shows.">
          <Input value={addForm.employeeNumber} onChangeText={(v) => setAddForm((f) => ({ ...f, employeeNumber: v }))} placeholder="e.g. EMP-00012" autoCapitalize="characters" />
        </Field>
        <Field label="Full Name"><Input value={addForm.fullName} onChangeText={(v) => setAddForm((f) => ({ ...f, fullName: v }))} placeholder="e.g. Kofi Mensah" /></Field>
        <Field label="Check-In Time" hint="Optional. Leave empty to use the time now."><Input value={addForm.checkInTime} onChangeText={(v) => setAddForm((f) => ({ ...f, checkInTime: v }))} placeholder="HH:MM" /></Field>
        <Field label="Status"><SearchablePicker value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v as AttStatus }))} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }, { value: 'ABSENT', label: 'Absent' }]} /></Field>
      </Sheet>

      <Sheet open={showAddDevice} onClose={() => setShowAddDevice(false)} title={editingDevice ? 'Edit Attendance Device' : 'Add Attendance Device'} side="bottom" maxHeight={720}
        footer={<Button label={savingDevice ? 'Saving…' : editingDevice ? 'Save Changes' : 'Save Device'} onPress={saveDevice} loading={savingDevice} disabled={savingDevice || !deviceSecret} fullWidth />}>
        <Field label="Device Name" hint="A unique name. The connector program and the push address identify the device by it.">
          <Input value={deviceForm.deviceName} onChangeText={(v) => setDf({ deviceName: v })} placeholder="e.g. FRONT-DOOR-01" autoCapitalize="characters" />
        </Field>
        <Field label="Make" hint="As printed on the device or its box.">
          <Input value={deviceForm.make} onChangeText={(v) => setDf({ make: v })} placeholder="e.g. ZKTeco" />
        </Field>
        <Field label="Model (optional)">
          <Input value={deviceForm.model} onChangeText={(v) => setDf({ model: v })} placeholder="e.g. K40 Pro" />
        </Field>
        <Field label="Serial Number (optional)">
          <Input value={deviceForm.serialNumber} onChangeText={(v) => setDf({ serialNumber: v })} placeholder="e.g. CJ2C201760123" autoCapitalize="characters" />
        </Field>

        <Field label="How does it connect?">
          <Tabs
            variant="segmented"
            value={deviceForm.connectionType}
            onChange={(v) => setDf({ connectionType: v as ConnectionType })}
            options={[{ value: 'sdk', label: 'SDK (office network)' }, { value: 'api', label: 'API (web)' }]}
          />
        </Field>

        {deviceForm.connectionType === 'api' && (
          <Field label="API Mode">
            <Tabs
              variant="segmented"
              value={deviceForm.apiMode}
              onChange={(v) => setDf({ apiMode: v as ApiMode })}
              options={[{ value: 'push', label: 'Push (device sends)' }, { value: 'pull', label: 'Pull (we fetch)' }]}
            />
          </Field>
        )}

        <Card tone="inset" style={{ marginBottom: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary }}>{connectionNote(deviceForm)}</Text>
        </Card>

        {deviceForm.connectionType === 'sdk' && (
          <>
            <Field label="Device IP Address"><Input value={deviceForm.ipAddress} onChangeText={(v) => setDf({ ipAddress: v })} placeholder="e.g. 192.168.1.201" autoCapitalize="none" keyboardType="numbers-and-punctuation" /></Field>
            <Field label="Port" hint="Shown in the device's network or communication settings."><Input value={deviceForm.port} onChangeText={(v) => setDf({ port: v })} keyboardType="numeric" placeholder="e.g. 4370" /></Field>
            <Field label="Device Login Username (optional)" hint="Only if the device asks for a login.">
              <Input value={deviceForm.authUsername} onChangeText={(v) => setDf({ authUsername: v })} placeholder="e.g. admin" autoCapitalize="none" />
            </Field>
            <Field label="Device Login Password (optional)">
              <Input value={deviceForm.authPassword} onChangeText={(v) => setDf({ authPassword: v })} placeholder="Device password" secureTextEntry autoCapitalize="none" />
            </Field>
          </>
        )}

        {deviceForm.connectionType === 'api' && deviceForm.apiMode === 'push' && (
          <Field label="Push Address" hint="Paste this into the device. It already includes the device name and its secret.">
            {pushUrlFor(deviceForm.deviceName.trim(), deviceSecret) ? (
              <Card tone="inset">
                <Text selectable style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>
                  {deviceForm.deviceName.trim() && deviceSecret ? pushUrlFor(deviceForm.deviceName.trim(), deviceSecret) : 'Enter a device name first.'}
                </Text>
                {!!deviceForm.deviceName.trim() && !!deviceSecret && (
                  <View style={{ marginTop: t.spacing.sm, alignItems: 'flex-start' }}>
                    <Button label="Copy Address" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => copyText(pushUrlFor(deviceForm.deviceName.trim(), deviceSecret), 'Push address')} />
                  </View>
                )}
              </Card>
            ) : (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                The app's web address isn't set up yet, so the full push address can't be shown. Ask an admin to set the API base URL. The device will still need the secret below.
              </Text>
            )}
          </Field>
        )}

        {deviceForm.connectionType === 'api' && deviceForm.apiMode === 'pull' && (
          <>
            <Field label="API Address" hint="The JSON address the connector reads attendance records from.">
              <Input value={deviceForm.apiUrl} onChangeText={(v) => setDf({ apiUrl: v })} placeholder="e.g. http://192.168.1.50/api/attendance" autoCapitalize="none" keyboardType="url" />
            </Field>
            <Field label="API Token (optional)" hint="Sent as a Bearer token. Use this or a username and password, whichever the device needs.">
              <Input value={deviceForm.apiToken} onChangeText={(v) => setDf({ apiToken: v })} placeholder="Paste the API token" autoCapitalize="none" secureTextEntry />
            </Field>
            <Field label="API Username (optional)"><Input value={deviceForm.authUsername} onChangeText={(v) => setDf({ authUsername: v })} placeholder="e.g. admin" autoCapitalize="none" /></Field>
            <Field label="API Password (optional)"><Input value={deviceForm.authPassword} onChangeText={(v) => setDf({ authPassword: v })} placeholder="API password" secureTextEntry autoCapitalize="none" /></Field>
          </>
        )}

        {deviceForm.connectionType === 'api' && (
          <>
            <SectionHeader title="Field Mapping" subtitle="Where each value sits in the device's JSON. Use dots for nested fields, like data.userId." />
            <Field label="Employee Number Field"><Input value={deviceForm.fmEmployee} onChangeText={(v) => setDf({ fmEmployee: v })} placeholder="e.g. employeeNumber" autoCapitalize="none" /></Field>
            <Field label="Time Field"><Input value={deviceForm.fmTime} onChangeText={(v) => setDf({ fmTime: v })} placeholder="e.g. timestamp" autoCapitalize="none" /></Field>
            <Field label="Event Field" hint="A value containing 'out' counts as check out. Anything else counts as check in.">
              <Input value={deviceForm.fmEvent} onChangeText={(v) => setDf({ fmEvent: v })} placeholder="e.g. event" autoCapitalize="none" />
            </Field>
            <Field label="Records List Field (optional)" hint="If the device sends many records inside one list, name that list here.">
              <Input value={deviceForm.fmRecordsPath} onChangeText={(v) => setDf({ fmRecordsPath: v })} placeholder="e.g. records" autoCapitalize="none" />
            </Field>
          </>
        )}

        <Field label="Location (optional)"><Input value={deviceForm.department} onChangeText={(v) => setDf({ department: v })} placeholder="e.g. Front Door" /></Field>
        <Field label="Device Secret" hint={deviceForm.connectionType === 'sdk' || deviceForm.apiMode === 'pull' ? 'Created automatically. The connector program uses it when it sends scans.' : 'Created automatically. It is already inside the push address above.'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input value={deviceSecret} editable={false} secureTextEntry={!secretVisible} placeholder="Creating…" />
            </View>
            <Pressable onPress={() => setSecretVisible((v) => !v)} hitSlop={8} style={{ padding: 8 }} accessibilityLabel={secretVisible ? 'Hide secret' : 'Show secret'}>
              {secretVisible ? <EyeOff size={18} color={t.colors.textMuted} /> : <Eye size={18} color={t.colors.textMuted} />}
            </Pressable>
            <Pressable onPress={() => deviceSecret && copyText(deviceSecret, 'Secret')} hitSlop={8} style={{ padding: 8 }} accessibilityLabel="Copy secret">
              <Copy size={18} color={t.colors.textMuted} />
            </Pressable>
            {editingDevice && (
              <Pressable onPress={replaceSecret} hitSlop={8} style={{ padding: 8 }} accessibilityLabel="Make a new secret">
                <RefreshCw size={18} color={t.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </Field>
        <Field label="Notes (optional)"><Input value={deviceForm.notes} onChangeText={(v) => setDf({ notes: v })} multiline numberOfLines={2} style={{ minHeight: 56, textAlignVertical: 'top' }} placeholder="e.g. Mounted at the main entrance" /></Field>
      </Sheet>

      <Sheet open={!!savedDevice} onClose={() => setSavedDevice(null)} title="Device Added" side="bottom" maxHeight={560}
        footer={<Button label="Done" onPress={() => setSavedDevice(null)} fullWidth />}>
        {savedDevice && (
          <View style={{ gap: t.spacing.md }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
              "{savedDevice.deviceName}" is saved. {connectionNote(savedDevice)}
            </Text>
            {savedDevice.connectionType === 'api' && savedDevice.apiMode !== 'pull' && !!pushUrlFor(savedDevice.deviceName, savedDevice.webhookSecret) && (
              <Card tone="inset">
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: 4 }}>Push Address</Text>
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textPrimary }} selectable>{pushUrlFor(savedDevice.deviceName, savedDevice.webhookSecret)}</Text>
                <View style={{ marginTop: t.spacing.sm, alignItems: 'flex-start' }}>
                  <Button label="Copy Address" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => copyText(pushUrlFor(savedDevice.deviceName, savedDevice.webhookSecret), 'Push address')} />
                </View>
              </Card>
            )}
            <Card tone="inset">
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: 4 }}>Device Secret</Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }} selectable>{savedDevice.webhookSecret}</Text>
              <View style={{ marginTop: t.spacing.sm, alignItems: 'flex-start' }}>
                <Button label="Copy Secret" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => copyText(savedDevice.webhookSecret, 'Secret')} />
              </View>
            </Card>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
              {savedDevice.connectionType === 'sdk' || savedDevice.apiMode === 'pull'
                ? 'The office connector program picks up this device within 30 seconds, as long as it has the Attendance Connector Key from Control Center. Its health shows in the device list.'
                : 'Its health shows in the device list once the first scan arrives.'}
            </Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
              On the device, enroll each person with their employee number as the User ID (for example EMP-00012, or 12 on keypad-only devices).
            </Text>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
