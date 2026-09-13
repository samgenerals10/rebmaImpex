// rebma-web/src/views/ceo/LiveUsersView.tsx
//
// Phase 10.3 — "Live Users". Subscribes to the same Realtime Presence
// channel every signed-in session tracks itself on (lib/presence.ts) and
// renders presenceState() directly — no table, no polling, "online"
// means the websocket connection is actually live right now.
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { LIVE_USERS_CHANNEL, type PresencePayload } from '../../lib/presence';

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LiveUsersView() {
  const [users, setUsers] = useState<PresencePayload[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const channel = supabase.channel(LIVE_USERS_CHANNEL);
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const flat = Object.values(state).flat().filter(Boolean) as unknown as PresencePayload[];
        setUsers(flat);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {users
            .sort((a, b) => new Date(a.loggedInAt).getTime() - new Date(b.loggedInAt).getTime())
            .map((u) => (
              <div key={u.userId} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', display: 'flex', gap: 12 }}>
                {u.photo ? (
                  <img src={u.photo} alt={u.fullName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    {u.fullName?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{u.fullName}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{u.department}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Online for {formatDuration(now - new Date(u.loggedInAt).getTime())}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Since {new Date(u.loggedInAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
