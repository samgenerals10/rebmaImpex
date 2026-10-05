-- supabase_control_center.sql
--
-- Makes the CEO Control Center's delegation and approval-workflow settings
-- actually do something. Requires supabase_rls_overhaul.sql and
-- supabase_atomic_functions.sql to already be applied (reuses their
-- current_role()/is_admin() helpers and record_credit_payment function).
-- Run this in the Supabase SQL Editor.

begin;

-- ============================================================
-- Phase A.3 — Delegation enforcement
-- ============================================================

-- Maps a ceo_settings.setting_key to the Control Center section it belongs
-- to, so a delegate's grant (scoped to a whole section) can be checked
-- against an individual setting write. Anything not listed here falls
-- through to null, which has_delegated_permission() never matches — i.e.
-- new settings default to CEO-only until explicitly added below.
create or replace function public.setting_section(p_key text)
returns text
language sql
immutable
as $$
  select case p_key
    when 'app_master_switch' then 'access_control'
    when 'registrations_allowed' then 'access_control'
    when 'invitation_only' then 'access_control'
    when 'hr_can_approve_registrations' then 'access_control'
    when 'management_can_approve_registrations' then 'access_control'
    when 'ceo_must_approve_registrations' then 'access_control'

    when 'credit_sales_enabled' then 'financial_controls'
    when 'cash_payments_enabled' then 'financial_controls'
    when 'cheque_payments_enabled' then 'financial_controls'
    when 'momo_payments_enabled' then 'financial_controls'
    when 'orders_enabled' then 'financial_controls'
    when 'max_credit_amount' then 'financial_controls'
    when 'invoice_generation_enabled' then 'financial_controls'
    when 'finance_needs_ceo_cosign' then 'financial_controls'
    when 'payroll_processing_enabled' then 'financial_controls'
    when 'ceo_approval_threshold' then 'financial_controls'
    when 'management_price_setting' then 'financial_controls'
    when 'ceo_must_approve_prices' then 'financial_controls'
    when 'forms_control' then 'financial_controls'

    when 'cargo_intake_enabled' then 'operations_controls'
    when 'stock_adjustments_allowed' then 'operations_controls'
    when 'quality_check_needs_cosign' then 'operations_controls'
    when 'discrepancy_auto_alert_ceo' then 'operations_controls'

    when 'deliveries_enabled' then 'dispatch_controls'
    when 'gps_tracking_enabled' then 'dispatch_controls'
    when 'gps_ping_interval' then 'dispatch_controls'
    when 'proof_of_delivery_required' then 'dispatch_controls'
    when 'dispatch_needs_management' then 'dispatch_controls'

    when 'data_import_enabled' then 'data_controls'
    when 'data_export_enabled' then 'data_controls'
    when 'audit_log_access' then 'data_controls'
    when 'print_enabled' then 'data_controls'
    when 'report_generation_enabled' then 'data_controls'
    when 'ceo_activity_visible_to_others' then 'data_controls'

    when 'global_chat_enabled' then 'communication_controls'
    when 'department_chat_enabled' then 'communication_controls'
    when 'direct_messages_enabled' then 'communication_controls'
    when 'external_email_enabled' then 'communication_controls'
    when 'whatsapp_enabled' then 'communication_controls'
    when 'payment_reminders_enabled' then 'communication_controls'
    when 'announcements_ceo_only' then 'communication_controls'

    when 'maintenance_mode' then 'system_controls'
    when 'session_timeout_minutes' then 'system_controls'
    when 'force_2fa_management' then 'system_controls'
    when 'force_2fa_finance' then 'system_controls'
    when 'password_reset_authority' then 'system_controls'
    when 'account_deletion_authority' then 'system_controls'

    when 'ceo_cosign_credit_threshold' then 'approval_controls'
    when 'ceo_cosign_order_threshold' then 'approval_controls'
    when 'ceo_must_approve_payroll' then 'approval_controls'
    when 'ceo_must_approve_departments' then 'approval_controls'

    else null
  end;
