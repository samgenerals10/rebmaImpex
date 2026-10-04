// rebma-web/src/components/ui/PasswordConfirmModal.tsx
// Web twin of rebma-mobile/components/shared/PasswordConfirmSheet.tsx.
//
// "Type your password to confirm it's you", for every high-risk CEO action
// (approved rule). The password goes straight to the server, which checks
// it (api/_shared/reauth.ts); it's never stored in the browser. A wrong
// password keeps the panel open with the server's message.
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import SidePanel from './SidePanel';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  /** Throw an Error to show its message and keep the panel open. */
  onConfirm: (password: string) => Promise<void>;
}

export default function PasswordConfirmModal({ open, title, description, confirmLabel, danger, onClose, onConfirm }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setPassword(''); setError(''); setBusy(false); } }, [open]);

  const submit = async () => {
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
      setPassword('');
    } catch (e: any) {
      setError(e?.message || 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <button onClick={submit} disabled={busy}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 ${danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[var(--accent)] hover:opacity-90'}`}>
          {busy ? 'Checking…' : confirmLabel}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 items-start">
          <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0" />
          <p className="text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Your password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Type your sign-in password"
            autoComplete="current-password"
            autoFocus
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </form>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </div>
    </SidePanel>
  );
}
