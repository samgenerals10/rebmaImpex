// rebma-web/src/components/hr/DepartmentChangeCard.tsx
//
// "Change department" on the person's own profile (approved rule): the
// request goes to the CEO, and nothing changes until the CEO approves it
// (api/department-change.ts). Web twin of
// rebma-mobile/components/shared/DepartmentChangeCard.tsx.
import { useCallback, useEffect, useState } from 'react';
import SearchableDropdown from '../ui/SearchableDropdown';
import {
  getMyDepartmentChange, departmentChangeApi, MOVABLE_DEPARTMENTS, deptLabel, type DepartmentChangeRequest,
} from '../../utils/staffDirectory';

const STATUS_TEXT: Record<DepartmentChangeRequest['status'], string> = {
  pending: 'Waiting for the CEO', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled',
};
const inputCls = 'w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

export default function DepartmentChangeCard({ userId, currentDepartment, addNotification }: { userId: string; currentDepartment: string; addNotification: (msg: string) => void }) {
  const [latest, setLatest] = useState<DepartmentChangeRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [toDepartment, setToDepartment] = useState('');
  const [toRole, setToRole] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setLatest(await getMyDepartmentChange(userId)), [userId]);
  useEffect(() => { load(); }, [load]);

  const current = String(currentDepartment || '').toLowerCase();
  const options = MOVABLE_DEPARTMENTS.filter((d) => d.code !== current && d.label.toLowerCase() !== current);

  const submit = async () => {
    if (!toDepartment) { addNotification('Pick the department you want to move to.'); return; }
    if (!reason.trim()) { addNotification('Tell the CEO why you want to move.'); return; }
    setBusy(true);
    try {
      const res = await departmentChangeApi.request(toDepartment, toRole.trim(), reason.trim());
      setOpen(false); setToDepartment(''); setToRole(''); setReason('');
      addNotification(res.message);
      load();
    } catch (e: any) {
      addNotification(`Could not send: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!latest || !await window.confirm('Withdraw your department change request?')) return;
    try { addNotification((await departmentChangeApi.cancel(latest.id)).message); load(); } catch (e: any) { addNotification(e.message); }
  };

  const pending = latest?.status === 'pending';

  return (
    <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3">
      <div>
        <p className="text-sm font-bold text-[var(--text-primary)]">Change department</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Ask to move to another department. The CEO approves it first; nothing changes before that.</p>
      </div>
      {latest && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs font-semibold text-[var(--text-primary)]">Last request: {deptLabel(latest.toDepartment)}{latest.toRole ? ` as ${latest.toRole}` : ''}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-secondary)]">{STATUS_TEXT[latest.status]}</span>
          </div>
          {latest.note && <p className="text-xs text-[var(--text-muted)]">Note: {latest.note}</p>}
          {pending && <button onClick={cancel} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer">Withdraw request</button>}
        </div>
      )}
      {!pending && !open && (
        <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Request a move</button>
      )}
      {!pending && open && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Move to</label>
            <SearchableDropdown value={toDepartment} onChange={setToDepartment} placeholder="Pick a department" options={options.map((d) => ({ value: d.code, label: d.label }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Role there (optional)</label>
            <input className={inputCls} value={toRole} onChange={(e) => setToRole(e.target.value)} placeholder="e.g. Sales Officer" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Reason</label>
            <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you want to move?" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer">Cancel</button>
            <button onClick={submit} disabled={busy} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent)' }}>{busy ? 'Sending…' : 'Send to CEO'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
