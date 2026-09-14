-- supabase_admin_warehouse_risk_security_hardening.sql
--
-- Closes the Admin & Warehouse / Risk gaps found by this session's
-- department audit. Run after every other migration already applied.

begin;

-- ============================================================
-- 1. delivery_logs — 'risk' was added to _select/_update when Dispatch
--    moved into Risk (supabase_dispatch_to_risk.sql), but _insert/_delete
--    were never touched, on the reasoning that "_update already includes
--    risk, no RLS change needed there" — which missed that Risk's own
--    Deliveries screen (DeliveriesView.tsx/DeliveriesScreen.tsx) has a
--    live "Delete Delivery Log" button. Widened to match the exact same
--    role list _select/_update already carry.
-- ============================================================

drop policy if exists "delivery_logs_staff_insert" on public.delivery_logs;
create policy "delivery_logs_staff_insert" on public.delivery_logs
  for insert to authenticated
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
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
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin());

-- ============================================================
-- 2. waybills — was USING(true) for every authenticated user (full
--    customer/destination/driver detail readable by any department, not
--    just the ones that legitimately touch a shipment). Narrowed to the
--    departments that actually work with waybills, matching the same
--    role list waybills_write already used.
-- ============================================================

drop policy if exists "waybills_select_broad" on public.waybills;
create policy "waybills_select" on public.waybills
  for select to authenticated
  using (
    public.current_role() in ('operations','dispatch','logistics','management','risk','admin_warehouse')
    or public.is_admin()
  );

commit;

-- ============================================================
-- Deliberately NOT changed by this migration:
--   - The "Mark Delivered" quick-action bypass (OverviewView.tsx) and the
--     forgeable credit-terms/verification attribution
--     (setCustomerCreditTerms/setCustomerVerification) were both APP-CODE
--     bugs, not RLS gaps — fixed directly in the corresponding .ts/.tsx
--     files in this same commit, no SQL needed for those two.
--   - The Critical finding's own caveat still applies: this migration
--     assumes supabase_order_risk_workflow_rls.sql's transition-guard
--     triggers (orders_status_transition_guard /
--     delivery_logs_status_transition_guard) are actually live in this
--     database. If supabase_order_risk_workflow_ROLLBACK.sql was ever
--     run and never reversed, please confirm those two triggers exist in
--     the Supabase dashboard before treating "Mark Delivered now routes
--     through risk_review_pod()" as sufficient on its own — the RPC's
--     own internal role/status checks are the real backstop either way,
--     but worth confirming directly rather than assuming.
-- ============================================================
