-- supabase_ceo_controls.sql
--
-- Step 2 (CEO controls), plus the account-security gaps found while
-- building it. Run AFTER supabase_ceo_security.sql.
--
-- 1. revoke_user_sessions(): lets the server end every sign-in session an
--    account has (Kick offline, Suspend, Block, Terminate). The old Kick
--    called a Supabase function with a user ID where it needs a session
--    token, so it never signed anyone out.
--
-- 2. handle_new_user() hardened. It created a profile from whatever
--    department the new account claimed: "CEO" became an ACTIVE CEO,
--    "HR" an ACTIVE HR account. With Supabase's public sign-up open (the
--    default), anyone could create such an account using the app's public
--    key. Now every new profile starts as pending, with no CEO powers, and
--    can never claim the CEO role. The app's own registration (server only)
--    then sets the real values, so nothing legitimate changes.
--
-- 3. guard_profiles(): rules the database itself enforces on profiles for
--    anyone signed in through the app (the server is exempt):
--      * nobody can turn the CEO flag on or off;
--      * nobody can change an account's status (active, suspended, blocked,
--        and so on); that only happens through the server's approval and
--        account-control endpoints, which check who's asking;
--      * a CEO's profile can only be edited by that CEO himself;
--      * nobody can give an account the CEO role;
--      * only a CEO can move someone into or out of HR or Management;
--      * new profiles created from a device are always pending, never CEO;
--      * nobody can delete a CEO's profile.
--    Before this, HR could make themselves CEO with one database update,
--    because "HR can update any profile" outranked the self-update limits.
--
-- 4. profiles insert: only your own profile, never anonymously.
--
-- 5. ceo_removal_requests: removing a CEO needs two CEOs. One requests,
--    another (who isn't the one asking) approves. Server only.

-- 1 ─────────────────────────────────────────────────────────────────────
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = auth, public
as $$
  delete from auth.sessions where user_id = p_user_id;
$$;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- 2 ─────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dept text := nullif(trim(coalesce(new.raw_user_meta_data->>'department', '')), '');
begin
  insert into public.profiles (
    id, email, full_name, role, department, status, is_admin, requires_password_reset
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Employee'),
    case when lower(coalesce(v_dept, '')) = 'ceo' then 'Staff' else coalesce(v_dept, 'Staff') end,
    case when lower(coalesce(v_dept, '')) = 'ceo' then null else v_dept end,
    'PENDING_APPROVAL',
    false,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3 ─────────────────────────────────────────────────────────────────────
create or replace function public.request_role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
$$;

create or replace function public.guard_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.request_role();
begin
  -- The server (service key) and direct database admin work are exempt.
  if v_role not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.status := 'PENDING_APPROVAL';
    if lower(coalesce(new.role, '')) = 'ceo' then new.role := 'Staff'; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_admin then
      raise exception 'A CEO account cannot be deleted here.';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.is_admin is distinct from old.is_admin then
    raise exception 'CEO access can only be changed through the CEO approval and removal process.';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Account status can only be changed through the app''s approval and account controls.';
  end if;
  if old.is_admin and auth.uid() is distinct from old.id then
    raise exception 'A CEO''s profile can only be changed by that CEO.';
  end if;
  if lower(coalesce(new.role, '')) = 'ceo' and lower(coalesce(old.role, '')) <> 'ceo' then
    raise exception 'An account cannot be given the CEO role here.';
  end if;
  if lower(coalesce(new.role, '')) is distinct from lower(coalesce(old.role, ''))
     and (lower(coalesce(old.role, '')) in ('hr', 'management') or lower(coalesce(new.role, '')) in ('hr', 'management'))
     and not public.is_admin() then
    raise exception 'Only the CEO can move someone into or out of HR or Management.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update or delete on public.profiles
  for each row execute function public.guard_profiles();

-- 4 ─────────────────────────────────────────────────────────────────────
drop policy if exists "profiles_insert_signup" on public.profiles;
create policy "profiles_insert_signup" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- 5 ─────────────────────────────────────────────────────────────────────
create table if not exists public.ceo_removal_requests (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null,
  target_name text,
  requested_by uuid not null,
  requested_by_name text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists ceo_removal_one_pending
  on public.ceo_removal_requests (target_id) where status = 'pending';

alter table public.ceo_removal_requests enable row level security;
drop policy if exists "ceo_removal_requests_ceo_read" on public.ceo_removal_requests;
create policy "ceo_removal_requests_ceo_read" on public.ceo_removal_requests
  for select to authenticated
  using (public.is_admin());
