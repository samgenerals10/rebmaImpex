-- ============================================================
-- Risk Department Foundation (Phase 1 of the Enhancement Blueprint)
--
-- Adds the 'risk' role and grants it the write access it needs to take
-- over cargo intake approval, sales order approval, and proof-of-delivery
-- review from Management/CEO. Run this AFTER the matching frontend code
-- changes are deployed — the policies below reference status values
-- (PENDING_RISK_APPROVAL, PENDING_RISK, PENDING_RISK_REVIEW,
-- RETURNED_FOR_CORRECTION, POD_REJECTED) that only the new frontend code
-- actually writes.
--
-- ⚠️ Before running: `profiles.department` is referenced by RLS policies
-- and app code but is not created by any .sql file in this repo — its
-- live column type/constraints could not be confirmed offline. Spot-check
-- it in the Supabase dashboard's table editor first. This migration does
-- NOT assume or add a constraint on `department` — it stays free text,
-- matching current behavior.
--
-- No new tables and no new columns are introduced here — every new status
-- is just a text value in an existing column, and every Risk decision is
-- recorded in the existing global_audit_history table via the same
-- string-encoding convention Management's approvals screen already uses.
-- ============================================================

-- 1. Allow the new role on profiles.role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
    role in ('CEO','HR','admin','marketing','operations','finance','production',
             'receptionist','dispatch','logistics','management','Staff','risk')
);

-- 2. cargo_intake: Risk replaces Management as sole approver.
--    'management' is dropped entirely from this policy — cargo approval is
--    no longer part of Management's job. Operations keeps write access for
--    logging intakes; only Risk (or the CEO/admin override) may push status
--    into APPROVED / REJECTED / RETURNED_FOR_CORRECTION.
drop policy if exists "cargo_intake_write" on public.cargo_intake;
create policy "cargo_intake_write" on public.cargo_intake
  for all to authenticated
  using (public.current_role() in ('operations','risk') or public.is_admin())
  with check (
    (public.current_role() in ('operations','risk') or public.is_admin())
    and (status not in ('APPROVED','REJECTED','RETURNED_FOR_CORRECTION')
         or public.current_role() = 'risk' or public.is_admin())
  );

-- 3. orders: add 'risk' alongside the existing roles. Copied in full from
--    the authoritative supabase_control_center_patch3.sql version (the
--    latest of three drop/recreate generations of this policy) — do NOT
--    reintroduce the older supabase_rls_overhaul.sql / supabase_control_center.sql
--    copies, they are missing the cosign-threshold clauses added later.
--    'management' stays in every clause here too — Management still needs
--    to be able to push escalated orders (status PENDING_MANAGEMENT,
--    written only by Risk's "Escalate" action now) through to
--    PENDING_FINANCE/APPROVED exactly as before.
drop policy if exists "orders_staff_write" on public.orders;
create policy "orders_staff_write" on public.orders
  for all to authenticated
  using (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','risk') and not public.is_driver())
    or public.is_admin()
  )
  with check (
    (
      (public.current_role() in ('marketing','finance','management','dispatch','logistics','risk') and not public.is_driver())
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED','REJECTED')
      or public.current_role() in ('finance','management','risk')
      or public.is_admin()
    )
    and (
      status not in ('OUT_FOR_DELIVERY','DELIVERED')
      or public.current_role() in ('dispatch','logistics','management','risk')
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

-- 4. delivery_logs: add 'risk' to select + update only — Risk never inserts
--    or deletes delivery_logs rows, only reviews/approves proof of delivery
--    on rows Dispatch already created. Copied from the authoritative
--    supabase_delivery_logs_operations_write.sql, which already includes
--    'operations' — preserved here, not dropped. Insert/delete policies on
--    this table are untouched by this migration.
drop policy if exists "delivery_logs_staff_select" on public.delivery_logs;
create policy "delivery_logs_staff_select" on public.delivery_logs
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','risk') and not public.is_driver()) or public.is_admin());

drop policy if exists "delivery_logs_staff_update" on public.delivery_logs;
create policy "delivery_logs_staff_update" on public.delivery_logs
  for update to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','risk') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations','risk') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );
