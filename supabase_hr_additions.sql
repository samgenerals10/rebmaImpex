-- ============================================================
-- HR Additions (Phase 3 of the Enhancement Blueprint)
--
-- Adds Employee Number, Resume/CV, Address, HR Remarks, Guarantee
-- Information, Staff Category, and a current-snapshot Performance record
-- on `profiles`, plus a new `employee_queries` table. Run this AFTER
-- supabase_risk_department.sql and supabase_customer_verification.sql.
--
-- No bucket-creation SQL is possible from a migration file — create the
-- `staff-resumes` Storage bucket by hand in the Supabase dashboard (public),
-- the same way `business-certificates`/`customer-photos` already were.
-- ============================================================

-- Employee Number — DB-generated, backfills every existing row automatically
-- (a volatile default like nextval() is evaluated once per existing row when
-- the column is added, not just applied to future inserts).
create sequence if not exists public.employee_number_seq start 1;
alter table public.profiles add column if not exists employee_number text unique
  default ('EMP-' || lpad(nextval('public.employee_number_seq')::text, 5, '0'));

-- Resume/CV, address, HR remarks
alter table public.profiles add column if not exists resume_url text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists hr_remarks text;

-- Guarantee information
alter table public.profiles add column if not exists guarantor_name text;
alter table public.profiles add column if not exists guarantor_phone text;
alter table public.profiles add column if not exists guarantor_relationship text;
alter table public.profiles add column if not exists guarantor_id_number text;
alter table public.profiles add column if not exists guarantor_address text;

-- Staff category (drives which staff need guarantee info on file)
alter table public.profiles add column if not exists staff_category text;

-- Formal performance snapshot (current only, not a versioned review history)
alter table public.profiles add column if not exists performance_task_score int;
alter table public.profiles add column if not exists performance_team_score int;
alter table public.profiles add column if not exists performance_quality_score int;
alter table public.profiles add column if not exists performance_notes text;
alter table public.profiles add column if not exists performance_reviewed_by text;
alter table public.profiles add column if not exists performance_reviewed_at timestamptz;

-- Employee Queries — new table, modeled on `feedback`'s shape plus real
-- response fields (feedback has no response/responded_by columns).
create table if not exists public.employee_queries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.profiles(id) on delete cascade,
  staff_name text,
  department text,
  subject text not null,
  body text not null,
  status text not null default 'OPEN',
  response text,
  responded_by text,
  responded_at timestamptz,
  created_at timestamptz default now()
);
alter table public.employee_queries enable row level security;

drop policy if exists "employee_queries_select" on public.employee_queries;
create policy "employee_queries_select" on public.employee_queries
  for select to authenticated
  using (staff_id = auth.uid() or public.current_role() = 'hr' or public.is_admin());

drop policy if exists "employee_queries_insert" on public.employee_queries;
create policy "employee_queries_insert" on public.employee_queries
  for insert to authenticated
  with check (staff_id = auth.uid());

-- Only HR/admin can update (respond to / resolve) a query — the submitter
-- cannot edit their own query after submitting, matching Feedback's model.
drop policy if exists "employee_queries_update_hr" on public.employee_queries;
create policy "employee_queries_update_hr" on public.employee_queries
  for update to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());
