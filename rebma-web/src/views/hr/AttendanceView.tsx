// rebma-web/src/views/hr/AttendanceView.tsx
//
// HR's company-wide attendance page. Web twin of
// rebma-mobile/screens/hr/AttendanceScreen.tsx (Step 3, kept in step):
//  * Attendance times (clock in, clock out, late after) set by HR, read by
//    Reception's check-in and by the device webhook to decide lateness.
//  * The table shows who each person is: photo, employee number,
//    department, role, check-in time and where it came from (device,
//    Reception, remote, HR entry). Filtered by the shared calendar, one day
//    or a range, with dots on days that have records (red if anyone was
//    absent, amber if anyone was late). While the range includes today it
//    refreshes every 10 seconds, so a device scan appears by itself.
//  * Attendance Devices: any device is added by typing its details (make,
//    model, serial), never picked from a list, and each shows its live
//    health as reported by the office connector program.
//
// The old "Workplace Settings" panel is gone: it never saved anything (its
// office location and radius only lived in this page's memory and nothing
// read them). Reception's GPS check-in has its own settings.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock, Download, Plus, Copy, Trash2, Pencil, Cpu, Eye, EyeOff, RefreshCw, Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import DateRangeField from '../../components/ui/DateRangeField';
import type { CalendarValue } from '../../components/ui/CalendarPicker';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import { dayKey } from '../../utils/dateRange';
import { getAttendanceRules, setAttendanceRules, DEFAULT_ATTENDANCE_RULES, type AttendanceRules } from '../../utils/attendanceRules';
import { loadAttendanceRange, loadMonthMarks, type AttendanceTableRow, type AttStatus } from '../../utils/attendanceTable';
import {
  listPeripheralDevices, createPeripheralDevice, updatePeripheralDevice, setPeripheralDeviceActive, deletePeripheralDevice,
  newDeviceSecret, deviceHealth, DEFAULT_FIELD_MAP,
  type PeripheralDeviceRow, type PeripheralDeviceFields, type ConnectionType, type ApiMode,
} from '../../utils/peripheralDevices';
import type { Attendance } from '../../types/erp';

interface Props {
  attendanceList?: Attendance[];
  addNotification: (msg: string) => void;
  currentUser?: { fullName: string } | null;
}

const db = supabase as any;

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

function connectionNote(f: { connectionType: ConnectionType; apiMode?: ApiMode }): string {
  if (f.connectionType === 'sdk') {
    return 'The connector program on the office computer stays connected to this device and sends each scan the moment it happens. The make you type picks its driver. If it has none for that make, this device will show "No driver".';
  }
  return f.apiMode === 'pull'
    ? 'The connector program on the office computer reads this address every 10 seconds and picks up new check-ins.'
    : 'Paste the push address below into the device or its cloud portal (often called HTTP upload, event push, or callback URL). Each scan arrives the moment it happens. No connector program needed.';
}

const STATUS_STYLE: Record<AttStatus, { bg: string; color: string }> = {
  PRESENT: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  LATE: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  ABSENT: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
};
const HEALTH_STYLE: Record<'success' | 'warning' | 'danger' | 'muted', { bg: string; color: string }> = {
  success: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  warning: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  danger: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
  muted: { bg: 'var(--bg-input)', color: 'var(--text-muted)' },
};

function worstStatus(statuses: AttStatus[]): AttStatus | null {
  if (!statuses.length) return null;
  if (statuses.includes('ABSENT')) return 'ABSENT';
  if (statuses.includes('LATE')) return 'LATE';
  return 'PRESENT';
}

const initials = (name: string) => name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

