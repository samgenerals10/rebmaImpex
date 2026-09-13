-- ============================================================
-- Phase 7.1 (rebma-mobile Admin & Warehouse parity): backfills the
-- `spreadsheets` table into the tracked migration history.
--
-- rebma-web/src/views/shared/SpreadsheetView.tsx has always depended on
-- this table (its own header comment documents the exact shape below),
-- but no committed `.sql` file in this repo ever created it — grepped
-- all 20+ tracked migration files for `create table.*spreadsheets` and
-- found nothing. Someone created it directly in the Supabase dashboard
-- outside the tracked migration set at some point. This file exists so
-- the mobile Spreadsheets screen (and any future work touching this
-- table) is built against a known, versioned schema instead of an
-- unverifiable one.
--
-- Run this any time — it has no dependency on Phases 1-6's migrations
-- and does not touch any other table.
-- ============================================================

create table if not exists public.spreadsheets (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  mode            text not null,          -- 'FREE' | 'DATA'
  department      text not null,
  data_table      text,                    -- DATA mode: which table
  cell_data       jsonb default '{}',      -- FREE mode: { "A1": "=SUM(B1:B3)" }
  created_by_id   text,
  created_by_name text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.spreadsheets enable row level security;

-- Broad authenticated read/write, matching every other general-purpose
-- cross-department tool in this schema (Spreadsheets has never had a
-- role restriction on web either — it's available to every department).
drop policy if exists "spreadsheets_broad" on public.spreadsheets;
create policy "spreadsheets_broad" on public.spreadsheets
  for all to authenticated using (true) with check (true);

-- ============================================================
-- Deliberately NOT included: `ceo_feature_exceptions`, also referenced in
-- SpreadsheetView.tsx's header comment but unrelated to Admin & Warehouse
-- mobile parity — a separate, unrelated gap, noted here so it isn't lost:
--
-- create table if not exists ceo_feature_exceptions (
--   id           uuid primary key default gen_random_uuid(),
--   feature_key  text not null,
--   user_email   text not null,
--   allowed      boolean not null default false,
--   created_at   timestamptz default now(),
--   unique (feature_key, user_email)
-- );
-- ============================================================
