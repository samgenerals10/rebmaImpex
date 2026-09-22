-- supabase_driver_locations_speed_heading.sql
--
-- Adds real speed/heading to driver_locations so the fleet map can show a
-- car icon that actually faces the direction of travel and a live speed
-- reading per driver — both values come straight off the phone's GPS
-- (expo-location's LocationObject.coords already reports them), nothing
-- computed or invented. Purely additive: existing rows/readers are
-- unaffected, both columns are nullable since not every fix reports speed
-- or heading (e.g. the device is stationary, or accuracy is too low).
--
-- speed: meters/second, as reported by the device (mobile converts to
--   km/h for display).
-- heading: degrees clockwise from true north (0-360), as reported by the
--   device.

alter table public.driver_locations add column if not exists speed numeric;
alter table public.driver_locations add column if not exists heading numeric;
