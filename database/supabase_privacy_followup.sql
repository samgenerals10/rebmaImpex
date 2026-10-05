-- supabase_privacy_followup.sql
--
-- Closes the two read-privacy items deliberately deferred from
-- supabase_rls_overhaul.sql: any authenticated account could read every
-- employee's Ghana Card ID and every company payment record.
--
-- profiles: most of the app only ever needs name/role/status/photo for
-- display (dropdowns, chat, attendance name-joins, etc.) — never the
-- sensitive columns (ghana_card_id, password_hash, basic_salary,
-- employment_type, start_date). So instead of narrowing the table itself
-- (which would break those legitimate lookups), this adds a
-- `profiles_directory` view exposing only the safe columns, broadly
-- readable by anyone — while the real `profiles` table's SELECT is
-- narrowed to self/HR/CEO only. The corresponding app-code changes (which
-- call sites move to the view) are handled separately, matched 1:1 to this
-- migration.
--
-- finance_payments: nothing outside Finance/Management/CEO screens
-- legitimately reads this (confirmed via exhaustive search) — so this is a
-- straight narrowing with no view needed and no app-code changes required.
--
-- Requires supabase_rls_overhaul.sql to already be applied (reuses its
-- current_role()/is_admin() helpers). Run this in the Supabase SQL Editor.

begin;

-- ============================================================
-- profiles: safe directory view + narrowed base-table read
-- ============================================================

create or replace view public.profiles_directory as
select id, email, full_name, role, department, phone, status, photo, created_at, updated_at
from public.profiles;

grant select on public.profiles_directory to authenticated;

drop policy if exists "profiles_select_broad" on public.profiles;

create policy "profiles_select_self_hr_admin" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.current_role() = 'hr' or public.is_admin());

-- ============================================================
-- finance_payments: narrow to Finance/Management/CEO
-- ============================================================

drop policy if exists "finance_payments_select_broad" on public.finance_payments;

create policy "finance_payments_select_finance_mgmt_admin" on public.finance_payments
  for select to authenticated
  using (public.current_role() in ('finance','management') or public.is_admin());

commit;
