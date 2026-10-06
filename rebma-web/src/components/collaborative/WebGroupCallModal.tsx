// rebma-web/src/components/collaborative/WebGroupCallModal.tsx
//
// Group voice/video call on web (Boardroom room, Meetings, group chats),
// in the browser's own WebRTC. Replaces the Jitsi page so web and phone
// users join the same call: this speaks the same protocol as
// rebma-mobile/components/shared/GroupCallSheet.tsx, message for message
// (lib/webrtcSignaling.ts). Everyone connects directly to everyone else
// (a mesh), which suits a small meeting.
//
// Same in-meeting features as the phone: participant list, raise hand,
// reactions, pin a person, in-call chat (not saved after the call),
// hide self view, timer, copy meeting code, shared whiteboard, and host
// controls (mute everyone, remove someone, lock the meeting with a
// waiting room, breakout rooms, end the meeting for everyone). When a
// phone host records, web users get the same consent request and their
// answer reaches the host.
//
// Recording: the host can record from web too (utils/meetingRecording.ts).
// The browser asks which tab or screen to share; the host's microphone
// is mixed in. Everyone in the call, on web or phone, gets the same
// consent request, and the file is saved the same way the phone saves it.
// Gated by the CEO's meeting_recording_allowed setting.
//
// Waiting room: when the meeting is locked, a new person waits with
// `admitted: false` and nobody connects to them until the host admits
// them. Whoever is already in the room tells a newcomer whether it's
// locked. If nobody who could admit you is in the room at all, you're let
// straight in: there's no one there to keep you out, and without this a
// room with no host (the Boardroom) would never connect anyone.
import { useEffect, useRef, useState } from 'react';
import {
  X, Mic, MicOff, Video, VideoOff, Users, Hand, Smile, Pin, PinOff, MessageSquare, Send,
  Copy, Lock, LockOpen, UserX, Volume2, EyeOff, Eye, PhoneOff, Wifi, WifiOff, Circle,
  PenTool, Trash2, LayoutGrid, Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import { startBrowserRecording, uploadRecording, type BrowserRecording } from '../../utils/meetingRecording';
import {
  openRoomChannel, ICE_SERVERS, shouldOfferTo, candidateToJson,
  type SignalMessage, type RoomChannel, type RoomPresenceEntry,
} from '../../lib/webrtcSignaling';
import CountBadge from '../../components/ui/CountBadge';
import { CallAvatar, useRingback } from './callUi';

interface Props {
  room: string;
  title: string;
  myId: string;
  myName: string;
  meetingId?: string;
  isHost?: boolean;
  /** Voice calls start with the camera off. */
  startWithCamera?: boolean;
  /** Set only on a breakout room's own window: ends every breakout and
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
  connectionState: 'connecting' | 'connected' | 'poor';
}

interface ChatMsg { from: string; fromName: string; text: string; at: number }
interface ReactionBubble { id: string; emoji: string }
interface WhiteboardStroke { id: string; points: { x: number; y: number }[]; color: string; width: number }

const REACTION_SET = ['👍', '❤️', '😂', '👏', '🎉', '😮'];
const WHITEBOARD_COLORS = ['#f8fafc', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b'];

function MediaTile({ stream, muted, mirror }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`w-full h-full object-cover ${mirror ? '-scale-x-100' : ''}`} />;
}

const fmtTimer = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

export default function WebGroupCallModal({ room, title, myId, myName, meetingId, isHost = false, startWithCamera = true, onEndBreakouts, onClose }: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(startWithCamera);
  const [, forceRender] = useState(0);
  const bump = () => forceRender((n) => n + 1);

  const [handRaised, setHandRaised] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [selfViewHidden, setSelfViewHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<'none' | 'participants' | 'waiting' | 'chat' | 'breakout'>('none');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [reactions, setReactions] = useState<ReactionBubble[]>([]);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [removedMessage, setRemovedMessage] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const [waitingRoom, setWaitingRoom] = useState<RoomPresenceEntry[]>([]);
  const [iAmWaiting, setIAmWaiting] = useState(false);

  const [hostIsRecording, setHostIsRecording] = useState(false);
  const { getSetting } = useCeoSettings();
  const recordingAllowed = getSetting('meeting_recording_allowed', true);
  const [isRecording, setIsRecording] = useState(false); // this host's own recording
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordNotice, setRecordNotice] = useState('');
  const [recordConsent, setRecordConsent] = useState<Record<string, boolean>>({});
  const recordingRef = useRef<BrowserRecording | null>(null);
  const recordingStartedAtRef = useRef<string | null>(null);
  const recordConsentRef = useRef<Record<string, boolean>>({});
  const [recordConsentPrompt, setRecordConsentPrompt] = useState<{ fromName: string } | null>(null);
  const [myRecordConsent, setMyRecordConsent] = useState<boolean | null>(null);

  const [breakoutCount, setBreakoutCount] = useState(2);
  const [myBreakoutIndex, setMyBreakoutIndex] = useState<number | null>(null);
  const inBreakoutRef = useRef(false);

  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [whiteboardColor, setWhiteboardColor] = useState(WHITEBOARD_COLORS[0]);
  const currentStrokeRef = useRef<{ id: string; points: { x: number; y: number }[] } | null>(null);
  const lastStrokeSendRef = useRef(0);
  const boardRef = useRef<SVGSVGElement>(null);

  const peersRef = useRef<Map<string, Peer>>(new Map());
  const roomRef = useRef<RoomChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const closedRef = useRef(false);
  const lockedRef = useRef(false);
  const admittedRef = useRef(isHost);
  const knownParticipantsRef = useRef<RoomPresenceEntry[]>([]);
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  useEffect(() => {
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const nameOf = (userId: string) => knownParticipantsRef.current.find((p) => p.userId === userId)?.fullName || 'Participant';

  const closePeer = (userId: string) => {
    const peer = peersRef.current.get(userId);
    if (!peer) return;
    peer.pc.close();
    peersRef.current.delete(userId);
    pendingCandidates.current.delete(userId);
    setPinnedUserId((cur) => (cur === userId ? null : cur));
    bump();
  };

  const ensurePeer = (userId: string): Peer => {
    const existing = peersRef.current.get(userId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { userId, fullName: nameOf(userId), pc, remoteStream: null, handRaised: false, connectionState: 'connecting' };
    peersRef.current.set(userId, peer);
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) roomRef.current?.send({ type: 'ice-candidate', candidate: candidateToJson(event.candidate), from: myId, to: userId });
    };
    pc.ontrack = (event) => {
      const p = peersRef.current.get(userId);
      if (p && event.streams[0]) { p.remoteStream = event.streams[0]; bump(); }
    };
    pc.onconnectionstatechange = () => {
      const p = peersRef.current.get(userId);
      if (!p) return;
      if (pc.connectionState === 'connected') p.connectionState = 'connected';
      else if (pc.connectionState === 'disconnected') p.connectionState = 'poor';
      else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { closePeer(userId); return; }
      bump();
    };
    bump();
    return peer;
  };

  // Connect to one person: never to someone still waiting, never while
  // I'm waiting myself, and not while I'm away in a breakout room. Only a
  // brand-new connection gets an offer, so a presence update (a raised
  // hand, say) doesn't restart a call that's already working.
  const connectTo = async (participant: RoomPresenceEntry) => {
    if (closedRef.current || !admittedRef.current || inBreakoutRef.current) return;
    if (participant.admitted === false) return;
    const isNew = !peersRef.current.has(participant.userId);
    const peer = ensurePeer(participant.userId);
    peer.fullName = participant.fullName || peer.fullName;
    peer.handRaised = !!participant.handRaised;
    if (isNew && shouldOfferTo(myId, participant.userId)) {
      const offer = await peer.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await peer.pc.setLocalDescription(offer);
      roomRef.current?.send({ type: 'offer', sdp: offer.sdp || '', from: myId, to: participant.userId });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const flush = async (userId: string, pc: RTCPeerConnection) => {
      for (const c of pendingCandidates.current.get(userId) || []) await pc.addIceCandidate(c).catch(() => {});
      pendingCandidates.current.delete(userId);
    };

    const setup = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        // Try sound only before giving up (no camera, or camera refused).
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          if (!cancelled) setMediaError('Allow camera and microphone access in your browser to join this call.');
          return;
        }
      }
      if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      if (!startWithCamera) stream.getVideoTracks().forEach((tr) => { tr.enabled = false; });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const handleSignal = async (msg: SignalMessage) => {
        if (cancelled || closedRef.current) return;
        switch (msg.type) {
          case 'hangup': closePeer(msg.from); return;
          case 'chat': setChatMessages((prev) => [...prev, { from: msg.from, fromName: msg.fromName, text: msg.text, at: msg.at }]); return;
          case 'reaction': {
            const id = `${msg.from}-${Date.now()}-${Math.random()}`;
            setReactions((prev) => [...prev, { id, emoji: msg.emoji }]);
            setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
            return;
          }
          case 'raise-hand': {
            const p = peersRef.current.get(msg.from);
            if (p) { p.handRaised = msg.raised; bump(); }
            return;
          }
          case 'mute-request':
            if (!msg.to || msg.to === myId) {
              localStreamRef.current?.getAudioTracks().forEach((tr) => { tr.enabled = false; });
              setMicOn(false);
            }
            return;
          case 'remove':
            if (msg.to === myId) setRemovedMessage('The host removed you from this meeting.');
            else closePeer(msg.to);
            return;
          case 'lock': lockedRef.current = msg.locked; setLocked(msg.locked); return;
          case 'end-meeting': setRemovedMessage('The host ended this meeting for everyone.'); return;
          case 'lock-state':
            if (!msg.locked) {
              admittedRef.current = true;
              setIAmWaiting(false);
              roomRef.current?.updatePresence({ admitted: true });
            } else if (!isHost) {
              setIAmWaiting(true);
            }
            return;
          case 'admit':
            admittedRef.current = true;
            setIAmWaiting(false);
            roomRef.current?.updatePresence({ admitted: true });
            return;
          case 'deny': setRemovedMessage('The host did not admit you to this meeting.'); return;
          case 'record-start':
            setHostIsRecording(true);
            setMyRecordConsent(null);
            if (!isHost) setRecordConsentPrompt({ fromName: msg.fromName });
            return;
          case 'record-consent':
            recordConsentRef.current = { ...recordConsentRef.current, [msg.from]: msg.accepted };
            setRecordConsent(recordConsentRef.current);
            return;
          case 'record-stop':
            setHostIsRecording(false);
            setRecordConsentPrompt(null);
            setMyRecordConsent(null);
            return;
          case 'breakout-assign': {
            const idx = msg.assignments[myId];
            if (idx == null) return;
            inBreakoutRef.current = true;
            setMyBreakoutIndex(idx);
            Array.from(peersRef.current.keys()).forEach(closePeer);
            return;
          }
          case 'breakout-end':
            if (inBreakoutRef.current) {
              inBreakoutRef.current = false;
              setMyBreakoutIndex(null);
              knownParticipantsRef.current.forEach((p) => connectTo(p));
            }
            return;
          case 'whiteboard-stroke':
            setStrokes((prev) => [...prev.filter((s) => s.id !== msg.strokeId), { id: msg.strokeId, points: msg.points, color: msg.color, width: msg.width }]);
            return;
          case 'whiteboard-clear': setStrokes([]); return;
        }

        // Media negotiation, one connection per person.
        const peer = ensurePeer(msg.from);
        try {
          if (msg.type === 'offer') {
            await peer.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
            await flush(msg.from, peer.pc);
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            roomRef.current?.send({ type: 'answer', sdp: answer.sdp || '', from: myId, to: msg.from });
          } else if (msg.type === 'answer') {
            await peer.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
            await flush(msg.from, peer.pc);
          } else if (msg.type === 'ice-candidate') {
            if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(msg.candidate).catch(() => {});
            else {
              const list = pendingCandidates.current.get(msg.from) || [];
              list.push(msg.candidate);
              pendingCandidates.current.set(msg.from, list);
            }
          }
        } catch {
          // A broken negotiation drops just that one connection; the next
          // presence update reconnects it.
          closePeer(msg.from);
        }
      };

      const channel = openRoomChannel(room, { userId: myId, fullName: myName, isHost, handRaised: false, admitted: isHost }, handleSignal);
      roomRef.current = channel;
      channel.onPresence((participants) => {
        const liveIds = new Set(participants.map((p) => p.userId));
        Array.from(peersRef.current.keys()).forEach((id) => { if (!liveIds.has(id)) closePeer(id); });

        // Nobody who could admit me is here: let myself in.
        if (!admittedRef.current && !participants.some((p) => p.admitted !== false)) {
          admittedRef.current = true;
          setIAmWaiting(false);
          channel.updatePresence({ admitted: true });
        }

        if (admittedRef.current) {
          const knownIds = new Set(knownParticipantsRef.current.map((p) => p.userId));
          participants.forEach((p) => {
            if (!knownIds.has(p.userId)) channel.send({ type: 'lock-state', from: myId, to: p.userId, locked: lockedRef.current });
          });
        }
        knownParticipantsRef.current = participants;
        participants.forEach((p) => {
          const peer = peersRef.current.get(p.userId);
          if (peer) { peer.fullName = p.fullName || peer.fullName; peer.handRaised = !!p.handRaised; }
        });
        setWaitingRoom(participants.filter((p) => p.admitted === false));
        participants.forEach((p) => connectTo(p));
        bump();
      });

      if (meetingId) {
        supabase.from('meeting_attendees').upsert(
          { meeting_id: meetingId, user_id: myId, joined_at: new Date().toISOString(), rsvp_status: 'ACCEPTED' },
          { onConflict: 'meeting_id,user_id' },
        ).then(() => {}, () => {});
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

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setMicOn((v) => !v);
  };
  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setCamOn((v) => !v);
  };
  const toggleRaiseHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    roomRef.current?.send({ type: 'raise-hand', from: myId, raised: next });
    roomRef.current?.updatePresence({ handRaised: next });
  };
  const sendReaction = (emoji: string) => {
    const id = `${myId}-${Date.now()}`;
    setReactions((prev) => [...prev, { id, emoji }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
    roomRef.current?.send({ type: 'reaction', from: myId, emoji });
    setReactionPickerOpen(false);
  };
  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    const at = Date.now();
    setChatMessages((prev) => [...prev, { from: myId, fromName: myName, text, at }]);
    roomRef.current?.send({ type: 'chat', from: myId, fromName: myName, text, at });
    setChatDraft('');
  };
  const copyMeetingCode = () => {
    navigator.clipboard.writeText(meetingId || room).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {});
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
    if (!window.confirm('End this meeting for everyone?')) return;
    roomRef.current?.send({ type: 'end-meeting', from: myId });
    if (meetingId) await supabase.from('meetings').update({ status: 'COMPLETED' }).eq('id', meetingId);
    onClose();
  };
  // Host recording from web.
  const stopRecordingFlow = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    setRecordingBusy(true);
    setIsRecording(false);
    setHostIsRecording(false);
    roomRef.current?.send({ type: 'record-stop', from: myId });
    const file = await rec.stop();
    if (!file) { setRecordingBusy(false); setRecordNotice('The recording was empty, so nothing was saved.'); return; }
    setRecordNotice('Saving the recording…');
    const consent = recordConsentRef.current;
    const res = await uploadRecording({
      meetingId: meetingId || null, room, hostId: myId, hostName: myName, file,
      consentedUserIds: Object.keys(consent).filter((id) => consent[id]),
      declinedUserIds: Object.keys(consent).filter((id) => !consent[id]),
      startedAt: recordingStartedAtRef.current || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });
    setRecordingBusy(false);
    setRecordNotice(res.ok ? 'Recording saved.' : `The recording finished but could not be saved: ${res.error}`);
  };

  const startRecordingFlow = async () => {
    if (!recordingAllowed) { setRecordNotice('Meeting recording has been turned off in Control Center.'); return; }
    setRecordingBusy(true);
    setRecordNotice('');
    const res = await startBrowserRecording(localStreamRef.current);
    setRecordingBusy(false);
    if (!res.ok) { setRecordNotice(res.reason); return; }
    recordingRef.current = res.recording;
    res.recording.onEndedByBrowser(() => { stopRecordingFlow(); });
    recordingStartedAtRef.current = new Date().toISOString();
    recordConsentRef.current = {};
    setRecordConsent({});
    setIsRecording(true);
    setHostIsRecording(true);
    roomRef.current?.send({ type: 'record-start', from: myId, fromName: myName });
  };

  // If the host leaves while recording, stop and keep what was recorded.
  useEffect(() => () => { if (recordingRef.current) stopRecordingFlow(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const respondToRecordConsent = (accepted: boolean) => {
    setMyRecordConsent(accepted);
    setRecordConsentPrompt(null);
    roomRef.current?.send({ type: 'record-consent', from: myId, accepted });
  };

  // Breakout rooms: everyone in the call is shared out evenly.
  const startAutoBreakout = () => {
    const allIds = [myId, ...peersRef.current.keys()];
    const assignments: Record<string, number> = {};
    allIds.forEach((id, i) => { assignments[id] = i % breakoutCount; });
    roomRef.current?.send({ type: 'breakout-assign', from: myId, assignments });
    setPanel('none');
    inBreakoutRef.current = true;
    setMyBreakoutIndex(assignments[myId]);
    Array.from(peersRef.current.keys()).forEach(closePeer);
  };
  const returnToMainRoom = () => {
    if (!inBreakoutRef.current) return;
    inBreakoutRef.current = false;
    setMyBreakoutIndex(null);
    knownParticipantsRef.current.forEach((p) => connectTo(p));
  };
  const endBreakoutForEveryone = () => {
    roomRef.current?.send({ type: 'breakout-end', from: myId });
    returnToMainRoom();
  };

  // Whiteboard: points are stored as 0 to 1 of the board's size, so they
  // land in the same place on every screen, phone or web.
  const boardPoint = (e: React.PointerEvent) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };
  const sendStroke = (points: { x: number; y: number }[], strokeId: string, done: boolean) => {
    roomRef.current?.send({ type: 'whiteboard-stroke', from: myId, strokeId, points, color: whiteboardColor, width: 3, done });
  };
  const onBoardDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = boardPoint(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    currentStrokeRef.current = { id: `${myId}-${Date.now()}`, points: [pt] };
    lastStrokeSendRef.current = 0;
    bump();
  };
  const onBoardMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const stroke = currentStrokeRef.current;
    const pt = boardPoint(e);
    if (!stroke || !pt) return;
    stroke.points.push(pt);
    bump();
    const now = Date.now();
    if (now - lastStrokeSendRef.current > 60) {
      lastStrokeSendRef.current = now;
      sendStroke(stroke.points, stroke.id, false);
    }
  };
  const onBoardUp = () => {
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    sendStroke(stroke.points, stroke.id, true);
    setStrokes((prev) => [...prev.filter((s) => s.id !== stroke.id), { id: stroke.id, points: stroke.points, color: whiteboardColor, width: 3 }]);
    currentStrokeRef.current = null;
  };
  const clearWhiteboard = () => {
    setStrokes([]);
    roomRef.current?.send({ type: 'whiteboard-clear', from: myId });
  };

  const peers = Array.from(peersRef.current.values());
  const participantCount = peers.length + 1;
  const pinnedPeer = pinnedUserId ? peers.find((p) => p.userId === pinnedUserId) : undefined;
  const gridPeers = pinnedPeer ? peers.filter((p) => p.userId !== pinnedUserId) : peers;
  // Phone style: while nobody else is here yet, show who you're calling and
  // play the ringing tone, for the first 45 seconds only.
  const stillCalling = peers.length === 0 && elapsed < 45;
  useRingback(stillCalling);
  const tileCount = gridPeers.length + (selfViewHidden ? 0 : 1);
  const gridCols = tileCount <= 1 ? 'grid-cols-1' : tileCount <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  const ctrl = 'w-11 h-11 rounded-full flex items-center justify-center cursor-pointer text-white shrink-0';
  const soft = `${ctrl} bg-white/15 hover:bg-white/25`;

  // While in a breakout room this main-room window stays open (to hear
  // "breakout ended") but shows the breakout's own call.
  if (myBreakoutIndex != null) {
    return (
      <WebGroupCallModal
        room={`${room}-bo-${myBreakoutIndex}`}
        title={`${title}, Breakout ${myBreakoutIndex + 1}`}
        myId={myId}
        myName={myName}
        isHost={isHost}
        startWithCamera={camOn}
        onEndBreakouts={isHost ? endBreakoutForEveryone : undefined}
        onClose={returnToMainRoom}
      />
    );
  }

  if (removedMessage || mediaError) {
    return (
      <div className="fixed inset-0 z-[1700] bg-[#0b0b0f] flex flex-col items-center justify-center gap-5 p-6 text-center">
        <PhoneOff size={40} className="text-white/60" />
        <p className="text-sm font-bold text-white max-w-sm">{removedMessage || mediaError}</p>
        <button onClick={onClose} className="px-6 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-bold cursor-pointer">OK</button>
      </div>
    );
  }

  if (iAmWaiting) {
    return (
      <div className="fixed inset-0 z-[1700] bg-[#0b0b0f] flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="w-36 h-36 rounded-full overflow-hidden bg-[#1a1a22] flex items-center justify-center">
          {localStream && camOn ? <MediaTile stream={localStream} muted mirror /> : <Lock size={40} className="text-white/60" />}
        </div>
        <p className="text-sm font-bold text-white">Waiting for the host to let you in</p>
        <p className="text-xs text-white/60 max-w-xs">{title} is locked right now. You'll join automatically once admitted.</p>
        <div className="flex gap-3">
          <button onClick={toggleMic} className={micOn ? soft : `${ctrl} bg-white !text-[#0b0b0f]`}>{micOn ? <Mic size={18} /> : <MicOff size={18} />}</button>
          <button onClick={toggleCamera} className={camOn ? soft : `${ctrl} bg-white !text-[#0b0b0f]`}>{camOn ? <Video size={18} /> : <VideoOff size={18} />}</button>
        </div>
        <button onClick={onClose} className="px-6 py-2 rounded-full bg-white/15 text-white text-sm font-bold cursor-pointer">Leave</button>
      </div>
    );
  }

  const sidePanel = (heading: React.ReactNode, body: React.ReactNode, footer?: React.ReactNode) => (
    <div className="absolute top-0 right-0 bottom-0 w-full sm:w-80 bg-[#15151c] flex flex-col z-10">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-bold text-white">{heading}</p>
        <button onClick={() => setPanel('none')} className="text-white cursor-pointer"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4">{body}</div>
      {footer}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1700] bg-[#0b0b0f] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div>
          <div className="flex items-center gap-1.5 text-white">
            <Users size={13} className="text-white/70" />
            <p className="text-sm font-bold">{title} · {participantCount}</p>
            {locked && <Lock size={12} className="text-amber-400" />}
          </div>
          <p className="text-[10px] text-white/60">{fmtTimer(elapsed)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyMeetingCode} title="Copy meeting code" className="p-2 rounded-full bg-white/15 text-white cursor-pointer">{codeCopied ? <Check size={16} /> : <Copy size={16} />}</button>
          <button onClick={onClose} title="Leave" className="p-2 rounded-full bg-white/15 text-white cursor-pointer"><X size={18} /></button>
        </div>
      </div>

      {hostIsRecording && (
        <div className="flex justify-center mb-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 text-white text-[11px] font-semibold">
            <Circle size={9} className="text-red-500 fill-red-500" /> Recording
          </span>
        </div>
      )}

      {/* Video grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {peers.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-white">
            <CallAvatar name={title} size={120} ringing={stillCalling} />
            <div>
              <p className="text-xl font-bold">{title}</p>
              <p className="mt-1 text-sm text-white/65">{stillCalling ? 'Calling…' : 'Waiting for others to join'}</p>
            </div>
          </div>
        )}
        {pinnedPeer && (
          <div className="relative w-full aspect-video max-h-[60vh] rounded-xl overflow-hidden bg-[#1a1a22]">
            {pinnedPeer.remoteStream ? <MediaTile stream={pinnedPeer.remoteStream} /> : <p className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">Connecting…</p>}
            <span className="absolute bottom-2 left-2 px-2 rounded bg-black/50 text-white text-[11px] font-semibold">{pinnedPeer.fullName}</span>
            <button onClick={() => setPinnedUserId(null)} title="Unpin" className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white cursor-pointer"><PinOff size={14} /></button>
          </div>
        )}
        <div className={`grid ${gridCols} gap-2`}>
          {!selfViewHidden && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1a1a22]">
              {localStream && camOn ? <MediaTile stream={localStream} muted mirror /> : <p className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">{myName} (You)</p>}
              {handRaised && <span className="absolute top-2 left-2 p-1 rounded-full bg-black/50"><Hand size={13} className="text-amber-400" /></span>}
              {!micOn && <span className="absolute bottom-2 right-2 p-1 rounded-full bg-black/50"><MicOff size={12} className="text-red-400" /></span>}
            </div>
          )}
          {gridPeers.map((peer) => (
            <div key={peer.userId} className="relative aspect-video rounded-xl overflow-hidden bg-[#1a1a22] group">
              {peer.remoteStream ? <MediaTile stream={peer.remoteStream} /> : <p className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">Connecting…</p>}
              <div className="absolute bottom-2 left-2 flex items-center gap-1">
                <span className="px-2 rounded bg-black/50 text-white text-[11px] font-semibold truncate max-w-[160px]">{peer.fullName}</span>
                {peer.connectionState === 'connected' ? <Wifi size={11} className="text-green-500" /> : peer.connectionState === 'poor' ? <WifiOff size={11} className="text-amber-400" /> : null}
              </div>
              {peer.handRaised && <span className="absolute top-2 left-2 p-1 rounded-full bg-black/50"><Hand size={13} className="text-amber-400" /></span>}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setPinnedUserId(peer.userId)} title="Pin" className="p-1.5 rounded-full bg-black/50 text-white cursor-pointer"><Pin size={12} /></button>
                {isHost && <button onClick={() => removeParticipant(peer.userId)} title="Remove from meeting" className="p-1.5 rounded-full bg-red-500/85 text-white cursor-pointer"><UserX size={12} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating reactions */}
      <div className="pointer-events-none absolute bottom-28 inset-x-0 flex flex-col items-center gap-1">
        {reactions.map((r) => <span key={r.id} className="text-3xl animate-bounce">{r.emoji}</span>)}
      </div>

      {/* Controls */}
      <div className="relative flex flex-wrap items-center justify-center gap-2.5 px-3 py-4 shrink-0">
        <button onClick={toggleMic} title={micOn ? 'Mute' : 'Unmute'} className={micOn ? soft : `${ctrl} bg-white !text-[#0b0b0f]`}>{micOn ? <Mic size={18} /> : <MicOff size={18} />}</button>
        <button onClick={toggleCamera} title={camOn ? 'Turn camera off' : 'Turn camera on'} className={camOn ? soft : `${ctrl} bg-white !text-[#0b0b0f]`}>{camOn ? <Video size={18} /> : <VideoOff size={18} />}</button>
        <button onClick={toggleRaiseHand} title={handRaised ? 'Lower hand' : 'Raise hand'} className={handRaised ? `${ctrl} bg-amber-500` : soft}><Hand size={18} /></button>
        <div className="relative">
          <button onClick={() => setReactionPickerOpen((v) => !v)} title="React" className={soft}><Smile size={18} /></button>
          {reactionPickerOpen && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 p-1.5 rounded-full bg-[#1f1f28]">
              {REACTION_SET.map((e) => <button key={e} onClick={() => sendReaction(e)} className="text-xl px-1 cursor-pointer hover:scale-125 transition-transform">{e}</button>)}
            </div>
          )}
        </div>
        <button onClick={() => setSelfViewHidden((v) => !v)} title={selfViewHidden ? 'Show my video' : 'Hide my video'} className={soft}>{selfViewHidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        <button onClick={() => setPanel('participants')} title="Participants" className={soft}><Users size={18} /></button>
        <button onClick={() => setPanel('chat')} title="Meeting chat" className={soft}><MessageSquare size={18} /></button>
        <button onClick={() => setWhiteboardOpen(true)} title="Whiteboard" className={soft}><PenTool size={18} /></button>
        {isHost && <button onClick={toggleLock} title={locked ? 'Unlock meeting' : 'Lock meeting'} className={locked ? `${ctrl} bg-amber-500` : soft}>{locked ? <Lock size={18} /> : <LockOpen size={18} />}</button>}
        {isHost && recordingAllowed && (
          <button
            onClick={isRecording ? stopRecordingFlow : startRecordingFlow} disabled={recordingBusy}
            title={isRecording ? 'Stop recording' : 'Record this meeting'}
            className={`${isRecording ? `${ctrl} bg-red-500` : soft} disabled:opacity-60`}
          >
            <Circle size={18} className={isRecording ? 'fill-white' : ''} />
          </button>
        )}
        {isHost && <button onClick={() => setPanel('breakout')} title="Breakout rooms" className={soft}><LayoutGrid size={18} /></button>}
        {isHost && waitingRoom.length > 0 && (
          <button onClick={() => setPanel('waiting')} title="Waiting room" className={`${ctrl} bg-amber-500 relative`}>
            <Users size={18} />
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">{waitingRoom.length}</span>
          </button>
        )}
        {isHost && <button onClick={requestMuteAll} title="Mute everyone" className={soft}><Volume2 size={18} /></button>}
        <button onClick={isHost ? endMeetingForEveryone : onClose} title={isHost ? 'End meeting for everyone' : 'Leave'} className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer"><PhoneOff size={22} /></button>
      </div>

      {panel === 'participants' && sidePanel(<>Participants<CountBadge count={participantCount} /></>, (
        <>
          <div className="flex items-center justify-between py-2">
            <p className="text-xs font-semibold text-white">{myName} (You)</p>
            {micOn ? <Mic size={14} className="text-white/60" /> : <MicOff size={14} className="text-red-400" />}
          </div>
          {peers.map((peer) => (
            <div key={peer.userId} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{peer.fullName}</p>
                {peer.handRaised && <Hand size={13} className="text-amber-400" />}
              </div>
              <div className="flex items-center gap-2">
                {isHost && isRecording && recordConsent[peer.userId] !== undefined && (
                  <span className={`text-[10px] font-semibold ${recordConsent[peer.userId] ? 'text-green-500' : 'text-amber-400'}`}>{recordConsent[peer.userId] ? 'Agreed' : 'Declined'}</span>
                )}
                <button onClick={() => setPinnedUserId(pinnedUserId === peer.userId ? null : peer.userId)} title="Pin" className="cursor-pointer">
                  <Pin size={14} className={pinnedUserId === peer.userId ? 'text-[var(--accent)]' : 'text-white/60'} />
                </button>
                {isHost && <button onClick={() => removeParticipant(peer.userId)} title="Remove from meeting" className="cursor-pointer"><UserX size={14} className="text-red-400" /></button>}
              </div>
            </div>
          ))}
        </>
      ))}

      {panel === 'waiting' && sidePanel(<>Waiting Room<CountBadge count={waitingRoom.length} /></>, (
        waitingRoom.length === 0
          ? <p className="text-xs text-white/50 text-center mt-8">No one is waiting.</p>
          : waitingRoom.map((p) => (
            <div key={p.userId} className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-semibold text-white truncate">{p.fullName}</p>
              <div className="flex gap-2">
                <button onClick={() => admitParticipant(p.userId)} className="px-3 py-1 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold cursor-pointer">Admit</button>
                <button onClick={() => denyParticipant(p.userId)} className="px-3 py-1 rounded-full bg-red-500/85 text-white text-[11px] font-bold cursor-pointer">Deny</button>
              </div>
            </div>
          ))
      ))}

      {panel === 'chat' && sidePanel('Meeting Chat', (
        <>
          {chatMessages.length === 0 && <p className="text-xs text-white/50 text-center mt-8">No messages yet. Not saved after the call ends.</p>}
          {chatMessages.map((m, i) => (
            <div key={i} className="mb-2">
              <p className="text-[10px] font-bold text-white/60">{m.from === myId ? 'You' : m.fromName}</p>
              <p className="text-xs text-white break-words">{m.text}</p>
            </div>
          ))}
        </>
      ), (
        <div className="flex gap-2 p-4">
          <input
            value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Message everyone…"
            className="flex-1 px-4 py-2 rounded-full bg-white/10 text-white text-xs outline-none placeholder:text-white/40"
          />
          <button onClick={sendChat} className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center cursor-pointer"><Send size={15} /></button>
        </div>
      ))}

      {panel === 'breakout' && sidePanel('Breakout Rooms', (
        <div className="space-y-4">
          {onEndBreakouts ? <p className="text-xs text-white/60">You're in a breakout room. Ending breakouts brings everyone back to the main meeting.</p> : <>
          <p className="text-xs text-white/60">Shares everyone currently in the call evenly across the rooms below. Each breakout is a separate call.</p>
          <div>
            <p className="text-[10px] font-semibold text-white/60 mb-2">Number of rooms</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setBreakoutCount((n) => Math.max(2, n - 1))} className="w-9 h-9 rounded-full bg-white/15 text-white text-lg font-bold cursor-pointer">−</button>
              <span className="text-sm font-bold text-white w-6 text-center">{breakoutCount}</span>
              <button onClick={() => setBreakoutCount((n) => Math.min(8, n + 1))} className="w-9 h-9 rounded-full bg-white/15 text-white text-lg font-bold cursor-pointer">+</button>
            </div>
          </div>
          </>}
          {!onEndBreakouts && (
            <button onClick={startAutoBreakout} className="w-full py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-bold cursor-pointer">Share Out and Start</button>
          )}
          <button onClick={onEndBreakouts || endBreakoutForEveryone} className="w-full py-2.5 rounded-full bg-red-500 text-white text-sm font-bold cursor-pointer">End Breakout Rooms for Everyone</button>
        </div>
      ))}

      {recordConsentPrompt && (
        <div className="absolute top-20 inset-x-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-96 bg-[#1f1f28] border border-red-500/40 rounded-2xl p-4 z-20">
          <div className="flex items-center gap-1.5 mb-2">
            <Circle size={9} className="text-red-500 fill-red-500" />
            <p className="text-xs font-bold text-white">{recordConsentPrompt.fromName} started recording this meeting</p>
          </div>
          <p className="text-[11px] text-white/70 mb-3">Do you agree to be recorded? If you decline, the host can see that you declined, but the recording carries on.</p>
          <div className="flex gap-2">
            <button onClick={() => respondToRecordConsent(true)} className="flex-1 py-2 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold cursor-pointer">Accept</button>
            <button onClick={() => respondToRecordConsent(false)} className="flex-1 py-2 rounded-full bg-white/15 text-white text-[11px] font-bold cursor-pointer">Decline</button>
          </div>
        </div>
      )}
      {myRecordConsent != null && !recordConsentPrompt && hostIsRecording && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 z-20">
          <p className={`text-[10px] font-semibold ${myRecordConsent ? 'text-green-500' : 'text-amber-400'}`}>
            {myRecordConsent ? 'You agreed to be recorded' : 'You declined to be recorded'}
          </p>
        </div>
      )}

      {recordNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/75 z-20 max-w-[90vw]">
          <p className="text-[11px] font-semibold text-white">{recordNotice}</p>
          <button onClick={() => setRecordNotice('')} className="text-white/70 cursor-pointer"><X size={12} /></button>
        </div>
      )}

      {whiteboardOpen && (
        <div className="absolute inset-0 bg-[#0b0b0f] flex flex-col z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-bold text-white">Whiteboard</p>
            <div className="flex gap-3">
              <button onClick={clearWhiteboard} title="Clear for everyone" className="text-white cursor-pointer"><Trash2 size={18} /></button>
              <button onClick={() => setWhiteboardOpen(false)} title="Close" className="text-white cursor-pointer"><X size={18} /></button>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3">
            {WHITEBOARD_COLORS.map((c) => (
              <button key={c} onClick={() => setWhiteboardColor(c)} className={`w-6 h-6 rounded-full cursor-pointer ${whiteboardColor === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} />
            ))}
          </div>
          <svg
            ref={boardRef}
            className="flex-1 bg-[#15151c] touch-none cursor-crosshair"
            viewBox="0 0 1 1" preserveAspectRatio="none"
            onPointerDown={onBoardDown} onPointerMove={onBoardMove} onPointerUp={onBoardUp} onPointerLeave={onBoardUp}
          >
            {[...strokes, ...(currentStrokeRef.current ? [{ id: 'live', points: currentStrokeRef.current.points, color: whiteboardColor, width: 3 }] : [])].map((s) => (
              <polyline
                key={s.id}
                points={s.points.map((p) => `${p.x},${p.y}`).join(' ')}
                stroke={s.color} strokeWidth={s.width} vectorEffect="non-scaling-stroke"
                fill="none" strokeLinecap="round" strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
