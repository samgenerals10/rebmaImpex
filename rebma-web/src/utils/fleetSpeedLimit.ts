// rebma-web/src/utils/fleetSpeedLimit.ts
//
// The company speed limit Risk sets for every vehicle (one row,
// fleet_speed_limit 'default'). Web twin of rebma-mobile/lib/fleetSpeedLimit.ts:
// the Risk map, the CEO map and every driver's screen read the same number.
// Only Risk or the CEO can change it (the database enforces that).
import { supabase } from '../lib/supabaseClient';

export const DEFAULT_FLEET_SPEED_LIMIT_KMH = 100;

export async function getFleetSpeedLimitKmh(): Promise<number> {
  try {
    const { data, error } = await supabase.from('fleet_speed_limit').select('max_speed_kmh').eq('id', 'default').maybeSingle();
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

// GPS reports meters per second; people read km/h.
export function speedKmh(speedMs: number | null | undefined): number | null {
  if (speedMs == null || Number.isNaN(Number(speedMs)) || Number(speedMs) < 0) return null;
  return Math.round(Number(speedMs) * 3.6);
}
