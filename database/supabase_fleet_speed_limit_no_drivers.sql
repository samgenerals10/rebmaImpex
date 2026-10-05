-- supabase_fleet_speed_limit_no_drivers.sql
--
-- Security fix. Drivers are registered under Risk (role 'risk'), so the
-- old rule "Risk can change the fleet speed limit" also let a driver raise
-- the very limit their own speed is checked against. Same guard every
-- other Risk staff rule already uses: Risk staff, not drivers, or the CEO.
-- Everyone keeps read access. Safe to run more than once.

drop policy if exists "fleet_speed_limit_write_risk" on public.fleet_speed_limit;
create policy "fleet_speed_limit_write_risk" on public.fleet_speed_limit
  for all to authenticated
  using ((public.current_role() = 'risk' and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() = 'risk' and not public.is_driver()) or public.is_admin());
