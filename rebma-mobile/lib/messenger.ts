// rebma-mobile/lib/messenger.ts
// Phase 11.0 — the mobile equivalent of rebma-web's
// services/apiClient.ts `messenger` object. Same tables (channels /
// channel_members / chat_messages / chat_message_reactions /
// chat_message_reads), same write shapes, so a message sent from a phone
// is indistinguishable from one sent on web — one shared conversation,
// not two parallel chat systems.
//
// Supersedes the old lib/directMessage.ts (folded in here as
// getOrCreateDmChannel/sendMessage) — that file only ever existed as a
// write-only helper for Live Users' Send Message button; this is the real
// thing it was always meant to grow into.
import { supabase } from './supabaseClient';
import { uploadToPrivateBucket, getSignedUrl } from './storage';

export interface Channel {
  id: string;
  name: string | null;
  type: 'group' | 'dm' | 'everyone';
  created_by: string | null;
  created_at: string;
  photo_url?: string | null;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  sender: string;
  content: string;
  time: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  forwarded_from_id?: string | null;
  attachment_urls?: string[] | null;
}

export const messenger = {
  ensureEveryoneChannel: async (): Promise<string | null> => {
    const { data: existing } = await supabase.from('channels').select('id').eq('type', 'everyone').limit(1);
    if (existing && existing.length > 0) return existing[0].id;
    const { data: created, error } = await supabase.from('channels').insert({ name: 'Everyone', type: 'everyone' }).select();
    if (error || !created) return null;
    return created[0].id;
  },

  listMyChannels: async (userId: string): Promise<Channel[]> => {
    const { data: memberships } = await supabase.from('channel_members').select('channel_id').eq('user_id', userId);
    const ids = (memberships || []).map((m: any) => m.channel_id);
    if (ids.length === 0) return [];
    const { data: channels } = await supabase.from('channels').select('*').in('id', ids).order('created_at', { ascending: false });
    return (channels || []) as Channel[];
  },

  joinChannel: async (channelId: string, userId: string) => {
    await supabase.from('channel_members').upsert({ channel_id: channelId, user_id: userId }, { onConflict: 'channel_id,user_id' });
  },

  getOrCreateDmChannel: async (myId: string, otherId: string): Promise<Channel> => {
    const { data: myChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', myId);
    const myIds = (myChannels || []).map((c: any) => c.channel_id);
    if (myIds.length > 0) {
      const { data: otherChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', otherId).in('channel_id', myIds);
      for (const oc of otherChannels || []) {
        const { data: chRow } = await supabase.from('channels').select('*').eq('id', oc.channel_id).eq('type', 'dm').limit(1);
        if (chRow && chRow.length > 0) {
          const { count } = await supabase.from('channel_members').select('user_id', { count: 'exact', head: true }).eq('channel_id', oc.channel_id);
          if (count === 2) return chRow[0] as Channel;
        }
      }
    }
    const { data: created, error } = await supabase.from('channels').insert({ type: 'dm', created_by: myId }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to create DM channel');
    const channel = created[0];
    await supabase.from('channel_members').insert([
      { channel_id: channel.id, user_id: myId },
      { channel_id: channel.id, user_id: otherId },
    ]);
    return channel as Channel;
  },

  createGroupChannel: async (name: string, memberIds: string[], creatorId: string): Promise<Channel> => {
    const { data: created, error } = await supabase.from('channels').insert({ name, type: 'group', created_by: creatorId }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to create channel');
    const channel = created[0];
    const allMembers = Array.from(new Set([...memberIds, creatorId]));
    await supabase.from('channel_members').insert(allMembers.map((uid) => ({ channel_id: channel.id, user_id: uid })));
    return channel as Channel;
  },

  // Phase 11.4 — group management. No admin/member-role distinction
  // exists anywhere in this schema, so any current member may rename,
  // re-photo, or add/remove another member (mirrors web's apiClient.ts).
  renameChannel: async (channelId: string, name: string) => {
    const { error } = await supabase.from('channels').update({ name }).eq('id', channelId);
    if (error) throw new Error(error.message);
  },

  setChannelPhoto: async (channelId: string, photoPath: string | null) => {
    const { error } = await supabase.from('channels').update({ photo_url: photoPath }).eq('id', channelId);
    if (error) throw new Error(error.message);
  },

  fetchChannelMembers: async (channelId: string): Promise<{ id: string; full_name: string; department: string }[]> => {
    const { data: memberRows } = await supabase.from('channel_members').select('user_id').eq('channel_id', channelId);
    const ids = (memberRows || []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];
    const { data } = await supabase.from('profiles_directory').select('id, full_name, department').in('id', ids);
    return (data || []) as any;
  },

  addChannelMembers: async (channelId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    await supabase.from('channel_members').upsert(userIds.map((uid) => ({ channel_id: channelId, user_id: uid })), { onConflict: 'channel_id,user_id' });
  },

  removeChannelMember: async (channelId: string, userId: string) => {
    await supabase.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', userId);
  },

  fetchMessages: async (channelId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data || []) as ChatMessage[];
  },

  sendMessage: async (
    channelId: string,
    senderId: string,
    senderName: string,
    content: string,
    opts?: { attachmentUrl?: string; attachmentUrls?: string[]; attachmentType?: string; attachmentName?: string; replyToId?: string; forwardedFromId?: string }
  ): Promise<ChatMessage | null> => {
    const { data, error } = await supabase.from('chat_messages').insert({
      channel_id: channelId,
      sender_id: senderId,
      sender: senderName,
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment_url: opts?.attachmentUrl || null,
      attachment_urls: opts?.attachmentUrls && opts.attachmentUrls.length > 0 ? opts.attachmentUrls : null,
      attachment_type: opts?.attachmentType || null,
      attachment_name: opts?.attachmentName || null,
      reply_to_id: opts?.replyToId || null,
      forwarded_from_id: opts?.forwardedFromId || null,
    }).select();
    if (error) throw new Error(error.message);
    return (data?.[0] as ChatMessage) || null;
  },

  // Phase 11.1 — sender-only, enforced at this call site (mirrors
  // apiClient.ts's editMessage; see supabase_messenger_message_actions.sql's
  // header note on why chat_messages' own RLS isn't touched).
  editMessage: async (messageId: string, senderId: string, newContent: string) => {
    const { error } = await supabase.from('chat_messages').update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', messageId).eq('sender_id', senderId);
    if (error) throw new Error(error.message);
  },

  deleteMessageForMe: async (messageId: string, userId: string) => {
    await supabase.from('chat_message_hidden').upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' });
  },

  fetchHiddenMessageIds: async (userId: string, messageIds: string[]): Promise<string[]> => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('chat_message_hidden').select('message_id').eq('user_id', userId).in('message_id', messageIds);
    return (data || []).map((r: any) => r.message_id as string);
  },

  deleteMessageForEveryone: async (messageId: string, senderId: string) => {
    const { error } = await supabase.from('chat_messages').update({
      deleted_at: new Date().toISOString(), deleted_by: senderId, content: '', attachment_url: null, attachment_type: null, attachment_name: null,
    }).eq('id', messageId).eq('sender_id', senderId);
    if (error) throw new Error(error.message);
  },

  fetchPinned: async (channelId: string): Promise<{ message_id: string; pinned_by: string | null; pinned_by_name: string | null; pinned_at: string }[]> => {
    const { data } = await supabase.from('chat_pinned_messages').select('*').eq('channel_id', channelId).order('pinned_at', { ascending: false });
    return data || [];
  },

  togglePin: async (channelId: string, messageId: string, userId: string, userName: string) => {
    const { data: existing } = await supabase.from('chat_pinned_messages').select('*').eq('channel_id', channelId).eq('message_id', messageId).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('chat_pinned_messages').delete().eq('channel_id', channelId).eq('message_id', messageId);
    } else {
      await supabase.from('chat_pinned_messages').insert({ channel_id: channelId, message_id: messageId, pinned_by: userId, pinned_by_name: userName });
    }
  },

  fetchStars: async (userId: string, messageIds: string[]): Promise<string[]> => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('chat_message_stars').select('message_id').eq('user_id', userId).in('message_id', messageIds);
    return (data || []).map((r: any) => r.message_id as string);
  },

  toggleStar: async (messageId: string, userId: string) => {
    const { data: existing } = await supabase.from('chat_message_stars').select('*').eq('message_id', messageId).eq('user_id', userId).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('chat_message_stars').delete().eq('message_id', messageId).eq('user_id', userId);
    } else {
      await supabase.from('chat_message_stars').insert({ message_id: messageId, user_id: userId });
    }
  },

  // Phase 11.2 — manually mark a conversation unread again, by deleting
  // the caller's own read receipt on its most recent message (mirrors
  // apiClient.ts's markChannelUnread exactly — no new column/mechanism).
  markChannelUnread: async (channelId: string, userId: string) => {
    const { data: last } = await supabase.from('chat_messages').select('id').eq('channel_id', channelId).order('created_at', { ascending: false }).limit(1);
    const lastId = last?.[0]?.id;
    if (!lastId) return;
    await supabase.from('chat_message_reads').delete().eq('message_id', lastId).eq('user_id', userId);
  },

  fetchMutedChannelIds: async (userId: string): Promise<string[]> => {
    const { data } = await supabase.from('chat_channel_mutes').select('channel_id').eq('user_id', userId);
    return (data || []).map((r: any) => r.channel_id as string);
  },

  toggleMute: async (channelId: string, userId: string) => {
    const { data: existing } = await supabase.from('chat_channel_mutes').select('*').eq('channel_id', channelId).eq('user_id', userId).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('chat_channel_mutes').delete().eq('channel_id', channelId).eq('user_id', userId);
    } else {
      await supabase.from('chat_channel_mutes').insert({ channel_id: channelId, user_id: userId });
    }
  },

  fetchMutedUserIds: async (channelId: string, candidateUserIds: string[]): Promise<string[]> => {
    if (candidateUserIds.length === 0) return [];
    const { data } = await supabase.from('chat_channel_mutes').select('user_id').eq('channel_id', channelId).in('user_id', candidateUserIds);
    return (data || []).map((r: any) => r.user_id as string);
  },

  // Phase 11.5 — ad-hoc voice/video call, mirrors apiClient.ts's
  // startCall() exactly (same meetings/meeting_attendees/call-started
  // message/notify shape) so a call started from a phone behaves
  // identically to one started on web.
  startCall: async (channelId: string, memberIds: string[], organizerId: string, organizerName: string, kind: 'voice' | 'video') => {
    const room = `Rebma-${kind === 'voice' ? 'Call' : 'Video'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: created, error } = await supabase.from('meetings').insert({
      title: `${kind === 'voice' ? 'Voice' : 'Video'} call started by ${organizerName}`,
      scheduled_at: new Date().toISOString(),
      duration_minutes: 60,
      organizer_id: organizerId,
      jitsi_room: room,
      status: 'IN_PROGRESS',
    }).select();
    if (error || !created) throw new Error(error?.message || 'Failed to start call');
    const meeting = created[0];
    await supabase.from('meeting_attendees').insert(memberIds.map((uid) => ({ meeting_id: meeting.id, user_id: uid, rsvp_status: uid === organizerId ? 'ACCEPTED' : 'INVITED' })));
    const callMsg = await messenger.sendMessage(channelId, organizerId, organizerName, `📞 ${kind === 'voice' ? 'Voice' : 'Video'} call started — tap to join.`, { attachmentType: 'call', attachmentUrl: meeting.id });
    await messenger.notifyUsers(memberIds.filter((id) => id !== organizerId), 'call_started', `${organizerName} started a ${kind} call`, 'Tap to join now', meeting.id);
    return { ...meeting, callMessageId: callMsg?.id as string | undefined };
  },

  // Phase 11.5 — fired when a call ends, for any invited member who
  // never opened the call-started message (see apiClient.ts's own
  // notifyMissedCall for the "not perfect, but real and simple" scope note).
  notifyMissedCall: async (channelId: string, callMessageId: string, memberIds: string[], organizerId: string, organizerName: string) => {
    const others = memberIds.filter((id) => id !== organizerId);
    if (others.length === 0) return;
    const { data: readRows } = await supabase.from('chat_message_reads').select('user_id').eq('message_id', callMessageId).in('user_id', others);
    const readIds = new Set((readRows || []).map((r: any) => r.user_id));
    const missed = others.filter((id) => !readIds.has(id));
    if (missed.length === 0) return;
    await messenger.notifyUsers(missed, 'missed_call', `Missed call from ${organizerName}`, 'You missed a call', channelId).catch(() => {});
  },

  // Phase 11.6 — conversation-level pin/archive, self-only. Mirrors
  // apiClient.ts exactly.
  fetchPinnedChannelIds: async (userId: string): Promise<string[]> => {
    const { data } = await supabase.from('chat_channel_pins').select('channel_id').eq('user_id', userId);
    return (data || []).map((r: any) => r.channel_id as string);
  },

  toggleChannelPin: async (channelId: string, userId: string) => {
    const { data: existing } = await supabase.from('chat_channel_pins').select('*').eq('channel_id', channelId).eq('user_id', userId).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('chat_channel_pins').delete().eq('channel_id', channelId).eq('user_id', userId);
    } else {
      await supabase.from('chat_channel_pins').insert({ channel_id: channelId, user_id: userId });
    }
  },

  fetchArchivedChannelIds: async (userId: string): Promise<string[]> => {
    const { data } = await supabase.from('chat_channel_archived').select('channel_id').eq('user_id', userId);
    return (data || []).map((r: any) => r.channel_id as string);
  },

  toggleChannelArchive: async (channelId: string, userId: string) => {
    const { data: existing } = await supabase.from('chat_channel_archived').select('*').eq('channel_id', channelId).eq('user_id', userId).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('chat_channel_archived').delete().eq('channel_id', channelId).eq('user_id', userId);
    } else {
      await supabase.from('chat_channel_archived').insert({ channel_id: channelId, user_id: userId });
    }
  },

  clearChannelHistory: async (channelId: string, userId: string) => {
    const { data: msgs } = await supabase.from('chat_messages').select('id').eq('channel_id', channelId);
    const ids = (msgs || []).map((m: any) => m.id);
    if (ids.length === 0) return;
    await supabase.from('chat_message_hidden').upsert(ids.map((id: string) => ({ message_id: id, user_id: userId })), { onConflict: 'message_id,user_id' });
  },

  searchAllMyMessages: async (userId: string, query: string): Promise<ChatMessage[]> => {
    if (!query.trim()) return [];
    const { data: memberships } = await supabase.from('channel_members').select('channel_id').eq('user_id', userId);
    const channelIds = (memberships || []).map((m: any) => m.channel_id);
    if (channelIds.length === 0) return [];
    const { data: hidden } = await supabase.from('chat_message_hidden').select('message_id').eq('user_id', userId);
    const hiddenIds = new Set((hidden || []).map((h: any) => h.message_id));
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .in('channel_id', channelIds)
      .ilike('content', `%${query.trim()}%`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    return ((data || []) as ChatMessage[]).filter((m) => !hiddenIds.has(m.id));
  },

  toggleReaction: async (messageId: string, userId: string, emoji: string) => {
    const { data: existing } = await supabase
      .from('chat_message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();
    if (existing) {
      await supabase.from('chat_message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('chat_message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
    }
  },

  fetchReactions: async (messageIds: string[]): Promise<{ message_id: string; emoji: string; user_id: string }[]> => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('chat_message_reactions').select('message_id, emoji, user_id').in('message_id', messageIds);
    return data || [];
  },

  fetchReads: async (messageIds: string[]): Promise<{ message_id: string; user_id: string }[]> => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('chat_message_reads').select('message_id, user_id').in('message_id', messageIds);
    return data || [];
  },

  markRead: async (messageId: string, userId: string) => {
    await supabase.from('chat_message_reads').upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' });
  },

  // chat-attachments is a PRIVATE bucket on web (createSignedUrl, not
  // getPublicUrl) — matched here via uploadToPrivateBucket/getSignedUrl,
  // not the public-bucket helper the rest of this app's photo flows use.
  uploadChatAttachment: async (uri: string, mimeType: string, channelId: string): Promise<string> => {
    const path = await uploadToPrivateBucket(uri, 'chat-attachments', channelId, mimeType);
    if (!path) throw new Error('Failed to upload attachment');
    return path;
  },

  getSignedAttachmentUrl: async (path: string): Promise<string | null> => {
    return getSignedUrl('chat-attachments', path);
  },

  // Mirrors apiClient.ts's notifyUsers exactly — writes to `notifications`
  // (recipient_id/message), the same table the bell icon on both
  // platforms actually reads.
  notifyUsers: async (userIds: string[], type: string, title: string, body: string, linkRef?: string) => {
    if (userIds.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('notifications').insert(userIds.map((uid) => ({
      recipient_id: uid,
      sender_id: user?.id ?? null,
      sender_name: user?.email ?? null,
      title,
      message: body,
      type,
      action_url: linkRef || null,
      read: false,
      created_at: new Date().toISOString(),
    })));
  },

  // Phase 11.0 gap fix — same master-switch-plus-email-exception pattern
  // as mobile_app_access_allowed (store/authStore.ts). Fail-open on any
  // lookup error, same posture as that check.
  checkMessagingAccess: async (email: string | null | undefined): Promise<boolean> => {
    try {
      const [{ data: setting }, { data: exception }] = await Promise.all([
        supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'messaging_access_allowed').maybeSingle(),
        email
          ? supabase.from('ceo_feature_exceptions').select('allowed').eq('feature_key', 'messaging_access_allowed').eq('user_email', email.toLowerCase()).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const masterAllowed = setting?.setting_value !== false;
      return exception ? !!exception.allowed : masterAllowed;
    } catch {
      return true;
    }
  },

  // Phase 11.0 gap fix — per-channel + global unread counts, backed by
  // the same get_unread_message_counts() RPC web calls (reuses the exact
  // chat_message_reads rows markRead() already writes — no new table).
  getUnreadCounts: async (): Promise<Record<string, number>> => {
    const { data, error } = await supabase.rpc('get_unread_message_counts');
    if (error || !data) return {};
    const map: Record<string, number> = {};
    for (const row of data as { channel_id: string; unread_count: number }[]) {
      map[row.channel_id] = Number(row.unread_count) || 0;
    }
    return map;
  },
};
