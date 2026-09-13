-- supabase_recruitment_invites.sql
--
-- Phase 8: closes the open self-registration form. From here, only CEO
-- registers outside this flow (via the existing privileged secret-URL
-- path, unchanged). Everyone else — including drivers — is entered into
-- the app by HR after an offline interview, via an invite link that
-- locks department + role. Drivers register as Risk / Driver (Dispatch
-- moves into Risk — see supabase_dispatch_to_risk.sql, Phase 9).
--
-- staff_invites has no committed CREATE TABLE anywhere in this repo's
-- tracked SQL (confirmed by grep) — its live shape is inferred from the
-- columns every call site already reads/writes (token, email, full_name,
-- department, role, auto_approve, status, expires_at, created_at). The
-- "create table if not exists" below is a no-op if it already exists;
-- the "alter table add column if not exists" statements that follow are
-- what actually apply, whether the table pre-existed or not.

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  email text,
  full_name text,
  department text,
  role text,
  auto_approve boolean default false,
  status text not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Candidate's full record, entered by HR before the link is ever sent.
alter table public.staff_invites add column if not exists phone text;
alter table public.staff_invites add column if not exists photo text; -- base64 data URL, same shape as profiles.photo
alter table public.staff_invites add column if not exists resume_url text; -- private-bucket path, staff-resumes bucket
alter table public.staff_invites add column if not exists address text;
alter table public.staff_invites add column if not exists staff_category text;
alter table public.staff_invites add column if not exists guarantor_name text;
alter table public.staff_invites add column if not exists guarantor_phone text;
alter table public.staff_invites add column if not exists guarantor_relationship text;
alter table public.staff_invites add column if not exists guarantor_id_number text;
alter table public.staff_invites add column if not exists guarantor_address text;
alter table public.staff_invites add column if not exists whatsapp_number text;
alter table public.staff_invites add column if not exists sent_via text[] default '{}';
alter table public.staff_invites add column if not exists created_by text;

-- Risk needs to read pending invites (the résumé, photo, and candidate
-- details), not just the notification text. Additive only — the
-- existing staff_invites_hr_admin_only "for all" policy already covers
-- hr/admin for every command including select; this just adds a second,
-- read-only permissive policy for risk on top of it, per Postgres's
-- normal OR'd-permissive-policies rule. Nothing existing is touched.
drop policy if exists "staff_invites_select_risk" on public.staff_invites;
create policy "staff_invites_select_risk" on public.staff_invites
  for select to authenticated
  using (public.current_role() = 'risk');

-- Configurable per-department job-role list (e.g. Risk -> Driver).
-- Replaces nothing existing — StaffView's free-text "Role" field becomes
-- a dropdown sourced from this table, filtered by department.
create table if not exists public.department_roles (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  role_name text not null,
  created_at timestamptz default now(),
  unique (department, role_name)
);
alter table public.department_roles enable row level security;

drop policy if exists "department_roles_select" on public.department_roles;
create policy "department_roles_select" on public.department_roles
  for select to authenticated
  using (true);

drop policy if exists "department_roles_write" on public.department_roles;
create policy "department_roles_write" on public.department_roles
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

-- Seed the one role already confirmed needed — Driver, under Risk
-- (Dispatch moved into Risk, see supabase_dispatch_to_risk.sql). HR adds
-- any others through the new role-management control; nothing else is
-- assumed.
insert into public.department_roles (department, role_name)
values ('risk', 'Driver')
on conflict (department, role_name) do nothing;
