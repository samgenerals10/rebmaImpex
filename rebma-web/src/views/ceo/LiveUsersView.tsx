// rebma-web/src/views/ceo/LiveUsersView.tsx
//
// Phase 10.3 — "Live Users". Subscribes to the same Realtime Presence
// channel every signed-in session tracks itself on (lib/presence.ts) and
// renders presenceState() directly — no table, no polling, "online"
// means the websocket connection is actually live right now.
//
// Actions:
//  - Suspend / Reactivate / Block / Unblock: through api/set-user-status.ts
//    with the CEO's password. The server locks or unlocks sign-in, ends
//    open sessions and logs it; the database refuses a status change made
//    straight from the browser.
//  - Kick Offline: api/kick-user.ts ends every session, then the broadcast
//    (lib/presence.ts's kickUserOffline) closes the person's open screen
//    right away. NOT account deletion.
//  - None of these are offered on a CEO account: no CEO acts on another.
//  - Send Message: opens the existing Messenger straight into a DM with
//    that person.
import { useEffect, useState } from 'react';
import { Radio, MessageSquare, LogOut, Ban, ShieldOff, ShieldCheck, UserCheck, Download } from 'lucide-react';
import { openExportPreview } from '../../utils/exportPreview';
import { subscribeToLiveUsers, kickUserOffline, type PresencePayload } from '../../lib/presence';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';
import { callPrivilegedApi } from '../../utils/privilegedApi';
import PasswordConfirmModal from '../../components/ui/PasswordConfirmModal';

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

type StatusAction = 'suspend' | 'reactivate' | 'block' | 'unblock';

const STATUS_WORDING: Record<StatusAction, { title: string; verb: string; effect: string }> = {
  suspend: { title: 'Confirm Suspension', verb: 'Suspend', effect: 'They are signed out everywhere and cannot sign in until reactivated.' },
  reactivate: { title: 'Confirm Reactivation', verb: 'Reactivate', effect: 'They can sign in again.' },
  block: { title: 'Confirm Block', verb: 'Block', effect: 'They are signed out everywhere and cannot sign in until unblocked.' },
  unblock: { title: 'Confirm Unblock', verb: 'Unblock', effect: 'They can sign in again.' },
};

function initials(name: string) {
  return (name || '').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function LiveUsersView({ currentUser, addNotification, onMessageUser }: Props) {
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [now, setNow] = useState(Date.now());
  const [statusByUser, setStatusByUser] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [ceoIds, setCeoIds] = useState<Set<string>>(new Set());
  const [pendingStatus, setPendingStatus] = useState<{ userId: string; name: string; action: StatusAction } | null>(null);

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
    supabase.from('profiles').select('id, status, is_admin').in('id', ids).then(({ data }) => {
      const next: Record<string, string> = {};
      const ceos = new Set<string>();
      (data || []).forEach((row: any) => {
        next[row.id] = String(row.status || 'ACTIVE').toUpperCase();
        if (row.is_admin) ceos.add(row.id);
      });
      setStatusByUser((prev) => ({ ...prev, ...next }));
      setCeoIds(ceos);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.map((u) => u.userId).join(',')]);

  // Runs after the CEO types their password. A thrown error keeps the
  // password panel open with the server's message.
  const runStatusChange = async (password: string) => {
    const pending = pendingStatus;
    if (!pending) return;
    const res = await callPrivilegedApi<{ status?: string; message?: string }>('/api/set-user-status', { userId: pending.userId, action: pending.action, password });
    if (pending.action === 'suspend' || pending.action === 'block') kickUserOffline(pending.userId);
    setStatusByUser((prev) => ({ ...prev, [pending.userId]: res.status || prev[pending.userId] }));
    setPendingStatus(null);
    addNotification(res.message || 'Status updated.');
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
      const body = await callPrivilegedApi<{ message?: string }>('/api/kick-user', { userId });
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.25rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', margin: 0 }}>
          <Radio size={20} /> Live Users
        </h2>
        {users.length > 0 && (
          <button
            onClick={() => openExportPreview({
              title: 'Live Users',
              data: sorted.map((u) => ({
                name: u.fullName, role: u.role || 'Not set', department: u.department,
                timeSpent: formatDuration(now - new Date(u.loggedInAt).getTime()),
                since: new Date(u.loggedInAt).toLocaleString(),
                status: (statusByUser[u.userId] || 'ACTIVE').replace(/_/g, ' '),
              })),
              columns: [
                { key: 'name', label: 'User' }, { key: 'role', label: 'Role' }, { key: 'department', label: 'Department' },
                { key: 'timeSpent', label: 'Time Spent' }, { key: 'since', label: 'Since' }, { key: 'status', label: 'Status' },
              ],
            })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        )}
      </div>
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
                const isCeo = ceoIds.has(u.userId);
                const canAct = !isSelf && !isCeo;
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
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.fullName}{isSelf ? ' (you)' : isCeo ? ' (CEO)' : ''}</span>
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
                        {canAct && status === 'ACTIVE' && (
                          <button disabled={isBusy} onClick={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'suspend' })} title="Suspend"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <ShieldOff size={13} /> Suspend
                          </button>
                        )}
                        {canAct && status === 'SUSPENDED' && (
                          <button disabled={isBusy} onClick={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'reactivate' })} title="Reactivate"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <UserCheck size={13} /> Reactivate
                          </button>
                        )}
                        {canAct && (status === 'ACTIVE' || status === 'SUSPENDED') && (
                          <button disabled={isBusy} onClick={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'block' })} title="Block"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <Ban size={13} /> Block
                          </button>
                        )}
                        {canAct && status === 'BLOCKED' && (
                          <button disabled={isBusy} onClick={() => setPendingStatus({ userId: u.userId, name: u.fullName, action: 'unblock' })} title="Unblock"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <ShieldCheck size={13} /> Unblock
                          </button>
                        )}
                        {canAct && (
                          <button disabled={isBusy} onClick={() => handleKick(u.userId, u.fullName)} title="Kick offline right now"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <LogOut size={13} /> Kick
                          </button>
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
      <PasswordConfirmModal
        open={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        title={pendingStatus ? STATUS_WORDING[pendingStatus.action].title : ''}
        description={pendingStatus ? `${STATUS_WORDING[pendingStatus.action].verb} ${pendingStatus.name}? ${STATUS_WORDING[pendingStatus.action].effect} Type your password to confirm it is you.` : ''}
        confirmLabel={pendingStatus ? STATUS_WORDING[pendingStatus.action].verb : 'Confirm'}
        danger={pendingStatus?.action === 'suspend' || pendingStatus?.action === 'block'}
        onConfirm={runStatusChange}
      />
    </div>
  );
}
