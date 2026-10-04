// rebma-web/src/utils/chatAccess.ts
//
// Chat invites, blocks and suspensions on web. Twin of
// rebma-mobile/lib/chatAccess.ts. The rules themselves live in the
// database (supabase_chat_access_enforcement.sql): it refuses a direct
// message that breaks them no matter which app sent it. This file only
// lets the web screens show the right state and the right buttons.
//   * Same department, or a sender in CEO / HR / Management / Risk: free.
//   * Anyone else crossing departments: the other person accepts an
//     invite first.
//   * A block (either way) stops direct messages between the two people.
//   * Either person can suspend a direct chat, unless the CEO turned
//     suspension off; nobody can send in it until it is resumed.
import { supabase } from '../lib/supabaseClient';

export type ChatGate =
  | 'allowed'
  | 'blocked_by_them'
  | 'blocked_by_me'
  | 'invite_required'
  | 'invite_pending'
  | 'invite_denied';

// Asks the database. If that SQL file hasn't been run yet the function
// doesn't exist, and the answer is "allowed", which is how web behaved
// before this change.
export async function checkChatGate(otherId: string): Promise<ChatGate> {
  const { data, error } = await supabase.rpc('chat_gate', { p_other: otherId });
  if (error || typeof data !== 'string') return 'allowed';
  return data as ChatGate;
}

// A new invite always starts as pending. A declined one is cleared first
// so a fresh invite can be sent; one that is still waiting is left alone.
export async function sendChatInvite(fromUserId: string, toUserId: string): Promise<void> {
  await supabase.from('chat_invites').delete().eq('from_user_id', fromUserId).eq('to_user_id', toUserId).eq('status', 'denied');
  const { error } = await supabase.from('chat_invites').insert({ from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('chat_invites')
    .update({ status: accept ? 'accepted' : 'denied', responded_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

export interface IncomingInvite {
  id: string;
  fromUserId: string;
  fromName: string;
  fromDepartment: string;
  createdAt: string;
}

export async function fetchPendingInvitesToMe(myId: string): Promise<IncomingInvite[]> {
  const { data } = await supabase
    .from('chat_invites')
    .select('id, from_user_id, created_at')
    .eq('to_user_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  const rows = data || [];
  if (rows.length === 0) return [];
  const { data: senders } = await supabase
    .from('profiles_directory')
    .select('id, full_name, department')
    .in('id', rows.map((r: any) => r.from_user_id));
  const byId = new Map((senders || []).map((s: any) => [s.id, s]));
  return rows.map((r: any) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    fromName: byId.get(r.from_user_id)?.full_name || 'Someone',
    fromDepartment: byId.get(r.from_user_id)?.department || '',
    createdAt: r.created_at,
  }));
}

export async function blockState(myId: string, otherId: string): Promise<{ byMe: boolean; byThem: boolean }> {
  const { data } = await supabase
    .from('chat_blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${myId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${myId})`);
  const rows = data || [];
  return { byMe: rows.some((r: any) => r.blocker_id === myId), byThem: rows.some((r: any) => r.blocker_id === otherId) };
}

export async function blockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase.from('chat_blocks').insert({ blocker_id: myId, blocked_id: otherId });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function unblockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase.from('chat_blocks').delete().eq('blocker_id', myId).eq('blocked_id', otherId);
  if (error) throw new Error(error.message);
}

export async function suspensionState(channelId: string, myId: string): Promise<{ byMe: boolean; byOther: boolean }> {
  const { data } = await supabase.from('chat_channel_suspensions').select('suspended_by').eq('channel_id', channelId);
  const rows = data || [];
  return { byMe: rows.some((r: any) => r.suspended_by === myId), byOther: rows.some((r: any) => r.suspended_by !== myId) };
}

export async function suspendChannel(channelId: string, myId: string): Promise<void> {
  const { error } = await supabase.from('chat_channel_suspensions').insert({ channel_id: channelId, suspended_by: myId });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function unsuspendChannel(channelId: string, myId: string): Promise<void> {
  const { error } = await supabase.from('chat_channel_suspensions').delete().eq('channel_id', channelId).eq('suspended_by', myId);
  if (error) throw new Error(error.message);
}
