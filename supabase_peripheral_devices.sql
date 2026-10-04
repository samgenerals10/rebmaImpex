-- supabase_peripheral_devices.sql
--
-- Two real, separate additions, both requested directly:
--
-- 1. non_app_staff — people who go through the interview and get hired,
--    but never use the app at all: no invite email, no login, no phone
--    account. They only need a real employee number, because that number
--    is what an attendance device (fingerprint terminal, etc.) matches
--    against. Deliberately a separate table from profiles/staff_invites,
--    not a "profiles row with no auth account" — profiles is 1:1 with a
--    real auth.users row throughout this app, and forcing that FK to
--    tolerate a null auth user would be a much larger, riskier change
--    than just giving this one real, distinct concept its own table.
--    Reuses the exact same employee_number_seq profiles already uses
--    (supabase_hr_additions.sql), so numbers never collide between an
--    app user and a non-app employee.
--
-- 2. peripheral_devices — a real device registry, generic by design
--    (device_type) so it can hold more than attendance terminals later
--    (the user explicitly said "as time goes on, other peripherals can
--    be added") without a new table per device kind. Each row is one
--    physical device an "Add Device" screen lets HR register: its own
--    connection details and its own webhook secret, so multiple devices
--    (different offices, different brands/protocols — ZKTeco, Dahua,
--    whatever comes next) don't all have to share one global secret the
--    way the original single-key Control Center field did.

create table if not exists public.non_app_staff (
  id uuid primary key default gen_random_uuid(),
  employee_number text unique not null default ('EMP-' || lpad(nextval('public.employee_number_seq')::text, 5, '0')),
  full_name text not null,
  department text,
  role text,
  phone text,
  address text,
  staff_category text,
  guarantor_name text,
  guarantor_phone text,
  guarantor_relationship text,
  guarantor_id_number text,
  guarantor_address text,
  date_of_birth date,
  status text not null default 'ACTIVE',
  created_by text,
  created_at timestamptz default now()
);
alter table public.non_app_staff enable row level security;

drop policy if exists "non_app_staff_hr_admin" on public.non_app_staff;
create policy "non_app_staff_hr_admin" on public.non_app_staff
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

create table if not exists public.peripheral_devices (
  id uuid primary key default gen_random_uuid(),
  device_type text not null default 'attendance', -- 'attendance' today; a future peripheral kind adds a new value here, not a new table
  device_name text not null,
  protocol text not null, -- 'zkteco' | 'dahua' | 'generic_tcp' — what the on-network connector program needs to know which library to use
  ip_address text,
  port integer,
  webhook_secret text not null,
  department text,
  notes text,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz default now()
);
alter table public.peripheral_devices enable row level security;

drop policy if exists "peripheral_devices_hr_admin" on public.peripheral_devices;
create policy "peripheral_devices_hr_admin" on public.peripheral_devices
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());
