-- supabase_messenger_security_hardening.sql
--
-- Closes a real, confirmed gap: chat_messages, channels, channel_members,
-- chat_message_reactions, chat_message_reads, meetings, meeting_attendees,
-- and notifications were all left with a blanket
--   FOR ALL TO authenticated USING (true) WITH CHECK (true)
-- policy (chat_messages: supabase_schema.sql:313-321; channels/
-- channel_members/chat_message_reactions/chat_message_reads/meetings/
-- meeting_attendees: supabase_schema.sql:838-913, reaffirmed by
-- supabase_rls_overhaul.sql's "left alone, low-stakes" bucket). Every
-- Phase 11 migration's own comments claimed no RLS existed for these
-- tables at all — that was wrong. RLS exists and is maximally permissive,
-- meaning any authenticated user calling Supabase directly (bypassing the
-- app's own UI-level guards) can today read every DM/group in the
-- company, forge messages as anyone (including the CEO), edit or delete
-- anyone else's messages, self-join any private group, evict anyone from
-- any conversation, harvest and join any Jitsi call, and forge
-- notifications with a spoofed sender.
--
-- This migration writes real, membership-scoped RLS for all eight tables,
-- reusing the exact style already used correctly for the Phase 11 tables
-- built from scratch this rollout (chat_pinned_messages, chat_message_
-- hidden, chat_message_stars, chat_channel_mutes, chat_channel_pins,
-- chat_channel_archived) — the developers already knew this pattern, it
-- just was never retroactively applied to the base tables those new
-- tables depend on for meaning.
--
-- IMPORTANT — two legitimate write paths, not one:
-- chat_messages predates the channel system (it originally backed a flat
-- Boardroom "Announcements"/"DirectMessages" mailbox: sender/content/time/
-- receiver, receiver = NULL for a broadcast or a department code for a
-- department mailbox, no channel_id at all). Phase 11 added channel_id/
-- sender_id/etc. as additive columns for the new person-to-person
-- Messenger, but never removed the old mailbox feature — both still
-- write to this one table today (see rebma-web/src/App.tsx's
-- setChatMessages wrapper + sendChatMessage, and rebma-mobile's
-- screens/boardroom/AnnouncementsScreen.tsx + DirectMessagesScreen.tsx).
-- The RLS below has to accept BOTH shapes correctly: rows with a real
-- channel_id (membership-checked) and rows with channel_id IS NULL
-- (receiver-based: NULL = company-wide announcement, a department code =
-- that department's own mailbox).
--
-- This migration ALSO requires four small app-code changes (already made
-- in this same commit) to bind sender_id on the two old mailbox write
-- paths, which never set it before now — without that, the sender-binding
-- INSERT check below would silently block every legitimate Boardroom
-- Announcements/DirectMessages send on both platforms:
--   rebma-web/src/App.tsx (setChatMessages wrapper, sendChatMessage)
--   rebma-mobile/screens/boardroom/AnnouncementsScreen.tsx
--   rebma-mobile/screens/boardroom/DirectMessagesScreen.tsx
--
-- notifications has NO tracked CREATE TABLE anywhere in this repo (same
-- "schema lives outside tracked migrations" situation as several other
-- tables before it) — every column reference below is written defensively
-- with ::text casts, matching this project's own established convention
-- for exactly this situation, and matches the exact insert shape every
-- real writer already uses (utils/sendNotification.ts, apiClient.ts's/
-- lib/messenger.ts's notifyUsers, mobile's MeetingsScreen.tsx) — all four
-- already set sender_id from the real authenticated session, never from
-- caller-supplied input, so the new binding check below doesn't change
-- any legitimate behavior.
--
-- Safe to re-run: every policy below is dropped by name (dynamically,
-- for every existing policy on these 8 tables, whatever it's called —
-- including ones added directly via the Supabase dashboard) before the
-- new ones are created, matching supabase_rls_overhaul.sql's own
-- established convention.
--
-- Wrapped in a single transaction: if anything fails partway through, the
-- whole thing rolls back and your database is left exactly as it was.

begin;

-- ============================================================
-- 1. Helper functions (SECURITY DEFINER so they can read
--    channel_members/meetings/profiles from inside a policy defined on
--    those same tables without RLS recursion — same reasoning as
--    current_role()/is_admin() in supabase_rls_overhaul.sql).
-- ============================================================

create or replace function public.is_channel_member(p_channel_id text, p_user_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.channel_members cm
    where cm.channel_id::text = p_channel_id and cm.user_id::text = p_user_id
  );
$$;
grant execute on function public.is_channel_member(text, text) to authenticated;

-- Which channel a message belongs to (null for a legacy, channel_id-less
-- Boardroom mailbox row) — lets the reaction/read-receipt tables check
-- membership on the message's channel without re-querying chat_messages
-- inside their own RLS (avoids recursion the same way is_channel_member
-- does for channel_members).
create or replace function public.chat_message_channel_id(p_message_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select channel_id from public.chat_messages where id = p_message_id;
$$;
grant execute on function public.chat_message_channel_id(uuid) to authenticated;

-- Normalizes profiles.role into the same department code the frontend's
-- own normalizeDeptCode() produces (rebma-web/src/utils/departments.ts /
-- rebma-mobile/utils/departments.ts) — needed so a legacy department-
-- mailbox row (receiver = a department code) is readable by everyone
-- that department code actually resolves to today, matching the Phase 5
-- Admin & Warehouse merge (operations/dispatch/logistics all read as
-- ADMIN_WAREHOUSE) rather than only the caller's raw stored role string.
create or replace function public.current_department()
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
  from public.profiles where id = auth.uid();
$$;
grant execute on function public.current_department() to authenticated;

create or replace function public.is_meeting_participant(p_meeting_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.meetings m where m.id = p_meeting_id and m.organizer_id = p_user_id)
      or exists (select 1 from public.meeting_attendees ma where ma.meeting_id = p_meeting_id and ma.user_id = p_user_id);
$$;
grant execute on function public.is_meeting_participant(uuid, uuid) to authenticated;

-- ============================================================
-- 2. Drop every existing policy on the 8 affected tables, whatever it's
--    named, before writing the real ones — same dynamic-drop convention
--    supabase_rls_overhaul.sql already established.
-- ============================================================

do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in (
        'chat_messages', 'channels', 'channel_members',
        'chat_message_reactions', 'chat_message_reads',
        'meetings', 'meeting_attendees', 'notifications'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ============================================================
-- 3. chat_messages — handles both the new channel-based Messenger rows
--    AND the legacy channel_id-less Boardroom mailbox rows in one policy
--    set (see the header note above).
-- ============================================================

alter table public.chat_messages enable row level security;

-- A legacy (channel_id-null) row is readable if it's a company-wide
-- announcement (receiver is null), if it's addressed to the caller's own
-- department, OR if the caller is the one who sent it — this last branch
-- matters because the department-mailbox conversation is bidirectional:
-- Marketing's own DirectMessagesScreen sends a row with
-- receiver='FINANCE' and needs to see that same row back in its own
-- thread view, even though Marketing's own department isn't 'FINANCE'.
create policy "chat_messages_select" on public.chat_messages
  for select to authenticated
  using (
    public.is_admin()
    or (channel_id is not null and public.is_channel_member(channel_id::text, auth.uid()::text))
    or (channel_id is null and (
      receiver is null
      or upper(receiver) = public.current_department()
      or sender_id::text = auth.uid()::text
    ))
  );

-- Legacy (channel_id-null) rows deliberately allow posting to ANY
-- department, not just the sender's own — that's the actual, intended
-- shape of the department-mailbox feature (any department can reach any
-- other), so the only real constraint here is identity binding
-- (sender_id must be the caller) plus channel membership for the new,
-- person-to-person Messenger's rows.
create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      sender_id::text = auth.uid()::text
      and (
        (channel_id is not null and public.is_channel_member(channel_id::text, auth.uid()::text))
        or channel_id is null
      )
    )
  );

-- Edit / delete-for-everyone (soft delete only) — sender only. This is
-- what turns the Phase 11.1 app-layer-only guard into a real, enforced
-- one: a client that skips the UI and calls .update() directly on a
-- message that isn't theirs is now rejected server-side, not just
-- politely asked not to by the React code.
create policy "chat_messages_update" on public.chat_messages
  for update to authenticated
  using (public.is_admin() or sender_id::text = auth.uid()::text)
  with check (public.is_admin() or sender_id::text = auth.uid()::text);

-- No DELETE policy — every delete path in this app is a soft delete
-- (UPDATE deleted_at/deleted_by) or admin tooling (Data Reset Center,
-- which runs as is_admin() and bypasses RLS entirely regardless).
create policy "chat_messages_delete_admin" on public.chat_messages
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- 4. channels
-- ============================================================

alter table public.channels enable row level security;

create policy "channels_select" on public.channels
  for select to authenticated
  using (
    public.is_admin()
    or type = 'everyone'
    or public.is_channel_member(id::text, auth.uid()::text)
  );

-- A normal user may only directly create the singleton 'everyone'
-- channel (ensureEveryoneChannel's one-time bootstrap, idempotent) or a
-- dm/group channel THEY are the creator of (created_by binds identity —
-- getOrCreateDmChannel/createGroupChannel on both platforms already set
-- created_by to the caller's own id, so this needs no app-code change).
create policy "channels_insert" on public.channels
  for insert to authenticated
  with check (
    public.is_admin()
    or type = 'everyone'
    or created_by::text = auth.uid()::text
  );

create policy "channels_update" on public.channels
  for update to authenticated
  using (public.is_admin() or public.is_channel_member(id::text, auth.uid()::text))
  with check (public.is_admin() or public.is_channel_member(id::text, auth.uid()::text));

create policy "channels_delete_admin" on public.channels
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- 5. channel_members
-- ============================================================

alter table public.channel_members enable row level security;

create policy "channel_members_select" on public.channel_members
  for select to authenticated
  using (public.is_admin() or public.is_channel_member(channel_id::text, auth.uid()::text));

-- Covers every real write path on both platforms without needing a new
-- RPC: self-join is restricted to the 'everyone' channel only (the sole
-- real self-join call site, joinChannel(), only ever targets it); a
-- channel's own creator may add members to it (covers the initial
-- multi-row insert in getOrCreateDmChannel/createGroupChannel, both of
-- which set created_by = the caller before this fires); any current
-- member may invite further members later (addChannelMembers).
create policy "channel_members_insert" on public.channel_members
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      user_id::text = auth.uid()::text
      and exists (select 1 from public.channels c where c.id = channel_members.channel_id and c.type = 'everyone')
    )
    or exists (select 1 from public.channels c where c.id = channel_members.channel_id and c.created_by::text = auth.uid()::text)
    or public.is_channel_member(channel_id::text, auth.uid()::text)
  );

-- Leave (self) or remove another member — any current member may remove
-- any other, matching this schema's established "no admin/member-role
-- hierarchy" precedent (same one message-pinning already relies on).
create policy "channel_members_delete" on public.channel_members
  for delete to authenticated
  using (
    public.is_admin()
    or user_id::text = auth.uid()::text
    or public.is_channel_member(channel_id::text, auth.uid()::text)
  );

-- ============================================================
-- 6. chat_message_reactions / chat_message_reads — scoped via the
--    message's own channel membership.
-- ============================================================

alter table public.chat_message_reactions enable row level security;

create policy "chat_message_reactions_select" on public.chat_message_reactions
  for select to authenticated
  using (
    public.is_admin()
    or public.is_channel_member(public.chat_message_channel_id(message_id)::text, auth.uid()::text)
  );

create policy "chat_message_reactions_insert" on public.chat_message_reactions
  for insert to authenticated
  with check (
    user_id::text = auth.uid()::text
    and public.is_channel_member(public.chat_message_channel_id(message_id)::text, auth.uid()::text)
  );

create policy "chat_message_reactions_delete" on public.chat_message_reactions
  for delete to authenticated
  using (public.is_admin() or user_id::text = auth.uid()::text);

alter table public.chat_message_reads enable row level security;

create policy "chat_message_reads_select" on public.chat_message_reads
  for select to authenticated
  using (
    public.is_admin()
    or public.is_channel_member(public.chat_message_channel_id(message_id)::text, auth.uid()::text)
  );

create policy "chat_message_reads_insert" on public.chat_message_reads
  for insert to authenticated
  with check (
    user_id::text = auth.uid()::text
    and public.is_channel_member(public.chat_message_channel_id(message_id)::text, auth.uid()::text)
  );

-- markChannelUnread() deletes the caller's own read receipt — this is
-- the only real delete path.
create policy "chat_message_reads_delete" on public.chat_message_reads
  for delete to authenticated
  using (public.is_admin() or user_id::text = auth.uid()::text);

-- Allow the upsert path (markRead uses .upsert with onConflict) to also
-- update an existing row — same self-only binding as insert.
create policy "chat_message_reads_update" on public.chat_message_reads
  for update to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- ============================================================
-- 7. meetings / meeting_attendees
-- ============================================================

alter table public.meetings enable row level security;

create policy "meetings_select" on public.meetings
  for select to authenticated
  using (public.is_admin() or public.is_meeting_participant(id, auth.uid()));

create policy "meetings_insert" on public.meetings
  for insert to authenticated
  with check (public.is_admin() or organizer_id::text = auth.uid()::text);

-- Organizer manages the meeting; an invited attendee also needs UPDATE
-- (e.g. flipping status to IN_PROGRESS on join, per Phase 7.10's
-- rejoinCall()/startCall() flows) — matches the level of trust already
-- implied by being invited, same as every other role-flat table in this
-- schema.
create policy "meetings_update" on public.meetings
  for update to authenticated
  using (public.is_admin() or public.is_meeting_participant(id, auth.uid()))
  with check (public.is_admin() or public.is_meeting_participant(id, auth.uid()));

create policy "meetings_delete" on public.meetings
  for delete to authenticated
  using (public.is_admin() or organizer_id::text = auth.uid()::text);

alter table public.meeting_attendees enable row level security;

create policy "meeting_attendees_select" on public.meeting_attendees
  for select to authenticated
  using (public.is_admin() or public.is_meeting_participant(meeting_id, auth.uid()));

-- Only the organizer inserts attendee rows (covers startCall()'s and
-- scheduleMeeting()'s one-shot "insert self + every invitee" call).
create policy "meeting_attendees_insert" on public.meeting_attendees
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.meetings m where m.id = meeting_attendees.meeting_id and m.organizer_id::text = auth.uid()::text)
  );

-- An attendee updates their own rsvp_status/joined_at; the organizer can
-- update any attendee row too.
create policy "meeting_attendees_update" on public.meeting_attendees
  for update to authenticated
  using (
    public.is_admin()
    or user_id::text = auth.uid()::text
    or exists (select 1 from public.meetings m where m.id = meeting_attendees.meeting_id and m.organizer_id::text = auth.uid()::text)
  )
  with check (
    public.is_admin()
    or user_id::text = auth.uid()::text
    or exists (select 1 from public.meetings m where m.id = meeting_attendees.meeting_id and m.organizer_id::text = auth.uid()::text)
  );

create policy "meeting_attendees_delete" on public.meeting_attendees
  for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.meetings m where m.id = meeting_attendees.meeting_id and m.organizer_id::text = auth.uid()::text)
  );

