-- ============================================================
-- Order/Risk workflow reconciliation — Part 2 of 2 (the cutover).
--
-- ⚠️ DO NOT RUN THIS FILE until BOTH of the following are true:
--   1. The Web and Mobile code in this same change set has been deployed
--      and confirmed calling risk_initial_review() / management_review_
--      order() / accounts_review_order() / risk_final_release() /
--      risk_review_pod() instead of raw orders/delivery_logs updates.
--   2. You've run the verification queries at the very bottom of this
--      file FIRST, against the live database, and confirmed there is no
--      order or delivery currently sitting in a state this migration
--      would strand. Do not assume the absence of in-flight rows from
--      source code alone — check the live rows.
--
-- This file installs two BEFORE UPDATE triggers that make the four
-- review-gate transitions and the POD->DELIVERED transition reachable
-- ONLY through the five functions in supabase_order_risk_workflow_rpcs.sql
-- (they set a transaction-local guard immediately before their own
-- write; the triggers require that guard for those specific
-- transitions). This is the actual state-machine enforcement — RLS alone
-- cannot cleanly compare an old and a new column value in one
-- expression, which is why a trigger is the correct mechanism here, not
-- a workaround.
--
-- public.is_admin() always overrides both triggers, matching the
-- existing convention.
-- ============================================================

-- ------------------------------------------------------------
-- 1. orders.status transition guard.
-- ------------------------------------------------------------
create or replace function public.enforce_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
  v_via_rpc boolean := coalesce(current_setting('app.order_workflow_rpc_call', true), 'false') = 'true';
begin
  if public.is_admin() then
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_allowed := case
    when old.status = 'PENDING_RISK' and new.status in ('PENDING_MANAGEMENT','REJECTED','RETURNED_FOR_CORRECTION') and v_via_rpc then true
    when old.status = 'PENDING_MANAGEMENT' and new.status in ('PENDING_FINANCE','REJECTED','RETURNED_FOR_CORRECTION') and v_via_rpc then true
    when old.status = 'PENDING_FINANCE' and new.status in ('PENDING_RISK_RELEASE','REJECTED','RETURNED_FOR_CORRECTION') and v_via_rpc then true
    when old.status = 'PENDING_RISK_RELEASE' and new.status in ('APPROVED','REJECTED','RETURNED_FOR_CORRECTION') and v_via_rpc then true
    -- The one legitimate path to DELIVERED, and only via risk_review_pod().
    when old.status = 'OUT_FOR_DELIVERY' and new.status = 'DELIVERED' and v_via_rpc then true
    -- Admin & Warehouse / Dispatch's own simple sequence — no complex
    -- business logic beyond "was this genuinely Risk-released", so a
    -- plain trigger rule is sufficient here; no dedicated RPC needed.
    when old.status = 'APPROVED' and new.status = 'PROCESSING' then true
    when old.status = 'PROCESSING' and new.status = 'OUT_FOR_DELIVERY' then true
    -- Marketing editing and resubmitting a returned order re-enters the
    -- top of the chain — unchanged from today's behavior.
    when old.status = 'RETURNED_FOR_CORRECTION' and new.status = 'PENDING_RISK' then true
    else false
  end;

  if not v_allowed then
    raise exception 'Illegal order status transition: % -> % (this stage requires the matching workflow function, not a direct update).', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_status_transition_guard on public.orders;
create trigger orders_status_transition_guard
  before update on public.orders
  for each row
  execute function public.enforce_order_status_transition();

-- ------------------------------------------------------------
-- 2. delivery_logs.status transition guard.
--
-- FAILED is deliberately left unrestricted (`when new.status = 'FAILED'
-- then true`) — out of scope for this change per the explicit decision
-- to preserve it exactly as it works today, flagged as a follow-up item,
-- not redesigned here.
-- ------------------------------------------------------------
create or replace function public.enforce_delivery_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
  v_via_rpc boolean := coalesce(current_setting('app.order_workflow_rpc_call', true), 'false') = 'true';
begin
  if public.is_admin() then
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_allowed := case
    when new.status = 'FAILED' then true
    when old.status = 'PENDING_ASSIGNMENT' and new.status = 'ASSIGNED' then true
    when old.status = 'ASSIGNED' and new.status = 'IN_TRANSIT' then true
    -- Driver completion (whether from IN_TRANSIT the first time, or
    -- POD_REJECTED on a resubmission) always lands here — never DELIVERED
    -- directly. This is the literal closure of the driver bypass.
    when old.status in ('ASSIGNED','IN_TRANSIT','POD_REJECTED') and new.status = 'PENDING_RISK_REVIEW' then true
    -- The only path onward from here is risk_review_pod().
    when old.status = 'PENDING_RISK_REVIEW' and new.status in ('DELIVERED','POD_REJECTED') and v_via_rpc then true
    else false
  end;

  if not v_allowed then
    raise exception 'Illegal delivery status transition: % -> % (this stage requires Risk POD review, not a direct update).', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_logs_status_transition_guard on public.delivery_logs;
create trigger delivery_logs_status_transition_guard
  before update on public.delivery_logs
  for each row
  execute function public.enforce_delivery_status_transition();

-- ------------------------------------------------------------
-- 3. RLS tightening — defense in depth alongside the triggers above.
--    The triggers are the actual enforcement; this additionally stops a
--    non-admin account from even ATTEMPTING the now-illegal writes,
--    failing with a clear permission-denied rather than relying solely
--    on the trigger exception.
-- ------------------------------------------------------------

