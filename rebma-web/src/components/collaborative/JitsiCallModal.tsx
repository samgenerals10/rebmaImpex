// rebma-web/src/components/collaborative/JitsiCallModal.tsx
// Real Jitsi Meet embed, parameterized by room name — same underlying
// technology as the Boardroom's video stream, but usable for any ad-hoc
// call or scheduled meeting instead of one hardcoded company-wide room.
import { X, Phone, Video } from 'lucide-react';

interface Props {
  room: string;
  title: string;
  kind: 'voice' | 'video';
  onClose: () => void;
}

export default function JitsiCallModal({ room, title, kind, onClose }: Props) {
  const src = `https://meet.jit.si/${room}#config.startWithVideoMuted=${kind === 'voice'}&config.startWithAudioMuted=false`;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            {kind === 'voice' ? <Phone size={16} className="text-[var(--accent)]" /> : <Video size={16} className="text-[var(--accent)]" />}
            <h3 className="font-bold text-sm text-[var(--text-primary)]">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <iframe
          src={src}
          style={{ border: 0, width: '100%', height: '100%' }}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
        ></iframe>
      </div>
    </div>
  );
}
