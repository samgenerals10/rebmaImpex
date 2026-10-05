-- supabase_dispatch_to_risk.sql
--
-- Phase 9: Dispatch's delivery-facing screens move from Admin & Warehouse
-- into Risk. Risk becomes the department that assigns the vehicle and
-- driver for a delivery; Admin & Warehouse still checks stock and marks
-- an order ready to move.
--
-- Verified against source before writing this — confirmed no new order
-- status, trigger, or RPC is needed:
--   - rebma-web/src/views/operations/ApprovedGoodsView.tsx's handleDispatch()
--     already supports leaving a delivery unassigned: if no driver name is
--     given, it inserts delivery_logs with status='PENDING_ASSIGNMENT' and
--     never touches orders.status at all (a comment in that file confirms
--     orders.status only becomes OUT_FOR_DELIVERY once the driver starts
--     sharing live location from their own tracking screen — unrelated to
--     this dispatch step).
--   - rebma-web/src/services/apiClient.ts's assignDriverToDelivery()
--     already exists and is the one function that actually assigns a
--     vehicle/driver to a PENDING_ASSIGNMENT row (a plain update of
--     delivery_logs.driver_id/driver_name/vehicle_id/status). It writes
--     only to delivery_logs — nothing else.
--   - delivery_logs_staff_update (supabase_admin_warehouse_merge.sql)
--     already includes 'risk', from the original Phase 1 risk_department
--     migration. Risk can already call assignDriverToDelivery() today —
--     no RLS change needed there.
--   - waybills_write and drivers_select_broad already include 'risk' or
--     are broad to every authenticated user. No change needed there either.
--
-- The one genuine gap: Risk's new Tracking screen needs to read driver
-- positions, and driver_locations has never included 'risk'. Additive
-- only, matching every other RLS change in this project — nothing
-- existing is narrowed or removed.

drop policy if exists "driver_locations_select_staff" on public.driver_locations;
create policy "driver_locations_select_staff" on public.driver_locations
  for select to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin());

drop policy if exists "driver_locations_staff_write" on public.driver_locations;
create policy "driver_locations_staff_write" on public.driver_locations
  for all to authenticated
  using ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin())
  with check ((public.current_role() in ('dispatch','logistics','management','operations','admin_warehouse','risk') and not public.is_driver()) or public.is_admin());

-- Nothing else to change. orders_staff_write, the order-status trigger,
-- delivery_logs RLS, waybills RLS, and drivers RLS are all already
-- correct for Risk doing this work — confirmed by reading them, not
-- assumed.
