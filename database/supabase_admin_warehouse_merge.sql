-- ============================================================
-- Phase 5: Admin & Warehouse merge — Operations + Dispatch + Logistics
-- merge into one department, "Admin & Warehouse" (role: admin_warehouse).
--
-- Run this BEFORE deploying the frontend and BEFORE the first "Admin &
-- Warehouse" registration. handle_new_user() (see
-- supabase_fix_registration_trigger.sql) inserts profiles.role straight
-- from signup metadata, so an unpatched profiles_role_check makes every
-- new registration into this department fail at the database level —
-- exactly the failure mode of the July 2026 is_ceo outage.
--
-- NO BULK UPDATE of profiles.role or profiles.department. Existing
-- accounts keep their literal stored role (operations / dispatch /
-- logistics); only new registrations get admin_warehouse. Three reasons
-- this is not just a preference:
--   (a) it makes the migration reversible — reverting the frontend
--       restores the old behaviour exactly, with no data to unwind;
--   (b) driver mobile logins are role='dispatch' (api/register-driver-user.ts)
--       and are distinguished from Dispatch *staff* only by
--       public.is_driver() — a blanket dispatch -> admin_warehouse sweep
--       would silently promote every driver's phone to full warehouse
--       staff access;
--   (c) global_audit_history and attendance rows carry the legacy
--       department strings; leaving profiles alone keeps the two
--       consistent.
--
-- Because existing roles are preserved, every policy below is widened to
-- the FULL UNION ('operations','dispatch','logistics','admin_warehouse')
-- rather than merely gaining admin_warehouse — that union is what makes
-- an existing Operations account able to use the Dispatch and Fleet
-- screens the merged sidebar now shows it.
--
-- "and not public.is_driver()" is added to every clause that gains
-- 'dispatch' or 'logistics' and did not already have it. Six of these
-- tables (cargo_intake, stock, stock_ledger, material_requisitions,
-- categories, fulfillment_tickets, general_purchases) have no driver
-- guard today because they never listed 'dispatch'. Adding the union
-- without the guard would grant every driver account write access to
-- stock and cargo. The guard is a no-op for every account that already
-- has access today.
--
-- suppliers / supplier_orders are deliberately NOT touched (see the note
-- near the bottom) — they are management-only today and none of the
-- three merging roles have ever had access, so adding admin_warehouse
-- there would be a net-new grant, not carried-forward access.
-- driver_assignment_approvals_update is deliberately NOT widened — it is
-- a management-only gate by design (supabase_control_center_patch3.sql).
--
-- fuel_logs / maintenance_schedule / fleet_vehicles were "confirmed
-- absent from this project's live database" when supabase_rls_overhaul.sql
-- was written. The guarded block below skips them cleanly if still
-- absent — spot-check in the Supabase table editor and re-run this file
-- if they have since been created.
-- ============================================================

-- 1. Allow the new role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
    role in ('CEO','HR','admin','marketing','operations','finance','production',
             'receptionist','dispatch','logistics','management','Staff','risk',
             'admin_warehouse')
);

