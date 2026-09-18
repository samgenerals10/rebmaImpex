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
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  RTCView,
  type MediaStream,
} from 'react-native-webrtc';
import { X, Phone, Video, Mic, MicOff, SwitchCamera, VideoOff } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { openRoomChannel, ICE_SERVERS, shouldOfferTo, type SignalMessage, type RoomChannel } from '../../lib/webrtcSignaling';

interface Props {
  room: string;
  title: string;
  kind: 'voice' | 'video';
  otherUserId: string;
  onClose: () => void;
}

type CallStatus = 'connecting' | 'ringing' | 'connected' | 'failed' | 'ended';

export default function NativeCallSheet({ room, title, kind, otherUserId, onClose }: Props) {
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
      if (iOffer) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === 'video' });
        await pc.setLocalDescription(offer);
        roomRef.current.send({ type: 'offer', sdp: offer.sdp!, from: myId, to: otherUserId });
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    connecting: 'Connecting…',
    ringing: 'Calling…',
    connected: 'Connected',
    failed: "Couldn't connect — check the other person's connection",
    ended: 'Call ended',
  };

  return (
    <Modal visible animationType="slide" onRequestClose={hangUp}>
      <View style={{ flex: 1, backgroundColor: '#0b0b0f' }}>
        {kind === 'video' && remoteStream ? (
          <RTCView streamURL={(remoteStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {kind === 'voice' ? <Phone size={48} color="rgba(255,255,255,0.4)" /> : <Video size={48} color="rgba(255,255,255,0.4)" />}
          </View>
        )}

        {kind === 'video' && localStream && camOn && (
          <View style={{ position: 'absolute', top: 60, right: 16, width: 96, height: 128, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
            <RTCView streamURL={(localStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" mirror={frontCamera} />
          </View>
        )}

        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md }}>
            <View>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: '#fff' }}>{title}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.7)' }}>{statusLabel[status]}</Text>
            </View>
            <Pressable onPress={hangUp} hitSlop={10} style={{ padding: t.spacing.xs, borderRadius: t.radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <X size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>

        <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg, paddingVertical: t.spacing.xl }}>
            <Pressable onPress={toggleMic} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {micOn ? <Mic size={20} color="#fff" /> : <MicOff size={20} color="#0b0b0f" />}
            </Pressable>
            {kind === 'video' && (
              <Pressable onPress={toggleCamera} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: camOn ? 'rgba(255,255,255,0.15)' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                {camOn ? <Video size={20} color="#fff" /> : <VideoOff size={20} color="#0b0b0f" />}
              </Pressable>
            )}
            {kind === 'video' && (
              <Pressable onPress={flipCamera} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <SwitchCamera size={20} color="#fff" />
              </Pressable>
            )}
            <Pressable onPress={hangUp} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
