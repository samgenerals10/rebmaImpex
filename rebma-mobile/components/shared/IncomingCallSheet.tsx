// rebma-mobile/components/shared/IncomingCallSheet.tsx
//
// Rings like a phone (ringtone and vibration) when someone starts a call
// in a chat you belong to. Same behaviour as the web app's
// IncomingCallAlert.tsx: a call is a chat_messages row with attachment_type
// 'call', the database only sends you rows from chats you're in, muted
// chats don't ring, and an unanswered ring stops after 45 seconds.
// Accept opens the chat and joins the call; Decline dismisses it.
//
// Rings while the app is open. When the app is closed, the existing push
// notification for the call is what reaches the person.
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { messenger } from '../../lib/messenger';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { navigationRef } from '../../navigation/navigationRef';
import { CallAvatar, useRingtone } from './callUi';

interface IncomingCall {
  meetingId: string;
  channelId: string;
  channelType: string;
  callerName: string;
  callerPhoto: string | null;
  chatName: string | null;
  isVideo: boolean;
}

const RING_SECONDS = 45;

export default function IncomingCallSheet() {
  const t = useTheme();
  const myId = useAuthStore((s) => s.profile?.id) || '';
  const [call, setCall] = useState<IncomingCall | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRingtone(!!call);

  const dismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setCall(null);
  };

  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel('incoming-calls-' + myId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'attachment_type=eq.call' }, async (payload) => {
        const row = payload.new as any;
        if (!row?.attachment_url || row.sender_id === myId) return;
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
          channelType: channel?.type || 'group',
          callerName: caller?.full_name || row.sender || 'Someone',
          callerPhoto: caller?.photo || null,
          chatName: channel?.type === 'dm' ? null : channel?.type === 'everyone' ? 'Everyone' : channel?.name || 'Group',
          isVideo: String(row.content || '').toLowerCase().includes('video'),
        });
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCall(null), RING_SECONDS * 1000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [myId]);

  const accept = () => {
    if (!call) return;
    const c = call;
    dismiss();
    if (!navigationRef.isReady()) return;
    const nav = navigationRef.navigate as (name: string, params?: object) => void;
    nav('Messenger', {
      screen: 'MessengerThread',
      params: {
        channelId: c.channelId,
        channelType: c.channelType,
        title: c.channelType === 'dm' ? c.callerName : c.chatName || 'Group',
        subtitle: c.channelType === 'everyone' ? 'Company-wide broadcast' : undefined,
        joinCallMeetingId: c.meetingId,
      },
    });
  };

  if (!call) return null;

  const label = { fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: 'rgba(255,255,255,0.7)', marginTop: 8 };
  const roundBtn = (bg: string) => ({ width: 72, height: 72, borderRadius: 36, backgroundColor: bg, alignItems: 'center' as const, justifyContent: 'center' as const });

  return (
    <Modal visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 48, paddingHorizontal: 24 }}>
          <View style={{ alignItems: 'center', gap: 26, marginTop: 24 }}>
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, letterSpacing: 3, color: 'rgba(255,255,255,0.5)' }}>
              {call.isVideo ? 'INCOMING VIDEO CALL' : 'INCOMING VOICE CALL'}
            </Text>
            <CallAvatar name={call.callerName} photo={call.callerPhoto} size={140} ringing />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: 30, color: '#fff', textAlign: 'center' }} numberOfLines={1}>{call.callerName}</Text>
              {call.chatName && <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>in {call.chatName}</Text>}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 80 }}>
            <View style={{ alignItems: 'center' }}>
              <Pressable onPress={dismiss} accessibilityLabel="Decline" style={roundBtn('#ef4444')}>
                <PhoneOff size={28} color="#fff" />
              </Pressable>
              <Text style={label}>Decline</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Pressable onPress={accept} accessibilityLabel="Accept" style={roundBtn('#10b981')}>
                {call.isVideo ? <Video size={28} color="#fff" /> : <Phone size={28} color="#fff" />}
              </Pressable>
              <Text style={label}>Accept</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
