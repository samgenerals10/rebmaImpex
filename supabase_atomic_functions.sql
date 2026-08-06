-- supabase_atomic_functions.sql
--
-- Fixes two money-losing bugs found in the audit, neither of which RLS
-- alone can fix since they're race conditions / missing writes, not access
-- control:
--
-- 1. Petty cash disbursement computed the new float balance from
--    client-side state before writing it back — two concurrent
--    disbursements from different tabs both read the same starting float
--    and each write an overlapping "new" balance (a lost-update / effective
--    double-spend).
-- 2. Credit payment recording never wrote the payment back to
--    orders.amount_paid at all — only local React state was updated, so
--    the real "amount paid" reverts to stale the moment the page reloads.
--
-- Both are fixed the same way: move the read-then-write into a single
-- atomic Postgres function instead of doing it in two round trips from the
-- browser. Requires supabase_rls_overhaul.sql to already be applied (reuses
-- its current_role()/is_admin() helpers).
--
-- Run this in the Supabase SQL Editor after supabase_rls_overhaul.sql.

begin;

-- ============================================================
-- 1. Petty cash: atomic float disbursement
-- ============================================================
create or replace function public.disburse_petty_cash(
  p_amount numeric,
  p_description text,
  p_disbursed_to text,
  p_category text,
  p_notes text default null
)
returns public.finance_petty_cash
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric;
  v_new_row public.finance_petty_cash;
begin
  if not (public.current_role() = 'finance' or public.is_admin()) then
    raise exception 'Not authorized to disburse petty cash.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Disbursement amount must be positive.';
  end if;

  -- Serializes every disbursement against this same lock, so two
  -- concurrent calls can never both read the same starting balance —
  -- the second one waits until the first has committed its new row.
  perform pg_advisory_xact_lock(hashtext('finance_petty_cash_float'));

  select balance_after into v_current_balance
  from public.finance_petty_cash
  order by created_at desc
  limit 1;

  v_current_balance := coalesce(v_current_balance, 0);

  if p_amount > v_current_balance then
    raise exception 'Insufficient float balance: requested %, available %', p_amount, v_current_balance;
  end if;

  insert into public.finance_petty_cash (
    description, amount, disbursed_to, category, notes,
    balance_after, type, recorded_by, timestamp
  ) values (
    p_description, p_amount, p_disbursed_to, p_category, p_notes,
    v_current_balance - p_amount, 'disbursement',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Finance'),
    now()
  )
  returning * into v_new_row;

  return v_new_row;
end;
$$;

grant execute on function public.disburse_petty_cash(numeric, text, text, text, text) to authenticated;

-- ============================================================
-- 2. Credit management: atomic payment recording
-- ============================================================
create or replace function public.record_credit_payment(
  p_order_id text,
  p_amount numeric,
  p_payment_date date default current_date
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not (public.current_role() = 'finance' or public.is_admin()) then
    raise exception 'Not authorized to record payments.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive.';
  end if;

  -- Row-level lock on this specific order — a second concurrent payment on
  -- the SAME order waits for this one to commit, so both amounts land
  -- (nothing overwrites the other). Payments on different orders don't
  -- contend at all.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found.', p_order_id;
  end if;

  update public.orders
  set amount_paid = coalesce(amount_paid, 0) + p_amount,
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.finance_payments (
    client_name, amount, payment_mode, order_ref, payment_type, recorded_by, timestamp
  ) values (
    v_order.client_name, p_amount, 'CASH', v_order.ticket_number, 'CREDIT_SETTLEMENT',
    coalesce((select full_name from public.profiles where id = auth.uid()), 'Finance'),
    p_payment_date
  );

  return v_order;
end;
$$;

grant execute on function public.record_credit_payment(text, numeric, date) to authenticated;

commit;
