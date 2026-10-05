-- Local host-device meeting recording metadata. The actual video file
-- lives in a `meeting-recordings` Storage bucket (create it by hand in
-- the Supabase dashboard, same as every other bucket in this app — no
-- bucket is ever created via SQL here). This table is what makes a
-- finished recording "recorded in the database... fetched whenever it
-- is needed" instead of just sitting on the host's phone with no record
-- it ever existed.
--
-- No FK to `meetings.id` on purpose: this repo has no committed
-- CREATE TABLE for `meetings` anywhere (same "schema lives outside
-- tracked migrations" situation flagged elsewhere in this project), so
-- meeting_id is stored as plain, unconstrained text rather than guessing
-- at a type/constraint that might not match the live table.
create table if not exists public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  meeting_id text,
  room text not null,
  host_id text not null,
  host_name text,
  file_url text not null,
  consented_user_ids text[] not null default '{}',
  declined_user_ids text[] not null default '{}',
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.meeting_recordings enable row level security;

-- Broad authenticated read (matches this app's existing broad-read
-- convention for meetings/meeting_attendees) — write restricted to the
-- recording's own host.
drop policy if exists "meeting_recordings_select_broad" on public.meeting_recordings;
create policy "meeting_recordings_select_broad" on public.meeting_recordings
  for select to authenticated using (true);

drop policy if exists "meeting_recordings_write_host" on public.meeting_recordings;
create policy "meeting_recordings_write_host" on public.meeting_recordings
  for all to authenticated
  using (host_id::text = auth.uid()::text)
  with check (host_id::text = auth.uid()::text);
