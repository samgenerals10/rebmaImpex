// rebma-web/src/lib/presence.ts
//
// Phase 10.3 — "Live Users" (CEO feature). Built on Supabase Realtime
// Presence rather than a polled heartbeat table: no extra table, no
// stale-row cleanup, and "online" means the websocket connection is
// actually live right now, not a guess from a timestamp. Every signed-in
// session (web and mobile alike) tracks one small payload on this single
// shared channel; the CEO's Live Users screen subscribes to the same
// channel and reads presenceState() for the live list.
import { supabase } from './supabaseClient';

export const LIVE_USERS_CHANNEL = 'live-users';

export interface PresencePayload {
  userId: string;
  fullName: string;
  department: string;
  role?: string;
  photo?: string | null;
  loggedInAt: string; // ISO timestamp — "time spent" is derived from this, client-side
}

export function joinLiveUsersChannel(payload: PresencePayload) {
  const channel = supabase.channel(LIVE_USERS_CHANNEL, { config: { presence: { key: payload.userId } } });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(payload);
    }
  });
  return channel;
}
