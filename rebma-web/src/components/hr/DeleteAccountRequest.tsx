// rebma-web/src/components/hr/DeleteAccountRequest.tsx
//
// "Delete Account" in Settings (approved rule): the person asks, HR
// confirms, and only then is the account closed. Requests from HR or
// Management staff are confirmed by the CEO. Closing an account deletes
// nothing: all the work the person did stays in the system. Sent to the
// server with the person's own password (api/account-deletion.ts). This
// used to show "submitted" without sending anything anywhere.
// Web twin of rebma-mobile/screens/settings/DeleteAccountScreen.tsx.
import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getMyDeletionRequest, deletionApi, type DeletionRequest } from '../../utils/staffDirectory';

const STATUS_TEXT: Record<DeletionRequest['status'], string> = {
  pending: 'Waiting for confirmation', approved: 'Confirmed', rejected: 'Not confirmed', cancelled: 'Cancelled',
};
const inputCls = 'w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-400';

interface Props {
  currentUser?: { id?: string; fullName?: string; isAdmin?: boolean } | null;
  addNotification?: (msg: string) => void;
}

export default function DeleteAccountRequest({ currentUser, addNotification }: Props) {
  const [latest, setLatest] = useState<DeletionRequest | null>(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (currentUser?.id) setLatest(await getMyDeletionRequest(currentUser.id));
  }, [currentUser?.id]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Tell HR why you want to delete your account.'); return; }
    if (!password) { setError('Type your password to confirm it is you.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await deletionApi.request(reason.trim(), password);
      setReason(''); setPassword('');
      addNotification?.(res.message);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!latest || !await window.confirm('Withdraw your request? Your account stays open.')) return;
    try { addNotification?.((await deletionApi.cancel(latest.id)).message); load(); } catch (err: any) { setError(err.message); }
  };

  const pending = latest?.status === 'pending';

  return (
    <div className="max-w-md">
      <div className="p-4 md:p-6 bg-[var(--bg-card)] border-2 border-red-500/30 rounded-2xl space-y-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-rose-600" />
          <h3 className="text-base md:text-lg font-bold text-rose-600">Delete Account</h3>
        </div>

        {currentUser?.isAdmin ? (
          <p className="text-xs text-[var(--text-secondary)]">A CEO account is removed by the other CEO, from Control Center, CEO Account. It can't be deleted here.</p>
        ) : (
          <>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600">
              Your request goes to HR. Once HR confirms it, you can no longer sign in. The work you did stays in the system for your department.
            </div>

            {latest && (
              <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Your last request</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">{STATUS_TEXT[latest.status]}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Sent on {new Date(latest.createdAt).toLocaleDateString()}. To be confirmed by {latest.confirmer === 'CEO' ? 'the CEO' : 'HR'}.{latest.note ? ` Note: ${latest.note}` : ''}
                </p>
                {pending && (
                  <button onClick={cancel} className="mt-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer">Withdraw request</button>
                )}
              </div>
            )}

            {!pending && (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Reason for deletion</label>
                  <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} rows={3}
                    placeholder="Tell HR why you'd like to delete your account..." className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Your password</label>
                  <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    autoComplete="current-password" placeholder="Type your sign-in password" className={inputCls} />
                </div>
                {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
                <button type="submit" disabled={busy} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                  {busy ? 'Sending…' : 'Send Request to HR'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
