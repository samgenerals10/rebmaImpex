// rebma-mobile/lib/presence.ts
// Ports: rebma-web/src/lib/presence.ts — Phase 10.3, "Live Users."
//
// Bug fix (found live in production, web side — same bug exists here):
// a SEPARATE supabase.channel('live-users') was opened per caller (once
// when a session tracks itself in AppShell.tsx, again whenever the Live
// Users screen mounted). Supabase's realtime client dedupes channels by
// topic name — a second `.channel()` call with the same name returns the
// SAME already-subscribed channel object, and calling `.on()` on an
// already-subscribed channel throws, crashing the app. Fixed the same
// way as web: a single module-level singleton channel, shared by every
// caller — trackers call joinLiveUsersChannel(), the Live Users screen
// calls subscribeToLiveUsers(), neither ever opens a second channel.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export const LIVE_USERS_CHANNEL = 'live-users';

export interface PresencePayload {
  userId: string;
  fullName: string;
  department: string;
  role?: string;
  photo?: string | null;
  loggedInAt: string;
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

export function joinLiveUsersChannel(payload: PresencePayload): RealtimeChannel {
  const ch = getSharedChannel();
  if (subscribed) {
    ch.track(payload);
  } else {
    pendingTrack = payload;
  }
  return ch;
}

export function subscribeToLiveUsers(listener: (users: PresencePayload[]) => void): () => void {
  getSharedChannel();
  listeners.add(listener);
  listener(currentUsers);
  return () => { listeners.delete(listener); };
}

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
