-- ============================================================
-- Attendance Rules — HR-configurable clock-in/clock-out/late times,
-- plus a mandatory late-reason column on attendance.
--
-- Direct instruction: HR (not CEO) sets these times, so this is a new,
-- small, standalone table with its own RLS rather than reusing
-- ceo_settings (whose write policy is admin/delegate-only and would
-- block a plain HR account from saving these). One singleton row
-- ('default') holds the three times as 'HH:MM' 24-hour text, matching
-- the app's existing preference for plain text over a DB time type
-- across client/server boundaries.
-- ============================================================

create table if not exists public.attendance_rules (
  id text primary key default 'default',
  clock_in_time text not null default '08:00',
  clock_out_time text not null default '17:00',
  late_after_time text not null default '09:00',
  updated_by text,
  updated_at timestamptz default now()
);

insert into public.attendance_rules (id) values ('default')
  on conflict (id) do nothing;

alter table public.attendance_rules enable row level security;

-- Every authenticated user can read the rules (the check-in screen
-- itself needs them), only HR/admin can change them.
drop policy if exists "attendance_rules_select" on public.attendance_rules;
create policy "attendance_rules_select" on public.attendance_rules
  for select to authenticated
  using (true);

drop policy if exists "attendance_rules_write_hr" on public.attendance_rules;
create policy "attendance_rules_write_hr" on public.attendance_rules
  for all to authenticated
  using (public.current_role() in ('HR', 'hr') or public.is_admin())
  with check (public.current_role() in ('HR', 'hr') or public.is_admin());

-- A late check-in must carry a reason — the check-in screen enforces
-- this client-side (blocks submit until filled), this column is where
-- it lands so HR's own attendance list can display it.
alter table public.attendance add column if not exists late_reason text;
