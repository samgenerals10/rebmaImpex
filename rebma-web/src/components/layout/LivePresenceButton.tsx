// rebma-web/src/components/layout/LivePresenceButton.tsx
//
// The top bar's "Live" chip, with a badge of how many people are online
// (web and phone, from the shared presence channel in lib/presence.ts).
// Clicking it lists them. For the CEO and admins each person, and the
// "Open Live Users" link, goes to the Live Users page where they can act;
// for everyone else clicking a person opens a chat with them.
import { useEffect, useState } from 'react';
import { Wifi, Radio, ChevronRight } from 'lucide-react';
import { subscribeToLiveUsers, type PresencePayload } from '../../lib/presence';

interface Props {
  networkOnline: boolean;
  myId?: string;
  canManage: boolean;
  onOpenLiveUsers: () => void;
  onMessageUser: (userId: string) => void;
}

function since(iso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} hr ${mins % 60} min`;
}

const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function LivePresenceButton({ networkOnline, myId, canManage, onOpenLiveUsers, onMessageUser }: Props) {
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeToLiveUsers(setUsers), []);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, [open]);

  const sorted = [...users].sort((a, b) => (a.userId === myId ? -1 : b.userId === myId ? 1 : a.fullName.localeCompare(b.fullName)));

  const pick = (u: PresencePayload) => {
    setOpen(false);
    if (canManage) onOpenLiveUsers();
    else if (u.userId !== myId) onMessageUser(u.userId);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={networkOnline ? `${users.length} online` : 'Offline'}
        className={`relative flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider cursor-pointer ${networkOnline ? 'text-[var(--accent)] bg-[var(--accent-light)]' : 'text-rose-600 bg-rose-50'}`}
      >
        <Wifi className={`w-3.5 h-3.5 ${networkOnline ? 'animate-pulse' : ''}`} />
        <span>{networkOnline ? 'Live' : 'Offline'}</span>
        {users.length > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center normal-case tracking-normal">
            {users.length > 99 ? '99+' : users.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl z-[200] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2"><Radio className="w-4 h-4 text-[var(--accent)]" /> Online now</span>
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">{users.length} {users.length === 1 ? 'person' : 'people'}</span>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {sorted.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">No one is online right now.</p>
              ) : sorted.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => pick(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--accent-light)] text-left cursor-pointer"
                >
                  <span className="relative shrink-0">
                    {u.photo
                      ? <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : <span className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-bold flex items-center justify-center">{initials(u.fullName)}</span>}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-card)]" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-[var(--text-primary)] truncate">{u.fullName}{u.userId === myId ? ' (you)' : ''}</span>
                    <span className="block text-[11px] text-[var(--text-muted)] truncate">{u.department}{u.role ? `, ${u.role}` : ''} · {since(u.loggedInAt, now)}</span>
                  </span>
                  {(canManage || u.userId !== myId) && <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
                </button>
              ))}
            </div>
            {canManage && (
              <button onClick={() => { setOpen(false); onOpenLiveUsers(); }} className="w-full px-4 py-3 border-t border-[var(--border)] text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-light)] cursor-pointer">
                Open Live Users
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
