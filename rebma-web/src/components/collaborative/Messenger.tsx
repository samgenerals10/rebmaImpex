// rebma-web/src/components/collaborative/Messenger.tsx
// Complete chat messenger: "Everyone" broadcast + group channels + 1-on-1
// DMs, file/image attachments, emoji reactions, threaded replies, read
// receipts, typing indicators (Supabase Realtime Presence), and ad-hoc
// voice/video calls (real Jitsi rooms) launched from any conversation.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MessageSquare, Search, Users, X, Send, Paperclip, Smile, Reply,
  Phone, Video, Check, CheckCheck, Plus, FileText,
  Pin, Star, Pencil, Trash2, Forward, Copy, MoreVertical, BellOff, Bell, EyeOff,
  Images, Mic, Square, Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { messenger } from '../../services/apiClient';
import { subscribeToLiveUsers, type PresencePayload } from '../../lib/presence';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import JitsiCallModal from './JitsiCallModal';
import type { CurrentUser } from '../../types/erp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: CurrentUser | null;
  // Set by callers (e.g. CEO's Live Users "Send Message" action) that want
  // the messenger to open straight into a DM with a specific person rather
  // than landing on Everyone. Idempotent — safe to pass on every open.
  targetUserId?: string | null;
  // Set by a notification tap (chat_message/chat_mention) to jump straight
  // into the exact channel that notification was about, whatever its type.
  targetChannelId?: string | null;
}

interface Profile { id: string; fullName: string; department: string; email: string; }
interface Channel { id: string; name: string | null; type: 'group' | 'dm' | 'everyone'; created_by: string | null; created_at: string; }
interface Msg {
  id: string; channel_id: string; sender_id: string | null; sender: string; content: string;
  time: string; attachment_url: string | null; attachment_type: string | null; attachment_name: string | null;
  reply_to_id: string | null; created_at: string;
  edited_at?: string | null; deleted_at?: string | null; deleted_by?: string | null; forwarded_from_id?: string | null;
  attachment_urls?: string[] | null;
}