-- 2. cargo_intake_write — union + driver guard (source: supabase_risk_department.sql)
drop policy if exists "cargo_intake_write" on public.cargo_intake;
create policy "cargo_intake_write" on public.cargo_intake
  for all to authenticated
  using ((public.current_role() in ('operations','dispatch','logistics','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('operations','dispatch','logistics','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
    and (status not in ('APPROVED','REJECTED','RETURNED_FOR_CORRECTION')
         or public.current_role() = 'risk' or public.is_admin())
  );

-- 3. orders_staff_write — union on the two role-gated conjuncts only;
--    thresholds/finance-approval clauses copied byte-for-byte, unchanged
--    (source: supabase_risk_department.sql, latest of three generations)
drop policy if exists "orders_staff_write" on public.orders;
create policy "orders_staff_write" on public.orders
  for all to authenticated
  using (
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
    or public.is_admin()
  )
  with check (
    (
      (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED','REJECTED')
      or public.current_role() in ('finance','management','risk')
      or public.is_admin()
    )
    and (
      status not in ('OUT_FOR_DELIVERY','DELIVERED')
      or public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk')
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED')
      or coalesce(public.ceo_setting_numeric('ceo_cosign_order_threshold'), 0) <= 0
      or total_amount <= public.ceo_setting_numeric('ceo_cosign_order_threshold')
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED')
      or payment_mode is distinct from 'CREDIT'
      or coalesce(public.ceo_setting_numeric('ceo_cosign_credit_threshold'), 0) <= 0
      or total_amount <= public.ceo_setting_numeric('ceo_cosign_credit_threshold')
      or public.is_admin()
    )
    and (
      status not in ('PENDING_FINANCE','APPROVED')
      or coalesce(public.ceo_setting_numeric('ceo_approval_threshold'), 0) <= 0
      or total_amount <= public.ceo_setting_numeric('ceo_approval_threshold')
      or public.is_admin()
    )
  );

-- 4. material_requisitions_write (source: supabase_rls_overhaul.sql)
drop policy if exists "material_requisitions_write" on public.material_requisitions;
create policy "material_requisitions_write" on public.material_requisitions
  for all to authenticated
  using ((public.current_role() in ('production','operations','finance','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('production','operations','finance','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 5. stock_write / stock_ledger_write (source: supabase_finance_stock_write.sql — has 'finance', the rls_overhaul copy doesn't)
drop policy if exists "stock_write" on public.stock;
create policy "stock_write" on public.stock
  for all to authenticated
  using ((public.current_role() in ('operations','production','management','finance','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('operations','production','management','finance','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin());

drop policy if exists "stock_ledger_write" on public.stock_ledger;
create policy "stock_ledger_write" on public.stock_ledger
  for all to authenticated
  using ((public.current_role() in ('operations','production','management','finance','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('operations','production','management','finance','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 6. categories_write (source: supabase_rls_overhaul.sql)
drop policy if exists "categories_write" on public.categories;
create policy "categories_write" on public.categories
  for all to authenticated
  using ((public.current_role() in ('operations','production','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('operations','production','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 7. fulfillment_tickets_write (source: supabase_rls_overhaul.sql)
drop policy if exists "fulfillment_tickets_write" on public.fulfillment_tickets;
create policy "fulfillment_tickets_write" on public.fulfillment_tickets
  for all to authenticated
  using ((public.current_role() in ('production','operations','management','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('production','operations','management','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 8. general_purchases_write — union + driver guard; approval sub-clause
--    stays management-only, unchanged (source: supabase_rls_overhaul.sql)
drop policy if exists "general_purchases_write" on public.general_purchases;
create policy "general_purchases_write" on public.general_purchases
  for all to authenticated
  using ((public.current_role() in ('operations','management','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('operations','management','dispatch','logistics','admin_warehouse') and not public.is_driver()) or public.is_admin())
    and (status not in ('APPROVED','REJECTED') or public.current_role() = 'management' or public.is_admin())
  );

-- 9. drivers_staff_write (source: supabase_rls_overhaul.sql; is_driver() guard already present/load-bearing)
drop policy if exists "drivers_staff_write" on public.drivers;
create policy "drivers_staff_write" on public.drivers
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 10-13. delivery_logs — select/update carry 'risk' (source: supabase_risk_department.sql),
--        insert/delete deliberately don't (source: supabase_delivery_logs_operations_write.sql) — preserved
drop policy if exists "delivery_logs_staff_select" on public.delivery_logs;
create policy "delivery_logs_staff_select" on public.delivery_logs
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin());

drop policy if exists "delivery_logs_staff_insert" on public.delivery_logs;
create policy "delivery_logs_staff_insert" on public.delivery_logs
  for insert to authenticated
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );

drop policy if exists "delivery_logs_staff_update" on public.delivery_logs;
create policy "delivery_logs_staff_update" on public.delivery_logs
  for update to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
  with check (
    ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
    and (
      status is distinct from 'ASSIGNED'
      or not public.ceo_setting_bool('dispatch_needs_management')
      or public.current_role() = 'management'
      or public.is_admin()
    )
  );

drop policy if exists "delivery_logs_staff_delete" on public.delivery_logs;
create policy "delivery_logs_staff_delete" on public.delivery_logs
  for delete to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 14-15. driver_locations (source: supabase_rls_overhaul.sql; driver's own select/insert policies untouched)
drop policy if exists "driver_locations_select_staff" on public.driver_locations;
create policy "driver_locations_select_staff" on public.driver_locations
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin());

drop policy if exists "driver_locations_staff_write" on public.driver_locations;
create policy "driver_locations_staff_write" on public.driver_locations
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 16-17. driver_assignment_approvals — select/insert widened; update stays
--        management-only by design, NOT touched (source: supabase_control_center_patch3.sql)
drop policy if exists "driver_assignment_approvals_select" on public.driver_assignment_approvals;
create policy "driver_assignment_approvals_select" on public.driver_assignment_approvals
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin());

drop policy if exists "driver_assignment_approvals_insert" on public.driver_assignment_approvals;
create policy "driver_assignment_approvals_insert" on public.driver_assignment_approvals
  for insert to authenticated
  with check ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 18. waybills_write — union + driver guard (source: supabase_waybills.sql, Phase 4).
--     NOTE: Phase 4 listed 'dispatch' with NO driver guard, so this is a small
--     intentional tightening (driver accounts lose direct waybills write access;
--     rebma-mobile never touches this table today, so nothing breaks).
drop policy if exists "waybills_write" on public.waybills;
create policy "waybills_write" on public.waybills
  for all to authenticated
  using ((public.current_role() in ('operations','dispatch','logistics','management','risk','admin_warehouse') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('operations','dispatch','logistics','management','risk','admin_warehouse') and not public.is_driver()) or public.is_admin());

-- 19. fuel_logs / maintenance_schedule / fleet_vehicles — guarded, only creates
--     policies for tables that actually exist (source: supabase_rls_overhaul.sql;
--     these three tables were noted as absent from the live DB when first written —
--     spot-check in Supabase's table editor and re-run this block if that's changed)
do $$
declare
  t text;
begin
  foreach t in array array['fuel_logs','maintenance_schedule','fleet_vehicles'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop policy if exists %I on public.%I', t || '_select_broad', t);
      execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select_broad', t);
      execute format('drop policy if exists %I on public.%I', t || '_write_logistics', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using ((public.current_role() in (''logistics'',''operations'',''dispatch'',''admin_warehouse'') and not public.is_driver()) or public.is_admin()) with check ((public.current_role() in (''logistics'',''operations'',''dispatch'',''admin_warehouse'') and not public.is_driver()) or public.is_admin())',
        t || '_write_logistics', t
      );
    end if;
  end loop;
end $$;

-- 20. create_order_with_stock_check() — pre-existing gap fixed here: 'risk' was
--     never added to this RPC's inline check even though Phase 1 added it to
--     orders_staff_write. Recreating the live 12-arg overload (source:
--     supabase_order_phone.sql) with the corrected + widened role list, and
--     dropping the stale 11-arg overload it superseded (its sole caller,
--     OrdersView.tsx, always passes all 12 args so the 11-arg version is
--     unreachable dead code, not a live second copy of this gate). Body
--     copied byte-for-byte from supabase_order_phone.sql — only the
--     role-check line changes.
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
    (public.current_role() in ('marketing','finance','management','dispatch','logistics','operations','admin_warehouse','risk') and not public.is_driver())
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

-- Drop the stale 11-arg overload from supabase_race_conditions.sql — its
-- sole caller (OrdersView.tsx) always passes all 12 named arguments
-- including p_phone, so it always resolves to the 12-arg version above;
-- the 11-arg copy is unreachable dead code and a second place the role
-- list could silently diverge if left in place.
drop function if exists public.create_order_with_stock_check(text,text,text,text,text,numeric,text,jsonb,text,numeric,numeric);

-- ============================================================
-- Backfill note, not executed: to opt an individual legacy account into
-- the new role later, HR can simply re-save that person in HR -> Staff
-- (writes role='admin_warehouse'). That is the intended gradual,
-- per-record migration path. Do NOT run a blanket
--   update profiles set role='admin_warehouse' where role in ('operations','dispatch','logistics')
-- — it would sweep up driver mobile logins (role='dispatch').
--
-- Deliberately NOT touched by this migration:
--   - suppliers_select / suppliers_write / supplier_orders_select /
--     supplier_orders_write (supabase_rls_overhaul.sql) — management-only
--     today, no merging role has ever had access; adding admin_warehouse
--     would be a new grant, not a carried-forward one.
--   - driver_assignment_approvals_update — management-only by design.
-- ============================================================
