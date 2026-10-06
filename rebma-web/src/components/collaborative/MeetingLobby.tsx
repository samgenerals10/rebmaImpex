// rebma-web/src/components/collaborative/MeetingLobby.tsx
//
// The screen before a meeting, as in Zoom, Teams or Google Meet: check
// your camera and microphone, choose whether to go in with them on, and
// (when starting) name the meeting, invite people and share the code.
// Nothing joins until "Start meeting" or "Join now" is pressed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Copy, Check, X, Search, Users } from 'lucide-react';

export interface LobbyPerson { id: string; fullName: string; department: string; photo?: string | null }

interface Props {
  mode: 'start' | 'join';
  /** Start: the suggested title. Join: the meeting's title. */
  title: string;
  /** The meeting code (shown with Copy buttons). */
  code: string;
  myName: string;
  /** Start mode only: people who can be invited. */
  people?: LobbyPerson[];
  onCancel: () => void;
  onConfirm: (choice: { title: string; inviteeIds: string[]; micOn: boolean; camOn: boolean }) => Promise<void> | void;
}

const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function MeetingLobby({ mode, title: initialTitle, code, myName, people = [], onCancel, onConfirm }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [level, setLevel] = useState(0);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Camera and microphone preview, released when the lobby closes.
  useEffect(() => {
    let active = true;
    let s: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ audio: true, video: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }))
      .then((got) => {
        if (!active) { got.getTracks().forEach((t) => t.stop()); return; }
        s = got;
        setStream(got);
        if (got.getVideoTracks().length === 0) setCamOn(false);
      })
      .catch(() => setMediaError('Allow camera and microphone access in your browser to be seen and heard.'));
    return () => { active = false; s?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream, camOn]);
  useEffect(() => { stream?.getAudioTracks().forEach((t) => { t.enabled = micOn; }); }, [stream, micOn]);
  useEffect(() => { stream?.getVideoTracks().forEach((t) => { t.enabled = camOn; }); }, [stream, camOn]);

  // A small live meter, so you can see your microphone is picking you up.
  useEffect(() => {
    if (!stream || !micOn || stream.getAudioTracks().length === 0) { setLevel(0); return; }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      setLevel(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 60));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); };
  }, [stream, micOn]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => !q || p.fullName.toLowerCase().includes(q) || p.department.toLowerCase().includes(q)).slice(0, 50);
  }, [people, search]);

  const invitation = `${myName} is inviting you to "${title || initialTitle}" on REBMA IMPEX.\nJoin from Viber, then Boardroom, then Meetings, or enter this code: ${code}`;

  const copy = async (what: 'code' | 'invite') => {
    try { await navigator.clipboard.writeText(what === 'code' ? code : invitation); setCopied(what); setTimeout(() => setCopied(null), 1600); } catch { /* clipboard blocked */ }
  };

  const confirm = async () => {
    setBusy(true);
    // Hand the camera and mic over to the meeting itself.
    stream?.getTracks().forEach((t) => t.stop());
    try { await onConfirm({ title: title.trim() || initialTitle, inviteeIds: invitees, micOn, camOn }); }
    finally { setBusy(false); }
  };

  const toggleBtn = (on: boolean) => `w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors ${on ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`;

  return (
    <div className="fixed inset-0 z-[1700] bg-black/60 flex items-center justify-center p-0 sm:p-6">
      <div className="bg-[var(--bg-card)] w-full max-w-4xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Preview */}
        <div className="md:w-[56%] bg-[#0f172a] p-5 flex flex-col gap-4">
          <div className="relative flex-1 min-h-[220px] rounded-2xl overflow-hidden bg-[#1e293b] flex items-center justify-center">
            {camOn && stream?.getVideoTracks().length ? (
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/70">
                <div className="w-20 h-20 rounded-full bg-[var(--accent)] text-white text-2xl font-bold flex items-center justify-center">{initials(myName)}</div>
                <span className="text-xs">Camera is off</span>
              </div>
            )}
            <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-semibold">{myName}</span>
            {micOn && (
              <span className="absolute bottom-3 right-3 flex items-end gap-0.5 h-5" aria-hidden>
                {[0.25, 0.5, 0.75, 1].map((step) => (
                  <span key={step} className={`w-1 rounded-full transition-all ${level >= step * 0.9 ? 'bg-emerald-400' : 'bg-white/30'}`} style={{ height: `${step * 100}%` }} />
                ))}
              </span>
            )}
          </div>
          {mediaError && <p className="text-xs text-amber-300 text-center">{mediaError}</p>}
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setMicOn((v) => !v)} title={micOn ? 'Turn microphone off' : 'Turn microphone on'} className={toggleBtn(micOn)}>
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={() => setCamOn((v) => !v)} title={camOn ? 'Turn camera off' : 'Turn camera on'} className={toggleBtn(camOn)} disabled={!stream?.getVideoTracks().length}>
              {camOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="md:w-[44%] p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{mode === 'start' ? 'New meeting' : 'Ready to join?'}</p>
              {mode === 'join' && <h2 className="text-lg font-extrabold text-[var(--text-primary)] mt-0.5">{initialTitle}</h2>}
            </div>
            <button onClick={onCancel} title="Close" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)] cursor-pointer"><X size={18} /></button>
          </div>

          {mode === 'start' && (
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Meeting title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this meeting about?" className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
            <p className="text-xs font-bold text-[var(--text-primary)]">Meeting code</p>
            <p className="text-xs font-mono text-[var(--text-secondary)] break-all">{code}</p>
            <div className="flex gap-2">
              <button onClick={() => copy('code')} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[var(--text-primary)] cursor-pointer">
                {copied === 'code' ? <Check size={14} /> : <Copy size={14} />} {copied === 'code' ? 'Copied' : 'Copy code'}
              </button>
              <button onClick={() => copy('invite')} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-[var(--text-primary)] cursor-pointer">
                {copied === 'invite' ? <Check size={14} /> : <Copy size={14} />} {copied === 'invite' ? 'Copied' : 'Copy invitation'}
              </button>
            </div>
          </div>

          {mode === 'start' && (
            <div className="flex flex-col min-h-0">
              <p className="text-xs font-bold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5"><Users size={14} /> Invite people {invitees.length > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] flex items-center justify-center">{invitees.length}</span>}</p>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or department" className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                {shown.map((p) => {
                  const on = invitees.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => setInvitees((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left cursor-pointer ${on ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--bg-input)]'}`}>
                      {p.photo ? <img src={p.photo} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">{initials(p.fullName)}</span>}
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-[var(--text-primary)] truncate">{p.fullName}</span>
                        <span className="block text-[10px] text-[var(--text-muted)] truncate">{p.department}</span>
                      </span>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border)]'}`}>{on && <Check size={11} />}</span>
                    </button>
                  );
                })}
                {shown.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-3">No one matches.</p>}
              </div>
            </div>
          )}

          <div className="mt-auto flex gap-2 pt-2">
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer">Cancel</button>
            <button onClick={confirm} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-60 cursor-pointer">
              {busy ? 'Starting…' : mode === 'start' ? 'Start meeting' : 'Join now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
