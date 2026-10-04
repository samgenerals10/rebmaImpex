-- supabase_staff_lifecycle.sql
--
-- Step 4 (terminating staff, continuing their work, leaving, moving
-- department, device enrollment). Run AFTER
-- supabase_attendance_devices_live.sql.
--
-- 1. Nothing about a person is ever deleted. Termination used to delete
--    their sign-in account, and the profile was set to be deleted along
--    with it (and the profile's attendance with that). Termination now
--    only locks sign-in, and this rule makes the database refuse to delete
--    a sign-in that still has a profile.
-- 2. Attendance rows are kept even if a profile is ever removed.
-- 3. "Who looks after this now" on orders, customers and cargo. Who
--    created them never changes; handled_by moves to the new person when
--    HR chooses "Continue previous work".
-- 4. The invite remembers HR's choice: continue the work of a terminated
--    person in the same department and role, or start new.
-- 5. A terminated person's own spreadsheets become visible to their
--    department (their tasks use the existing "shared" flag).
-- 6. device_enrollments: who is enrolled on which device, under which
--    device User ID. Recorded by a person's first accepted scan, editable
--    by HR.
-- 7. Each device keeps its last refused scan and why.
-- 8. Attendance visibility: HR, Management, Reception and the CEO see
--    everyone's; everyone else sees only their own.
-- 9. new_random_token(): secure invite links (they were guessable).
-- 10. account_deletion_requests: "Delete Account" asks, HR confirms (the
--     CEO for HR and Management staff), then the account is closed.
-- 11. department_change_requests: asking to move department; the CEO
--     approves first.
-- 12. Invites into HR are sent by the CEO only (by email). HR can't invite
--     someone into HR. Enforced here, not just by hiding a button.
-- Tables 10 and 11 are written only by the server (api/account-deletion.ts,
-- api/department-change.ts); people can read their own requests.

-- 1 ─────────────────────────────────────────────────────────────────────
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class ref on ref.oid = con.confrelid
    join pg_namespace refnsp on refnsp.oid = ref.relnamespace
    where con.contype = 'f'
      and nsp.nspname = 'public' and rel.relname = 'profiles'
      and refnsp.nspname = 'auth' and ref.relname = 'users'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

-- "not valid" only skips re-checking rows that already exist, so this
-- can't fail on old data; deleting a sign-in that still has a profile is
-- refused from now on either way.
alter table public.profiles
  add constraint profiles_id_auth_users_fkey
  foreign key (id) references auth.users(id) on delete restrict not valid;

-- 2 ─────────────────────────────────────────────────────────────────────
-- Only an existing link to profiles is replaced (with "set empty" instead
-- of "delete"); if the live table has no such link, nothing is added.
do $$
declare
  c record;
  replaced boolean := false;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class ref on ref.oid = con.confrelid
    where con.contype = 'f'
      and nsp.nspname = 'public' and rel.relname = 'attendance'
      and ref.relname = 'profiles'
  loop
    execute format('alter table public.attendance drop constraint %I', c.conname);
    replaced := true;
  end loop;
  if replaced then
    alter table public.attendance
      add constraint attendance_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- 3 ─────────────────────────────────────────────────────────────────────
alter table public.orders add column if not exists handled_by_id uuid;
alter table public.orders add column if not exists handled_by_name text;
alter table public.customers add column if not exists handled_by_id uuid;
alter table public.customers add column if not exists handled_by_name text;
alter table public.cargo_intake add column if not exists handled_by_id uuid;
alter table public.cargo_intake add column if not exists handled_by_name text;

-- 4 ─────────────────────────────────────────────────────────────────────
alter table public.staff_invites add column if not exists continue_from_id uuid;
alter table public.staff_invites add column if not exists continue_from_name text;

-- 5 ─────────────────────────────────────────────────────────────────────
alter table public.spreadsheets add column if not exists shared_with_department boolean not null default false;

-- 6 ─────────────────────────────────────────────────────────────────────
create table if not exists public.device_enrollments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.peripheral_devices(id) on delete cascade,
  person_kind text not null check (person_kind in ('app', 'no_app')),
  person_id uuid not null,
  employee_number text,
  device_user_id text not null,
  source text not null default 'hr' check (source in ('hr', 'scan')),
  enrolled_by text,
  enrolled_at timestamptz not null default now()
);
create unique index if not exists device_enrollments_device_user_key
  on public.device_enrollments (device_id, lower(device_user_id));
create unique index if not exists device_enrollments_device_person_key
  on public.device_enrollments (device_id, person_kind, person_id);
create index if not exists device_enrollments_person_idx on public.device_enrollments (person_kind, person_id);

alter table public.device_enrollments enable row level security;
drop policy if exists "device_enrollments_hr_admin" on public.device_enrollments;
create policy "device_enrollments_hr_admin" on public.device_enrollments
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

-- 7 ─────────────────────────────────────────────────────────────────────
alter table public.peripheral_devices add column if not exists last_refusal_message text;
alter table public.peripheral_devices add column if not exists last_refusal_at timestamptz;

-- 8 ─────────────────────────────────────────────────────────────────────
-- Rules are combined with OR, so one leftover "everyone can read" rule
-- would cancel this one out. Every read or all-purpose rule on attendance
-- is removed first, then only the two intended rules are recreated (the
-- write rule is unchanged from supabase_rls_overhaul.sql).
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'attendance' and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.attendance', pol.policyname);
  end loop;
end $$;

create policy "attendance_write" on public.attendance
  for all to authenticated
  using (public.current_role() in ('hr', 'receptionist') or public.is_admin())
  with check (public.current_role() in ('hr', 'receptionist') or public.is_admin());

create policy "attendance_select_scoped" on public.attendance
  for select to authenticated
  using (
    public.current_role() in ('hr', 'management', 'receptionist')
    or public.is_admin()
    or user_id = auth.uid()
    or (
      employee_number is not null
      and employee_number = (select p.employee_number from public.profiles p where p.id = auth.uid())
    )
  );

-- 9 ─────────────────────────────────────────────────────────────────────
create or replace function public.new_random_token()
returns text
language sql
volatile
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
revoke all on function public.new_random_token() from public, anon;
grant execute on function public.new_random_token() to authenticated, service_role;

-- 10 ────────────────────────────────────────────────────────────────────
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text,
  department text,
  reason text,
  confirmer text not null default 'HR' check (confirmer in ('HR', 'CEO')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists account_deletion_one_pending
  on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;
drop policy if exists "account_deletion_requests_read" on public.account_deletion_requests;
create policy "account_deletion_requests_read" on public.account_deletion_requests
  for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'hr' or public.is_admin());

-- 11 ────────────────────────────────────────────────────────────────────
create table if not exists public.department_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text,
  from_department text,
  to_department text not null,
  to_role text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists department_change_one_pending
  on public.department_change_requests (user_id) where status = 'pending';

alter table public.department_change_requests enable row level security;
drop policy if exists "department_change_requests_read" on public.department_change_requests;
create policy "department_change_requests_read" on public.department_change_requests
  for select to authenticated
  using (user_id = auth.uid() or public.current_role() = 'hr' or public.is_admin());

-- 12 ────────────────────────────────────────────────────────────────────
-- Same function as supabase_ceo_security.sql, plus the HR rule.
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

  if upper(coalesce(new.department, '')) = 'HR' and not public.is_admin() then
    raise exception 'Only the CEO can invite someone into HR.';
  end if;

  return new;
end;
$$;
