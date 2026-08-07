import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  onEnrolled?: () => void;
}

// Built on Supabase Auth's own TOTP MFA (supabase.auth.mfa.*) rather than a
// custom/SMS implementation — no third-party account, no per-message cost,
// works with any standard authenticator app (Google Authenticator, Authy,
// 1Password, etc). This is the whole enrollment flow: request a factor,
// show its QR code, confirm the app produced a valid code, done.
export default function TwoFactorSetup({ onEnrolled }: Props) {
  const [loading, setLoading] = useState(true);
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      const verified = data.totp.find(f => f.status === 'verified');
      setEnrolledFactorId(verified?.id || null);
    }
    setLoading(false);
  };

  useEffect(() => { loadFactors(); }, []);

  const startEnroll = async () => {
    setMessage(null);
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      setMessage({ text: error.message, ok: false });
      setEnrolling(false);
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode('');
    setEnrolling(false);
    setMessage(null);
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFactorId || code.length !== 6) return;
    setSubmitting(true);
    setMessage(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
    if (challengeError || !challenge) {
      setMessage({ text: challengeError?.message || 'Failed to start verification.', ok: false });
      setSubmitting(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: pendingFactorId, challengeId: challenge.id, code });
    setSubmitting(false);
    if (verifyError) {
      setMessage({ text: 'Incorrect code — check your authenticator app and try again.', ok: false });
      return;
    }
    setMessage({ text: '✅ Two-factor authentication enabled.', ok: true });
    setEnrolledFactorId(pendingFactorId);
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode('');
    setEnrolling(false);
    onEnrolled?.();
  };

  const disable = async () => {
    if (!enrolledFactorId) return;
    if (!confirm('Turn off two-factor authentication for your account?')) return;
    setSubmitting(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
    setSubmitting(false);
    if (error) { setMessage({ text: error.message, ok: false }); return; }
    setEnrolledFactorId(null);
    setMessage({ text: 'Two-factor authentication turned off.', ok: true });
  };

  if (loading) {
    return <p className="text-xs text-[var(--text-muted)]">Checking your two-factor status…</p>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-xl text-xs font-semibold ${message.ok ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
          {message.text}
        </div>
      )}

      {enrolledFactorId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-bold">Two-factor authentication is on</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Your account requires a code from your authenticator app at login, in addition to your password.</p>
          <button onClick={disable} disabled={submitting} className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded-xl text-xs font-bold cursor-pointer hover:bg-rose-500/20 disabled:opacity-50">
            <ShieldOff className="w-3.5 h-3.5" /> {submitting ? 'Turning off...' : 'Turn off 2FA'}
          </button>
        </div>
      ) : !enrolling ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-bold text-[var(--text-primary)]">Two-factor authentication is off</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Add a second step at login using an authenticator app (Google Authenticator, Authy, 1Password, etc.) — a code from your phone alongside your password.</p>
          <button onClick={startEnroll} className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90">
            Enable 2FA
          </button>
        </div>
      ) : (
        <form onSubmit={confirmEnroll} className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
          {qrCode && (
            <div className="flex justify-center p-4 bg-white rounded-xl border border-[var(--border)]">
              <img src={qrCode} alt="2FA QR code" className="w-40 h-40" />
            </div>
          )}
          {secret && (
            <p className="text-[10px] text-[var(--text-muted)] text-center break-all">Can't scan? Enter this key manually: <span className="font-mono">{secret}</span></p>
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">6-digit code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-center tracking-[0.3em] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={cancelEnroll} className="flex-1 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-xs font-bold cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={code.length !== 6 || submitting} className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Verifying...' : 'Confirm & Enable'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
