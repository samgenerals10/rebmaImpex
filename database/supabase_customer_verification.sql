-- ============================================================
-- Customer Management Additions (Phase 2 of the Enhancement Blueprint)
--
-- Adds the fields the blueprint asks for (house/company address, GPS,
-- second Ghana Card, partner name, business certificate, notes) plus the
-- verification status those fields exist to support, and grants Risk write
-- access to record their decision. Run this AFTER supabase_risk_department.sql
-- (Phase 1) and after the matching frontend code is deployed, since these
-- policies assume the 'risk' role already exists.
--
-- No bucket-creation SQL is possible from a migration file — create the
-- `business-certificates` Storage bucket by hand in the Supabase dashboard
-- (Storage → New bucket, public) before this ships, the same way
-- `customer-photos` and `delivery-proofs` already were.
-- ============================================================

alter table public.customers add column if not exists house_address text;
alter table public.customers add column if not exists company_address text;
alter table public.customers add column if not exists gps_lat numeric;
alter table public.customers add column if not exists gps_lng numeric;
alter table public.customers add column if not exists ghana_card_id_2 text;
alter table public.customers add column if not exists partner_name text;
alter table public.customers add column if not exists business_certificate_url text;
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists status text not null default 'PENDING';
alter table public.customers add column if not exists verified_by text;
alter table public.customers add column if not exists verified_at timestamptz;
alter table public.customers add column if not exists rejection_reason text;

-- One-time backfill: every row that exists right now was already trusted
-- before this migration — only future inserts should start at PENDING.
-- (Safe to run more than once: after the first run every existing row is
-- already 'APPROVED', so this becomes a no-op.)
update public.customers set status = 'APPROVED' where status = 'PENDING';

-- Risk needs to be able to write status/verified_by/verified_at/rejection_reason
-- on approve/reject/return — add 'risk' to the existing Marketing-only update policy.
drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers
  for update to authenticated
  using (public.current_role() in ('marketing','risk') or public.is_admin())
  with check (public.current_role() in ('marketing','risk') or public.is_admin());
