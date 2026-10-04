-- supabase_atomic_approvals.sql
--
-- Step 1 of the audit fixes: money and stock.
--
-- Until now several approvals were done by the app in separate steps:
-- change the status, then read the stock number, then write a new one,
-- then save the payment. If two people pressed Approve at the same
-- moment, or the connection dropped half-way, stock could be added twice,
-- a payment could be saved for an order that was never approved, or a
-- float could be paid into petty cash twice.
--
-- Each function below does the WHOLE action in one go inside the
-- database: it locks the item, checks it is still waiting, and then
-- either everything happens or nothing does. A second person pressing
-- Approve on the same item gets a clear "already decided" message.
--
--   accounts_approve_order     Account Department approval, with the
--                              optional payment and the stock deduction
--   review_cargo_intake        Risk or Management cargo decision + stock
--   review_production_request  Management decision + ticket + stock
--   review_general_purchase    Management decision
--   review_float_request       Management decision + petty cash top-up
--   release_raw_materials      Admin & Warehouse release + stock
--   correct_cargo_intake       Management correction + stock difference
--   adjust_general_purchase    Stock-page quantity adjustment
--
-- The older functions stay in place so nothing open today breaks.
-- Run this BEFORE deploying the updated apps. Safe to run more than once.

begin;

-- ============================================================
-- Shared helper: one stock movement, locked per product.
-- Only the functions below may call it (not callable from the apps).
-- ============================================================
create or replace function public.stock_apply(
  p_product text,
  p_delta numeric,
  p_movement text,
  p_reference text,
  p_notes text default null,
  p_unit text default 'units',
  p_code text default null,
  p_category text default 'INCOMING_GOODS'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_product, ''));
  v_id text;
  v_qty numeric;
begin
  if v_name = '' or coalesce(p_delta, 0) = 0 then return null; end if;

  -- Same lock the order functions use, so every stock change on one
  -- product happens one at a time.
  perform pg_advisory_xact_lock(hashtext('stock_' || lower(v_name)));

  select id::text, quantity into v_id, v_qty
  from public.stock where lower(trim(product_name)) = lower(v_name)
  limit 1;

  if v_id is null then
    if p_delta > 0 then
      insert into public.stock (product_name, product_code, category, quantity, maximum_level, minimum_level, unit, last_updated, updated_by)
      values (
        v_name, p_code, coalesce(p_category, 'INCOMING_GOODS'), p_delta,
        greatest(p_delta * 2, 1000), greatest(round(p_delta * 0.1), 50),
        coalesce(nullif(p_unit, ''), 'units'), now(), auth.uid()
      )
      returning quantity into v_qty;
    else
      v_qty := 0;
    end if;
  else
    update public.stock
      set quantity = greatest(0, coalesce(quantity, 0) + p_delta),
          last_updated = now(),
          updated_by = auth.uid()
      where id::text = v_id
      returning quantity into v_qty;
  end if;

  insert into public.stock_ledger (product_name, movement_type, quantity, reference, notes, performed_by, created_at)
  values (
    v_name, p_movement,
    case when p_movement = 'CORRECTION' then p_delta else abs(p_delta) end,
    p_reference, p_notes, auth.uid(), now()
  );

  return v_qty;
end;
$$;

revoke all on function public.stock_apply(text, numeric, text, text, text, text, text, text) from public, anon, authenticated;

