-- supabase_push_tokens.sql
--
-- Phase 7.12 (mobile), D126-D127: genuinely new push-notification
-- infrastructure — confirmed by an exhaustive repo-wide grep across both
-- rebma-web and rebma-mobile that no push token storage exists anywhere
-- in this codebase's tracked SQL today.
--
-- Deliberately a NEW table, not an addition to `notifications`'s own
-- schema — `notifications` has no committed CREATE TABLE anywhere in
-- this repo's tracked .sql files (same "schema lives outside tracked
-- migrations" pattern already flagged for `spreadsheets` before it was
-- backfilled, and `payroll_items` in the Gap-Closure Backlog's Item 4) —
-- a clean new table sidesteps that gap entirely rather than guessing at
-- or blind-altering an undocumented table.
--
-- WRITTEN, NOT RUN — standing constraint: Supabase access has been
-- billing-blocked since ~2026-09-01. Run this once access is restored,
-- alongside creating the Database Webhook described in api/send-push.ts's
-- header comment (a dashboard-configured resource, not something this
-- SQL file can create).

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

-- Each user can read/write only their own tokens — this table exists
-- purely so the server-side relay (api/send-push.ts, running under the
-- service-role key which bypasses RLS entirely) can look up who to
-- notify. No staff role ever needs to read another user's token.
drop policy if exists "push_tokens_own_rows" on public.push_tokens;
create policy "push_tokens_own_rows" on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
