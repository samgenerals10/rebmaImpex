// rebma-mobile/screens/MessengerThreadScreen.tsx
// Phase 11.0/11.1 — mobile's real Messenger, one thread. Ports:
// rebma-web/src/components/collaborative/Messenger.tsx's main panel
// (attachments, reactions, threaded replies, read receipts, typing
// indicator, realtime, edit/delete/pin/forward/star/copy/search-within-
// conversation) for the channel the caller navigated in with.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, Image, Linking, Modal, Dimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import {
  Send, Paperclip, Smile, Reply, X, Check, CheckCheck, FileText,
  Pin, Star, Pencil, Trash2, Forward, Copy, MoreVertical, Search, Users, Bell, BellOff,
  Images, Mic, Square, Play, Pause, Download,
} from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { messenger, type ChatMessage, type Channel } from '../lib/messenger';
import { pickOrCaptureImageAsset, pickDocument, pickMultipleImageAssets, validateAttachment } from '../lib/media';
import { subscribeToLiveUsers, type PresencePayload } from '../lib/presence';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { usePresets } from '../theme/presets';
import Screen from '../components/ui/Screen';
import Sheet from '../components/ui/Sheet';
import Avatar from '../components/ui/Avatar';
import StickyActionBar from '../components/ui/StickyActionBar';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👏'];

