// rebma-mobile/components/shared/NativeCallSheet.tsx
//
// Real device-camera/mic calling — replaces JitsiCallSheet for Viber's
// 1:1 calls. Uses react-native-webrtc directly (a genuine peer-to-peer
// media connection between two phones) with Supabase Realtime as the
// signaling relay (lib/webrtcSignaling.ts) — no Jitsi, no third-party
// meeting service. GroupCallSheet.tsx is the multi-person sibling of
// this (Boardroom's room, scheduled Meetings) — same primitives, mesh
// instead of one pair.
//
// IMPORTANT, stated plainly rather than buried: react-native-webrtc is a
// native module. It cannot run inside Expo Go and needs a custom
// development build (via EAS) to actually execute on a device. This
// file is written, type-checked, and bundle-verified (npx tsc --noEmit,
// npx expo export) the same as every other change this session, but the
// live peer connection itself — whether two real phones actually see
// and hear each other — has not been run or observed by me, because
// this machine has no EAS login and no way to produce that build. That
// verification can only happen on a real device build.
//
// Role model: shouldOfferTo() is a deterministic tiebreaker (smaller
// user id always offers) — no "whoever called first" bookkeeping needed,
// and it's the same rule GroupCallSheet uses per-pair in a mesh, so both
// call shapes share one rule instead of two.
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MediaStream } from 'react-native-webrtc';
import { Phone, Video, Mic, MicOff, SwitchCamera, VideoOff } from 'lucide-react-native';
import { CallAvatar, useRingback, useCallTimer } from './callUi';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { openRoomChannel, ICE_SERVERS, shouldOfferTo, type SignalMessage, type RoomChannel } from '../../lib/webrtcSignaling';

// react-native-webrtc is a native module — its binding isn't present in
// Expo Go. A plain top-level `import` still gets compiled to a `require()`
// that Metro evaluates the instant this file loads, which happens at app
// boot (this file is wired into the Viber/Messenger stack, not lazily
// mounted) — so an unguarded import here crashes the whole app in Expo
// Go, not just calling. Guarding it with try/catch means the rest of the
// app (including every other screen) still boots and runs normally; the
// values below just stay undefined until a real dev build provides the
// native module, and any attempt to actually place a call while running
// in Expo Go fails at that point instead of at startup.
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
// so `useRef<RTCPeerConnection | null>` below would silently fall back to
// the ambient browser DOM lib's (structurally different) RTCPeerConnection
// interface without this. This is what actually keeps `pc`'s type as
// react-native-webrtc's own, everywhere it's used.
type RTCPeerConnection = InstanceType<typeof import('react-native-webrtc').RTCPeerConnection>;

interface Props {
  room: string;
  title: string;
  kind: 'voice' | 'video';
  otherUserId: string;
  /** Who you're calling, for the phone-style screen. */
  otherName?: string;
  otherPhoto?: string | null;
  onClose: () => void;
}

type CallStatus = 'connecting' | 'ringing' | 'connected' | 'failed' | 'ended';