-- ============================================================
-- 1. Account Department approval (with optional payment).
--    PENDING_FINANCE -> PENDING_RISK_RELEASE, the stock leaves, and the
--    payment (if given) is saved: all together or not at all. If any
--    item is short, nothing happens and the message says which.
-- ============================================================
create or replace function public.accounts_approve_order(
  p_order_id text,
  p_approved_by text default null,
  p_approved_by_email text default null,
  p_payment jsonb default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_items jsonb;
  v_line record;
  v_have numeric;
  v_ref text;
  v_payment jsonb;
  v_cols text;
begin
  if not (public.current_role() = 'finance' or public.is_admin()) then
    raise exception 'Not authorized: only the Account Department can approve this.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found.', p_order_id;
  end if;
  if v_order.status <> 'PENDING_FINANCE' then
    raise exception 'This order has already been dealt with (it is now %).', v_order.status;
  end if;

  if p_payment is not null and coalesce((p_payment->>'amount')::numeric, 0) <= 0 then
    raise exception 'The payment amount must be more than zero.';
  end if;

  -- The order's items, worked out exactly the way the apps do it.
  v_items := coalesce(v_order.metadata->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    v_items := case
      when coalesce(trim(v_order.product_name), '') <> '' then
        jsonb_build_array(jsonb_build_object(
          'productName', v_order.product_name,
          'quantity', coalesce(nullif(to_jsonb(v_order)->>'quantity', '')::numeric, 1)))
      else '[]'::jsonb
    end;
  end if;

  -- Check every product first (same product on two lines is added up),
  -- holding each product's lock until the end.
  for v_line in
    select min(trim(value->>'productName')) as product, sum(coalesce(nullif(value->>'quantity', '')::numeric, 0)) as qty
    from jsonb_array_elements(v_items)
    where coalesce(trim(value->>'productName'), '') <> ''
    group by lower(trim(value->>'productName'))
    order by lower(trim(value->>'productName'))
  loop
    if v_line.qty <= 0 then continue; end if;
    perform pg_advisory_xact_lock(hashtext('stock_' || lower(v_line.product)));
    select quantity into v_have from public.stock where lower(trim(product_name)) = lower(v_line.product) limit 1;
    if coalesce(v_have, 0) < v_line.qty then
      raise exception 'Not enough stock for %: need %, only % in stock.', v_line.product, v_line.qty, coalesce(v_have, 0);
    end if;
  end loop;

  perform set_config('app.order_workflow_rpc_call', 'true', true);
  update public.orders set
    status = 'PENDING_RISK_RELEASE',
    rejection_reason = null,
    finance_approved_by = coalesce(p_approved_by, finance_approved_by),
    finance_approved_by_email = coalesce(p_approved_by_email, finance_approved_by_email),
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  v_ref := 'Order Approved: ' || coalesce(nullif(v_order.ticket_number, ''), 'ORD-' || upper(left(v_order.id, 6)));
  for v_line in
    select min(trim(value->>'productName')) as product, sum(coalesce(nullif(value->>'quantity', '')::numeric, 0)) as qty
    from jsonb_array_elements(v_items)
    where coalesce(trim(value->>'productName'), '') <> ''
    group by lower(trim(value->>'productName'))
    order by lower(trim(value->>'productName'))
  loop
    if v_line.qty > 0 then
      perform public.stock_apply(v_line.product, -v_line.qty, 'REMOVE', v_ref);
    end if;
  end loop;

  -- The payment, using only the columns the payments table really has.
  if p_payment is not null then
    v_payment := (p_payment - 'id') || jsonb_build_object('order_id', p_order_id);
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'finance_payments' and v_payment ? c.column_name;
    if v_cols is not null then
      execute format('insert into public.finance_payments (%1$s) select %1$s from jsonb_populate_record(null::public.finance_payments, $1)', v_cols)
        using v_payment;
    end if;
  end if;

  return v_order;
end;
$$;

grant execute on function public.accounts_approve_order(text, text, text, jsonb) to authenticated;

-- ============================================================
-- 2. Cargo intake decision (Risk or Management).
-- ============================================================
create or replace function public.review_cargo_intake(
  p_cargo_id text,
  p_stage text,            -- 'risk' or 'management'
  p_action text,           -- 'approve', 'reject' or 'return'
  p_note text default null,
  p_damaged numeric default 0,
  p_unit_cost numeric default null,
  p_selling_price numeric default null,
  p_discrepancies text default null,
  p_reference text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cargo_intake;
  v_json jsonb;
  v_expected text;
  v_new_status text;
  v_incoming numeric;
  v_final numeric;
  v_damaged numeric := greatest(coalesce(p_damaged, 0), 0);
  v_product text;
  v_unit text;
  v_code text;
  v_ref text;
begin
  if p_stage = 'risk' then
    if not (public.current_role() = 'risk' or public.is_admin()) then
      raise exception 'Not authorized: only Risk can make this decision.';
    end if;
    v_expected := 'PENDING_RISK_APPROVAL';
  elsif p_stage = 'management' then
    if not (public.current_role() = 'management' or public.is_admin()) then
      raise exception 'Not authorized: only Management can make this decision.';
    end if;
    v_expected := 'PENDING_MANAGEMENT_APPROVAL';
  else
    raise exception 'Unknown approval stage %.', p_stage;
  end if;

  v_new_status := case p_action
    when 'approve' then 'APPROVED'
    when 'reject' then 'REJECTED'
    when 'return' then 'RETURNED_FOR_CORRECTION'
    else null end;
  if v_new_status is null then raise exception 'Unknown action %.', p_action; end if;

  select * into v_row from public.cargo_intake where id::text = p_cargo_id for update;
  if not found then raise exception 'Cargo intake % not found.', p_cargo_id; end if;
  if v_row.status is distinct from v_expected then
    raise exception 'This cargo has already been dealt with (it is now %).', v_row.status;
  end if;

  v_json := to_jsonb(v_row);
  v_incoming := coalesce(nullif(v_json->>'quantity', '')::numeric, nullif(v_json->>'qty_received', '')::numeric, 0);
  v_product := coalesce(nullif(trim(v_json->>'product_name'), ''), 'Unknown Product');
  v_unit := coalesce(nullif(v_json->>'goods_type', ''), nullif(v_json->>'unit', ''), 'units');
  v_code := coalesce(nullif(v_json->>'goods_code', ''), upper(left(p_cargo_id, 8)));
  v_ref := 'Cargo approved: ' || coalesce(p_reference, p_cargo_id);

  if p_stage = 'risk' then
    -- Risk approves the cargo exactly as submitted.
    update public.cargo_intake
      set status = v_new_status,
          rejection_reason = case when p_action = 'approve' then null else p_note end
      where id::text = p_cargo_id;
    if p_action = 'approve' and v_incoming > 0 then
      perform public.stock_apply(v_product, v_incoming, 'ADD', v_ref, p_description, v_unit, v_code);
    end if;
  else
    -- Management can record damaged units (which don't go into stock).
    v_final := greatest(0, v_incoming - v_damaged);
    update public.cargo_intake
      set status = v_new_status,
          quantity = case when p_action = 'approve' then v_final else v_incoming end,
          discrepancies = coalesce(p_discrepancies, discrepancies),
          unit_price = p_unit_cost,
          is_fault_or_damaged = v_damaged > 0,
          rejection_reason = case when p_action = 'approve' then null else p_note end
      where id::text = p_cargo_id;

    if p_action = 'approve' then
      if v_final > 0 then
        perform public.stock_apply(
          v_product, v_final, 'ADD', v_ref,
          coalesce(p_description, '') || case when v_damaged > 0 then ' (' || v_damaged || ' units damaged/lost)' else '' end,
          v_unit, v_code);
      end if;
      if v_damaged > 0 and coalesce(p_unit_cost, 0) > 0 then
        insert into public.finance_expenses (category, description, amount, date, status, submitted_by, notes)
        values (
          'Damaged Goods',
          'Loss from damaged goods in Cargo Intake ' || coalesce(p_reference, p_cargo_id) || ' (' || v_product || ': ' || v_damaged || ' units)',
          v_damaged * p_unit_cost, current_date, 'Approved', 'Management (Auto-generated)',
          'Auto-generated from Cargo Intake approval. Discrepancy details: ' || coalesce(p_description, ''));
      end if;
      if coalesce(p_selling_price, 0) > 0 then
        insert into public.goods_prices (product_name, unit_price)
        values (v_product, p_selling_price)
        on conflict (product_name) do update set unit_price = excluded.unit_price, updated_at = now();
      end if;
    end if;
  end if;

  return jsonb_build_object('status', v_new_status, 'product', v_product,
    'added', case when p_action = 'approve' then coalesce(v_final, v_incoming) else 0 end);
end;
$$;

grant execute on function public.review_cargo_intake(text, text, text, text, numeric, numeric, numeric, text, text, text) to authenticated;

-- ============================================================
-- 3. Production request decision (Management).
-- ============================================================
create or replace function public.review_production_request(
  p_request_id text,
  p_action text,             -- 'approve' or 'reject'
  p_note text default null,
  p_approved_qty numeric default null,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.production_requests;
  v_json jsonb;
  v_requested numeric;
  v_qty numeric;
  v_product text;
  v_unit text;
begin
  if not (public.current_role() = 'management' or public.is_admin()) then
    raise exception 'Not authorized: only Management can make this decision.';
  end if;
  if p_action not in ('approve', 'reject') then raise exception 'Unknown action %.', p_action; end if;

  select * into v_row from public.production_requests where id::text = p_request_id for update;
  if not found then raise exception 'Production request % not found.', p_request_id; end if;
  if v_row.status is distinct from 'PENDING_MANAGEMENT' then
    raise exception 'This request has already been dealt with (it is now %).', v_row.status;
  end if;

  if p_action = 'reject' then
    update public.production_requests set status = 'REJECTED', rejection_reason = p_note where id::text = p_request_id;
    return jsonb_build_object('status', 'REJECTED');
  end if;

  v_json := to_jsonb(v_row);
  v_product := coalesce(nullif(trim(v_json->>'product_name'), ''), nullif(trim(v_json->>'productName'), ''), '');
  v_unit := coalesce(nullif(v_json->>'unit', ''), 'units');
  v_requested := coalesce(nullif(v_json->>'quantity', '')::numeric, 0);
  v_qty := greatest(0, coalesce(p_approved_qty, v_requested));

  update public.production_requests set status = 'TICKETS_ISSUED', quantity = v_qty where id::text = p_request_id;

  insert into public.fulfillment_tickets (production_request_id, type, details, status, created_at, updated_at)
  values (
    v_row.id, 'PRODUCTION_RELEASE',
    jsonb_build_object('productName', v_product, 'quantity', v_qty, 'requestedQuantity', v_requested, 'unit', v_json->>'unit', 'purpose', v_json->>'purpose'),
    'PENDING', now(), now());

  if v_product <> '' and v_qty > 0 then
    perform public.stock_apply(
      v_product, v_qty, 'ADD',
      'Production Request Approved: ' || coalesce(p_reference, p_request_id),
      case when v_qty <> v_requested then 'Management adjusted requested qty ' || v_requested || ' to ' || v_qty else null end,
      v_unit);
  end if;

  return jsonb_build_object('status', 'TICKETS_ISSUED', 'quantity', v_qty);
end;
$$;

grant execute on function public.review_production_request(text, text, text, numeric, text) to authenticated;

-- ============================================================
-- 4. General purchase decision (Management).
-- ============================================================
create or replace function public.review_general_purchase(
  p_purchase_id text,
  p_action text,             -- 'approve' or 'reject'
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_new text;
begin
  if not (public.current_role() = 'management' or public.is_admin()) then
    raise exception 'Not authorized: only Management can make this decision.';
  end if;
  v_new := case p_action when 'approve' then 'APPROVED' when 'reject' then 'REJECTED' else null end;
  if v_new is null then raise exception 'Unknown action %.', p_action; end if;

  select status into v_status from public.general_purchases where id::text = p_purchase_id for update;
  if not found then raise exception 'Purchase % not found.', p_purchase_id; end if;
  if v_status is distinct from 'PENDING_MANAGEMENT_APPROVAL' then
    raise exception 'This purchase has already been dealt with (it is now %).', v_status;
  end if;

  update public.general_purchases
    set status = v_new, rejection_reason = case when p_action = 'approve' then null else p_note end
    where id::text = p_purchase_id;
  return jsonb_build_object('status', v_new);
end;
$$;

grant execute on function public.review_general_purchase(text, text, text) to authenticated;

-- ============================================================
-- 5. Float request decision (Management). Approving tops up petty cash,
--    under the same lock petty cash payouts use.
-- ============================================================
create or replace function public.review_float_request(
  p_float_id text,
  p_action text,             -- 'approve' or 'reject'
  p_note text default null,
  p_approved_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.float_requests;
  v_json jsonb;
  v_amount numeric;
  v_balance numeric;
begin
  if not (public.current_role() = 'management' or public.is_admin()) then
    raise exception 'Not authorized: only Management can make this decision.';
  end if;
  if p_action not in ('approve', 'reject') then raise exception 'Unknown action %.', p_action; end if;

  select * into v_row from public.float_requests where id::text = p_float_id for update;
  if not found then raise exception 'Float request % not found.', p_float_id; end if;
  if v_row.status is distinct from 'PENDING_MANAGEMENT' then
    raise exception 'This float request has already been dealt with (it is now %).', v_row.status;
  end if;

  if p_action = 'reject' then
    update public.float_requests set status = 'REJECTED', rejection_reason = p_note, updated_at = now() where id::text = p_float_id;
    return jsonb_build_object('status', 'REJECTED');
  end if;

  v_json := to_jsonb(v_row);
  v_amount := coalesce(nullif(v_json->>'amount', '')::numeric, 0);
  if v_amount <= 0 then raise exception 'This float request has no amount.'; end if;

  update public.float_requests
    set status = 'APPROVED', approved_by = coalesce(p_approved_by, 'Management'), updated_at = now()
    where id::text = p_float_id;

  perform pg_advisory_xact_lock(hashtext('finance_petty_cash_float'));
  select balance_after into v_balance from public.finance_petty_cash order by created_at desc limit 1;
  v_balance := coalesce(v_balance, 0);

  insert into public.finance_petty_cash (date, description, amount, disbursed_to, category, type, balance_after, created_at)
  values (
    current_date,
    'Replenishment approved by Management: ' || coalesce(nullif(v_json->>'reason', ''), 'Float top-up'),
    v_amount, 'Petty Cash Float', 'Replenishment', 'replenishment', v_balance + v_amount, now());

  return jsonb_build_object('status', 'APPROVED', 'amount', v_amount, 'balance', v_balance + v_amount);
end;
$$;

grant execute on function public.review_float_request(text, text, text, text) to authenticated;

-- ============================================================
-- 6. Raw materials released to Production (Admin & Warehouse).
-- ============================================================
create or replace function public.release_raw_materials(p_ticket_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.fulfillment_tickets;
  v_item jsonb;
  v_qty numeric;
  v_req text;
begin
  if not (
    (public.current_role() in ('operations', 'admin_warehouse', 'dispatch', 'logistics') and not public.is_driver())
    or public.is_admin()
  ) then
    raise exception 'Not authorized: only Admin & Warehouse can release materials.';
  end if;

  select * into v_ticket from public.fulfillment_tickets where id::text = p_ticket_id for update;
  if not found then raise exception 'Ticket % not found.', p_ticket_id; end if;
  if v_ticket.type is distinct from 'RAW_MATERIAL_RELEASE' then
    raise exception 'This is not a raw material release ticket.';
  end if;
  if v_ticket.status is distinct from 'PENDING' then
    raise exception 'These materials have already been released (ticket is %).', v_ticket.status;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(v_ticket.details->'items', '[]'::jsonb)) loop
    v_qty := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    if coalesce(trim(v_item->>'materialName'), '') = '' or v_qty <= 0 then continue; end if;
    perform public.stock_apply(trim(v_item->>'materialName'), -v_qty, 'REMOVE',
      'Raw material released to Production (ticket ' || p_ticket_id || ')');
  end loop;

  update public.fulfillment_tickets set status = 'COMPLETED', updated_at = now() where id::text = p_ticket_id;

  v_req := v_ticket.details->>'requisitionId';
  if coalesce(v_req, '') <> '' then
    update public.material_requisitions set status = 'FULFILLED', updated_at = now() where id::text = v_req;
  end if;

  return jsonb_build_object('status', 'COMPLETED');
end;
$$;

grant execute on function public.release_raw_materials(text) to authenticated;

-- ============================================================
-- 7. Cargo correction (Management): the stock moves by exactly the
--    difference from the quantity on record at that moment.
-- ============================================================
create or replace function public.correct_cargo_intake(
  p_cargo_id text,
  p_new_quantity numeric,
  p_fields jsonb,            -- any of: country, company, weight, destination, discrepancies, unit_price
  p_reason text,
  p_performed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cargo_intake;
  v_old numeric;
  v_new numeric := greatest(0, coalesce(p_new_quantity, 0));
  v_delta numeric;
  v_product text;
begin
  if not (public.current_role() = 'management' or public.is_admin()) then
    raise exception 'Not authorized: only Management can correct cargo.';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required for a correction.'; end if;

  select * into v_row from public.cargo_intake where id::text = p_cargo_id for update;
  if not found then raise exception 'Cargo intake % not found.', p_cargo_id; end if;

  v_old := coalesce(nullif(to_jsonb(v_row)->>'quantity', '')::numeric, 0);
  v_delta := v_new - v_old;
  v_product := coalesce(nullif(trim(to_jsonb(v_row)->>'product_name'), ''), '');

  -- Only the fields the app actually sent are changed.
  update public.cargo_intake set
    country = case when p_fields ? 'country' then nullif(p_fields->>'country', '') else country end,
    company = case when p_fields ? 'company' then nullif(p_fields->>'company', '') else company end,
    quantity = v_new,
    weight = case when p_fields ? 'weight' then coalesce(nullif(p_fields->>'weight', '')::numeric, 0) else weight end,
    destination = case when p_fields ? 'destination' then nullif(p_fields->>'destination', '') else destination end,
    discrepancies = case when p_fields ? 'discrepancies' then coalesce(nullif(p_fields->>'discrepancies', ''), 'None') else discrepancies end,
    unit_price = case when p_fields ? 'unit_price' then nullif(p_fields->>'unit_price', '')::numeric else unit_price end
  where id::text = p_cargo_id;

  -- Only cargo that is already in stock moves stock.
  if v_delta <> 0 and v_product <> '' and v_row.status = 'APPROVED' then
    perform public.stock_apply(v_product, v_delta, 'CORRECTION',
      coalesce(nullif(to_jsonb(v_row)->>'goods_code', ''), p_cargo_id),
      'Correction by ' || coalesce(p_performed_by, 'Management') || ': qty ' || v_old || ' to ' || v_new || '. Reason: ' || trim(p_reason));
  end if;

  return jsonb_build_object('old_quantity', v_old, 'new_quantity', v_new, 'delta', v_delta);
end;
$$;

grant execute on function public.correct_cargo_intake(text, numeric, jsonb, text, text) to authenticated;

-- ============================================================
-- 8. General purchase quantity adjustment (stock page).
-- ============================================================
create or replace function public.adjust_general_purchase(
  p_purchase_id text,
  p_delta numeric,
  p_reason text default null,
  p_notes text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.general_purchases;
  v_json jsonb;
  v_new numeric;
begin
  if not (
    (public.current_role() in ('operations', 'admin_warehouse', 'dispatch', 'logistics', 'management') and not public.is_driver())
    or public.is_admin()
  ) then
    raise exception 'Not authorized to adjust stock.';
  end if;
  if coalesce(p_delta, 0) = 0 then raise exception 'Enter an amount to adjust by.'; end if;

  select * into v_row from public.general_purchases where id::text = p_purchase_id for update;
  if not found then raise exception 'Purchase % not found.', p_purchase_id; end if;

  v_json := to_jsonb(v_row);
  v_new := greatest(0, coalesce(nullif(v_json->>'quantity', '')::numeric, 0) + p_delta);
  update public.general_purchases set quantity = v_new where id::text = p_purchase_id;

  insert into public.stock_ledger (product_name, movement_type, quantity, reference, notes, performed_by, created_at)
  values (
    coalesce(nullif(v_json->>'item_name', ''), nullif(v_json->>'itemName', ''), 'General purchase'),
    case when p_delta > 0 then 'ADD' else 'REMOVE' end,
    abs(p_delta), coalesce(nullif(p_reason, ''), 'Manual Adjustment'), coalesce(p_notes, ''), auth.uid(), now());

  return v_new;
end;
$$;

grant execute on function public.adjust_general_purchase(text, numeric, text, text) to authenticated;

commit;
