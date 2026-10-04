-- supabase_private_data_security.sql
--
-- Closes four security gaps. Until now these tables let ANY signed-in
-- user read and change every row through a direct request; the apps only
-- hid other people's rows on screen.
--
--   1. notes, tasks, internal_emails: you only see and change your own
--      (plus what your department shared with you, as the apps already show).
--   2. help_articles, company_news: only Management and the CEO can
--      publish; company news follows the CEO's announcements_ceo_only switch.
--   3. meeting recordings: the storage folder becomes private, and only
--      the CEO, the host and the people in that meeting can see a recording.
--   4. internal_emails: starring, trashing and deleting now apply to just
--      the person who did it. Before, trashing an email you sent also
--      trashed it in the recipient's inbox, and "delete for good" erased it
--      for both. An email is only removed for real once BOTH people have
--      deleted it for good.
--
-- Run this BEFORE the updated web and phone apps go live (they use the
-- new email columns this file adds). The current apps keep working with
-- it in place. Safe to run more than once.

begin;

-- ============================================================
-- Helpers
-- ============================================================

-- A department code written the same way the apps write it
-- (operations / dispatch / logistics all mean Admin & Warehouse).
create or replace function public.normalize_dept(p text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p, ''))
    when 'OPERATIONS' then 'ADMIN_WAREHOUSE'
    when 'DISPATCH' then 'ADMIN_WAREHOUSE'
    when 'LOGISTICS' then 'ADMIN_WAREHOUSE'
    when 'HUMAN RESOURCES' then 'HR'
    else upper(coalesce(p, ''))
  end;
$$;

-- The signed-in person's department, only while their account is active.
create or replace function public.my_department()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select public.normalize_dept(role)
  from public.profiles
  where id = auth.uid() and upper(coalesce(status, '')) = 'ACTIVE';
$$;

-- Removes every existing policy on a table, whatever it is called, so the
-- old "anyone can do anything" policy can't sit alongside the new ones.
create or replace function pg_temp.drop_all_policies(p_table text)
returns void
language plpgsql
as $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, p_table);
  end loop;
end;
$$;

-- ============================================================
-- 1a. notes
-- ============================================================
select pg_temp.drop_all_policies('notes');
alter table public.notes enable row level security;

create policy "notes_select" on public.notes
  for select to authenticated
  using (
    user_id::text = auth.uid()::text
    or (shared_with_department and public.normalize_dept(department) = public.my_department())
  );

create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (
    user_id::text = auth.uid()::text
    and public.normalize_dept(department) = public.my_department()
  );

create policy "notes_update" on public.notes
  for update to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

create policy "notes_delete" on public.notes
  for delete to authenticated
  using (user_id::text = auth.uid()::text);

-- ============================================================
-- 1b. tasks
-- ============================================================
select pg_temp.drop_all_policies('tasks');
alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks
  for select to authenticated
  using (
    user_id::text = auth.uid()::text
    or assigned_to::text = auth.uid()::text
    or (shared and public.normalize_dept(department) = public.my_department())
  );

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (
    user_id::text = auth.uid()::text
    and public.normalize_dept(department) = public.my_department()
  );

-- The person it's assigned to, and colleagues on a shared task, can move
-- it along (Start, Done) as the apps allow. Everything else stays with the
-- person who created it (guard_tasks below).
create policy "tasks_update" on public.tasks
  for update to authenticated
  using (
    user_id::text = auth.uid()::text
    or assigned_to::text = auth.uid()::text
    or (shared and public.normalize_dept(department) = public.my_department())
  )
  with check (
    user_id::text = auth.uid()::text
    or assigned_to::text = auth.uid()::text
    or (shared and public.normalize_dept(department) = public.my_department())
  );

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (user_id::text = auth.uid()::text);

create or replace function public.guard_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if; -- the server (e.g. a handover)
  if old.user_id::text = auth.uid()::text then
    if new.user_id::text is distinct from old.user_id::text then
      raise exception 'A task can''t be given to a different creator.';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Only the person who created this task can change it. You can move it to the next stage.';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard
  before update on public.tasks
  for each row execute function public.guard_tasks();

-- ============================================================
-- 1c + 4. internal_emails
-- ============================================================

-- Each person's own star / trash / delete-for-good. The first time this
-- runs, the old shared star and trash flags are copied to both people so
-- nobody's mailbox changes.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'internal_emails' and column_name = 'sender_deleted'
  ) then
    alter table public.internal_emails
      add column sender_starred boolean not null default false,
      add column recipient_starred boolean not null default false,
      add column sender_deleted boolean not null default false,
      add column recipient_deleted boolean not null default false,
      add column sender_purged boolean not null default false,
      add column recipient_purged boolean not null default false;
    update public.internal_emails
      set sender_starred = coalesce(starred, false), recipient_starred = coalesce(starred, false),
          sender_deleted = coalesce(deleted, false), recipient_deleted = coalesce(deleted, false)
      where coalesce(starred, false) or coalesce(deleted, false);
  end if;
end $$;

select pg_temp.drop_all_policies('internal_emails');
alter table public.internal_emails enable row level security;

create policy "internal_emails_select" on public.internal_emails
  for select to authenticated
  using (
    (from_user_id::text = auth.uid()::text and not sender_purged)
    or (to_user_id::text = auth.uid()::text and not recipient_purged)
  );

create policy "internal_emails_insert" on public.internal_emails
  for insert to authenticated
  with check (
    from_user_id::text = auth.uid()::text
    and to_user_id::text <> auth.uid()::text
  );

