-- supabase_proforma_accounts_only.sql
--
-- Proforma invoices belong to the Account Department only (direct
-- instruction): the Account Department creates and changes them, the CEO
-- can only read them, nobody else sees them. Nobody deletes them from the
-- apps. ('finance' is the Account Department's internal code.)
-- Replaces the proforma rules in supabase_audit_security.sql.

begin;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'proforma_invoices' loop
    execute format('drop policy if exists %I on public.proforma_invoices', pol.policyname);
  end loop;
end $$;

alter table public.proforma_invoices enable row level security;

create policy "proforma_invoices_read" on public.proforma_invoices
  for select to authenticated
  using (public.current_role() = 'finance' or public.is_admin());

create policy "proforma_invoices_create" on public.proforma_invoices
  for insert to authenticated
  with check (public.current_role() = 'finance');

create policy "proforma_invoices_change" on public.proforma_invoices
  for update to authenticated
  using (public.current_role() = 'finance')
  with check (public.current_role() = 'finance');

commit;
