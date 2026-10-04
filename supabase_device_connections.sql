-- supabase_device_connections.sql
--
-- Turns peripheral_devices (supabase_peripheral_devices.sql) into a real
-- "add any device" registry, per direct instruction: devices are NOT
-- hard-coded; the Add Device page must handle any device, whether it
-- connects by API or by SDK.
--
--   connection_type = 'sdk'  The on-site connector program talks to the
--                            device on the office network using the
--                            vendor's SDK/protocol (ZKTeco today).
--   connection_type = 'api'  api_mode = 'push': the device (or its vendor
--                            cloud) sends each scan straight to our
--                            webhook URL. No connector needed.
--                            api_mode = 'pull': the connector polls a JSON
--                            HTTP API the device/vendor exposes.
--
-- field_map tells the webhook where to find the employee number, time and
-- event in whatever JSON a given device sends, so a new brand doesn't need
-- a code change as long as it can send or serve JSON.
--
-- Run AFTER supabase_peripheral_devices.sql.

alter table public.peripheral_devices add column if not exists connection_type text not null default 'sdk';
alter table public.peripheral_devices add column if not exists api_mode text;
alter table public.peripheral_devices add column if not exists api_url text;
alter table public.peripheral_devices add column if not exists auth_username text;
alter table public.peripheral_devices add column if not exists auth_password text;
alter table public.peripheral_devices add column if not exists api_token text;
alter table public.peripheral_devices add column if not exists field_map jsonb not null
  default '{"employeeNumber":"employeeNumber","timestamp":"timestamp","event":"event"}'::jsonb;
alter table public.peripheral_devices add column if not exists last_seen_at timestamptz;

alter table public.peripheral_devices drop constraint if exists peripheral_devices_connection_type_check;
alter table public.peripheral_devices add constraint peripheral_devices_connection_type_check
  check (connection_type in ('sdk', 'api'));

alter table public.peripheral_devices drop constraint if exists peripheral_devices_api_mode_check;
alter table public.peripheral_devices add constraint peripheral_devices_api_mode_check
  check (api_mode is null or api_mode in ('push', 'pull'));

-- Device names are how the webhook and the connector find a device's own
-- secret, so two devices can't share one.
create unique index if not exists peripheral_devices_type_name_key
  on public.peripheral_devices (device_type, lower(device_name));

-- New staff are approved by the CEO only. This row is what both the web
-- and mobile Control Center toggles read; api/approve-user.ts also
-- defaults to CEO-only if the row is ever missing.
insert into public.ceo_settings (setting_key, setting_value, updated_at)
values ('ceo_must_approve_registrations', 'true', now())
on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_at = now();
