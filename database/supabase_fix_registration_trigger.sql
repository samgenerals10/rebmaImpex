-- supabase_fix_registration_trigger.sql
--
-- CRITICAL — new user registration has been broken since at least
-- 2026-07-21 (the last successful profile creation in the live DB before
-- this fix). Confirmed via Supabase Auth logs: every call to
-- auth.admin.createUser() (used by every registration path in this app —
-- self-service signup, HR-direct staff creation, driver registration,
-- CEO/HR privileged registration) fails with:
--
--   ERROR: column "is_ceo" of relation "profiles" does not exist (SQLSTATE 42703)
--
-- The live on_auth_user_created trigger (handle_new_user()) references a
-- column called is_ceo that has never existed on the live profiles table
-- (confirmed against the live OpenAPI schema — the real column is
-- is_admin, used everywhere else in this app). Every signup has been
-- silently failing at the database level ever since. This redefines the
-- trigger function using only confirmed-live column names. Run this in the
-- Supabase SQL Editor immediately — this is not part of tonight's audit
-- work, it's a live outage.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, department, status, is_admin, requires_password_reset
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Employee'),
    coalesce(new.raw_user_meta_data->>'department', 'Staff'),
    new.raw_user_meta_data->>'department',
    case
      when (new.raw_user_meta_data->>'department') in ('CEO', 'HR', 'ceo', 'hr') then 'ACTIVE'
      else 'PENDING_APPROVAL'
    end,
    coalesce(
      (new.raw_user_meta_data->>'is_admin')::boolean,
      lower(coalesce(new.raw_user_meta_data->>'department', '')) = 'ceo',
      false
    ),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger itself is unaffected by this (CREATE OR REPLACE FUNCTION updates
-- the body in place) — re-stated here only so this file is a complete,
-- standalone record of what on_auth_user_created is wired to.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
