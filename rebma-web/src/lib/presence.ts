// rebma-web/src/lib/presence.ts
//
// Phase 10.3 — "Live Users" (CEO feature). Built on Supabase Realtime
// Presence rather than a polled heartbeat table: no extra table, no
// stale-row cleanup, and "online" means the websocket connection is
// actually live right now, not a guess from a timestamp.
//
// Bug fix: this used to open a SEPARATE `supabase.channel('live-users')`
// for every caller (once when a session tracks itself in App.tsx, again
// whenever LiveUsersView mounted). Supabase's realtime client dedupes
// channels by topic name — a second `.channel()` call with the same name
// returns the SAME already-subscribed channel object, and calling `.on()`
// on an already-subscribed channel throws ("cannot add presence
// callbacks... after subscribe()"), crashing the whole app. Fixed by
// making the channel a single module-level singleton: created and
// subscribed exactly once, with every caller sharing it — trackers call
// joinLiveUsersChannel(), listeners (the Live Users screen) call
// subscribeToLiveUsers(), neither ever creates a second channel.
import type { RealtimeChannel } from '@supabase/supabase-js';
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

let channel: RealtimeChannel | null = null;
let subscribed = false;
let currentUsers: PresencePayload[] = [];
let pendingTrack: PresencePayload | null = null;
const listeners = new Set<(users: PresencePayload[]) => void>();

function getSharedChannel(): RealtimeChannel {
  if (channel) return channel;

  channel = supabase.channel(LIVE_USERS_CHANNEL);
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel!.presenceState<PresencePayload>();
    currentUsers = Object.values(state).flat().filter(Boolean) as unknown as PresencePayload[];
    listeners.forEach((l) => l(currentUsers));
  });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      if (pendingTrack) {
        await channel!.track(pendingTrack);
        pendingTrack = null;
      }
    }
  });

  return channel;
}

// Called once per signed-in session (web App.tsx, mobile AppShell.tsx) to
// announce "this user is online." Safe to call even before the shared
// channel has finished subscribing — the track is queued and sent the
// moment it's ready.
export function joinLiveUsersChannel(payload: PresencePayload): RealtimeChannel {
  const ch = getSharedChannel();
  if (subscribed) {
    ch.track(payload);
  } else {
    pendingTrack = payload;
  }
  return ch;
}

// Called by the CEO's Live Users screen to read the live list — never
// opens its own channel, just listens on the shared one.
export function subscribeToLiveUsers(listener: (users: PresencePayload[]) => void): () => void {
  getSharedChannel();
  listeners.add(listener);
  listener(currentUsers);
  return () => { listeners.delete(listener); };
}

// Called on sign-out to actually tear down the shared connection and
// reset the module state, so a later sign-in starts a clean channel.
export function leaveLiveUsersChannel() {
  if (channel) {
    channel.unsubscribe();
  }
  channel = null;
  subscribed = false;
  currentUsers = [];
  pendingTrack = null;
  listeners.clear();
}
