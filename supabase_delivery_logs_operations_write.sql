-- ============================================================
-- Operations can't actually dispatch orders — delivery_logs_staff_insert
-- (from supabase_control_center_patch3.sql) only allows
-- 'dispatch','logistics','management' to write to delivery_logs, but the
-- app's own documented workflow ("Finance approves → Operations verifies,
-- enters quantity + vehicle, clicks 'Load to Dispatch'") has OPERATIONS
-- doing that insert (ApprovedGoodsView.tsx — "the sole handoff point from
-- Operations to Dispatch"). Confirmed live: an Operations account hits
-- "new row violates row-level security policy for table delivery_logs".
-- It only ever appeared to work because it's only ever been tested from
-- the CEO/admin account, which bypasses the role check entirely.
--
-- Adds 'operations' to all four delivery_logs_staff_* policies. While
-- touching insert, also carries over the same ASSIGNED-status guard the
-- update policy already has (setting status to ASSIGNED requires
-- Management/admin once dispatch_needs_management is on) — previously that
-- guard only covered the update path; an insert could set status straight
-- to ASSIGNED and skip it entirely.
-- ============================================================

drop policy if exists "delivery_logs_staff_select" on public.delivery_logs;
create policy "delivery_logs_staff_select" on public.delivery_logs
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations') and not public.is_driver()) or public.is_admin());

drop policy if exists "delivery_logs_staff_insert" on public.delivery_logs;
create policy "delivery_logs_staff_insert" on public.delivery_logs
  for insert to authenticated
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );

drop policy if exists "delivery_logs_staff_update" on public.delivery_logs;
create policy "delivery_logs_staff_update" on public.delivery_logs
  for update to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );

drop policy if exists "delivery_logs_staff_delete" on public.delivery_logs;
create policy "delivery_logs_staff_delete" on public.delivery_logs
  for delete to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations') and not public.is_driver()) or public.is_admin());
