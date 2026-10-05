-- ============================================================
-- Date of Birth — added to every registration form per direct
-- instruction ("EVERY ONE SHOULD HAVE THEIR BIRTHDATE IN THE FORMS").
-- Customers: powers the birthday SMS feature (separate, not yet built —
-- needs an SMS provider, see conversation). Staff: same field, HR's own
-- Add/Edit Staff form (both the pre-login staff_invites record and the
-- live profiles row once someone actually registers).
-- ============================================================

alter table public.customers add column if not exists date_of_birth date;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.staff_invites add column if not exists date_of_birth date;
