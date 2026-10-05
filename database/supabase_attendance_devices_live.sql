  -- supabase_attendance_devices_live.sql
  --
  -- Step 3 (Add Device + live attendance). Run AFTER
  -- supabase_device_connections.sql.
  --
  -- 1. Device details are typed in, never picked from a list. The existing
  --    `protocol` column now simply holds whatever make the person typed
  --    (it was already plain text). Model and serial number are new.
  --
  -- 2. Device health. The office connector program reports, per device,
  --    whether it is live, can't reach the device, or has no driver for that
  --    make (api/connector-status.ts). The app shows this next to each
  --    device so HR can see it working without waiting for someone to scan.
  --
  -- 3. Device secrets come from the database, using gen_random_uuid()
  --    (cryptographically random, about 244 bits). They used to be made on
  --    the phone with Math.random(), which is guessable. new_device_secret()
  --    is what the Add Device form calls; the column default uses it too.
  --
  -- 4. Attendance rows from a device may belong to someone hired without an
  --    app account (non_app_staff), so user_id must allow empty. Reception's
  --    own check-in already writes rows with no user_id; this makes that
  --    explicit. Guarded so it does nothing if the column isn't there.
  --
  -- 5. Photos for staff without an app account, so the attendance table can
  --    show everyone's face, not just app users'.
  --
  -- 6. Indexes for loading a day or a date range quickly.
  
  -- 1 ─────────────────────────────────────────────────────────────────────
  alter table public.peripheral_devices add column if not exists model text;
  alter table public.peripheral_devices add column if not exists serial_number text;
  
  -- 2 ─────────────────────────────────────────────────────────────────────
  alter table public.peripheral_devices add column if not exists connector_status text;
  alter table public.peripheral_devices add column if not exists connector_message text;
  alter table public.peripheral_devices add column if not exists connector_checked_at timestamptz;
  
  alter table public.peripheral_devices drop constraint if exists peripheral_devices_connector_status_check;
  alter table public.peripheral_devices add constraint peripheral_devices_connector_status_check
    check (connector_status is null or connector_status in ('live', 'ok', 'error', 'no_driver'));
  
  -- 3 ─────────────────────────────────────────────────────────────────────
  create or replace function public.new_device_secret()
  returns text
  language sql
  volatile
  as $$
    select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  $$;
  revoke all on function public.new_device_secret() from public, anon;
  grant execute on function public.new_device_secret() to authenticated, service_role;
  
  alter table public.peripheral_devices alter column webhook_secret set default public.new_device_secret();
  
  -- 4 ─────────────────────────────────────────────────────────────────────
  do $$
  begin
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'attendance' and column_name = 'user_id' and is_nullable = 'NO'
    ) then
      alter table public.attendance alter column user_id drop not null;
    end if;
  end $$;
  
  -- 5 ─────────────────────────────────────────────────────────────────────
  alter table public.non_app_staff add column if not exists photo text;
  
  -- 6 ─────────────────────────────────────────────────────────────────────
  create index if not exists attendance_date_idx on public.attendance (date);
  create index if not exists attendance_employee_number_date_idx on public.attendance (employee_number, date);
