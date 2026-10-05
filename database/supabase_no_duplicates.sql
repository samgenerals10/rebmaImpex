-- supabase_no_duplicates.sql
--
-- Step 2 of the audit fixes: no duplicates.
--
--   1. Running numbers made by the database, restarting each year:
--        order tickets      TKT-2026-000123
--        receipts           RCP-2026-000123
--        production reqs    REQ-2026-000123
--      and visitor badges per day (V-001, V-002 ...). Before, these were
--      random or counted by the app, so they could repeat (and a repeated
--      order ticket made the order fail).
--   2. A one-time key on new orders, payments and emails: if the same
--      submission reaches the database twice (a double tap, or a retry
--      after a dropped connection), the second one is refused.
--   3. Customers: a phone number or Ghana Card number that already
--      belongs to a customer can't be registered again. The message names
--      the existing customer.
--   4. Attendance: one check-in per person per day.
--   5. Payroll: a batch's total and staff count are always worked out by
--      the database from its pay lines, so two HR users adding staff at
--      the same time can't leave a wrong total.
--
-- Existing records are not changed. Run this BEFORE deploying the
-- updated apps. Safe to run more than once.

begin;

-- ============================================================
-- 1. Running numbers
-- ============================================================
create table if not exists public.doc_counters (
  prefix text not null,
  scope text not null,          -- the year, or the day for visitor badges
  last_value bigint not null default 0,
  primary key (prefix, scope)
);
alter table public.doc_counters enable row level security;
-- No policies: only the functions below use it.

-- The next number for a prefix and scope. The row lock on the counter
-- means two people can never get the same number.
create or replace function public.next_doc_value(p_prefix text, p_scope text)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.doc_counters (prefix, scope, last_value)
  values (p_prefix, p_scope, 1)
  on conflict (prefix, scope) do update set last_value = public.doc_counters.last_value + 1
  returning last_value;
$$;
revoke all on function public.next_doc_value(text, text) from public, anon, authenticated;

create or replace function public.next_yearly_number(p_prefix text)
returns text
language sql
security definer
set search_path = public
as $$
  select p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(public.next_doc_value(p_prefix, to_char(now(), 'YYYY'))::text, 6, '0');
$$;
revoke all on function public.next_yearly_number(text) from public, anon, authenticated;

-- ============================================================
-- 2. Orders: ticket number + one-time submission key
-- ============================================================
create or replace function public.prepare_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := nullif(new.metadata->>'clientRequestId', '');
  v_existing text;
begin
  if v_key is not null then
    perform pg_advisory_xact_lock(hashtext('order_key_' || v_key));
    select coalesce(ticket_number, id) into v_existing from public.orders where metadata->>'clientRequestId' = v_key limit 1;
    if v_existing is not null then
      raise exception 'This order was already submitted (ticket %). It was not saved twice.', v_existing;
    end if;
  end if;
  new.ticket_number := public.next_yearly_number('TKT');
  return new;
end;
$$;

drop trigger if exists orders_prepare_new on public.orders;
create trigger orders_prepare_new
  before insert on public.orders
  for each row execute function public.prepare_new_order();

create unique index if not exists orders_client_request_id_key
  on public.orders ((metadata->>'clientRequestId'))
  where metadata->>'clientRequestId' is not null;

-- ============================================================
-- 3. Payments: receipt number + one-time submission key
-- ============================================================
alter table public.finance_payments add column if not exists receipt_number text;
alter table public.finance_payments add column if not exists client_request_id text;

create or replace function public.prepare_new_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(new.client_request_id, '') is not null then
    perform pg_advisory_xact_lock(hashtext('payment_key_' || new.client_request_id));
    if exists (select 1 from public.finance_payments where client_request_id = new.client_request_id) then
      raise exception 'This payment was already recorded. It was not saved twice.';
    end if;
  end if;
  new.receipt_number := public.next_yearly_number('RCP');
  return new;
end;
$$;

drop trigger if exists finance_payments_prepare_new on public.finance_payments;
create trigger finance_payments_prepare_new
  before insert on public.finance_payments
  for each row execute function public.prepare_new_payment();

create unique index if not exists finance_payments_client_request_id_key
  on public.finance_payments (client_request_id) where client_request_id is not null;
-- Only new-style numbers are checked (older random ones may already repeat).
create unique index if not exists finance_payments_receipt_number_key
  on public.finance_payments (receipt_number) where receipt_number ~ '^RCP-[0-9]{4}-[0-9]{6}$';

-- ============================================================
-- 4. Production requests: request number
-- ============================================================
create or replace function public.prepare_new_production_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.request_number := public.next_yearly_number('REQ');
  return new;
end;
$$;

drop trigger if exists production_requests_prepare_new on public.production_requests;
create trigger production_requests_prepare_new
  before insert on public.production_requests
  for each row execute function public.prepare_new_production_request();

