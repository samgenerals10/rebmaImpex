// rebma-mobile/lib/dispatchActions.ts
//
// Phase 7.1: two small write operations reused by more than one Admin &
// Warehouse screen (Overview's release-queue mini list, ReleasesScreen's
// full queue, DeliveriesScreen/ActiveDeliveriesScreen's driver-assign
// flow) — pulled out once here rather than duplicated across each, the
// same reasoning as lib/media.ts.
import { Linking } from 'react-native';
import { supabase } from './supabaseClient';

// Ports rebma-web/src/App.tsx's handleReleaseToDispatch + apiClient.ts's
// operations.releaseToDispatch: auto-assign the least-busy ACTIVE driver
// (no driver-picker UI on this quick action, same as web), insert the
// delivery_logs row, and create the waybill. Returns the assigned driver's
// name so the caller can show it in a confirmation.
export async function releaseOrderToDispatch(orderId: string): Promise<{ driverName: string; vehicleId: string }> {
  const { data: activeDrivers, error: driversErr } = await supabase
    .from('drivers')
    .select('id, driver_id, full_name, vehicle_id, status')
    .eq('status', 'ACTIVE');
  if (driversErr) throw new Error(driversErr.message);
  if (!activeDrivers || activeDrivers.length === 0) {
    throw new Error('No active drivers available. Add or activate a driver in Drivers first.');
  }

  const { data: busyCounts } = await supabase
    .from('delivery_logs')
    .select('driver_id')
    .in('status', ['ASSIGNED', 'IN_TRANSIT']);
  const loadByDriver: Record<string, number> = {};
  for (const d of busyCounts || []) {
    if (d.driver_id) loadByDriver[d.driver_id] = (loadByDriver[d.driver_id] || 0) + 1;
  }
  const driver = [...activeDrivers].sort((a, b) => (loadByDriver[a.id] || 0) - (loadByDriver[b.id] || 0))[0];

  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, client_name, customer_name, destination, destination_lat, destination_lng')
    .eq('id', orderId)
    .limit(1);
  if (orderErr || !orders || orders.length === 0) throw new Error('Order not found');
  const order = orders[0];

  const { data: delivery, error: delErr } = await supabase
    .from('delivery_logs')
    .insert({
      order_id: orderId,
      vehicle_id: driver.vehicle_id || 'Unassigned',
      driver_name: driver.full_name,
      driver_id: driver.id,
      customer_name: order.customer_name || order.client_name || null,
      delivery_address: order.destination || null,
      destination_lat: order.destination_lat ?? null,
      destination_lng: order.destination_lng ?? null,
      status: 'ASSIGNED',
      updated_at: new Date().toISOString(),
    })
    .select();
  if (delErr) throw new Error(delErr.message);

  if (delivery && delivery[0]) {
    const deliveryId = delivery[0].id;
    const { data: existing } = await supabase.from('waybills').select('id').eq('delivery_log_id', deliveryId).limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from('waybills').insert({ order_id: orderId, delivery_log_id: deliveryId }).select();
    }
  }

  return { driverName: driver.full_name, vehicleId: driver.vehicle_id || 'Unassigned' };
}

// Ports apiClient.ts's dispatch.assignDriverToDelivery: when the CEO has
// gated driver assignment behind Management approval
// (ceo_settings.dispatch_needs_management), a non-management/admin caller
// gets a PENDING driver_assignment_approvals row instead of an immediate
// assignment. Used by DeliveriesScreen (Dispatch Board) and
// ActiveDeliveriesScreen's assign action.
export async function assignDriverToDelivery(
  deliveryId: string,
  driverId: string,
  driverName: string,
  vehicleId: string | null,
  isManagementOrAdmin: boolean
): Promise<{ pending: boolean }> {
  const { data: gate } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'dispatch_needs_management').maybeSingle();
  const needsApproval = gate?.setting_value === true;

  if (needsApproval && !isManagementOrAdmin) {
    const { error } = await supabase.from('driver_assignment_approvals').insert({
      delivery_id: deliveryId, driver_id: driverId, status: 'PENDING',
    });
    if (error) throw new Error(error.message);
    return { pending: true };
  }

  const { error } = await supabase.from('delivery_logs').update({
    driver_id: driverId, driver_name: driverName, vehicle_id: vehicleId, status: 'ASSIGNED',
    updated_at: new Date().toISOString(),
  }).eq('id', deliveryId);
  if (error) throw new Error(error.message);
  return { pending: false };
}

// Simplified mobile port of dispatchApi.sendWhatsAppDirections — opens a
// pre-filled wa.me chat with the driver's phone number and delivery
// address so a dispatcher can review and tap Send. Drops web's
// trip_token/public-trip-link generation and the ceo_settings
// whatsapp_enabled gate check (a live-tracking link server round-trip);
// this is a deliberate v1 simplification, not a silent omission — the
// core "get a dispatcher into a WhatsApp chat with this driver about this
// delivery" capability is preserved.
export async function sendWhatsAppDirections(driverId: string, deliveryAddress?: string | null): Promise<void> {
  const { data: driver, error } = await supabase.from('drivers').select('id, full_name, phone').eq('id', driverId).single();
  if (error || !driver) throw new Error('Driver not found.');
  if (!driver.phone) throw new Error(`${driver.full_name} has no phone number on file.`);

  const message = deliveryAddress
    ? `Hi ${driver.full_name}, please head to: ${deliveryAddress}`
    : `Hi ${driver.full_name}, you have a new delivery assignment.`;
  const phone = driver.phone.replace(/[^\d+]/g, '');
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}