function PersonPhoto({ name, photo, size = 34 }: { name: string; photo?: string; size?: number }) {
  if (photo) {
    return (
      <img src={photo} alt={name} onClick={(e) => { e.stopPropagation(); window.open(photo, '_blank', 'noopener,noreferrer'); }}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', cursor: 'zoom-in', flexShrink: 0 }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[var(--text-muted)] mt-1">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${value === o.value ? 'text-white' : 'text-[var(--text-secondary)]'}`}
          style={value === o.value ? { background: 'var(--accent)' } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AttendanceView({ addNotification, currentUser }: Props) {
  const todayKey = dayKey(new Date());
  const [range, setRange] = useState<CalendarValue>({ start: todayKey, end: todayKey });
  const [marks, setMarks] = useState<Record<string, AttStatus[]>>({});
  const [records, setRecords] = useState<AttendanceTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');

  const [editRec, setEditRec] = useState<AttendanceTableRow | null>(null);
  const [editStatus, setEditStatus] = useState<AttStatus>('PRESENT');
  const [editTime, setEditTime] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', employeeNumber: '', checkInTime: '', status: 'PRESENT' as AttStatus });
  const [submitting, setSubmitting] = useState(false);

  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_ATTENDANCE_RULES);
  const [savingRules, setSavingRules] = useState(false);
  useEffect(() => { getAttendanceRules().then(setRules); }, []);

  const [devices, setDevices] = useState<PeripheralDeviceRow[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PeripheralDeviceRow | null>(null);
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(emptyDeviceForm());
  const [deviceSecret, setDeviceSecret] = useState('');
  const [secretVisible, setSecretVisible] = useState(false);
  const [savingDevice, setSavingDevice] = useState(false);
  const [savedDevice, setSavedDevice] = useState<PeripheralDeviceRow | null>(null);
  const setDf = (patch: Partial<DeviceFormState>) => setDeviceForm((f) => ({ ...f, ...patch }));

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try { setDevices(await listPeripheralDevices('attendance')); } catch { /* the table above is the real page */ }
    setLoadingDevices(false);
  }, []);
  useEffect(() => { loadDevices(); }, [loadDevices]);

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
  }, [rangeStart, rangeEnd]);

  const loadMarksFor = useCallback(async (month: Date) => {
    setMarks(await loadMonthMarks(month.getFullYear(), month.getMonth()));
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadMarksFor(new Date(`${rangeStart}T12:00:00`)); }, [rangeStart, loadMarksFor]);

  // Device scans land in the table on their own while today is showing.
  useEffect(() => {
    if (!includesToday) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadRecords(true);
      loadDevices();
    }, 10_000);
    return () => clearInterval(id);
  }, [includesToday, loadRecords, loadDevices]);

  const calendarMarks = useMemo(() => {
    const out: Record<string, { color?: string }> = {};
    for (const [day, statuses] of Object.entries(marks)) {
      const worst = worstStatus(statuses);
      if (worst) out[day] = { color: STATUS_STYLE[worst].color };
    }
    return out;
  }, [marks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = records.filter((r) => {
      const matchSearch = !q || r.fullName.toLowerCase().includes(q)
        || (r.employeeNumber || '').toLowerCase().includes(q)
        || (r.department || '').toLowerCase().includes(q);
      return matchSearch && (statusFilter === 'All' || r.status === statusFilter);
    });
    return [...list].sort((a, b) => (sortBy === 'name' ? a.fullName.localeCompare(b.fullName) : a.checkInSortKey.localeCompare(b.checkInSortKey)));
  }, [records, search, statusFilter, sortBy]);

  const counts = {
    present: records.filter((r) => r.status === 'PRESENT').length,
    late: records.filter((r) => r.status === 'LATE').length,
    absent: records.filter((r) => r.status === 'ABSENT').length,
  };

  const entryDate = isSingleDay ? rangeStart : todayKey;
  const entryDateLabel = new Date(`${entryDate}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const saveRules = async () => {
    setSavingRules(true);
    const { error } = await setAttendanceRules(rules, currentUser?.fullName || 'HR');
    setSavingRules(false);
    addNotification(error ? `Could not save attendance times: ${error}` : 'Attendance times saved. Check-ins and device scans use these from now on.');
  };

  const findPerson = async (name: string, employeeNumber: string) => {
    if (employeeNumber) {
      const { data } = await db.from('profiles').select('id, full_name').eq('employee_number', employeeNumber).limit(1);
      if (data?.[0]) return { userId: data[0].id as string, fullName: data[0].full_name as string, employeeNumber };
      const { data: others } = await db.from('non_app_staff').select('full_name').eq('employee_number', employeeNumber).limit(1);
      if (others?.[0]) return { userId: null, fullName: others[0].full_name as string, employeeNumber };
    }
    const { data: prof } = await db.from('profiles').select('id, employee_number').ilike('full_name', name).limit(1);
    return { userId: (prof?.[0]?.id as string) ?? null, fullName: name, employeeNumber: (prof?.[0]?.employee_number as string) || employeeNumber || null };
  };

  const saveEdit = async () => {
    if (!editRec || submitting) return;
    setSubmitting(true);
    try {
      const at = new Date(`${editRec.date}T00:00:00`);
      const [h, m] = editTime.split(':');
      if (h && m) at.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      const { error } = await db.from('attendance').update({ status: editStatus, check_in_time: at.toISOString() }).eq('id', editRec.id);
      if (error) throw error;
      addNotification(`Updated ${editRec.fullName}'s attendance`);
      setEditRec(null);
      loadRecords(true);
      loadMarksFor(new Date(`${rangeStart}T12:00:00`));
    } catch (e: any) {
      addNotification(`Error updating attendance: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const duplicate = async (r: AttendanceTableRow) => {
    try {
      const person = await findPerson(r.fullName, r.employeeNumber || '');
      const { error } = await db.from('attendance').insert([{
        user_id: person.userId, staff_name: person.fullName, employee_number: person.employeeNumber,
        status: r.status, check_in_time: new Date(`${entryDate}T00:00:00`).toISOString(), date: entryDate,
      }]);
      if (error) throw error;
      addNotification(`Duplicated ${r.fullName}'s log to ${entryDateLabel}`);
      loadRecords(true);
    } catch (e: any) {
      addNotification(`Error duplicating log: ${e.message}`);
    }
  };

  const remove = async (r: AttendanceTableRow) => {
    if (!await window.confirm(`Delete ${r.fullName}'s log for ${r.date}?`)) return;
    const { error } = await db.from('attendance').delete().eq('id', r.id);
    if (error) { addNotification(`Error deleting log: ${error.message}`); return; }
    setRecords((prev) => prev.filter((x) => x.id !== r.id));
    loadMarksFor(new Date(`${rangeStart}T12:00:00`));
  };

  const saveAdd = async () => {
    if ((!addForm.fullName.trim() && !addForm.employeeNumber.trim()) || submitting) return;
    setSubmitting(true);
    try {
      const person = await findPerson(addForm.fullName.trim(), addForm.employeeNumber.trim());
      const at = new Date(`${entryDate}T00:00:00`);
      if (addForm.checkInTime) {
        const [h, m] = addForm.checkInTime.split(':');
        at.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      } else if (entryDate === todayKey) {
        at.setTime(Date.now());
      }
      const { error } = await db.from('attendance').insert([{
        user_id: person.userId, staff_name: person.fullName || addForm.fullName.trim(), employee_number: person.employeeNumber,
        status: addForm.status, check_in_time: at.toISOString(), date: entryDate,
      }]);
      if (error) throw error;
      addNotification(`Added attendance for ${person.fullName || addForm.fullName}`);
      setShowAdd(false);
      setAddForm({ fullName: '', employeeNumber: '', checkInTime: '', status: 'PRESENT' });
      loadRecords(true);
      loadMarksFor(new Date(`${rangeStart}T12:00:00`));
    } catch (e: any) {
      addNotification(`Error adding attendance: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Devices ──────────────────────────────────────────────────────────
  const pushUrlFor = (name: string, secret: string) =>
    `${window.location.origin}/api/attendance-device-webhook?device=${encodeURIComponent(name)}&key=${encodeURIComponent(secret)}`;

  const copy = (value: string, what: string) => {
    navigator.clipboard.writeText(value).then(() => addNotification(`${what} copied`), () => addNotification(`Could not copy the ${what.toLowerCase()}`));
  };

  const openAddDevice = async () => {
    setEditingDevice(null);
    setDeviceForm(emptyDeviceForm());
    setDeviceSecret('');
    setSecretVisible(true);
    setShowDeviceForm(true);
    try { setDeviceSecret(await newDeviceSecret()); } catch (e: any) { addNotification(e.message); }
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
    setShowDeviceForm(true);
  };

  const replaceSecret = async () => {
    if (!await window.confirm('Make a new secret for this device? The old one stops working as soon as you save. A push device needs its new push address pasted in again.')) return;
    try { setDeviceSecret(await newDeviceSecret()); setSecretVisible(true); } catch (e: any) { addNotification(e.message); }
  };

  const saveDevice = async () => {
    const f = deviceForm;
    const problem =
      !f.deviceName.trim() ? 'Device Name is required.'
      : !f.make.trim() ? 'Enter the make of the device, as printed on it or its box.'
      : f.connectionType === 'sdk' && !f.ipAddress.trim() ? 'Enter the device IP address so the connector can reach it.'
      : f.connectionType === 'api' && f.apiMode === 'pull' && !f.apiUrl.trim() ? 'Enter the API address the connector should read from.'
      : f.port && !/^\d+$/.test(f.port.trim()) ? 'Port must be a number.'
      : f.connectionType === 'api' && !f.fmEmployee.trim() ? 'Tell us which field holds the employee number.'
      : !deviceSecret ? 'The device secret has not been created yet. Close this panel and open it again.'
      : '';
    if (problem) { addNotification(problem); return; }

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
        addNotification(`Saved ${fields.deviceName}`);
      } else {
        setSavedDevice(await createPeripheralDevice(fields, currentUser?.fullName || null));
      }
      setShowDeviceForm(false);
      loadDevices();
    } catch (e: any) {
      addNotification(e.message || 'Could not save the device.');
    } finally {
      setSavingDevice(false);
    }
  };

  const toggleDevice = async (d: PeripheralDeviceRow) => {
    try {
      await setPeripheralDeviceActive(d.id, !d.isActive);
      setDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, isActive: !x.isActive } : x)));
    } catch (e: any) { addNotification(e.message); }
  };

  const removeDevice = async (d: PeripheralDeviceRow) => {
    if (!await window.confirm(`Remove "${d.deviceName}"? Its secret stops working immediately.`)) return;
    try {
      await deletePeripheralDevice(d.id);
      setDevices((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e: any) { addNotification(e.message); }
  };

  // ── Columns ──────────────────────────────────────────────────────────
  const columns: DataColumn<AttendanceTableRow>[] = [
    {
      key: 'fullName', label: 'Staff', primary: true, render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PersonPhoto name={r.fullName} photo={r.photo} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.role || (r.hasAppAccount ? 'Staff' : 'No app account')}</div>
          </div>
        </div>
      ),
    },
    { key: 'employeeNumber', label: 'Employee No.', render: (r) => r.employeeNumber || '—' },
    { key: 'department', label: 'Department', render: (r) => r.department || '—' },
    ...(isSingleDay ? [] : [{ key: 'date', label: 'Date', render: (r: AttendanceTableRow) => new Date(`${r.date}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' }) }]),
    { key: 'checkInTime', label: 'Check In' },
    { key: 'source', label: 'Source' },
    {
      key: 'status', label: 'Status', status: true, render: (r) => (
        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: STATUS_STYLE[r.status]?.bg, color: STATUS_STYLE[r.status]?.color }}>{r.status}</span>
      ),
    },
    { key: 'lateReason', label: 'Late Reason', mobileHidden: true, render: (r) => r.lateReason || '—' },
  ];

  const deviceColumns: DataColumn<PeripheralDeviceRow>[] = [
    { key: 'deviceName', label: 'Device', primary: true, render: (d) => <span style={{ fontWeight: 600 }}>{d.deviceName}</span> },
    { key: 'make', label: 'Make and Model', render: (d) => [d.make, d.model].filter(Boolean).join(' ') || '—' },
    { key: 'connectionType', label: 'Connection', render: (d) => (d.connectionType === 'api' ? `API ${d.apiMode === 'pull' ? 'Pull' : 'Push'}` : 'SDK') },
    { key: 'ipAddress', label: 'Address', render: (d) => (d.connectionType === 'api' ? (d.apiMode === 'pull' ? (d.apiUrl || 'Not set') : 'Webhook') : (d.ipAddress ? `${d.ipAddress}${d.port ? `:${d.port}` : ''}` : 'Not set')) },
    {
      key: 'isActive', label: 'Health', status: true, render: (d) => {
        const h = deviceHealth(d);
        return <span title={h.detail} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: HEALTH_STYLE[h.tone].bg, color: HEALTH_STYLE[h.tone].color }}>{h.label}</span>;
      },
    },
    { key: 'connectorMessage', label: 'Status', mobileHidden: true, render: (d) => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{deviceHealth(d).detail}</span> },
    { key: 'lastSeenAt', label: 'Last Scan', render: (d) => (d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Nothing yet') },
  ];

  const rangeText = isSingleDay
    ? new Date(`${rangeStart}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : `${new Date(`${rangeStart}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })} to ${new Date(`${rangeEnd}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Attendance</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {rangeText}. {counts.present} present, {counts.late} late, {counts.absent} absent.{includesToday ? ' Updates by itself.' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={`${btn} border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]`}
            onClick={() => exportToCSV(filtered.map((r) => ({
              date: r.date, employeeNumber: r.employeeNumber || '', fullName: r.fullName, department: r.department || '',
              role: r.role || '', checkInTime: r.checkInTime, status: r.status, source: r.source, lateReason: r.lateReason || '',
            })), ['date', 'employeeNumber', 'fullName', 'department', 'role', 'checkInTime', 'status', 'source', 'lateReason'], `attendance_${rangeStart}_to_${rangeEnd}`)}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button className={`${btn} text-white`} style={{ background: 'var(--accent)' }} onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Log
          </button>
        </div>
      </div>

      {/* Attendance times */}
      <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
        <p className="text-sm font-bold text-[var(--text-primary)] mb-3">Attendance Times</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Clock In"><input className={inputCls} value={rules.clockInTime} onChange={(e) => setRules((r) => ({ ...r, clockInTime: e.target.value }))} placeholder="08:00" /></Field>
          <Field label="Clock Out"><input className={inputCls} value={rules.clockOutTime} onChange={(e) => setRules((r) => ({ ...r, clockOutTime: e.target.value }))} placeholder="17:00" /></Field>
          <Field label="Late After"><input className={inputCls} value={rules.lateAfterTime} onChange={(e) => setRules((r) => ({ ...r, lateAfterTime: e.target.value }))} placeholder="09:00" /></Field>
          <button onClick={saveRules} disabled={savingRules} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent)' }}>
            <Clock className="w-3.5 h-3.5" /> {savingRules ? 'Saving…' : 'Save Times'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <DateRangeField value={range} onChange={setRange} mode="range" marks={calendarMarks} onVisibleMonthChange={loadMarksFor} />
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number or department..."
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-muted)]" />
        </div>
        <SearchableDropdown value={statusFilter} onChange={setStatusFilter} options={['All', 'PRESENT', 'LATE', 'ABSENT'].map((s) => ({ value: s, label: s === 'All' ? 'All statuses' : s }))} className="w-36" />
        <SearchableDropdown value={sortBy} onChange={(v) => setSortBy(v as 'time' | 'name')} options={[{ value: 'time', label: 'Sort by time' }, { value: 'name', label: 'Sort by name' }]} className="w-36" />
      </div>

      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
        <ResponsiveDataView<AttendanceTableRow>
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          emptyTitle={recordsError ? 'Couldn’t load records' : isSingleDay ? 'No attendance logged this day' : 'No attendance logged in this range'}
          emptyDescription={recordsError || undefined}
          onRowClick={(r) => { setEditRec(r); setEditStatus(r.status); setEditTime(r.checkInTime); }}
          renderActions={(r) => (
            <div className="flex gap-1">
              <button title="Edit" onClick={(e) => { e.stopPropagation(); setEditRec(r); setEditStatus(r.status); setEditTime(r.checkInTime); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
              <button title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(r); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
              <button title="Delete" onClick={(e) => { e.stopPropagation(); remove(r); }} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
        />
      </div>

      {/* Devices */}
      <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"><Cpu className="w-4 h-4 text-[var(--accent)]" /> Attendance Devices</p>
          <button className={`${btn} text-white`} style={{ background: 'var(--accent)' }} onClick={openAddDevice}><Plus className="w-3.5 h-3.5" /> Add Device</button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Fingerprint, face and card terminals that check staff in by themselves. Add any device by typing its details, whether it connects by API or through its SDK.</p>
        <ResponsiveDataView<PeripheralDeviceRow>
          columns={deviceColumns}
          data={devices}
          rowKey={(d) => d.id}
          loading={loadingDevices}
          emptyTitle="No devices added yet"
          onRowClick={openEditDevice}
          renderActions={(d) => (
            <div className="flex gap-1">
              <button title="Edit" onClick={(e) => { e.stopPropagation(); openEditDevice(d); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); toggleDevice(d); }} className="px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer">{d.isActive ? 'Deactivate' : 'Activate'}</button>
              <button title="Remove" onClick={(e) => { e.stopPropagation(); removeDevice(d); }} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
        />
      </div>

      {/* Edit log */}
      <SidePanel open={!!editRec} onClose={() => setEditRec(null)} title="Edit Attendance" subtitle={editRec ? `${editRec.fullName}, ${editRec.date}` : undefined}
        footer={<button onClick={saveEdit} disabled={submitting} className="erp-btn erp-btn-primary w-full disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>}>
        {editRec && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <PersonPhoto name={editRec.fullName} photo={editRec.photo} size={56} />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{editRec.fullName}</p>
                <p className="text-xs text-[var(--text-muted)]">{[editRec.employeeNumber, editRec.department, editRec.role].filter(Boolean).join(' · ') || 'No staff record matched'}</p>
                <p className="text-xs text-[var(--text-muted)]">Recorded by: {editRec.source}</p>
              </div>
            </div>
            <Field label="Status">
              <SearchableDropdown value={editStatus} onChange={(v) => setEditStatus(v as AttStatus)} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }, { value: 'ABSENT', label: 'Absent' }]} />
            </Field>
            <Field label="Check-In Time"><input type="time" className={inputCls} value={editTime} onChange={(e) => setEditTime(e.target.value)} placeholder="HH:MM" /></Field>
          </div>
        )}
      </SidePanel>

      {/* Add log */}
      <SidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Add Attendance Log" subtitle={entryDateLabel}
        footer={<button onClick={saveAdd} disabled={submitting || (!addForm.fullName.trim() && !addForm.employeeNumber.trim())} className="erp-btn erp-btn-primary w-full disabled:opacity-50">{submitting ? 'Saving…' : 'Add'}</button>}>
        <div className="space-y-4">
          <Field label="Employee Number" hint="Optional. Links the log to the person so their photo shows.">
            <input className={inputCls} value={addForm.employeeNumber} onChange={(e) => setAddForm((f) => ({ ...f, employeeNumber: e.target.value }))} placeholder="e.g. EMP-00012" />
          </Field>
          <Field label="Full Name"><input className={inputCls} value={addForm.fullName} onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="e.g. Kofi Mensah" /></Field>
          <Field label="Check-In Time" hint="Optional. Leave empty to use the time now.">
            <input type="time" className={inputCls} value={addForm.checkInTime} onChange={(e) => setAddForm((f) => ({ ...f, checkInTime: e.target.value }))} placeholder="HH:MM" />
          </Field>
          <Field label="Status">
            <SearchableDropdown value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v as AttStatus }))} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }, { value: 'ABSENT', label: 'Absent' }]} />
          </Field>
        </div>
      </SidePanel>

      {/* Add or edit device */}
      <SidePanel open={showDeviceForm} onClose={() => setShowDeviceForm(false)} title={editingDevice ? 'Edit Attendance Device' : 'Add Attendance Device'} width="lg"
        footer={<button onClick={saveDevice} disabled={savingDevice || !deviceSecret} className="erp-btn erp-btn-primary w-full disabled:opacity-50">{savingDevice ? 'Saving…' : editingDevice ? 'Save Changes' : 'Save Device'}</button>}>
        <div className="space-y-4">
          <Field label="Device Name" hint="A unique name. The connector program and the push address identify the device by it.">
            <input className={inputCls} value={deviceForm.deviceName} onChange={(e) => setDf({ deviceName: e.target.value.toUpperCase() })} placeholder="e.g. FRONT-DOOR-01" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Make" hint="As printed on the device or its box."><input className={inputCls} value={deviceForm.make} onChange={(e) => setDf({ make: e.target.value })} placeholder="e.g. ZKTeco" /></Field>
            <Field label="Model (optional)"><input className={inputCls} value={deviceForm.model} onChange={(e) => setDf({ model: e.target.value })} placeholder="e.g. K40 Pro" /></Field>
            <Field label="Serial Number (optional)"><input className={inputCls} value={deviceForm.serialNumber} onChange={(e) => setDf({ serialNumber: e.target.value })} placeholder="e.g. CJ2C201760123" /></Field>
          </div>
          <Field label="How does it connect?">
            <Segmented value={deviceForm.connectionType} onChange={(v) => setDf({ connectionType: v })} options={[{ value: 'sdk', label: 'SDK (office network)' }, { value: 'api', label: 'API (web)' }]} />
          </Field>
          {deviceForm.connectionType === 'api' && (
            <Field label="API Mode">
              <Segmented value={deviceForm.apiMode} onChange={(v) => setDf({ apiMode: v })} options={[{ value: 'push', label: 'Push (device sends)' }, { value: 'pull', label: 'Pull (we fetch)' }]} />
            </Field>
          )}
          <p className="text-xs text-[var(--text-secondary)] p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">{connectionNote(deviceForm)}</p>

          {deviceForm.connectionType === 'sdk' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Device IP Address"><input className={inputCls} value={deviceForm.ipAddress} onChange={(e) => setDf({ ipAddress: e.target.value })} placeholder="e.g. 192.168.1.201" /></Field>
              <Field label="Port" hint="Shown in the device's network or communication settings."><input className={inputCls} value={deviceForm.port} onChange={(e) => setDf({ port: e.target.value })} placeholder="e.g. 4370" inputMode="numeric" /></Field>
              <Field label="Device Login Username (optional)" hint="Only if the device asks for a login."><input className={inputCls} value={deviceForm.authUsername} onChange={(e) => setDf({ authUsername: e.target.value })} placeholder="e.g. admin" autoComplete="off" /></Field>
              <Field label="Device Login Password (optional)"><input type="password" className={inputCls} value={deviceForm.authPassword} onChange={(e) => setDf({ authPassword: e.target.value })} placeholder="Device password" autoComplete="new-password" /></Field>
            </div>
          )}

          {deviceForm.connectionType === 'api' && deviceForm.apiMode === 'push' && (
            <Field label="Push Address" hint="Paste this into the device. It already includes the device name and its secret.">
              <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] space-y-2">
                <p className="text-xs break-all text-[var(--text-primary)] select-all">{deviceForm.deviceName.trim() && deviceSecret ? pushUrlFor(deviceForm.deviceName.trim(), deviceSecret) : 'Enter a device name first.'}</p>
                {deviceForm.deviceName.trim() && deviceSecret && (
                  <button onClick={() => copy(pushUrlFor(deviceForm.deviceName.trim(), deviceSecret), 'Push address')} className={`${btn} border border-[var(--border)] text-[var(--text-secondary)]`}><Copy className="w-3.5 h-3.5" /> Copy Address</button>
                )}
              </div>
            </Field>
          )}

          {deviceForm.connectionType === 'api' && deviceForm.apiMode === 'pull' && (
            <div className="space-y-3">
              <Field label="API Address" hint="The JSON address the connector reads attendance records from.">
                <input className={inputCls} value={deviceForm.apiUrl} onChange={(e) => setDf({ apiUrl: e.target.value })} placeholder="e.g. http://192.168.1.50/api/attendance" />
              </Field>
              <Field label="API Token (optional)" hint="Sent as a Bearer token. Use this or a username and password, whichever the device needs.">
                <input type="password" className={inputCls} value={deviceForm.apiToken} onChange={(e) => setDf({ apiToken: e.target.value })} placeholder="Paste the API token" autoComplete="off" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="API Username (optional)"><input className={inputCls} value={deviceForm.authUsername} onChange={(e) => setDf({ authUsername: e.target.value })} placeholder="e.g. admin" autoComplete="off" /></Field>
                <Field label="API Password (optional)"><input type="password" className={inputCls} value={deviceForm.authPassword} onChange={(e) => setDf({ authPassword: e.target.value })} placeholder="API password" autoComplete="new-password" /></Field>
              </div>
            </div>
          )}

          {deviceForm.connectionType === 'api' && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Field Mapping</p>
                <p className="text-[11px] text-[var(--text-muted)]">Where each value sits in the device's JSON. Use dots for nested fields, like data.userId.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Employee Number Field"><input className={inputCls} value={deviceForm.fmEmployee} onChange={(e) => setDf({ fmEmployee: e.target.value })} placeholder="e.g. employeeNumber" /></Field>
                <Field label="Time Field"><input className={inputCls} value={deviceForm.fmTime} onChange={(e) => setDf({ fmTime: e.target.value })} placeholder="e.g. timestamp" /></Field>
                <Field label="Event Field" hint="A value containing 'out' counts as check out. Anything else counts as check in."><input className={inputCls} value={deviceForm.fmEvent} onChange={(e) => setDf({ fmEvent: e.target.value })} placeholder="e.g. event" /></Field>
                <Field label="Records List Field (optional)" hint="If the device sends many records inside one list, name that list here."><input className={inputCls} value={deviceForm.fmRecordsPath} onChange={(e) => setDf({ fmRecordsPath: e.target.value })} placeholder="e.g. records" /></Field>
              </div>
            </div>
          )}

          <Field label="Location (optional)"><input className={inputCls} value={deviceForm.department} onChange={(e) => setDf({ department: e.target.value })} placeholder="e.g. Front Door" /></Field>
          <Field label="Device Secret" hint={deviceForm.connectionType === 'sdk' || deviceForm.apiMode === 'pull' ? 'Created automatically. The connector program uses it when it sends scans.' : 'Created automatically. It is already inside the push address above.'}>
            <div className="flex items-center gap-2">
              <input className={inputCls} value={deviceSecret} readOnly type={secretVisible ? 'text' : 'password'} placeholder="Creating…" />
              <button title={secretVisible ? 'Hide secret' : 'Show secret'} onClick={() => setSecretVisible((v) => !v)} className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer">{secretVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              <button title="Copy secret" onClick={() => deviceSecret && copy(deviceSecret, 'Secret')} className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer"><Copy className="w-4 h-4" /></button>
              {editingDevice && (
                <button title="Make a new secret" onClick={replaceSecret} className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
              )}
            </div>
          </Field>
          <Field label="Notes (optional)"><textarea className={inputCls} rows={2} value={deviceForm.notes} onChange={(e) => setDf({ notes: e.target.value })} placeholder="e.g. Mounted at the main entrance" /></Field>
        </div>
      </SidePanel>

      {/* Device added */}
      <SidePanel open={!!savedDevice} onClose={() => setSavedDevice(null)} title="Device Added"
        footer={<button onClick={() => setSavedDevice(null)} className="erp-btn erp-btn-primary w-full">Done</button>}>
        {savedDevice && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">"{savedDevice.deviceName}" is saved. {connectionNote(savedDevice)}</p>
            {savedDevice.connectionType === 'api' && savedDevice.apiMode !== 'pull' && (
              <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] space-y-2">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Push Address</p>
                <p className="text-xs break-all text-[var(--text-primary)] select-all">{pushUrlFor(savedDevice.deviceName, savedDevice.webhookSecret)}</p>
                <button onClick={() => copy(pushUrlFor(savedDevice.deviceName, savedDevice.webhookSecret), 'Push address')} className={`${btn} border border-[var(--border)] text-[var(--text-secondary)]`}><Copy className="w-3.5 h-3.5" /> Copy Address</button>
              </div>
            )}
            <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)]">Device Secret</p>
              <p className="text-sm font-bold break-all text-[var(--text-primary)] select-all">{savedDevice.webhookSecret}</p>
              <button onClick={() => copy(savedDevice.webhookSecret, 'Secret')} className={`${btn} border border-[var(--border)] text-[var(--text-secondary)]`}><Copy className="w-3.5 h-3.5" /> Copy Secret</button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {savedDevice.connectionType === 'sdk' || savedDevice.apiMode === 'pull'
                ? 'The office connector program picks up this device within 30 seconds, as long as it has the Attendance Connector Key from Control Center. Its health shows in the device list.'
                : 'Its health shows in the device list once the first scan arrives.'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">On the device, enroll each person with their employee number as the User ID (for example EMP-00012, or 12 on keypad-only devices).</p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
