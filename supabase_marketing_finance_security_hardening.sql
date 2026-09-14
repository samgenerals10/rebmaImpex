-- supabase_marketing_finance_security_hardening.sql
--
-- Closes the Marketing/Finance gaps found by this session's department
-- audit (run alongside the earlier supabase_messenger_security_hardening.sql
-- and supabase_admin_warehouse_risk_security_hardening.sql). Each numbered
-- section below corresponds to a specific finding; run this whole file as
-- one transaction after every other migration already applied.

begin;

-- ============================================================
-- 1. finance_settings — was USING(true)/CHECK(true) for every
--    authenticated user (supabase_rls_overhaul.sql's own "left alone"
--    bucket, never revisited). Both TaxVATView.tsx (web) and
--    TaxVATScreen.tsx (mobile) upsert the company's VAT rate straight
--    into this table — any authenticated account, any department, could
--    rewrite it directly today.
-- ============================================================

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'finance_settings'
  loop
    execute format('drop policy if exists %I on public.finance_settings', pol.policyname);
  end loop;
end $$;

alter table public.finance_settings enable row level security;

create policy "finance_settings_select" on public.finance_settings
  for select to authenticated
  using (true);

create policy "finance_settings_write" on public.finance_settings
  for all to authenticated
  using (public.current_role() in ('finance', 'management') or public.is_admin())
  with check (public.current_role() in ('finance', 'management') or public.is_admin());

