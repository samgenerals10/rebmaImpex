// rebma-web/src/components/hr/DeletionRequestsPanel.tsx
//
// "Delete Account" requests waiting to be confirmed (approved rule: the
// person asks, HR confirms, then the account is closed). HR confirms
// ordinary staff; requests from HR or Management staff are the CEO's.
// Closing an account deletes nothing: all their work stays in the system.
// Web twin of rebma-mobile/components/shared/DeletionRequestsPanel.tsx.
import { useCallback, useEffect, useState } from 'react';
import { UserMinus } from 'lucide-react';
import PasswordConfirmModal from '../ui/PasswordConfirmModal';
import { listPendingDeletionRequests, deletionApi, deptLabel, type DeletionRequest } from '../../utils/staffDirectory';

interface Props {
  callerIsCeo: boolean;
  callerId?: string;
  addNotification: (msg: string) => void;
  onChanged?: () => void;
  refreshKey?: number;
}

export default function DeletionRequestsPanel({ callerIsCeo, callerId, addNotification, onChanged, refreshKey }: Props) {
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [decision, setDecision] = useState<{ request: DeletionRequest; action: 'approve' | 'reject' } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listPendingDeletionRequests()); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const mine = rows.filter((r) => r.userId !== callerId && (callerIsCeo || r.confirmer === 'HR'));
  if (mine.length === 0) return null;

  const run = async (password: string) => {
    if (!decision) return;
    const res = decision.action === 'approve'
      ? await deletionApi.approve(decision.request.id, password)
      : await deletionApi.reject(decision.request.id, password);
    setDecision(null);
    addNotification(res.message);
    load();
    onChanged?.();
  };

  return (
    <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3">
      <div>
        <p className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"><UserMinus className="w-4 h-4 text-rose-500" /> Account Deletion Requests</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Staff asking to delete their account. Confirming closes the account; all their work stays in the system.</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {mine.map((r) => (
          <div key={r.id} className="py-3 space-y-1.5">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{r.fullName}{r.department ? `, ${deptLabel(r.department)}` : ''}</p>
            <p className="text-xs text-[var(--text-muted)]">Asked on {new Date(r.createdAt).toLocaleDateString()}. Reason: {r.reason}</p>
            <div className="flex gap-2">
              <button onClick={() => setDecision({ request: r, action: 'approve' })} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 cursor-pointer">Confirm</button>
              <button onClick={() => setDecision({ request: r, action: 'reject' })} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Reject</button>
            </div>
          </div>
        ))}
      </div>
      <PasswordConfirmModal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Close Account' : 'Reject Request'}
        description={decision
          ? decision.action === 'approve'
            ? `Close ${decision.request.fullName}'s account? They can no longer sign in. All their work stays in the system. Type your password to confirm it is you.`
            : `Reject ${decision.request.fullName}'s request? Their account stays open. Type your password to confirm it is you.`
          : ''}
        confirmLabel={decision?.action === 'approve' ? 'Close account' : 'Reject'}
        danger={decision?.action === 'approve'}
        onConfirm={run}
      />
    </div>
  );
}
