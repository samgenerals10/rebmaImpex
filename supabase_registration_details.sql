-- supabase_registration_details.sql
--
-- Step 1 of the registration rework:
--   * The person chooses their own password when they register.
--   * The device they registered from, their location (GPS, or an
--     approximate one from their internet connection), and their network
--     address are recorded for the CEO to review before approving.
--   * A registration that isn't approved within 12 hours expires, and HR
--     can resend a fresh link.
--
-- registered_at goes on profiles because HR's screens need it to show
-- "Expired". The device, location and network details go in their own
-- table that only a CEO can read: profiles are readable by staff, and a
-- new hire's location must not be.
--
-- Additive only. Nothing already run changes.

alter table public.profiles add column if not exists registered_at timestamptz;

create table if not exists public.staff_registration_details (
  user_id uuid primary key,
  invite_id text,
  registered_at timestamptz not null default now(),
  device jsonb,            -- platform, OS and version, model or browser, app version
  location jsonb,          -- GPS: latitude, longitude, accuracy, address. Null if refused.
  network_location jsonb,  -- approximate city, region, country from the internet connection
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.staff_registration_details enable row level security;

-- CEO (admin) only. Written by the registration API with the service key,
-- which bypasses RLS, so no insert policy is needed for anyone.
drop policy if exists "staff_registration_details_admin_read" on public.staff_registration_details;
create policy "staff_registration_details_admin_read" on public.staff_registration_details
  for select to authenticated
  using (public.is_admin());
