// rebma-web/src/views/ConfirmEmailChangeView.tsx
// The page the CEO email-change confirmation link opens
// (/confirm-email-change?token=...). Nothing changes until the person
// presses Confirm here, so an email scanner that opens links on its own
// can't trigger the change. The server (api/ceo-confirm-email-change.ts)
// checks the one-time link and does the change.
import { useState } from 'react';
import { MailCheck } from 'lucide-react';

export default function ConfirmEmailChangeView({ token }: { token: string | null }) {
  const [state, setState] = useState<'ready' | 'working' | 'done' | 'error'>(token ? 'ready' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This confirmation link is not complete.');

  const confirm = async () => {
    setState('working');
    try {
      const res = await fetch('/api/ceo-confirm-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The change could not be confirmed.');
      setMessage(body.message || 'Done.');
      setState('done');
    } catch (e: any) {
      setMessage(e.message);
      setState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
        <MailCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h1 className="text-xl font-black text-slate-900">Confirm your new email</h1>
        {state === 'ready' && (
          <>
            <p className="text-sm text-slate-600 mt-2">Press the button to make this address your Rebma Impex sign-in email.</p>
            <button onClick={confirm} className="mt-5 w-full py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold cursor-pointer">Confirm</button>
          </>
        )}
        {state === 'working' && <p className="text-sm text-slate-600 mt-3">Confirming…</p>}
        {state === 'done' && (
          <>
            <p className="text-sm text-emerald-700 mt-3">{message}</p>
            <a href="/" className="mt-5 inline-block text-sm font-bold text-emerald-600 hover:underline">Go to sign in</a>
          </>
        )}
        {state === 'error' && <p className="text-sm text-rose-600 mt-3">{message}</p>}
      </div>
    </div>
  );
}
