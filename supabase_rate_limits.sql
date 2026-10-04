-- supabase_rate_limits.sql
--
-- Real answer to "what happens with 1 million requests in a minute" —
-- nothing stopped that before this, on any of the 12 custom endpoints in
-- api/. This is a single shared table + one atomic RPC every endpoint
-- calls as its very first line, before doing any real work.
--
-- Atomic on purpose (one UPSERT, not a read-then-write from the Vercel
-- function): a Vercel function can run on multiple instances at once, so
-- a naive "read count, check, write count+1" from application code has a
-- real race window a burst of concurrent requests would blow straight
-- through. The CASE expressions below run inside Postgres's own row lock
-- for that UPSERT, so two simultaneous calls for the same key can't both
-- read the same pre-increment count.

create table if not exists public.api_rate_limits (
  key text primary key,
  request_count integer not null default 1,
  window_start timestamptz not null default now()
);
alter table public.api_rate_limits enable row level security;

-- Deliberately no policy for 'authenticated' or 'anon' at all — this
-- table is only ever touched by the service-role key from inside a
-- Vercel function (supabaseAdmin), never by the app's own client. RLS
-- with zero policies means every non-service-role request is denied by
-- default, which is exactly the intent: nothing outside api/ should be
-- able to read or reset another caller's rate-limit counter.

create or replace function public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.api_rate_limits (key, request_count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    request_count = case
      when public.api_rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    window_start = case
      when public.api_rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
        then now()
      else public.api_rate_limits.window_start
    end
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

-- Only the service-role key (what every Vercel function in api/ uses)
-- can call this — never exposed to the app's own anon/authenticated
-- client, so a real user can't reset or inspect anyone's counter.
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
