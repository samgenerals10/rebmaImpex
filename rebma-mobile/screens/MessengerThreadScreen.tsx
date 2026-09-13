// rebma-mobile/screens/MessengerThreadScreen.tsx
// Phase 11.0 — mobile's real Messenger, one thread. Ports:
// rebma-web/src/components/collaborative/Messenger.tsx's main panel
// (attachments, reactions, threaded replies, read receipts, typing
// indicator, realtime) for the channel the caller navigated in with.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, Image } from 'react-native';
import { Send, Paperclip, Smile, Reply, X, Check, CheckCheck, FileText } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { messenger, type ChatMessage } from '../lib/messenger';
import { pickOrCaptureImageAsset, pickDocument } from '../lib/media';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { usePresets } from '../theme/presets';
import Screen from '../components/ui/Screen';
import Sheet from '../components/ui/Sheet';
import StickyActionBar from '../components/ui/StickyActionBar';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👏'];

export default function MessengerThreadScreen({ route }: any) {
  const { channelId, channelType, title, subtitle } = route.params as { channelId: string; channelType: string; title: string; subtitle?: string };
  const t = useTheme();
  const p = usePresets();
  const me = useAuthStore((s) => s.profile);
  const myId = me?.id || '';
  const myName = me?.fullName || 'Me';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const [reads, setReads] = useState<Record<string, string[]>>({});
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const memberIds = useRef<string[]>([]);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<any>(null);

  const loadThread = useCallback(async () => {
    const msgs = await messenger.fetchMessages(channelId);
    setMessages(msgs);
    const ids = msgs.map((m) => m.id);
    const [rx, rd] = await Promise.all([messenger.fetchReactions(ids), messenger.fetchReads(ids)]);
    const rxMap: Record<string, { emoji: string; user_id: string }[]> = {};
    for (const r of rx) (rxMap[r.message_id] ||= []).push({ emoji: r.emoji, user_id: r.user_id });
    setReactions(rxMap);
    const rdMap: Record<string, string[]> = {};
    for (const r of rd) (rdMap[r.message_id] ||= []).push(r.user_id);
    setReads(rdMap);
    for (const m of msgs) {
      if (m.sender_id !== myId) messenger.markRead(m.id, myId);
    }
  }, [channelId, myId]);

  useEffect(() => { loadThread(); }, [loadThread]);

  useEffect(() => {
    supabase.from('channel_members').select('user_id').eq('channel_id', channelId).then(({ data }) => {
      memberIds.current = (data || []).map((m: any) => m.user_id);
    });
  }, [channelId]);

  // Realtime — scoped to this one screen instance, which mounts/unmounts
  // cleanly on push/pop, so no shared-singleton risk like the presence
  // channel (only one thread is ever open at a time on mobile).
  useEffect(() => {
    const ch = supabase
      .channel('messenger-thread-' + channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === (payload.new as any).id) ? prev : [...prev, payload.new as ChatMessage]));
        if ((payload.new as any).sender_id !== myId) messenger.markRead((payload.new as any).id, myId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => loadThread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reads' }, () => loadThread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId, loadThread, myId]);

  // Typing indicator presence — mirrors web's Messenger.tsx exactly.
  useEffect(() => {
    if (!myId) return;
    const presence = supabase.channel('presence-' + channelId, { config: { presence: { key: myId } } });
    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState();
      const names: string[] = [];
      Object.entries(state).forEach(([key, metas]: [string, any]) => {
        if (key === myId) return;
        const meta = metas[0];
        if (meta?.typing) names.push(meta.name);
      });
      setTypingNames(names);
    }).subscribe();
    presenceRef.current = presence;
    return () => { supabase.removeChannel(presence); };
  }, [channelId, myId]);

  const notifyTyping = () => {
    if (!presenceRef.current) return;
    presenceRef.current.track({ typing: true, name: myName });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { presenceRef.current?.track({ typing: false, name: myName }); }, 2000);
  };

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  // Resolve signed URLs for attachments lazily, same as web.
  useEffect(() => {
    const paths = messages.filter((m) => m.attachment_url && m.attachment_type !== 'call' && !attachmentUrls[m.attachment_url!]).map((m) => m.attachment_url!);
    if (paths.length === 0) return;
    (async () => {
      const entries: Record<string, string> = {};
      for (const path of paths) {
        const url = await messenger.getSignedAttachmentUrl(path);
        if (url) entries[path] = url;
      }
      setAttachmentUrls((prev) => ({ ...prev, ...entries }));
    })();
  }, [messages, attachmentUrls]);

  const notifyOthersOfMessage = (preview: string) => {
    if (channelType === 'everyone') return;
    const others = memberIds.current.filter((id) => id !== myId);
    if (others.length === 0) return;
    messenger.notifyUsers(others, 'chat_message', myName, preview.slice(0, 120), channelId).catch(() => {});
  };

  const handleSend = async () => {
    if (!composer.trim() || sending) return;
    const text = composer;
    setComposer('');
    const replying = replyTo;
    setReplyTo(null);
    setSending(true);
    try {
      await messenger.sendMessage(channelId, myId, myName, text, replying ? { replyToId: replying.id } : undefined);
      notifyOthersOfMessage(text);
    } catch (e: any) {
      Alert.alert('Failed to send', e.message);
    } finally {
      setSending(false);
    }
  };

  const handleAttach = () => {
    Alert.alert('Attach', undefined, [
      { text: 'Photo', onPress: attachPhoto },
      { text: 'Document', onPress: attachDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const attachPhoto = async () => {
    const asset = await pickOrCaptureImageAsset();
    if (!asset) return;
    try {
      const path = await messenger.uploadChatAttachment(asset.uri, asset.mimeType, channelId);
      await messenger.sendMessage(channelId, myId, myName, '📷 Photo', { attachmentUrl: path, attachmentType: 'image', attachmentName: 'photo' });
      notifyOthersOfMessage('📷 Photo');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  const attachDocument = async () => {
    const asset = await pickDocument();
    if (!asset) return;
    try {
      const name = asset.uri.split('/').pop() || 'file';
      const path = await messenger.uploadChatAttachment(asset.uri, asset.mimeType, channelId);
      await messenger.sendMessage(channelId, myId, myName, `📎 ${name}`, { attachmentUrl: path, attachmentType: 'file', attachmentName: name });
      notifyOthersOfMessage(`📎 ${name}`);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    await messenger.toggleReaction(messageId, myId, emoji);
    setReactionPickerFor(null);
    loadThread();
  };

  return (
    <Screen>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
        {messages.length === 0 && <Text style={{ ...p.meta, textAlign: 'center', paddingVertical: t.spacing.xxxl }}>No messages yet — say hello.</Text>}
        {messages.map((msg) => {
          const mine = msg.sender_id === myId;
          const quoted = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
          const msgReactions = reactions[msg.id] || [];
          const readByOthers = (reads[msg.id] || []).filter((uid) => uid !== myId).length > 0;
          const isImage = msg.attachment_type === 'image';
          const isFile = msg.attachment_type === 'file';
          return (
            <Pressable
              key={msg.id}
              onLongPress={() => {
                Alert.alert('Message options', undefined, [
                  { text: 'React', onPress: () => setReactionPickerFor(msg.id) },
                  { text: 'Reply', onPress: () => setReplyTo(msg) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
              style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}
            >
              <View style={{ maxWidth: '78%' }}>
                {!mine && channelType !== 'dm' && <Text style={{ ...p.meta, fontFamily: t.font.bold, marginBottom: 2, marginLeft: 4 }}>{msg.sender}</Text>}
                {quoted && (
                  <View style={{ marginBottom: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: t.colors.bgInput, borderLeftWidth: 2, borderLeftColor: t.colors.accent }}>
                    <Text numberOfLines={1} style={{ ...p.meta, fontSize: 10 }}>{quoted.sender}: {quoted.content}</Text>
                  </View>
                )}
                <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: mine ? t.colors.accent : t.colors.bgInput }}>
                  {isImage && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                    <Image source={{ uri: attachmentUrls[msg.attachment_url] }} style={{ width: 180, height: 180, borderRadius: 10, marginBottom: 4 }} resizeMode="cover" />
                  ) : isFile ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <FileText size={14} color={mine ? t.colors.onAccent : t.colors.textPrimary} />
                    </View>
                  ) : null}
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: mine ? t.colors.onAccent : t.colors.textPrimary }}>{msg.content}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <Text style={p.meta}>{msg.time}</Text>
                  {mine && (readByOthers ? <CheckCheck size={12} color={t.colors.accent} /> : <Check size={12} color={t.colors.textMuted} />)}
                </View>
                {msgReactions.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {Object.entries(
                      msgReactions.reduce((acc: Record<string, number>, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
                    ).map(([emoji, count]) => (
                      <Pressable key={emoji} onPress={() => toggleReaction(msg.id, emoji)} style={{ flexDirection: 'row', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border }}>
                        <Text style={{ fontSize: 12 }}>{emoji}</Text>
                        <Text style={{ ...p.meta, fontSize: 10 }}>{count}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
        {typingNames.length > 0 && (
          <Text style={{ ...p.meta, fontStyle: 'italic' }}>{typingNames.join(', ')} typing…</Text>
        )}
      </ScrollView>

      <StickyActionBar>
        {replyTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm, padding: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.sm }}>
            <Reply size={14} color={t.colors.accent} />
            <Text numberOfLines={1} style={{ ...p.meta, flex: 1 }}>Replying to {replyTo.sender}: {replyTo.content}</Text>
            <Pressable onPress={() => setReplyTo(null)}><X size={14} color={t.colors.textMuted} /></Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Pressable onPress={handleAttach} hitSlop={8} style={{ padding: 6 }}>
            <Paperclip size={18} color={t.colors.textMuted} />
          </Pressable>
          <TextInput
            value={composer}
            onChangeText={(v) => { setComposer(v); notifyTyping(); }}
            placeholder="Type a message…"
            placeholderTextColor={t.colors.textMuted}
            style={{ flex: 1, backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}
            onSubmitEditing={handleSend}
          />
          <Pressable onPress={handleSend} disabled={sending || !composer.trim()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: sending || !composer.trim() ? 0.5 : 1 }}>
            <Send size={15} color={t.colors.onAccent} />
          </Pressable>
        </View>
      </StickyActionBar>

      <Sheet open={!!reactionPickerFor} onClose={() => setReactionPickerFor(null)} title="React" side="bottom">
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: t.spacing.md }}>
          {REACTION_EMOJIS.map((emoji) => (
            <Pressable key={emoji} onPress={() => reactionPickerFor && toggleReaction(reactionPickerFor, emoji)}>
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
