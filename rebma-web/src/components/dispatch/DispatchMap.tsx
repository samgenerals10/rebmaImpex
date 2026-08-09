import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Satellite, Map as MapIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { documentTemplates } from '../../services/apiClient';

type MapLayer = 'street' | 'satellite';

// Esri's World Imagery — free, no API key, same "no signup required" bar as
// the OpenStreetMap street tiles already used here.
const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
};

const ACCRA: [number, number] = [5.6037, -0.1870];

export interface DispatchMapDelivery {
  id: string;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  status?: string | null;
  active_coordinates?: { lat: number; lng: number } | null;
  // Set by callers that track live driver state (e.g. the GPS Tracking view) —
  // takes priority over `status` for marker color, since "which delivery is
  // this" and "where is this driver right now" are different questions.
  // ASSIGNED means a driver has the job but hasn't started sharing live
  // location yet — distinct from ON_THE_WAY, which only applies once they
  // actually start the trip.
  driverState?: 'ON_THE_WAY' | 'AT_COMPANY' | 'RETURNING' | 'ASSIGNED' | null;
  // Where this delivery is actually headed — when set (and the delivery is
  // ASSIGNED or ON_THE_WAY), a real road-following route is drawn from the
  // driver's current position to here, same idea as the turn-by-turn line
  // in the driver's own Google Maps navigation, just mirrored on our map.
  destinationCoordinates?: { lat: number; lng: number } | null;
}

interface RouteInfo {
  coords: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

// Public OSRM demo server — free, no API key, no signup, same bar as the
// Nominatim geocoding and OSM/Esri tiles already used in this app. It's a
// shared demo instance (fair-use, not for heavy production traffic), which
// is fine at this app's scale of a handful of concurrent deliveries.
async function fetchRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RouteInfo | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates) return null;
    return {
      coords: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]),
      distanceMeters: Number(route.distance) || 0,
      durationSeconds: Number(route.duration) || 0,
    };
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

// A driver who's ASSIGNED but hasn't started their trip yet has, by
// definition, not begun sharing live location for this job (see
// DispatchMapDelivery.driverState below) — so their last driver_locations
// row is either absent or leftover from whatever they were doing on a
// PREVIOUS delivery, which is a real, misleading "the trip started from a
// different location" bug, not just an empty-state gap. The correct
// standard-practice origin before a trip starts is the depot: geocode the
// company's own configured address (Management > Document Templates —
// the same field already printed on tickets/receipts, not a fabricated
// coordinate) and use that. Module-level cache since it almost never
// changes and every mounted map instance would otherwise re-geocode it.
let companyLocationCache: { lat: number; lng: number } | null | undefined;
let companyLocationPromise: Promise<{ lat: number; lng: number } | null> | null = null;

