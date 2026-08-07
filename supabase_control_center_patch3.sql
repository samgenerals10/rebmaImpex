-- supabase_control_center_patch3.sql
--
-- Wires the remaining CEO Control Center settings found dead in the
-- follow-up audit: finance_needs_ceo_cosign, ceo_approval_threshold,
-- dispatch_needs_management, ceo_must_approve_prices, and
-- ceo_must_approve_departments. Requires supabase_rls_overhaul.sql,
-- supabase_atomic_functions.sql and supabase_control_center.sql to already
-- be applied (reuses their helper functions). Run this in the Supabase SQL
-- Editor.

begin;

-- ============================================================
-- finance_needs_ceo_cosign — blanket (non-threshold) requirement that
-- every Finance payment recording go through record_credit_payment as an
-- admin. Distinct from ceo_cosign_credit_threshold, which only kicks in
-- above an amount; this is an always-on switch for when the CEO wants
-- every credit settlement signed off regardless of size.
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

  if public.ceo_setting_bool('finance_needs_ceo_cosign') and not public.is_admin() then
    raise exception 'CEO co-signature is currently required for all Finance payment approvals.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive.';
  end if;

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
    now()
  );

  return v_order;
end;
$$;

grant execute on function public.record_credit_payment(text, numeric, date) to authenticated;

-- ============================================================
-- ceo_approval_threshold — a second, independent order-amount cap
-- alongside ceo_cosign_order_threshold (both gate the same
-- PENDING_FINANCE/APPROVED transition; whichever threshold is set lower
-- and non-zero is the one that actually binds).
-- dispatch_needs_management — driver assignments above are handled via
-- driver_assignment_approvals below, but the direct "push a delivery_log
-- straight to ASSIGNED" path also needs a guard so a dispatcher can't just
-- bypass the approval table by writing the status directly.
-- ============================================================
drop policy if exists "orders_staff_write" on public.orders;

create policy "orders_staff_write" on public.orders
  for all to authenticated
  using (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics') and not public.is_driver())
    or public.is_admin()
  )
  with check (
    (
      (public.current_role() in ('marketing','finance','management','dispatch','logistics') and not public.is_driver())
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED','REJECTED')
      or public.current_role() in ('finance','management')
      or public.is_admin()
    )
    and (
      status not in ('OUT_FOR_DELIVERY','DELIVERED')
      or public.current_role() in ('dispatch','logistics','management')
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

-- ============================================================
-- dispatch_needs_management — driver assignment approval
-- ============================================================
create table if not exists public.driver_assignment_approvals (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null references public.delivery_logs(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

alter table public.driver_assignment_approvals enable row level security;

drop policy if exists "driver_assignment_approvals_select" on public.driver_assignment_approvals;
drop policy if exists "driver_assignment_approvals_insert" on public.driver_assignment_approvals;
drop policy if exists "driver_assignment_approvals_update" on public.driver_assignment_approvals;

create policy "driver_assignment_approvals_select" on public.driver_assignment_approvals
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

create policy "driver_assignment_approvals_insert" on public.driver_assignment_approvals
  for insert to authenticated
  with check ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

create policy "driver_assignment_approvals_update" on public.driver_assignment_approvals
  for update to authenticated
  using (public.current_role() = 'management' or public.is_admin())
  with check (public.current_role() = 'management' or public.is_admin());

-- Splits delivery_logs_staff_all (from supabase_rls_overhaul.sql) into
-- select/insert/delete (unchanged) plus a restricted update: setting
-- status to ASSIGNED requires Management/admin once dispatch_needs_management
-- is on, forcing dispatch through the approval table above instead.
drop policy if exists "delivery_logs_staff_all" on public.delivery_logs;

create policy "delivery_logs_staff_select" on public.delivery_logs
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

create policy "delivery_logs_staff_insert" on public.delivery_logs
  for insert to authenticated
  with check ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

create policy "delivery_logs_staff_update" on public.delivery_logs
  for update to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );

create policy "delivery_logs_staff_delete" on public.delivery_logs
  for delete to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

-- ============================================================
-- ceo_must_approve_prices — Management's price edits go into a request
-- queue instead of the live goods_prices catalog; goods_prices itself is
-- untouched until the CEO approves, so the live catalog never shows a
-- half-approved price.
-- ============================================================
create table if not exists public.goods_price_change_requests (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text,
  unit_price numeric not null,
  cost_price numeric,
  currency text default 'GHS',
  product_image text,
  requested_by uuid references public.profiles(id),
  requested_by_name text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

alter table public.goods_price_change_requests enable row level security;

drop policy if exists "goods_price_change_requests_select" on public.goods_price_change_requests;
drop policy if exists "goods_price_change_requests_insert" on public.goods_price_change_requests;
drop policy if exists "goods_price_change_requests_update" on public.goods_price_change_requests;

create policy "goods_price_change_requests_select" on public.goods_price_change_requests
  for select to authenticated
  using (public.current_role() in ('management','finance','marketing') or public.is_admin());

create policy "goods_price_change_requests_insert" on public.goods_price_change_requests
  for insert to authenticated
  with check (public.current_role() = 'management' or public.is_admin());

create policy "goods_price_change_requests_update" on public.goods_price_change_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- ceo_must_approve_departments — new departments stay pending until the
-- CEO approves. departments had no status column at all before this.
-- ============================================================
alter table public.departments add column if not exists status text not null default 'active';

drop policy if exists "departments_write_hr_management" on public.departments;

create policy "departments_write_hr_management" on public.departments
  for all to authenticated
  using (public.current_role() in ('hr','management') or public.is_admin())
  with check (
    (public.current_role() in ('hr','management') or public.is_admin())
    and (
      status is distinct from 'active'
      or not public.ceo_setting_bool('ceo_must_approve_departments')
      or public.is_admin()
    )
  );

commit;
