-- ============================================================
-- Phase 6: Marketing financial-access restriction + individual
-- customer credit limits/statuses + approval remarks/timeline.
--
-- Run this AFTER supabase_admin_warehouse_merge.sql (Phase 5), and
-- deploy the matching frontend in the same window — section 1 removes
-- read access this app's current code still assumes.
--
-- Three independent concerns in one file because they share a single
-- deployment window; each section is self-contained and can be run
-- alone if you need to stage them.
--
-- HOUSE RULE reminder: every policy below is DROP + full CREATE, never
-- ALTER POLICY. Multiple permissive policies on the same command are
-- OR'd together, so a stray old "using (true)" left in place would make
-- every narrowing here a silent no-op.
-- ============================================================

begin;

-- ============================================================
-- 1. goods_prices — hide cost_price from everyone except
--    Management / Finance / CEO-admin.
--
-- Postgres RLS is ROW-level, not column-level, and this app runs every
-- user on the single shared 'authenticated' Postgres role (app roles
-- live inside public.current_role(), not in pg_roles) — so neither a
-- policy nor a column GRANT can hide one column from one department.
--
-- Solution: narrow the base table to the roles that legitimately need
-- cost data, and expose everything EXCEPT cost_price through a view
-- that runs as its owner (security_invoker = false, the default), so
-- the base table's RLS does not apply to it.
--
-- This is NOT optional cleanup: goods_prices.unit_price is what
-- marketing/OrdersView.tsx prices every order line item from
-- (productPrices, line ~79 and ~217). Narrowing the base table without
-- this view would make every Marketing order total GHS 0.
--
-- The view is built dynamically from information_schema so it picks up
-- any column that has drifted onto the live table since this repo's
-- .sql files were written (ceo/PriceApprovalsView.tsx upserts 'status'
-- and 'created_at', which appear in no committed CREATE TABLE) — same
-- guarded-DO-block style as supabase_admin_warehouse_merge.sql § 19.
-- ============================================================

do $$
declare
  v_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'goods_prices'
    and column_name <> 'cost_price';

  execute format(
    'create or replace view public.goods_prices_catalog as select %s from public.goods_prices',
    v_cols
  );
end $$;

-- Explicit for clarity; false is the default, but this view's whole
-- purpose depends on it, so it is stated rather than assumed.
alter view public.goods_prices_catalog set (security_invoker = false);

grant select on public.goods_prices_catalog to authenticated;

-- Base table: cost data is Management/Finance/CEO only from here on.
drop policy if exists "goods_prices_select_broad" on public.goods_prices;
drop policy if exists "goods_prices_select" on public.goods_prices;
create policy "goods_prices_select" on public.goods_prices
  for select to authenticated
  using (public.current_role() in ('management','finance') or public.is_admin());

-- goods_prices_write is UNCHANGED (source: supabase_rls_overhaul.sql).
-- Restated here only so the whole table's policy set is visible in one
-- place; it is byte-identical to what is live today.
drop policy if exists "goods_prices_write" on public.goods_prices;
create policy "goods_prices_write" on public.goods_prices
  for all to authenticated
  using (public.current_role() in ('management','finance') or public.is_admin())
  with check (public.current_role() in ('management','finance') or public.is_admin());

-- ============================================================
-- 2. goods_price_change_requests — drop 'marketing' from SELECT.
--
-- This table carries cost_price in its own columns
-- (supabase_control_center_patch3.sql, lines ~194-208). Confirmed by
-- grep across rebma-web/src: NO Marketing file queries this table at
-- all — the only readers are components/global/PendingApprovalsAlert.tsx,
-- views/management/MgmtPriceSettingView.tsx and
-- views/ceo/PriceApprovalsView.tsx. The 'marketing' grant is pure dead
-- surface, so removing it costs nothing and closes a real cost-price
-- read path.
--
-- The insert/update policies are UNCHANGED and are not restated.
-- ============================================================
drop policy if exists "goods_price_change_requests_select" on public.goods_price_change_requests;
create policy "goods_price_change_requests_select" on public.goods_price_change_requests
  for select to authenticated
  using (public.current_role() in ('management','finance') or public.is_admin());