-- orders_staff_write: the four review-gate values and DELIVERED are no
-- longer directly writable by role alone — they only exist via the
-- guarded functions above. PROCESSING/OUT_FOR_DELIVERY stay writable by
-- the existing role list; the trigger above is what actually enforces
-- their old-status requirement.
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
      status not in ('PENDING_RISK','PENDING_MANAGEMENT','PENDING_FINANCE','PENDING_RISK_RELEASE','DELIVERED')
      or public.is_admin()
    )
  );

-- orders_driver_own_delivery: a driver's own direct orders-write access
-- is narrowed from ('OUT_FOR_DELIVERY','DELIVERED') to 'OUT_FOR_DELIVERY'
-- only — DELIVERED is never writable by a driver, full stop. This is the
-- literal "remove the current RLS-authorized driver bypass" requirement.
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
    and status = 'OUT_FOR_DELIVERY'
  );

-- delivery_logs_driver_own_update: previously had NO status restriction
-- at all — a driver could write any status, including DELIVERED,
-- directly. Narrowed to PENDING_RISK_REVIEW only (covers both first-time
-- completion and resubmission after POD_REJECTED).
drop policy if exists "delivery_logs_driver_own_update" on public.delivery_logs;
create policy "delivery_logs_driver_own_update" on public.delivery_logs
  for update to authenticated
  using (public.is_driver() and driver_id = public.own_driver_id())
  with check (
    public.is_driver() and driver_id = public.own_driver_id()
    and status = 'PENDING_RISK_REVIEW'
  );

-- delivery_logs_staff_all: a legacy policy from supabase_rls_overhaul.sql
-- that was NEVER dropped by any later migration — it still coexists,
-- OR'd together, alongside the four newer granular
-- delivery_logs_staff_select/insert/update/delete policies from
-- supabase_risk_department.sql/supabase_admin_warehouse_merge.sql.
-- CORRECTED after a precision check against the actual source: an
-- earlier version of this migration accidentally WIDENED this policy's
-- role list (to include operations/admin_warehouse/risk) as an unflagged
-- side effect of adding the DELIVERED restriction. Its true original role
-- list is dispatch/logistics/management ONLY — restored exactly, with
-- only the DELIVERED restriction actually added.
drop policy if exists "delivery_logs_staff_all" on public.delivery_logs;
create policy "delivery_logs_staff_all" on public.delivery_logs
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
    and (status <> 'DELIVERED' or public.is_admin())
  );

-- delivery_logs_staff_update: the REAL, current, full-role-list policy
-- (source: supabase_admin_warehouse_merge.sql) — a separate, coexisting
-- permissive policy from delivery_logs_staff_all above. Because Postgres
-- OR's multiple permissive policies together, satisfying EITHER one is
-- enough to pass RLS, so tightening delivery_logs_staff_all alone left
-- this one as an equally-valid path to attempt a DELIVERED write. The
-- transition-guard trigger below still closes the actual gap regardless
-- of which policy let the attempt through (RLS decides IF a write is
-- attempted; the trigger decides if THAT specific old->new value is
-- legal) — this addition is the RLS-layer defense-in-depth catching up
-- to match what the trigger already enforces, not a second real gap.
drop policy if exists "delivery_logs_staff_update" on public.delivery_logs;
create policy "delivery_logs_staff_update" on public.delivery_logs
  for update to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
    and (status <> 'DELIVERED' or public.is_admin())
  );

-- ============================================================
-- VERIFICATION QUERIES — run these FIRST, before anything above, and
-- confirm the results make sense for your live data before proceeding.
-- ============================================================

-- Any order the new machine wouldn't know how to route further. Under
-- the new state machine every non-terminal order should be one of:
-- PENDING_RISK, PENDING_MANAGEMENT, PENDING_FINANCE, PENDING_RISK_RELEASE,
-- APPROVED, PROCESSING, OUT_FOR_DELIVERY. Anything outside that list
-- (there shouldn't be any, since no status is being removed) needs a
-- manual look before this migration runs.
-- select id, status, client_name, total_amount, created_at from public.orders
--   where status not in ('PENDING_RISK','PENDING_MANAGEMENT','PENDING_FINANCE',
--     'PENDING_RISK_RELEASE','APPROVED','PROCESSING','OUT_FOR_DELIVERY',
--     'DELIVERED','REJECTED','RETURNED_FOR_CORRECTION')
--   order by created_at desc;

-- Orders currently sitting in PENDING_MANAGEMENT from an OLD escalation —
-- these are fine to leave as-is; Management's screen will still show them
-- and management_review_order() will process them normally into
-- PENDING_FINANCE, same as any other order now. No special handling
-- needed, just worth eyeballing the count before cutover.
-- select count(*) from public.orders where status = 'PENDING_MANAGEMENT';

-- Orders currently APPROVED or PROCESSING or OUT_FOR_DELIVERY — these
-- were approved under the OLD meaning of APPROVED (Finance-approved, not
-- yet Risk-released). They will continue through Admin & Warehouse/
-- Dispatch exactly as before; the trigger's APPROVED->PROCESSING and
-- PROCESSING->OUT_FOR_DELIVERY rules don't care how APPROVED was reached,
-- only that it currently is. No backfill needed — just confirm the count
-- looks right.
-- select status, count(*) from public.orders
--   where status in ('APPROVED','PROCESSING','OUT_FOR_DELIVERY')
--   group by status;

-- Deliveries currently PENDING_RISK_REVIEW or mid-transit — these will
-- flow into risk_review_pod() exactly as designed. Confirm none are
-- stuck in an unexpected state first.
-- select status, count(*) from public.delivery_logs
--   where status not in ('DELIVERED','FAILED')
--   group by status;
