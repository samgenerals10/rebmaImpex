-- supabase_secret_settings.sql
--
-- Security fix. Every API key is entered in Control Center (direct
-- instruction), which saves into public.ceo_settings. That table's read
-- policy ("ceo_settings_select_broad", supabase_rls_overhaul.sql) lets
-- EVERY signed-in staff member read every row, so any staff member could
-- read the email (Resend) key, the SMS phone password, and the attendance
-- connector and webhook secrets.
--
-- These keys are only ever read by the server (with the service key, which
-- bypasses RLS) and by the CEO in Control Center, so they become CEO-only.
-- Settings staff screens genuinely need (the map key, the barcode lookup
-- key, the app download link, every on/off switch) stay readable exactly
-- as before.
--
-- Narrowing only. To add a future server-only secret, add its key to the
-- list below and re-run this file.

create or replace function public.is_secret_setting(k text)
returns boolean
language sql
immutable
as $$
  select k in (
    'api_key_resend',
    'gmail_app_password',
    'api_key_arkesel',
    'api_key_expo_access_token',
    'api_key_push_webhook_secret',
    'sms_gateway_username',
    'sms_gateway_password',
    'api_key_connector',
    'api_key_attendance_webhook_secret'
  );
$$;

drop policy if exists "ceo_settings_select_broad" on public.ceo_settings;
create policy "ceo_settings_select_broad" on public.ceo_settings
  for select to authenticated
  using (not public.is_secret_setting(setting_key) or public.is_admin());
