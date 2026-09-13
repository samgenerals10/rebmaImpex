-- supabase_messenger_message_actions.sql
-- Phase 11.1 — core message actions (edit, delete, pin, forward, star).
--
-- NOTE on chat_messages' own RLS: this migration does NOT touch whatever
-- RLS state chat_messages currently has (enabled+permissive, or none at
-- all) — no tracked CREATE TABLE/RLS exists anywhere in this repo for it
-- (same "schema lives outside tracked migrations" situation flagged
-- repeatedly in this project's own history), and guessing at its current
-- policies risks silently breaking live message send/receive if I get it
-- wrong. Sender-only enforcement for Edit and Delete-for-everyone is
-- therefore done at the APP layer on both platforms (each only offers
-- those two actions when sender_id === the viewer's own id, and the
-- update itself is additionally scoped with .eq('sender_id', myId) as
-- defense-in-depth) — a documented, accepted gap, consistent with this
-- project's own precedent elsewhere for exactly this class of tradeoff
-- (e.g. Phase 6's note on customers/orders column-level write protection).
-- Pin, delete-for-me, and star are NEW tables below and get real,
-- correctly-scoped RLS from scratch since there's no existing state to
-- reconcile with.

alter table public.chat_messages add column if not exists edited_at timestamptz;
alter table public.chat_messages add column if not exists deleted_at timestamptz;
alter table public.chat_messages add column if not exists deleted_by text;
alter table public.chat_messages add column if not exists forwarded_from_id text;

-- Pin — any channel member may pin/unpin (matches Slack/WhatsApp
-- behavior), decoupled from chat_messages' own uncertain RLS via a
-- separate table with its own membership-scoped policy.
create table if not exists public.chat_pinned_messages (
  channel_id text not null,
  message_id text not null,
  pinned_by text,
  pinned_by_name text,
  pinned_at timestamptz not null default now(),
  primary key (channel_id, message_id)
);
alter table public.chat_pinned_messages enable row level security;
drop policy if exists "chat_pinned_messages_member" on public.chat_pinned_messages;
create policy "chat_pinned_messages_member" on public.chat_pinned_messages
  for all to authenticated
  using (exists (
    select 1 from public.channel_members cm
    where cm.channel_id::text = chat_pinned_messages.channel_id::text
      and cm.user_id::text = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.channel_members cm
    where cm.channel_id::text = chat_pinned_messages.channel_id::text
      and cm.user_id::text = auth.uid()::text
  ));

-- Delete-for-me — hides a message from only the caller's own view; the
-- row itself, and everyone else's view of it, is untouched.
create table if not exists public.chat_message_hidden (
  message_id text not null,
  user_id text not null,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.chat_message_hidden enable row level security;
drop policy if exists "chat_message_hidden_own" on public.chat_message_hidden;
create policy "chat_message_hidden_own" on public.chat_message_hidden
  for all to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

-- Star/bookmark — personal, per-user, per-message.
create table if not exists public.chat_message_stars (
  message_id text not null,
  user_id text not null,
  starred_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.chat_message_stars enable row level security;
drop policy if exists "chat_message_stars_own" on public.chat_message_stars;
create policy "chat_message_stars_own" on public.chat_message_stars
  for all to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);