// Phase 11.3 — a chat attachment cap, shared by the validator and the
// error copy. 15MB matches this app's own StockIntakeForm photo-quality
// setting in spirit (small, chat-appropriate, not a document-transfer tool).
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv',
];
function validateAttachment(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 15MB.`;
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return `${file.name} isn't a supported file type.`;
  return null;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👏'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function UnreadBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Phase 11.2 — one sidebar row, with an on-hover kebab menu (Mark as
// unread / Mute) that a plain nested <button> couldn't express.
function SidebarRow({
  active, onClick, icon, title, subtitle, unread, muted, menuOpen, onToggleMenu, onMarkUnread, onToggleMute,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle?: string;
  unread?: number; muted?: boolean; menuOpen?: boolean;
  onToggleMenu?: () => void; onMarkUnread?: () => void; onToggleMute?: () => void;
}) {
  return (
    <div className={`group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer ${active ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--accent-light)]'}`}>
      <button onClick={onClick} className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer text-left">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-1">{title} {muted && <BellOff size={10} className="text-[var(--text-muted)]" />}</p>
          {subtitle && <p className="text-[10px] text-[var(--text-muted)] truncate">{subtitle}</p>}
        </div>
      </button>
      <UnreadBadge count={unread} />
      {onToggleMenu && (
        <div className="relative shrink-0">
          <button onClick={onToggleMenu} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] cursor-pointer text-[var(--text-muted)]">
            <MoreVertical size={13} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-card z-20 min-w-[150px] py-1">
              <button onClick={onMarkUnread} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left text-[var(--text-primary)]"><EyeOff size={12} /> Mark as unread</button>
              <button onClick={onToggleMute} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left text-[var(--text-primary)]">
                {muted ? <Bell size={12} /> : <BellOff size={12} />} {muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Messenger({ isOpen, onClose, currentUser, targetUserId, targetChannelId }: Props) {
  const { getSetting } = useCeoSettings();
  const globalChatEnabled = getSetting('global_chat_enabled', true);
  const departmentChatEnabled = getSetting('department_chat_enabled', true);
  const directMessagesEnabled = getSetting('direct_messages_enabled', true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmChannelByUser, setDmChannelByUser] = useState<Record<string, Channel>>({});
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const [reads, setReads] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  const [activeCall, setActiveCall] = useState<{ room: string; title: string; kind: 'voice' | 'video' } | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  // Phase 11.0 gap fixes — per-user access gate + unread badges.
  const [messagingAllowed, setMessagingAllowed] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Phase 11.1 — core message actions.
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Msg | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardTarget, setForwardTarget] = useState<Msg | null>(null);
  const [threadSearch, setThreadSearch] = useState('');
  const [showThreadSearch, setShowThreadSearch] = useState(false);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  // Phase 11.2 — presence-derived online status, mute state, mention
  // autocomplete, per-row menu, read-receipt "who's read this" popover.
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [mutedChannelIds, setMutedChannelIds] = useState<Set<string>>(new Set());
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [readListFor, setReadListFor] = useState<string | null>(null);
  // Phase 11.3 — attachments & media.
  const [pdfPreviewFor, setPdfPreviewFor] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myId = currentUser?.id || '';
  const myName = currentUser?.fullName || 'Me';

  // ── Access gate: master switch + per-user email exception ──
  useEffect(() => {
    if (!isOpen) return;
    setCheckingAccess(true);
    messenger.checkMessagingAccess(currentUser?.email).then((allowed) => {
      setMessagingAllowed(allowed);
      setCheckingAccess(false);
    });
  }, [isOpen, currentUser?.email]);

  // ── Unread badges: refreshed on open and after every thread load ──
  const refreshUnreadCounts = useCallback(() => {
    if (!myId) return;
    messenger.getUnreadCounts().then(setUnreadCounts);
  }, [myId]);
  useEffect(() => { if (isOpen && myId) refreshUnreadCounts(); }, [isOpen, myId, refreshUnreadCounts]);

  // ── Bootstrap: profiles + my channels ──
  useEffect(() => {
    if (!isOpen || !myId) return;
    (async () => {
      const { data } = await supabase.from('profiles_directory').select('id, full_name, department, email').eq('status', 'ACTIVE').order('full_name', { ascending: true });
      setProfiles((data || []).map((p: any) => ({ id: p.id, fullName: p.full_name || 'Unknown', department: p.department || '', email: p.email || '' })).filter(p => p.id !== myId));

      const everyoneId = await messenger.ensureEveryoneChannel();
      if (everyoneId) await messenger.joinChannel(everyoneId, myId);
      const mine = await messenger.listMyChannels(myId);
      setChannels(mine);

      // Map DM channels to the other participant for the contact list
      const dmMap: Record<string, Channel> = {};
      for (const ch of mine.filter((c: Channel) => c.type === 'dm')) {
        const { data: members } = await supabase.from('channel_members').select('user_id').eq('channel_id', ch.id);
        const other = (members || []).find((m: any) => m.user_id !== myId);
        if (other) dmMap[other.user_id] = ch;
      }
      setDmChannelByUser(dmMap);

      if (!activeChannel) {
        const everyone = mine.find((c: Channel) => c.type === 'everyone');
        if (everyone) setActiveChannel(everyone);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, myId]);

  // ── Load messages + reactions/reads for active channel ──
  const loadThread = useCallback(async () => {
    if (!activeChannel) return;
    const all = await messenger.fetchMessages(activeChannel.id) as Msg[];
    const allIds = all.map((m) => m.id);
    const hiddenIds = new Set(await messenger.fetchHiddenMessageIds(myId, allIds));
    const msgs = all.filter((m) => !hiddenIds.has(m.id));
    setMessages(msgs);
    const ids = msgs.map((m) => m.id);
    const [rx, rd, starred, pins] = await Promise.all([
      messenger.fetchReactions(ids), messenger.fetchReads(ids), messenger.fetchStars(myId, ids), messenger.fetchPinned(activeChannel.id),
    ]);
    const rxMap: Record<string, { emoji: string; user_id: string }[]> = {};
    for (const r of rx) { (rxMap[r.message_id] ||= []).push({ emoji: r.emoji, user_id: r.user_id }); }
    setReactions(rxMap);
    const rdMap: Record<string, string[]> = {};
    for (const r of rd) { (rdMap[r.message_id] ||= []).push(r.user_id); }
    setReads(rdMap);
    setStarredIds(new Set(starred));
    setPinnedIds(new Set((pins as any[]).map((p) => p.message_id)));
    // Mark all as read by me
    for (const m of msgs) {
      if (m.sender_id !== myId && !m.deleted_at) messenger.markRead(m.id, myId);
    }
    refreshUnreadCounts();
  }, [activeChannel, myId, refreshUnreadCounts]);

  useEffect(() => { loadThread(); }, [loadThread]);

  // Cross-channel unread badges won't move just from the active thread's
  // own realtime subscription (it's filtered to that one channel_id) — a
  // light poll while the panel is open keeps every other row's badge
  // reasonably fresh, same posture as this app's other secondary-badge polls.
  useEffect(() => {
    if (!isOpen || !myId) return;
    const iv = setInterval(refreshUnreadCounts, 20000);
    return () => clearInterval(iv);
  }, [isOpen, myId, refreshUnreadCounts]);

  // ── Realtime: new messages + reactions + reads in this channel ──
  useEffect(() => {
    if (!activeChannel) return;
    const ch = supabase
      .channel('messenger-thread-' + activeChannel.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel.id}` }, payload => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Msg]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => loadThread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reads' }, () => loadThread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChannel, loadThread]);

  // ── Presence: typing indicator ──
  useEffect(() => {
    if (!activeChannel || !myId) return;
    const presence = supabase.channel('presence-' + activeChannel.id, { config: { presence: { key: myId } } });
    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState();
        const names: string[] = [];
        Object.entries(state).forEach(([key, metas]: [string, any]) => {
          if (key === myId) return;
          const meta = metas[0];
          if (meta?.typing) names.push(meta.name);
        });
        setTypingNames(names);
      })
      .subscribe();
    presenceChannelRef.current = presence;
    return () => { supabase.removeChannel(presence); };
  }, [activeChannel, myId]);

  const notifyTyping = () => {
    if (!presenceChannelRef.current) return;
    presenceChannelRef.current.track({ typing: true, name: myName });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({ typing: false, name: myName });
    }, 2000);
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Resolve signed URLs for attachments lazily — includes both the
  // single-attachment column and every path inside a multi-image message.
  useEffect(() => {
    const single = messages.filter(m => m.attachment_url && m.attachment_type !== 'call' && !attachmentUrls[m.attachment_url!]).map(m => m.attachment_url!);
    const multi = messages.flatMap(m => (m.attachment_urls || []).filter(p => !attachmentUrls[p]));
    const paths = Array.from(new Set([...single, ...multi]));
    if (paths.length === 0) return;
    (async () => {
      const entries: Record<string, string> = {};
      for (const p of paths) {
        const url = await messenger.getSignedAttachmentUrl(p);
        if (url) entries[p] = url;
      }
      setAttachmentUrls(prev => ({ ...prev, ...entries }));
    })();
  }, [messages, attachmentUrls]);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p =>
      p.fullName.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const groupChannels = channels.filter(c => c.type === 'group');
  const everyoneChannel = channels.find(c => c.type === 'everyone');

  const openDm = async (otherId: string) => {
    let ch = dmChannelByUser[otherId];
    if (!ch) {
      ch = await messenger.getOrCreateDmChannel(myId, otherId);
      setDmChannelByUser(prev => ({ ...prev, [otherId]: ch }));
      setChannels(prev => prev.some(c => c.id === ch.id) ? prev : [...prev, ch]);
    }
    setActiveChannel(ch);
  };

  // Jump straight into a DM when a caller (e.g. Live Users' "Send Message")
  // opens the messenger with a specific target in mind. getOrCreateDmChannel
  // is idempotent, so this is safe to fire on every open/target change.
  useEffect(() => {
    if (!isOpen || !myId || !targetUserId) return;
    openDm(targetUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, myId, targetUserId]);

  // Jump straight into a specific channel — from a chat notification tap.
  // Only fires once that channel is actually in `channels` (it will be:
  // you can't have been notified about a channel you're not a member of).
  useEffect(() => {
    if (!isOpen || !targetChannelId) return;
    const ch = channels.find(c => c.id === targetChannelId);
    if (ch) setActiveChannel(ch);
  }, [isOpen, targetChannelId, channels]);

  // Who's online right now — reuses the exact same shared presence
  // channel every session already tracks itself on for Live Users
  // (lib/presence.ts), not a second mechanism.
  useEffect(() => {
    if (!isOpen) return;
    return subscribeToLiveUsers((users: PresencePayload[]) => setOnlineIds(new Set(users.map(u => u.userId))));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !myId) return;
    messenger.fetchMutedChannelIds(myId).then(ids => setMutedChannelIds(new Set(ids)));
  }, [isOpen, myId]);

  const toggleMuteChannel = async (channelId: string) => {
    await messenger.toggleMute(channelId, myId);
    setMutedChannelIds(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
    setRowMenuFor(null);
  };

  const markChannelUnread = async (channelId: string) => {
    await messenger.markChannelUnread(channelId, myId);
    refreshUnreadCounts();
    setRowMenuFor(null);
  };

  const activeChannelMemberIds = useRef<string[]>([]);
  useEffect(() => {
    if (!activeChannel) { activeChannelMemberIds.current = []; return; }
    supabase.from('channel_members').select('user_id').eq('channel_id', activeChannel.id).then(({ data }) => {
      activeChannelMemberIds.current = (data || []).map((m: any) => m.user_id);
    });
  }, [activeChannel]);

  const activeChannelLabel = (): { title: string; subtitle: string } => {
    if (!activeChannel) return { title: '', subtitle: '' };
    if (activeChannel.type === 'everyone') return { title: 'Everyone', subtitle: 'Company-wide broadcast' };
    if (activeChannel.type === 'group') return { title: activeChannel.name || 'Group', subtitle: 'Group channel' };
    const otherId = Object.keys(dmChannelByUser).find(uid => dmChannelByUser[uid].id === activeChannel.id);
    const other = profiles.find(p => p.id === otherId);
    const online = otherId ? onlineIds.has(otherId) : false;
    return { title: other?.fullName || 'Direct Message', subtitle: online ? 'Online' : (other?.department || '') };
  };

  // Gap fix — a DM/group message never notified its recipients (Everyone
  // is deliberately excluded: notifying every staff member on every
  // broadcast would be pure noise). Best-effort — a failure here must
  // never block the send itself, so it's fire-and-forget. Muted
  // recipients (Phase 11.2) are filtered out here — @mentions below use
  // their own, separate notifyUsers call that skips this filter entirely,
  // since a mention should cut through a mute.
  const notifyOthersOfMessage = async (preview: string) => {
    if (!activeChannel || activeChannel.type === 'everyone') return;
    const others = activeChannelMemberIds.current.filter((id) => id !== myId);
    if (others.length === 0) return;
    try {
      const muted = await messenger.fetchMutedUserIds(activeChannel.id, others);
      const toNotify = others.filter((id) => !muted.includes(id));
      if (toNotify.length > 0) await messenger.notifyUsers(toNotify, 'chat_message', myName, preview.slice(0, 120), activeChannel.id);
    } catch { /* best-effort */ }
  };

  // @mentions — matched against this channel's own member list by full
  // name, so "@Sam" only pings a Sam who's actually in this conversation.
  // Deliberately bypasses the mute filter above: getting @mentioned is
  // the one notification a muted conversation should still surface.
  const notifyMentions = (text: string) => {
    if (!activeChannel) return;
    const mentioned = profiles.filter(pr => activeChannelMemberIds.current.includes(pr.id) && text.includes('@' + pr.fullName));
    if (mentioned.length === 0) return;
    messenger.notifyUsers(mentioned.map(pr => pr.id), 'chat_mention', myName, `mentioned you: ${text.slice(0, 100)}`, activeChannel.id).catch(() => {});
  };

  const handleSend = async () => {
    if (!composer.trim() || !activeChannel) return;
    if (activeChannel.type === 'everyone' && !globalChatEnabled) return;
    if (activeChannel.type === 'group' && !departmentChatEnabled) return;
    if (activeChannel.type === 'dm' && !directMessagesEnabled) return;
    const text = composer;
    setComposer('');
    setReplyTo(null);
    setMentionQuery(null);
    try {
      await messenger.sendMessage(activeChannel.id, myId, myName, text, replyTo ? { replyToId: replyTo.id } : undefined);
      notifyOthersOfMessage(text);
      notifyMentions(text);
    } catch (e) { console.error('Send failed:', e); }
  };

  // Detects a trailing "@partial" token as the user types, to drive the
  // mention-autocomplete dropdown. Cleared once a space follows the @.
  const handleComposerChange = (value: string) => {
    setComposer(value);
    notifyTyping();
    const match = value.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (fullName: string) => {
    setComposer(prev => prev.replace(/@([^\s@]*)$/, `@${fullName} `));
    setMentionQuery(null);
  };

  const mentionCandidates = mentionQuery !== null
    ? profiles.filter(pr => activeChannelMemberIds.current.includes(pr.id) && pr.fullName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleAttach = async (file: File) => {
    if (!activeChannel) return;
    const err = validateAttachment(file);
    if (err) { alert(err); return; }
    try {
      const path = await messenger.uploadChatAttachment(file, activeChannel.id);
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? '📷 Photo' : `📎 ${file.name}`;
      await messenger.sendMessage(activeChannel.id, myId, myName, preview, {
        attachmentUrl: path, attachmentType: isImage ? 'image' : 'file', attachmentName: file.name,
      });
      notifyOthersOfMessage(preview);
    } catch (e) { console.error('Attachment upload failed:', e); }
  };

  // Phase 11.3 — several images sent together as one bubble (attachment_urls),
  // distinct from a single-image message, which keeps using attachment_url.
  const handleAttachMultiple = async (files: File[]) => {
    if (!activeChannel || files.length === 0) return;
    for (const f of files) {
      const err = validateAttachment(f);
      if (err) { alert(err); return; }
    }
    try {
      const paths = await Promise.all(files.map(f => messenger.uploadChatAttachment(f, activeChannel.id)));
      const preview = `📷 ${files.length} Photos`;
      await messenger.sendMessage(activeChannel.id, myId, myName, preview, {
        attachmentUrls: paths, attachmentType: 'image',
      });
      notifyOthersOfMessage(preview);
    } catch (e) { console.error('Attachment upload failed:', e); }
  };

  // Phase 11.3 — voice notes via the browser's native MediaRecorder, no
  // new dependency. Records to a Blob, uploads it through the exact same
  // chat-attachments path a photo/file already goes through.
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        if (!activeChannel || blob.size === 0) return;
        try {
          const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
          const path = await messenger.uploadChatAttachment(file, activeChannel.id);
          await messenger.sendMessage(activeChannel.id, myId, myName, '🎤 Voice note', {
            attachmentUrl: path, attachmentType: 'audio', attachmentName: file.name,
          });
          notifyOthersOfMessage('🎤 Voice note');
        } catch (e) { console.error('Voice note upload failed:', e); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      alert('Microphone access is required to record a voice note.');
    }
  };

  const stopVoiceRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  // ── Phase 11.1: core message actions ──
  const startEdit = (msg: Msg) => { setEditingMessage(msg); setEditText(msg.content); setActionMenuFor(null); };

  const saveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      await messenger.editMessage(editingMessage.id, myId, editText.trim());
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m));
    } catch (e) { console.error('Edit failed:', e); }
    setEditingMessage(null);
    setEditText('');
  };

  const deleteForMe = async (msg: Msg) => {
    await messenger.deleteMessageForMe(msg.id, myId);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setActionMenuFor(null);
  };

  const deleteForEveryone = async (msg: Msg) => {
    if (msg.sender_id !== myId) return;
    try {
      await messenger.deleteMessageForEveryone(msg.id, myId);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: '', attachment_url: null, deleted_at: new Date().toISOString() } : m));
    } catch (e) { console.error('Delete failed:', e); }
    setActionMenuFor(null);
  };

  const toggleStarMessage = async (msg: Msg) => {
    await messenger.toggleStar(msg.id, myId);
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
      return next;
    });
    setActionMenuFor(null);
  };

  const togglePinMessage = async (msg: Msg) => {
    if (!activeChannel) return;
    await messenger.togglePin(activeChannel.id, msg.id, myId, myName);
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
      return next;
    });
    setActionMenuFor(null);
  };

  const copyMessage = (msg: Msg) => {
    navigator.clipboard?.writeText(msg.content).catch(() => {});
    setActionMenuFor(null);
  };

  const forwardMessage = async (targetChannel: Channel) => {
    if (!forwardTarget) return;
    try {
      await messenger.sendMessage(targetChannel.id, myId, myName, forwardTarget.content, {
        attachmentUrl: forwardTarget.attachment_url || undefined,
        attachmentType: forwardTarget.attachment_type || undefined,
        attachmentName: forwardTarget.attachment_name || undefined,
        forwardedFromId: forwardTarget.id,
      });
      if (targetChannel.type !== 'everyone') {
        const { data: members } = await supabase.from('channel_members').select('user_id').eq('channel_id', targetChannel.id);
        const others = (members || []).map((m: any) => m.user_id).filter((id: string) => id !== myId);
        if (others.length > 0) messenger.notifyUsers(others, 'chat_message', myName, forwardTarget.content.slice(0, 120), targetChannel.id).catch(() => {});
      }
    } catch (e) { console.error('Forward failed:', e); }
    setForwardTarget(null);
  };

  const visibleMessages = messages.filter((m) => {
    if (starredOnly && !starredIds.has(m.id)) return false;
    if (threadSearch.trim() && !m.content.toLowerCase().includes(threadSearch.trim().toLowerCase())) return false;
    return true;
  });

  const pinnedMessages = messages.filter((m) => pinnedIds.has(m.id));

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || newChannelMembers.length === 0) return;
    const ch = await messenger.createGroupChannel(newChannelName.trim(), newChannelMembers, myId);
    setChannels(prev => [...prev, ch]);
    setActiveChannel(ch);
    setShowNewChannel(false);
    setNewChannelName('');
    setNewChannelMembers([]);
  };

  const startCall = async (kind: 'voice' | 'video') => {
    if (!activeChannel) return;
    const memberIds = activeChannelMemberIds.current.length > 0 ? activeChannelMemberIds.current : [myId];
    try {
      const meeting = await messenger.startCall(activeChannel.id, memberIds, myId, myName, kind);
      setActiveCall({ room: meeting.jitsi_room, title: meeting.title, kind });
    } catch (e) { console.error('Failed to start call:', e); }
  };

  const label = activeChannelLabel();

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1500] bg-black/40 flex items-center justify-center p-3 sm:p-6"
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden"
          >
          {checkingAccess ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[var(--text-muted)]">Loading…</p>
            </div>
          ) : !messagingAllowed ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <MessageSquare className="w-10 h-10 text-[var(--text-muted)]" />
              <p className="text-sm font-bold text-[var(--text-primary)]">Messaging is disabled for your account</p>
              <p className="text-xs text-[var(--text-muted)] max-w-xs">The CEO has turned off chat access for this account. Contact your administrator if you believe this is a mistake.</p>
              <button onClick={onClose} className="erp-btn erp-btn-ghost mt-2">Close</button>
            </div>
          ) : (
          <>
            {/* Sidebar */}
            <div className="w-72 shrink-0 border-r border-[var(--border)] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--accent)]" /> Messenger
                </h3>
                <button onClick={() => setShowNewChannel(true)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer" title="New group channel">
                  <Plus size={16} />
                </button>
              </div>
              <div className="px-3 pt-3 pb-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people…"
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {everyoneChannel && globalChatEnabled && (
                  <SidebarRow
                    active={activeChannel?.id === everyoneChannel.id}
                    onClick={() => setActiveChannel(everyoneChannel)}
                    icon={<div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0"><Users size={15} /></div>}
                    title="Everyone" subtitle="Company-wide broadcast"
                    unread={unreadCounts[everyoneChannel.id]}
                    muted={mutedChannelIds.has(everyoneChannel.id)}
                    menuOpen={rowMenuFor === everyoneChannel.id}
                    onToggleMenu={() => setRowMenuFor(rowMenuFor === everyoneChannel.id ? null : everyoneChannel.id)}
                    onMarkUnread={() => markChannelUnread(everyoneChannel.id)}
                    onToggleMute={() => toggleMuteChannel(everyoneChannel.id)}
                  />
                )}
                {departmentChatEnabled && groupChannels.length > 0 && (
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2.5 pt-3 pb-1">Groups</p>
                )}
                {departmentChatEnabled && groupChannels.map(ch => (
                  <SidebarRow
                    key={ch.id}
                    active={activeChannel?.id === ch.id}
                    onClick={() => setActiveChannel(ch)}
                    icon={<div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">{initials(ch.name || 'GC')}</div>}
                    title={ch.name || 'Group'}
                    unread={unreadCounts[ch.id]}
                    muted={mutedChannelIds.has(ch.id)}
                    menuOpen={rowMenuFor === ch.id}
                    onToggleMenu={() => setRowMenuFor(rowMenuFor === ch.id ? null : ch.id)}
                    onMarkUnread={() => markChannelUnread(ch.id)}
                    onToggleMute={() => toggleMuteChannel(ch.id)}
                  />
                ))}
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2.5 pt-3 pb-1">People</p>
                {filteredContacts.map(c => {
                  const dm = dmChannelByUser[c.id];
                  const isActive = dm && activeChannel?.id === dm.id;
                  const online = onlineIds.has(c.id);
                  return (
                    <SidebarRow
                      key={c.id}
                      active={!!isActive}
                      onClick={() => openDm(c.id)}
                      icon={
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold">{initials(c.fullName)}</div>
                          {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-card)]" />}
                        </div>
                      }
                      title={c.fullName} subtitle={online ? 'Online' : c.department}
                      unread={dm ? unreadCounts[dm.id] : undefined}
                      muted={dm ? mutedChannelIds.has(dm.id) : false}
                      menuOpen={!!dm && rowMenuFor === dm.id}
                      onToggleMenu={dm ? () => setRowMenuFor(rowMenuFor === dm.id ? null : dm.id) : undefined}
                      onMarkUnread={dm ? () => markChannelUnread(dm.id) : undefined}
                      onToggleMute={dm ? () => toggleMuteChannel(dm.id) : undefined}
                    />
                  );
                })}
              </div>
            </div>

            {/* Main thread */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{label.title || 'Select a conversation'}</p>
                  {label.subtitle && <p className="text-[10px] text-[var(--text-muted)]">{label.subtitle}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {activeChannel && (
                    <>
                      {pinnedMessages.length > 0 && (
                        <button onClick={() => setShowPinnedList(true)} className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer relative" title="Pinned messages">
                          <Pin size={16} />
                          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--accent)] text-white text-[8px] font-bold flex items-center justify-center">{pinnedMessages.length}</span>
                        </button>
                      )}
                      <button onClick={() => setStarredOnly(v => !v)} className={`p-2 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer ${starredOnly ? 'text-amber-500' : 'text-[var(--text-muted)]'}`} title="Starred only">
                        <Star size={16} fill={starredOnly ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => setShowThreadSearch(v => !v)} className={`p-2 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer ${showThreadSearch ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} title="Search this conversation">
                        <Search size={16} />
                      </button>
                      {messages.some(m => m.attachment_type === 'image') && (
                        <button onClick={() => setShowGallery(true)} className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--text-muted)] cursor-pointer" title="Media in this conversation">
                          <Images size={16} />
                        </button>
                      )}
                      <button onClick={() => startCall('voice')} className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer" title="Voice call"><Phone size={16} /></button>
                      <button onClick={() => startCall('video')} className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer" title="Video call"><Video size={16} /></button>
                    </>
                  )}
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer ml-1"><X size={16} /></button>
                </div>
              </div>

              {showThreadSearch && activeChannel && (
                <div className="px-4 py-2 border-b border-[var(--border)] shrink-0">
                  <input
                    autoFocus
                    value={threadSearch}
                    onChange={e => setThreadSearch(e.target.value)}
                    placeholder="Search this conversation…"
                    className="w-full px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!activeChannel && <p className="text-xs text-[var(--text-muted)] text-center py-10">Pick a person or channel to start chatting.</p>}
                {activeChannel && messages.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-10">No messages yet — say hello.</p>}
                {activeChannel && messages.length > 0 && visibleMessages.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-10">{starredOnly ? 'No starred messages.' : 'No messages match your search.'}</p>
                )}
                {visibleMessages.map(msg => {
                  const mine = msg.sender_id === myId;
                  const quoted = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                  const msgReactions = reactions[msg.id] || [];
                  const readByOthers = (reads[msg.id] || []).filter(uid => uid !== myId).length > 0;
                  const isCall = msg.attachment_type === 'call';
                  const isDeleted = !!msg.deleted_at;
                  const isStarred = starredIds.has(msg.id);
                  const isPinned = pinnedIds.has(msg.id);
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[70%]">
                        {!mine && activeChannel?.type !== 'dm' && <p className="text-[9px] font-bold text-[var(--text-muted)] mb-0.5 ml-1">{msg.sender}</p>}
                        {msg.forwarded_from_id && (
                          <p className={`text-[9px] italic mb-0.5 flex items-center gap-1 ${mine ? 'justify-end' : ''} text-[var(--text-muted)]`}><Forward size={9} /> Forwarded</p>
                        )}
                        {quoted && !isDeleted && (
                          <div className="mb-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] border-l-2 border-[var(--accent)] text-[10px] text-[var(--text-muted)] truncate">
                            {quoted.sender}: {quoted.deleted_at ? 'This message was deleted' : quoted.content}
                          </div>
                        )}
                        <div className={`group relative px-3 py-2 rounded-2xl ${mine ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-primary)]'}`}>
                          {isDeleted ? (
                            <p className={`text-xs italic ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>This message was deleted</p>
                          ) : isCall ? (
                            <button onClick={async () => {
                              const { data } = await supabase.from('meetings').select('*').eq('id', msg.attachment_url).limit(1);
                              if (data && data[0]) setActiveCall({ room: data[0].jitsi_room, title: data[0].title, kind: data[0].title.includes('Video') ? 'video' : 'voice' });
                            }} className={`flex items-center gap-2 text-xs font-bold cursor-pointer underline ${mine ? 'text-white' : 'text-[var(--accent)]'}`}>
                              {msg.content}
                            </button>
                          ) : msg.attachment_type === 'image' && msg.attachment_urls && msg.attachment_urls.length > 1 ? (
                            <div className="grid grid-cols-2 gap-1 mb-1 max-w-[220px]">
                              {msg.attachment_urls.map((path, i) => attachmentUrls[path] ? (
                                <button key={path} onClick={() => setLightbox({ urls: msg.attachment_urls!.map(p => attachmentUrls[p]).filter(Boolean), index: i })} className="cursor-pointer">
                                  <img src={attachmentUrls[path]} alt="attachment" className="rounded-lg w-full h-20 object-cover" />
                                </button>
                              ) : <div key={path} className="rounded-lg w-full h-20 bg-black/10" />)}
                            </div>
                          ) : msg.attachment_type === 'image' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                            <button onClick={() => setLightbox({ urls: [attachmentUrls[msg.attachment_url!]], index: 0 })} className="cursor-pointer">
                              <img src={attachmentUrls[msg.attachment_url]} alt="attachment" className="rounded-lg max-w-full max-h-52 mb-1" />
                            </button>
                          ) : msg.attachment_type === 'audio' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                            <audio controls src={attachmentUrls[msg.attachment_url]} className="max-w-full mb-1" style={{ height: 32 }} />
                          ) : msg.attachment_type === 'file' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                            <div className="mb-1">
                              <a href={attachmentUrls[msg.attachment_url]} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 text-xs font-semibold underline ${mine ? 'text-white' : 'text-[var(--accent)]'}`}>
                                <FileText size={13} /> {msg.attachment_name || 'File'} <Download size={11} />
                              </a>
                              {msg.attachment_name?.toLowerCase().endsWith('.pdf') && (
                                <button onClick={() => setPdfPreviewFor(pdfPreviewFor === msg.id ? null : msg.id)} className={`text-[10px] underline mt-0.5 cursor-pointer ${mine ? 'text-white/80' : 'text-[var(--accent)]'}`}>
                                  {pdfPreviewFor === msg.id ? 'Hide preview' : 'Preview'}
                                </button>
                              )}
                              {pdfPreviewFor === msg.id && (
                                <iframe src={attachmentUrls[msg.attachment_url]} title={msg.attachment_name || 'PDF preview'} className="w-64 h-80 mt-1 rounded-lg border border-[var(--border)] bg-white" />
                              )}
                            </div>
                          ) : null}
                          {!isCall && !isDeleted && <p className="text-xs leading-relaxed">{msg.content}</p>}
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            {isPinned && <Pin size={9} className={mine ? 'text-white/70' : 'text-[var(--text-muted)]'} />}
                            {isStarred && <Star size={9} fill="currentColor" className="text-amber-400" />}
                            {msg.edited_at && !isDeleted && <span className={`text-[9px] ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>(edited)</span>}
                            <span className={`text-[9px] ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{msg.time}</span>
                            {mine && (
                              <button onClick={() => setReadListFor(readListFor === msg.id ? null : msg.id)} className="cursor-pointer" title="Who's read this">
                                {readByOthers ? <CheckCheck size={11} className="text-white/90" /> : <Check size={11} className="text-white/70" />}
                              </button>
                            )}
                          </div>
                          {readListFor === msg.id && (
                            <div className={`absolute top-full mt-1 ${mine ? 'right-0' : 'left-0'} bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-card z-10 min-w-[160px] p-2`}>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Read by</p>
                              {(reads[msg.id] || []).filter(uid => uid !== myId).length === 0 ? (
                                <p className="text-[10px] text-[var(--text-muted)]">No one yet</p>
                              ) : (reads[msg.id] || []).filter(uid => uid !== myId).map(uid => (
                                <p key={uid} className="text-[10px] text-[var(--text-primary)] py-0.5">{profiles.find(pr => pr.id === uid)?.fullName || 'Unknown'}</p>
                              ))}
                            </div>
                          )}

                          {/* Hover actions */}
                          {!isDeleted && (
                            <div className={`absolute -top-3 ${mine ? 'left-0' : 'right-0'} hidden group-hover:flex items-center gap-0.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-1 py-0.5 shadow-card`}>
                              <button onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)} className="p-1 hover:bg-[var(--accent-light)] rounded-full cursor-pointer"><Smile size={12} /></button>
                              <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-[var(--accent-light)] rounded-full cursor-pointer"><Reply size={12} /></button>
                              <button onClick={() => setActionMenuFor(actionMenuFor === msg.id ? null : msg.id)} className="p-1 hover:bg-[var(--accent-light)] rounded-full cursor-pointer"><MoreVertical size={12} /></button>
                            </div>
                          )}
                          {reactionPickerFor === msg.id && (
                            <div className={`absolute -top-10 ${mine ? 'left-0' : 'right-0'} flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-card z-10`}>
                              {REACTION_EMOJIS.map(e => (
                                <button key={e} onClick={() => { messenger.toggleReaction(msg.id, myId, e); setReactionPickerFor(null); }} className="text-sm hover:scale-125 transition-transform cursor-pointer">{e}</button>
                              ))}
                            </div>
                          )}
                          {actionMenuFor === msg.id && (
                            <div className={`absolute top-6 ${mine ? 'left-0' : 'right-0'} flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-card z-10 min-w-[160px] py-1 text-[var(--text-primary)]`}>
                              <button onClick={() => copyMessage(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left"><Copy size={12} /> Copy</button>
                              <button onClick={() => toggleStarMessage(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left"><Star size={12} /> {isStarred ? 'Unstar' : 'Star'}</button>
                              <button onClick={() => togglePinMessage(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left"><Pin size={12} /> {isPinned ? 'Unpin' : 'Pin'}</button>
                              <button onClick={() => { setForwardTarget(msg); setActionMenuFor(null); }} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left"><Forward size={12} /> Forward</button>
                              {mine && <button onClick={() => startEdit(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left"><Pencil size={12} /> Edit</button>}
                              <button onClick={() => deleteForMe(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left text-rose-500"><Trash2 size={12} /> Delete for me</button>
                              {mine && <button onClick={() => deleteForEveryone(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left text-rose-500"><Trash2 size={12} /> Delete for everyone</button>}
                            </div>
                          )}
                        </div>
                        {msgReactions.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(msgReactions.reduce((acc: Record<string, number>, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})).map(([emoji, count]) => (
                              <button key={emoji} onClick={() => messenger.toggleReaction(msg.id, myId, emoji)} className="text-[10px] bg-[var(--bg-input)] border border-[var(--border)] rounded-full px-1.5 py-0.5 cursor-pointer hover:bg-[var(--accent-light)]">
                                {emoji} {count}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {typingNames.length > 0 && (
                <p className="text-[10px] text-[var(--text-muted)] px-4 pb-1 italic">{typingNames.join(', ')} typing…</p>
              )}

              {replyTo && !editingMessage && (
                <div className="mx-4 mb-1 px-3 py-1.5 rounded-lg bg-[var(--bg-input)] border-l-2 border-[var(--accent)] flex items-center justify-between">
                  <p className="text-[10px] text-[var(--text-muted)] truncate">Replying to {replyTo.sender}: {replyTo.content}</p>
                  <button onClick={() => setReplyTo(null)} className="p-0.5 cursor-pointer"><X size={12} /></button>
                </div>
              )}

              {editingMessage && (
                <div className="mx-4 mb-1 px-3 py-1.5 rounded-lg bg-[var(--bg-input)] border-l-2 border-amber-400 flex items-center justify-between">
                  <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1"><Pencil size={10} /> Editing message</p>
                  <button onClick={() => { setEditingMessage(null); setEditText(''); }} className="p-0.5 cursor-pointer"><X size={12} /></button>
                </div>
              )}

              {activeChannel && (
                <div className="flex items-center gap-2 p-3 border-t border-[var(--border)] shrink-0">
                  {editingMessage ? (
                    <>
                      <input
                        type="text" value={editText} autoFocus
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        className="flex-1 px-3 py-2 bg-[var(--bg-input)] border border-amber-400 rounded-xl text-xs text-[var(--text-primary)] outline-none"
                      />
                      <button onClick={saveEdit} className="p-2 bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90 shrink-0"><Check size={15} /></button>
                    </>
                  ) : (
                    <>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = ''; }} />
                      <button onClick={() => fileInputRef.current?.click()} title="Attach a file" className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer shrink-0"><Paperclip size={16} /></button>
                      <input ref={multiImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); if (files.length === 1) handleAttach(files[0]); else if (files.length > 1) handleAttachMultiple(files); e.target.value = ''; }} />
                      <button onClick={() => multiImageInputRef.current?.click()} title="Send photos" className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer shrink-0"><Images size={16} /></button>
                      <button
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        title={isRecording ? 'Stop recording' : 'Record a voice note'}
                        className={`p-2 rounded-lg cursor-pointer shrink-0 ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'hover:bg-[var(--bg-input)] text-[var(--text-muted)]'}`}
                      >
                        {isRecording ? <Square size={16} /> : <Mic size={16} />}
                      </button>
                      <div className="relative flex-1">
                        {mentionCandidates.length > 0 && (
                          <div className="absolute bottom-full mb-1 left-0 right-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-card py-1 z-10">
                            {mentionCandidates.map(pr => (
                              <button key={pr.id} onClick={() => insertMention(pr.fullName)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--accent-light)] cursor-pointer text-left text-[var(--text-primary)]">
                                <span className="font-bold">@{pr.fullName}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">{pr.department}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          type="text" placeholder="Type message..." value={composer}
                          onChange={e => handleComposerChange(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSend()}
                          className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        />
                      </div>
                      <button onClick={handleSend} className="p-2 bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90 shrink-0"><Send size={15} /></button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
          )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* New Channel modal */}
    {showNewChannel && (
      <div className="fixed inset-0 z-[1600] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">New Group Channel</h3>
            <button onClick={() => setShowNewChannel(false)} className="p-1 cursor-pointer"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-3">
            <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="Channel name"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none" />
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Members</p>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {profiles.map(p => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-xs">
                  <input type="checkbox" checked={newChannelMembers.includes(p.id)}
                    onChange={e => setNewChannelMembers(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))} />
                  {p.fullName} <span className="text-[var(--text-muted)]">({p.department})</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
            <button onClick={() => setShowNewChannel(false)} className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">Cancel</button>
            <button onClick={handleCreateChannel} className="px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer" style={{ background: 'var(--accent)' }}>Create</button>
          </div>
        </div>
      </div>
    )}

    {/* Forward-to picker */}
    {forwardTarget && (
      <div className="fixed inset-0 z-[1600] bg-black/50 flex items-center justify-center p-4" onClick={() => setForwardTarget(null)}>
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Forward to…</h3>
            <button onClick={() => setForwardTarget(null)} className="p-1 cursor-pointer"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {everyoneChannel && (
              <button onClick={() => forwardMessage(everyoneChannel)} className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-[var(--accent-light)] cursor-pointer text-left">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0"><Users size={14} /></div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Everyone</p>
              </button>
            )}
            {groupChannels.map(ch => (
              <button key={ch.id} onClick={() => forwardMessage(ch)} className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-[var(--accent-light)] cursor-pointer text-left">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">{initials(ch.name || 'GC')}</div>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{ch.name}</p>
              </button>
            ))}
            {profiles.map(c => (
              <button key={c.id} onClick={async () => forwardMessage(dmChannelByUser[c.id] || await messenger.getOrCreateDmChannel(myId, c.id))} className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-[var(--accent-light)] cursor-pointer text-left">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">{initials(c.fullName)}</div>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{c.fullName}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Pinned messages */}
    {showPinnedList && (
      <div className="fixed inset-0 z-[1600] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPinnedList(false)}>
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2"><Pin size={14} /> Pinned Messages</h3>
            <button onClick={() => setShowPinnedList(false)} className="p-1 cursor-pointer"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pinnedMessages.map(m => (
              <div key={m.id} className="p-2.5 rounded-xl bg-[var(--bg-input)]">
                <p className="text-[10px] font-bold text-[var(--text-muted)]">{m.sender}</p>
                <p className="text-xs text-[var(--text-primary)] mt-0.5">{m.deleted_at ? 'This message was deleted' : m.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* Gallery — every image sent in this conversation, grid + tap-to-lightbox */}
    {showGallery && (() => {
      const allImageUrls = messages.flatMap(m =>
        m.attachment_type !== 'image' ? [] :
        m.attachment_urls && m.attachment_urls.length > 0 ? m.attachment_urls.map(p => attachmentUrls[p]).filter(Boolean) :
        m.attachment_url && attachmentUrls[m.attachment_url] ? [attachmentUrls[m.attachment_url]] : []
      );
      return (
        <div className="fixed inset-0 z-[1600] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowGallery(false)}>
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2"><Images size={14} /> Media</h3>
              <button onClick={() => setShowGallery(false)} className="p-1 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-1.5">
              {allImageUrls.length === 0 && <p className="col-span-3 text-xs text-[var(--text-muted)] text-center py-10">No photos yet.</p>}
              {allImageUrls.map((url, i) => (
                <button key={i} onClick={() => setLightbox({ urls: allImageUrls, index: i })} className="cursor-pointer">
                  <img src={url} alt="" className="w-full h-24 object-cover rounded-lg" />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    })()}

    {/* Lightbox — full-size image, prev/next through the same set */}
    {lightbox && (
      <div className="fixed inset-0 z-[1700] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
        <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 p-2 text-white cursor-pointer"><X size={22} /></button>
        {lightbox.urls.length > 1 && (
          <button onClick={e => { e.stopPropagation(); setLightbox(l => l && { ...l, index: (l.index - 1 + l.urls.length) % l.urls.length }); }} className="absolute left-4 p-2 text-white cursor-pointer text-2xl">‹</button>
        )}
        <img src={lightbox.urls[lightbox.index]} alt="" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
        {lightbox.urls.length > 1 && (
          <button onClick={e => { e.stopPropagation(); setLightbox(l => l && { ...l, index: (l.index + 1) % l.urls.length }); }} className="absolute right-4 p-2 text-white cursor-pointer text-2xl">›</button>
        )}
      </div>
    )}

    {activeCall && (
      <JitsiCallModal room={activeCall.room} title={activeCall.title} kind={activeCall.kind} onClose={() => setActiveCall(null)} />
    )}
    </>
  );
}
