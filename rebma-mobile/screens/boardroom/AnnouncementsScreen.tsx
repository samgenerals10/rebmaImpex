// rebma-mobile/screens/boardroom/AnnouncementsScreen.tsx
// Ports: rebma-web/src/views/BoardroomView.tsx's Announcements branch
// (lines 392-440) — D79. Public, unfiltered `chat_messages` where
// `receiver IS NULL`. Send is a plain direct insert (matching the
// simpler of web's two real send paths, `sendChatMessage`), followed by
// a reload — not web's optimistic-insert-then-realtime-reconcile dance.
// No realtime subscription (D80) — polls every 8s while mounted, same
// interval-reload shape PendingApprovalsAlertCard already established
// (Phase 7.5). No role-gating on web (any authenticated Boardroom user
// can post) — replicated as-is.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Send } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';

interface Msg { id: string; sender: string; content: string; time: string; created_at: string }

export default function AnnouncementsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('chat_messages').select('id, sender, content, time, created_at').is('receiver', null).order('created_at', { ascending: true }).limit(200);
    setMessages((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        sender: profile?.fullName || profile?.department || 'Staff Member',
        sender_id: profile?.id || null,
        content: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        receiver: null,
      });
      setText('');
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, padding: t.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Input value={text} onChangeText={setText} placeholder="Type an announcement to the entire team..." />
          </View>
          <Button label="" icon={<Send size={16} color="#fff" />} onPress={send} loading={sending} disabled={sending || !text.trim()} />
        </View>
      }
    >
      {loading ? null : messages.length === 0 ? (
        <EmptyState title="No announcements logged" description="Be the first to post!" />
      ) : (
        <View style={{ gap: t.spacing.md }}>
          {messages.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>{m.sender[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{m.sender}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{m.time}</Text>
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{m.content}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
