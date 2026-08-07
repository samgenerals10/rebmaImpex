-- supabase_aggregate_totals.sql
--
-- Replaces "pull a capped window of rows, sum in JS" with real server-side
-- SUM()/COUNT() over the full table, for every headline total the audit
-- found going silently wrong once real data exceeds the client-side cap
-- (finance_payments/finance_expenses/general_purchases at 500/500/200 rows
-- in AccountsView.tsx and WalletsView.tsx, the stock_ledger REMOVE-rows
-- scan in CeoDashboard.tsx that "grows forever," the unbounded orders pull
-- in TaxVATView.tsx's aging report, and the O(months x staff) client-side
-- scan behind hr/OverviewView.tsx's YoY headcount chart). Run this in the
-- Supabase SQL Editor.

begin;

-- ============================================================
-- Finance/Wallets totals — serves both AccountsView.tsx and WalletsView.tsx,
-- which compute near-identical totals + payment-mode/category breakdowns
-- from the same three tables today. total_out excludes Rejected expenses
-- and total_purchases counts only APPROVED purchases, matching
-- WalletsView's (the more correct of the two) existing filtering — this
-- also fixes a pre-existing inconsistency where AccountsView summed
-- unconditionally and could show a different "total expenses" than
-- WalletsView for the same period.
-- ============================================================
create or replace function public.get_finance_wallet_totals()
returns table (
  total_in numeric,
  total_out numeric,
  total_purchases numeric,
  mode_breakdown jsonb,
  expense_categories jsonb
)
language sql
security definer
stable
set search_path = public
as $$
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
$$;

grant execute on function public.get_finance_wallet_totals() to authenticated;

-- ============================================================
-- Orders financial summary — total revenue, pending count, credit
-- outstanding — for AccountsView.tsx.
-- ============================================================
create or replace function public.get_orders_financial_summary()
returns table (
  total_revenue numeric,
  pending_orders_count bigint,
  credit_outstanding numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select sum(total_amount) from public.orders where status in ('APPROVED','DELIVERED','PROCESSING')), 0),
    coalesce((select count(*) from public.orders where status = 'PENDING_FINANCE'), 0),
    coalesce((select sum(total_amount) from public.orders where payment_mode = 'CREDIT' and status <> 'DELIVERED'), 0);
$$;

grant execute on function public.get_orders_financial_summary() to authenticated;

-- ============================================================
-- Sold-quantity-by-product — replaces CeoDashboard.tsx's stock_ledger
-- REMOVE-rows scan, the one query in that file that genuinely grows
-- forever (stock/wip_stock/goods_prices are catalog-sized, not
-- transaction-volume-sized, so they're left as plain reads).
-- ============================================================
create or replace function public.get_sold_quantities_by_product()
returns table (product_name text, quantity_sold numeric)
language sql
security definer
stable
set search_path = public
as $$
  select sl.product_name, sum(sl.quantity)
  from public.stock_ledger sl
  where sl.movement_type = 'REMOVE'
    and sl.reference ilike '%Order Approved%'
  group by sl.product_name;
$$;

grant execute on function public.get_sold_quantities_by_product() to authenticated;

-- ============================================================
-- VAT invoice aging summary — TaxVATView.tsx's aging report, same bucket
-- boundaries (0-30/31-60/61-90/90+ days) and "amount" definition
-- (total_amount - amount_paid, only where positive) as the client code it
-- replaces, just computed over the full orders table instead of one
-- unbounded client-side pull.
-- ============================================================
create or replace function public.get_vat_aging_summary()
returns table (bucket text, invoices bigint, amount numeric)
language sql
security definer
stable
set search_path = public
as $$
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
$$;

grant execute on function public.get_vat_aging_summary() to authenticated;

-- ============================================================
-- YoY cumulative headcount by month — hr/OverviewView.tsx's growth chart.
-- One query instead of up to 24 full-table client-side scans (months x
-- years), via generate_series cross joined with a single count(*) filter.
-- ============================================================
create or replace function public.get_yoy_headcount(p_years int[])
returns table (yr int, month int, headcount bigint)
language sql
security definer
stable
set search_path = public
as $$
  select y, m, (
    select count(*) from public.profiles
    where created_at <= (make_date(y, m, 1) + interval '1 month - 1 day')
  )
  from unnest(p_years) as y
  cross join generate_series(1, 12) as m
  order by y, m;
$$;

grant execute on function public.get_yoy_headcount(int[]) to authenticated;

commit;
