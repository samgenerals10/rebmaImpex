// rebma-mobile/screens/MessengerThreadScreen.tsx
// Phase 11.0/11.1 — mobile's real Messenger, one thread. Ports:
// rebma-web/src/components/collaborative/Messenger.tsx's main panel
// (attachments, reactions, threaded replies, read receipts, typing
// indicator, realtime, edit/delete/pin/forward/star/copy/search-within-
// conversation) for the channel the caller navigated in with.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, Linking, Modal, Dimensions } from 'react-native';
import { Alert } from '../lib/appAlert';
import * as Clipboard from 'expo-clipboard';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Send, Paperclip, Smile, Reply, X, Check, CheckCheck, FileText, Camera,
  Pin, Star, Pencil, Trash2, Forward, Copy, MoreVertical, Search, Users, Bell, BellOff,
  Images, Mic, Square, Play, Pause, Download, Plus, Phone as PhoneIcon, Video, Clock,
} from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { messenger, type ChatMessage, type Channel } from '../lib/messenger';
import { pickOrCaptureImageAsset, pickOrCaptureMedia, pickDocument, pickMultipleImageAssets, validateAttachment } from '../lib/media';
import { subscribeToLiveUsers, type PresencePayload } from '../lib/presence';
import { getCeoSetting } from '../lib/ceoSetting';
import { blockState, blockUser, unblockUser, suspensionAllowed, isSuspendedByMe, isChannelSuspended, suspendChannel, unsuspendChannel } from '../lib/chatAccess';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { usePresets } from '../theme/presets';
import Screen from '../components/ui/Screen';
import Sheet from '../components/ui/Sheet';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import StickyActionBar from '../components/ui/StickyActionBar';
import NativeCallSheet from '../components/shared/NativeCallSheet';
import GroupCallSheet from '../components/shared/GroupCallSheet';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👏'];

