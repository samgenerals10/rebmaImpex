-- supabase_chat_access_enforcement.sql
--
-- Makes the chat rules real in the database, not just in the phone app.
-- Until now the invite / block / suspend rules (supabase_chat_access_
-- control.sql) were only checked by the mobile screens. The web app and
-- any direct call to Supabase could message anyone, past a block, into a
-- suspended chat, without an invite.
--
-- The rules (unchanged, same as the phone app already shows):
--   * Blocks: if either person blocked the other, neither can send a
--     direct message to the other.
--   * Suspension: if either person suspended a direct chat, nobody can
--     send in it until they resume it. If the CEO turns
--     chat_suspension_allowed off, no new suspensions can be made and
--     existing ones stop having any effect.
--   * Invites: someone outside CEO / HR / Management / Risk who wants to
--     message a person in another department needs that person to accept
--     an invite first. Once accepted, both people can talk freely.
--     A person can always reply to someone who has already written to them
--     in that chat. Conversations that already had messages before this
--     file was run keep working, so nobody's existing chats break.
--   * A group with only two people in it counts as a direct chat for
--     blocks and invites, so a two-person group can't be used to get
--     around an invite or a block. Bigger groups and the Everyone channel
--     are not affected (as before).
--   * A direct chat can only ever have two people in it.
--
-- Also closes two holes in chat_invites itself:
--   * A sender could create their own invite already marked "accepted".
--   * The person invited could rewrite who the invite was from.
--
-- Run AFTER supabase_chat_access_control.sql and
-- supabase_messenger_security_hardening.sql. Safe to re-run.

begin;

-- 1. When the rules were switched on (so older chats keep working).
create table if not exists public.chat_access_meta (
  id boolean primary key default true check (id),
  enforced_since timestamptz not null default now()
);
alter table public.chat_access_meta enable row level security;
-- No policies: only the security definer functions below read it.
insert into public.chat_access_meta (id) values (true) on conflict (id) do nothing;

