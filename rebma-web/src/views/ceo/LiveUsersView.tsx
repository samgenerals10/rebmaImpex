// rebma-web/src/views/ceo/LiveUsersView.tsx
//
// Phase 10.3 — "Live Users". Subscribes to the same Realtime Presence
// channel every signed-in session tracks itself on (lib/presence.ts) and
// renders presenceState() directly — no table, no polling, "online"
// means the websocket connection is actually live right now.
//
// Actions:
//  - Suspend / Reactivate: same profiles.status flip HR's own Suspend
//    button uses (StaffView.tsx) — the mechanism already exists, this is
//    just a second place to trigger it.
//  - Block / Unblock: same mechanism, new status value ('BLOCKED') — "make
//    the user inactive like blacklisting the user", enforced by the login
//    gate's explicit BLOCKED message (apiClient.ts / mobile authStore.ts).
//  - Kick Offline: a real-time broadcast telling that one connected
//    session to sign itself out right now (lib/presence.ts's
//    kickUserOffline) — NOT account deletion. There's no way to force a
//    sign-out by user ID alone (Supabase's admin.signOut() needs the
//    target's own JWT), so this is the only honest mechanism for
//    "kicking them offline right now."
//  - Send Message: opens the existing Messenger straight into a DM with
//    that person.
import { useEffect, useState } from 'react';
import { Radio, MessageSquare, LogOut, Ban, ShieldOff, ShieldCheck, UserCheck } from 'lucide-react';
import { subscribeToLiveUsers, kickUserOffline, type PresencePayload } from '../../lib/presence';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface Props {
  currentUser?: CurrentUser | null;
  addNotification: (msg: string) => void;
  onMessageUser: (userId: string) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function initials(name: string) {
  return (name || '').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function LiveUsersView({ currentUser, addNotification, onMessageUser }: Props) {
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [now, setNow] = useState(Date.now());
  const [statusByUser, setStatusByUser] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Reads the shared presence channel App.tsx already opened at login —
  // never opens a second channel of its own (that was the bug: Supabase
  // rejects adding a presence listener to a channel that's already
  // subscribed, and a second `.channel()` call with the same name
  // returns that same already-subscribed instance).
  useEffect(() => {
    return subscribeToLiveUsers(setUsers);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Suspend/Block state lives on profiles.status, not in the presence
  // payload — a user tracked as "online" can be suspended/blocked mid-
  // session, so this is fetched (and re-fetched after every action)
  // separately rather than trusted from the moment they logged in.
  useEffect(() => {
    const ids = users.map((u) => u.userId);
    if (ids.length === 0) return;
    supabase.from('profiles').select('id, status').in('id', ids).then(({ data }) => {
      const next: Record<string, string> = {};
      (data || []).forEach((row: any) => { next[row.id] = row.status; });
      setStatusByUser((prev) => ({ ...prev, ...next }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.map((u) => u.userId).join(',')]);

  const setStatus = async (userId: string, name: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', verb: string) => {
    if (busyUserId) return;
    setBusyUserId(userId);
    try {
      const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
      if (error) throw error;
      setStatusByUser((prev) => ({ ...prev, [userId]: status }));
      addNotification(`${name} ${verb}.`);
    } catch (err: any) {
      addNotification(`Failed to update ${name}: ${err.message}`);
    } finally {
      setBusyUserId(null);
    }
  };

  // Routed through api/kick-user.ts, which does a real server-side
  // session invalidation (supabase.auth.admin.signOut) — the old
  // implementation was only a client-side Realtime broadcast with no
  // authorization check at all, and asked the target's own client to
  // sign itself out, which a modified client could simply ignore.
  // Security/gap audit fix. The broadcast is still sent afterward
  // (unchanged) purely so the target's already-open screen updates
  // immediately if it's still running — a UX nicety now, not the
  // enforcement itself.
  const handleKick = async (userId: string, name: string) => {
    if (busyUserId) return;
    setBusyUserId(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated.');
      const res = await fetch('/api/kick-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to kick user offline.');
      kickUserOffline(userId);
      addNotification(body.message || `${name} has been kicked offline.`);
    } catch (err: any) {
      addNotification(`Failed to kick ${name} offline: ${err.message}`);
    } finally {
      setBusyUserId(null);
    }
  };

  const sorted = [...users].sort((a, b) => new Date(a.loggedInAt).getTime() - new Date(b.loggedInAt).getTime());

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        <Radio size={20} /> Live Users
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: '1.25rem' }}>
        {users.length} {users.length === 1 ? 'person' : 'people'} online right now, across web and mobile.
      </p>

      {users.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No one else is online right now.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>User</th>
                <th style={{ padding: '10px 12px' }}>Department</th>
                <th style={{ padding: '10px 12px' }}>Time Spent</th>
                <th style={{ padding: '10px 12px' }}>Since</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const status = statusByUser[u.userId] || 'ACTIVE';
                const isSelf = currentUser?.id === u.userId;
                const isBusy = busyUserId === u.userId;
                return (
                  <tr key={u.userId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {u.photo ? (
                          <img
                            src={u.photo}
                            alt={u.fullName}
                            onClick={() => window.open(u.photo!, '_blank', 'noopener,noreferrer')}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                            {initials(u.fullName)}
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 4, background: '#10b981', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.fullName}{isSelf ? ' (you)' : ''}</span>
                          </div>
                          {u.role && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{u.role}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{u.department}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatDuration(now - new Date(u.loggedInAt).getTime())}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(u.loggedInAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: status === 'BLOCKED' ? 'rgba(239,68,68,0.12)' : status === 'SUSPENDED' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                        color: status === 'BLOCKED' ? '#ef4444' : status === 'SUSPENDED' ? '#f59e0b' : '#10b981',
                      }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {!isSelf && (
                          <>
                            <button
                              disabled={isBusy}
                              onClick={() => setStatus(u.userId, u.fullName, status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED', status === 'SUSPENDED' ? 'reactivated' : 'suspended')}
                              title={status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                            >
                              {status === 'SUSPENDED' ? <UserCheck size={13} /> : <ShieldOff size={13} />}
                              {status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => setStatus(u.userId, u.fullName, status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED', status === 'BLOCKED' ? 'unblocked' : 'blocked')}
                              title={status === 'BLOCKED' ? 'Unblock' : 'Block'}
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                            >
                              {status === 'BLOCKED' ? <ShieldCheck size={13} /> : <Ban size={13} />}
                              {status === 'BLOCKED' ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              onClick={() => handleKick(u.userId, u.fullName)}
                              title="Kick offline right now"
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                            >
                              <LogOut size={13} /> Kick
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => onMessageUser(u.userId)}
                          title="Send message"
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                        >
                          <MessageSquare size={13} /> Message
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
