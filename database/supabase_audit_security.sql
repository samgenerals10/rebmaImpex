-- supabase_audit_security.sql
--
-- Full audit, items 1 and 2.
-- 1. Activity history (global_audit_history): every new entry made from
--    the apps is stamped with the real person's id and name, so nobody
--    can post an entry under someone else's name. Server functions
--    (service key, no signed-in person) keep the name they send.
-- 2. Four tables that were open to every signed-in person:
--    proforma_invoices, spreadsheets, supplier_order_notifications and
--    the unused boardroom_meetings.
--
-- Safe to run more than once.

begin;

-- 1. Activity history ------------------------------------------------------
create or replace function public.stamp_audit_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_name text;
begin
  if v_me is null then
    return new;  -- server functions: keep what they sent
  end if;
  new.user_id := v_me;
  select full_name into v_name from public.profiles where id = v_me;
  if v_name is not null and trim(v_name) <> '' then
    new.performed_by := v_name;
  end if;
  return new;
end;
$$;

drop trigger if exists global_audit_history_stamp_author on public.global_audit_history;
create trigger global_audit_history_stamp_author
  before insert on public.global_audit_history
  for each row execute function public.stamp_audit_author();

-- Small helper: drop every policy on a table, whatever it is called.
create or replace function pg_temp.drop_policies(p_table text)
returns void
language plpgsql
as $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, p_table);
  end loop;
end;
$$;

-- 2a. Proforma invoices: the departments that quote customers ------------
select pg_temp.drop_policies('proforma_invoices');
alter table public.proforma_invoices enable row level security;

create policy "proforma_invoices_read" on public.proforma_invoices
  for select to authenticated
  using (public.current_role() in ('marketing', 'finance', 'management', 'risk') or public.is_admin());

create policy "proforma_invoices_create" on public.proforma_invoices
  for insert to authenticated
  with check (public.current_role() in ('marketing', 'finance', 'management', 'risk') or public.is_admin());

create policy "proforma_invoices_change" on public.proforma_invoices
  for update to authenticated
  using (public.current_role() in ('marketing', 'finance', 'management', 'risk') or public.is_admin())
  with check (public.current_role() in ('marketing', 'finance', 'management', 'risk') or public.is_admin());

create policy "proforma_invoices_delete" on public.proforma_invoices
  for delete to authenticated
  using (public.is_admin());

-- 2b. Spreadsheets: your own, plus ones shared with your department -------
alter table public.spreadsheets add column if not exists shared_with_department boolean not null default false;

select pg_temp.drop_policies('spreadsheets');
alter table public.spreadsheets enable row level security;

create policy "spreadsheets_read" on public.spreadsheets
  for select to authenticated
  using (
    public.is_admin()
    or created_by_id::text = auth.uid()::text
    or (shared_with_department and public.normalize_dept(department) = public.my_department())
  );

create policy "spreadsheets_create" on public.spreadsheets
  for insert to authenticated
  with check (public.is_admin() or created_by_id::text = auth.uid()::text);

create policy "spreadsheets_change" on public.spreadsheets
  for update to authenticated
  using (
    public.is_admin()
    or created_by_id::text = auth.uid()::text
    or (shared_with_department and public.normalize_dept(department) = public.my_department())
  )
  with check (
    public.is_admin()
    or created_by_id::text = auth.uid()::text
    or (shared_with_department and public.normalize_dept(department) = public.my_department())
  );

create policy "spreadsheets_delete" on public.spreadsheets
  for delete to authenticated
  using (public.is_admin() or created_by_id::text = auth.uid()::text);

-- 2c. Supplier alerts: each department sees its own ----------------------
alter table public.supplier_order_notifications add column if not exists notified_user_id uuid;

select pg_temp.drop_policies('supplier_order_notifications');
alter table public.supplier_order_notifications enable row level security;

create policy "supplier_notifications_read" on public.supplier_order_notifications
  for select to authenticated
  using (
    public.is_admin()
    or upper(coalesce(notified_department, '')) = 'ALL'
    or public.normalize_dept(notified_department) = public.my_department()
    or notified_user_id::text = auth.uid()::text
  );

-- Any active staff member can send an alert (about 36 screens do).
create policy "supplier_notifications_create" on public.supplier_order_notifications
  for insert to authenticated
  with check (public.my_department() is not null or public.is_admin());

-- Marking as read: the people the alert is for.
create policy "supplier_notifications_mark_read" on public.supplier_order_notifications
  for update to authenticated
  using (
    public.is_admin()
    or public.normalize_dept(notified_department) = public.my_department()
    or notified_user_id::text = auth.uid()::text
  )
  with check (
    public.is_admin()
    or public.normalize_dept(notified_department) = public.my_department()
    or notified_user_id::text = auth.uid()::text
  );

create policy "supplier_notifications_delete" on public.supplier_order_notifications
  for delete to authenticated
  using (public.is_admin());

-- 2d. Old Boardroom meetings table: not used by either app any more ------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'boardroom_meetings') then
    perform pg_temp.drop_policies('boardroom_meetings');
    execute 'alter table public.boardroom_meetings enable row level security';
    execute 'create policy "boardroom_meetings_admin_only" on public.boardroom_meetings for all to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

commit;