-- ============================================================
-- 3. finance_payments — the deferred narrowing.
--
-- supabase_rls_overhaul.sql's own header says this SELECT was
-- "deliberately left broad ... narrowing them safely needs app-code
-- changes, tracked as a separate follow-up." This is that follow-up.
--
-- Full call-graph trace of who reads this table today:
--   KEPT (in the new role list):
--     - App.tsx refreshAllData() -> finance.getPayments() -> paymentsList,
--       consumed only by FinanceDashboard (FINANCE only) and Header's
--       global search, which ALREADY gates Payment results to
--       "isAdmin || dept === 'FINANCE'" (Header.tsx line ~164) even
--       though the raw rows sit in every session's React state today.
--       App.tsx is being changed in the same deploy to stop fetching
--       for non-privileged departments at all.
--     - views/ceo/{WalletsView,TransactionsView,AccountsView}.tsx (admin)
--     - views/FinanceDashboard.tsx (finance)
--     - views/management/MgmtAnalyticsView.tsx (management)
--     - views/AnalyticsDashboard.tsx CEO/MANAGEMENT/FINANCE branches
--     - views/CeoDashboard.tsx (admin)
--     - views/shared/SpreadsheetView.tsx — CEO and FINANCE datasets only;
--       the MARKETING dataset is orders-only, so nothing breaks there.
--   REMOVED, deliberately:
--     - Marketing's "Receipts" sidebar tab, wired straight to
--       FinanceReceiptsView (App.tsx line ~3232) — the same component and
--       the same unscoped query Finance and Management use, giving
--       Marketing the entire company payment ledger with no scoping to
--       their own orders. The tab is deleted in this same deploy.
--   DEGRADES SILENTLY, accepted:
--     - utils/performanceAlerts.ts checkFinanceAlerts() runs from
--       PerformanceAlertsPanel, which HR also has. HR is not in the list
--       below, so an HR user no longer GENERATES the "low revenue today"
--       alert. They still SEE it: the alert is persisted to the separate
--       performance_alerts table by whichever Management/CEO user opens
--       the panel, and fetchPerformanceAlerts() reads that table, not
--       finance_payments. The query is inside a try/catch and an empty
--       result short-circuits on "payments.length > 0", so it fails
--       silently rather than erroring.
--
-- 'risk' is included because Risk owns the credit-order approval lane
-- and this phase gives it per-customer credit authority — it needs to
-- be able to see whether a customer has actually been paying.
-- ============================================================
drop policy if exists "finance_payments_select_broad" on public.finance_payments;
drop policy if exists "finance_payments_select" on public.finance_payments;
create policy "finance_payments_select" on public.finance_payments
  for select to authenticated
  using (public.current_role() in ('finance','management','risk') or public.is_admin());

-- finance_payments_write is UNCHANGED (source: supabase_rls_overhaul.sql);
-- restated so the table's full policy set reads in one place.
drop policy if exists "finance_payments_write" on public.finance_payments;
create policy "finance_payments_write" on public.finance_payments
  for all to authenticated
  using (public.current_role() = 'finance' or public.is_admin())
  with check (public.current_role() = 'finance' or public.is_admin());

