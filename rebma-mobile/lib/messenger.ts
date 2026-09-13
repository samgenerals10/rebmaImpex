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
    opts?: { attachmentUrl?: string; attachmentType?: string; attachmentName?: string; replyToId?: string; forwardedFromId?: string }
  ): Promise<ChatMessage | null> => {
    const { data, error } = await supabase.from('chat_messages').insert({
      channel_id: channelId,
      sender_id: senderId,
      sender: senderName,
      content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment_url: opts?.attachmentUrl || null,
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
