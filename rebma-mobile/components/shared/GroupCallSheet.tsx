// rebma-mobile/components/shared/GroupCallSheet.tsx
//
// Real, native device-camera/mic group calling — no Jitsi. Used by
// Boardroom's company-wide room and scheduled/instant Meetings. Mesh
// topology: this device opens one direct RTCPeerConnection to every
// other participant currently in the room (lib/webrtcSignaling.ts's
// openRoomChannel tracks who's present and relays each pair's
// signaling, plus every in-meeting feature message below). See that
// file's header for the mesh vs SFU tradeoff.
//
// A real, solid in-meeting feature set, not just "open a call":
// participant list, raise hand, live reactions, pin a participant,
// grid/speaker layout, per-participant connection-quality indicator,
// in-meeting chat (ephemeral — scoped to this call, not saved history),
// self-view hide, meeting timer, copy meeting code, host controls (mute
// all, remove a participant, lock the meeting + a real waiting room,
// local recording with per-participant consent, end meeting for
// everyone).
//
// Waiting room: when locked, a brand-new joiner is held with
// `admitted: false` in this room's presence — every existing peer
// checks that flag before opening a media connection to them at all
// (see connectTo below), so a waiting participant genuinely can't see
// or be seen/heard until the host admits them. Whoever is already in
// the room, not just the host, tells a new joiner the current lock
// state the moment they see them join (`lock-state`) — there's no other
// way for a brand-new joiner to learn it, since `lock` itself is only
// ever broadcast at the instant it's toggled.
//
// Recording: local, on the host's own device (lib/meetingRecording.ts,
// react-native-record-screen) — not a server mixing every participant's
// stream, which this app has no infrastructure for and was never what
// was actually asked for. Starting a recording broadcasts a consent
// request to everyone in the call; only participants who accept are
// shown as consenting (declining doesn't block the host's recording,
// since it's the host's own device doing the capturing and there's no
// way to selectively omit one person's video/audio from a single-device
// screen recording — declining is tracked and visible so it's an
// honest, informed choice, not blocked recording). Gated by the CEO's
// own `meeting_recording_allowed` control-center toggle. The finished
// file is referenced in a new `meeting_recordings` table (not just left
// on the phone with no record of it existing) via
// lib/meetingRecording.ts's uploadRecording().
//
// Breakout rooms: the host assigns everyone (round-robin) to N
// sub-rooms and broadcasts the assignment; each assigned participant
// tears down their main-room peer connections and mounts a *second*
// GroupCallSheet instance on room `${room}-bo-${index}` — reusing this
// same component recursively rather than inventing a parallel call
// mechanism. The main room's Supabase channel stays open the whole
// time (nobody actually leaves it) purely so 'breakout-end' can always
// reach everyone and bring them back.
//
// Shared whiteboard: freehand strokes drawn with the platform's own
// touch-responder system (no gesture-handler dependency, matching this
// project's standing minimal-dependency stance) and broadcast over the
// same signaling channel as everything else here. Ephemeral, like the
// in-meeting chat — no persisted history.
//
// What is deliberately NOT here, and why, stated once as fact rather
// than glossed over: background blur / virtual backgrounds need a
// real-time ML frame-segmentation pipeline sitting in front of the
// camera capture itself (a different capture library entirely —
// react-native-webrtc's getUserMedia has no hook for it), which means a
// new native dependency, a custom dev-client build, and testing on a
// real device — none of which this machine can do (no EAS login, no
// full Xcode). Live captions need a paid cloud speech-to-text account
// (Google/Azure/AWS) with real billing and an API key only the user can
// provision — not something to fabricate or guess at. Noise suppression
// was checked directly against react-native-webrtc's own source (see
// the getUserMedia call below) rather than assumed: its JS layer has no
// constraint for it at all, but the underlying native WebRTC engine
// already runs echo cancellation / noise suppression / auto gain on
// every audio track by default on both platforms — already present,
// nothing to add.
//
// Same honest verification note as NativeCallSheet.tsx: written,
// type-checked, and bundle-verified, but the live multi-peer connection
// and every realtime feature here needs a real device build to confirm
// — this machine can't produce one.
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Svg, { Polyline } from 'react-native-svg';
import type { MediaStream } from 'react-native-webrtc';
import {
  X, Mic, MicOff, SwitchCamera, VideoOff, Video, Users, Hand, Smile,
  Pin, PinOff, LayoutGrid, MessageSquare, Send, Copy, Lock, LockOpen,
  UserX, Volume2, EyeOff, Eye, PhoneOff, Wifi, WifiOff, Circle, PenTool,
  Trash2, Radio,
} from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import StatusCapsule from '../ui/StatusCapsule';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { startLocalRecording, stopLocalRecording, uploadRecording } from '../../lib/meetingRecording';
import { openRoomChannel, ICE_SERVERS, shouldOfferTo, type SignalMessage, type RoomChannel, type RoomPresenceEntry } from '../../lib/webrtcSignaling';

// react-native-webrtc is a native module — its binding isn't present in
// Expo Go. A plain top-level `import` still gets compiled to a `require()`
// that Metro evaluates the instant this file loads, which happens at app
// boot (this file is wired into the Boardroom/Meetings stack, not lazily
// mounted) — so an unguarded import here crashes the whole app in Expo
// Go, not just calling. Guarding it with try/catch means the rest of the
// app (including every other screen) still boots and runs normally; the
// values below just stay undefined until a real dev build provides the
// native module, and any attempt to actually place a call while running
// in Expo Go fails at that point instead of at startup — see
// NativeCallSheet.tsx for the same pattern on the 1:1 call side.
let webrtc: typeof import('react-native-webrtc') | null = null;
try {
  webrtc = require('react-native-webrtc');
} catch {
  webrtc = null;
}
const RTCPeerConnection = webrtc?.RTCPeerConnection as typeof import('react-native-webrtc').RTCPeerConnection;
const RTCIceCandidate = webrtc?.RTCIceCandidate as typeof import('react-native-webrtc').RTCIceCandidate;
const RTCSessionDescription = webrtc?.RTCSessionDescription as typeof import('react-native-webrtc').RTCSessionDescription;
const mediaDevices = webrtc?.mediaDevices as typeof import('react-native-webrtc').mediaDevices;
const RTCView = webrtc?.RTCView as typeof import('react-native-webrtc').RTCView;
// A `const` only binds the value namespace — unlike the class import it
// replaces, it doesn't also give `RTCPeerConnection` a meaning as a TYPE,
// so `Peer.pc: RTCPeerConnection` below would silently fall back to the
// ambient browser DOM lib's (structurally different) RTCPeerConnection
// interface without this. This is what actually keeps every peer's `pc`
// typed as react-native-webrtc's own instance type.
type RTCPeerConnection = InstanceType<typeof import('react-native-webrtc').RTCPeerConnection>;

