// Every non-offline driver with the state their truck is in, shared by the
// Tracking page and the CEO dashboard map so both count the same way. The
// state itself comes from utils/fleetState.ts, the one rule the phone map
// uses too (all of a driver's stops this run, their return time, and
// whether their latest live position is at the depot).
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getCompanyLocation, type DispatchMapDelivery } from './DispatchMap';
import { computeFleetState, metersBetween, DEFAULT_DEPOT, DEPOT_RADIUS_METERS, type FleetState, type StopRow } from '../../utils/fleetState';

export type DriverState = FleetState;

const STALE_MS = 10 * 60000;

export interface VehicleRecord {
  id: string;
  driverId: string;
  driverName: string;
  truckId: string;
  status: 'IN_TRANSIT' | 'ACTIVE' | 'OFFLINE';
  driverState: DriverState;
  stopsDone: number;
  stopsTotal: number;
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

      const depot = (await getCompanyLocation()) || DEFAULT_DEPOT;

      // Latest position per driver (one small query each, so a driver who
      // pings often can't push another driver's latest out of a shared limit).
      const driverIds = data.map((d: any) => d.driver_id).filter(Boolean);
      const pings = await Promise.all(driverIds.map((id: string) =>
        supabase.from('driver_locations').select('driver_id, recorded_at, latitude, longitude')
          .eq('driver_id', id).order('recorded_at', { ascending: false }).limit(1).maybeSingle()
          .then(({ data: p }) => p as any)));
      const lastPingByDriver: Record<string, any> = {};
      for (const p of pings) if (p) lastPingByDriver[p.driver_id] = p;

      // Every stop still waiting or under way, plus stops finished today.
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const driverRowIds = data.map((d: any) => d.id).filter(Boolean);
      const { data: stopRows } = await supabase
        .from('delivery_logs')
        .select('id, driver_id, delivery_address, customer_name, status, created_at, updated_at, delivered_at, dispatch_sequence, destination_lat, destination_lng')
        .in('driver_id', driverRowIds)
        .or(`status.in.(ASSIGNED,IN_TRANSIT,OUT_FOR_DELIVERY),updated_at.gte.${startOfToday.toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1000);
      const stopsByDriverRow: Record<string, any[]> = {};
      for (const row of (stopRows || []) as any[]) (stopsByDriverRow[row.driver_id] ||= []).push(row);

      setVehicles(data.map((d: any) => {
        const ping = lastPingByDriver[d.driver_id];
        const fresh = ping && Date.now() - new Date(ping.recorded_at).getTime() <= STALE_MS;
        const atDepot = !!fresh && metersBetween({ lat: Number(ping.latitude), lng: Number(ping.longitude) }, depot) <= DEPOT_RADIUS_METERS;
        const rows = stopsByDriverRow[d.id] || [];
        const stops: StopRow[] = rows.map(r => ({
          id: r.id, status: r.status, deliveredAt: r.delivered_at, updatedAt: r.updated_at, createdAt: r.created_at,
          sequence: r.dispatch_sequence, customerName: r.customer_name,
          destination: r.destination_lat != null && r.destination_lng != null ? { lat: Number(r.destination_lat), lng: Number(r.destination_lng) } : null,
        }));
        const fs = computeFleetState({ stops, returnedAt: d.returned_at, atDepot });
        const cur = fs.currentStop ? rows.find(r => r.id === fs.currentStop!.id) : rows[0];
        return {
          id: d.id,
          driverId: d.driver_id,
          driverName: d.full_name,
          truckId: d.vehicle_id || 'Not set',
          status: d.status === 'ON_DELIVERY' ? 'IN_TRANSIT' : (d.status as VehicleRecord['status']),
          driverState: fs.state,
          stopsDone: fs.stopsDone,
          stopsTotal: fs.stopsTotal,
          phone: d.phone || 'Not set',
          ghanaCard: d.ghana_card_id || 'Not set',
          licenseNumber: d.license_number || 'Not set',
          photo: d.photo || undefined,
          lastPingAt: ping?.recorded_at || null,
          lastUpdated: ping?.recorded_at || new Date().toISOString(),
          lastDelivery: cur ? {
            id: cur.id,
            destination: cur.delivery_address || cur.customer_name || 'Not set',
            status: cur.status,
            coordinates: cur.destination_lat != null && cur.destination_lng != null ? { lat: Number(cur.destination_lat), lng: Number(cur.destination_lng) } : null,
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
    stopsDone: v.stopsDone,
    stopsTotal: v.stopsTotal,
    destinationCoordinates: v.lastDelivery?.coordinates || null,
  }));
}
