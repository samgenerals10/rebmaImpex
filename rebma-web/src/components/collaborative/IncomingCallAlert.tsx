// rebma-web/src/components/collaborative/IncomingCallAlert.tsx
//
// Rings like a phone when someone starts a call in a chat you belong to.
// A call is a chat_messages row with attachment_type 'call' (posted by
// messenger.startCall); the database only sends you rows from chats you're
// in. Accept opens that chat and joins the call. Decline just dismisses it.
// Chats you've muted don't ring, and an unanswered ring stops after 45s.
import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { messenger } from '../../services/apiClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { CallAvatar, useRingtone } from './callUi';

interface IncomingCall {
  meetingId: string;
  channelId: string;
  callerName: string;
  callerPhoto: string | null;
  chatName: string | null;
  isVideo: boolean;
}

const RING_SECONDS = 45;

export default function IncomingCallAlert({ myId, onAccept }: { myId: string; onAccept: (channelId: string, meetingId: string) => void }) {
  const [call, setCall] = useState<IncomingCall | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRingtone(!!call);

  const dismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setCall(null);
  };
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  useRealtimeChannel('incoming-calls', [{ table: 'chat_messages', event: 'INSERT', filter: 'attachment_type=eq.call' }], async (_table, payload) => {
    const row = payload.new as any;
    if (!myId || !row?.attachment_url || row.sender_id === myId) return;
    // An old row replayed late is not a ringing call.
    if (row.created_at && Date.now() - new Date(row.created_at).getTime() > RING_SECONDS * 1000) return;

    const [muted, { data: channel }, { data: caller }] = await Promise.all([
      messenger.fetchMutedChannelIds(myId).catch(() => [] as string[]),
      supabase.from('channels').select('type, name').eq('id', row.channel_id).maybeSingle(),
      supabase.from('profiles_directory').select('full_name, photo').eq('id', row.sender_id).maybeSingle(),
    ]);
    if (muted.includes(row.channel_id)) return;

    setCall({
      meetingId: row.attachment_url,
      channelId: row.channel_id,
      callerName: caller?.full_name || row.sender || 'Someone',
      callerPhoto: caller?.photo || null,
      chatName: channel?.type === 'dm' ? null : channel?.type === 'everyone' ? 'Everyone' : channel?.name || 'Group',
      isVideo: String(row.content || '').toLowerCase().includes('video'),
    });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCall(null), RING_SECONDS * 1000);
  });

  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[1800] flex flex-col items-center justify-between bg-gradient-to-b from-[#0f172a] via-[#111827] to-[#030712] text-white py-16 px-6 text-center">
      <div className="flex flex-col items-center gap-6 mt-6">
        <p className="text-xs uppercase tracking-[0.25em] text-white/50">Incoming {call.isVideo ? 'video' : 'voice'} call</p>
        <CallAvatar name={call.callerName} photo={call.callerPhoto} size={140} ringing />
        <div>
          <p className="text-3xl font-bold">{call.callerName}</p>
          {call.chatName && <p className="mt-1 text-sm text-white/65">in {call.chatName}</p>}
        </div>
      </div>
      <div className="flex items-center gap-20">
        <div className="flex flex-col items-center gap-2">
          <button onClick={dismiss} title="Decline" className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-lg shadow-red-500/30">
            <PhoneOff size={26} />
          </button>
          <span className="text-xs text-white/70">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => { const c = call; dismiss(); onAccept(c.channelId, c.meetingId); }}
            title="Accept"
            className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-lg shadow-emerald-500/30 animate-bounce"
          >
            {call.isVideo ? <Video size={26} /> : <Phone size={26} />}
          </button>
          <span className="text-xs text-white/70">Accept</span>
        </div>
      </div>
    </div>
  );
}
