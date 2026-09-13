-- supabase_messenger_unread_counts.sql
-- Phase 11.0 (Messaging overhaul, Gap Fix #2 — unread counts).
--
-- No tracked CREATE TABLE exists anywhere in this repo for chat_messages /
-- channel_members / chat_message_reads (same "schema lives outside tracked
-- migrations" situation as spreadsheets/payroll_items before them) — so
-- this function is written defensively, casting every id comparison to
-- text, so it works whether those id columns are uuid or text under the
-- hood. Runs as SECURITY INVOKER against auth.uid() only (never accepts a
-- caller-supplied user id), so it can only ever return the calling user's
-- own unread counts — no way to read anyone else's read-state through it.
create or replace function public.get_unread_message_counts()
returns table (channel_id text, unread_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.channel_id::text, count(*)::bigint as unread_count
  from public.chat_messages m
  where m.sender_id::text is distinct from auth.uid()::text
    and m.channel_id::text in (
      select cm.channel_id::text from public.channel_members cm where cm.user_id::text = auth.uid()::text
    )
    and not exists (
      select 1 from public.chat_message_reads r
      where r.message_id::text = m.id::text and r.user_id::text = auth.uid()::text
    )
  group by m.channel_id;
$$;

grant execute on function public.get_unread_message_counts() to authenticated;
