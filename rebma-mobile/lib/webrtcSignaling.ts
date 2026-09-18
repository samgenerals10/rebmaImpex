// rebma-mobile/lib/webrtcSignaling.ts
//
// Real, native device-camera/mic calling — no Jitsi, anywhere in the
// app. Two shapes of call, both built on the same primitive:
//   - 1:1 (Viber DMs): fixed offerer/answerer roles, one peer connection.
//   - Group (Boardroom's company room, scheduled Meetings): a mesh —
//     every participant opens one direct peer connection to every other
//     participant. No relay/SFU server needed for this; a mesh is a
//     real, standard WebRTC topology for small groups, it just means
//     each device sends/receives its stream once per other participant
//     instead of once total. Fine for a handful of people in a meeting;
//     it does NOT scale to a large broadcast audience the way a real SFU
//     would — stated once, honestly, not as a reason not to build it.
//
// Signaling (both shapes) rides on one Supabase Realtime channel per
// call room, combining presence (who's here right now) with broadcast
// (the actual offer/answer/ICE messages) — the same mechanism this app
// already uses everywhere else for realtime, no separate signaling
// server to stand up.
//
// STUN-only, no TURN server — see the practical implication below,
// same as before: most direct connections will succeed; some strict-NAT
// combinations may not, and fixing that needs a TURN relay, which is
// infrastructure to provision deliberately, not something this file can
// manufacture on its own.
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SignalMessage =
  | { type: 'offer'; sdp: string; from: string; to: string }
  | { type: 'answer'; sdp: string; from: string; to: string }
  | { type: 'ice-candidate'; candidate: any; from: string; to: string }
  | { type: 'hangup'; from: string; to?: string }
  // In-meeting features, GroupCallSheet.tsx — all relayed the same way
  // the media-negotiation messages are, over the same room channel:
  | { type: 'chat'; from: string; fromName: string; text: string; at: number }
  | { type: 'reaction'; from: string; emoji: string }
  | { type: 'raise-hand'; from: string; raised: boolean }
  | { type: 'mute-request'; from: string; to?: string } // host asks everyone (or one person) to mute
  | { type: 'remove'; from: string; to: string } // host ends one participant's connection
  | { type: 'lock'; from: string; locked: boolean }
  | { type: 'end-meeting'; from: string }
  // Waiting room: sent by whoever is already in the room to a brand-new
  // joiner, so they immediately learn the current lock state (there's no
  // other way for a new joiner to know it — 'lock' is only ever
  // broadcast at the moment it's toggled). Sent by the host to a waiting
  // participant once let in.
  | { type: 'lock-state'; from: string; to: string; locked: boolean }
  | { type: 'admit'; from: string; to: string }
  | { type: 'deny'; from: string; to: string }
  // Local host-device recording: a consent broadcast, not a media
  // negotiation — see GroupCallSheet.tsx's header comment. Declining
  // doesn't block the host's own-device recording (there's no way to
  // selectively omit one person's video/audio from a single-device
  // screen recording); it's tracked so the choice is honest, not hidden.
  | { type: 'record-start'; from: string; fromName: string }
  | { type: 'record-consent'; from: string; accepted: boolean }
  | { type: 'record-stop'; from: string }
  // Breakout rooms: the host assigns each participant (by userId) to a
  // 0-based breakout index; anyone left out of the map stays in the
  // main room. Reusing the mesh's own room-per-Supabase-channel
  // mechanism — a breakout is just another GroupCallSheet instance on
  // room `${mainRoom}-bo-${index}`, layered on top while the main
  // room's peer connections are torn down (not the main room's channel,
  // which stays open so 'breakout-end' can always reach everyone).
  | { type: 'breakout-assign'; from: string; assignments: Record<string, number> }
  | { type: 'breakout-end'; from: string }
  // Shared whiteboard: broadcast-only, no persisted history (matches
  // this app's existing ephemeral in-meeting chat) — `done` marks a
  // stroke as finished so recipients stop treating it as still live.
  | { type: 'whiteboard-stroke'; from: string; strokeId: string; points: { x: number; y: number }[]; color: string; width: number; done: boolean }
  | { type: 'whiteboard-clear'; from: string };

export interface RoomPresenceEntry {
  userId: string;
  fullName: string;
  isHost?: boolean;
  handRaised?: boolean;
  admitted?: boolean;
}

export interface RoomChannel {
  send: (msg: SignalMessage) => void;
  /** Fires whenever the live participant list changes (join/leave, or a
   * field like handRaised/admitted being updated via updatePresence). */
  onPresence: (cb: (participants: RoomPresenceEntry[]) => void) => void;
  /** Re-track this device's own presence entry with updated fields (hand
   * raised, admitted into a locked/waiting-room meeting, etc). */
  updatePresence: (patch: Partial<RoomPresenceEntry>) => void;
  close: () => void;
}

// One dedicated channel per call room, separate from the app's other
// realtime channels (the global presence channel, chat). `me` is tracked
// into this room's own presence state so everyone else sees us join/leave.
export function openRoomChannel(room: string, me: RoomPresenceEntry, onSignal: (msg: SignalMessage) => void): RoomChannel {
  const channel: RealtimeChannel = supabase.channel(`webrtc-call-${room}`, {
    config: { broadcast: { self: false }, presence: { key: me.userId } },
  });

  const presenceListeners = new Set<(participants: RoomPresenceEntry[]) => void>();
  const computeParticipants = () => {
    const state = channel.presenceState<RoomPresenceEntry>();
    const all = Object.values(state).flat().filter(Boolean) as unknown as RoomPresenceEntry[];
    return all.filter((p) => p.userId !== me.userId);
  };

  channel.on('broadcast', { event: 'signal' }, (payload) => {
    const msg = payload.payload as SignalMessage;
    const to = 'to' in msg ? msg.to : undefined;
    if (to && to !== me.userId) return; // targeted at someone else in this room
    onSignal(msg);
  });

  channel.on('presence', { event: 'sync' }, () => {
    const participants = computeParticipants();
    presenceListeners.forEach((cb) => cb(participants));
  });

  let currentMe: RoomPresenceEntry = { ...me };

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(currentMe);
    }
  });

  return {
    send: (msg: SignalMessage) => {
      channel.send({ type: 'broadcast', event: 'signal', payload: msg });
    },
    onPresence: (cb) => {
      presenceListeners.add(cb);
    },
    updatePresence: (patch) => {
      currentMe = { ...currentMe, ...patch };
      channel.track(currentMe);
    },
    close: () => {
      supabase.removeChannel(channel);
    },
  };
}

// Free public STUN (address-discovery only, no relay/TURN — see the file
// header for exactly what that means in practice).
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Deterministic tie-breaker for who initiates the offer in a pair, so
// two peers can never both try to offer at once: the lexicographically
// smaller user id always offers to the larger one. Works the same way
// whether it's the 1:1 case (still used there, replacing the old fixed
// caller/joiner role split) or one pair inside a larger mesh.
export function shouldOfferTo(myId: string, otherId: string): boolean {
  return myId < otherId;
}
