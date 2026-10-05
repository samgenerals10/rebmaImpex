-- supabase_race_conditions.sql
--
-- Closes the two remaining real race conditions found in the full audit
-- (stock oversell on order creation, duplicate supplier order numbers),
-- and the audit-trail impersonation gap (global_audit_history.performed_by
-- is a free-text column the client fully controls). Requires
-- supabase_rls_overhaul.sql to already be applied (reuses current_role(),
-- is_admin(), is_driver()). Run this in the Supabase SQL Editor.

begin;

-- ============================================================
-- Stock oversell — order creation never touched the stock table at all
-- (stock is only decremented later, at fulfillment), so the gap wasn't a
-- stock write race, it was that nothing stopped total *promised* quantity
-- across concurrently-created orders from exceeding physical stock. This
-- locks per product, checks stock minus everything already promised to
-- open orders, and inserts — all in one transaction — replacing the
-- client-side check-then-insert in OrdersView.tsx's handleSave.
-- ============================================================
create or replace function public.create_order_with_stock_check(
  p_ticket_number text,
  p_client_name text,
  p_product_name text,
  p_destination text,
  p_payment_mode text,
  p_total_amount numeric,
  p_status text,
  p_metadata jsonb,
  p_customer_id text default null,
  p_destination_lat numeric default null,
  p_destination_lng numeric default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product text;
  v_qty numeric;
  v_promised numeric;
  v_on_hand numeric;
  v_available numeric;
  v_order public.orders;
begin
  if not (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics') and not public.is_driver())
    or public.is_admin()
  ) then
    raise exception 'Not authorized to create orders.';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_metadata->'items', '[]'::jsonb))
  loop
    v_product := trim(both from coalesce(v_item->>'productName', ''));
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_product = '' or v_qty <= 0 then continue; end if;

    -- Serializes concurrent order creation for the same product so two
    -- requests can't both read the same "available" number and both pass.
    perform pg_advisory_xact_lock(hashtext('stock_' || lower(v_product)));

    select coalesce(quantity, 0) into v_on_hand
    from public.stock
    where lower(trim(product_name)) = lower(v_product)
    limit 1;

    select coalesce(sum((item->>'quantity')::numeric), 0) into v_promised
    from public.orders o, jsonb_array_elements(coalesce(o.metadata->'items', '[]'::jsonb)) item
    where o.status not in ('DELIVERED', 'REJECTED', 'CANCELLED')
      and lower(trim(item->>'productName')) = lower(v_product);

    v_available := coalesce(v_on_hand, 0) - coalesce(v_promised, 0);

    if v_qty > v_available then
      raise exception 'Not enough stock for %: % requested, % available.', v_product, v_qty, greatest(v_available, 0);
    end if;
  end loop;

  insert into public.orders (
    ticket_number, client_name, product_name, destination, payment_mode,
    total_amount, status, created_at, updated_at, metadata, customer_id,
    destination_lat, destination_lng
  ) values (
    p_ticket_number, p_client_name, p_product_name, p_destination, p_payment_mode,
    p_total_amount, p_status, now(), now(), p_metadata, p_customer_id,
    p_destination_lat, p_destination_lng
  )
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.create_order_with_stock_check(
  text, text, text, text, text, numeric, text, jsonb, text, numeric, numeric
) to authenticated;

-- ============================================================
-- Duplicate supplier order numbers — generateOrderNumber() computed the
-- next SUP-{year}-{seq} client-side from an already-loaded, staled array.
-- Same fix family as above: lock, compute the next number from the live
-- table under that lock, insert — all atomic.
-- ============================================================
create or replace function public.create_supplier_order(p_order jsonb)
returns public.supplier_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text;
  v_max int;
  v_order_number text;
  v_row public.supplier_orders;
begin
  if not (public.current_role() = 'management' or public.is_admin()) then
    raise exception 'Not authorized to create supplier orders.';
  end if;

  perform pg_advisory_xact_lock(hashtext('supplier_order_seq'));

  v_year := to_char(now(), 'YYYY');

  select coalesce(max(
    nullif(regexp_replace(split_part(order_number, '-', 3), '[^0-9]', '', 'g'), '')::int
  ), 0)
  into v_max
  from public.supplier_orders
  where order_number like 'SUP-' || v_year || '-%';

  v_order_number := 'SUP-' || v_year || '-' || lpad((v_max + 1)::text, 3, '0');

  insert into public.supplier_orders (
    order_number, supplier_name, supplier_country, supplier_email, products,
    total_amount, currency, exchange_rate, total_amount_ghs,
    expected_delivery_date, shipping_method, port_of_entry, status, notes,
    created_by, created_at, updated_at
  )
  select
    v_order_number,
    p_order->>'supplier_name', p_order->>'supplier_country', p_order->>'supplier_email',
    p_order->'products',
    coalesce((p_order->>'total_amount')::numeric, 0),
    coalesce(p_order->>'currency', 'USD'),
    coalesce((p_order->>'exchange_rate')::numeric, 1),
    (p_order->>'total_amount_ghs')::numeric,
    (p_order->>'expected_delivery_date')::date,
    p_order->>'shipping_method',
    coalesce(p_order->>'port_of_entry', 'Tema Port'),
    coalesce(p_order->>'status', 'pending'),
    p_order->>'notes',
    auth.uid(), now(), now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_supplier_order(jsonb) to authenticated;

-- ============================================================
-- Spoofable audit-trail attribution — performed_by is free-text the client
-- fully controls, so any account could log a false actor name. A trigger
-- overwrites it with the name resolved server-side from auth.uid() and
-- populates the already-existing-but-unused user_id column the same way.
-- Every existing call site keeps working unmodified; whatever string they
-- send becomes irrelevant the moment this fires.
-- ============================================================
create or replace function public.set_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.performed_by := coalesce(
    (select full_name from public.profiles where id = auth.uid()),
    new.performed_by,
    'Unknown'
  );
  return new;
end;
$$;

drop trigger if exists set_audit_actor_trigger on public.global_audit_history;

create trigger set_audit_actor_trigger
  before insert on public.global_audit_history
  for each row execute function public.set_audit_actor();

commit;
