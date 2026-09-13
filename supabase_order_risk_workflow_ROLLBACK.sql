-- ============================================================
-- TEMPORARY ROLLBACK of supabase_order_risk_workflow_rls.sql ONLY.
--
-- Reason: the Web app code that calls the 5 new RPCs (risk_initial_
-- review, management_review_order, accounts_review_order,
-- risk_final_release, risk_review_pod) has not been deployed yet, but
-- the trigger/RLS cutover is already live — so every non-admin staff
-- account is currently blocked from approving, rejecting, or reviewing
-- any order, because the currently-deployed OLD code still does raw
-- .update() calls the new trigger rejects.
--
-- This file does exactly one thing: restores the four RLS policies and
-- drops the two triggers to their EXACT pre-migration state, verified by
-- reading the original source (supabase_rls_overhaul.sql /
-- supabase_admin_warehouse_merge.sql) directly, not from memory. It does
-- NOT touch the 5 RPC functions — they stay in place, unused by the old
-- code, ready for the moment the new Web/Mobile code is actually
-- deployed and supabase_order_risk_workflow_rls.sql is re-applied.
--
-- CONFIRMED FINDING while preparing this rollback: the original
-- tightening of "delivery_logs_staff_all" also WIDENED its role list
-- (from dispatch/logistics/management only, to include operations/
-- admin_warehouse/risk) as an unflagged side effect of adding the
-- DELIVERED restriction. This rollback undoes both — the restored policy
-- below is the true original, dispatch/logistics/management only.
--
-- THIS IS A TEMPORARY STATE. Re-apply supabase_order_risk_workflow_rls.sql
-- (unmodified, it is still correct) once the Web app is deployed and
-- calling the 5 RPCs, and re-run the in-flight-order verification queries
-- first. Until then, the order workflow is back to enforcing sequencing
-- by application convention only, not by the database — exactly as it
-- was before this session's reconciliation work, no better and no worse.
-- ============================================================

begin;

-- 1. Drop the two transition-guard triggers and their functions.
drop trigger if exists orders_status_transition_guard on public.orders;
drop trigger if exists delivery_logs_status_transition_guard on public.delivery_logs;
drop function if exists public.enforce_order_status_transition();
drop function if exists public.enforce_delivery_status_transition();

-- 2. orders_staff_write — restored verbatim from supabase_admin_warehouse_merge.sql.
drop policy if exists "orders_staff_write" on public.orders;
create policy "orders_staff_write" on public.orders
  for all to authenticated
  using (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
    or public.is_admin()
  )
  with check (
    (
      (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED','REJECTED')
      or public.current_role() in ('finance','management','risk')
      or public.is_admin()
    )
    and (
      status not in ('OUT_FOR_DELIVERY','DELIVERED')
      or public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk')
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED')
      or coalesce(public.ceo_setting_numeric('ceo_cosign_order_threshold'), 0) <= 0
      or total_amount <= public.ceo_setting_numeric('ceo_cosign_order_threshold')
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED')
      or payment_mode is distinct from 'CREDIT'
      or coalesce(public.ceo_setting_numeric('ceo_cosign_credit_threshold'), 0) <= 0
      or total_amount <= public.ceo_setting_numeric('ceo_cosign_credit_threshold')
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED')
      or coalesce(public.ceo_setting_numeric('ceo_approval_threshold'), 0) <= 0
      or total_amount <= public.ceo_setting_numeric('ceo_approval_threshold')
      or public.is_admin()
    )
  );

-- 3. orders_driver_own_delivery — restored verbatim from supabase_rls_overhaul.sql
--    (driver's own OUT_FOR_DELIVERY/DELIVERED write access, as it was).
drop policy if exists "orders_driver_own_delivery" on public.orders;
create policy "orders_driver_own_delivery" on public.orders
  for update to authenticated
  using (
    public.is_driver()
    and exists (
      select 1 from public.delivery_logs dl
      where dl.order_id = orders.id and dl.driver_id = public.own_driver_id()
    )
  )
  with check (
    public.is_driver()
    and exists (
      select 1 from public.delivery_logs dl
      where dl.order_id = orders.id and dl.driver_id = public.own_driver_id()
    )
    and status in ('OUT_FOR_DELIVERY','DELIVERED')
  );

-- 4. delivery_logs_driver_own_update — restored verbatim from
--    supabase_rls_overhaul.sql (no status restriction, as it originally was).
drop policy if exists "delivery_logs_driver_own_update" on public.delivery_logs;
create policy "delivery_logs_driver_own_update" on public.delivery_logs
  for update to authenticated
  using (public.is_driver() and driver_id = public.own_driver_id())
  with check (public.is_driver() and driver_id = public.own_driver_id());

-- 5. delivery_logs_staff_all — restored verbatim from supabase_rls_overhaul.sql.
--    TRUE original role list is dispatch/logistics/management ONLY — this
--    also undoes the unflagged widening (operations/admin_warehouse/risk
--    were never part of this policy before this session).
drop policy if exists "delivery_logs_staff_all" on public.delivery_logs;
create policy "delivery_logs_staff_all" on public.delivery_logs
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

commit;
