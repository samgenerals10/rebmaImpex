-- supabase_rls_overhaul.sql
--
-- Replaces the blanket "any authenticated user can do anything" policy
-- (present on every table today) with per-role policies matching what the
-- app's UI already assumes. Run this in the Supabase SQL Editor.
--
-- Safe to re-run: every table this touches has its existing policies
-- dropped by name (whatever they're actually called, including ones added
-- directly via the Supabase dashboard) before the new ones are created, so
-- there's no risk of an old permissive policy silently coexisting with —
-- and overriding — a new restrictive one. Multiple permissive RLS policies
-- on the same command are OR'd together, so leaving a stray "USING (true)"
-- policy in place would make everything below a no-op.
--
-- Scope: this pass locks down every unauthorized write/approve/delete/
-- self-escalation path found in the full-app audit. `profiles` and
-- `finance_payments` SELECT are deliberately left broad (see the audit —
-- both are read by App.tsx's global refresh loop for every logged-in user
-- regardless of department; narrowing them safely needs app-code changes,
-- tracked as a separate follow-up).
--
-- Wrapped in a single transaction: if anything fails partway through
-- (a typo, a table that doesn't exist in your environment, etc.), the
-- whole thing rolls back and your database is left exactly as it was —
-- you won't end up with some tables mid-migration and no policies at all.

begin;

-- ============================================================
-- 1. HELPER FUNCTIONS
-- SECURITY DEFINER so these can read profiles/drivers from inside a
-- policy defined ON profiles/drivers themselves without RLS recursion.
-- ============================================================

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select lower(role) from public.profiles where id = auth.uid();
$$;

create or replace function public.current_status()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

-- Whole-row snapshot of the caller's own profile — used to pin HR-managed
-- columns (salary, department, position, etc.) to their current stored
-- value during a self-update, the same way current_role()/current_status()
-- pin role/status.
create or replace function public.current_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(is_admin, false) from public.profiles where id = auth.uid();
$$;

create or replace function public.is_driver()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.drivers where user_id = auth.uid());
$$;

create or replace function public.own_driver_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.drivers where user_id = auth.uid() limit 1;
$$;

-- ============================================================
-- 2. SELF-CLEANING: drop every existing policy on every table this
--    migration touches, then make sure RLS is actually enabled.
-- ============================================================
do $$
declare
  pol record;
  tbl text;
  targets text[] := array[
    'orders','finance_payments','finance_expenses','finance_cheques',
    'finance_petty_cash','finance_vat_periods','finance_ledger',
    'finance_report_history','invoices','transactions','recurring_payments',
    'float_requests','material_requisitions',
    'profiles','payroll_batches','payroll_entries','payroll_items',
    'leave_requests','performance_alerts','attendance',
    'customers','visitors','production_requests','production_logs',
    'wip_stock','stock','stock_ledger','categories','fulfillment_tickets',
    'cargo_intake','general_purchases','goods_prices','drivers',
    'delivery_logs','driver_locations','fuel_logs','maintenance_schedule',
    'fleet_vehicles',
    'ceo_settings','ceo_delegations','ceo_feature_exceptions',
    'staff_invites','supplier_orders','suppliers',
    'notes','tasks','chat_messages','channels','channel_members',
    'chat_message_reactions','chat_message_reads','meetings',
    'meeting_attendees','user_notifications','notifications',
    'document_templates','company_news','feedback','help_articles',
    'internal_emails','boardroom_meetings',
    'global_audit_history','departments','finance_settings',
    'proforma_invoices','supplier_order_notifications'
  ];
begin
  foreach tbl in array targets loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
      end loop;
      execute format('alter table public.%I enable row level security', tbl);
    end if;
  end loop;
end $$;

-- ============================================================
-- 3. PROFILES — the self-escalation fix
-- ============================================================

-- Everyone can see every teammate's directory info (unchanged today).
create policy "profiles_select_broad" on public.profiles
  for select to authenticated using (true);

-- Signup (unchanged today).
create policy "profiles_insert_signup" on public.profiles
  for insert to anon, authenticated with check (true);

-- Self-update, but role/is_admin/status/salary/department/position can't be
-- changed by the row's own owner — closes both the "any employee can
-- promote themselves" hole and the "any employee can give themselves a
-- raise or reassign their own department" hole.
create policy "profiles_self_update_contact_only" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and lower(role) = public.current_role()
    and is_admin = public.is_admin()
    and status = public.current_status()
    and basic_salary is not distinct from (public.current_profile()).basic_salary
    and department is not distinct from (public.current_profile()).department
    and position is not distinct from (public.current_profile()).position
    and employment_type is not distinct from (public.current_profile()).employment_type
    and start_date is not distinct from (public.current_profile()).start_date
  );

