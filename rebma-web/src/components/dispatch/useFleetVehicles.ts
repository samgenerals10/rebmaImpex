// Every non-offline driver with the state their truck is in, shared by the
// Tracking page and the CEO dashboard map so both count the same way.
//
// There is no stored "where is the truck" field, so the state comes from
// the driver's most recent delivery:
//   ASSIGNED    a delivery is assigned and the truck hasn't left yet
//   ON_THE_WAY  out on a delivery
//   RETURNING   delivered, not yet marked back at the company
//   AT_COMPANY  no open delivery, available at the depot
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { DispatchMapDelivery } from './DispatchMap';

export type DriverState = 'ON_THE_WAY' | 'AT_COMPANY' | 'RETURNING' | 'ASSIGNED';

export interface VehicleRecord {
  id: string;
  driverId: string;
  driverName: string;
  truckId: string;
  status: 'IN_TRANSIT' | 'ACTIVE' | 'OFFLINE';
  driverState: DriverState;
  phone: string;
  ghanaCard: string;
  licenseNumber: string;
  photo?: string;
  lastPingAt: string | null;
  lastUpdated: string;
  lastDelivery?: { id: string; destination: string; status: string; coordinates?: { lat: number; lng: number } | null } | null;
}

export function useFleetVehicles(refreshSeconds = 0) {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('drivers')
        .select('id, driver_id, full_name, vehicle_id, status, phone, ghana_card_id, license_number, photo, returned_at')
        .neq('status', 'OFFLINE');
      if (!data || data.length === 0) { setVehicles([]); return; }

      const driverIds = data.map((d: any) => d.driver_id).filter(Boolean);
      const { data: pings } = await supabase
        .from('driver_locations')
        .select('driver_id, recorded_at')
        .in('driver_id', driverIds)
        .order('recorded_at', { ascending: false })
        .limit(200);
      const lastPingByDriver: Record<string, string> = {};
      for (const p of (pings || []) as any[]) {
        if (!lastPingByDriver[p.driver_id]) lastPingByDriver[p.driver_id] = p.recorded_at;
      }

      const driverRowIds = data.map((d: any) => d.id).filter(Boolean);
      const { data: recentDeliveries } = await supabase
        .from('delivery_logs')
        .select('id, driver_id, delivery_address, status, created_at, delivered_at, destination_lat, destination_lng')
        .in('driver_id', driverRowIds)
        .order('created_at', { ascending: false })
        .limit(200);
      const lastDeliveryByDriverRow: Record<string, any> = {};
      for (const row of (recentDeliveries || []) as any[]) {
        if (!lastDeliveryByDriverRow[row.driver_id]) lastDeliveryByDriverRow[row.driver_id] = row;
      }

      setVehicles(data.map((d: any) => {
        const lastPing = lastPingByDriver[d.driver_id] || null;
        const lastDelivery = lastDeliveryByDriverRow[d.id];
        let driverState: DriverState = 'AT_COMPANY';
        if (lastDelivery) {
          if (['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(lastDelivery.status)) driverState = 'ON_THE_WAY';
          else if (lastDelivery.status === 'ASSIGNED') driverState = 'ASSIGNED';
          else if (lastDelivery.status === 'DELIVERED') {
            const returnedAt = d.returned_at ? new Date(d.returned_at).getTime() : 0;
            const deliveredAt = lastDelivery.delivered_at ? new Date(lastDelivery.delivered_at).getTime() : 0;
            driverState = returnedAt > deliveredAt ? 'AT_COMPANY' : 'RETURNING';
          }
        }
        return {
          id: d.id,
          driverId: d.driver_id,
          driverName: d.full_name,
          truckId: d.vehicle_id || 'Not set',
          status: d.status === 'ON_DELIVERY' ? 'IN_TRANSIT' : (d.status as VehicleRecord['status']),
          driverState,
          phone: d.phone || 'Not set',
          ghanaCard: d.ghana_card_id || 'Not set',
          licenseNumber: d.license_number || 'Not set',
          photo: d.photo || undefined,
          lastPingAt: lastPing,
          lastUpdated: lastPing || new Date().toISOString(),
          lastDelivery: lastDelivery ? {
            id: lastDelivery.id,
            destination: lastDelivery.delivery_address || 'Not set',
            status: lastDelivery.status,
            coordinates: (lastDelivery.destination_lat != null && lastDelivery.destination_lng != null)
              ? { lat: Number(lastDelivery.destination_lat), lng: Number(lastDelivery.destination_lng) }
              : null,
          } : null,
        };
      }));
    } catch {
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!refreshSeconds) return;
    const iv = setInterval(() => { if (document.visibilityState === 'visible') load(); }, refreshSeconds * 1000);
    return () => clearInterval(iv);
  }, [load, refreshSeconds]);

  return { vehicles, loading, reload: load };
}

/** The map's input for these vehicles. */
export function vehiclesToMapDeliveries(vehicles: VehicleRecord[]): DispatchMapDelivery[] {
  return vehicles.map(v => ({
    id: v.id,
    driverId: v.driverId,
    driverName: v.driverName,
    vehicleId: v.truckId,
    driverState: v.driverState,
    destinationCoordinates: v.lastDelivery?.coordinates || null,
  }));
}
