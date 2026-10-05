-- ============================================================
-- Fleet Speed Limit — a Risk-configured company policy limit,
-- separate from a road's own legal speed limit (which is looked up
-- live from free public map data and shown as read-only context).
-- One singleton row ('default') holds the value, matching this app's
-- existing attendance_rules pattern for a single admin-editable setting.
-- ============================================================

create table if not exists public.fleet_speed_limit (
  id text primary key default 'default',
  max_speed_kmh integer not null default 100,
  updated_by text,
  updated_at timestamptz default now()
);

insert into public.fleet_speed_limit (id) values ('default')
  on conflict (id) do nothing;

alter table public.fleet_speed_limit enable row level security;

-- Every authenticated user can read it — both the dispatch/Risk map and
-- every driver's own app need to see this live.
drop policy if exists "fleet_speed_limit_select" on public.fleet_speed_limit;
create policy "fleet_speed_limit_select" on public.fleet_speed_limit
  for select to authenticated
  using (true);

-- Only Risk (or admin) can change it.
drop policy if exists "fleet_speed_limit_write_risk" on public.fleet_speed_limit;
create policy "fleet_speed_limit_write_risk" on public.fleet_speed_limit
  for all to authenticated
  using (public.current_role() = 'risk' or public.is_admin())
  with check (public.current_role() = 'risk' or public.is_admin());
