// rebma-mobile/lib/presence.ts
// Ports: rebma-web/src/lib/presence.ts — Phase 10.3, "Live Users". Same
// shared Realtime Presence channel web tracks on; a session on either
// platform shows up identically in the CEO's Live Users list.
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

export function joinLiveUsersChannel(payload: PresencePayload) {
  const channel = supabase.channel(LIVE_USERS_CHANNEL, { config: { presence: { key: payload.userId } } });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(payload);
    }
  });
  return channel;
}
