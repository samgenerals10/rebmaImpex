-- supabase_messenger_mute.sql
-- Phase 11.2 — per-conversation mute. Silences notifications only, never
-- affects unread counting (matches WhatsApp/Slack: a muted, unread
-- conversation still shows its badge, it just doesn't ping you) — @mentions
-- (chat_mention notifications) deliberately cut through a mute, so this
-- table is only ever consulted by the general chat_message notify path,
-- never the mention one.
create table if not exists public.chat_channel_mutes (
  channel_id text not null,
  user_id text not null,
  muted_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
alter table public.chat_channel_mutes enable row level security;
drop policy if exists "chat_channel_mutes_own" on public.chat_channel_mutes;
create policy "chat_channel_mutes_own" on public.chat_channel_mutes
  for all to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);