-- HR/CEO can edit anyone's role/status/etc.
create policy "profiles_hr_admin_update_any" on public.profiles
  for update to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

-- Delete: HR/CEO only (there was no delete policy at all before this).
create policy "profiles_hr_admin_delete" on public.profiles
  for delete to authenticated
  using (public.current_role() = 'hr' or public.is_admin());

-- ============================================================
-- 4. FINANCE
-- ============================================================

-- orders: multi-department workflow table. Marketing/Dispatch/Logistics
-- create and edit; only Finance/Management may push status into an
-- approval-final value; only Dispatch/Logistics may push it into a
-- delivery-final value. Drivers get their own narrow branch below.
create policy "orders_select_broad" on public.orders
  for select to authenticated using (true);

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
  );

-- A driver may update only an order tied to one of their own assigned
-- deliveries, and only into a delivery-progress status.
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
    and status in ('OUT_FOR_DELIVERY','DELIVERED')
  );

create policy "finance_payments_select_broad" on public.finance_payments
  for select to authenticated using (true); -- deferred narrowing, see header

create policy "finance_payments_write" on public.finance_payments
  for all to authenticated
  using (public.current_role() = 'finance' or public.is_admin())
  with check (public.current_role() = 'finance' or public.is_admin());

-- finance_expenses: Management's overview reads this too (confirmed).
create policy "finance_expenses_select" on public.finance_expenses
  for select to authenticated
  using (public.current_role() in ('finance','management') or public.is_admin());

create policy "finance_expenses_write" on public.finance_expenses
  for all to authenticated
  using (public.current_role() = 'finance' or public.is_admin())
  with check (
    (public.current_role() = 'finance' or public.is_admin())
    and (status not in ('Approved','Rejected') or public.current_role() = 'finance' or public.is_admin())
  );

-- Finance-only, isolated tables: nothing else in the app reads these.
do $$
declare
  t text;
begin
  foreach t in array array['finance_cheques','finance_petty_cash','finance_vat_periods','finance_ledger','finance_report_history','invoices','transactions','recurring_payments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.current_role() = ''finance'' or public.is_admin())', t || '_select_finance_only', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_role() = ''finance'' or public.is_admin()) with check (public.current_role() = ''finance'' or public.is_admin())', t || '_write_finance_only', t);
  end loop;
end $$;

create policy "float_requests_select_broad" on public.float_requests
  for select to authenticated using (true);

create policy "float_requests_write" on public.float_requests
  for all to authenticated
  using (public.current_role() in ('finance','management') or public.is_admin())
  with check (
    (public.current_role() in ('finance','management') or public.is_admin())
    and (status not in ('APPROVED','REJECTED') or public.current_role() = 'management' or public.is_admin())
  );

create policy "material_requisitions_select_broad" on public.material_requisitions
  for select to authenticated using (true);

create policy "material_requisitions_write" on public.material_requisitions
  for all to authenticated
  using (public.current_role() in ('production','operations','finance') or public.is_admin())
  with check (public.current_role() in ('production','operations','finance') or public.is_admin());

-- ============================================================
-- 5. HR
-- ============================================================

-- Isolated salary tables — only PayrollView.tsx (HR) reads these today.
create policy "payroll_batches_select" on public.payroll_batches
  for select to authenticated using (public.current_role() = 'hr' or public.is_admin());
create policy "payroll_batches_write" on public.payroll_batches
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

create policy "payroll_entries_select" on public.payroll_entries
  for select to authenticated using (public.current_role() = 'hr' or public.is_admin());
create policy "payroll_entries_write" on public.payroll_entries
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

-- payroll_items: HR sees everyone's; an employee sees only their own row
-- (PayrollPanel.tsx's "my payroll" self-service view — confirmed live
-- column is staff_id, referencing profiles.id).
create policy "payroll_items_select" on public.payroll_items
  for select to authenticated
  using (public.current_role() = 'hr' or public.is_admin() or staff_id = auth.uid());
create policy "payroll_items_write" on public.payroll_items
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

create policy "leave_requests_select_broad" on public.leave_requests
  for select to authenticated using (true);
create policy "leave_requests_write" on public.leave_requests
  for all to authenticated
  using (true)
  with check (
    status not in ('APPROVED','REJECTED')
    or public.current_role() = 'hr'
    or public.is_admin()
  );

-- performance_alerts: had no gate at all, not even in the UI.
create policy "performance_alerts_select_broad" on public.performance_alerts
  for select to authenticated using (true);
create policy "performance_alerts_write" on public.performance_alerts
  for all to authenticated
  using (public.current_role() in ('hr','management') or public.is_admin())
  with check (public.current_role() in ('hr','management') or public.is_admin());

-- attendance is staff-managed (Reception/HR log people in), not self-insert.
create policy "attendance_select_broad" on public.attendance
  for select to authenticated using (true);
