-- ============================================================
-- Container Number + Waybill (Phase 4 of the Enhancement Blueprint)
--
-- Adds a Container Number field to cargo intake, and a new `waybills`
-- table backing the extended "Print Waybill" document + the new Scanner
-- feature. Run this AFTER supabase_risk_department.sql,
-- supabase_customer_verification.sql, and supabase_hr_additions.sql.
--
-- ⚠️ `orders.id` and `delivery_logs.id` are TEXT (app-generated IDs like
-- ORD-xxxxxxxx / DEL-xxxxxxxx), not UUID — the foreign keys below match
-- that. Also carried over from research: `cargo_intake` is written with a
-- `metadata` JSONB field by application code, but no committed .sql file
-- actually creates that column (same "schema file lags live DB" pattern
-- flagged in earlier phases) — doesn't block this migration since
-- container_number is an independent new column, just worth knowing.
-- ============================================================

-- Container Number on cargo intake
alter table public.cargo_intake add column if not exists container_number text;

-- Waybill Number — DB-generated and sequential, same pattern as Phase 3's
-- Employee Number.
create sequence if not exists public.waybill_number_seq start 1;

create table if not exists public.waybills (
  id text primary key default ('WBID-' || substring(md5(random()::text) from 1 for 8)),
  waybill_number text unique not null default ('WB-' || lpad(nextval('public.waybill_number_seq')::text, 6, '0')),
  order_id text references public.orders(id) on delete set null,
  delivery_log_id text references public.delivery_logs(id) on delete set null,
  container_number text,
  created_at timestamptz default now(),
  created_by text
);
alter table public.waybills enable row level security;

drop policy if exists "waybills_select_broad" on public.waybills;
create policy "waybills_select_broad" on public.waybills
  for select to authenticated using (true);

drop policy if exists "waybills_write" on public.waybills;
create policy "waybills_write" on public.waybills
  for all to authenticated
  using (public.current_role() in ('operations','dispatch','logistics','management','risk') or public.is_admin())
  with check (public.current_role() in ('operations','dispatch','logistics','management','risk') or public.is_admin());
