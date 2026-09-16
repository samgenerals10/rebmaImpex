-- supabase_risk_approval_reform.sql
--
-- Risk approval reform, confirmed with the user 2026-09-16:
--   1. Risk no longer edits anything it reviews (cargo intake quantity/
--      price/damage, or order line-item quantity/price) — those stay
--      Management's job. Risk only approves, rejects, or returns, with a
--      required note either way. (Enforced in app code — no DB change
--      needed for the "stop editing" half of this, since the RPCs already
--      tolerate a null p_metadata/p_total_amount and the raw cargo_intake
--      update just needs to stop being asked to change those fields.)
--   2. Every decision (approve, reject, or return) must notify: Management,
--      the department that submitted the item, and the specific person who
--      submitted it.
--
-- This file covers the ONE real gap #2 needs: knowing WHO submitted a
-- cargo intake or a customer record. Orders already have a `created_by`
-- column (added earlier) but it was never actually populated by any code
-- path (confirmed by grep across the app) — this adds its missing name
-- companion so the app can start writing both. Proof of Delivery needs no
-- new column: delivery_logs.driver_id already links to drivers.user_id.

alter table public.cargo_intake add column if not exists logged_by_id uuid references public.profiles(id) on delete set null;
alter table public.cargo_intake add column if not exists logged_by_name text;

alter table public.customers add column if not exists registered_by_id uuid references public.profiles(id) on delete set null;
alter table public.customers add column if not exists registered_by_name text;

alter table public.orders add column if not exists created_by_name text;
-- orders.created_by (existing TEXT column, added by an earlier migration,
-- never populated until now) holds the submitting user's id going forward.

-- No RLS changes needed: cargo_intake_write, customers_update, and
-- orders_staff_write already govern every column on their tables, these
-- are just three new/newly-used columns under policies that already exist.