create policy "attendance_write" on public.attendance
  for all to authenticated
  using (public.current_role() in ('hr','receptionist') or public.is_admin())
  with check (public.current_role() in ('hr','receptionist') or public.is_admin());

-- ============================================================
-- 6. MARKETING / RECEPTION / PRODUCTION
-- ============================================================

create policy "customers_select_broad" on public.customers
  for select to authenticated using (true);
-- Insert/update are Marketing's; delete is deliberately its own narrower
-- policy (not part of a FOR ALL grant) — a FOR ALL policy here would let
-- Marketing delete too, since multiple permissive policies for the same
-- command are OR'd together and there'd be nothing narrowing it back down.
create policy "customers_insert" on public.customers
  for insert to authenticated with check (public.current_role() = 'marketing' or public.is_admin());
create policy "customers_update" on public.customers
  for update to authenticated
  using (public.current_role() = 'marketing' or public.is_admin())
  with check (public.current_role() = 'marketing' or public.is_admin());
-- Hard-delete is CEO-only.
create policy "customers_delete_admin_only" on public.customers
  for delete to authenticated using (public.is_admin());

create policy "visitors_select_broad" on public.visitors
  for select to authenticated using (true);
create policy "visitors_write" on public.visitors
  for all to authenticated
  using (public.current_role() = 'receptionist' or public.is_admin())
  with check (public.current_role() = 'receptionist' or public.is_admin());

create policy "production_requests_select_broad" on public.production_requests
  for select to authenticated using (true);