-- ============================================================
-- 5. Visitors: badge number, restarting each day
-- ============================================================
create or replace function public.prepare_new_visitor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day text := to_char(coalesce(new.check_in_time, now()), 'YYYY-MM-DD');
begin
  new.badge_number := 'V-' || lpad(public.next_doc_value('V', v_day)::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists visitors_prepare_new on public.visitors;
create trigger visitors_prepare_new
  before insert on public.visitors
  for each row execute function public.prepare_new_visitor();

-- ============================================================
-- 6. Emails: one-time submission key
-- ============================================================
alter table public.internal_emails add column if not exists client_request_id text;

create or replace function public.check_email_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(new.client_request_id, '') is not null then
    perform pg_advisory_xact_lock(hashtext('email_key_' || new.client_request_id));
    if exists (select 1 from public.internal_emails where client_request_id = new.client_request_id) then
      raise exception 'This email was already sent. It was not sent twice.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists internal_emails_check_key on public.internal_emails;
create trigger internal_emails_check_key
  before insert on public.internal_emails
  for each row execute function public.check_email_key();

create unique index if not exists internal_emails_client_request_id_key
  on public.internal_emails (client_request_id) where client_request_id is not null;

-- ============================================================
-- 7. Customers: no second customer with the same phone or Ghana Card
-- ============================================================
-- 024 123 4567, +233 24 123 4567 and 0241234567 are the same number.
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 12 and left(d, 3) = '233' then d := '0' || substr(d, 4); end if;
  if length(d) = 9 then d := '0' || d; end if;
  return nullif(d, '');
end;
$$;

-- GHA-123456789-0 and gha1234567890 are the same card.
create or replace function public.normalize_card(p text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function public.check_customer_duplicate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_phone(new.phone);
  v_card text := public.normalize_card(new.ghana_card_id);
  v_match record;
begin
  -- Edits that don't touch the phone or card are left alone.
  if tg_op = 'UPDATE'
     and public.normalize_phone(old.phone) is not distinct from v_phone
     and public.normalize_card(old.ghana_card_id) is not distinct from v_card then
    return new;
  end if;

  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtext('customer_phone_' || v_phone));
    select id, name into v_match from public.customers
      where public.normalize_phone(phone) = v_phone and id is distinct from new.id limit 1;
    if found then
      raise exception 'This phone number already belongs to customer % (%). Use that customer instead.', v_match.name, v_match.id;
    end if;
  end if;

  if v_card is not null then
    perform pg_advisory_xact_lock(hashtext('customer_card_' || v_card));
    select id, name into v_match from public.customers
      where public.normalize_card(ghana_card_id) = v_card and id is distinct from new.id limit 1;
    if found then
      raise exception 'This Ghana Card number already belongs to customer % (%). Use that customer instead.', v_match.name, v_match.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_check_duplicate on public.customers;
create trigger customers_check_duplicate
  before insert or update on public.customers
  for each row execute function public.check_customer_duplicate();

-- Lets the apps check before saving and offer to open the existing
-- customer, using exactly the same matching as the rule above.
create or replace function public.find_customer_duplicate(p_phone text, p_card text, p_exclude_id text default null)
returns table (id text, name text, matched_on text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id::text, c.name, 'phone'::text
  from public.customers c
  where public.normalize_phone(p_phone) is not null
    and public.normalize_phone(c.phone) = public.normalize_phone(p_phone)
    and c.id::text is distinct from p_exclude_id
  union all
  select c.id::text, c.name, 'card'::text
  from public.customers c
  where public.normalize_card(p_card) is not null
    and public.normalize_card(c.ghana_card_id) = public.normalize_card(p_card)
    and c.id::text is distinct from p_exclude_id
  limit 1;
$$;
grant execute on function public.find_customer_duplicate(text, text, text) to authenticated;

create index if not exists customers_normalized_phone_idx on public.customers (public.normalize_phone(phone));
create index if not exists customers_normalized_card_idx on public.customers (public.normalize_card(ghana_card_id));

-- ============================================================
-- 8. Attendance: one check-in per person per day
-- ============================================================
create or replace function public.check_one_checkin_per_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_json jsonb := to_jsonb(new);
  v_user text := nullif(v_json->>'user_id', '');
  v_emp text := nullif(upper(trim(coalesce(v_json->>'employee_number', ''))), '');
  v_name text := nullif(lower(trim(coalesce(v_json->>'staff_name', ''))), '');
  v_key text := coalesce('u:' || v_user, 'e:' || v_emp, 'n:' || v_name);
begin
  if v_key is null or new.date is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('checkin_' || v_key || '_' || new.date::text));

  if exists (
    select 1 from public.attendance a
    where a.date = new.date
      and (
        (v_user is not null and to_jsonb(a)->>'user_id' = v_user)
        or (v_emp is not null and upper(trim(coalesce(to_jsonb(a)->>'employee_number', ''))) = v_emp)
        or (v_user is null and v_emp is null and v_name is not null and lower(trim(coalesce(a.staff_name, ''))) = v_name)
      )
  ) then
    raise exception 'Already checked in today. Each person checks in once a day and then checks out.';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_one_checkin_per_day on public.attendance;
create trigger attendance_one_checkin_per_day
  before insert on public.attendance
  for each row execute function public.check_one_checkin_per_day();

-- ============================================================
-- 9. Payroll totals always worked out from the pay lines
-- ============================================================
create or replace function public.recalc_payroll_batch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch text := coalesce((to_jsonb(new)->>'batch_id'), (to_jsonb(old)->>'batch_id'));
begin
  if v_batch is not null then
    update public.payroll_batches set id = id where id::text = v_batch;  -- fires keep_payroll_totals
  end if;
  if tg_op = 'UPDATE' and (to_jsonb(old)->>'batch_id') is distinct from (to_jsonb(new)->>'batch_id') then
    update public.payroll_batches set id = id where id::text = (to_jsonb(old)->>'batch_id');
  end if;
  return null;
end;
$$;

drop trigger if exists payroll_items_recalc_batch on public.payroll_items;
create trigger payroll_items_recalc_batch
  after insert or update or delete on public.payroll_items
  for each row execute function public.recalc_payroll_batch();

-- Whatever total an app sends, the batch keeps the real sum of its lines.
create or replace function public.keep_payroll_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(sum(net_amount), 0), count(*)
    into new.total_amount, new.item_count
  from public.payroll_items where batch_id::text = new.id::text;
  return new;
end;
$$;

drop trigger if exists payroll_batches_keep_totals on public.payroll_batches;
create trigger payroll_batches_keep_totals
  before update on public.payroll_batches
  for each row execute function public.keep_payroll_totals();

commit;