-- ============================================================
-- 2. create_order_with_stock_check() — two real gaps in the same
--    function, fixed together since both edits touch its body:
--
--    (a) p_status was inserted verbatim. Every real caller on both
--        platforms always passes 'PENDING_RISK', but nothing enforced
--        that server-side — a direct RPC call with p_status='DELIVERED'
--        would mint a fully-closed order with no stock deduction, no
--        Risk/Management/Finance review, and no invoice, since this
--        function is SECURITY DEFINER and bypasses orders_staff_write
--        RLS and the status-transition trigger (which only fires on
--        UPDATE, never on this function's INSERT) entirely.
--
--    (b) p_total_amount was inserted verbatim, never checked against
--        the actual line items — a caller could submit any total
--        regardless of quantity × catalog price. Now recomputed
--        server-side from live public.goods_prices (this function is
--        SECURITY DEFINER, so it can read the un-masked table directly,
--        same as it already reads customers/stock) times the resolved
--        customer's real discount_percent, and rejected if the
--        submitted total is off by more than 5% / GHS 2 (whichever is
--        larger — enough slack for legitimate client-side rounding,
--        not enough to hide a materially wrong total).
--
--    Everything else in this function — the credit-limit enforcement
--    block, the per-product stock-availability loop, the final insert —
--    is copied byte-for-byte from supabase_marketing_credit_polish.sql,
--    unchanged.
-- ============================================================

create or replace function public.create_order_with_stock_check(
  p_ticket_number text,
  p_client_name text,
  p_product_name text,
  p_destination text,
  p_payment_mode text,
  p_total_amount numeric,
  p_status text,
  p_metadata jsonb,
  p_customer_id text default null,
  p_destination_lat numeric default null,
  p_destination_lng numeric default null,
  p_phone text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product text;
  v_qty numeric;
  v_promised numeric;
  v_on_hand numeric;
  v_available numeric;
  v_order public.orders;
  v_cust_id text;
  v_cust_name text;
  v_credit_limit numeric;
  v_credit_status text;
  v_outstanding numeric;
  v_global_cap numeric;
  -- NEW: total-recomputation
  v_discount_pct numeric;
  v_computed_total numeric := 0;
  v_unit_price numeric;
begin
  if not (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
    or public.is_admin()
  ) then
    raise exception 'Not authorized to create orders.';
  end if;

  -- NEW (a): the only legitimate creation status.
  if p_status is distinct from 'PENDING_RISK' then
    raise exception 'Orders may only be created with status PENDING_RISK.';
  end if;

  -- NEW (b): recompute the total from live catalog prices + the
  -- resolved customer's real discount, matching exactly how
  -- marketing/OrdersView.tsx / CreateOrderScreen.tsx price each line
  -- (unitPrice = basePrice * (1 - discountPercent/100)).
  if p_customer_id is not null then
    select discount_percent into v_discount_pct from public.customers where id = p_customer_id;
  else
    select discount_percent into v_discount_pct
    from public.customers
    where lower(trim(name)) = lower(trim(coalesce(p_client_name, '')))
    limit 1;
  end if;
  v_discount_pct := coalesce(v_discount_pct, 0);

  for v_item in select * from jsonb_array_elements(coalesce(p_metadata->'items', '[]'::jsonb))
  loop
    v_product := trim(both from coalesce(v_item->>'productName', ''));
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_product = '' or v_qty <= 0 then continue; end if;

    select unit_price into v_unit_price
    from public.goods_prices
    where lower(trim(product_name)) = lower(v_product)
    limit 1;

    v_computed_total := v_computed_total + (coalesce(v_unit_price, 0) * (1 - v_discount_pct / 100.0) * v_qty);
  end loop;

  if abs(coalesce(p_total_amount, 0) - v_computed_total) > greatest(v_computed_total * 0.05, 2) then
    raise exception 'Order total (GHS %) does not match the computed catalog price (GHS %) for these items.',
      round(coalesce(p_total_amount, 0), 2), round(v_computed_total, 2);
  end if;

  -- ========== Phase 6: per-customer credit enforcement (unchanged) ==========
  if upper(coalesce(p_payment_mode, '')) = 'CREDIT' then
    if p_customer_id is not null then
      select c.id, c.name, c.credit_limit, coalesce(c.credit_status, 'ACTIVE')
        into v_cust_id, v_cust_name, v_credit_limit, v_credit_status
      from public.customers c
      where c.id = p_customer_id;
    else
      select c.id, c.name, c.credit_limit, coalesce(c.credit_status, 'ACTIVE')
        into v_cust_id, v_cust_name, v_credit_limit, v_credit_status
      from public.customers c
      where lower(trim(c.name)) = lower(trim(coalesce(p_client_name, '')))
      limit 2;
      if (select count(*) from public.customers c2
          where lower(trim(c2.name)) = lower(trim(coalesce(p_client_name, '')))) <> 1 then
        v_cust_id := null;
        v_credit_limit := null;
        v_credit_status := 'ACTIVE';
      end if;
    end if;

    if v_cust_id is not null and v_credit_status = 'ON_HOLD' then
      raise exception 'Credit is ON HOLD for % — new credit orders are blocked. Contact Risk.',
        coalesce(v_cust_name, p_client_name);
    end if;

    if v_cust_id is not null and v_credit_limit is not null then
      perform pg_advisory_xact_lock(hashtext('customer_credit_' || v_cust_id));

      select coalesce(sum(greatest(coalesce(o.total_amount, 0) - coalesce(o.amount_paid, 0), 0)), 0)
        into v_outstanding
      from public.orders o
      where upper(coalesce(o.payment_mode, '')) = 'CREDIT'
        and o.status not in ('REJECTED', 'CANCELLED', 'RETURNED_FOR_CORRECTION')
        and (
          o.customer_id = v_cust_id
          or (o.customer_id is null
              and lower(trim(coalesce(o.client_name, ''))) = lower(trim(coalesce(v_cust_name, ''))))
        );

      if v_outstanding + coalesce(p_total_amount, 0) > v_credit_limit then
        raise exception
          'Credit limit exceeded for %: limit GHS %, currently outstanding GHS %, this order GHS % (would total GHS %).',
          coalesce(v_cust_name, p_client_name),
          round(v_credit_limit, 2),
          round(v_outstanding, 2),
          round(coalesce(p_total_amount, 0), 2),
          round(v_outstanding + coalesce(p_total_amount, 0), 2);
      end if;
    else
      v_global_cap := public.ceo_setting_numeric('max_credit_amount');
      if coalesce(v_global_cap, 0) > 0 and coalesce(p_total_amount, 0) > v_global_cap then
        raise exception 'Credit orders are capped at GHS % by the CEO — this order is GHS %.',
          round(v_global_cap, 2), round(coalesce(p_total_amount, 0), 2);
      end if;
    end if;
  end if;
  -- ======================= END Phase 6 =======================

  for v_item in select * from jsonb_array_elements(coalesce(p_metadata->'items', '[]'::jsonb))
  loop
    v_product := trim(both from coalesce(v_item->>'productName', ''));
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_product = '' or v_qty <= 0 then continue; end if;

    perform pg_advisory_xact_lock(hashtext('stock_' || lower(v_product)));

    select coalesce(quantity, 0) into v_on_hand
    from public.stock
    where lower(trim(product_name)) = lower(v_product)
    limit 1;

    select coalesce(sum((item->>'quantity')::numeric), 0) into v_promised
    from public.orders o, jsonb_array_elements(coalesce(o.metadata->'items', '[]'::jsonb)) item
    where o.status not in ('DELIVERED', 'REJECTED', 'CANCELLED')
      and lower(trim(item->>'productName')) = lower(v_product);

    v_available := coalesce(v_on_hand, 0) - coalesce(v_promised, 0);

    if v_qty > v_available then
      raise exception 'Not enough stock for %: % requested, % available.', v_product, v_qty, greatest(v_available, 0);
    end if;
  end loop;

  insert into public.orders (
    ticket_number, client_name, product_name, destination, payment_mode,
    total_amount, status, created_at, updated_at, metadata, customer_id,
    destination_lat, destination_lng, phone
  ) values (
    p_ticket_number, p_client_name, p_product_name, p_destination, p_payment_mode,
    p_total_amount, p_status, now(), now(), p_metadata, p_customer_id,
    p_destination_lat, p_destination_lng, p_phone
  )
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.create_order_with_stock_check(
  text, text, text, text, text, numeric, text, jsonb, text, numeric, numeric, text
) to authenticated;

-- ============================================================
-- 3. customers — column-scoped write protection for credit/verification
--    fields, via a BEFORE UPDATE trigger (Postgres RLS is row-level
--    only, so this is the mechanism this app already flagged as the
--    "real fix" for exactly this class of gap in Phase 6's own closing
--    comments). Marketing/Management reach this table under the
--    row-level policy below for ordinary customer-record edits; only
--    Risk (or admin) may change credit_limit/credit_status/
--    credit_terms_set_by/credit_terms_set_at/verified_by/verified_at/
--    rejection_reason/status — with one narrow, deliberate exception:
--    Marketing's own edit-save flow is allowed to flip a
--    RETURNED_FOR_CORRECTION customer back to PENDING as an automatic
--    resubmit (CustomersView.tsx's documented behavior since Phase 2),
--    since that's an ordinary part of editing a customer record, not a
--    verification decision.
-- ============================================================

create or replace function public.enforce_customers_column_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or public.current_role() = 'risk' then
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (old.status = 'RETURNED_FOR_CORRECTION' and new.status = 'PENDING') then
      raise exception 'Only Risk may change a customer''s verification status (the automatic PENDING resubmit on edit is the one exception).';
    end if;
  end if;

  if new.credit_limit is distinct from old.credit_limit
     or new.credit_status is distinct from old.credit_status
     or new.credit_terms_set_by is distinct from old.credit_terms_set_by
     or new.credit_terms_set_at is distinct from old.credit_terms_set_at
     or new.verified_by is distinct from old.verified_by
     or new.verified_at is distinct from old.verified_at
     or new.rejection_reason is distinct from old.rejection_reason
  then
    raise exception 'Only Risk may change a customer''s credit terms or verification fields.';
  end if;

  return new;
end;
$$;

drop trigger if exists customers_column_scope on public.customers;
create trigger customers_column_scope
  before update on public.customers
  for each row execute function public.enforce_customers_column_scope();

-- Widen the row-level policy to include 'management' (Phase 6's own
-- closing comment flagged MgmtPriceSettingView.tsx's setCustomerDiscount/
-- setCustomerSpecial as silently no-op-ing under the old marketing/risk-
-- only policy) — the trigger above still blocks Management from touching
-- any credit/verification column, so this only grants what Management's
-- discount/special-customer controls actually need.
drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers
  for update to authenticated
  using (public.current_role() in ('marketing', 'risk', 'management') or public.is_admin())
  with check (public.current_role() in ('marketing', 'risk', 'management') or public.is_admin());

-- ============================================================
-- 4. Three more unguarded SECURITY DEFINER reporting RPCs — same class
--    of gap get_finance_wallet_totals() already had fixed in Phase 6
--    (that migration's own closing comment named these three as needing
--    "the same guard in a follow-up" and it was never done). Bodies
--    copied byte-for-byte from supabase_aggregate_totals.sql, converted
--    from `language sql` to `language plpgsql` purely to carry the
--    guard (same conversion Phase 6 already did for wallet totals) —
--    the numbers each one returns are unchanged.
-- ============================================================

create or replace function public.get_orders_financial_summary()
returns table (
  total_revenue numeric,
  pending_orders_count bigint,
  credit_outstanding numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (public.current_role() in ('finance', 'management') or public.is_admin()) then
    raise exception 'Not authorized to read company financial totals.';
  end if;

  return query
  select
    coalesce((select sum(total_amount) from public.orders where status in ('APPROVED','DELIVERED','PROCESSING')), 0),
    coalesce((select count(*) from public.orders where status = 'PENDING_FINANCE'), 0),
    coalesce((select sum(total_amount) from public.orders where payment_mode = 'CREDIT' and status <> 'DELIVERED'), 0);
end;
$$;

grant execute on function public.get_orders_financial_summary() to authenticated;

create or replace function public.get_vat_aging_summary()
returns table (bucket text, invoices bigint, amount numeric)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (public.current_role() in ('finance', 'management') or public.is_admin()) then
    raise exception 'Not authorized to read VAT aging data.';
  end if;

  return query
  with due as (
    select
      (coalesce(total_amount, 0) - coalesce(amount_paid, 0)) as due_amount,
      extract(day from now() - coalesce(created_at, now()))::int as days_old
    from public.orders
    where (coalesce(total_amount, 0) - coalesce(amount_paid, 0)) > 0
  )
  select '0-30 days', count(*), coalesce(sum(due_amount), 0) from due where days_old <= 30
  union all
  select '31-60 days', count(*), coalesce(sum(due_amount), 0) from due where days_old > 30 and days_old <= 60
  union all
  select '61-90 days', count(*), coalesce(sum(due_amount), 0) from due where days_old > 60 and days_old <= 90
  union all
  select '90+ days', count(*), coalesce(sum(due_amount), 0) from due where days_old > 90;
end;
$$;

grant execute on function public.get_vat_aging_summary() to authenticated;

-- Headcount, not money — guarded to HR/Management/admin (its one real
-- caller, hr/OverviewView.tsx's growth chart, is HR's own screen) rather
-- than finance-only.
create or replace function public.get_yoy_headcount(p_years int[])
returns table (yr int, month int, headcount bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (public.current_role() in ('hr', 'management') or public.is_admin()) then
    raise exception 'Not authorized to read headcount data.';
  end if;

  return query
  select y, m, (
    select count(*) from public.profiles
    where created_at <= (make_date(y, m, 1) + interval '1 month - 1 day')
  )
  from unnest(p_years) as y
  cross join generate_series(1, 12) as m
  order by y, m;
end;
$$;

grant execute on function public.get_yoy_headcount(int[]) to authenticated;

-- ============================================================
-- 5. Atomic stock deduction — deductStockForOrder() on both platforms
--    was a client-side read-quantity-then-write-quantity two-step, with
--    no lock between them: two Finance sessions approving different
--    orders for the same product at the same moment could both read the
--    same starting quantity and both write a decremented value, losing
--    one decrement (an effective oversell). Moved into a SECURITY
--    DEFINER RPC using the exact same per-product
--    pg_advisory_xact_lock() idiom create_order_with_stock_check()
--    already uses — apiClient.ts's and lib/financeActions.ts's
--    deductStockForOrder() are updated in this same commit to call this
--    RPC instead of doing the two-step read/write themselves.
-- ============================================================

create or replace function public.deduct_stock_for_order(p_line_items jsonb, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product text;
  v_qty numeric;
  v_performer uuid := auth.uid();
begin
  if not (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
    or public.is_admin()
  ) then
    raise exception 'Not authorized to adjust stock.';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    v_product := trim(both from coalesce(v_item->>'productName', ''));
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_product = '' or v_qty <= 0 then continue; end if;

    perform pg_advisory_xact_lock(hashtext('stock_' || lower(v_product)));

    insert into public.stock_ledger (product_name, movement_type, quantity, reference, performed_by, created_at)
    values (v_product, 'REMOVE', v_qty, p_reference, v_performer, now());

    update public.stock
    set quantity = greatest(0, coalesce(quantity, 0) - v_qty), last_updated = now(), updated_by = v_performer
    where lower(trim(product_name)) = lower(v_product);
  end loop;
end;
$$;

grant execute on function public.deduct_stock_for_order(jsonb, text) to authenticated;

-- ============================================================
-- 6. goods_prices_write — missing 'risk' (Phase 6's own closing comment
--    flagged RiskApprovalsView.tsx's selling-price upsert during cargo
--    approval as silently no-op-ing for a real Risk account; this is
--    that fix).
-- ============================================================

drop policy if exists "goods_prices_write" on public.goods_prices;
create policy "goods_prices_write" on public.goods_prices
  for all to authenticated
  using (public.current_role() in ('management', 'finance', 'risk') or public.is_admin())
  with check (public.current_role() in ('management', 'finance', 'risk') or public.is_admin());

commit;

-- ============================================================
-- Deliberately NOT changed by this migration:
--   - customers_select_broad (USING(true) for every department) — flagged
--     by the audit as unnecessarily wide (HR/reception/production can
--     read customer PII/credit data with no legitimate need), but this
--     is the SAME broad-read convention used throughout this schema
--     (orders_select_broad, profiles, etc.), not a one-off bug specific
--     to customers. Narrowing it safely requires tracing every consumer
--     of the customers table across all 11 departments first (does any
--     department's dashboard, search, or notification flow legitimately
--     read a customer's name/phone outside Marketing/Finance/Risk/
--     Management/CEO?) — a genuinely separate, larger piece of work than
--     this migration's scope, flagged here rather than guessed at.
--   - apiClient.ts's dead marketing.createOrder / finance.evaluateOrder
--     functions are removed in the application code in this same
--     commit, not via SQL (nothing to migrate — they were never called).
-- ============================================================
