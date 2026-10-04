-- supabase_ceo_security.sql
--
-- Part A (CEO) of the approved plan, plus the security gaps found while
-- building it. Run AFTER supabase_registration_details.sql.
--
-- 1. Only ACTIVE accounts get database access.
--    is_admin() and current_role() decide what every signed-in person can
--    read and write, but they never checked the account's status. The
--    "not active" check only existed in the app's screens, which can be
--    bypassed by signing in to the database directly. So a suspended,
--    blocked, rejected or still-pending account kept full access for its
--    role. Now any status other than ACTIVE gets no role and no CEO
--    powers. Everyone using the app today is ACTIVE (sign-in already
--    refuses anything else), so nobody working normally is affected.
--
-- 2. Invites: the creator is recorded by the database, not the device.
--    staff_invites.created_by used to be whatever the phone or browser
--    sent, so HR could write a CEO's id there. A trigger now stamps the
--    real signed-in user, and refuses a CEO invite or an auto-approved
--    invite (which skips approval) from anyone who isn't a CEO, on insert
--    and on update.
--
-- 3. CEO email change requests (Control Center → CEO Account). Holds a
--    one-time confirmation link per request, stored only as a hash. No
--    policies: only the server (service key) can read or write it.

-- 1 ─────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(is_admin, false)
  from public.profiles
  where id = auth.uid() and upper(coalesce(status, '')) = 'ACTIVE';
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select lower(role)
  from public.profiles
  where id = auth.uid() and upper(coalesce(status, '')) = 'ACTIVE';
$$;

-- 2 ─────────────────────────────────────────────────────────────────────
create or replace function public.guard_staff_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The server (service key) has no auth.uid() and sets created_by itself.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid()::text;
  else
    new.created_by := old.created_by;
  end if;

  if (upper(coalesce(new.department, '')) = 'CEO' or coalesce(new.auto_approve, false))
     and not public.is_admin() then
    raise exception 'Only the CEO can create a CEO invite or an invite that skips approval.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_invites_guard on public.staff_invites;
create trigger staff_invites_guard
  before insert or update on public.staff_invites
  for each row execute function public.guard_staff_invites();

-- 3 ─────────────────────────────────────────────────────────────────────
create table if not exists public.ceo_email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_email text not null,
  new_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ceo_email_change_requests enable row level security;
-- Deliberately no policies: nobody but the server can touch this table.
