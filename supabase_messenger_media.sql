-- supabase_messenger_media.sql
-- Phase 11.3 — multi-image messages (send several photos as one bubble).
-- Single-image/file/audio messages keep using the existing
-- attachment_url/attachment_type/attachment_name columns unchanged —
-- this is purely additive, only populated for the one new case where
-- more than one image is sent together as a single message.
alter table public.chat_messages add column if not exists attachment_urls jsonb;
