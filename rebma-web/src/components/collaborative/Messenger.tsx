// rebma-web/src/components/collaborative/Messenger.tsx
// Complete chat messenger: "Everyone" broadcast + group channels + 1-on-1
// DMs, file/image attachments, emoji reactions, threaded replies, read
// receipts, typing indicators (Supabase Realtime Presence), and ad-hoc
// voice/video calls (real Jitsi rooms) launched from any conversation.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MessageSquare, Search, Users, X, Send, Paperclip, Smile, Reply,
  Phone, Video, Check, CheckCheck, Plus, FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { messenger } from '../../services/apiClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import JitsiCallModal from './JitsiCallModal';
import type { CurrentUser } from '../../types/erp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: CurrentUser | null;
}

interface Profile { id: string; fullName: string; department: string; }
interface Channel { id: string; name: string | null; type: 'group' | 'dm' | 'everyone'; created_by: string | null; created_at: string; }
interface Msg {
  id: string; channel_id: string; sender_id: string | null; sender: string; content: string;
  time: string; attachment_url: string | null; attachment_type: string | null; attachment_name: string | null;
  reply_to_id: string | null; created_at: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👏'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function Messenger({ isOpen, onClose, currentUser }: Props) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const myId = currentUser?.id || '';
  const myName = currentUser?.fullName || 'Me';