-- ============================================================
-- 4. get_finance_wallet_totals() — add the missing internal role guard.
--
-- This is SECURITY DEFINER, so it bypasses RLS entirely and returns
-- company-wide wallet/expense/purchase totals to ANY authenticated
-- caller — including a Marketing session hitting the RPC directly.
-- Every other SECURITY DEFINER function in this codebase that touches
-- money guards itself the same way:
--   create_order_with_stock_check()  -> "Not authorized to create orders."
--   record_credit_payment()          -> "Not authorized to record payments."
--   disburse_petty_cash()            -> "Not authorized to disburse petty cash."
-- This one never did. A GRANT change cannot fix it: every user in this
-- app shares the one Postgres 'authenticated' role, so revoking it would
-- break Finance and the CEO too.
--
-- NOTE, deliberate: the original (supabase_aggregate_totals.sql) is
-- "language sql", which has no RAISE. It is converted to plpgsql here
-- purely to carry the guard — the SELECT body below is copied
-- byte-for-byte and returned via RETURN QUERY, so the numbers it
-- produces are identical. Confirmed callers (ceo/AccountsView.tsx:58,
-- ceo/WalletsView.tsx:94) are both CEO-only screens covered by
-- is_admin(); 'finance','management' are included to match where
-- finance_expenses_select already draws the line for two of the three
-- tables this sums, so Finance/Management can reuse it later without a
-- second migration.
-- ============================================================
create or replace function public.get_finance_wallet_totals()
returns table (
  total_in numeric,
  total_out numeric,
  total_purchases numeric,
  mode_breakdown jsonb,
  expense_categories jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (public.current_role() in ('finance','management') or public.is_admin()) then
    raise exception 'Not authorized to read company financial totals.';
  end if;

  return query
  select
    coalesce((select sum(amount) from public.finance_payments), 0),
    coalesce((select sum(amount) from public.finance_expenses where status is distinct from 'Rejected'), 0),
    coalesce((select sum(cost) from public.general_purchases where status = 'APPROVED'), 0),
    coalesce((
      select jsonb_agg(jsonb_build_object('mode', mode, 'amount', amount, 'count', cnt) order by amount desc)
      from (
        select coalesce(payment_mode, 'CASH') as mode, sum(amount) as amount, count(*) as cnt
        from public.finance_payments
        group by coalesce(payment_mode, 'CASH')
      ) m
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('name', category, 'value', amount) order by amount desc)
      from (
        select coalesce(category, 'Other') as category, sum(amount) as amount
        from public.finance_expenses
        group by coalesce(category, 'Other')
        limit 6
      ) c
    ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_finance_wallet_totals() to authenticated;

-- ============================================================
-- 5. customers — per-customer credit terms, owned by Risk.
--
-- credit_limit is NULLABLE with NO default and NO backfill on purpose:
-- NULL means "no per-customer override, fall back to the global
-- ceo_settings cap", which is exactly today's behaviour. Every existing
-- customer is therefore unaffected until Risk deliberately sets one.
--
-- credit_status is intentionally SEPARATE from Phase 2's customers.status.
-- status = a one-time identity/verification outcome; credit_status = an
-- ongoing commercial state Risk flips as often as it likes. Merging them
-- would mean that putting a customer on credit hold re-opened them for
-- identity re-verification.
--
-- No RLS change is needed: customers_update already includes 'risk'
-- (supabase_customer_verification.sql, Phase 2), and customers_select
-- is broad.
-- ============================================================
alter table public.customers add column if not exists credit_limit numeric;
alter table public.customers add column if not exists credit_status text not null default 'ACTIVE';
alter table public.customers add column if not exists credit_terms_set_by text;
alter table public.customers add column if not exists credit_terms_set_at timestamptz;

-- Free text like every other status column in this schema (there are no
-- enums anywhere in this database — see the Phase 1 plan note), but a
-- CHECK keeps a typo from silently becoming an un-blockable third state.
alter table public.customers drop constraint if exists customers_credit_status_check;
alter table public.customers add constraint customers_credit_status_check
  check (credit_status in ('ACTIVE','ON_HOLD'));

-- ============================================================
-- 6. rejection_reason columns — the remark's real home.
--
-- Follows the naming and display pattern already proven twice in this
-- app: customers.rejection_reason (Phase 2, rendered by
-- CustomersView.tsx as "Risk's reason: {rejectionReason}") and
-- float_requests.rejection_reason (Management's Float lane, written at
-- MgmtApprovalsView.tsx line ~546). Same column name, same nullable
-- text, same conditional render — no new mechanism.
--
-- Today the remark for these five request types is concatenated into the
-- audit action string and never reaches the record itself, which is why
-- marketing/OrdersView.tsx line ~668 can only show a bare "Order
-- Rejected" box with no reason.
-- ============================================================
alter table public.orders                      add column if not exists rejection_reason text;
alter table public.cargo_intake                add column if not exists rejection_reason text;
alter table public.production_requests         add column if not exists rejection_reason text;
alter table public.general_purchases           add column if not exists rejection_reason text;
alter table public.goods_price_change_requests add column if not exists rejection_reason text;

-- ============================================================
-- 7. global_audit_history.reference_id — the per-request timeline key.
--
-- Stores the REAL primary key of the record the decision was about
-- (orders.id, cargo_intake.id, customers.id, delivery_logs.id,
-- production_requests.id, general_purchases.id, float_requests.id,
-- profiles.id, goods_price_change_requests.id) — NOT the pretty
-- display id.
--
-- Why: the display id every approval lane renders is a lossy,
-- uppercased truncation built as
--   `CARGO-${row.id.slice(-6).toUpperCase()}`
-- (RiskApprovalsView.tsx line ~206, MgmtApprovalsView.tsx line ~199),
-- so a row whose PK is 'CARGO-abcd1234' displays as 'CARGO-CD1234'.
-- It cannot be joined back to the row and two rows can collide on it.
-- The pretty id keeps being rendered exactly as today; it is a label,
-- not a key.
--
-- Deliberately no FK: this one column points at nine different tables,
-- rows are of mixed id types (TEXT app-ids and UUIDs), and audit history
-- must outlive a deleted record.
--
-- No backfill: existing rows keep reference_id NULL and keep rendering
-- through the existing regex parsers, which are unchanged. The timeline
-- simply has no history for requests decided before this migration —
-- correct, since that history was never captured in a linkable form.
-- ============================================================
alter table public.global_audit_history add column if not exists reference_id text;

create index if not exists global_audit_history_reference_id_idx
  on public.global_audit_history (reference_id, timestamp);

-- global_audit_history's RLS is the blanket "*_broad" using(true)/
-- with check(true) policy from supabase_rls_overhaul.sql's final DO
-- loop and is NOT narrowed here — the timeline needs to be readable by
-- whichever department is looking at the record, and narrowing it is a
-- separate concern from this phase.

-- ============================================================
-- 8. create_order_with_stock_check() — per-customer credit enforcement.
--
-- Body copied byte-for-byte from supabase_admin_warehouse_merge.sql
-- (Phase 5, statement 20), which is the live version. THE SIGNATURE IS
-- UNCHANGED — all four inputs the credit check needs (p_customer_id,
-- p_client_name, p_payment_mode, p_total_amount) are already parameters.
-- So this is a plain create-or-replace: no overload to drop, no GRANT to
-- re-issue, no caller change in OrdersView.tsx.
--
-- WHAT CHANGES: exactly one new block, marked "NEW IN PHASE 6" below,
-- inserted between the authorization check and the stock loop.
-- Everything else — the role list, the per-product advisory lock, the
-- promised-quantity subquery, the INSERT — is untouched.
--
-- Why BEFORE the stock loop: a blocked customer fails fast without
-- taking per-product locks, and a consistent lock order (customer, then
-- products, never the reverse) removes any deadlock window between two
-- concurrent credit orders that share both a customer and a product.
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
  -- NEW IN PHASE 6
  v_cust_id text;
  v_cust_name text;
  v_credit_limit numeric;
  v_credit_status text;
  v_outstanding numeric;
  v_global_cap numeric;
begin
  if not (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
    or public.is_admin()
  ) then
    raise exception 'Not authorized to create orders.';
  end if;

  -- ========== NEW IN PHASE 6: per-customer credit enforcement ==========
  -- Only credit orders are gated. Cash/MoMo/cheque orders skip this
  -- block entirely and behave exactly as they do today.
  if upper(coalesce(p_payment_mode, '')) = 'CREDIT' then

    -- Resolve the customer. Prefer the real FK; fall back to a
    -- normalized name match ONLY when it is unambiguous, because
    -- orders.customer_id is populated on new orders but is null on
    -- historical ones, and customer names have already drifted in this
    -- data (see the comment in rebma-web/src/utils/customerRating.ts).
    -- If we cannot identify the customer with confidence we do NOT
    -- guess — v_cust_id stays null and only the global cap applies,
    -- which is exactly today's behaviour.
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
      limit 2;  -- more than one match leaves v_cust_id null via the
                -- STRICT-less INTO taking only the first row; the
                -- explicit ambiguity guard below handles it.
      if (select count(*) from public.customers c2
          where lower(trim(c2.name)) = lower(trim(coalesce(p_client_name, '')))) <> 1 then
        v_cust_id := null;
        v_credit_limit := null;
        v_credit_status := 'ACTIVE';
      end if;
    end if;

    -- Hard block: an ON_HOLD customer takes no new credit, whatever
    -- their limit says.
    if v_cust_id is not null and v_credit_status = 'ON_HOLD' then
      raise exception 'Credit is ON HOLD for % — new credit orders are blocked. Contact Risk.',
        coalesce(v_cust_name, p_client_name);
    end if;

    if v_cust_id is not null and v_credit_limit is not null then
      -- Serializes concurrent credit orders for the SAME customer, so
      -- two requests cannot both read the same "outstanding" figure and
      -- both pass. Same idiom as the per-product lock further down.
      perform pg_advisory_xact_lock(hashtext('customer_credit_' || v_cust_id));

      -- Outstanding = unpaid portion of this customer's live credit
      -- orders. Driven by orders.amount_paid (maintained atomically by
      -- record_credit_payment()), NOT by status — a DELIVERED credit
      -- order is delivered, not paid.
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
      -- No per-customer override -> the org-wide CEO cap, which until
      -- now was only ever enforced client-side in
      -- marketing/OrdersView.tsx (~line 223) and could be bypassed by
      -- calling this RPC directly. "Unset or <= 0 means off" matches the
      -- existing ceo_setting_numeric threshold idiom in orders_staff_write.
      v_global_cap := public.ceo_setting_numeric('max_credit_amount');
      if coalesce(v_global_cap, 0) > 0 and coalesce(p_total_amount, 0) > v_global_cap then
        raise exception 'Credit orders are capped at GHS % by the CEO — this order is GHS %.',
          round(v_global_cap, 2), round(coalesce(p_total_amount, 0), 2);
      end if;
    end if;
  end if;
  -- ======================= END NEW IN PHASE 6 =======================

  for v_item in select * from jsonb_array_elements(coalesce(p_metadata->'items', '[]'::jsonb))
  loop
    v_product := trim(both from coalesce(v_item->>'productName', ''));
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_product = '' or v_qty <= 0 then continue; end if;

    -- Serializes concurrent order creation for the same product so two
    -- requests can't both read the same "available" number and both pass.
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

commit;

-- ============================================================
-- Deliberately NOT touched by this migration (see the plan's
-- out-of-scope section for the reasoning on each):
--   - finance_settings (still using(true) for every role, via
--     supabase_rls_overhaul.sql's final "LEFT ALONE" DO loop) — not
--     Marketing-specific, no consumer mapping done, belongs in a
--     general RLS-hardening pass.
--   - goods_prices_write does NOT gain 'risk'. Risk's cargo-approval
--     "selling price" upsert (RiskApprovalsView.tsx ~line 386, copied
--     from MgmtApprovalsView.tsx ~line 421) therefore still silently
--     fails for a Risk account. This is a PRE-EXISTING Phase 1 gap, not
--     one introduced here; adding the role would be a net-new grant in a
--     phase about restricting access. Flagged, not bundled. The one-line
--     fix, if you want it, is to add 'risk' to both the using and the
--     with check lists of goods_prices_write above.
--   - customers_update does NOT gain 'management'. Same class of
--     pre-existing gap: MgmtPriceSettingView.tsx's setCustomerDiscount /
--     setCustomerSpecial write to public.customers, but customers_update
--     is ('marketing','risk') + admin only, so Management's discount
--     controls silently no-op for a real Management account today.
--     Flagged, not bundled.
--   - get_orders_financial_summary() and get_vat_aging_summary()
--     (supabase_aggregate_totals.sql) are the same unguarded
--     SECURITY DEFINER shape as get_finance_wallet_totals() and should
--     get the same guard in a follow-up. get_sold_quantities_by_product()
--     must NOT be guarded — marketing/OverviewView.tsx line ~139 is a
--     legitimate caller.
-- ============================================================