function getCompanyLocation(): Promise<{ lat: number; lng: number } | null> {
  if (companyLocationCache !== undefined) return Promise.resolve(companyLocationCache);
  if (companyLocationPromise) return companyLocationPromise;
  companyLocationPromise = (async () => {
    try {
      const template = await documentTemplates.get('TICKET');
      // An exact pin (Document Templates > Dispatch Ticket) always wins —
      // only fall back to guessing from the free-text address when
      // Management hasn't dropped one yet.
      if (template.companyLat != null && template.companyLng != null) {
        const loc = { lat: template.companyLat, lng: template.companyLng };
        companyLocationCache = loc;
        return loc;
      }
      const address = template.companyAddress?.trim();
      if (!address) { companyLocationCache = null; return null; }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gh&q=${encodeURIComponent(address)}`);
      const data = await res.json();
      const loc = data?.[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
      companyLocationCache = loc;
      return loc;
    } catch {
      companyLocationCache = null;
      return null;
    }
  })();
  return companyLocationPromise;
}

function destinationIcon(color: string) {
  return L.divIcon({
    className: 'dispatch-destination-marker',
    html: `<div style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

interface LivePoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

interface Props {
  deliveries: DispatchMapDelivery[];
  focusDeliveryId?: string;
  height?: number;
  compact?: boolean;
  pollIntervalSeconds?: number;
  onMarkerClick?: (delivery: DispatchMapDelivery) => void;
  // Default false — always centers on Accra/Ghana on load rather than
  // jumping to wherever the first marker happens to be.
  followFirstMarker?: boolean;
  // Default false — draws a recent-movement trail behind every marker, not
  // just a focused one. Off by default so compact map embeds (dashboard
  // widgets) stay uncluttered; the full Live GPS Tracking page turns it on.
  showTrails?: boolean;
}

function truckIcon(color: string) {
  return L.divIcon({
    className: 'dispatch-truck-marker',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid #fff;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M10 17h4V5H2v12h3M10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 17H2M14 8h4l4 4v5h-2M14 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: '#f59e0b',
  IN_TRANSIT: '#3b82f6',
  OUT_FOR_DELIVERY: '#3b82f6',
  DELIVERED: '#10b981',
  FAILED: '#ef4444',
};

const DRIVER_STATE_COLOR: Record<string, string> = {
  ASSIGNED: '#8b5cf6',     // violet — has a job, hasn't started sharing location yet
  ON_THE_WAY: '#3b82f6',   // blue — actively delivering
  RETURNING: '#f59e0b',    // amber — job done, heading back
  AT_COMPANY: '#10b981',   // green — idle at base, available
};

const DRIVER_STATE_LABEL: Record<string, string> = {
  ASSIGNED: 'Assigned — awaiting start',
  ON_THE_WAY: 'On the way',
  RETURNING: 'Returning to company',
  AT_COMPANY: 'At the company',
};

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center[0], center[1]]);
  return null;
}

// Zooms/pans the map to frame whatever routes and points are currently on
// it — the "it also zooms the navigation" part. Keyed off a signature
// (delivery ids + rounded coordinates) rather than running on every render,
// so a live GPS ping nudging a driver's position by a few meters doesn't
// keep yanking the view out from under someone who's panned around.
function FitToBounds({ points, signature }: { points: [number, number][]; signature: string }) {
  const map = useMap();
  const lastFitted = useRef<string>('');
  useEffect(() => {
    if (points.length === 0 || signature === lastFitted.current) return;
    lastFitted.current = signature;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [signature]);
  return null;
}

export default function DispatchMap({ deliveries, focusDeliveryId, height = 320, compact = false, pollIntervalSeconds = 20, onMarkerClick, followFirstMarker = false, showTrails = false }: Props) {
  const [latestByDriver, setLatestByDriver] = useState<Record<string, LivePoint>>({});
  const [trail, setTrail] = useState<LivePoint[]>([]);
  const [trailsByDriver, setTrailsByDriver] = useState<Record<string, LivePoint[]>>({});
  const [routesByDelivery, setRoutesByDelivery] = useState<Record<string, RouteInfo>>({});
  const routeOriginRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const [layer, setLayer] = useState<MapLayer>('street');
  const [companyLocation, setCompanyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { getCompanyLocation().then(loc => { if (mountedRef.current) setCompanyLocation(loc); }); }, []);

  const driverIds = useMemo(
    () => Array.from(new Set(deliveries.map(d => d.driverId).filter((x): x is string => !!x))),
    [deliveries]
  );

  const fetchLatest = async () => {
    if (driverIds.length === 0) return;
    const { data } = await supabase
      .from('driver_locations')
      .select('driver_id, latitude, longitude, recorded_at')
      .in('driver_id', driverIds)
      .order('recorded_at', { ascending: false })
      .limit(200);
    if (!mountedRef.current || !data) return;
    const next: Record<string, LivePoint> = {};
    for (const row of data as any[]) {
      if (!next[row.driver_id]) {
        next[row.driver_id] = { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at };
      }
    }
    setLatestByDriver(next);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchLatest();
    const poll = setInterval(fetchLatest, pollIntervalSeconds * 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(poll);
    };
  }, [driverIds.join(','), focusDeliveryId]);

  // Server-side filtering isn't possible here (driver_locations has no
  // column to filter this component's own driverIds prop by), so the
  // channel itself stays constant — shared across every mounted
  // DispatchMap instance — and each instance's own closure (captured fresh
  // every render via useRealtimeChannel's ref) does the per-instance
  // driverIds/focusDeliveryId filtering that used to live inside the
  // per-mount .on() callback.
  useRealtimeChannel('dispatch-map', [{ table: 'driver_locations', event: 'INSERT' }], (_table, payload) => {
    const row = payload.new;
    if (!driverIds.includes(row.driver_id)) return;
    setLatestByDriver(prev => ({
      ...prev,
      [row.driver_id]: { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at }
    }));
    if (focusDeliveryId) {
      const focused = deliveries.find(d => d.id === focusDeliveryId);
      if (focused?.driverId === row.driver_id) {
        setTrail(prev => [...prev, { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at }].slice(-20));
      }
    } else if (showTrails) {
      setTrailsByDriver(prev => ({
        ...prev,
        [row.driver_id]: [...(prev[row.driver_id] || []), { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at }].slice(-20),
      }));
    }
  });

  useEffect(() => {
    if (!focusDeliveryId) { setTrail([]); return; }
    const focused = deliveries.find(d => d.id === focusDeliveryId);
    if (!focused?.driverId) { setTrail([]); return; }
    supabase
      .from('driver_locations')
      .select('latitude, longitude, recorded_at')
      .eq('driver_id', focused.driverId)
      .order('recorded_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return;
        setTrail(data.reverse().map((r: any) => ({ lat: Number(r.latitude), lng: Number(r.longitude), recordedAt: r.recorded_at })));
      });
  }, [focusDeliveryId]);

  // Seed a short recent-movement trail per driver when showTrails is on
  // (the overview map, unlike the single-delivery focus view above, has no
  // one driver to key off — so this fetches the last few pings for every
  // driver currently shown, in one batched query).
  useEffect(() => {
    if (!showTrails || focusDeliveryId || driverIds.length === 0) { setTrailsByDriver({}); return; }
    let cancelled = false;
    supabase
      .from('driver_locations')
      .select('driver_id, latitude, longitude, recorded_at')
      .in('driver_id', driverIds)
      .order('recorded_at', { ascending: false })
      .limit(driverIds.length * 20)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byDriver: Record<string, LivePoint[]> = {};
        for (const r of (data as any[]).reverse()) {
          const arr = byDriver[r.driver_id] || (byDriver[r.driver_id] = []);
          arr.push({ lat: Number(r.latitude), lng: Number(r.longitude), recordedAt: r.recorded_at });
          if (arr.length > 20) arr.shift();
        }
        setTrailsByDriver(byDriver);
      });
    return () => { cancelled = true; };
  }, [showTrails, focusDeliveryId, driverIds.join(',')]);

  const markers = deliveries
    .filter(d => !focusDeliveryId || d.id === focusDeliveryId)
    .map(d => {
      // ASSIGNED = hasn't started sharing live location for this job yet —
      // any driver_locations row on file is either absent or leftover from
      // a previous, unrelated delivery. Anchor at the depot instead of
      // showing (or routing from) a stale/wrong position.
      if (d.driverState === 'ASSIGNED' && companyLocation) {
        return { delivery: d, point: { lat: companyLocation.lat, lng: companyLocation.lng, recordedAt: '' }, isLive: false, atCompany: true };
      }
      const live = d.driverId ? latestByDriver[d.driverId] : undefined;
      const point = live || (d.active_coordinates ? { lat: d.active_coordinates.lat, lng: d.active_coordinates.lng, recordedAt: '' } : null);
      return point ? { delivery: d, point, isLive: !!live, atCompany: false } : null;
    })
    .filter((x): x is { delivery: DispatchMapDelivery; point: LivePoint; isLive: boolean; atCompany: boolean } => !!x);

  // A route only makes sense while the driver is actually headed toward the
  // destination — once assigned (from the depot, per above) or already en
  // route. RETURNING/AT_COMPANY have no real destination to route to here.
  const routeEligible = markers.filter(
    m => m.delivery.destinationCoordinates && (m.delivery.driverState === 'ASSIGNED' || m.delivery.driverState === 'ON_THE_WAY')
  );

  useEffect(() => {
    let cancelled = false;
    for (const { delivery, point } of routeEligible) {
      const dest = delivery.destinationCoordinates!;
      const lastOrigin = routeOriginRef.current[delivery.id];
      // Skip refetching for a few-meter GPS jitter — only recompute once the
      // driver has actually moved a meaningful distance (~150m) from where
      // the last route was drawn from, so the free routing server isn't hit
      // on every single ping.
      const movedEnough = !lastOrigin || Math.hypot(lastOrigin.lat - point.lat, lastOrigin.lng - point.lng) > 0.0015;
      if (!movedEnough) continue;
      routeOriginRef.current[delivery.id] = { lat: point.lat, lng: point.lng };
      fetchRoute({ lat: point.lat, lng: point.lng }, dest).then(route => {
        if (cancelled || !route) return;
        setRoutesByDelivery(prev => ({ ...prev, [delivery.id]: route }));
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeEligible.map(m => `${m.delivery.id}:${m.point.lat.toFixed(4)}:${m.point.lng.toFixed(4)}`).join(',')]);

  const center: [number, number] = focusDeliveryId && markers[0]
    ? [markers[0].point.lat, markers[0].point.lng]
    : followFirstMarker && markers.length > 0
      ? [markers[0].point.lat, markers[0].point.lng]
      : ACCRA;

  const fitPoints: [number, number][] = markers.flatMap(({ delivery, point }) => {
    const route = routesByDelivery[delivery.id];
    if (route) return route.coords;
    const pts: [number, number][] = [[point.lat, point.lng]];
    if (delivery.destinationCoordinates) pts.push([delivery.destinationCoordinates.lat, delivery.destinationCoordinates.lng]);
    return pts;
  });
  // Coarse-rounded position included so the fit re-runs as a vehicle makes
  // real progress along its route (not on every few-meter GPS jitter, but
  // also not frozen at the very first fit for the whole trip).
  const fitSignature = markers
    .map(({ delivery, point }) => `${delivery.id}:${!!routesByDelivery[delivery.id]}:${point.lat.toFixed(2)}:${point.lng.toFixed(2)}`)
    .join(',');
  const hasAnyRoute = Object.keys(routesByDelivery).some(id => markers.some(m => m.delivery.id === id));

  return (
    <div style={{ height, borderRadius: compact ? 16 : 20, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', zIndex: 0 }}>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        {([
          { key: 'street' as MapLayer, label: 'Map', icon: MapIcon },
          { key: 'satellite' as MapLayer, label: 'Satellite', icon: Satellite },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => setLayer(opt.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: layer === opt.key ? 'var(--accent)' : 'transparent',
              color: layer === opt.key ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: 7, padding: compact ? '4px 8px' : '6px 10px',
              fontSize: compact ? 10 : 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <opt.icon size={compact ? 11 : 13} />
            {!compact && opt.label}
          </button>
        ))}
      </div>
      <MapContainer center={center} zoom={focusDeliveryId ? 13 : 11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={!compact}>
        <TileLayer
          key={layer}
          attribution={TILE_LAYERS[layer].attribution}
          url={TILE_LAYERS[layer].url}
        />
        {/* Route present → fit/frame the whole trip like a nav view; no route
            for the focused delivery → fall back to plain continuous
            recenter-on-the-marker (old behavior, unchanged). */}
        {focusDeliveryId && markers[0] && !routesByDelivery[markers[0].delivery.id] && (
          <Recenter center={[markers[0].point.lat, markers[0].point.lng]} />
        )}
        {fitPoints.length > 0 && (focusDeliveryId ? hasAnyRoute : true) && (
          <FitToBounds points={fitPoints} signature={fitSignature} />
        )}
        {trail.length > 1 && (
          <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.6 }} />
        )}
        {showTrails && !focusDeliveryId && markers.map(({ delivery }) => {
          const driverTrail = delivery.driverId ? trailsByDriver[delivery.driverId] : undefined;
          if (!driverTrail || driverTrail.length < 2) return null;
          const color = delivery.driverState ? DRIVER_STATE_COLOR[delivery.driverState] || '#3b82f6' : '#3b82f6';
          return (
            <Polyline
              key={`trail-${delivery.id}`}
              positions={driverTrail.map(p => [p.lat, p.lng])}
              pathOptions={{ color, weight: 3, opacity: 0.55 }}
            />
          );
        })}
        {/* Real road-following navigation line to the delivery destination —
            colored to match the same driver-state legend as the marker. */}
        {markers.map(({ delivery }) => {
          const route = routesByDelivery[delivery.id];
          if (!route) return null;
          const color = delivery.driverState ? DRIVER_STATE_COLOR[delivery.driverState] || '#3b82f6' : '#3b82f6';
          return (
            <Polyline
              key={`route-${delivery.id}`}
              positions={route.coords}
              pathOptions={{ color, weight: 5, opacity: 0.85 }}
            />
          );
        })}
        {markers.map(({ delivery }) => {
          if (!delivery.destinationCoordinates || !routesByDelivery[delivery.id]) return null;
          const color = delivery.driverState ? DRIVER_STATE_COLOR[delivery.driverState] || '#3b82f6' : '#3b82f6';
          return (
            <Marker
              key={`dest-${delivery.id}`}
              position={[delivery.destinationCoordinates.lat, delivery.destinationCoordinates.lng]}
              icon={destinationIcon(color)}
            />
          );
        })}
        {markers.map(({ delivery, point, isLive, atCompany }) => {
          const color = delivery.driverState
            ? DRIVER_STATE_COLOR[delivery.driverState] || '#64748b'
            : STATUS_COLOR[delivery.status || ''] || '#64748b';
          const route = routesByDelivery[delivery.id];
          return (
            <Marker
              key={delivery.id}
              position={[point.lat, point.lng]}
              icon={truckIcon(color)}
              eventHandlers={onMarkerClick ? { click: () => onMarkerClick(delivery) } : undefined}
            >
              <Popup>
                <div style={{ fontSize: 12, minWidth: 140 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{delivery.driverName || 'Driver'}</p>
                  <p style={{ margin: '0 0 4px', color: '#64748b' }}>{delivery.vehicleId || 'Unassigned vehicle'}</p>
                  {delivery.driverState && (
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color }}>{DRIVER_STATE_LABEL[delivery.driverState]}</p>
                  )}
                  {route && (
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#0f172a' }}>
                      {formatDuration(route.durationSeconds)} · {formatDistance(route.distanceMeters)}
                    </p>
                  )}
                  <p style={{ margin: 0, color: isLive ? '#10b981' : '#94a3b8' }}>
                    {isLive
                      ? `Live · ${point.recordedAt ? new Date(point.recordedAt).toLocaleTimeString() : 'now'}`
                      : atCompany ? 'At the depot — trip not started yet' : 'No GPS ping yet — last known position'}
                  </p>
                  {onMarkerClick && <p style={{ margin: '4px 0 0', color: '#94a3b8', fontStyle: 'italic' }}>Click marker for full details</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {markers.length === 0 && (
        <div style={{ position: 'relative', top: -height, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text-muted)', gap: 6 }}>
          <Truck size={28} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 12, margin: 0, background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 8 }}>No active vehicle positions yet</p>
        </div>
      )}
    </div>
  );
}