$$;

create or replace function public.has_delegated_permission(p_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.ceo_delegations d
    join public.profiles p on lower(p.email) = lower(d.delegated_to_email)
    where p.id = auth.uid()
      and d.active
      and (d.expires_at is null or d.expires_at > now())
      and d.permissions ? p_key
  );
$$;

drop policy if exists "ceo_settings_write_admin_only" on public.ceo_settings;

create policy "ceo_settings_write_admin_or_delegate" on public.ceo_settings
  for all to authenticated
  using (public.is_admin() or public.has_delegated_permission(public.setting_section(setting_key)))
  with check (public.is_admin() or public.has_delegated_permission(public.setting_section(setting_key)));

-- ============================================================
-- Phase C — Approval Controls: cosign thresholds
-- ============================================================

-- Safe numeric read of a ceo_settings value (jsonb -> numeric), used by the
-- order-approval threshold checks below. Returns null (treated as "no
-- threshold set") rather than erroring if the stored value isn't numeric.
create or replace function public.ceo_setting_numeric(p_key text)
returns numeric
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_text text;
begin
  select setting_value #>> '{}' into v_text from public.ceo_settings where setting_key = p_key;
  if v_text is null then return null; end if;
  return v_text::numeric;
exception when others then
  return null;
end;
$$;

-- Re-issues orders_staff_write (from supabase_rls_overhaul.sql) with two
-- more conditions: an order above ceo_cosign_order_threshold — or a CREDIT
-- order above ceo_cosign_credit_threshold — can't be pushed into
-- PENDING_FINANCE/APPROVED by Finance/Management alone once that threshold
-- is set above zero; only the CEO can push it through. A threshold of 0 or
-- unset means no cap, matching the setting's default "off" state.
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
  );

-- Note: orders_driver_own_delivery (the driver's own narrow update branch)
-- is untouched — it's a separate policy from orders_staff_write and isn't
-- affected by the drop/recreate above.

-- ============================================================
-- Phase C — ceo_must_approve_payroll
-- ============================================================

-- Boolean read of a ceo_settings value, same idea as ceo_setting_numeric.
create or replace function public.ceo_setting_bool(p_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((setting_value #>> '{}')::boolean, false) from public.ceo_settings where setting_key = p_key;
$$;

-- Re-issues payroll_batches_write (from supabase_rls_overhaul.sql): HR can
-- still submit/manage batches, but once ceo_must_approve_payroll is on,
-- only the CEO can push a batch's status to PAID — this is the actual
-- enforcement behind PayrollView.tsx's "Approve & Pay" button; the UI
-- gating there is a convenience, this policy is what makes it real.
drop policy if exists "payroll_batches_write" on public.payroll_batches;

create policy "payroll_batches_write" on public.payroll_batches
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (
    (public.current_role() = 'hr' or public.is_admin())
    and (
      status is distinct from 'PAID'
      or not public.ceo_setting_bool('ceo_must_approve_payroll')
      or public.is_admin()
    )
  );

-- ============================================================
-- departments — was left fully open ("USING (true)") by the original RLS
-- overhaul under the low-stakes "left alone" tier; research this session
-- found it's actually mutated by DepartmentManager.tsx/DeptManagerView.tsx
-- with a code comment claiming "HR only" that was never actually enforced.
-- Narrowing this is independently worthwhile regardless of the full
-- ceo_must_approve_departments workflow (which needs a new pending/active
-- column and a CEO approval screen — deferred as a separate follow-up, not
-- attempted in this pass).
-- ============================================================
drop policy if exists "departments_broad" on public.departments;

create policy "departments_select_broad" on public.departments
  for select to authenticated using (true);

create policy "departments_write_hr_management" on public.departments
  for all to authenticated
  using (public.current_role() in ('hr','management') or public.is_admin())
  with check (public.current_role() in ('hr','management') or public.is_admin());

commit;