function initials(name: string) {
  return (name || '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

export default function MessengerThreadScreen({ route, navigation }: any) {
  const { channelId, channelType, title, subtitle, joinCallMeetingId } = route.params as { channelId: string; channelType: string; title: string; subtitle?: string; joinCallMeetingId?: string };
  // Set when this screen was opened by accepting an incoming call.
  const joinedCallRef = useRef<string | null>(null);
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
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [contactPhoto, setContactPhoto] = useState<string | undefined>(undefined);
  const [contactDept, setContactDept] = useState('');
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [otherUserId, setOtherUserId] = useState('');
  // isBlocked / isSuspended are what *I* did (they drive the Unblock /
  // Resume buttons). The other person can also block me or suspend the
  // chat; the database refuses messages in either case, so the composer
  // is locked for those too.
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedByOther, setSuspendedByOther] = useState(false);
  const [suspensionEnabled, setSuspensionEnabled] = useState(true);
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
  // Phase 11.4 — group management.
  const [groupName, setGroupName] = useState(title);
  const [groupPhotoPath, setGroupPhotoPath] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState<{ id: string; full_name: string; department: string }[]>([]);
  const [groupNameEdit, setGroupNameEdit] = useState('');
  const [addingGroupMembers, setAddingGroupMembers] = useState(false);
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  // Phase 11.5 — ad-hoc calls (previously Meetings-only on mobile).
  // A direct chat's call is 1:1 (NativeCallSheet); any other chat's call
  // is a group call (GroupCallSheet). Before, group chats used the 1:1
  // sheet too and only ever connected to one person. Same split as web.
  const [activeCall, setActiveCall] = useState<{ room: string; title: string; kind: 'voice' | 'video'; callMessageId?: string; memberIds: string[]; otherUserId: string; meetingId?: string; isHost?: boolean } | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);

  // Security/gap audit fix — these five CEO Communication Controls toggles
  // (Messenger.tsx already reads all of them via useCeoSettings) were
  // never wired into this screen at all: calls/attachments/retention had
  // no enforcement whatsoever, and the three channel-type toggles weren't
  // checked before a plain send either.
  const [callsEnabled, setCallsEnabled] = useState(true);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(0);
  const [globalChatEnabled, setGlobalChatEnabled] = useState(true);
  const [departmentChatEnabled, setDepartmentChatEnabled] = useState(true);
  const [directMessagesEnabled, setDirectMessagesEnabled] = useState(true);
  useEffect(() => {
    getCeoSetting('messenger_calls_enabled', true).then(setCallsEnabled);
    getCeoSetting('messenger_attachments_enabled', true).then(setAttachmentsEnabled);
    getCeoSetting('message_retention_days', 0).then(setRetentionDays);
    getCeoSetting('global_chat_enabled', true).then(setGlobalChatEnabled);
    getCeoSetting('department_chat_enabled', true).then(setDepartmentChatEnabled);
    getCeoSetting('direct_messages_enabled', true).then(setDirectMessagesEnabled);
  }, []);
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
      if (m.sender_id !== myId && !m.deleted_at && !(rdMap[m.id] || []).includes(myId)) messenger.markRead(m.id, myId);
    }
  }, [channelId, myId]);

  useEffect(() => { loadThread(); }, [loadThread]);

  useEffect(() => {
    supabase.from('channel_members').select('user_id').eq('channel_id', channelId).then(({ data }) => {
      memberIds.current = (data || []).map((m: any) => m.user_id);
      // The header's clickable avatar/name needs the other party's real
      // photo — profiles.photo is already a ready-to-use URL/data URI
      // (same as every other Avatar in this app, e.g.
      // DepartmentSwitcherSheet's `photo={profile.photo}`), no signed-URL
      // step needed the way private-bucket attachments require.
      if (channelType === 'dm') {
        const otherId = memberIds.current.find((id) => id !== myId);
        if (otherId) {
          setOtherUserId(otherId);
          // The shared staff directory: the private profiles table is only
          // readable by HR/CEO, so ordinary staff never saw this photo.
          supabase.from('profiles_directory').select('photo, department').eq('id', otherId).maybeSingle().then(({ data: p }) => {
            if (p) { setContactPhoto(p.photo || undefined); setContactDept(p.department || ''); }
          });
        }
      }
      // Accepted an incoming call: join it once the members are known.
      if (joinCallMeetingId && joinedCallRef.current !== joinCallMeetingId) {
        joinedCallRef.current = joinCallMeetingId;
        rejoinCall({ attachment_url: joinCallMeetingId } as ChatMessage);
      }
    });
  }, [channelId, channelType, myId, joinCallMeetingId]);

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

  // Block/suspend — every user's own chat settings, not a department or
  // CEO-only feature. Suspension additionally respects the CEO's
  // app-wide chat_suspension_allowed toggle (default on).
  useEffect(() => {
    if (channelType !== 'dm' || !otherUserId || !myId) return;
    blockState(myId, otherUserId).then((b) => { setIsBlocked(b.byMe); setBlockedByThem(b.byThem); });
    Promise.all([isSuspendedByMe(channelId, myId), isChannelSuspended(channelId)]).then(([mine, any]) => {
      setIsSuspended(mine);
      setSuspendedByOther(any && !mine);
    });
    suspensionAllowed().then(setSuspensionEnabled);
  }, [channelType, otherUserId, myId, channelId]);

  const toggleBlock = async () => {
    try {
      if (isBlocked) { await unblockUser(myId, otherUserId); setIsBlocked(false); }
      else {
        await blockUser(myId, otherUserId);
        setIsBlocked(true);
        Alert.alert('Blocked', `${title} can no longer message you.`);
      }
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  const toggleSuspend = async () => {
    try {
      if (isSuspended) { await unsuspendChannel(channelId, myId); setIsSuspended(false); }
      else { await suspendChannel(channelId, myId); setIsSuspended(true); }
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  // Phase 11.4 — group management. Any current member may rename,
  // re-photo, or add/remove another member — no admin/member-role
  // distinction exists anywhere in this schema (mirrors web exactly).
  useEffect(() => {
    if (channelType !== 'group') return;
    supabase.from('channels').select('name, photo_url').eq('id', channelId).maybeSingle().then(({ data }) => {
      if (data) { setGroupName(data.name || title); setGroupPhotoPath(data.photo_url || null); }
    });
  }, [channelId, channelType]);

  // Moved up from further down in this component — the header
  // useLayoutEffect below needs it in its dependency array, which is
  // evaluated at render time, not deferred like a closure.
  const otherOnline = channelType === 'dm' && memberIds.current.some((id) => id !== myId && onlineIds.has(id));

  // A clickable header: the contact's (or group's) real photo next to the
  // name, tapping either opens Contact Info (DM) or Group Info (group) —
  // was a plain text title with no photo and nothing to tap.
  const headerPhoto = channelType === 'group' ? (groupPhotoPath ? attachmentUrls[groupPhotoPath] : undefined) : contactPhoto;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() => (channelType === 'group' ? openGroupInfo() : setContactInfoOpen(true))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
        >
          <Avatar name={title} photo={headerPhoto} size={32} />
          <View>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.base16.size, color: t.colors.textPrimary }} numberOfLines={1}>{title}</Text>
            {otherOnline && <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status.success.text }}>Online</Text>}
          </View>
        </Pressable>
      ),
    });
  }, [navigation, title, headerPhoto, otherOnline, channelType]);

  const openGroupInfo = async () => {
    setGroupNameEdit(groupName);
    setShowGroupInfo(true);
    const members = await messenger.fetchChannelMembers(channelId);
    setGroupMembers(members);
  };

  const saveGroupName = async () => {
    if (!groupNameEdit.trim()) return;
    try {
      await messenger.renameChannel(channelId, groupNameEdit.trim());
      setGroupName(groupNameEdit.trim());
    } catch (e: any) {
      Alert.alert('Rename failed', e.message);
    }
  };

  const handleGroupPhotoChange = async () => {
    const asset = await pickOrCaptureImageAsset();
    if (!asset) return;
    const err = validateAttachment(asset.mimeType, asset.size);
    if (err) { Alert.alert("Can't use that photo", err); return; }
    try {
      const path = await messenger.uploadChatAttachment(asset.uri, asset.mimeType, channelId);
      await messenger.setChannelPhoto(channelId, path);
      setGroupPhotoPath(path);
      const url = await messenger.getSignedAttachmentUrl(path);
      if (url) setAttachmentUrls((prev) => ({ ...prev, [path]: url }));
    } catch (e: any) {
      Alert.alert('Photo upload failed', e.message);
    }
  };

  const addSelectedMembers = async () => {
    if (newGroupMemberIds.length === 0) return;
    await messenger.addChannelMembers(channelId, newGroupMemberIds);
    const members = await messenger.fetchChannelMembers(channelId);
    setGroupMembers(members);
    setNewGroupMemberIds([]);
    setAddingGroupMembers(false);
  };

  const removeGroupMember = async (userId: string) => {
    await messenger.removeChannelMember(channelId, userId);
    setGroupMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const leaveGroup = async () => {
    await messenger.removeChannelMember(channelId, myId);
    setShowGroupInfo(false);
    navigation.goBack();
  };

  // Real device-camera/mic calling (NativeCallSheet) — no Jitsi. The
  // `meetings` row + call-announcement chat message are unchanged (still
  // the async "post a call, others tap to join" model this app already
  // used); only the actual media connection changed, from a Jitsi
  // WebView to a direct WebRTC peer connection.
  const startCall = async (kind: 'voice' | 'video') => {
    const members = memberIds.current.length > 0 ? memberIds.current : [myId];
    try {
      const meeting = await messenger.startCall(channelId, members, myId, myName, kind);
      const otherUserId = members.find((id) => id !== myId) || members[0];
      setActiveCall({ room: meeting.jitsi_room, title: meeting.title, kind, callMessageId: meeting.callMessageId, memberIds: members, otherUserId, meetingId: meeting.id, isHost: true });
    } catch (e: any) {
      Alert.alert('Failed to start call', e.message);
    }
  };

  // Fires once, when the call screen actually closes, for whichever
  // invited members never opened the call-started message.
  const endActiveCall = () => {
    if (activeCall?.callMessageId) {
      messenger.notifyMissedCall(channelId, activeCall.callMessageId, activeCall.memberIds, myId, myName).catch(() => {});
    }
    setActiveCall(null);
  };

  // Rejoining someone else's call — not the organizer's own "end call"
  // moment, so no missed-call check fires on close (no callMessageId).
  const rejoinCall = async (msg: ChatMessage) => {
    const { data } = await supabase.from('meetings').select('*').eq('id', msg.attachment_url).maybeSingle();
    const otherUserId = memberIds.current.find((id) => id !== myId) || '';
    if (data) setActiveCall({ room: data.jitsi_room, title: data.title, kind: data.title.toLowerCase().includes('video') ? 'video' : 'voice', memberIds: [], otherUserId, meetingId: data.id, isHost: data.organizer_id === myId });
  };

  // Ids of the messages on screen, for filtering live events.
  const threadMessageIds = useRef<Set<string>>(new Set());
  useEffect(() => { threadMessageIds.current = new Set(messages.map((m) => m.id)); }, [messages]);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => { reloadTimer.current = null; loadThread(); }, 400);
  }, [loadThread]);

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
      // Reactions and reads have no channel column, so the server sends
      // every one in the company. Only reload when it touches a message in
      // this conversation, and batch bursts into one reload.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, (payload) => {
        const id = (payload.new as any)?.message_id ?? (payload.old as any)?.message_id;
        if (id && !threadMessageIds.current.has(id)) return;
        scheduleReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reads' }, (payload) => {
        const row = (payload.new as any)?.message_id ? (payload.new as any) : (payload.old as any);
        if (row?.user_id === myId) return;
        if (row?.message_id && !threadMessageIds.current.has(row.message_id)) return;
        scheduleReload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_pinned_messages', filter: `channel_id=eq.${channelId}` }, () => scheduleReload())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [channelId, loadThread, myId, scheduleReload]);

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
  // the single-attachment column, every path inside a multi-image
  // message, and the group photo (Phase 11.4 — same bucket, same signing).
  // Paths already tried, so a missing file is fetched once, not in an endless loop.
  const signingPathsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const want = (p: string) => !attachmentUrls[p] && !signingPathsRef.current.has(p);
    const single = messages.filter((m) => !m.deleted_at && m.attachment_url && m.attachment_type !== 'call' && want(m.attachment_url)).map((m) => m.attachment_url!);
    const multi = messages.filter((m) => !m.deleted_at).flatMap((m) => (m.attachment_urls || []).filter(want));
    const groupPhoto = groupPhotoPath && want(groupPhotoPath) ? [groupPhotoPath] : [];
    const paths = Array.from(new Set([...single, ...multi, ...groupPhoto]));
    if (paths.length === 0) return;
    paths.forEach((p) => signingPathsRef.current.add(p));
    (async () => {
      const entries: Record<string, string> = {};
      for (const path of paths) {
        const url = await messenger.getSignedAttachmentUrl(path);
        if (url) entries[path] = url;
      }
      if (Object.keys(entries).length > 0) setAttachmentUrls((prev) => ({ ...prev, ...entries }));
    })();
  }, [messages, attachmentUrls, groupPhotoPath]);

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

  const chatSuspended = suspensionEnabled && (isSuspended || suspendedByOther);
  const dmLocked = channelType === 'dm' && (isBlocked || blockedByThem || chatSuspended);
  const lockedPlaceholder = isBlocked ? "You've blocked this chat"
    : blockedByThem ? "You can't message this person"
    : 'This chat is suspended';

  // The same rules for every kind of send (typed, photo, file, voice note,
  // forward): the CEO's chat switches and any block or suspension.
  const typeEnabled = (type?: string) =>
    type === 'everyone' ? globalChatEnabled : type === 'group' ? departmentChatEnabled : type === 'dm' ? directMessagesEnabled : false;
  const sendBlockedReason = (): string | null => {
    if (!typeEnabled(channelType)) return 'The CEO has turned this kind of chat off.';
    if (dmLocked) return lockedPlaceholder;
    return null;
  };

  const handleSend = async () => {
    if (!composer.trim() || sending) return;
    // These three channel-type toggles were never checked on mobile at
    // all (web's own handleSend already gates on them) — a CEO disabling
    // Everyone/group/DM chat had no effect on mobile sends.
    const blocked = sendBlockedReason();
    if (blocked) { Alert.alert("Can't send", blocked); return; }
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
      setComposer(text); // keep what they typed
      Alert.alert('Not sent', e.message);
    } finally {
      setSending(false);
    }
  };

  // Was a bare OS Alert.alert (system default styling, all-caps right-
  // aligned text links) — replaced with a real Sheet matching the app's
  // own design everywhere else this kind of menu appears (see the
  // Message action Sheet below, same ActionRow pattern).
  const handleAttach = () => {
    const blocked = sendBlockedReason();
    if (blocked) { Alert.alert("Can't send", blocked); return; }
    setAttachSheetOpen(true);
  };

  // Real Capture (photo or video) — see lib/media.ts's pickOrCaptureMedia()
  // for why this is the one place in the app it's wired in: an actual
  // video attachment can be shown here (VideoBubble, below), unlike the
  // still-image-only fields elsewhere.
  const attachPhoto = async () => {
    const asset = await pickOrCaptureMedia();
    if (!asset) return;
    const err = validateAttachment(asset.mimeType, asset.size);
    if (err) { Alert.alert('Can\'t attach that', err); return; }
    try {
      const path = await messenger.uploadChatAttachment(asset.uri, asset.mimeType, channelId);
      if (asset.kind === 'video') {
        await messenger.sendMessage(channelId, myId, myName, '🎥 Video', { attachmentUrl: path, attachmentType: 'video', attachmentName: 'video' });
        notifyOthersOfMessage('🎥 Video');
      } else {
        await messenger.sendMessage(channelId, myId, myName, '📷 Photo', { attachmentUrl: path, attachmentType: 'image', attachmentName: 'photo' });
        notifyOthersOfMessage('📷 Photo');
      }
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
    const blocked = sendBlockedReason();
    if (blocked) { Alert.alert("Can't send", blocked); return; }
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
    // Same channel-type toggles handleSend now respects, above —
    // forwarding was bypassing them entirely.
    if (!typeEnabled(target.type)) { Alert.alert('Not forwarded', 'The CEO has turned this kind of chat off.'); return; }
    try {
      await messenger.sendMessage(target.id, myId, myName, forwardTarget.content, {
        attachmentUrl: forwardTarget.attachment_url || undefined,
        attachmentUrls: forwardTarget.attachment_urls || undefined,
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

  // CEO-configurable retention (message_retention_days, 0/unset = keep
  // indefinitely) — hides, doesn't delete, any message older than N days.
  // Web's Messenger.tsx already did this; mobile never had it at all.
  const retentionCutoff = retentionDays > 0 ? Date.now() - retentionDays * 86400000 : null;
  const visibleMessages = messages.filter((m) => {
    if (starredOnly && !starredIds.has(m.id)) return false;
    if (search.trim() && !m.content.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (retentionCutoff && new Date(m.created_at).getTime() < retentionCutoff) return false;
    return true;
  });
  const pinnedMessages = messages.filter((m) => pinnedIds.has(m.id));

  return (
    <Screen>
      {otherOnline && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.status.success.text }} />
          <Text style={p.meta}>Online</Text>
        </View>
      )}
      {channelType === 'dm' && isBlocked && (
        <View style={{ marginHorizontal: t.spacing.lg, marginTop: t.spacing.sm, padding: t.spacing.sm, borderRadius: t.radius.md, backgroundColor: t.colors.status.danger.bg }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, textAlign: 'center' }}>
            You've blocked {title}. Unblock from the menu to message again.
          </Text>
        </View>
      )}
      {channelType === 'dm' && !isBlocked && blockedByThem && (
        <View style={{ marginHorizontal: t.spacing.lg, marginTop: t.spacing.sm, padding: t.spacing.sm, borderRadius: t.radius.md, backgroundColor: t.colors.status.danger.bg }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, textAlign: 'center' }}>
            {title} isn't accepting messages from you.
          </Text>
        </View>
      )}
      {channelType === 'dm' && !isBlocked && !blockedByThem && chatSuspended && !isSuspended && (
        <View style={{ marginHorizontal: t.spacing.lg, marginTop: t.spacing.sm, padding: t.spacing.sm, borderRadius: t.radius.md, backgroundColor: t.colors.status.warning.bg }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text, textAlign: 'center' }}>
            {title} suspended this chat. Only they can resume it.
          </Text>
        </View>
      )}
      {channelType === 'dm' && !isBlocked && !blockedByThem && isSuspended && suspensionEnabled && (
        <View style={{ marginHorizontal: t.spacing.lg, marginTop: t.spacing.sm, padding: t.spacing.sm, borderRadius: t.radius.md, backgroundColor: t.colors.status.warning.bg }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text, textAlign: 'center' }}>
            This chat is suspended. Resume it from the menu to keep messaging.
          </Text>
        </View>
      )}
      {/* Was 7-8 bare icons in one row (Pin count, Star filter, Search,
          Mute, Media, Group Info, Call History, Voice, Video) with no
          visual hierarchy. Down to 4: Search stays inline (used often),
          Voice/Video stay inline (primary actions), everything else
          moved into the "More" Sheet above. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm }}>
        <Pressable onPress={() => setShowSearch((v) => !v)} hitSlop={8} style={{ padding: 4 }}>
          <Search size={18} color={showSearch ? t.colors.accent : t.colors.textMuted} />
        </Pressable>
        {callsEnabled && (
          <Pressable onPress={() => startCall('voice')} hitSlop={8} style={{ padding: 4 }}>
            <PhoneIcon size={18} color={t.colors.accent} />
          </Pressable>
        )}
        {callsEnabled && (
          <Pressable onPress={() => startCall('video')} hitSlop={8} style={{ padding: 4 }}>
            <Video size={18} color={t.colors.accent} />
          </Pressable>
        )}
        <Pressable onPress={() => setThreadMenuOpen(true)} hitSlop={8} style={{ padding: 4 }}>
          <MoreVertical size={18} color={t.colors.textMuted} />
        </Pressable>
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
        {messages.length === 0 && <Text style={{ ...p.meta, textAlign: 'center', paddingVertical: t.spacing.xxxl }}>No messages yet, say hello.</Text>}
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
          const isCall = msg.attachment_type === 'call';
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
                      ) : msg.attachment_type === 'video' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                        <VideoBubble uri={attachmentUrls[msg.attachment_url]} />
                      ) : isCall ? (
                        // msg.content already carries a leading 📞/🎥 emoji
                        // (messenger.startCall's own message text) — was
                        // rendering that AND a separate lucide icon next to
                        // it, a real duplicate. One clean icon now.
                        <Pressable onPress={() => rejoinCall(msg)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {msg.content.toLowerCase().includes('video') ? <Video size={14} color={mine ? t.colors.onAccent : t.colors.accent} /> : <PhoneIcon size={14} color={mine ? t.colors.onAccent : t.colors.accent} />}
                          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: mine ? t.colors.onAccent : t.colors.accent, textDecorationLine: 'underline' }}>{msg.content.replace(/^[^\w]+/, '').trim()}</Text>
                        </Pressable>
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
                      {!isCall && (
                        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: mine ? t.colors.onAccent : t.colors.textPrimary }}>{msg.content}</Text>
                      )}
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
                placeholder="Edit your message"
                placeholderTextColor={t.colors.textMuted}
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
              {attachmentsEnabled && (
                <Pressable onPress={handleAttach} hitSlop={8} style={{ padding: 6 }}>
                  <Paperclip size={18} color={t.colors.textMuted} />
                </Pressable>
              )}
              {attachmentsEnabled && (
                <Pressable
                  onPress={recorderState.isRecording ? stopVoiceRecording : startVoiceRecording}
                  hitSlop={8}
                  style={{ padding: 6, borderRadius: 14, backgroundColor: recorderState.isRecording ? t.colors.status.danger.text : 'transparent' }}
                >
                  {recorderState.isRecording ? <Square size={16} color={t.colors.onAccent} /> : <Mic size={18} color={t.colors.textMuted} />}
                </Pressable>
              )}
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
                  placeholder={dmLocked ? lockedPlaceholder : 'Type a message…'}
                  placeholderTextColor={t.colors.textMuted}
                  editable={!dmLocked}
                  style={{ backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}
                  onSubmitEditing={handleSend}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={sending || !composer.trim() || dmLocked}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: sending || !composer.trim() || dmLocked ? 0.5 : 1 }}
              >
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

      <Sheet open={attachSheetOpen} onClose={() => setAttachSheetOpen(false)} title="Attach" side="bottom">
        <View style={{ paddingBottom: t.spacing.sm }}>
          <ActionRow icon={<Camera size={16} color={t.colors.textPrimary} />} label="Photo / Video" onPress={() => { setAttachSheetOpen(false); attachPhoto(); }} />
          <ActionRow icon={<Images size={16} color={t.colors.textPrimary} />} label="Multiple Photos" onPress={() => { setAttachSheetOpen(false); attachMultiplePhotos(); }} />
          <ActionRow icon={<FileText size={16} color={t.colors.textPrimary} />} label="Document" onPress={() => { setAttachSheetOpen(false); attachDocument(); }} />
        </View>
      </Sheet>

      {/* Was 6-7 bare icons in one row above the message list — decluttered
          down to Search + the two call buttons inline, everything else
          (starred filter, pins, mute, media gallery, group info, call
          history) moved in here. */}
      <Sheet open={threadMenuOpen} onClose={() => setThreadMenuOpen(false)} title="Conversation" side="bottom">
        <View style={{ paddingBottom: t.spacing.sm }}>
          <ActionRow icon={<Pin size={16} color={t.colors.textPrimary} />} label="Pinned Messages" onPress={() => { setThreadMenuOpen(false); setShowPinned(true); }} />
          <ActionRow icon={<Star size={16} color={starredOnly ? '#f59e0b' : t.colors.textPrimary} />} label={starredOnly ? 'Showing Starred Only' : 'Show Starred Only'} onPress={() => { setThreadMenuOpen(false); setStarredOnly((v) => !v); }} />
          {muted ? (
            <ActionRow icon={<Bell size={16} color={t.colors.textPrimary} />} label="Unmute" onPress={() => { setThreadMenuOpen(false); toggleMute(); }} />
          ) : (
            <ActionRow icon={<BellOff size={16} color={t.colors.textPrimary} />} label="Mute" onPress={() => { setThreadMenuOpen(false); toggleMute(); }} />
          )}
          {messages.some((m) => m.attachment_type === 'image') && (
            <ActionRow icon={<Images size={16} color={t.colors.textPrimary} />} label="Media" onPress={() => { setThreadMenuOpen(false); setShowGallery(true); }} />
          )}
          {channelType === 'group' && (
            <ActionRow icon={<Users size={16} color={t.colors.textPrimary} />} label="Group Info" onPress={() => { setThreadMenuOpen(false); openGroupInfo(); }} />
          )}
          {messages.some((m) => m.attachment_type === 'call') && (
            <ActionRow icon={<Clock size={16} color={t.colors.textPrimary} />} label="Call History" onPress={() => { setThreadMenuOpen(false); setShowCallHistory(true); }} />
          )}
          {channelType === 'dm' && suspensionEnabled && (
            <ActionRow
              icon={<BellOff size={16} color={t.colors.textPrimary} />}
              label={isSuspended ? 'Resume Chat' : 'Suspend Chat'}
              onPress={() => { setThreadMenuOpen(false); toggleSuspend(); }}
            />
          )}
          {channelType === 'dm' && (
            <ActionRow
              icon={<X size={16} color={t.colors.status.danger.text} />}
              label={isBlocked ? 'Unblock' : 'Block'}
              danger={!isBlocked}
              onPress={() => { setThreadMenuOpen(false); toggleBlock(); }}
            />
          )}
        </View>
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

      {/* Call history — every call started in this conversation, tap to rejoin */}
      <Sheet open={showCallHistory} onClose={() => setShowCallHistory(false)} title="Call History" side="bottom">
        <View style={{ maxHeight: 320, gap: t.spacing.xs }}>
          {messages.filter((m) => m.attachment_type === 'call').length === 0 && <Text style={p.meta}>No calls yet.</Text>}
          {messages.filter((m) => m.attachment_type === 'call').slice().reverse().map((m) => (
            <Pressable
              key={m.id}
              onPress={() => { setShowCallHistory(false); rejoinCall(m); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                {m.content.toLowerCase().includes('video') ? <Video size={14} color={t.colors.accent} /> : <PhoneIcon size={14} color={t.colors.accent} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...p.body, fontFamily: t.font.semibold }}>{m.sender}</Text>
                <Text style={p.meta}>{new Date(m.created_at).toLocaleString()}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Sheet>

      {/* Contact info — tapping the header avatar/name on a DM, the
          equivalent of Group Info but for a single person. Read-only:
          nothing to rename or manage about another person's own profile. */}
      <Sheet open={contactInfoOpen} onClose={() => setContactInfoOpen(false)} title="Contact Info" side="bottom">
        <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.md }}>
          <Avatar name={title} photo={contactPhoto} size={72} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary }}>{title}</Text>
          {!!contactDept && <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textMuted }}>{contactDept}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: otherOnline ? t.colors.status.success.text : t.colors.textMuted }} />
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{otherOnline ? 'Online now' : 'Offline'}</Text>
          </View>
        </View>
      </Sheet>

      {/* Group info — rename, photo, member list, add/remove, leave */}
      <Sheet open={showGroupInfo} onClose={() => setShowGroupInfo(false)} title="Group Info" side="bottom">
        <View style={{ alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
          <Pressable onPress={handleGroupPhotoChange}>
            {groupPhotoPath && attachmentUrls[groupPhotoPath] ? (
              <Image source={{ uri: attachmentUrls[groupPhotoPath] }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: 20, color: t.colors.accent }}>{initials(groupName)}</Text>
              </View>
            )}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, width: '100%' }}>
            <TextInput
              value={groupNameEdit}
              onChangeText={setGroupNameEdit}
              placeholder="Group name"
              placeholderTextColor={t.colors.textMuted}
              style={{ flex: 1, textAlign: 'center', backgroundColor: t.colors.bgInput, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary }}
            />
            {groupNameEdit.trim() !== groupName && (
              <Pressable onPress={saveGroupName} style={{ paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.smd, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.onAccent }}>Save</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
          <Text style={p.label9}>{groupMembers.length} Members</Text>
          <Pressable onPress={() => setAddingGroupMembers(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Plus size={13} color={t.colors.accent} />
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.accent }}>Add</Text>
          </Pressable>
        </View>
        <View style={{ maxHeight: 260 }}>
          {groupMembers.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xs }}>
              <Avatar name={m.full_name} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...p.body, fontFamily: t.font.semibold }}>{m.full_name}{m.id === myId ? ' (you)' : ''}</Text>
                <Text style={p.meta}>{m.department}</Text>
              </View>
              {m.id !== myId && (
                <Pressable onPress={() => removeGroupMember(m.id)} hitSlop={8}>
                  <X size={15} color={t.colors.textMuted} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <Pressable onPress={leaveGroup} style={{ marginTop: t.spacing.lg, paddingVertical: t.spacing.sm, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.status.danger.text, alignItems: 'center' }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.danger.text }}>Leave Group</Text>
        </Pressable>
      </Sheet>

      {/* Add members to group */}
      <Sheet open={addingGroupMembers} onClose={() => { setAddingGroupMembers(false); setNewGroupMemberIds([]); }} title="Add Members" side="bottom">
        <View style={{ maxHeight: 320 }}>
          {profiles.filter((pr) => !groupMembers.some((m) => m.id === pr.id)).map((pr) => {
            const selected = newGroupMemberIds.includes(pr.id);
            return (
              <Pressable key={pr.id} onPress={() => setNewGroupMemberIds((prev) => (selected ? prev.filter((id) => id !== pr.id) : [...prev, pr.id]))} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
                <Avatar name={pr.fullName} size={32} />
                <Text style={{ ...p.body, fontFamily: t.font.semibold, flex: 1 }}>{pr.fullName}</Text>
                {selected ? <Check size={18} color={t.colors.accent} /> : <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: t.colors.border }} />}
              </Pressable>
            );
          })}
        </View>
        <Button label="Add" onPress={addSelectedMembers} disabled={newGroupMemberIds.length === 0} fullWidth style={{ marginTop: t.spacing.md }} />
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

      {activeCall && (
        channelType === 'dm' && activeCall.otherUserId ? (
          <NativeCallSheet room={activeCall.room} title={activeCall.title} kind={activeCall.kind} otherUserId={activeCall.otherUserId} onClose={endActiveCall} otherName={channelType === 'dm' ? title : undefined} otherPhoto={channelType === 'dm' ? contactPhoto : undefined} />
        ) : (
          <GroupCallSheet room={activeCall.room} title={activeCall.title} meetingId={activeCall.meetingId} isHost={activeCall.isHost} onClose={endActiveCall} />
        )
      )}
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

// Real video playback for a video message — one useVideoPlayer instance
// per bubble, same "each plays independently" reasoning as VoiceNoteBubble.
function VideoBubble({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <VideoView
      player={player}
      style={{ width: 220, height: 180, borderRadius: 10, marginBottom: 4, backgroundColor: '#000' }}
      allowsPictureInPicture
      nativeControls
    />
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
