-- Leave allowances that HR sets: how many days per year each leave type
-- gives every employee (the same for everyone). The Leave Balances tab on
-- web and phone works out each person's used and remaining days from their
-- approved leave requests against these numbers.
--
-- A leave type with no row here has no yearly allowance, so its balance
-- shows "Not set" until HR enters one.

create table if not exists public.leave_entitlements (
  leave_type    text primary key,
  days_per_year integer not null check (days_per_year >= 0 and days_per_year <= 366),
  updated_by    text,
  updated_at    timestamptz not null default now()
);

alter table public.leave_entitlements enable row level security;

-- Everyone signed in can read the allowances (staff can see what they get).
drop policy if exists "leave_entitlements_select" on public.leave_entitlements;
create policy "leave_entitlements_select" on public.leave_entitlements
  for select to authenticated using (true);

-- Only HR and the CEO/admin can change them.
drop policy if exists "leave_entitlements_write" on public.leave_entitlements;
create policy "leave_entitlements_write" on public.leave_entitlements
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());
