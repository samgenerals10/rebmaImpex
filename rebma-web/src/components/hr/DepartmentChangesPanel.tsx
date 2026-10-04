// rebma-web/src/components/hr/DepartmentChangesPanel.tsx
//
// Requests to move to another department, waiting for the CEO (approved
// rule: the CEO approves first, nothing changes before that). Shown in the
// CEO's Approvals. Web twin of rebma-mobile/components/shared/DepartmentChangesPanel.tsx.
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import PasswordConfirmModal from '../ui/PasswordConfirmModal';
import { listPendingDepartmentChanges, departmentChangeApi, deptLabel, type DepartmentChangeRequest } from '../../utils/staffDirectory';

export default function DepartmentChangesPanel({ addNotification, refreshKey }: { addNotification: (msg: string) => void; refreshKey?: number }) {
  const [rows, setRows] = useState<DepartmentChangeRequest[]>([]);
  const [decision, setDecision] = useState<{ request: DepartmentChangeRequest; action: 'approve' | 'reject' } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listPendingDepartmentChanges()); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (rows.length === 0) return null;

  const run = async (password: string) => {
    if (!decision) return;
    const res = decision.action === 'approve'
      ? await departmentChangeApi.approve(decision.request.id, password)
      : await departmentChangeApi.reject(decision.request.id, password);
    setDecision(null);
    addNotification(res.message);
    load();
  };

  return (
    <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3">
      <div>
        <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-[var(--accent)]" /> Department Change Requests</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Staff asking to move department. Nothing changes until you approve.</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <div key={r.id} className="py-3 space-y-1.5">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{r.fullName}: {deptLabel(r.fromDepartment) || 'no department'} to {deptLabel(r.toDepartment)}{r.toRole ? ` as ${r.toRole}` : ''}</p>
            <p className="text-xs text-[var(--text-muted)]">Asked on {new Date(r.createdAt).toLocaleDateString()}. Reason: {r.reason}</p>
            <div className="flex gap-2">
              <button onClick={() => setDecision({ request: r, action: 'approve' })} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer" style={{ background: 'var(--accent)' }}>Approve</button>
              <button onClick={() => setDecision({ request: r, action: 'reject' })} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Reject</button>
            </div>
          </div>
        ))}
      </div>
      <PasswordConfirmModal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Approve Department Change' : 'Reject Department Change'}
        description={decision
          ? decision.action === 'approve'
            ? `Move ${decision.request.fullName} to ${deptLabel(decision.request.toDepartment)}${decision.request.toRole ? ` as ${decision.request.toRole}` : ''}? Their past work stays where they did it. Type your password to confirm it is you.`
            : `Reject ${decision.request.fullName}'s request? They stay where they are. Type your password to confirm it is you.`
          : ''}
        confirmLabel={decision?.action === 'approve' ? 'Approve' : 'Reject'}
        onConfirm={run}
      />
    </div>
  );
}