function initials(name: string) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

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
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [forwardChannels, setForwardChannels] = useState<Channel[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  // Phase 11.2 — online status, mute, mentions, read-list.
  const [profiles, setProfiles] = useState<{ id: string; fullName: string; department: string }[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [readListFor, setReadListFor] = useState<string | null>(null);
  // Phase 11.3 — attachments & media.
  const [pdfPreviewFor, setPdfPreviewFor] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const scrollRef = useRef<ScrollView>(null);
  const memberIds = useRef<string[]>([]);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<any>(null);

  const loadThread = useCallback(async () => {
    const all = await messenger.fetchMessages(channelId);
    const allIds = all.map((m) => m.id);
    const hiddenIds = new Set(await messenger.fetchHiddenMessageIds(myId, allIds));
    const msgs = all.filter((m) => !hiddenIds.has(m.id));
    setMessages(msgs);
    const ids = msgs.map((m) => m.id);
    const [rx, rd, starred, pins] = await Promise.all([
      messenger.fetchReactions(ids), messenger.fetchReads(ids), messenger.fetchStars(myId, ids), messenger.fetchPinned(channelId),
    ]);
    const rxMap: Record<string, { emoji: string; user_id: string }[]> = {};
    for (const r of rx) (rxMap[r.message_id] ||= []).push({ emoji: r.emoji, user_id: r.user_id });
    setReactions(rxMap);
    const rdMap: Record<string, string[]> = {};
    for (const r of rd) (rdMap[r.message_id] ||= []).push(r.user_id);
    setReads(rdMap);
    setStarredIds(new Set(starred));
    setPinnedIds(new Set(pins.map((pin) => pin.message_id)));
    for (const m of msgs) {
      if (m.sender_id !== myId && !m.deleted_at) messenger.markRead(m.id, myId);
    }
  }, [channelId, myId]);

  useEffect(() => { loadThread(); }, [loadThread]);

  useEffect(() => {
    supabase.from('channel_members').select('user_id').eq('channel_id', channelId).then(({ data }) => {
      memberIds.current = (data || []).map((m: any) => m.user_id);
    });
  }, [channelId]);

  // For @mention autocomplete + "read by" names — the full active
  // directory, same source MessengerChannelsScreen uses.
  useEffect(() => {
    supabase.from('profiles_directory').select('id, full_name, department').eq('status', 'ACTIVE').then(({ data }) => {
      setProfiles((data || []).map((row: any) => ({ id: row.id, fullName: row.full_name || 'Unknown', department: row.department || '' })));
    });
  }, []);

  // Who's online right now — same shared presence channel Live Users and
  // the channel list already use.
  useEffect(() => {
    return subscribeToLiveUsers((users: PresencePayload[]) => setOnlineIds(new Set(users.map((u) => u.userId))));
  }, []);

  useEffect(() => {
    if (!myId) return;
    messenger.fetchMutedChannelIds(myId).then((ids) => setMuted(ids.includes(channelId)));
  }, [myId, channelId]);

  const toggleMute = async () => {
    await messenger.toggleMute(channelId, myId);
    setMuted((v) => !v);
  };

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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` }, (payload) => {
        setMessages((prev) => prev.map((m) => (m.id === (payload.new as any).id ? (payload.new as ChatMessage) : m)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => loadThread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reads' }, () => loadThread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_pinned_messages' }, () => loadThread())
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

  // Resolve signed URLs for attachments lazily, same as web — includes
  // both the single-attachment column and every path inside a
  // multi-image message.
  useEffect(() => {
    const single = messages.filter((m) => m.attachment_url && m.attachment_type !== 'call' && !attachmentUrls[m.attachment_url!]).map((m) => m.attachment_url!);
    const multi = messages.flatMap((m) => (m.attachment_urls || []).filter((p) => !attachmentUrls[p]));
    const paths = Array.from(new Set([...single, ...multi]));
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

  // Muted recipients (Phase 11.2) are filtered out here — @mentions use a
  // separate notify call below that always fires, mute or not.
  const notifyOthersOfMessage = async (preview: string, targetChannelId = channelId, targetType = channelType, targetMembers = memberIds.current) => {
    if (targetType === 'everyone') return;
    const others = targetMembers.filter((id) => id !== myId);
    if (others.length === 0) return;
    try {
      const mutedIds = await messenger.fetchMutedUserIds(targetChannelId, others);
      const toNotify = others.filter((id) => !mutedIds.includes(id));
      if (toNotify.length > 0) await messenger.notifyUsers(toNotify, 'chat_message', myName, preview.slice(0, 120), targetChannelId);
    } catch { /* best-effort */ }
  };

  // @mentions — matched against this channel's own member list, same as
  // web. Deliberately skips the mute filter above.
  const notifyMentions = (text: string) => {
    const mentioned = profiles.filter((pr) => memberIds.current.includes(pr.id) && text.includes('@' + pr.fullName));
    if (mentioned.length === 0) return;
    messenger.notifyUsers(mentioned.map((pr) => pr.id), 'chat_mention', myName, `mentioned you: ${text.slice(0, 100)}`, channelId).catch(() => {});
  };

  const handleComposerChange = (value: string) => {
    setComposer(value);
    notifyTyping();
    const match = value.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (fullName: string) => {
    setComposer((prev) => prev.replace(/@([^\s@]*)$/, `@${fullName} `));
    setMentionQuery(null);
  };

  const mentionCandidates = mentionQuery !== null
    ? profiles.filter((pr) => memberIds.current.includes(pr.id) && pr.fullName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  const handleSend = async () => {
    if (!composer.trim() || sending) return;
    const text = composer;
    setComposer('');
    setMentionQuery(null);
    const replying = replyTo;
    setReplyTo(null);
    setSending(true);
    try {
      await messenger.sendMessage(channelId, myId, myName, text, replying ? { replyToId: replying.id } : undefined);
      notifyOthersOfMessage(text);
      notifyMentions(text);
    } catch (e: any) {
      Alert.alert('Failed to send', e.message);
    } finally {
      setSending(false);
    }
  };

  const handleAttach = () => {
    Alert.alert('Attach', undefined, [
      { text: 'Photo', onPress: attachPhoto },
      { text: 'Multiple Photos', onPress: attachMultiplePhotos },
      { text: 'Document', onPress: attachDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const attachPhoto = async () => {
    const asset = await pickOrCaptureImageAsset();
    if (!asset) return;
    const err = validateAttachment(asset.mimeType, asset.size);
    if (err) { Alert.alert('Can\'t attach that', err); return; }
    try {
      const path = await messenger.uploadChatAttachment(asset.uri, asset.mimeType, channelId);
      await messenger.sendMessage(channelId, myId, myName, '📷 Photo', { attachmentUrl: path, attachmentType: 'image', attachmentName: 'photo' });
      notifyOthersOfMessage('📷 Photo');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  // Phase 11.3 — several photos sent together as one bubble.
  const attachMultiplePhotos = async () => {
    const assets = await pickMultipleImageAssets();
    if (!assets || assets.length === 0) return;
    if (assets.length === 1) {
      const err = validateAttachment(assets[0].mimeType, assets[0].size);
      if (err) { Alert.alert("Can't attach that", err); return; }
      try {
        const path = await messenger.uploadChatAttachment(assets[0].uri, assets[0].mimeType, channelId);
        await messenger.sendMessage(channelId, myId, myName, '📷 Photo', { attachmentUrl: path, attachmentType: 'image', attachmentName: 'photo' });
        notifyOthersOfMessage('📷 Photo');
      } catch (e: any) { Alert.alert('Upload failed', e.message); }
      return;
    }
    for (const a of assets) {
      const err = validateAttachment(a.mimeType, a.size);
      if (err) { Alert.alert("Can't attach that", err); return; }
    }
    try {
      const paths = await Promise.all(assets.map((a) => messenger.uploadChatAttachment(a.uri, a.mimeType, channelId)));
      const preview = `📷 ${assets.length} Photos`;
      await messenger.sendMessage(channelId, myId, myName, preview, { attachmentUrls: paths, attachmentType: 'image' });
      notifyOthersOfMessage(preview);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  const attachDocument = async () => {
    const asset = await pickDocument();
    if (!asset) return;
    const err = validateAttachment(asset.mimeType, asset.size);
    if (err) { Alert.alert("Can't attach that", err); return; }
    try {
      const name = asset.uri.split('/').pop() || 'file';
      const path = await messenger.uploadChatAttachment(asset.uri, asset.mimeType, channelId);
      await messenger.sendMessage(channelId, myId, myName, `📎 ${name}`, { attachmentUrl: path, attachmentType: 'file', attachmentName: name });
      notifyOthersOfMessage(`📎 ${name}`);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  // Phase 11.3 — voice notes via expo-audio. Records to the app's cache
  // dir, uploads through the exact same chat-attachments path a photo
  // already goes through.
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const startVoiceRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Microphone permission needed', 'Enable microphone access in your device settings to record a voice note.');
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e: any) {
      Alert.alert('Failed to start recording', e.message);
    }
  };

  const stopVoiceRecording = async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;
      const path = await messenger.uploadChatAttachment(uri, 'audio/m4a', channelId);
      await messenger.sendMessage(channelId, myId, myName, '🎤 Voice note', { attachmentUrl: path, attachmentType: 'audio', attachmentName: 'voice-note.m4a' });
      notifyOthersOfMessage('🎤 Voice note');
    } catch (e: any) {
      Alert.alert('Voice note failed', e.message);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    await messenger.toggleReaction(messageId, myId, emoji);
    setReactionPickerFor(null);
    loadThread();
  };

  // ── Phase 11.1: core message actions ──
  const startEdit = (msg: ChatMessage) => { setEditingMessage(msg); setEditText(msg.content); setActionMenuFor(null); };

  const saveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      await messenger.editMessage(editingMessage.id, myId, editText.trim());
      setMessages((prev) => prev.map((m) => (m.id === editingMessage.id ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m)));
    } catch (e: any) {
      Alert.alert('Edit failed', e.message);
    }
    setEditingMessage(null);
    setEditText('');
  };

  const deleteForMe = async (msg: ChatMessage) => {
    await messenger.deleteMessageForMe(msg.id, myId);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setActionMenuFor(null);
  };

  const deleteForEveryone = async (msg: ChatMessage) => {
    if (msg.sender_id !== myId) return;
    try {
      await messenger.deleteMessageForEveryone(msg.id, myId);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, content: '', attachment_url: null, deleted_at: new Date().toISOString() } : m)));
    } catch (e: any) {
      Alert.alert('Delete failed', e.message);
    }
    setActionMenuFor(null);
  };

  const toggleStarMessage = async (msg: ChatMessage) => {
    await messenger.toggleStar(msg.id, myId);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
      return next;
    });
    setActionMenuFor(null);
  };

  const togglePinMessage = async (msg: ChatMessage) => {
    await messenger.togglePin(channelId, msg.id, myId, myName);
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
      return next;
    });
    setActionMenuFor(null);
  };

  const copyMessage = async (msg: ChatMessage) => {
    await Clipboard.setStringAsync(msg.content);
    setActionMenuFor(null);
  };

  const openForward = async (msg: ChatMessage) => {
    setActionMenuFor(null);
    setForwardTarget(msg);
    if (!me) return;
    const chans = await messenger.listMyChannels(me.id);
    setForwardChannels(chans);
  };

  const forwardMessage = async (target: Channel) => {
    if (!forwardTarget || !me) return;
    try {
      await messenger.sendMessage(target.id, myId, myName, forwardTarget.content, {
        attachmentUrl: forwardTarget.attachment_url || undefined,
        attachmentType: forwardTarget.attachment_type || undefined,
        attachmentName: forwardTarget.attachment_name || undefined,
        forwardedFromId: forwardTarget.id,
      });
      const { data: members } = await supabase.from('channel_members').select('user_id').eq('channel_id', target.id);
      notifyOthersOfMessage(forwardTarget.content, target.id, target.type, (members || []).map((mm: any) => mm.user_id));
    } catch (e: any) {
      Alert.alert('Forward failed', e.message);
    }
    setForwardTarget(null);
  };

  const visibleMessages = messages.filter((m) => {
    if (starredOnly && !starredIds.has(m.id)) return false;
    if (search.trim() && !m.content.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });
  const pinnedMessages = messages.filter((m) => pinnedIds.has(m.id));

  const otherOnline = channelType === 'dm' && memberIds.current.some((id) => id !== myId && onlineIds.has(id));

  return (
    <Screen>
      {otherOnline && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.status.success.text }} />
          <Text style={p.meta}>Online</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
        {pinnedMessages.length > 0 && (
          <Pressable onPress={() => setShowPinned(true)} hitSlop={8} style={{ padding: 4, position: 'relative' }}>
            <Pin size={17} color={t.colors.accent} />
            <View style={{ position: 'absolute', top: 0, right: 0, minWidth: 13, height: 13, borderRadius: 7, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 8, fontFamily: t.font.bold, color: t.colors.onAccent }}>{pinnedMessages.length}</Text>
            </View>
          </Pressable>
        )}
        <Pressable onPress={() => setStarredOnly((v) => !v)} hitSlop={8} style={{ padding: 4 }}>
          <Star size={17} color={starredOnly ? '#f59e0b' : t.colors.textMuted} fill={starredOnly ? '#f59e0b' : 'none'} />
        </Pressable>
        <Pressable onPress={() => setShowSearch((v) => !v)} hitSlop={8} style={{ padding: 4 }}>
          <Search size={17} color={showSearch ? t.colors.accent : t.colors.textMuted} />
        </Pressable>
        <Pressable onPress={toggleMute} hitSlop={8} style={{ padding: 4 }}>
          {muted ? <BellOff size={17} color={t.colors.textMuted} /> : <Bell size={17} color={t.colors.textMuted} />}
        </Pressable>
        {messages.some((m) => m.attachment_type === 'image') && (
          <Pressable onPress={() => setShowGallery(true)} hitSlop={8} style={{ padding: 4 }}>
            <Images size={17} color={t.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {showSearch && (
        <View style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm }}>
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search this conversation…"
            placeholderTextColor={t.colors.textMuted}
            style={{ backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.sm, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}
          />
        </View>
      )}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
        {messages.length === 0 && <Text style={{ ...p.meta, textAlign: 'center', paddingVertical: t.spacing.xxxl }}>No messages yet — say hello.</Text>}
        {messages.length > 0 && visibleMessages.length === 0 && (
          <Text style={{ ...p.meta, textAlign: 'center', paddingVertical: t.spacing.xxxl }}>{starredOnly ? 'No starred messages.' : 'No messages match your search.'}</Text>
        )}
        {visibleMessages.map((msg) => {
          const mine = msg.sender_id === myId;
          const quoted = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
          const msgReactions = reactions[msg.id] || [];
          const readByOthers = (reads[msg.id] || []).filter((uid) => uid !== myId).length > 0;
          const isImage = msg.attachment_type === 'image';
          const isFile = msg.attachment_type === 'file';
          const isDeleted = !!msg.deleted_at;
          const isStarred = starredIds.has(msg.id);
          const isPinned = pinnedIds.has(msg.id);
          return (
            <Pressable
              key={msg.id}
              onLongPress={() => !isDeleted && setActionMenuFor(msg)}
              style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}
            >
              <View style={{ maxWidth: '78%' }}>
                {!mine && channelType !== 'dm' && <Text style={{ ...p.meta, fontFamily: t.font.bold, marginBottom: 2, marginLeft: 4 }}>{msg.sender}</Text>}
                {msg.forwarded_from_id && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <Forward size={9} color={t.colors.textMuted} />
                    <Text style={{ ...p.meta, fontStyle: 'italic', fontSize: 9 }}>Forwarded</Text>
                  </View>
                )}
                {quoted && !isDeleted && (
                  <View style={{ marginBottom: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: t.colors.bgInput, borderLeftWidth: 2, borderLeftColor: t.colors.accent }}>
                    <Text numberOfLines={1} style={{ ...p.meta, fontSize: 10 }}>{quoted.sender}: {quoted.deleted_at ? 'This message was deleted' : quoted.content}</Text>
                  </View>
                )}
                <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: mine ? t.colors.accent : t.colors.bgInput }}>
                  {isDeleted ? (
                    <Text style={{ fontFamily: t.font.regular, fontStyle: 'italic', fontSize: t.type.body14.size, color: mine ? 'rgba(255,255,255,0.7)' : t.colors.textMuted }}>This message was deleted</Text>
                  ) : (
                    <>
                      {isImage && msg.attachment_urls && msg.attachment_urls.length > 1 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4, width: 176 }}>
                          {msg.attachment_urls.map((path, i) => attachmentUrls[path] ? (
                            <Pressable key={path} onPress={() => setLightbox({ urls: msg.attachment_urls!.map((p) => attachmentUrls[p]).filter(Boolean), index: i })}>
                              <Image source={{ uri: attachmentUrls[path] }} style={{ width: 86, height: 86, borderRadius: 8 }} resizeMode="cover" />
                            </Pressable>
                          ) : <View key={path} style={{ width: 86, height: 86, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' }} />)}
                        </View>
                      ) : isImage && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                        <Pressable onPress={() => setLightbox({ urls: [attachmentUrls[msg.attachment_url!]], index: 0 })}>
                          <Image source={{ uri: attachmentUrls[msg.attachment_url] }} style={{ width: 180, height: 180, borderRadius: 10, marginBottom: 4 }} resizeMode="cover" />
                        </Pressable>
                      ) : msg.attachment_type === 'audio' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                        <VoiceNoteBubble uri={attachmentUrls[msg.attachment_url]} mine={mine} />
                      ) : isFile ? (
                        <View style={{ marginBottom: 4 }}>
                          <Pressable
                            onPress={() => msg.attachment_url && attachmentUrls[msg.attachment_url] && Linking.openURL(attachmentUrls[msg.attachment_url])}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                          >
                            <FileText size={14} color={mine ? t.colors.onAccent : t.colors.textPrimary} />
                            <Text numberOfLines={1} style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: mine ? t.colors.onAccent : t.colors.accent, textDecorationLine: 'underline', maxWidth: 150 }}>
                              {msg.attachment_name || 'File'}
                            </Text>
                            <Download size={11} color={mine ? t.colors.onAccent : t.colors.accent} />
                          </Pressable>
                        </View>
                      ) : null}
                      <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: mine ? t.colors.onAccent : t.colors.textPrimary }}>{msg.content}</Text>
                    </>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {isPinned && <Pin size={9} color={t.colors.textMuted} />}
                  {isStarred && <Star size={9} color="#f59e0b" fill="#f59e0b" />}
                  {msg.edited_at && !isDeleted && <Text style={p.meta}>(edited)</Text>}
                  <Text style={p.meta}>{msg.time}</Text>
                  {mine && (
                    <Pressable onPress={() => setReadListFor(msg.id)} hitSlop={6}>
                      {readByOthers ? <CheckCheck size={12} color={t.colors.accent} /> : <Check size={12} color={t.colors.textMuted} />}
                    </Pressable>
                  )}
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
        {replyTo && !editingMessage && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm, padding: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.sm }}>
            <Reply size={14} color={t.colors.accent} />
            <Text numberOfLines={1} style={{ ...p.meta, flex: 1 }}>Replying to {replyTo.sender}: {replyTo.content}</Text>
            <Pressable onPress={() => setReplyTo(null)}><X size={14} color={t.colors.textMuted} /></Pressable>
          </View>
        )}
        {editingMessage && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm, padding: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.sm }}>
            <Pencil size={14} color="#f59e0b" />
            <Text style={{ ...p.meta, flex: 1 }}>Editing message</Text>
            <Pressable onPress={() => { setEditingMessage(null); setEditText(''); }}><X size={14} color={t.colors.textMuted} /></Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          {editingMessage ? (
            <>
              <TextInput
                autoFocus
                value={editText}
                onChangeText={setEditText}
                style={{ flex: 1, backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: '#f59e0b', borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}
                onSubmitEditing={saveEdit}
              />
              <Pressable onPress={saveEdit} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={15} color={t.colors.onAccent} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={handleAttach} hitSlop={8} style={{ padding: 6 }}>
                <Paperclip size={18} color={t.colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={recorderState.isRecording ? stopVoiceRecording : startVoiceRecording}
                hitSlop={8}
                style={{ padding: 6, borderRadius: 14, backgroundColor: recorderState.isRecording ? t.colors.status.danger.text : 'transparent' }}
              >
                {recorderState.isRecording ? <Square size={16} color={t.colors.onAccent} /> : <Mic size={18} color={t.colors.textMuted} />}
              </Pressable>
              <View style={{ flex: 1 }}>
                {mentionCandidates.length > 0 && (
                  <View style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, backgroundColor: t.colors.bgCard, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, paddingVertical: 4, ...t.shadow('dropdown') }}>
                    {mentionCandidates.map((pr) => (
                      <Pressable key={pr.id} onPress={() => insertMention(pr.fullName)} style={{ paddingHorizontal: t.spacing.md, paddingVertical: 6 }}>
                        <Text style={{ ...p.body, fontFamily: t.font.semibold }}>@{pr.fullName} <Text style={p.meta}>{pr.department}</Text></Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  value={composer}
                  onChangeText={handleComposerChange}
                  placeholder="Type a message…"
                  placeholderTextColor={t.colors.textMuted}
                  style={{ backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}
                  onSubmitEditing={handleSend}
                />
              </View>
              <Pressable onPress={handleSend} disabled={sending || !composer.trim()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: sending || !composer.trim() ? 0.5 : 1 }}>
                <Send size={15} color={t.colors.onAccent} />
              </Pressable>
            </>
          )}
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

      <Sheet open={!!actionMenuFor} onClose={() => setActionMenuFor(null)} title="Message" side="bottom">
        {actionMenuFor && (
          <View style={{ paddingBottom: t.spacing.sm }}>
            <ActionRow icon={<Smile size={16} color={t.colors.textPrimary} />} label="React" onPress={() => { setReactionPickerFor(actionMenuFor.id); setActionMenuFor(null); }} />
            <ActionRow icon={<Reply size={16} color={t.colors.textPrimary} />} label="Reply" onPress={() => { setReplyTo(actionMenuFor); setActionMenuFor(null); }} />
            <ActionRow icon={<Copy size={16} color={t.colors.textPrimary} />} label="Copy" onPress={() => copyMessage(actionMenuFor)} />
            <ActionRow icon={<Star size={16} color={t.colors.textPrimary} />} label={starredIds.has(actionMenuFor.id) ? 'Unstar' : 'Star'} onPress={() => toggleStarMessage(actionMenuFor)} />
            <ActionRow icon={<Pin size={16} color={t.colors.textPrimary} />} label={pinnedIds.has(actionMenuFor.id) ? 'Unpin' : 'Pin'} onPress={() => togglePinMessage(actionMenuFor)} />
            <ActionRow icon={<Forward size={16} color={t.colors.textPrimary} />} label="Forward" onPress={() => openForward(actionMenuFor)} />
            {actionMenuFor.sender_id === myId && (
              <ActionRow icon={<Pencil size={16} color={t.colors.textPrimary} />} label="Edit" onPress={() => startEdit(actionMenuFor)} />
            )}
            <ActionRow icon={<Trash2 size={16} color={t.colors.status.danger.text} />} label="Delete for me" danger onPress={() => deleteForMe(actionMenuFor)} />
            {actionMenuFor.sender_id === myId && (
              <ActionRow icon={<Trash2 size={16} color={t.colors.status.danger.text} />} label="Delete for everyone" danger onPress={() => deleteForEveryone(actionMenuFor)} />
            )}
          </View>
        )}
      </Sheet>

      <Sheet open={!!forwardTarget} onClose={() => setForwardTarget(null)} title="Forward to…" side="bottom">
        <View style={{ maxHeight: 320 }}>
          {forwardChannels.map((ch) => (
            <Pressable key={ch.id} onPress={() => forwardMessage(ch)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
              {ch.type === 'everyone' ? (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}><Users size={15} color={t.colors.onAccent} /></View>
              ) : (
                <Avatar name={ch.name || 'GC'} size={36} />
              )}
              <Text style={{ ...p.body, fontFamily: t.font.semibold, flex: 1 }}>{ch.type === 'everyone' ? 'Everyone' : ch.name || 'Group'}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet open={showPinned} onClose={() => setShowPinned(false)} title="Pinned Messages" side="bottom">
        <View style={{ maxHeight: 320, gap: t.spacing.sm }}>
          {pinnedMessages.map((m) => (
            <View key={m.id} style={{ padding: t.spacing.sm, backgroundColor: t.colors.bgInput, borderRadius: t.radius.sm }}>
              <Text style={{ ...p.meta, fontFamily: t.font.bold }}>{m.sender}</Text>
              <Text style={{ ...p.body, marginTop: 2 }}>{m.deleted_at ? 'This message was deleted' : m.content}</Text>
            </View>
          ))}
        </View>
      </Sheet>

      <Sheet open={!!readListFor} onClose={() => setReadListFor(null)} title="Read by" side="bottom">
        <View style={{ gap: t.spacing.xs }}>
          {readListFor && (reads[readListFor] || []).filter((uid) => uid !== myId).length === 0 ? (
            <Text style={p.meta}>No one yet</Text>
          ) : readListFor && (reads[readListFor] || []).filter((uid) => uid !== myId).map((uid) => (
            <Text key={uid} style={p.body}>{profiles.find((pr) => pr.id === uid)?.fullName || 'Unknown'}</Text>
          ))}
        </View>
      </Sheet>

      {/* Gallery — every image sent in this conversation, grid + tap-to-lightbox */}
      <Sheet open={showGallery} onClose={() => setShowGallery(false)} title="Media" side="bottom">
        {(() => {
          const allImageUrls = messages.flatMap((m) =>
            m.attachment_type !== 'image' ? [] :
            m.attachment_urls && m.attachment_urls.length > 0 ? m.attachment_urls.map((p) => attachmentUrls[p]).filter(Boolean) :
            m.attachment_url && attachmentUrls[m.attachment_url] ? [attachmentUrls[m.attachment_url]] : []
          );
          return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxHeight: 400 }}>
              {allImageUrls.length === 0 && <Text style={p.meta}>No photos yet.</Text>}
              {allImageUrls.map((url, i) => (
                <Pressable key={i} onPress={() => { setShowGallery(false); setLightbox({ urls: allImageUrls, index: i }); }}>
                  <Image source={{ uri: url }} style={{ width: 96, height: 96, borderRadius: 8 }} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          );
        })()}
      </Sheet>

      {/* Lightbox — full-size image, prev/next through the same set */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable onPress={() => setLightbox(null)} style={{ position: 'absolute', top: 50, right: 20, padding: 8, zIndex: 1 }}>
            <X size={26} color="#fff" />
          </Pressable>
          {lightbox && (
            <Image
              source={{ uri: lightbox.urls[lightbox.index] }}
              style={{ width: Dimensions.get('window').width - 40, height: Dimensions.get('window').height * 0.7 }}
              resizeMode="contain"
            />
          )}
          {lightbox && lightbox.urls.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 40, marginTop: 20 }}>
              <Pressable onPress={() => setLightbox((l) => l && { ...l, index: (l.index - 1 + l.urls.length) % l.urls.length })}>
                <Text style={{ color: '#fff', fontSize: 28 }}>‹</Text>
              </Pressable>
              <Pressable onPress={() => setLightbox((l) => l && { ...l, index: (l.index + 1) % l.urls.length })}>
                <Text style={{ color: '#fff', fontSize: 28 }}>›</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

// Phase 11.3 — one voice-note bubble is one useAudioPlayer instance, so
// several voice notes in a thread each play/pause independently.
function VoiceNoteBubble({ uri, mine }: { uri: string; mine: boolean }) {
  const t = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) player.pause();
    else { player.seekTo(0); player.play(); }
  };

  return (
    <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 140 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: mine ? 'rgba(255,255,255,0.25)' : t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {status.playing ? <Pause size={13} color={mine ? t.colors.onAccent : t.colors.accent} /> : <Play size={13} color={mine ? t.colors.onAccent : t.colors.accent} />}
      </View>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: mine ? 'rgba(255,255,255,0.3)' : t.colors.border }}>
        <View style={{ width: `${status.duration ? Math.min(100, (status.currentTime / status.duration) * 100) : 0}%`, height: 3, borderRadius: 2, backgroundColor: mine ? t.colors.onAccent : t.colors.accent }} />
      </View>
    </Pressable>
  );
}

function ActionRow({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm }}>
      {icon}
      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: danger ? t.colors.status.danger.text : t.colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}
