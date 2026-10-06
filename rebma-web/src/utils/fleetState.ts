// One rule for where each truck is, used by the web map and the phone map
// (rebma-mobile/lib/fleetState.ts is an identical copy; change both).
//
// A driver can be given several stops at once. Each stop is a delivery_logs
// row. The driver works through them one by one, and only after the last
// one heads back to the company.
//
//   ASSIGNED   stops are waiting and none has started or been finished
//   ON_TRIP    driving to a stop right now (a stop is IN_TRANSIT)
//   NEXT_TRIP  finished at least one stop, more are waiting, none started yet
//   RETURNING  every stop is finished and the truck isn't back yet
//   AT_COMPANY no stops waiting and not on the way back: available
//
// "This run" means stops finished since the driver last came back to the
// company (drivers.returned_at), and never earlier than today, so last
// week's finished stops don't count. A truck counts as back when the driver
// pressed "back at company" or its latest live position is at the depot.

export type FleetState = 'AT_COMPANY' | 'ASSIGNED' | 'ON_TRIP' | 'NEXT_TRIP' | 'RETURNING';

/** Deep colours, the same on both apps. */
export const FLEET_STATE_STYLE: Record<FleetState, { color: string; label: string; count: string }> = {
  AT_COMPANY: { color: '#15803d', label: 'Available at the depot', count: 'Available at the depot' },
  ASSIGNED: { color: '#6d28d9', label: 'Assigned, not left yet', count: 'Assigned, not left yet' },
  ON_TRIP: { color: '#1d4ed8', label: 'On the way to a stop', count: 'On a delivery trip' },
  NEXT_TRIP: { color: '#0e7490', label: 'Stop done, moving to the next one', count: 'Moving to the next stop' },
  RETURNING: { color: '#b45309', label: 'All stops done, coming back', count: 'Coming back to the depot' },
};
export const OVER_LIMIT_COLOR = '#b91c1c';
export const OFFLINE_COLOR = '#475569';

/** Where the company is when no pinned location is set (Rebma Impex Limited). */
export const DEFAULT_DEPOT = { lat: 5.694949, lng: -0.010621 };
/** A live position this close to the depot counts as back at the company. */
export const DEPOT_RADIUS_METERS = 300;

const OPEN = ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
const MOVING = ['IN_TRANSIT', 'OUT_FOR_DELIVERY'];
const DONE = ['DELIVERED', 'PENDING_RISK_REVIEW'];

export interface StopRow {
  id: string;
  status: string | null;
  deliveredAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  sequence?: number | null;
  destination?: { lat: number; lng: number } | null;
  customerName?: string | null;
}

export interface FleetStateResult {
  state: FleetState;
  stopsDone: number;
  stopsTotal: number;
  /** The stop being driven to now, or the next one waiting. */
  currentStop: StopRow | null;
}

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Start of the driver's current run: their last return, but never before today. */
export function runStart(returnedAt: string | null | undefined, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const back = returnedAt ? new Date(returnedAt).getTime() : 0;
  return Math.max(today, back || 0);
}

export function computeFleetState(input: {
  stops: StopRow[];
  returnedAt?: string | null;
  /** latest fresh live position is at the depot */
  atDepot?: boolean;
  now?: Date;
}): FleetStateResult {
  const start = runStart(input.returnedAt, input.now);
  const byOrder = (a: StopRow, b: StopRow) =>
    (a.sequence ?? 1e9) - (b.sequence ?? 1e9) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));

  const open = input.stops.filter(s => OPEN.includes(String(s.status || '').toUpperCase())).sort(byOrder);
  const done = input.stops.filter(s => {
    if (!DONE.includes(String(s.status || '').toUpperCase())) return false;
    const at = s.deliveredAt || s.updatedAt || s.createdAt;
    return !!at && new Date(at).getTime() >= start;
  });
  const moving = open.find(s => MOVING.includes(String(s.status || '').toUpperCase())) || null;

  let state: FleetState;
  if (moving) state = 'ON_TRIP';
  else if (open.length > 0) state = done.length > 0 ? 'NEXT_TRIP' : 'ASSIGNED';
  else if (done.length > 0 && !input.atDepot) state = 'RETURNING';
  else state = 'AT_COMPANY';

  return {
    state,
    stopsDone: done.length,
    stopsTotal: done.length + open.length,
    currentStop: moving || open[0] || null,
  };
}

/** A short line for a marker or card, e.g. "Stop 2 of 3". */
export function stopProgress(r: FleetStateResult): string {
  if (r.stopsTotal === 0) return '';
  if (r.state === 'RETURNING') return `${r.stopsDone} of ${r.stopsTotal} stops done`;
  if (r.state === 'AT_COMPANY') return '';
  return `Stop ${Math.min(r.stopsDone + 1, r.stopsTotal)} of ${r.stopsTotal}`;
}

/**
 * The notice Risk gets when a driver finishes a stop: which stop, how many
 * are left and where they go next, or that it was the last one and they're
 * coming back. remaining = the driver's other stops still waiting, in order.
 */
export function stopFinishedMessage(driverName: string, finishedAt: string, remaining: string[]): string {
  const who = driverName || 'A driver';
  const where = finishedAt || 'a client';
  if (remaining.length === 0) return `${who} finished the last stop at ${where}. All stops done, coming back to the company.`;
  const left = remaining.length === 1 ? '1 stop left' : `${remaining.length} stops left`;
  return `${who} finished the stop at ${where}. ${left}, moving to the next one: ${remaining[0] || 'next client'}.`;
}
