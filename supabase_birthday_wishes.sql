-- supabase_birthday_wishes.sql  (replaces the earlier draft; safe to run
-- even if the earlier draft was run)
--
-- Birthday wishes, run by HR only (approved Part B), for staff and
-- customers. Nothing is hard-coded:
--   birthday_templates   HR writes the messages (like Document Templates):
--                        who it's for, which channels, subject, text.
--   birthday_settings    HR's auto-send switch and sending time.
--   birthday_wishes_log  What was sent to whom, when, how, and by whom.
--                        One row per person per year, so nobody is wished
--                        twice by the automatic sender.
--   birthday_notice_log  Stops HR getting the same "birthday tomorrow" /
--                        "birthday today" notification twice.
-- The CEO's master on/off switch stays in Control Center
-- (ceo_settings 'birthday_wishes_enabled').
--
-- Who can use them: HR and the CEO only. Marketing has no birthday access.

-- Earlier draft cleanup (it gave Marketing access and had fewer columns).
drop policy if exists "birthday_wishes_log_read" on public.birthday_wishes_log;
drop policy if exists "birthday_wishes_log_write" on public.birthday_wishes_log;

create table if not exists public.birthday_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience text not null default 'both' check (audience in ('staff', 'customer', 'both')),
  channels text[] not null default array['email', 'sms']::text[],
  email_subject text not null default 'Happy birthday from Rebma Impex',
  body text not null,
  is_default boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.birthday_settings (
  id text primary key default 'default',
  auto_send boolean not null default true,
  send_time text not null default '08:00' check (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.birthday_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.birthday_wishes_log (
  id uuid primary key default gen_random_uuid(),
  person_type text not null check (person_type in ('staff', 'customer')),
  person_id text not null,
  person_name text,
  wish_year int not null,
  email_sent boolean not null default false,
  sms_sent boolean not null default false,
  whatsapp_sent boolean not null default false,
  email_note text,
  sms_note text,
  sent_at timestamptz not null default now(),
  unique (person_type, person_id, wish_year)
);
alter table public.birthday_wishes_log add column if not exists template_id uuid;
alter table public.birthday_wishes_log add column if not exists message text;
alter table public.birthday_wishes_log add column if not exists sent_by text;

create table if not exists public.birthday_notice_log (
  notice_date date not null,
  kind text not null check (kind in ('tomorrow', 'today', 'no_template')),
  created_at timestamptz not null default now(),
  primary key (notice_date, kind)
);

-- Keeps the allowed kinds right even if an older copy of this table exists.
alter table public.birthday_notice_log drop constraint if exists birthday_notice_log_kind_check;
alter table public.birthday_notice_log add constraint birthday_notice_log_kind_check
  check (kind in ('tomorrow', 'today', 'no_template'));

alter table public.birthday_templates enable row level security;
alter table public.birthday_settings enable row level security;
alter table public.birthday_wishes_log enable row level security;
alter table public.birthday_notice_log enable row level security;
-- birthday_notice_log: no policies, only the server touches it.

drop policy if exists "birthday_templates_hr" on public.birthday_templates;
create policy "birthday_templates_hr" on public.birthday_templates
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

drop policy if exists "birthday_settings_hr" on public.birthday_settings;
create policy "birthday_settings_hr" on public.birthday_settings
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

drop policy if exists "birthday_wishes_log_hr" on public.birthday_wishes_log;
create policy "birthday_wishes_log_hr" on public.birthday_wishes_log
  for all to authenticated
  using (public.current_role() = 'hr' or public.is_admin())
  with check (public.current_role() = 'hr' or public.is_admin());

-- Only one default template per audience.
create unique index if not exists birthday_templates_one_default
  on public.birthday_templates (audience) where is_default;
