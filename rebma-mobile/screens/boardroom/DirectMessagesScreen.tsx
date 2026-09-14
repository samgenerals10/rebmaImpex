// rebma-mobile/screens/boardroom/DirectMessagesScreen.tsx
// Ports: rebma-web/src/views/BoardroomView.tsx's DirectMessages branch
// (lines 442-526) — D79. A fixed 10-department mailbox (NOT 1:1 or
// Slack-channel messaging — confirmed by direct source read, and
// confirmed distinct from the separate, unwired channels/Messenger.tsx
// system elsewhere in the codebase). Same chat_messages table as
// Announcements, receiver = the selected department code. Same
// direct-insert-then-reload send path and 8s poll as AnnouncementsScreen
// (D79/D80) — no realtime.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Send } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';

const DEPARTMENTS = ['CEO', 'MANAGEMENT', 'FINANCE', 'OPERATIONS', 'MARKETING', 'HR', 'PRODUCTION', 'RECEPTION', 'DISPATCH', 'LOGISTICS'];

interface Msg { id: string; sender: string; content: string; time: string; receiver: string | null; created_at: string }

export default function DirectMessagesScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const userRole = profile?.department || 'CEO';
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS.find((d) => d !== userRole) || 'FINANCE');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, sender, content, time, receiver, created_at')
      .not('receiver', 'is', null)
      .order('created_at', { ascending: true })
      .limit(300);
    setMessages((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const thread = messages.filter(
    (m) =>
      (m.sender === userRole && m.receiver === selectedDept) ||
      (m.sender === selectedDept && m.receiver === userRole) ||
      (m.receiver === selectedDept && m.sender === profile?.fullName)
  );

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await supabase.from('chat_messages').insert({
        sender: profile?.fullName || userRole || 'Staff Member',
        sender_id: profile?.id || null,
        content: text.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        receiver: selectedDept,
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
            <Input value={text} onChangeText={setText} placeholder={`Send direct message to ${selectedDept}...`} />
          </View>
          <Button label="" icon={<Send size={16} color="#fff" />} onPress={send} loading={sending} disabled={sending || !text.trim()} />
        </View>
      }
    >
      <View style={{ gap: t.spacing.lg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
            {DEPARTMENTS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setSelectedDept(d)}
                style={{
                  paddingVertical: 8, paddingHorizontal: 14, borderRadius: t.radius.pill,
                  backgroundColor: selectedDept === d ? t.colors.accent : t.colors.bgCard,
                  borderWidth: 1, borderColor: selectedDept === d ? t.colors.accent : t.colors.border,
                }}
              >
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: selectedDept === d ? t.colors.onAccent : t.colors.textSecondary }}>
                  {d}{d === userRole ? ' · You' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? null : thread.length === 0 ? (
          <EmptyState title="No message thread yet" description={`No message thread history found with ${selectedDept} desk.`} />
        ) : (
          <View style={{ gap: t.spacing.md }}>
            {thread.map((m) => {
              const isMine = m.sender === profile?.fullName || m.sender === userRole;
              return (
                <View key={m.id} style={{ flexDirection: 'row', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={{
                      maxWidth: '80%', padding: t.spacing.sm, borderRadius: t.radius.md, borderWidth: 1,
                      backgroundColor: isMine ? t.colors.accent : t.colors.bgPage,
                      borderColor: isMine ? t.colors.accent : t.colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md, marginBottom: 2 }}>
                      <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: isMine ? t.colors.onAccent : t.colors.textPrimary }}>{isMine ? 'You' : m.sender}</Text>
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: isMine ? 'rgba(255,255,255,0.7)' : t.colors.textMuted }}>{m.time}</Text>
                    </View>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: isMine ? t.colors.onAccent : t.colors.textPrimary }}>{m.content}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}
