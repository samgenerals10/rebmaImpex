// rebma-web/src/components/hr/EnrollmentSection.tsx
//
// Step 4: which attendance devices a person is enrolled on, and under
// which device User ID. Web twin of
// rebma-mobile/components/shared/EnrollmentSection.tsx, kept in step.
// A person's first accepted scan records it by itself; HR can also add
// one by hand (e.g. a keypad device that only takes digits) or remove one.
import { useCallback, useEffect, useState } from 'react';
import { Trash2, Cpu } from 'lucide-react';
import SearchableDropdown from '../ui/SearchableDropdown';
import {
  listEnrollments, addEnrollment, removeEnrollment, listAttendanceDevices,
  type EnrollmentRow, type PersonKind,
} from '../../utils/staffDirectory';

interface Props {
  personKind: PersonKind;
  personId: string;
  employeeNumber?: string;
  canEdit: boolean;
  enrolledBy: string;
  addNotification: (msg: string) => void;
  onChanged?: () => void;
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

export default function EnrollmentSection({ personKind, personId, employeeNumber, canEdit, enrolledBy, addNotification, onChanged }: Props) {
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listEnrollments(personKind, personId)); } catch { setRows([]); }
  }, [personKind, personId]);
  useEffect(() => { load(); }, [load]);

  const startAdding = async () => {
    setAdding(true);
    setUserId(employeeNumber || '');
    const list = await listAttendanceDevices();
    setDevices(list);
    setDeviceId(list[0]?.id || '');
  };

  const save = async () => {
    if (!deviceId) { addNotification('Pick a device. Add one under Attendance first.'); return; }
    if (!userId.trim()) { addNotification('Enter the User ID this person has on the device.'); return; }
    setSaving(true);
    try {
      await addEnrollment({ deviceId, personKind, personId, employeeNumber, deviceUserId: userId, enrolledBy });
      setAdding(false);
      load();
      onChanged?.();
    } catch (e: any) {
      addNotification(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: EnrollmentRow) => {
    if (!await window.confirm(`Stop linking User ID ${row.deviceUserId} on ${row.deviceName} to this person? Their scans there fall back to their employee number.`)) return;
    try { await removeEnrollment(row.id); load(); onChanged?.(); } catch (e: any) { addNotification(e.message); }
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-2"><Cpu className="w-4 h-4 text-[var(--accent)]" /> Attendance Devices</p>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">Not enrolled on any device yet. Their first scan records it, or add it here.</p>
        ) : rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{r.deviceName}</p>
              <p className="text-xs text-[var(--text-muted)]">User ID {r.deviceUserId}. {r.source === 'scan' ? 'Recorded by their first scan' : 'Added by HR'} on {new Date(r.enrolledAt).toLocaleDateString()}.</p>
            </div>
            {canEdit && (
              <button title="Remove" onClick={() => remove(r)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
        {canEdit && !adding && (
          <button onClick={startAdding} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Add enrollment</button>
        )}
        {canEdit && adding && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Device</label>
              <SearchableDropdown value={deviceId} onChange={setDeviceId} placeholder="Pick a device" options={devices.map((d) => ({ value: d.id, label: d.name }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">User ID on the device</label>
              <input className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. EMP-00012" />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] sm:col-span-2">Usually their employee number. Keypad-only devices take digits, e.g. 12.</p>
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer">Cancel</button>
              <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent)' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