interface WhiteboardStroke { id: string; from: string; points: { x: number; y: number }[]; color: string; width: number }
const WHITEBOARD_COLORS = ['#f8fafc', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b'];

interface Props {
  room: string;
  title: string;
  meetingId?: string;
  isHost?: boolean;
  /** Set only on a breakout room's own sheet: ends every breakout and
   *  brings everyone back (sent on the main room's channel). */
  onEndBreakouts?: () => void;
  onClose: () => void;
}

interface Peer {
  userId: string;
  fullName: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream | null;
  handRaised: boolean;
  connectionState: 'connecting' | 'connected' | 'poor' | 'lost';
  admitted: boolean;
}

interface ChatMsg { from: string; fromName: string; text: string; at: number }
interface ReactionBubble { id: string; emoji: string; from: string }

const REACTION_SET = ['👍', '❤️', '😂', '👏', '🎉', '😮'];

export default function GroupCallSheet({ room, title, meetingId, isHost = false, onEndBreakouts, onClose }: Props) {
  const t = useTheme();
  const me = useAuthStore((s) => s.profile);
  const myId = me?.id || '';
  const myName = me?.fullName || 'Me';

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [frontCamera, setFrontCamera] = useState(true);
  const [, forceRender] = useState(0);

  // In-meeting feature state
  const [handRaised, setHandRaised] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [selfViewHidden, setSelfViewHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [waitingPanelOpen, setWaitingPanelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [reactions, setReactions] = useState<ReactionBubble[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [removedMessage, setRemovedMessage] = useState<string | null>(null);

  const [waitingRoom, setWaitingRoom] = useState<RoomPresenceEntry[]>([]);
  const [iAmWaiting, setIAmWaiting] = useState(false);

  // Recording
  const [recordingAllowedSetting, setRecordingAllowedSetting] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState(false); // host's own device is actively capturing
  const [hostIsRecording, setHostIsRecording] = useState(false); // anyone's read of "a recording is in progress"
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordConsent, setRecordConsent] = useState<Record<string, boolean>>({}); // host-tracked, userId -> accepted
  const [recordConsentPrompt, setRecordConsentPrompt] = useState<{ from: string; fromName: string } | null>(null);
  const [myRecordConsent, setMyRecordConsent] = useState<boolean | null>(null);
  const recordingStartedAtRef = useRef<string | null>(null);

  // Breakout rooms
  const [breakoutPanelOpen, setBreakoutPanelOpen] = useState(false);
  const [breakoutCount, setBreakoutCount] = useState(2);
  const [myBreakoutIndex, setMyBreakoutIndex] = useState<number | null>(null);
  const inBreakoutRef = useRef(false);

  // Shared whiteboard — strokes are stored/sent in 0..1-normalized
  // coordinates (relative to the drawing surface's own measured size),
  // not raw pixels, so two participants on differently-sized phones
  // still see each other's strokes in the right relative position.
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<WhiteboardStroke[]>([]);
  const [whiteboardColor, setWhiteboardColor] = useState(WHITEBOARD_COLORS[0]);
  const [whiteboardSize, setWhiteboardSize] = useState({ width: 0, height: 0 });
  const currentStrokeRef = useRef<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const lastStrokeSendRef = useRef(0);

  const peersRef = useRef<Map<string, Peer>>(new Map());
  const roomRef = useRef<RoomChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);
  const lockedRef = useRef(false);
  // The host is always admitted; everyone else starts un-admitted and
  // either self-admits (meeting isn't locked) or waits for the host,
  // per the header comment's explanation of how a new joiner learns the
  // lock state at all.
  const admittedRef = useRef(isHost);
  const knownParticipantsRef = useRef<RoomPresenceEntry[]>([]);

  const bump = () => forceRender((n) => n + 1);

  useEffect(() => {
    const iv = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    getCeoSetting('meeting_recording_allowed', true).then(setRecordingAllowedSetting);
  }, []);

  const closePeer = (userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.pc.close();
      peersRef.current.delete(userId);
      if (pinnedUserId === userId) setPinnedUserId(null);
      bump();
    }
  };

  const ensurePeer = (userId: string, fullName: string): Peer => {
    let peer = peersRef.current.get(userId);
    if (peer) return peer;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer = { userId, fullName, pc, remoteStream: null, handRaised: false, connectionState: 'connecting', admitted: true };
    peersRef.current.set(userId, peer);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current as any));
    }

    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) roomRef.current?.send({ type: 'ice-candidate', candidate: event.candidate, from: myId, to: userId });
    };
    (pc as any).ontrack = (event: any) => {
      const p = peersRef.current.get(userId);
      if (p && event.streams?.[0]) { p.remoteStream = event.streams[0]; bump(); }
    };
    (pc as any).onconnectionstatechange = () => {
      const state = (pc as any).connectionState;
      const p = peersRef.current.get(userId);
      if (!p) return;
      if (state === 'connected') p.connectionState = 'connected';
      else if (state === 'disconnected') p.connectionState = 'poor';
      else if (state === 'failed' || state === 'closed') { closePeer(userId); return; }
      bump();
    };

    return peer;
  };

  // The actual waiting-room enforcement: skip connecting entirely to
  // anyone not yet admitted, and skip connecting AT ALL if I'm not
  // admitted myself yet — a waiting participant opens zero peer
  // connections, meaning they genuinely can't see or be seen/heard,
  // not just visually hidden while still streaming.
  const connectTo = async (participant: RoomPresenceEntry) => {
    if (closedRef.current) return;
    if (!admittedRef.current) return;
    if (participant.admitted === false) return;
    // While in a breakout room, this (main-room) instance keeps its
    // channel open only so 'breakout-end' can reach it — it must not
    // reconnect to main-room peers until it's back.
    if (inBreakoutRef.current) return;
    // Only a brand-new connection gets an offer. This runs on every
    // presence update (a raised hand, say), and re-offering each time
    // restarted calls that were already working.
    const isNew = !peersRef.current.has(participant.userId);
    const peer = ensurePeer(participant.userId, participant.fullName);
    peer.fullName = participant.fullName || peer.fullName;
    peer.handRaised = !!participant.handRaised;
    if (isNew && shouldOfferTo(myId, participant.userId)) {
      const offer = await peer.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await peer.pc.setLocalDescription(offer);
      roomRef.current?.send({ type: 'offer', sdp: offer.sdp!, from: myId, to: participant.userId });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const pendingCandidates = new Map<string, any[]>();

    const setup = async () => {
      let stream: MediaStream;
      try {
        // Noise suppression / echo cancellation / auto gain: checked
        // directly against react-native-webrtc's own source before
        // writing this — its getUserMedia's audio constraint type is
        // `boolean | MediaTrackConstraints`, and MediaTrackConstraints
        // here only carries video-shape fields (width/height/frameRate/
        // facingMode/deviceId/groupId), with zero handling anywhere in
        // its native code for echoCancellation/noiseSuppression/
        // autoGainControl keys. There is no JS-level toggle to add. What
        // IS true, and needs no code at all: libwebrtc's own native
        // AudioProcessingModule already runs AEC3 (echo cancellation),
        // noise suppression, and automatic gain control on every audio
        // track by default, unconditionally, on both iOS and Android —
        // this app already has it, for free, via the underlying engine.
        stream = (await mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } })) as unknown as MediaStream;
      } catch {
        return;
      }
      if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const handleSignal = async (msg: SignalMessage) => {
        if (cancelled || closedRef.current) return;

        if (msg.type === 'hangup') { closePeer(msg.from); return; }
        if (msg.type === 'chat') { setChatMessages((prev) => [...prev, { from: msg.from, fromName: msg.fromName, text: msg.text, at: msg.at }]); return; }
        if (msg.type === 'reaction') {
          const id = `${msg.from}-${Date.now()}`;
          setReactions((prev) => [...prev, { id, emoji: msg.emoji, from: msg.from }]);
          setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
          return;
        }
        if (msg.type === 'raise-hand') {
          const p = peersRef.current.get(msg.from);
          if (p) { p.handRaised = msg.raised; bump(); }
          return;
        }
        if (msg.type === 'mute-request') {
          if (!msg.to || msg.to === myId) {
            localStreamRef.current?.getAudioTracks().forEach((tr) => { tr.enabled = false; });
            setMicOn(false);
          }
          return;
        }
        if (msg.type === 'remove') {
          if (msg.to === myId) { setRemovedMessage('The host removed you from this meeting.'); }
          else { closePeer(msg.to); }
          return;
        }
        if (msg.type === 'lock') { lockedRef.current = msg.locked; setLocked(msg.locked); return; }
        if (msg.type === 'end-meeting') { setRemovedMessage('The host ended this meeting for everyone.'); return; }
        if (msg.type === 'lock-state') {
          // Targeted at me by whoever was already here when I joined —
          // the only way I can learn the current lock state (see the
          // header comment: `lock` itself only broadcasts at the moment
          // it's toggled, so a late joiner has no other way to hear it).
          if (!msg.locked) {
            admittedRef.current = true;
            setIAmWaiting(false);
            roomRef.current?.updatePresence({ admitted: true });
          } else if (!isHost) {
            setIAmWaiting(true);
          }
          return;
        }
        if (msg.type === 'admit') {
          admittedRef.current = true;
          setIAmWaiting(false);
          // Re-tracking presence triggers a fresh 'sync' for everyone,
          // including me — that's what actually makes connectTo() start
          // opening peer connections now that admittedRef.current is true.
          roomRef.current?.updatePresence({ admitted: true });
          return;
        }
        if (msg.type === 'deny') {
          setRemovedMessage('The host did not admit you to this meeting.');
          return;
        }
        if (msg.type === 'record-start') {
          setHostIsRecording(true);
          setMyRecordConsent(null);
          if (!isHost) setRecordConsentPrompt({ from: msg.from, fromName: msg.fromName });
          return;
        }
        if (msg.type === 'record-consent') {
          setRecordConsent((prev) => ({ ...prev, [msg.from]: msg.accepted }));
          return;
        }
        if (msg.type === 'record-stop') {
          setHostIsRecording(false);
          setRecordConsentPrompt(null);
          setMyRecordConsent(null);
          return;
        }
        if (msg.type === 'breakout-assign') {
          const idx = msg.assignments[myId];
          if (idx == null) return; // not assigned — stays in the main room
          inBreakoutRef.current = true;
          setMyBreakoutIndex(idx);
          Array.from(peersRef.current.keys()).forEach((id) => closePeer(id));
          return;
        }
        if (msg.type === 'breakout-end') {
          if (inBreakoutRef.current) {
            inBreakoutRef.current = false;
            setMyBreakoutIndex(null);
            knownParticipantsRef.current.forEach((p) => connectTo(p));
          }
          return;
        }
        if (msg.type === 'whiteboard-stroke') {
          setWhiteboardStrokes((prev) => [
            ...prev.filter((s) => s.id !== msg.strokeId),
            { id: msg.strokeId, from: msg.from, points: msg.points, color: msg.color, width: msg.width },
          ]);
          return;
        }
        if (msg.type === 'whiteboard-clear') {
          setWhiteboardStrokes([]);
          return;
        }

        // Media negotiation (offer/answer/ice-candidate) — per-pair. The
        // name comes from presence when we already know the person.
        const knownName = knownParticipantsRef.current.find((p) => p.userId === msg.from)?.fullName;
        const peer = ensurePeer(msg.from, knownName || 'Participant');
        if (msg.type === 'offer') {
          await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
          for (const c of pendingCandidates.get(msg.from) || []) await peer.pc.addIceCandidate(new RTCIceCandidate(c));
          pendingCandidates.delete(msg.from);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          roomRef.current?.send({ type: 'answer', sdp: answer.sdp!, from: myId, to: msg.from });
        } else if (msg.type === 'answer') {
          await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
          for (const c of pendingCandidates.get(msg.from) || []) await peer.pc.addIceCandidate(new RTCIceCandidate(c));
          pendingCandidates.delete(msg.from);
        } else if (msg.type === 'ice-candidate') {
          if (peer.pc.remoteDescription) {
            await peer.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else {
            const list = pendingCandidates.get(msg.from) || [];
            list.push(msg.candidate);
            pendingCandidates.set(msg.from, list);
          }
        }
      };

      // The host tracks presence as already-admitted; everyone else
      // starts un-admitted and only flips to admitted once they've
      // either learned the meeting isn't locked (a 'lock-state' from
      // an existing peer) or been let in by the host ('admit') — see
      // handleSignal above and the header comment.
      const roomChannel = openRoomChannel(room, { userId: myId, fullName: myName, isHost, handRaised: false, admitted: isHost }, handleSignal);
      roomRef.current = roomChannel;
      roomChannel.onPresence((participants) => {
        const liveIds = new Set(participants.map((p) => p.userId));
        for (const existingId of Array.from(peersRef.current.keys())) {
          if (!liveIds.has(existingId)) closePeer(existingId);
        }

        // Nobody who could admit me is in the room: let myself in. Without
        // this a room with no host (the Boardroom, a breakout room, a
        // group chat call the caller has left) never connected anyone,
        // because nobody was ever admitted. Same rule as web.
        if (!admittedRef.current && !participants.some((p) => p.admitted !== false)) {
          admittedRef.current = true;
          setIAmWaiting(false);
          roomChannel.updatePresence({ admitted: true });
        }

        // Inform any genuinely-new joiner of the current lock state, the
        // moment they're first seen — only once I'm admitted myself,
        // since a still-waiting participant has nothing useful to tell.
        if (admittedRef.current) {
          const knownIds = new Set(knownParticipantsRef.current.map((p) => p.userId));
          participants.forEach((p) => {
            if (p.userId !== myId && !knownIds.has(p.userId)) {
              roomRef.current?.send({ type: 'lock-state', from: myId, to: p.userId, locked: lockedRef.current });
            }
          });
        }
        knownParticipantsRef.current = participants;

        setWaitingRoom(participants.filter((p) => p.admitted === false));
        participants.forEach((p) => connectTo(p));
      });

      // Log attendance for this call — a real join timestamp, whether
      // this is a scheduled meeting or an instant one.
      if (meetingId) {
        supabase.from('meeting_attendees').upsert(
          { meeting_id: meetingId, user_id: myId, joined_at: new Date().toISOString(), rsvp_status: 'ACCEPTED' },
          { onConflict: 'meeting_id,user_id' }
        );
      }
    };

    setup();

    return () => {
      cancelled = true;
      closedRef.current = true;
      roomRef.current?.send({ type: 'hangup', from: myId });
      roomRef.current?.close();
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      peersRef.current.forEach((p) => p.pc.close());
      peersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaveCall = () => onClose();

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setMicOn((v) => !v);
  };
  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setCamOn((v) => !v);
  };
  const flipCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0] as any;
    track?._switchCamera?.();
    setFrontCamera((v) => !v);
  };

  const toggleRaiseHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    roomRef.current?.send({ type: 'raise-hand', from: myId, raised: next });
    roomRef.current?.updatePresence({ handRaised: next });
  };

  const sendReaction = (emoji: string) => {
    const id = `${myId}-${Date.now()}`;
    setReactions((prev) => [...prev, { id, emoji, from: myId }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
    roomRef.current?.send({ type: 'reaction', from: myId, emoji });
  };

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    const at = Date.now();
    setChatMessages((prev) => [...prev, { from: myId, fromName: myName, text, at }]);
    roomRef.current?.send({ type: 'chat', from: myId, fromName: myName, text, at });
    setChatDraft('');
  };

  const copyMeetingCode = async () => {
    await Clipboard.setStringAsync(meetingId || room);
    setRemovedMessage(null);
  };

  // Host controls
  const requestMuteAll = () => roomRef.current?.send({ type: 'mute-request', from: myId });
  const removeParticipant = (userId: string) => {
    roomRef.current?.send({ type: 'remove', from: myId, to: userId });
    closePeer(userId);
  };
  const toggleLock = () => {
    const next = !locked;
    lockedRef.current = next;
    setLocked(next);
    roomRef.current?.send({ type: 'lock', from: myId, locked: next });
  };
  const admitParticipant = (userId: string) => {
    roomRef.current?.send({ type: 'admit', from: myId, to: userId });
    setWaitingRoom((prev) => prev.filter((p) => p.userId !== userId));
  };
  const denyParticipant = (userId: string) => {
    roomRef.current?.send({ type: 'deny', from: myId, to: userId });
    setWaitingRoom((prev) => prev.filter((p) => p.userId !== userId));
  };
  const endMeetingForEveryone = async () => {
    roomRef.current?.send({ type: 'end-meeting', from: myId });
    if (meetingId) await supabase.from('meetings').update({ status: 'COMPLETED' }).eq('id', meetingId);
    leaveCall();
  };

  // Recording — host only. Starting broadcasts a consent request to
  // everyone; declining doesn't block the recording (there's no way to
  // selectively omit one person's audio/video from a single-device
  // screen recording), it's just tracked so the choice is honest.
  const startRecordingFlow = async () => {
    if (!recordingAllowedSetting) {
      Alert.alert('Recording Disabled', 'Meeting recording has been turned off in Control Center.');
      return;
    }
    setRecordingBusy(true);
    const res = await startLocalRecording();
    setRecordingBusy(false);
    if (!res.ok) {
      Alert.alert('Could Not Start Recording', res.reason || 'Unknown error.');
      return;
    }
    recordingStartedAtRef.current = new Date().toISOString();
    setRecordConsent({});
    setIsRecording(true);
    setHostIsRecording(true);
    roomRef.current?.send({ type: 'record-start', from: myId, fromName: myName });
  };

  const stopRecordingFlow = async () => {
    setRecordingBusy(true);
    const res = await stopLocalRecording();
    setRecordingBusy(false);
    setIsRecording(false);
    setHostIsRecording(false);
    roomRef.current?.send({ type: 'record-stop', from: myId });
    if (!res.ok || !res.localUri) {
      Alert.alert('Recording Stopped', res.reason || 'The recording could not be saved.');
      return;
    }
    const consented = Object.keys(recordConsent).filter((id) => recordConsent[id]);
    const declined = Object.keys(recordConsent).filter((id) => !recordConsent[id]);
    const up = await uploadRecording({
      meetingId: meetingId || null,
      room,
      hostId: myId,
      hostName: myName,
      localUri: res.localUri,
      consentedUserIds: consented,
      declinedUserIds: declined,
      startedAt: recordingStartedAtRef.current || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    if (!up.ok) Alert.alert('Save Failed', up.error || 'The recording finished but could not be saved.');
    else Alert.alert('Recording Saved', 'The meeting recording has been saved and is available in the database.');
  };

  const respondToRecordConsent = (accepted: boolean) => {
    setMyRecordConsent(accepted);
    setRecordConsentPrompt(null);
    roomRef.current?.send({ type: 'record-consent', from: myId, accepted });
  };

  // Breakout rooms — auto-assigns everyone currently in the call
  // round-robin across `breakoutCount` sub-rooms. Manual per-person
  // reassignment isn't built (a disclosed scope call, not a silent one)
  // — auto-assign is the primary Teams/Zoom flow too.
  const startAutoBreakout = () => {
    const allIds = [myId, ...peersRef.current.keys()];
    const assignments: Record<string, number> = {};
    allIds.forEach((id, i) => { assignments[id] = i % breakoutCount; });
    roomRef.current?.send({ type: 'breakout-assign', from: myId, assignments });
    setBreakoutPanelOpen(false);
    const myIdx = assignments[myId];
    inBreakoutRef.current = true;
    setMyBreakoutIndex(myIdx);
    Array.from(peersRef.current.keys()).forEach((id) => closePeer(id));
  };

  const endBreakoutForEveryone = () => {
    roomRef.current?.send({ type: 'breakout-end', from: myId });
    if (inBreakoutRef.current) {
      inBreakoutRef.current = false;
      setMyBreakoutIndex(null);
      knownParticipantsRef.current.forEach((p) => connectTo(p));
    }
  };

  const returnToMainRoom = () => {
    if (inBreakoutRef.current) {
      inBreakoutRef.current = false;
      setMyBreakoutIndex(null);
      knownParticipantsRef.current.forEach((p) => connectTo(p));
    }
  };

  // Shared whiteboard
  const sendWhiteboardStroke = (points: { x: number; y: number }[], strokeId: string, done: boolean) => {
    roomRef.current?.send({ type: 'whiteboard-stroke', from: myId, strokeId, points, color: whiteboardColor, width: 3, done });
  };
  const clearWhiteboard = () => {
    setWhiteboardStrokes([]);
    roomRef.current?.send({ type: 'whiteboard-clear', from: myId });
  };

  const peers = Array.from(peersRef.current.values());
  const participantCount = peers.length + 1;
  const pinnedPeer = pinnedUserId ? peers.find((p) => p.userId === pinnedUserId) : null;
  const gridPeers = pinnedPeer ? peers.filter((p) => p.userId !== pinnedUserId) : peers;
  const tileWidth = gridPeers.length === 0 ? '100%' : gridPeers.length === 1 && !pinnedPeer ? '100%' : '48%';

  const fmtTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (removedMessage) {
    return (
      <Modal visible animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#0b0b0f', alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl, gap: t.spacing.lg }}>
          <PhoneOff size={40} color="rgba(255,255,255,0.6)" />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff', textAlign: 'center' }}>{removedMessage}</Text>
          <Pressable onPress={onClose} style={{ paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
            <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>OK</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  if (iAmWaiting) {
    return (
      <Modal visible animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#0b0b0f', alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl, gap: t.spacing.lg }}>
          {localStream && camOn ? (
            <View style={{ width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: '#1a1a22' }}>
              <RTCView streamURL={(localStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" mirror={frontCamera} />
            </View>
          ) : (
            <Lock size={40} color="rgba(255,255,255,0.6)" />
          )}
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff', textAlign: 'center' }}>Waiting for the host to let you in</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{title} is locked right now. You'll join automatically once admitted.</Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <Pressable onPress={toggleMic} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {micOn ? <Mic size={18} color="#fff" /> : <MicOff size={18} color="#0b0b0f" />}
            </Pressable>
            <Pressable onPress={toggleCamera} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: camOn ? 'rgba(255,255,255,0.15)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {camOn ? <Video size={18} color="#fff" /> : <VideoOff size={18} color="#0b0b0f" />}
            </Pressable>
          </View>
          <Pressable onPress={leaveCall} style={{ paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>Leave</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  // While assigned to a breakout, this main-room instance stays mounted
  // (its channel needs to keep listening for 'breakout-end') but renders
  // only a second, nested GroupCallSheet for the sub-room — its own
  // `onClose` naturally means "return to main room" here, not "leave the
  // meeting", since leaving the whole meeting is only ever done from the
  // main instance's own Leave button.
  if (myBreakoutIndex != null) {
    return (
      <GroupCallSheet
        room={`${room}-bo-${myBreakoutIndex}`}
        title={`${title}, Breakout ${myBreakoutIndex + 1}`}
        isHost={isHost}
        onEndBreakouts={isHost ? endBreakoutForEveryone : undefined}
        onClose={returnToMainRoom}
      />
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={leaveCall}>
      <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Users size={13} color="rgba(255,255,255,0.7)" />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>{title} · {participantCount}</Text>
                {locked && <Lock size={12} color="#f59e0b" />}
              </View>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: 'rgba(255,255,255,0.6)' }}>{fmtTimer(elapsedSeconds)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Pressable onPress={copyMeetingCode} hitSlop={8} style={{ padding: t.spacing.xs, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <Copy size={16} color="#fff" />
              </Pressable>
              <Pressable onPress={leaveCall} hitSlop={8} style={{ padding: t.spacing.xs, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <X size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Live recording status — the iOS widget-style floating
              capsule primitive, not squeezed into the title row */}
          {hostIsRecording && (
            <View pointerEvents="none" style={{ alignItems: 'center', marginBottom: t.spacing.sm }}>
              <StatusCapsule
                icon={<Circle size={9} color="#ef4444" fill="#ef4444" />}
                label="Recording"
                sublabel={fmtTimer(elapsedSeconds)}
                dotColor="#ef4444"
              />
            </View>
          )}

          {/* Reaction bubbles float up from the bottom */}
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', gap: 4 }}>
            {reactions.map((r) => (
              <Text key={r.id} style={{ fontSize: 28 }}>{r.emoji}</Text>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 6 }}>
            {pinnedPeer && (
              <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a22' }}>
                {pinnedPeer.remoteStream ? (
                  <RTCView streamURL={(pinnedPeer.remoteStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: t.font.medium, color: 'rgba(255,255,255,0.6)' }}>Connecting…</Text>
                  </View>
                )}
                <Pressable onPress={() => setPinnedUserId(null)} style={{ position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <PinOff size={14} color="#fff" />
                </Pressable>
              </View>
            )}

            {!selfViewHidden && (
              <View style={{ width: pinnedPeer ? '48%' : tileWidth, aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a22' }}>
                {localStream && camOn ? (
                  <RTCView streamURL={(localStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" mirror={frontCamera} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>{myName} (You)</Text>
                  </View>
                )}
                {handRaised && <View style={{ position: 'absolute', top: 6, left: 6, padding: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)' }}><Hand size={13} color="#f59e0b" /></View>}
              </View>
            )}

            {gridPeers.map((peer) => (
              <Pressable
                key={peer.userId}
                onLongPress={() => setPinnedUserId(peer.userId)}
                style={{ width: pinnedPeer ? '48%' : tileWidth, aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a22' }}
              >
                {peer.remoteStream ? (
                  <RTCView streamURL={(peer.remoteStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.6)' }}>Connecting…</Text>
                  </View>
                )}
                <View style={{ position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 6 }} numberOfLines={1}>{peer.fullName}</Text>
                  {peer.connectionState === 'connected' ? <Wifi size={11} color="#22c55e" /> : peer.connectionState === 'poor' ? <WifiOff size={11} color="#f59e0b" /> : null}
                </View>
                {peer.handRaised && <View style={{ position: 'absolute', top: 6, left: 6, padding: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)' }}><Hand size={13} color="#f59e0b" /></View>}
                {isHost && (
                  <Pressable onPress={() => removeParticipant(peer.userId)} style={{ position: 'absolute', top: 6, right: 6, padding: 5, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.85)' }}>
                    <UserX size={12} color="#fff" />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: t.spacing.md, paddingVertical: t.spacing.lg }}>
            <Pressable onPress={toggleMic} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {micOn ? <Mic size={18} color="#fff" /> : <MicOff size={18} color="#0b0b0f" />}
            </Pressable>
            <Pressable onPress={toggleCamera} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: camOn ? 'rgba(255,255,255,0.15)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {camOn ? <Video size={18} color="#fff" /> : <VideoOff size={18} color="#0b0b0f" />}
            </Pressable>
            <Pressable onPress={flipCamera} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <SwitchCamera size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={toggleRaiseHand} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: handRaised ? '#f59e0b' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Hand size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => sendReaction(REACTION_SET[Math.floor(Math.random() * REACTION_SET.length)])} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Smile size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setSelfViewHidden((v) => !v)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              {selfViewHidden ? <Eye size={18} color="#fff" /> : <EyeOff size={18} color="#fff" />}
            </Pressable>
            <Pressable onPress={() => setParticipantsOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setChatOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setWhiteboardOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <PenTool size={18} color="#fff" />
            </Pressable>
            {isHost && (
              <Pressable onPress={toggleLock} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: locked ? '#f59e0b' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                {locked ? <Lock size={18} color="#fff" /> : <LockOpen size={18} color="#fff" />}
              </Pressable>
            )}
            {isHost && (
              <Pressable
                onPress={isRecording ? stopRecordingFlow : startRecordingFlow}
                disabled={recordingBusy}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isRecording ? '#ef4444' : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', opacity: recordingBusy ? 0.6 : 1 }}
              >
                <Circle size={18} color="#fff" fill={isRecording ? '#fff' : 'transparent'} />
              </Pressable>
            )}
            {isHost && (
              <Pressable onPress={() => setBreakoutPanelOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <LayoutGrid size={18} color="#fff" />
              </Pressable>
            )}
            {isHost && waitingRoom.length > 0 && (
              <Pressable onPress={() => setWaitingPanelOpen(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} color="#fff" />
                <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: 9, color: '#fff' }}>{waitingRoom.length}</Text>
                </View>
              </Pressable>
            )}
            {isHost && (
              <Pressable onPress={requestMuteAll} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Volume2 size={18} color="#fff" />
              </Pressable>
            )}
            <Pressable onPress={isHost ? endMeetingForEveryone : leaveCall} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOff size={22} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Participants panel */}
        {participantsOpen && (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '78%', backgroundColor: '#15151c', padding: t.spacing.lg }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.md }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>Participants ({participantCount})</Text>
                <Pressable onPress={() => setParticipantsOpen(false)}><X size={18} color="#fff" /></Pressable>
              </View>
              <ScrollView style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: t.spacing.sm }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: '#fff' }}>{myName} (You)</Text>
                  {micOn ? <Mic size={14} color="rgba(255,255,255,0.6)" /> : <MicOff size={14} color="#ef4444" />}
                </View>
                {peers.map((peer) => (
                  <View key={peer.userId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: t.spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: '#fff' }}>{peer.fullName}</Text>
                      {peer.handRaised && <Hand size={13} color="#f59e0b" />}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                      {isHost && isRecording && recordConsent[peer.userId] !== undefined && (
                        <Text style={{ fontFamily: t.font.semibold, fontSize: 9, color: recordConsent[peer.userId] ? '#22c55e' : '#f59e0b' }}>
                          {recordConsent[peer.userId] ? 'Consented' : 'Declined'}
                        </Text>
                      )}
                      <Pressable onPress={() => setPinnedUserId(pinnedUserId === peer.userId ? null : peer.userId)}>
                        <Pin size={14} color={pinnedUserId === peer.userId ? t.colors.accent : 'rgba(255,255,255,0.6)'} />
                      </Pressable>
                      {isHost && (
                        <Pressable onPress={() => removeParticipant(peer.userId)}>
                          <UserX size={14} color="#ef4444" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        )}

        {/* Waiting room — host-only, admits or denies each held joiner */}
        {waitingPanelOpen && (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '78%', backgroundColor: '#15151c', padding: t.spacing.lg }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.md }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>Waiting Room ({waitingRoom.length})</Text>
                <Pressable onPress={() => setWaitingPanelOpen(false)}><X size={18} color="#fff" /></Pressable>
              </View>
              <ScrollView style={{ flex: 1 }}>
                {waitingRoom.length === 0 && (
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.5)', marginTop: t.spacing.xl, textAlign: 'center' }}>No one is waiting.</Text>
                )}
                {waitingRoom.map((p) => (
                  <View key={p.userId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: '#fff' }} numberOfLines={1}>{p.fullName}</Text>
                    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                      <Pressable onPress={() => admitParticipant(p.userId)} style={{ paddingHorizontal: t.spacing.md, paddingVertical: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
                        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: '#fff' }}>Admit</Text>
                      </Pressable>
                      <Pressable onPress={() => denyParticipant(p.userId)} style={{ paddingHorizontal: t.spacing.md, paddingVertical: 6, borderRadius: t.radius.pill, backgroundColor: 'rgba(239,68,68,0.85)' }}>
                        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: '#fff' }}>Deny</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        )}

        {/* In-meeting chat — ephemeral, scoped to people currently in this call */}
        {chatOpen && (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '85%', backgroundColor: '#15151c' }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: t.spacing.lg }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>Meeting Chat</Text>
                <Pressable onPress={() => setChatOpen(false)}><X size={18} color="#fff" /></Pressable>
              </View>
              <ScrollView style={{ flex: 1, paddingHorizontal: t.spacing.lg }}>
                {chatMessages.length === 0 && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: t.spacing.xl }}>No messages yet. Not saved after the call ends.</Text>}
                {chatMessages.map((m, i) => (
                  <View key={i} style={{ marginBottom: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: 'rgba(255,255,255,0.6)' }}>{m.from === myId ? 'You' : m.fromName}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: '#fff' }}>{m.text}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, padding: t.spacing.lg }}>
                <TextInput
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder="Message everyone…"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  onSubmitEditing={sendChat}
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm, color: '#fff' }}
                />
                <Pressable onPress={sendChat} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={16} color="#fff" />
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        )}

        {/* Recording consent — a real accept/decline captured and shown
            to the host, not a gate on the recording itself (see the
            header comment for why declining can't block it). */}
        {recordConsentPrompt && (
          <View style={{ position: 'absolute', top: 90, left: t.spacing.lg, right: t.spacing.lg, backgroundColor: '#1f1f28', borderRadius: t.radius.lg, padding: t.spacing.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: t.spacing.sm }}>
              <Circle size={9} color="#ef4444" fill="#ef4444" />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: '#fff' }}>{recordConsentPrompt.fromName} started recording this meeting</Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.7)', marginBottom: t.spacing.md }}>
              Do you consent to being recorded? Declining is honored on the record but does not stop the host's recording.
            </Text>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Pressable onPress={() => respondToRecordConsent(true)} style={{ flex: 1, paddingVertical: t.spacing.sm, borderRadius: t.radius.pill, backgroundColor: t.colors.accent, alignItems: 'center' }}>
                <Text style={{ fontFamily: t.font.bold, color: '#fff', fontSize: t.type.meta11.size }}>Accept</Text>
              </Pressable>
              <Pressable onPress={() => respondToRecordConsent(false)} style={{ flex: 1, paddingVertical: t.spacing.sm, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' }}>
                <Text style={{ fontFamily: t.font.bold, color: '#fff', fontSize: t.type.meta11.size }}>Decline</Text>
              </Pressable>
            </View>
          </View>
        )}
        {myRecordConsent != null && !recordConsentPrompt && (
          <View style={{ position: 'absolute', top: 90, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: t.spacing.md, paddingVertical: 6, borderRadius: t.radius.pill }}>
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: myRecordConsent ? '#22c55e' : '#f59e0b' }}>
              {myRecordConsent ? 'You consented to being recorded' : 'You declined to be recorded'}
            </Text>
          </View>
        )}

        {/* Breakout rooms — host-only config, auto-assigns everyone
            round-robin. See startAutoBreakout()'s comment for why manual
            per-person assignment isn't offered here. */}
        {breakoutPanelOpen && (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '78%', backgroundColor: '#15151c', padding: t.spacing.lg }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.lg }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>Breakout Rooms</Text>
                <Pressable onPress={() => setBreakoutPanelOpen(false)}><X size={18} color="#fff" /></Pressable>
              </View>
              {onEndBreakouts ? (
                <>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.6)', marginBottom: t.spacing.lg }}>
                    You're in a breakout room. Ending breakouts brings everyone back to the main meeting.
                  </Text>
                  <Pressable onPress={onEndBreakouts} style={{ paddingVertical: t.spacing.md, borderRadius: t.radius.pill, backgroundColor: '#ef4444', alignItems: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>End Breakout Rooms for Everyone</Text>
                  </Pressable>
                </>
              ) : myBreakoutIndex == null ? (
                <>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.6)', marginBottom: t.spacing.lg }}>
                    Splits everyone currently in the call evenly across the rooms below. Each breakout is a real, separate call, you can float between them.
                  </Text>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: 'rgba(255,255,255,0.6)', marginBottom: t.spacing.sm }}>Number of Rooms</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.xl }}>
                    <Pressable onPress={() => setBreakoutCount((n) => Math.max(2, n - 1))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: t.font.bold, color: '#fff', fontSize: 18 }}>–</Text>
                    </Pressable>
                    <Text style={{ fontFamily: t.font.bold, color: '#fff', fontSize: t.type.body14.size, minWidth: 24, textAlign: 'center' }}>{breakoutCount}</Text>
                    <Pressable onPress={() => setBreakoutCount((n) => Math.min(8, n + 1))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: t.font.bold, color: '#fff', fontSize: 18 }}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable onPress={startAutoBreakout} style={{ paddingVertical: t.spacing.md, borderRadius: t.radius.pill, backgroundColor: t.colors.accent, alignItems: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>Auto-Assign & Start</Text>
                  </Pressable>
                  {/* People can still be in breakouts after the host comes
                      back, so ending them is offered here too (as on web). */}
                  <Pressable onPress={endBreakoutForEveryone} style={{ marginTop: t.spacing.md, paddingVertical: t.spacing.md, borderRadius: t.radius.pill, backgroundColor: '#ef4444', alignItems: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>End Breakout Rooms for Everyone</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={endBreakoutForEveryone} style={{ paddingVertical: t.spacing.md, borderRadius: t.radius.pill, backgroundColor: '#ef4444', alignItems: 'center' }}>
                  <Text style={{ fontFamily: t.font.bold, color: '#fff' }}>End Breakout Rooms for Everyone</Text>
                </Pressable>
              )}
            </SafeAreaView>
          </View>
        )}

        {/* Shared whiteboard — freehand strokes, broadcast over the same
            signaling channel as everything else here; ephemeral, no
            persisted history (matches the in-meeting chat). */}
        {whiteboardOpen && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0b0b0f' }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>Whiteboard</Text>
                <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                  <Pressable onPress={clearWhiteboard} hitSlop={8}><Trash2 size={18} color="#fff" /></Pressable>
                  <Pressable onPress={() => setWhiteboardOpen(false)} hitSlop={8}><X size={18} color="#fff" /></Pressable>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm }}>
                {WHITEBOARD_COLORS.map((c) => (
                  <Pressable key={c} onPress={() => setWhiteboardColor(c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: whiteboardColor === c ? 2 : 0, borderColor: '#fff' }} />
                ))}
              </View>
              <View
                style={{ flex: 1, backgroundColor: '#15151c' }}
                onLayout={(e) => setWhiteboardSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                onStartShouldSetResponder={() => whiteboardSize.width > 0}
                onResponderGrant={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  currentStrokeRef.current = { id: `${myId}-${Date.now()}`, points: [{ x: locationX / whiteboardSize.width, y: locationY / whiteboardSize.height }] };
                  lastStrokeSendRef.current = 0;
                  bump();
                }}
                onResponderMove={(e) => {
                  const stroke = currentStrokeRef.current;
                  if (!stroke) return;
                  const { locationX, locationY } = e.nativeEvent;
                  stroke.points.push({ x: locationX / whiteboardSize.width, y: locationY / whiteboardSize.height });
                  bump();
                  const now = Date.now();
                  if (now - lastStrokeSendRef.current > 60) {
                    lastStrokeSendRef.current = now;
                    sendWhiteboardStroke(stroke.points, stroke.id, false);
                  }
                }}
                onResponderRelease={() => {
                  const stroke = currentStrokeRef.current;
                  if (!stroke) return;
                  sendWhiteboardStroke(stroke.points, stroke.id, true);
                  setWhiteboardStrokes((prev) => [...prev.filter((s) => s.id !== stroke.id), { id: stroke.id, from: myId, points: stroke.points, color: whiteboardColor, width: 3 }]);
                  currentStrokeRef.current = null;
                }}
              >
                {whiteboardSize.width > 0 && (
                  <Svg style={{ flex: 1 }}>
                    {whiteboardStrokes.map((s) => (
                      <Polyline
                        key={s.id}
                        points={s.points.map((p) => `${p.x * whiteboardSize.width},${p.y * whiteboardSize.height}`).join(' ')}
                        stroke={s.color}
                        strokeWidth={s.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {currentStrokeRef.current && (
                      <Polyline
                        points={currentStrokeRef.current.points.map((p) => `${p.x * whiteboardSize.width},${p.y * whiteboardSize.height}`).join(' ')}
                        stroke={whiteboardColor}
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </Svg>
                )}
              </View>
            </SafeAreaView>
          </View>
        )}
      </View>
    </Modal>
  );
}
