-- Every error the app hits, from the server, the web app and the phone app.
-- The server writes rows here (api/_shared/errorReport.ts) and emails each
-- new error to the company address (Control Center → API Keys → Error
-- Reports Email, else the company Gmail). The same error again within an
-- hour is only logged, and emails stop for the day after 40, so a bug can
-- never flood the inbox or use up Gmail's daily limit.
--
-- Only the server (service key) writes. Only the CEO/admin can read.

create table if not exists public.app_error_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  source      text not null,          -- 'server', 'web' or 'phone'
  location    text,                   -- which screen or server route
  message     text not null,
  detail      text,                   -- stack trace or extra context
  user_id     uuid,
  user_name   text,
  page_url    text,
  fingerprint text not null,          -- same error = same fingerprint
  emailed     boolean not null default false
);

create index if not exists app_error_log_fingerprint_idx on public.app_error_log (fingerprint, created_at desc);
create index if not exists app_error_log_created_idx on public.app_error_log (created_at desc);

alter table public.app_error_log enable row level security;

drop policy if exists "app_error_log_admin_read" on public.app_error_log;
create policy "app_error_log_admin_read" on public.app_error_log
  for select to authenticated
  using (public.is_admin());
