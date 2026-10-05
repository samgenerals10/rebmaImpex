-- supabase_control_center_patch2.sql
--
-- Fixes one bug found in a follow-up audit of supabase_control_center.sql:
-- spreadsheets_enabled (Section 9 of the Control Center) was left out of
-- setting_section()'s mapping. Per that function's own comment, anything
-- not listed falls through to null, which has_delegated_permission() never
-- matches — so a delegate granted any permission section (including "Data
-- Controls", the section Spreadsheets logically belongs to) could never
-- actually toggle it; only the CEO account itself could. This adds the
-- missing mapping so delegation works for it like every other setting.
-- Run this in the Supabase SQL Editor.

begin;

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
    when 'spreadsheets_enabled' then 'data_controls'

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

commit;
