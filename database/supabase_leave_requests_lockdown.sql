-- Leave requests: close the gap where any signed-in user could change,
-- approve or delete any leave request (including their own), and record
-- which staff member each request belongs to.
--
-- 1. Everyone signed in can still read leave requests (dashboards and the
--    calendar read them). Only HR and the CEO/admin can add, change,
--    approve or delete them. Every screen that writes leave requests is an
--    HR screen, so nothing that works today stops working.
-- 2. staff_id links a request to the person it is for (a profile id, or a
--    staff member without the app). The HR staff profile already looks up
--    leave by staff_id, and leave balances use it so a typed name that is
--    spelled differently still counts toward the right person. Older rows
--    keep a blank staff_id and are still matched by name.

alter table public.leave_requests add column if not exists staff_id text;

drop policy if exists "leave_requests_write" on public.leave_requests;
create policy "leave_requests_write" on public.leave_requests
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());
