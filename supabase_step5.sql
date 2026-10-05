-- supabase_step5_waybill_and_passwords.sql
--
-- Step 5.
-- 1. Waybill gets its own template in Document Templates (doc_type
--    'WAYBILL'), next to Receipt, Dispatch Ticket and Proforma Invoice.
-- 2. Only Risk (and the CEO) can create waybills. Everyone signed in can
--    still read them, so the Scanner keeps working everywhere.
-- 3. Temporary passwords used to be saved as plain text in
--    profiles.password_hash when HR approved someone. The app no longer
--    does that; this wipes the ones already saved.
-- 4. Join a meeting by its code (Meet Now / Join by code, laptop and
--    phone). Meetings are only visible to invited people, so joining by
--    code needs this function: the code works as the invitation, like a
--    meeting link. Only live or upcoming meetings can be joined.
--
-- Safe to run more than once.

begin;

-- 1. Allow the WAYBILL template type.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'document_templates' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%doc_type%'
  loop
    execute format('alter table public.document_templates drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.document_templates
  add constraint document_templates_doc_type_check
  check (doc_type in ('RECEIPT', 'TICKET', 'INVOICE', 'WAYBILL'));

-- 2. Waybills: read for everyone signed in, create and change for Risk
--    and the CEO only. Driver phones are excluded even if their account
--    sits under Risk.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'waybills' loop
    execute format('drop policy if exists %I on public.waybills', pol.policyname);
  end loop;
end $$;

alter table public.waybills enable row level security;

create policy "waybills_select_broad" on public.waybills
  for select to authenticated
  using (true);

create policy "waybills_write_risk" on public.waybills
  for all to authenticated
  using ((public.current_role() = 'risk' and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() = 'risk' and not public.is_driver()) or public.is_admin());

-- 3. Wipe temporary passwords that were saved as plain text.
update public.profiles set password_hash = null where password_hash is not null;

-- 4. Join a meeting by code.
create or replace function public.join_meeting_by_code(p_code text)
returns table (meeting_id text, room text, title text)
language plpgsql
security definer
set search_path = public
as $$
-- The output names (meeting_id, room, title) match real column names;
-- this tells Postgres to read plain names as the table columns.
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_code text := trim(coalesce(p_code, ''));
  v_meeting record;
begin
  if v_me is null then
    raise exception 'Sign in first.';
  end if;
  if v_code = '' then
    raise exception 'Enter a meeting code.';
  end if;

  select m.* into v_meeting
  from public.meetings m
  where (m.jitsi_room = v_code or m.id::text = v_code)
    and upper(coalesce(m.status, '')) in ('SCHEDULED', 'IN_PROGRESS')
    -- Private chat calls are only for that conversation's members.
    and coalesce(m.jitsi_room, '') not like 'Rebma-Call-%'
    and coalesce(m.jitsi_room, '') not like 'Rebma-Video-%'
  limit 1;

  if not found then
    raise exception 'No live or upcoming meeting matches that code.';
  end if;

  if exists (select 1 from public.meeting_attendees a where a.meeting_id = v_meeting.id and a.user_id = v_me) then
    update public.meeting_attendees set joined_at = now(), rsvp_status = 'ACCEPTED'
    where meeting_id = v_meeting.id and user_id = v_me;
  else
    insert into public.meeting_attendees (meeting_id, user_id, rsvp_status, joined_at)
    values (v_meeting.id, v_me, 'ACCEPTED', now());
  end if;

  update public.meetings set status = 'IN_PROGRESS'
  where id = v_meeting.id and upper(coalesce(status, '')) = 'SCHEDULED';

  return query select v_meeting.id::text, v_meeting.jitsi_room::text, v_meeting.title::text;
end;
$$;

revoke all on function public.join_meeting_by_code(text) from public, anon;
grant execute on function public.join_meeting_by_code(text) to authenticated;

commit;
