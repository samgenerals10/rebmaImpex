// rebma-web/src/components/collaborative/WebCallModal.tsx
//
// 1:1 voice/video call on web, in the browser's own WebRTC. Replaces the
// Jitsi page for direct-chat calls, so a web user and a phone user can
// finally reach each other: this speaks the same protocol as
// rebma-mobile/components/shared/NativeCallSheet.tsx (lib/webrtcSignaling.ts).
//
// Who sends the offer: the person with the smaller user id, on both apps.
// The offer is sent the moment that person sees the other one arrive in
// the room, so it works whichever of the two opens the call first.
import { useEffect, useRef, useState } from 'react';
import { Phone, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { CallAvatar, useRingback, useCallTimer } from './callUi';
import { openRoomChannel, ICE_SERVERS, shouldOfferTo, candidateToJson, type SignalMessage, type RoomChannel } from '../../lib/webrtcSignaling';

interface Props {
  room: string;
  title: string;
  kind: 'voice' | 'video';
  myId: string;
  myName: string;
  otherUserId: string;
  /** Shown on the calling screen: who you're calling. */
  otherName?: string;
  otherPhoto?: string | null;
  onClose: () => void;
}

type CallStatus = 'connecting' | 'waiting' | 'connected' | 'failed' | 'ended' | 'no-media';

const STATUS_LABEL: Record<CallStatus, string> = {
  connecting: 'Calling…',
  waiting: 'Ringing…',
  connected: 'Connected',
  failed: "Couldn't connect. Check the other person's connection.",
  ended: 'Call ended',
  'no-media': 'Allow camera and microphone access in your browser to join this call.',
};

export default function WebCallModal({ room, title, kind, myId, myName, otherUserId, otherName, otherPhoto, onClose }: Props) {
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(kind === 'video');
  const [hasRemote, setHasRemote] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<RoomChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const offeredRef = useRef(false);
  const closedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const iOffer = shouldOfferTo(myId, otherUserId);

    const sendOffer = async () => {
      const pc = pcRef.current;
      if (!pc || offeredRef.current || closedRef.current) return;
      offeredRef.current = true;
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: kind === 'video' });
      await pc.setLocalDescription(offer);
      roomRef.current?.send({ type: 'offer', sdp: offer.sdp || '', from: myId, to: otherUserId });
    };

    const flushCandidates = async (pc: RTCPeerConnection) => {
      for (const c of pendingCandidates.current) await pc.addIceCandidate(c).catch(() => {});
      pendingCandidates.current = [];
    };

    const setup = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      } catch {
        if (!cancelled) setStatus('no-media');
        return;
      }
      if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) roomRef.current?.send({ type: 'ice-candidate', candidate: candidateToJson(event.candidate), from: myId, to: otherUserId });
      };
      pc.ontrack = (event) => {
        const remote = event.streams[0];
        if (!remote) return;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
        setHasRemote(true);
        setStatus('connected');
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' && !closedRef.current) setStatus('failed');
      };

      const handleSignal = async (msg: SignalMessage) => {
        if (cancelled || closedRef.current) return;
        try {
          if (msg.type === 'offer') {
            await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
            await flushCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            roomRef.current?.send({ type: 'answer', sdp: answer.sdp || '', from: myId, to: otherUserId });
          } else if (msg.type === 'answer') {
            await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
            await flushCandidates(pc);
          } else if (msg.type === 'ice-candidate') {
            if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate).catch(() => {});
            else pendingCandidates.current.push(msg.candidate);
          } else if (msg.type === 'hangup') {
            setStatus('ended');
          }
        } catch {
          setStatus('failed');
        }
      };

      const channel = openRoomChannel(room, { userId: myId, fullName: myName }, handleSignal);
      roomRef.current = channel;
      setStatus('waiting');
      channel.onPresence((participants) => {
        const otherHere = participants.some((p) => p.userId === otherUserId);
        if (otherHere && iOffer) sendOffer();
      });
    };

    setup();

    return () => {
      cancelled = true;
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

  const hangUp = () => {
    closedRef.current = true;
    roomRef.current?.send({ type: 'hangup', from: myId, to: otherUserId });
    onClose();
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setMicOn((v) => !v);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((tr) => { tr.enabled = !tr.enabled; });
    setCamOn((v) => !v);
  };

  // When the other person hangs up, close after a moment instead of
  // leaving a stuck "Call ended" screen (same as the phone app).
  useEffect(() => {
    if (status !== 'ended') return;
    const tm = setTimeout(() => { closedRef.current = true; onClose(); }, 1500);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Ring until they pick up, then show how long the call has run.
  const ringing = status === 'connecting' || status === 'waiting';
  useRingback(ringing);
  const timer = useCallTimer(status === 'connected');
  const displayName = otherName || title;
  const showVideo = kind === 'video' && hasRemote;

  const roundBtn = 'w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95';

  return (
    <div className="fixed inset-0 z-[1700] flex flex-col bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#030712] text-white">
      {kind === 'video' ? (
        <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover ${showVideo ? '' : 'hidden'}`} />
      ) : (
        <audio ref={remoteAudioRef} autoPlay />
      )}

      {/* Who you're talking to, phone style */}
      <div className={`relative flex-1 min-h-0 flex flex-col items-center ${showVideo ? 'justify-start pt-10' : 'justify-center'} gap-5 px-6 text-center`}>
        {!showVideo && <CallAvatar name={displayName} photo={otherPhoto} size={136} ringing={ringing} />}
        <div className={showVideo ? 'px-4 py-2 rounded-2xl bg-black/40 backdrop-blur' : ''}>
          <p className="text-2xl font-bold">{displayName}</p>
          <p className="mt-1 text-sm text-white/70">
            {status === 'connected' ? timer : STATUS_LABEL[status]}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-white/40">{kind === 'video' ? 'Video call' : 'Voice call'}</p>
        </div>
      </div>

      {kind === 'video' && (
        <video
          ref={localVideoRef} autoPlay playsInline muted
          className={`absolute top-4 right-4 w-28 h-40 sm:w-40 sm:h-56 object-cover rounded-2xl border border-white/25 shadow-2xl -scale-x-100 ${camOn ? '' : 'hidden'}`}
        />
      )}

      {/* Controls */}
      <div className="relative flex items-center justify-center gap-6 pb-12 pt-6">
        <div className="flex flex-col items-center gap-1.5">
          <button onClick={toggleMic} title={micOn ? 'Mute' : 'Unmute'} className={`${roundBtn} ${micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-[#0f172a]'}`}>
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          <span className="text-[11px] text-white/60">{micOn ? 'Mute' : 'Unmute'}</span>
        </div>
        {kind === 'video' && (
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={toggleCamera} title={camOn ? 'Turn camera off' : 'Turn camera on'} className={`${roundBtn} ${camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-[#0f172a]'}`}>
              {camOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
            <span className="text-[11px] text-white/60">Camera</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-1.5">
          <button onClick={hangUp} title="End call" className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-lg shadow-red-500/30">
            <Phone size={26} className="rotate-[135deg]" />
          </button>
          <span className="text-[11px] text-white/60">End</span>
        </div>
      </div>
    </div>
  );
}
