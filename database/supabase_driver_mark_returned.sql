-- "I'm back at the company" for drivers using the app.
--
-- Drivers can't write to public.drivers (drivers_staff_write excludes
-- drivers, on purpose), so this narrow function marks only the signed-in
-- driver's own row as returned. It can't touch any other driver or any
-- other column. The fleet maps then show the truck as available, and Risk
-- gets a notice, the same as the trip link's "I'm Back at the Company".

create or replace function public.driver_mark_returned()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now  timestamptz := now();
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  update public.drivers
     set returned_at = v_now
   where user_id::text = auth.uid()::text;

  if not found then
    raise exception 'No driver profile is linked to this account.';
  end if;

  select full_name into v_name from public.drivers where user_id::text = auth.uid()::text limit 1;

  insert into public.supplier_order_notifications (message, notified_department, read)
  values (coalesce(v_name, 'A driver') || ' is back at the company and available.', 'RISK', false);

  return v_now;
end;
$$;

revoke all on function public.driver_mark_returned() from public;
grant execute on function public.driver_mark_returned() to authenticated;