create policy "internal_emails_update" on public.internal_emails
  for update to authenticated
  using (from_user_id::text = auth.uid()::text or to_user_id::text = auth.uid()::text)
  with check (from_user_id::text = auth.uid()::text or to_user_id::text = auth.uid()::text);

-- No delete policy: an email is removed only when both people have
-- deleted it for good (internal_emails_cleanup below).

-- A new email always starts unread and unflagged, whatever was sent.
create or replace function public.prepare_internal_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  new.read := false;
  new.starred := false;
  new.deleted := false;
  new.sender_starred := false;
  new.recipient_starred := false;
  new.sender_deleted := false;
  new.recipient_deleted := false;
  new.sender_purged := false;
  new.recipient_purged := false;
  return new;
end;
$$;

drop trigger if exists internal_emails_prepare on public.internal_emails;
create trigger internal_emails_prepare
  before insert on public.internal_emails
  for each row execute function public.prepare_internal_email();

-- Each person can only change their own flags. The sender, recipient,
-- subject and message can never be changed after sending. (The old
-- shared `starred` and `deleted` columns are no longer used by the apps
-- and are left changeable so an older app open somewhere doesn't error.)
create or replace function public.guard_internal_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me text := auth.uid()::text;
  v_allowed text[];
begin
  if v_me is null then return new; end if;
  v_allowed := array['starred', 'deleted'];
  if old.from_user_id::text = v_me then
    v_allowed := v_allowed || array['sender_starred', 'sender_deleted', 'sender_purged'];
  end if;
  if old.to_user_id::text = v_me then
    v_allowed := v_allowed || array['read', 'recipient_starred', 'recipient_deleted', 'recipient_purged'];
  end if;
  if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'You can only change your own copy of this email.';
  end if;
  return new;
end;
$$;

drop trigger if exists internal_emails_guard on public.internal_emails;
create trigger internal_emails_guard
  before update on public.internal_emails
  for each row execute function public.guard_internal_emails();

create or replace function public.cleanup_internal_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_purged and new.recipient_purged then
    delete from public.internal_emails where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists internal_emails_cleanup on public.internal_emails;
create trigger internal_emails_cleanup
  after update on public.internal_emails
  for each row execute function public.cleanup_internal_email();

-- ============================================================
-- 2. help_articles and company_news
-- ============================================================
select pg_temp.drop_all_policies('help_articles');
alter table public.help_articles enable row level security;

create policy "help_articles_select" on public.help_articles
  for select to authenticated using (true);

create policy "help_articles_write" on public.help_articles
  for all to authenticated
  using (public.is_admin() or public.my_department() in ('MANAGEMENT', 'CEO'))
  with check (public.is_admin() or public.my_department() in ('MANAGEMENT', 'CEO'));

select pg_temp.drop_all_policies('company_news');
alter table public.company_news enable row level security;

create policy "company_news_select" on public.company_news
  for select to authenticated using (true);

-- When the CEO turns on announcements_ceo_only, only the CEO can post.
create policy "company_news_write" on public.company_news
  for all to authenticated
  using (
    public.is_admin()
    or (
      public.my_department() in ('MANAGEMENT', 'CEO')
      and not coalesce((select (setting_value #>> '{}')::boolean from public.ceo_settings where setting_key = 'announcements_ceo_only'), false)
    )
  )
  with check (
    public.is_admin()
    or (
      public.my_department() in ('MANAGEMENT', 'CEO')
      and not coalesce((select (setting_value #>> '{}')::boolean from public.ceo_settings where setting_key = 'announcements_ceo_only'), false)
    )
  );

-- ============================================================
-- 3. Meeting recordings
-- ============================================================

-- True when the signed-in person organised or was invited to this meeting.
create or replace function public.in_meeting(p_meeting_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(p_meeting_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      exists (select 1 from public.meetings m where m.id::text = p_meeting_id and m.organizer_id::text = auth.uid()::text)
      or exists (select 1 from public.meeting_attendees a where a.meeting_id::text = p_meeting_id and a.user_id::text = auth.uid()::text)
    );
$$;

-- Only if supabase_meeting_recordings.sql has been run already.
do $$
begin
  if to_regclass('public.meeting_recordings') is not null then
    drop policy if exists "meeting_recordings_select_broad" on public.meeting_recordings;
    drop policy if exists "meeting_recordings_select" on public.meeting_recordings;
    create policy "meeting_recordings_select" on public.meeting_recordings
      for select to authenticated
      using (public.is_admin() or host_id::text = auth.uid()::text or public.in_meeting(meeting_id));
    -- (Writing stays with the recording's own host: meeting_recordings_write_host.)
  end if;
end $$;

-- The storage folder: private from now on. If it hasn't been created yet,
-- create it as a PRIVATE bucket in the Supabase dashboard.
update storage.buckets set public = false where id = 'meeting-recordings';

-- Remove every existing storage rule for this folder, including any made
-- by hand in the dashboard (one of those could still let anyone read it).
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%meeting-recordings%' or coalesce(with_check, '') ilike '%meeting-recordings%' or policyname ilike 'meeting_recordings_files_%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Files are saved as "<meeting id or room>/<file>".
create policy "meeting_recordings_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-recordings'
    and (public.is_admin() or owner = auth.uid() or public.in_meeting((storage.foldername(name))[1]))
  );

create policy "meeting_recordings_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meeting-recordings' and auth.uid() is not null);

create policy "meeting_recordings_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meeting-recordings' and (public.is_admin() or owner = auth.uid()));

commit;