-- 2. Helpers.
-- A person's department, normalised the same way the apps do it
-- (operations / dispatch / logistics all count as Admin & Warehouse).
create or replace function public.chat_department_of(p_user uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case upper(coalesce(role, ''))
    when 'OPERATIONS' then 'ADMIN_WAREHOUSE'
    when 'DISPATCH' then 'ADMIN_WAREHOUSE'
    when 'LOGISTICS' then 'ADMIN_WAREHOUSE'
    when 'HUMAN RESOURCES' then 'HR'
    else upper(coalesce(role, ''))
  end
  from public.profiles where id = p_user;
$$;

-- CEO, HR, Management and Risk can message anyone without an invite.
create or replace function public.chat_is_free_sender(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(p.is_admin, false)
      or public.chat_department_of(p.id) in ('CEO', 'HR', 'MANAGEMENT', 'RISK')
  from public.profiles p where p.id = p_user;
$$;

-- Suspension is on unless the CEO turned it off (default on).
create or replace function public.chat_suspension_allowed()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (setting_value #>> '{}')::boolean from public.ceo_settings where setting_key = 'chat_suspension_allowed'),
    true
  );
$$;

-- One answer for "can I start a direct chat with this person?", used by
-- both apps so they never disagree with the database.
-- Returns: allowed | blocked_by_them | blocked_by_me | invite_required |
--          invite_pending | invite_denied
create or replace function public.chat_gate(p_other uuid)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_status text;
begin
  if v_me is null then return 'invite_required'; end if;
  if exists (select 1 from public.chat_blocks where blocker_id = p_other and blocked_id = v_me) then
    return 'blocked_by_them';
  end if;
  if exists (select 1 from public.chat_blocks where blocker_id = v_me and blocked_id = p_other) then
    return 'blocked_by_me';
  end if;
  if public.chat_is_free_sender(v_me) then return 'allowed'; end if;
  if public.chat_department_of(v_me) = public.chat_department_of(p_other) then return 'allowed'; end if;
  if exists (
    select 1 from public.chat_invites
    where status = 'accepted'
      and ((from_user_id = v_me and to_user_id = p_other) or (from_user_id = p_other and to_user_id = v_me))
  ) then
    return 'allowed';
  end if;
  select status into v_status from public.chat_invites where from_user_id = v_me and to_user_id = p_other;
  if v_status = 'pending' then return 'invite_pending'; end if;
  if v_status = 'denied' then return 'invite_denied'; end if;
  return 'invite_required';
end;
$$;
grant execute on function public.chat_gate(uuid) to authenticated;

-- 3. The check on every new message in a direct chat.
create or replace function public.enforce_chat_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_type text;
  v_other uuid;
  v_since timestamptz;
  v_members int;
begin
  -- Old Boardroom mailbox rows, and the server itself, are not affected.
  if new.channel_id is null or v_sender is null then return new; end if;

  select type into v_type from public.channels where id::text = new.channel_id::text;
  if coalesce(v_type, '') = 'group' then
    -- A two-person group follows the same rules as a direct chat.
    select count(*) into v_members from public.channel_members cm where cm.channel_id::text = new.channel_id::text;
    if v_members <> 2 then return new; end if;
  elsif coalesce(v_type, '') <> 'dm' then
    return new;
  end if;

  -- Suspension only exists for direct chats.
  if v_type = 'dm' and public.chat_suspension_allowed() and exists (
    select 1 from public.chat_channel_suspensions s where s.channel_id = new.channel_id::text
  ) then
    raise exception 'This chat is suspended. It has to be resumed before anyone can send a message.';
  end if;

  select enforced_since into v_since from public.chat_access_meta where id;

  for v_other in
    select cm.user_id::uuid from public.channel_members cm
    where cm.channel_id::text = new.channel_id::text and cm.user_id::text <> v_sender::text
  loop
    if exists (
      select 1 from public.chat_blocks b
      where (b.blocker_id = v_other and b.blocked_id = v_sender)
         or (b.blocker_id = v_sender and b.blocked_id = v_other)
    ) then
      raise exception 'You can''t message this person. One of you has blocked the other.';
    end if;

    if not public.chat_is_free_sender(v_sender)
       and public.chat_department_of(v_sender) is distinct from public.chat_department_of(v_other)
       and not exists (
         select 1 from public.chat_invites i
         where i.status = 'accepted'
           and ((i.from_user_id = v_sender and i.to_user_id = v_other) or (i.from_user_id = v_other and i.to_user_id = v_sender))
       )
       -- They already wrote to you in this chat: you can reply.
       and not exists (
         select 1 from public.chat_messages m
         where m.channel_id::text = new.channel_id::text and m.sender_id::text = v_other::text
       )
       -- The chat already had messages before these rules were switched on.
       and not exists (
         select 1 from public.chat_messages m
         where m.channel_id::text = new.channel_id::text and m.created_at < v_since
       )
    then
      raise exception 'This person is in another department. Send them a chat invite and wait for them to accept it first.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists chat_messages_enforce_access on public.chat_messages;
create trigger chat_messages_enforce_access
  before insert on public.chat_messages
  for each row execute function public.enforce_chat_access();

-- 3b. A direct chat holds exactly two people. Nobody can be added to one
--     that already has two. (Each row of the creator's first two-row
--     insert sees the rows before it, so creating a chat still works.)
create or replace function public.guard_dm_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if; -- the server
  if exists (select 1 from public.channels c where c.id::text = new.channel_id::text and c.type = 'dm')
     and (select count(*) from public.channel_members cm where cm.channel_id::text = new.channel_id::text) >= 2
  then
    raise exception 'A direct chat can only have two people. Start a group instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists channel_members_guard_dm on public.channel_members;
create trigger channel_members_guard_dm
  before insert on public.channel_members
  for each row execute function public.guard_dm_members();

-- 4. chat_invites: an invite always starts as "pending", can't be sent to
--    yourself, and only its status can change afterwards.
drop policy if exists "chat_invites_insert" on public.chat_invites;
create policy "chat_invites_insert" on public.chat_invites
  for insert to authenticated
  with check (
    auth.uid() = from_user_id
    and from_user_id <> to_user_id
    and status = 'pending'
    and responded_at is null
  );

create or replace function public.guard_chat_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if; -- the server
  if new.from_user_id <> old.from_user_id or new.to_user_id <> old.to_user_id
     or new.created_at <> old.created_at or new.id <> old.id then
    raise exception 'Only the answer to a chat invite can be changed.';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted', 'denied') then
    raise exception 'This invite has already been answered.';
  end if;
  new.responded_at := now();
  return new;
end;
$$;

-- The apps let you send a new invite after one was declined. The person
-- who sent it may clear their own declined invite to make room for the
-- new one (it starts again as "pending"). An accepted invite can't be
-- removed this way.
drop policy if exists "chat_invites_delete_declined" on public.chat_invites;
create policy "chat_invites_delete_declined" on public.chat_invites
  for delete to authenticated
  using (auth.uid() = from_user_id and status = 'denied');

drop trigger if exists chat_invites_guard on public.chat_invites;
create trigger chat_invites_guard
  before update on public.chat_invites
  for each row execute function public.guard_chat_invites();

-- 5. chat_channel_suspensions: only a member of that direct chat can
--    suspend it, and only while the CEO allows suspensions. Anyone can
--    always lift their own.
drop policy if exists "chat_channel_suspensions_write" on public.chat_channel_suspensions;
drop policy if exists "chat_channel_suspensions_insert" on public.chat_channel_suspensions;
drop policy if exists "chat_channel_suspensions_delete" on public.chat_channel_suspensions;

create policy "chat_channel_suspensions_insert" on public.chat_channel_suspensions
  for insert to authenticated
  with check (
    auth.uid() = suspended_by
    and public.chat_suspension_allowed()
    and public.is_channel_member(channel_id, auth.uid()::text)
    and exists (select 1 from public.channels c where c.id::text = chat_channel_suspensions.channel_id and c.type = 'dm')
  );

create policy "chat_channel_suspensions_delete" on public.chat_channel_suspensions
  for delete to authenticated
  using (auth.uid() = suspended_by);

-- 6. chat_blocks: you can't block yourself.
drop policy if exists "chat_blocks_write" on public.chat_blocks;
create policy "chat_blocks_write" on public.chat_blocks
  for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

commit;
