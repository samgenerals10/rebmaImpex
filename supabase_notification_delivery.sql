-- supabase_notification_delivery.sql
--
-- Step 3: make every alert actually reach a person.
--
-- 1. A department alert in `notifications` (recipient_department set, no
--    recipient_id) is split into one personal row per active member of
--    that department. Before this, a department row could not be marked
--    read by anyone (the update policy is recipient-only), and the
--    department code didn't always match how staff are stored
--    (OPERATIONS vs ADMIN_WAREHOUSE). Personal rows fix both, and the
--    push relay (api/send-push.ts) then targets real people.
-- 2. Every row written to `supplier_order_notifications` (about 36
--    screens write there, nothing ever displayed it) now also lands in
--    `notifications` for that department, so it shows in the bell and
--    can be pushed. The supplier table itself is untouched, so the
--    dashboards that read it keep working.
--
-- Run before deploying the updated apps. Safe to run more than once.

begin;

-- Every column of notifications except id, in table order. Built from
-- the live table so it works whatever optional columns it has.
create or replace function public.notification_copy_columns()
returns text
language sql
stable
set search_path = public
as $$
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'notifications' and column_name <> 'id';
$$;

create or replace function public.fan_out_department_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dept text;
  v_cols text;
  v_actor uuid := auth.uid();
  v_member record;
begin
  -- Personal rows (and rows with no target at all) pass straight through.
  if new.recipient_id is not null or nullif(trim(coalesce(new.recipient_department::text, '')), '') is null then
    return new;
  end if;

  v_dept := public.normalize_dept(new.recipient_department::text);
  v_cols := public.notification_copy_columns();

  for v_member in
    select p.id
    from public.profiles p
    where upper(coalesce(p.status, '')) = 'ACTIVE'
      and (v_dept = 'ALL' or public.normalize_dept(p.role) = v_dept)
      and (v_actor is null or p.id <> v_actor)
      -- Driver phones never get office alerts.
      and not exists (select 1 from public.drivers d where d.user_id::text = p.id::text)
  loop
    execute format(
      'insert into public.notifications (%s) select %s from jsonb_populate_record(null::public.notifications, $1)',
      v_cols, v_cols
    )
    using to_jsonb(new) || jsonb_build_object('recipient_id', v_member.id, 'recipient_department', null);
  end loop;

  -- The department row itself is not stored; its personal copies are.
  return null;
end;
$$;

drop trigger if exists notifications_fan_out_department on public.notifications;
create trigger notifications_fan_out_department
  before insert on public.notifications
  for each row execute function public.fan_out_department_notification();

create or replace function public.forward_supplier_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_dept text := upper(trim(coalesce(new.notified_department, '')));
  -- Some alerts name one person (the CEO's supplier order Notify does).
  v_person text := nullif(to_jsonb(new)->>'notified_user_id', '');
begin
  if (v_dept = '' and v_person is null) or coalesce(trim(new.message), '') = '' then
    return new;
  end if;

  if v_actor is not null then
    select full_name into v_actor_name from public.profiles where id = v_actor;
  end if;

  -- Fanned out to people by notifications_fan_out_department above.
  -- 'ALL' alerts are marked broadcast: they show in everyone's bell but
  -- don't buzz every phone (api/send-push.ts skips them).
  insert into public.notifications (
    recipient_id, recipient_department, sender_id, sender_name,
    title, message, type, read, created_at
  ) values (
    v_person::uuid, case when v_person is null then v_dept else null end, v_actor, v_actor_name,
    case when v_actor_name is not null then 'Update from ' || v_actor_name else 'New update' end,
    new.message,
    case when v_person is null and v_dept = 'ALL' then 'broadcast' else 'department_alert' end,
    false, now()
  );

  return new;
exception when others then
  -- Never block the original write because of the alert copy.
  raise warning 'forward_supplier_notification failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists supplier_notifications_forward on public.supplier_order_notifications;
create trigger supplier_notifications_forward
  after insert on public.supplier_order_notifications
  for each row execute function public.forward_supplier_notification();

-- 3. Phone alert addresses (same as supabase_push_tokens.sql, included
--    here so this is the only file to run; safe if that one already ran).
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_own_rows" on public.push_tokens;
create policy "push_tokens_own_rows" on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- A phone belongs to whoever signed in on it last. Without this, a
-- shared phone would keep getting the previous person's alerts.
create or replace function public.claim_push_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens where token = new.token and user_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists push_tokens_claim on public.push_tokens;
create trigger push_tokens_claim
  before insert or update on public.push_tokens
  for each row execute function public.claim_push_token();

-- 4. Live updates for the bell and laptop pop-ups.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;
