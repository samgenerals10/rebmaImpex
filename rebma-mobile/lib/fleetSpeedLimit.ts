// rebma-mobile/lib/fleetSpeedLimit.ts
//
// A Risk-configured company policy speed limit — deliberately separate
// from FleetMap.tsx's own live lookup of a road's actual legal speed
// limit (free OpenStreetMap Overpass data, contextual, read-only). This
// is the number Risk actually sets and enforces against, shown live and
// prominently to both the dispatch/Risk map and every driver's own app.
// Same singleton-row shape as attendance_rules.ts, same graceful-degrade
// fallback if the table/row doesn't exist yet.
import { supabase } from './supabaseClient';

export const DEFAULT_FLEET_SPEED_LIMIT_KMH = 100;

export async function getFleetSpeedLimitKmh(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('fleet_speed_limit')
      .select('max_speed_kmh')
      .eq('id', 'default')
      .maybeSingle();
    if (error || !data) return DEFAULT_FLEET_SPEED_LIMIT_KMH;
    return data.max_speed_kmh ?? DEFAULT_FLEET_SPEED_LIMIT_KMH;
  } catch {
    return DEFAULT_FLEET_SPEED_LIMIT_KMH;
  }
}

export async function setFleetSpeedLimitKmh(maxSpeedKmh: number, updatedBy: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('fleet_speed_limit').upsert({
    id: 'default',
    max_speed_kmh: maxSpeedKmh,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message || null };
}
