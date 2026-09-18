// rebma-mobile/lib/chatAccess.ts
//
// Chat access control for Viber, per the user's own spec:
//   - Same department: free to message anyone, no invite, group or 1:1.
//   - Crossing departments: the sender must send an invite; nothing can
//     be sent until the recipient accepts. Denying it blocks it.
//   - CEO, HR, Management, and Risk never need to send an invite to
//     anyone — this is keyed on the SENDER's department, not the
//     recipient's, which is what makes the original ask actually work:
//     a regular staff member messaging the CEO still needs an invite
//     (CEO is a different department, and staff isn't in the exempt
//     tier), while the CEO messaging that same staff member doesn't,
//     because the CEO is exempt as the sender.
//   - Blocking is separate from all of this: personal, one-directional,
//     every user has it regardless of department, checked in addition
//     to (not instead of) the invite/tier rule.
//   - Suspending an already-open conversation is separate again: either
//     party can do it once a conversation exists, unless the CEO has
//     turned suspension off app-wide (chat_suspension_allowed).
//
// Recommendation on the "what about Finance and the rest" question,
// recorded here since the user asked for it directly: real internal
// chat tools (Slack, Teams) default to open internal messaging and
// restrict access through org-chart visibility or admin-configured
// policies, not blanket technical gates — gating every cross-team
// message creates real friction for legitimate coordination (Marketing
// needing Production's input, Finance needing Risk's numbers). Given
// that, and given the user's own request to gate specifically
// *reaching senior leadership*, the sensible line is: CEO/HR/Management/
// Risk (the coordinating/oversight functions, and — for this specific
// app — Risk's role already spans nearly every department's approvals)
// are exempt as senders; every operational department (Marketing,
// Finance, Production, Reception, Admin & Warehouse) gets the
// same-department-free / cross-department-invite rule. This mirrors how
// more hierarchical organizations actually gate access to senior staff
// while keeping ordinary cross-functional work friction-free within and
// between operational teams once an invite is accepted once.
import { supabase } from './supabaseClient';
import { getCeoSetting } from './ceoSetting';

const FREE_TIER_DEPARTMENTS = new Set(['CEO', 'HR', 'MANAGEMENT', 'RISK']);

export function isFreeTierSender(department: string): boolean {
  return FREE_TIER_DEPARTMENTS.has((department || '').toUpperCase());
}

export type ChatGate =
  | { allowed: true }
  | { allowed: false; reason: 'invite_required'; existingInviteStatus?: 'pending' | 'denied' }
  | { allowed: false; reason: 'blocked_by_them' }
  | { allowed: false; reason: 'blocked_by_me' };

// Checked before opening/creating a DM, and again before sending the
// first message in one — covers both "never talked before" and "they
// denied/haven't responded yet."
export async function checkChatGate(myId: string, myDepartment: string, otherId: string): Promise<ChatGate> {
  const [{ data: blockedByThem }, { data: blockedByMe }] = await Promise.all([
    supabase.from('chat_blocks').select('blocker_id').eq('blocker_id', otherId).eq('blocked_id', myId).maybeSingle(),
    supabase.from('chat_blocks').select('blocker_id').eq('blocker_id', myId).eq('blocked_id', otherId).maybeSingle(),
  ]);
  if (blockedByThem) return { allowed: false, reason: 'blocked_by_them' };
  if (blockedByMe) return { allowed: false, reason: 'blocked_by_me' };

  if (isFreeTierSender(myDepartment)) return { allowed: true };

  const { data: otherProfile } = await supabase.from('profiles').select('department').eq('id', otherId).maybeSingle();
  const sameDepartment = (otherProfile?.department || '').toUpperCase() === (myDepartment || '').toUpperCase();
  if (sameDepartment) return { allowed: true };

  const { data: invite } = await supabase
    .from('chat_invites')
    .select('status')
    .eq('from_user_id', myId)
    .eq('to_user_id', otherId)
    .maybeSingle();

  if (invite?.status === 'accepted') return { allowed: true };
  return { allowed: false, reason: 'invite_required', existingInviteStatus: invite?.status as 'pending' | 'denied' | undefined };
}

export async function sendChatInvite(fromUserId: string, toUserId: string): Promise<void> {
  const { error } = await supabase.from('chat_invites').upsert(
    { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending', responded_at: null },
    { onConflict: 'from_user_id,to_user_id' }
  );
  if (error) throw error;
}

export async function respondToInvite(inviteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('chat_invites')
    .update({ status: accept ? 'accepted' : 'denied', responded_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) throw error;
}

export interface IncomingInvite {
  id: string;
  from_user_id: string;
  fromName: string;
  fromDepartment: string;
  created_at: string;
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
  const ids = rows.map((r: any) => r.from_user_id);
  const { data: senders } = await supabase.from('profiles').select('id, full_name, department').in('id', ids);
  const byId = new Map((senders || []).map((s: any) => [s.id, s]));
  return rows.map((r: any) => ({
    id: r.id,
    from_user_id: r.from_user_id,
    fromName: byId.get(r.from_user_id)?.full_name || 'Someone',
    fromDepartment: byId.get(r.from_user_id)?.department || '',
    created_at: r.created_at,
  }));
}

export async function blockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase.from('chat_blocks').insert({ blocker_id: myId, blocked_id: otherId });
  if (error) throw error;
}

export async function unblockUser(myId: string, otherId: string): Promise<void> {
  await supabase.from('chat_blocks').delete().eq('blocker_id', myId).eq('blocked_id', otherId);
}

export async function isBlockedEitherWay(myId: string, otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${myId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${myId})`)
    .limit(1);
  return !!data && data.length > 0;
}

export async function suspensionAllowed(): Promise<boolean> {
  return getCeoSetting('chat_suspension_allowed', true);
}

export async function suspendChannel(channelId: string, myId: string): Promise<void> {
  const { error } = await supabase.from('chat_channel_suspensions').insert({ channel_id: channelId, suspended_by: myId });
  if (error) throw error;
}

export async function unsuspendChannel(channelId: string, myId: string): Promise<void> {
  await supabase.from('chat_channel_suspensions').delete().eq('channel_id', channelId).eq('suspended_by', myId);
}

export async function isChannelSuspended(channelId: string): Promise<boolean> {
  const { data } = await supabase.from('chat_channel_suspensions').select('suspended_by').eq('channel_id', channelId).limit(1);
  return !!data && data.length > 0;
}

export async function isSuspendedByMe(channelId: string, myId: string): Promise<boolean> {
  const { data } = await supabase.from('chat_channel_suspensions').select('suspended_by').eq('channel_id', channelId).eq('suspended_by', myId).maybeSingle();
  return !!data;
}
