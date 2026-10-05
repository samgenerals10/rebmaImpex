-- supabase_chat_access_control.sql
--
-- Chat access control for Viber: cross-department DMs require an
-- invite (accept/deny) before either side can message the other;
-- same-department DMs and group chats stay free, no invite needed.
-- CEO, HR, Management, and Risk are exempt from ever needing to send
-- an invite (they can message anyone directly) — this matches the
-- cross-cutting/coordinating role those departments already have in
-- this app. Every user, regardless of role, can personally block
-- another user (a private, one-directional block, found in that
-- user's own chat settings) and can suspend an already-accepted
-- conversation, unless the CEO has turned suspension off app-wide.
--
-- Run this once, in this order (it's self-contained, no dependency on
-- any other not-yet-run migration this session).

begin;

-- ============================================================
-- 1. chat_invites — the cross-department gate.
--    One row per (from_user, to_user) pair, tracks its own lifecycle:
--    pending -> accepted | denied. Once accepted, the DM works normally
--    (chat_invites is only ever checked before the FIRST message of a
--    new cross-department relationship — see chat_channel_suspensions
--    below for what governs an already-accepted conversation).
-- ============================================================
create table if not exists public.chat_invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'denied')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_user_id, to_user_id)
);
alter table public.chat_invites enable row level security;

-- Either party in the invite can see it (the sender needs to see it's
-- still pending; the recipient needs to see it to accept/deny it).
drop policy if exists "chat_invites_select" on public.chat_invites;
create policy "chat_invites_select" on public.chat_invites
  for select to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Only the sender can create an invite, and only naming themselves as
-- the sender (can't forge an invite as if someone else sent it).
drop policy if exists "chat_invites_insert" on public.chat_invites;
create policy "chat_invites_insert" on public.chat_invites
  for insert to authenticated
  with check (auth.uid() = from_user_id);

-- Only the recipient can respond (accept/deny) — the sender can't
-- self-approve their own invite.
drop policy if exists "chat_invites_update" on public.chat_invites;
create policy "chat_invites_update" on public.chat_invites
  for update to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- ============================================================
-- 2. chat_blocks — personal, one-directional. If A blocks B, B can no
--    longer message A (checked the same way an invite is checked,
--    before a message is allowed through) — this is independent of
--    department tier and independent of any CEO toggle; every user
--    always has this, in their own chat settings.
-- ============================================================
create table if not exists public.chat_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.chat_blocks enable row level security;

-- You can see who you've blocked, and (so the other side's UI can
-- honestly show "you can't message this person") whether you've been
-- blocked by someone you're trying to message.
drop policy if exists "chat_blocks_select" on public.chat_blocks;
create policy "chat_blocks_select" on public.chat_blocks
  for select to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

-- Only the blocker can create/remove their own block.
drop policy if exists "chat_blocks_write" on public.chat_blocks;
create policy "chat_blocks_write" on public.chat_blocks
  for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- ============================================================
-- 3. chat_channel_suspensions — either party in an already-accepted
--    conversation can suspend it (pause it without leaving/deleting
--    history). One row per (channel_id, suspended_by) — either side
--    suspending is enough to pause the conversation for both, but each
--    suspension is its own row so either side can independently lift
--    their own.
-- ============================================================
create table if not exists public.chat_channel_suspensions (
  channel_id text not null,
  suspended_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, suspended_by)
);
alter table public.chat_channel_suspensions enable row level security;

drop policy if exists "chat_channel_suspensions_select" on public.chat_channel_suspensions;
create policy "chat_channel_suspensions_select" on public.chat_channel_suspensions
  for select to authenticated
  using (exists (
    select 1 from public.channel_members cm
    where cm.channel_id = chat_channel_suspensions.channel_id and cm.user_id = auth.uid()
  ));

drop policy if exists "chat_channel_suspensions_write" on public.chat_channel_suspensions;
create policy "chat_channel_suspensions_write" on public.chat_channel_suspensions
  for all to authenticated
  using (auth.uid() = suspended_by)
  with check (auth.uid() = suspended_by);

commit;

-- ============================================================
-- Manual step after running this: in CEO Control Center (once that
-- toggle is added by the app), a new ceo_settings key
-- `chat_suspension_allowed` (default true) governs whether anyone can
-- use chat_channel_suspensions at all — the app checks this setting
-- before showing the Suspend action, this migration doesn't need to
-- seed it (ceo_settings reads fall back to the default when a key
-- doesn't exist yet, matching this app's existing convention).
-- ============================================================
