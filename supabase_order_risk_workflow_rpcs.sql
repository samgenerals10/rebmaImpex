-- ============================================================
-- Order/Risk workflow reconciliation — Part 1 of 2 (RPCs only).
--
-- Canonical flow (approved blueprint):
--   Marketing -> Risk Initial -> Management -> Accounts -> Risk Final
--   Release -> Admin & Warehouse -> Dispatch -> Risk POD Review -> Delivered
--
-- This file is PURELY ADDITIVE — it creates five new functions and
-- touches no existing table, column, policy, or trigger. Nothing today
-- calls these functions, so running this file changes NOTHING about the
-- live app's current behavior. Safe to run at any time, independent of
-- whether the matching Web/Mobile code has been deployed yet.
--
-- Part 2 (supabase_order_risk_workflow_rls.sql) is the actual cutover —
-- it installs the BEFORE UPDATE triggers that make these the only legal
-- path for the review-gate transitions, and tightens the driver/staff
-- RLS grants. Part 2 must NOT run until:
--   (a) the Web and Mobile code in this same change set is deployed and
--       confirmed calling these five functions instead of raw updates, and
--   (b) you've confirmed there's no order currently sitting mid-transition
--       in a way the new machine can't resolve (see the verification
--       queries at the bottom of Part 2).
--
-- All five functions preserve the same admin bypass convention every
-- other function/policy in this schema already uses (public.is_admin()
-- always wins) — not introducing a new exception, not removing an
-- existing one.
--
-- Each function sets a transaction-local guard
-- (app.order_workflow_rpc_call) immediately before its own status write.
-- Part 2's trigger requires that guard to be set for the four review-gate
-- transitions and the POD->DELIVERED transition — this is what makes
-- those transitions reachable ONLY through these functions, not just
-- through a raw client update that happens to write a superficially
-- "legal" old/new status pair. `set_config` is a pg_catalog builtin, not
-- exposed as a Supabase RPC endpoint (PostgREST only resolves functions
-- from the public schema) — a client cannot set this flag directly.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Risk Initial Review: PENDING_RISK -> PENDING_MANAGEMENT / REJECTED /
--    RETURNED_FOR_CORRECTION. Replaces RiskApprovalsView.tsx's Sales
--    Order lane raw update AND removes the old "escalate" branch — every
--    approval now goes to Management, unconditionally, per the approved
--    decision that Management is mandatory, not an optional escalation.
--    Preserves the existing per-line-item qty/price edit capability
--    (p_metadata/p_total_amount), unchanged from what Risk could already
--    do at this stage.
-- ------------------------------------------------------------
create or replace function public.risk_initial_review(
  p_order_id text,
  p_action text,
  p_note text default null,
  p_metadata jsonb default null,
  p_total_amount numeric default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_new_status text;
  v_order public.orders;
begin
  if not (public.current_role() = 'risk' or public.is_admin()) then
    raise exception 'Not authorized: Risk Initial Review requires the risk role.';
  end if;

  select status into v_current_status from public.orders where id = p_order_id for update;
  if v_current_status is null then
    raise exception 'Order % not found.', p_order_id;
  end if;
  if v_current_status <> 'PENDING_RISK' then
    raise exception 'Order % is not awaiting Risk Initial Review (current status: %).', p_order_id, v_current_status;
  end if;

  v_new_status := case p_action
    when 'approve' then 'PENDING_MANAGEMENT'
    when 'reject' then 'REJECTED'
    when 'return' then 'RETURNED_FOR_CORRECTION'
    else null
  end;
  if v_new_status is null then
    raise exception 'Invalid action % for Risk Initial Review.', p_action;
  end if;

  perform set_config('app.order_workflow_rpc_call', 'true', true);

  update public.orders set
    status = v_new_status,
    rejection_reason = case when p_action = 'approve' then null else p_note end,
    metadata = coalesce(p_metadata, metadata),
    total_amount = coalesce(p_total_amount, total_amount),
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.risk_initial_review(text, text, text, jsonb, numeric) to authenticated;

-- ------------------------------------------------------------
-- 2. Management Approval: PENDING_MANAGEMENT -> PENDING_FINANCE /
--    REJECTED / RETURNED_FOR_CORRECTION. This is now the MANDATORY
--    universal stage every order passes through (previously
--    escalation-only). Preserves Management's existing per-line-item
--    quantity/price edit capability — explicitly confirmed to stay
--    intact per the approved decision. Does NOT touch the separate
--    Cargo Intake (incoming goods) workflow, which stays Risk-only.
-- ------------------------------------------------------------
create or replace function public.management_review_order(
  p_order_id text,
  p_action text,
  p_note text default null,
  p_metadata jsonb default null,
  p_total_amount numeric default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_new_status text;
  v_order public.orders;
begin
  if not (public.current_role() = 'management' or public.is_admin()) then
    raise exception 'Not authorized: Management Approval requires the management role.';
  end if;

  select status into v_current_status from public.orders where id = p_order_id for update;
  if v_current_status is null then
    raise exception 'Order % not found.', p_order_id;
  end if;
  if v_current_status <> 'PENDING_MANAGEMENT' then
    raise exception 'Order % is not awaiting Management Approval (current status: %).', p_order_id, v_current_status;
  end if;

  v_new_status := case p_action
    when 'approve' then 'PENDING_FINANCE'
    when 'reject' then 'REJECTED'
    when 'return' then 'RETURNED_FOR_CORRECTION'
    else null
  end;
  if v_new_status is null then
    raise exception 'Invalid action % for Management Approval.', p_action;
  end if;

  perform set_config('app.order_workflow_rpc_call', 'true', true);

  update public.orders set
    status = v_new_status,
    rejection_reason = case when p_action = 'approve' then null else p_note end,
    metadata = coalesce(p_metadata, metadata),
    total_amount = coalesce(p_total_amount, total_amount),
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.management_review_order(text, text, text, jsonb, numeric) to authenticated;

-- ------------------------------------------------------------
-- 3. Accounts Office review: PENDING_FINANCE -> PENDING_RISK_RELEASE /
--    REJECTED / RETURNED_FOR_CORRECTION.
--
-- THE RECONCILIATION POINT: this single function replaces BOTH existing
-- Finance-approval write paths —
--   - finance/OrdersQueueView.tsx's approveOrder() (the thorough one:
--     stock-shortage check, stock deduction, notifications, audit log)
--   - FinanceDashboard.tsx's inline "Settle Credit" block (the bare one:
--     a raw status update with none of the above — a real, confirmed bug
--     found during the audit)
-- Both call sites are being rewritten to call this same RPC for the
-- status transition, then both call the SAME shared stock-deduction
-- helper (checkStockAvailability/deductStockForOrder in apiClient.ts,
-- unchanged) — so neither path can any longer complete an approval
-- without the other's side effects. The RPC itself stays focused on the
-- one thing that must be unbypassable — the status transition — per the
-- blueprint's design (side effects that aren't security-critical, like
-- notifications, stay in application code, unchanged in shape from what
-- already exists).
--
-- Preserves finance_approved_by/finance_approved_by_email, written
-- exactly as OrdersQueueView.tsx already does today.
-- ------------------------------------------------------------
create or replace function public.accounts_review_order(
  p_order_id text,
  p_action text,
  p_note text default null,
  p_approved_by text default null,
  p_approved_by_email text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_new_status text;
  v_order public.orders;
begin
  if not (public.current_role() = 'finance' or public.is_admin()) then
    raise exception 'Not authorized: Accounts Office review requires the finance role.';
  end if;

  select status into v_current_status from public.orders where id = p_order_id for update;
  if v_current_status is null then
    raise exception 'Order % not found.', p_order_id;
  end if;
  if v_current_status <> 'PENDING_FINANCE' then
    raise exception 'Order % is not awaiting Accounts Office review (current status: %).', p_order_id, v_current_status;
  end if;

  v_new_status := case p_action
    when 'approve' then 'PENDING_RISK_RELEASE'
    when 'reject' then 'REJECTED'
    -- Return-for-correction re-enters the FULL chain at PENDING_RISK, not
    -- a shortcut back to Accounts or Management — per the explicit
    -- decision that a returned order must have its whole
    -- order/customer/control chain rechecked, not just the payment step
    -- that triggered the return.
    when 'return' then 'RETURNED_FOR_CORRECTION'
    else null
  end;
  if v_new_status is null then
    raise exception 'Invalid action % for Accounts Office review.', p_action;
  end if;

  perform set_config('app.order_workflow_rpc_call', 'true', true);

  update public.orders set
    status = v_new_status,
    rejection_reason = case when p_action = 'approve' then null else p_note end,
    finance_approved_by = case when p_action = 'approve' then coalesce(p_approved_by, finance_approved_by) else finance_approved_by end,
    finance_approved_by_email = case when p_action = 'approve' then coalesce(p_approved_by_email, finance_approved_by_email) else finance_approved_by_email end,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.accounts_review_order(text, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Risk Final Release Check (NEW): PENDING_RISK_RELEASE -> APPROVED /
--    REJECTED / RETURNED_FOR_CORRECTION.
--
-- Deliberately NO line-item editing parameter, per the approved decision
-- — by this point Accounts has already verified the financial transaction
-- against the order as it stood; editing quantities/prices here would
-- invalidate a check that already happened.
--
-- APPROVED is the exact same status value Admin & Warehouse's dispatch
-- screen (ApprovedGoodsView.tsx) has always checked for — no change
-- needed there. Its meaning shifts from "Finance-approved" to
-- "Risk-released", which is the intended outcome, not a side effect to
-- work around.
-- ------------------------------------------------------------
create or replace function public.risk_final_release(
  p_order_id text,
  p_action text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_new_status text;
  v_order public.orders;
begin
  if not (public.current_role() = 'risk' or public.is_admin()) then
    raise exception 'Not authorized: Risk Final Release requires the risk role.';
  end if;

  select status into v_current_status from public.orders where id = p_order_id for update;
  if v_current_status is null then
    raise exception 'Order % not found.', p_order_id;
  end if;
  if v_current_status <> 'PENDING_RISK_RELEASE' then
    raise exception 'Order % is not awaiting Risk Final Release (current status: %).', p_order_id, v_current_status;
  end if;

  v_new_status := case p_action
    when 'approve' then 'APPROVED'
    when 'reject' then 'REJECTED'
    when 'return' then 'RETURNED_FOR_CORRECTION'
    else null
  end;
  if v_new_status is null then
    raise exception 'Invalid action % for Risk Final Release.', p_action;
  end if;

  perform set_config('app.order_workflow_rpc_call', 'true', true);

  update public.orders set
    status = v_new_status,
    rejection_reason = case when p_action = 'approve' then null else p_note end,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.risk_final_release(text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 5. Risk POD Review: delivery_logs.PENDING_RISK_REVIEW -> DELIVERED /
--    POD_REJECTED, and on approve also flips the linked orders.status to
--    DELIVERED (mirrors RiskApprovalsView.tsx's existing POD-approval
--    logic exactly — same two-table write, just funneled through a
--    guarded function instead of two raw updates).
--
-- THE critical closure point: this is the ONLY function that can ever
-- set orders.status = 'DELIVERED'. Part 2's trigger requires the
-- app.order_workflow_rpc_call guard for that specific transition, so a
-- driver's or staff account's own direct update attempting the same
-- OUT_FOR_DELIVERY -> DELIVERED transition will be rejected even though
-- the state values line up — only a call that went through this function
-- sets the guard first.
-- ------------------------------------------------------------
create or replace function public.risk_review_pod(
  p_delivery_log_id text,
  p_action text,
  p_note text default null
)
returns public.delivery_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_order_id text;
  v_new_status text;
  v_row public.delivery_logs;
begin
  if not (public.current_role() = 'risk' or public.is_admin()) then
    raise exception 'Not authorized: POD review requires the risk role.';
  end if;

  select status, order_id into v_current_status, v_order_id from public.delivery_logs where id = p_delivery_log_id for update;
  if v_current_status is null then
    raise exception 'Delivery log % not found.', p_delivery_log_id;
  end if;
  if v_current_status <> 'PENDING_RISK_REVIEW' then
    raise exception 'Delivery % is not awaiting Risk POD review (current status: %).', p_delivery_log_id, v_current_status;
  end if;

  v_new_status := case p_action
    when 'approve' then 'DELIVERED'
    when 'reject' then 'POD_REJECTED'
    else null
  end;
  if v_new_status is null then
    raise exception 'Invalid action % for POD review.', p_action;
  end if;

  perform set_config('app.order_workflow_rpc_call', 'true', true);

  update public.delivery_logs set
    status = v_new_status,
    delivered_at = case when p_action = 'approve' then now() else delivered_at end,
    updated_at = now()
  where id = p_delivery_log_id
  returning * into v_row;

  if p_action = 'approve' and v_order_id is not null then
    update public.orders set status = 'DELIVERED', updated_at = now() where id = v_order_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.risk_review_pod(text, text, text) to authenticated;