create policy "production_requests_write" on public.production_requests
  for all to authenticated
  using (public.current_role() in ('production','management') or public.is_admin())
  with check (
    (public.current_role() in ('production','management') or public.is_admin())
    and (
      status not in ('APPROVED','REJECTED','TICKETS_ISSUED','COMPLETED')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );

create policy "production_logs_select_broad" on public.production_logs
  for select to authenticated using (true);
create policy "production_logs_write" on public.production_logs
  for all to authenticated
  using (public.current_role() = 'production' or public.is_admin())
  with check (public.current_role() = 'production' or public.is_admin());

create policy "wip_stock_select_broad" on public.wip_stock
  for select to authenticated using (true);
create policy "wip_stock_write" on public.wip_stock
  for all to authenticated
  using (public.current_role() = 'production' or public.is_admin())
  with check (public.current_role() = 'production' or public.is_admin());

create policy "stock_select_broad" on public.stock
  for select to authenticated using (true);
create policy "stock_write" on public.stock
  for all to authenticated
  using (public.current_role() in ('operations','production','management') or public.is_admin())
  with check (public.current_role() in ('operations','production','management') or public.is_admin());

create policy "stock_ledger_select_broad" on public.stock_ledger
  for select to authenticated using (true);
create policy "stock_ledger_write" on public.stock_ledger
  for all to authenticated
  using (public.current_role() in ('operations','production','management') or public.is_admin())
  with check (public.current_role() in ('operations','production','management') or public.is_admin());

create policy "categories_select_broad" on public.categories
  for select to authenticated using (true);
create policy "categories_write" on public.categories
  for all to authenticated
  using (public.current_role() in ('operations','production') or public.is_admin())
  with check (public.current_role() in ('operations','production') or public.is_admin());

create policy "fulfillment_tickets_select_broad" on public.fulfillment_tickets
  for select to authenticated using (true);
create policy "fulfillment_tickets_write" on public.fulfillment_tickets
  for all to authenticated
  using (public.current_role() in ('production','operations','management') or public.is_admin())
  with check (public.current_role() in ('production','operations','management') or public.is_admin());

-- ============================================================
-- 7. MANAGEMENT / LOGISTICS / DISPATCH
-- ============================================================

create policy "cargo_intake_select_broad" on public.cargo_intake
  for select to authenticated using (true);
create policy "cargo_intake_write" on public.cargo_intake
  for all to authenticated
  using (public.current_role() in ('operations','management') or public.is_admin())
  with check (
    (public.current_role() in ('operations','management') or public.is_admin())
    and (status not in ('APPROVED','REJECTED') or public.current_role() = 'management' or public.is_admin())
  );

create policy "general_purchases_select_broad" on public.general_purchases
  for select to authenticated using (true);
create policy "general_purchases_write" on public.general_purchases
  for all to authenticated
  using (public.current_role() in ('operations','management') or public.is_admin())
  with check (
    (public.current_role() in ('operations','management') or public.is_admin())
    and (status not in ('APPROVED','REJECTED') or public.current_role() = 'management' or public.is_admin())
  );

create policy "goods_prices_select_broad" on public.goods_prices
  for select to authenticated using (true);
create policy "goods_prices_write" on public.goods_prices
  for all to authenticated
  using (public.current_role() in ('management','finance') or public.is_admin())
  with check (public.current_role() in ('management','finance') or public.is_admin());

-- drivers roster: real Dispatch/Logistics/Management staff only — a driver
-- login shares role='dispatch' with real staff, so it must be explicitly
-- excluded here or it would inherit full roster-management rights.
create policy "drivers_select_broad" on public.drivers
  for select to authenticated using (true);
create policy "drivers_staff_write" on public.drivers
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

-- delivery_logs: staff manage the whole board; a driver may see/update only
-- their own assigned rows.
create policy "delivery_logs_staff_all" on public.delivery_logs
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

create policy "delivery_logs_driver_own_select" on public.delivery_logs
  for select to authenticated
  using (public.is_driver() and driver_id = public.own_driver_id());

create policy "delivery_logs_driver_own_update" on public.delivery_logs
  for update to authenticated
  using (public.is_driver() and driver_id = public.own_driver_id())
  with check (public.is_driver() and driver_id = public.own_driver_id());

-- driver_locations: a driver may insert only their own pings; staff read
-- everything for the live tracking map.
create policy "driver_locations_select_staff" on public.driver_locations
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

create policy "driver_locations_driver_own_select" on public.driver_locations
  for select to authenticated
  using (public.is_driver() and driver_id = (select driver_id from public.drivers where id = public.own_driver_id()));

create policy "driver_locations_driver_insert" on public.driver_locations
  for insert to authenticated
  with check (public.is_driver() and driver_id = (select driver_id from public.drivers where id = public.own_driver_id()));

create policy "driver_locations_staff_write" on public.driver_locations
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management') and not public.is_driver()) or public.is_admin());

-- fuel_logs/maintenance_schedule/fleet_vehicles are defined in
-- supabase_schema.sql but may not actually exist in every environment
-- (confirmed absent from this project's live database) — guarded so the
-- migration skips them cleanly instead of erroring if they're missing.
do $$
declare
  t text;
begin
  foreach t in array array['fuel_logs','maintenance_schedule','fleet_vehicles'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select_broad', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.current_role() = ''logistics'' or public.is_admin()) with check (public.current_role() = ''logistics'' or public.is_admin())', t || '_write_logistics', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 8. CEO
-- ============================================================

-- ceo_settings: broad read (CeoSettingsContext needs feature-flag/
-- maintenance-mode values for every session); write is CEO-only. This is
-- what closes "any account can flip maintenance mode / approval thresholds".
create policy "ceo_settings_select_broad" on public.ceo_settings
  for select to authenticated using (true);
create policy "ceo_settings_write_admin_only" on public.ceo_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ceo_delegations: CEO-only in both directions — this is what closes the
-- self-escalation hole (nobody, including via a crafted API call, can grant
-- themselves delegate access).
create policy "ceo_delegations_admin_only" on public.ceo_delegations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ceo_feature_exceptions: every department's Spreadsheets tab reads this
-- (confirmed) — broad read, CEO-only write.
create policy "ceo_feature_exceptions_select_broad" on public.ceo_feature_exceptions
  for select to authenticated using (true);
create policy "ceo_feature_exceptions_write_admin_only" on public.ceo_feature_exceptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "staff_invites_hr_admin_only" on public.staff_invites
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

create policy "suppliers_select" on public.suppliers
  for select to authenticated using (public.current_role() = 'management' or public.is_admin());
create policy "suppliers_write" on public.suppliers
  for all to authenticated
  using (public.current_role() = 'management' or public.is_admin())
  with check (public.current_role() = 'management' or public.is_admin());

-- supplier_orders: Management can manage the order, but flipping
-- payment_authorised to true (international wire payments) requires the
-- CEO specifically — this is the exact gap the audit flagged.
create policy "supplier_orders_select" on public.supplier_orders
  for select to authenticated using (public.current_role() = 'management' or public.is_admin());
create policy "supplier_orders_write" on public.supplier_orders
  for all to authenticated
  using (public.current_role() = 'management' or public.is_admin())
  with check (
    (public.current_role() = 'management' or public.is_admin())
    and (payment_authorised is distinct from true or public.is_admin())
  );

-- ============================================================
-- 9. LEFT ALONE — collaborative/low-stakes tables get RLS re-enabled with
--    a plain broad-authenticated policy (matches today's behavior; not
--    implicated in the audit, not tightened in this pass).
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'notes','tasks','chat_messages','channels','channel_members',
    'chat_message_reactions','chat_message_reads','meetings',
    'meeting_attendees','user_notifications','notifications',
    'document_templates','company_news','feedback','help_articles',
    'internal_emails','boardroom_meetings',
    'global_audit_history','departments','finance_settings',
    'proforma_invoices','supplier_order_notifications'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_broad', t);
    end if;
  end loop;
end $$;

commit;
