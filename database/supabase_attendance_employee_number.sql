-- Optional employee-number check-in — direct instruction: staff can
-- check in with their employee number instead of typing their name,
-- and it's optional (name typing still works on its own).
alter table public.attendance add column if not exists employee_number text;
