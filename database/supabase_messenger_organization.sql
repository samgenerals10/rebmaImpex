-- supabase_messenger_organization.sql
-- Phase 11.6 — conversation organization (pin/archive) + admin controls.
-- Same posture as every other messenger migration in this project: new
-- tables get real, correctly-scoped self-only RLS from scratch; nothing
-- touches chat_messages/channels' own uncertain RLS state.

-- Pin a CONVERSATION to the top of the list — distinct from pinning a
-- MESSAGE inside a thread (chat_pinned_messages, Phase 11.1). Same shape
-- as chat_channel_mutes.
create table if not exists public.chat_channel_pins (
  channel_id text not null,
  user_id text not null,
  pinned_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
alter table public.chat_channel_pins enable row level security;
drop policy if exists "chat_channel_pins_own" on public.chat_channel_pins;
create policy "chat_channel_pins_own" on public.chat_channel_pins
  for all to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- Archive a conversation — hides it from the main list, keeps the
-- history, unarchive brings it back. Per-user (archiving is a personal
-- view preference, not something that removes the conversation for
-- anyone else).
create table if not exists public.chat_channel_archived (
  channel_id text not null,
  user_id text not null,
  archived_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
alter table public.chat_channel_archived enable row level security;
drop policy if exists "chat_channel_archived_own" on public.chat_channel_archived;
create policy "chat_channel_archived_own" on public.chat_channel_archived
  for all to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- "Clear a conversation's history" reuses chat_message_hidden (Phase
-- 11.1, delete-for-me) applied in bulk to every message in the channel —
-- no new table needed, matching every mainstream chat app's own
-- semantics (it clears YOUR view; the other side still has their copy).