-- ============================================================
-- 8. notifications — no tracked CREATE TABLE anywhere in this repo (see
--    header note); every column below is exactly what the app's own real
--    writers already send (recipient_id, recipient_department, sender_id,
--    sender_name, title, message, type, action_url, read, created_at).
-- ============================================================

alter table public.notifications enable row level security;

create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    public.is_admin()
    or recipient_id::text = auth.uid()::text
    or (recipient_department is not null and upper(recipient_department::text) = public.current_department())
  );

-- Binds sender_id to the real caller — this is the fix for the
-- spoofed-CEO-notification finding: a client that skips notifyUsers()
-- and inserts into this table directly can no longer forge sender_id to
-- someone else. Every real writer (utils/sendNotification.ts,
-- messenger.notifyUsers on both platforms, mobile's MeetingsScreen.tsx)
-- already sets sender_id from the live authenticated session, so this
-- changes no legitimate behavior.
create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (public.is_admin() or sender_id::text = auth.uid()::text);

-- Mark-read / clear — recipient only.
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (public.is_admin() or recipient_id::text = auth.uid()::text)
  with check (public.is_admin() or recipient_id::text = auth.uid()::text);

create policy "notifications_delete" on public.notifications
  for delete to authenticated
  using (public.is_admin() or recipient_id::text = auth.uid()::text);

-- ============================================================
-- 9. chat-attachments Storage — scope read/write to actual channel
--    membership. Object paths are always `${channelId}/${file}`
--    (apiClient.ts's uploadChatAttachment, lib/storage.ts's
--    uploadToPrivateBucket), so (storage.foldername(name))[1] is the
--    channel id.
-- ============================================================

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%chat-attachments%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "chat_attachments_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      public.is_admin()
      or public.is_channel_member((storage.foldername(name))[1], auth.uid()::text)
    )
  );

create policy "chat_attachments_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (
      public.is_admin()
      or public.is_channel_member((storage.foldername(name))[1], auth.uid()::text)
    )
  );

commit;

-- ============================================================
-- Deliberately NOT changed by this migration:
--   - chat_message_hidden / chat_message_stars / chat_channel_mutes /
--     chat_channel_pins / chat_channel_archived / chat_pinned_messages —
--     already correctly self/membership-scoped from when they were
--     created (Phase 11.1/11.2/11.6), untouched here.
--   - get_unread_message_counts() — already SECURITY INVOKER against
--     auth.uid() only, untouched.
--   - The masked `notifications` read for `recipient_department`
--     assumes recipient_department, when set, holds a department code
--     string comparable to current_department()'s output (e.g.
--     'ADMIN_WAREHOUSE', 'FINANCE') — if a caller ever writes a raw
--     legacy department string there instead, that row is only visible
--     to CEO/admin until read normally by the intended department; this
--     mirrors the same normalization gap already accepted elsewhere in
--     this app (see rebma-web/src/utils/departments.ts's own header
--     note) rather than inventing a new one.
-- ============================================================