  // ── Bootstrap: profiles + my channels ──
  useEffect(() => {
    if (!isOpen || !myId) return;
    (async () => {
      const { data } = await supabase.from('profiles_directory').select('id, full_name, role').eq('status', 'ACTIVE').order('full_name', { ascending: true });
      setProfiles((data || []).map((p: any) => ({ id: p.id, fullName: p.full_name || 'Unknown', department: p.role || '' })).filter(p => p.id !== myId));

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
    const msgs = await messenger.fetchMessages(activeChannel.id);
    setMessages(msgs as Msg[]);
    const ids = msgs.map((m: any) => m.id);
    const [rx, rd] = await Promise.all([messenger.fetchReactions(ids), messenger.fetchReads(ids)]);
    const rxMap: Record<string, { emoji: string; user_id: string }[]> = {};
    for (const r of rx) { (rxMap[r.message_id] ||= []).push({ emoji: r.emoji, user_id: r.user_id }); }
    setReactions(rxMap);
    const rdMap: Record<string, string[]> = {};
    for (const r of rd) { (rdMap[r.message_id] ||= []).push(r.user_id); }
    setReads(rdMap);
    // Mark all as read by me
    for (const m of msgs as Msg[]) {
      if (m.sender_id !== myId) messenger.markRead(m.id, myId);
    }
  }, [activeChannel, myId]);

  useEffect(() => { loadThread(); }, [loadThread]);

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

  // Resolve signed URLs for attachments lazily
  useEffect(() => {
    const paths = messages.filter(m => m.attachment_url && m.attachment_type !== 'call' && !attachmentUrls[m.attachment_url!]).map(m => m.attachment_url!);
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

  const filteredContacts = useMemo(
    () => profiles.filter(p => p.fullName.toLowerCase().includes(search.toLowerCase())),
    [profiles, search]
  );

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
    return { title: other?.fullName || 'Direct Message', subtitle: other?.department || '' };
  };

  const handleSend = async () => {
    if (!composer.trim() || !activeChannel) return;
    if (activeChannel.type === 'everyone' && !globalChatEnabled) return;
    if (activeChannel.type === 'group' && !departmentChatEnabled) return;
    if (activeChannel.type === 'dm' && !directMessagesEnabled) return;
    const text = composer;
    setComposer('');
    setReplyTo(null);
    try {
      await messenger.sendMessage(activeChannel.id, myId, myName, text, replyTo ? { replyToId: replyTo.id } : undefined);
    } catch (e) { console.error('Send failed:', e); }
  };

  const handleAttach = async (file: File) => {
    if (!activeChannel) return;
    try {
      const path = await messenger.uploadChatAttachment(file, activeChannel.id);
      const isImage = file.type.startsWith('image/');
      await messenger.sendMessage(activeChannel.id, myId, myName, isImage ? '📷 Photo' : `📎 ${file.name}`, {
        attachmentUrl: path, attachmentType: isImage ? 'image' : 'file', attachmentName: file.name,
      });
    } catch (e) { console.error('Attachment upload failed:', e); }
  };

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
                  <button onClick={() => setActiveChannel(everyoneChannel)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer text-left ${activeChannel?.id === everyoneChannel.id ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--accent-light)]'}`}>
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0"><Users size={15} /></div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[var(--text-primary)]">Everyone</p><p className="text-[10px] text-[var(--text-muted)]">Company-wide broadcast</p></div>
                  </button>
                )}
                {departmentChatEnabled && groupChannels.length > 0 && (
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2.5 pt-3 pb-1">Groups</p>
                )}
                {departmentChatEnabled && groupChannels.map(ch => (
                  <button key={ch.id} onClick={() => setActiveChannel(ch)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer text-left ${activeChannel?.id === ch.id ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--accent-light)]'}`}>
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">{initials(ch.name || 'GC')}</div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[var(--text-primary)] truncate">{ch.name}</p></div>
                  </button>
                ))}
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2.5 pt-3 pb-1">People</p>
                {filteredContacts.map(c => {
                  const dm = dmChannelByUser[c.id];
                  const isActive = dm && activeChannel?.id === dm.id;
                  return (
                    <button key={c.id} onClick={() => openDm(c.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer text-left ${isActive ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--accent-light)]'}`}>
                      <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">{initials(c.fullName)}</div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[var(--text-primary)] truncate">{c.fullName}</p><p className="text-[10px] text-[var(--text-muted)] truncate">{c.department}</p></div>
                    </button>
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
                      <button onClick={() => startCall('voice')} className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer" title="Voice call"><Phone size={16} /></button>
                      <button onClick={() => startCall('video')} className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--accent)] cursor-pointer" title="Video call"><Video size={16} /></button>
                    </>
                  )}
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer ml-1"><X size={16} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!activeChannel && <p className="text-xs text-[var(--text-muted)] text-center py-10">Pick a person or channel to start chatting.</p>}
                {activeChannel && messages.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-10">No messages yet — say hello.</p>}
                {messages.map(msg => {
                  const mine = msg.sender_id === myId;
                  const quoted = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                  const msgReactions = reactions[msg.id] || [];
                  const readByOthers = (reads[msg.id] || []).filter(uid => uid !== myId).length > 0;
                  const isCall = msg.attachment_type === 'call';
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[70%]">
                        {!mine && activeChannel?.type !== 'dm' && <p className="text-[9px] font-bold text-[var(--text-muted)] mb-0.5 ml-1">{msg.sender}</p>}
                        {quoted && (
                          <div className="mb-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-input)] border-l-2 border-[var(--accent)] text-[10px] text-[var(--text-muted)] truncate">
                            {quoted.sender}: {quoted.content}
                          </div>
                        )}
                        <div className={`group relative px-3 py-2 rounded-2xl ${mine ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-primary)]'}`}>
                          {isCall ? (
                            <button onClick={async () => {
                              const { data } = await supabase.from('meetings').select('*').eq('id', msg.attachment_url).limit(1);
                              if (data && data[0]) setActiveCall({ room: data[0].jitsi_room, title: data[0].title, kind: data[0].title.includes('Video') ? 'video' : 'voice' });
                            }} className={`flex items-center gap-2 text-xs font-bold cursor-pointer underline ${mine ? 'text-white' : 'text-[var(--accent)]'}`}>
                              {msg.content}
                            </button>
                          ) : msg.attachment_type === 'image' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                            <img src={attachmentUrls[msg.attachment_url]} alt="attachment" className="rounded-lg max-w-full max-h-52 mb-1" />
                          ) : msg.attachment_type === 'file' && msg.attachment_url && attachmentUrls[msg.attachment_url] ? (
                            <a href={attachmentUrls[msg.attachment_url]} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 text-xs font-semibold underline ${mine ? 'text-white' : 'text-[var(--accent)]'}`}>
                              <FileText size={13} /> {msg.attachment_name || 'File'}
                            </a>
                          ) : null}
                          {!isCall && <p className="text-xs leading-relaxed">{msg.content}</p>}
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <span className={`text-[9px] ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{msg.time}</span>
                            {mine && (readByOthers ? <CheckCheck size={11} className="text-white/90" /> : <Check size={11} className="text-white/70" />)}
                          </div>

                          {/* Hover actions */}
                          <div className={`absolute -top-3 ${mine ? 'left-0' : 'right-0'} hidden group-hover:flex items-center gap-0.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-1 py-0.5 shadow-card`}>
                            <button onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)} className="p-1 hover:bg-[var(--accent-light)] rounded-full cursor-pointer"><Smile size={12} /></button>
                            <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-[var(--accent-light)] rounded-full cursor-pointer"><Reply size={12} /></button>
                          </div>
                          {reactionPickerFor === msg.id && (
                            <div className={`absolute -top-10 ${mine ? 'left-0' : 'right-0'} flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-2 py-1 shadow-card z-10`}>
                              {REACTION_EMOJIS.map(e => (
                                <button key={e} onClick={() => { messenger.toggleReaction(msg.id, myId, e); setReactionPickerFor(null); }} className="text-sm hover:scale-125 transition-transform cursor-pointer">{e}</button>
                              ))}
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

              {replyTo && (
                <div className="mx-4 mb-1 px-3 py-1.5 rounded-lg bg-[var(--bg-input)] border-l-2 border-[var(--accent)] flex items-center justify-between">
                  <p className="text-[10px] text-[var(--text-muted)] truncate">Replying to {replyTo.sender}: {replyTo.content}</p>
                  <button onClick={() => setReplyTo(null)} className="p-0.5 cursor-pointer"><X size={12} /></button>
                </div>
              )}

              {activeChannel && (
                <div className="flex items-center gap-2 p-3 border-t border-[var(--border)] shrink-0">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = ''; }} />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] cursor-pointer shrink-0"><Paperclip size={16} /></button>
                  <input
                    type="text" placeholder="Type message..." value={composer}
                    onChange={e => { setComposer(e.target.value); notifyTyping(); }}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    className="flex-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <button onClick={handleSend} className="p-2 bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90 shrink-0"><Send size={15} /></button>
                </div>
              )}
            </div>
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

    {activeCall && (
      <JitsiCallModal room={activeCall.room} title={activeCall.title} kind={activeCall.kind} onClose={() => setActiveCall(null)} />
    )}
    </>
  );
}
