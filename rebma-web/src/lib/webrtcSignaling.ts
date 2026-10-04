// rebma-web/src/lib/webrtcSignaling.ts
//
// Web twin of rebma-mobile/lib/webrtcSignaling.ts. Calls used to be a
// Jitsi page on web and native WebRTC on the phone, so a web user and a
// phone user could never be in the same call. Web now speaks the exact
// same protocol: the same Supabase Realtime channel per room
// (`webrtc-call-${room}`), the same presence fields, and the same signal
// messages. Keep the two files in step: any message added on one side
// must be added on the other, or the two apps stop understanding each
// other mid-call.
//
// Same limits as the phone: a mesh (each person connects directly to each
// other person, fine for a small meeting, not a big broadcast) and
// STUN only, no TURN relay, so a few strict networks may not connect.
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SignalMessage =
  | { type: 'offer'; sdp: string; from: string; to: string }
  | { type: 'answer'; sdp: string; from: string; to: string }
  | { type: 'ice-candidate'; candidate: any; from: string; to: string }
  | { type: 'hangup'; from: string; to?: string }
  | { type: 'chat'; from: string; fromName: string; text: string; at: number }
  | { type: 'reaction'; from: string; emoji: string }
  | { type: 'raise-hand'; from: string; raised: boolean }
  | { type: 'mute-request'; from: string; to?: string }
  | { type: 'remove'; from: string; to: string }
  | { type: 'lock'; from: string; locked: boolean }
  | { type: 'end-meeting'; from: string }
  | { type: 'lock-state'; from: string; to: string; locked: boolean }
  | { type: 'admit'; from: string; to: string }
  | { type: 'deny'; from: string; to: string }
  | { type: 'record-start'; from: string; fromName: string }
  | { type: 'record-consent'; from: string; accepted: boolean }
  | { type: 'record-stop'; from: string }
  | { type: 'breakout-assign'; from: string; assignments: Record<string, number> }
  | { type: 'breakout-end'; from: string }
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
  onPresence: (cb: (participants: RoomPresenceEntry[]) => void) => void;
  updatePresence: (patch: Partial<RoomPresenceEntry>) => void;
  close: () => void;
}

export function openRoomChannel(room: string, me: RoomPresenceEntry, onSignal: (msg: SignalMessage) => void): RoomChannel {
  const channel: RealtimeChannel = supabase.channel(`webrtc-call-${room}`, {
    config: { broadcast: { self: false }, presence: { key: me.userId } },
  });

  const presenceListeners = new Set<(participants: RoomPresenceEntry[]) => void>();
  const computeParticipants = () => {
    const state = channel.presenceState<RoomPresenceEntry>();
    const all = Object.values(state).flat().filter(Boolean) as unknown as RoomPresenceEntry[];
    // One entry per person, even if they have the room open twice.
    const byId = new Map<string, RoomPresenceEntry>();
    all.forEach((p) => { if (p.userId !== me.userId) byId.set(p.userId, p); });
    return Array.from(byId.values());
  };

  channel.on('broadcast', { event: 'signal' }, (payload) => {
    const msg = payload.payload as SignalMessage;
    const to = 'to' in msg ? msg.to : undefined;
    if (to && to !== me.userId) return;
    onSignal(msg);
  });

  channel.on('presence', { event: 'sync' }, () => {
    const participants = computeParticipants();
    presenceListeners.forEach((cb) => cb(participants));
  });

  let currentMe: RoomPresenceEntry = { ...me };

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track(currentMe);
  });

  return {
    send: (msg) => { channel.send({ type: 'broadcast', event: 'signal', payload: msg }); },
    onPresence: (cb) => { presenceListeners.add(cb); },
    updatePresence: (patch) => { currentMe = { ...currentMe, ...patch }; channel.track(currentMe); },
    close: () => { supabase.removeChannel(channel); },
  };
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// The person with the smaller user id always sends the offer, on both
// apps, so two people never both try to start the same connection.
export function shouldOfferTo(myId: string, otherId: string): boolean {
  return myId < otherId;
}

// A browser ICE candidate has to be turned into plain data before it can
// go over the channel; the phone sends plain data already.
export function candidateToJson(candidate: RTCIceCandidate): RTCIceCandidateInit {
  return typeof (candidate as any).toJSON === 'function'
    ? candidate.toJSON()
    : { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex };
}
