-- supabase_birthday_scheduler.sql  (optional, free)
--
-- Runs the birthday job every hour, so whatever sending time HR picks is
-- honoured. Without this, Vercel's free plan runs it once a day at 08:00
-- (Ghana time), which already covers the default 8:00 sending time.
--
-- Before running:
--   1. Supabase dashboard → Database → Extensions: switch on "pg_cron" and
--      "pg_net" (both free, built into Supabase).
--   2. Replace YOUR-APP-ADDRESS below with your live web address, the same
--      one in Control Center → API Keys → App Web Address.
--
-- Running it twice is safe: it replaces the schedule rather than adding a
-- second one. Every run is harmless: the job only ever does what is due.

select cron.unschedule('rebma-birthday-wishes')
where exists (select 1 from cron.job where jobname = 'rebma-birthday-wishes');

select cron.schedule(
  'rebma-birthday-wishes',
  '5 * * * *',
  $$ select net.http_post(
       url := 'https://YOUR-APP-ADDRESS/api/birthday-wishes',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
