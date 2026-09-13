// rebma-mobile/lib/directMessage.ts
//
// A minimal, real DM capability backed by the exact same tables web's rich
// Messenger.tsx uses (channels / channel_members / chat_messages) — not a
// separate mechanism. Mobile doesn't have Messenger.tsx's full UI yet (that
// port is a later phase), but "send one person a message" doesn't need the
// full UI to be real: this writes to the same rows, so a message sent from
// here shows up in the recipient's web Messenger DM thread immediately.
import { supabase } from './supabaseClient';

export interface DmChannel {
  id: string;
  type: 'dm';
  created_by: string | null;
  created_at: string;
}

// Mirrors apiClient.ts's messenger.getOrCreateDmChannel exactly — finds an
// existing 2-member DM channel between these two users, or creates one.
export async function getOrCreateDmChannel(myId: string, otherId: string): Promise<DmChannel> {
  const { data: myChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', myId);
  const myIds = (myChannels || []).map((c: any) => c.channel_id);
  if (myIds.length > 0) {
    const { data: otherChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', otherId).in('channel_id', myIds);
    for (const oc of otherChannels || []) {
      const { data: chRow } = await supabase.from('channels').select('*').eq('id', oc.channel_id).eq('type', 'dm').limit(1);
      if (chRow && chRow.length > 0) {
        const { count } = await supabase.from('channel_members').select('user_id', { count: 'exact', head: true }).eq('channel_id', oc.channel_id);
        if (count === 2) return chRow[0] as DmChannel;
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
  return channel as DmChannel;
}

// Mirrors apiClient.ts's messenger.sendMessage's exact chat_messages shape.
export async function sendDirectMessage(channelId: string, senderId: string, senderName: string, content: string) {
  const { data, error } = await supabase.from('chat_messages').insert({
    channel_id: channelId,
    sender_id: senderId,
    sender: senderName,
    content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    reply_to_id: null,
  }).select();
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}
