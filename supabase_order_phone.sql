-- ============================================================
-- Orders were created with no phone number captured anywhere, so the
-- WhatsApp trip message sent to drivers (buildDirectionsMessage in
-- whatsapp.ts) always silently skipped its "Tel:" line — the template
-- already supports it, the column was just never written. Adds a
-- p_phone parameter to create_order_with_stock_check and stores it on
-- the new orders.phone column. Backward compatible: existing callers
-- that don't pass p_phone keep working (it defaults to null).
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
  p_destination_lng numeric default null,
  p_phone text default null
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
    destination_lat, destination_lng, phone
  ) values (
    p_ticket_number, p_client_name, p_product_name, p_destination, p_payment_mode,
    p_total_amount, p_status, now(), now(), p_metadata, p_customer_id,
    p_destination_lat, p_destination_lng, p_phone
  )
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.create_order_with_stock_check(
  text, text, text, text, text, numeric, text, jsonb, text, numeric, numeric, text
) to authenticated;