export default function NativeCallSheet({ room, title, kind, otherUserId, otherName, otherPhoto, onClose }: Props) {
  const t = useTheme();
  const me = useAuthStore((s) => s.profile);
  const myId = me?.id || '';
  const myName = me?.fullName || 'Me';

  const [status, setStatus] = useState<CallStatus>('connecting');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(kind === 'video');
  const [frontCamera, setFrontCamera] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<RoomChannel | null>(null);
  const pendingCandidates = useRef<any[]>([]);
  const closedRef = useRef(false);
  const offeredRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const iOffer = shouldOfferTo(myId, otherUserId);

    const setup = async () => {
      let stream: MediaStream;
      try {
        stream = (await mediaDevices.getUserMedia({
          audio: true,
          video: kind === 'video' ? { facingMode: frontCamera ? 'user' : 'environment' } : false,
        })) as unknown as MediaStream;
      } catch {
        if (!cancelled) setStatus('failed');
        return;
      }
      if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream as any));

      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) roomRef.current?.send({ type: 'ice-candidate', candidate: event.candidate, from: myId, to: otherUserId });
      };
      (pc as any).ontrack = (event: any) => {
        if (event.streams && event.streams[0]) setRemoteStream(event.streams[0]);
        setStatus('connected');
      };
      (pc as any).onconnectionstatechange = () => {
        const state = (pc as any).connectionState;
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          if (!closedRef.current) setStatus((s) => (s === 'connected' ? s : 'failed'));
        }
      };

      const handleSignal = async (msg: SignalMessage) => {
        if (cancelled || closedRef.current) return;
        if (msg.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
          for (const c of pendingCandidates.current) await pc.addIceCandidate(new RTCIceCandidate(c));
          pendingCandidates.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          roomRef.current?.send({ type: 'answer', sdp: answer.sdp!, from: myId, to: otherUserId });
        } else if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
          for (const c of pendingCandidates.current) await pc.addIceCandidate(new RTCIceCandidate(c));
          pendingCandidates.current = [];
        } else if (msg.type === 'ice-candidate') {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          else pendingCandidates.current.push(msg.candidate);
        } else if (msg.type === 'hangup') {
          setStatus('ended');
        }
      };

      roomRef.current = openRoomChannel(room, { userId: myId, fullName: myName }, handleSignal);

      setStatus('ringing');
      // The offer goes out the moment the other person is actually in the
      // room. Sending it straight away (as before) lost it whenever the
      // other person opened the call second, so the call never connected.
      // Same rule as the web app (WebCallModal.tsx).
      roomRef.current.onPresence(async (participants) => {
        if (!iOffer || offeredRef.current || closedRef.current || cancelled) return;
        if (!participants.some((p) => p.userId === otherUserId)) return;
        offeredRef.current = true;
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === 'video' });
        await pc.setLocalDescription(offer);
        roomRef.current?.send({ type: 'offer', sdp: offer.sdp!, from: myId, to: otherUserId });
      });
    };

    setup();

    return () => {
      cancelled = true;
      // However this screen closes, the camera, microphone and connection are switched off.
      if (!closedRef.current) {
        closedRef.current = true;
        roomRef.current?.send({ type: 'hangup', from: myId, to: otherUserId });
      }
      roomRef.current?.close();
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      pcRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the other person hangs up, close after a moment instead of
  // leaving a stuck "Call ended" screen.
  useEffect(() => {
    if (status !== 'ended') return;
    const tm = setTimeout(() => { closedRef.current = true; onClose(); }, 1500);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const ringing = status === 'connecting' || status === 'ringing';
  useRingback(ringing);
  const timer = useCallTimer(status === 'connected');
  const displayName = otherName || title;
  const showVideo = kind === 'video' && !!remoteStream;

  const hangUp = () => {
    closedRef.current = true;
    roomRef.current?.send({ type: 'hangup', from: myId, to: otherUserId });
    roomRef.current?.close();
    localStream?.getTracks().forEach((tr) => tr.stop());
    pcRef.current?.close();
    onClose();
  };

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setMicOn((v) => !v);
  };

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setCamOn((v) => !v);
  };

  const flipCamera = () => {
    const track = localStream?.getVideoTracks()[0] as any;
    track?._switchCamera?.();
    setFrontCamera((v) => !v);
  };

  const statusLabel: Record<CallStatus, string> = {
    connecting: 'Calling…',
    ringing: 'Ringing…',
    connected: 'Connected',
    failed: "Couldn't connect. Check the other person's connection.",
    ended: 'Call ended',
  };

  const roundBtn = (bg: string) => ({ width: 60, height: 60, borderRadius: 30, backgroundColor: bg, alignItems: 'center' as const, justifyContent: 'center' as const });
  const btnLabel = { fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.65)', marginTop: 6 };

  return (
    <Modal visible animationType="slide" onRequestClose={hangUp}>
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        {showVideo && (
          <RTCView streamURL={(remoteStream as any).toURL()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} objectFit="cover" />
        )}

        {kind === 'video' && localStream && camOn && (
          <View style={{ position: 'absolute', top: 70, right: 16, width: 104, height: 144, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 2 }}>
            <RTCView streamURL={(localStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" mirror={frontCamera} />
          </View>
        )}

        <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
          {/* Who you're talking to, phone style */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: showVideo ? 'flex-start' : 'center', paddingTop: showVideo ? 24 : 0, gap: 22, paddingHorizontal: t.spacing.lg }}>
            {!showVideo && <CallAvatar name={displayName} photo={otherPhoto} size={136} ringing={ringing} />}
            <View style={{ alignItems: 'center', paddingHorizontal: 14, paddingVertical: showVideo ? 8 : 0, borderRadius: 16, backgroundColor: showVideo ? 'rgba(0,0,0,0.4)' : 'transparent' }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: 26, color: '#fff', textAlign: 'center' }} numberOfLines={1}>{displayName}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' }}>
                {status === 'connected' ? timer : statusLabel[status]}
              </Text>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {kind === 'video' ? 'VIDEO CALL' : 'VOICE CALL'}
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 22, paddingTop: t.spacing.lg, paddingBottom: 36 }}>
            <View style={{ alignItems: 'center' }}>
              <Pressable onPress={toggleMic} accessibilityLabel={micOn ? 'Mute' : 'Unmute'} style={roundBtn(micOn ? 'rgba(255,255,255,0.15)' : '#fff')}>
                {micOn ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#0f172a" />}
              </Pressable>
              <Text style={btnLabel}>{micOn ? 'Mute' : 'Unmute'}</Text>
            </View>
            {kind === 'video' && (
              <View style={{ alignItems: 'center' }}>
                <Pressable onPress={toggleCamera} accessibilityLabel="Camera" style={roundBtn(camOn ? 'rgba(255,255,255,0.15)' : '#fff')}>
                  {camOn ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#0f172a" />}
                </Pressable>
                <Text style={btnLabel}>Camera</Text>
              </View>
            )}
            {kind === 'video' && (
              <View style={{ alignItems: 'center' }}>
                <Pressable onPress={flipCamera} accessibilityLabel="Flip camera" style={roundBtn('rgba(255,255,255,0.15)')}>
                  <SwitchCamera size={22} color="#fff" />
                </Pressable>
                <Text style={btnLabel}>Flip</Text>
              </View>
            )}
            <View style={{ alignItems: 'center' }}>
              <Pressable onPress={hangUp} accessibilityLabel="End call" style={{ ...roundBtn('#ef4444'), width: 68, height: 68, borderRadius: 34 }}>
                <Phone size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              <Text style={btnLabel}>End</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
