import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Satellite, Map as MapIcon, Box, ArrowRight, Anchor, Navigation, Gauge, X, ChevronRight, ChevronLeft, Maximize2, Minimize2, Warehouse, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { documentTemplates } from '../../services/apiClient';
import { getFleetSpeedLimitKmh, setFleetSpeedLimitKmh, speedKmh, DEFAULT_FLEET_SPEED_LIMIT_KMH } from '../../utils/fleetSpeedLimit';
import { setVisibleInterval } from '../../utils/visibleInterval';
import { FLEET_STATE_STYLE, OVER_LIMIT_COLOR, DEFAULT_DEPOT, type FleetState } from '../../utils/fleetState';

type MapLayer = 'street' | '3d' | 'satellite';

const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  // CARTO's tiles now need an account key and showed "API KEY REQUIRED"
  // instead of streets. Esri's street map is free with no key, from the
  // same provider as the Satellite view.
  '3d': {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
};

const ACCRA: [number, number] = [5.6037, -0.1870];
const TEMA_PORT: [number, number] = [5.6268, -0.0076];

export interface DispatchMapDelivery {
  id: string;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  status?: string | null;
  active_coordinates?: { lat: number; lng: number } | null;
  driverState?: FleetState | null;
  /** Stops finished this run and stops in total, for drivers with several stops. */
  stopsDone?: number;
  stopsTotal?: number;
  destinationCoordinates?: { lat: number; lng: number } | null;
}

interface RouteInfo {
  coords: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

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

let companyLocationCache: { lat: number; lng: number } | null | undefined;
let companyLocationPromise: Promise<{ lat: number; lng: number } | null> | null = null;

// The depot: the company location pinned in Document Templates (the Ticket
// template), or Rebma Impex Limited's own coordinates when none is pinned.
// The phone map (FleetMap.tsx loadPinnedDepot) follows the same rule, so
// both apps agree on where "back at the depot" is. (This used to look up
// the template's address text instead, and the default address there is
// "Accra Business District", not the depot.)
export function getCompanyLocation(): Promise<{ lat: number; lng: number } | null> {
  if (companyLocationCache !== undefined) return Promise.resolve(companyLocationCache);
  if (companyLocationPromise) return companyLocationPromise;
  companyLocationPromise = (async () => {
    try {
      const template = await documentTemplates.get('TICKET');
      const loc = template.companyLat != null && template.companyLng != null
        ? { lat: template.companyLat, lng: template.companyLng }
        : { ...DEFAULT_DEPOT };
      companyLocationCache = loc;
      return loc;
    } catch {
      companyLocationCache = { ...DEFAULT_DEPOT };
      return companyLocationCache;
    }
  })();
  return companyLocationPromise;
}

// Stylized color-coded teardrop pin matching the reference design
function teardropPinIcon(color: string, glyph: 'hub' | 'port' | 'truck' | 'dest') {
  let innerSvg = '';
  if (glyph === 'hub') {
    innerSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  } else if (glyph === 'port') {
    innerSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m12 6 4 6h-8z"/></svg>`;
  } else if (glyph === 'dest') {
    innerSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>`;
  } else {
    innerSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><path d="M10 17h4V5H2v12h3M10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 17H2M14 8h4l4 4v5h-2M14 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>`;
  }

  return L.divIcon({
    className: 'dispatch-teardrop-marker',
    html: `
      <div style="position:relative;width:28px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35));cursor:pointer;">
        <svg width="28" height="38" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="${color}"/>
          <circle cx="12" cy="12" r="6" fill="#ffffff"/>
        </svg>
        <div style="position:absolute;top:6px;left:8px;width:12px;height:12px;display:flex;align-items:center;justify-content:center;">
          ${innerSvg}
        </div>
      </div>
    `,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

// Each truck state has its own symbol inside the pin, so the five states
// read apart even before the colour does.
const STATE_GLYPH: Record<string, string> = {
  // truck: driving to a stop
  ON_TRIP: '<path d="M10 17h4V5H2v12h3M10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 17H2M14 8h4l4 4v5h-2M14 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>',
  // check then arrow: stop done, heading to the next one
  NEXT_TRIP: '<polyline points="3 12 7 16 12 9"/><path d="M14 12h7M18 8l3 4-3 4"/>',
  // arrow back to a house: coming back to the depot
  RETURNING: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  // clock: assigned, waiting to leave
  ASSIGNED: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
  // parking P: available at the depot
  AT_COMPANY: '<path d="M8 20V4h5a4 4 0 0 1 0 8H8"/>',
};

// A driver's pin: bigger and outlined thickly so it stands out on any map
// style, with their live speed against Risk's company limit and, for a
// driver with several stops, which stop they're on. Over the limit, the
// pin turns deep red and pulses.
function truckIcon(color: string, kmh: number | null, limitKmh: number, overLimit: boolean, state?: string | null, stops?: string) {
  const fill = overLimit ? OVER_LIMIT_COLOR : color;
  const glyph = STATE_GLYPH[state || 'ON_TRIP'] || STATE_GLYPH.ON_TRIP;
  const speedBadge = kmh != null && kmh > 2
    ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 7px;border-radius:999px;font:800 10px/16px system-ui,sans-serif;color:#fff;background:${overLimit ? OVER_LIMIT_COLOR : 'rgba(15,23,42,0.9)'};">${kmh}/${limitKmh} km/h</div>`
    : '';
  const stopBadge = stops
    ? `<div style="position:absolute;bottom:2px;right:-12px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;border:2px solid #fff;font:800 9px/14px system-ui,sans-serif;color:#fff;background:${fill};text-align:center;">${stops}</div>`
    : '';
  const pulse = overLimit
    ? `<div style="position:absolute;left:-4px;top:-4px;width:44px;height:44px;border-radius:50%;border:4px solid ${OVER_LIMIT_COLOR};opacity:.75;animation:fleetOverLimitPulse 1.1s ease-out infinite;"></div>`
    : '';
  return L.divIcon({
    className: 'dispatch-teardrop-marker',
    html: `
      <div style="position:relative;width:36px;height:48px;filter:drop-shadow(0 5px 10px rgba(0,0,0,0.45));cursor:pointer;">
        ${pulse}${speedBadge}
        <svg width="36" height="48" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1C5.9 1 1 5.9 1 12C1 20.5 12 31 12 31C12 31 23 20.5 23 12C23 5.9 18.1 1 12 1Z" fill="${fill}" stroke="#ffffff" stroke-width="2.2"/>
          <circle cx="12" cy="12" r="7" fill="#ffffff"/>
        </svg>
        <svg style="position:absolute;top:9px;left:9px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${fill}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
        ${stopBadge}
      </div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -44],
  });
}

// A position older than this is shown as last known, not live, and is
// never counted as speeding (same 10 minutes as the phone map).
const STALE_MINUTES = 10;

function destinationIcon(color: string) {
  return teardropPinIcon(color, 'dest');
}

interface LivePoint {
  lat: number;
  lng: number;
  recordedAt: string;
  /** meters per second, from the driver's device; null if not reported */
  speed?: number | null;
}

interface Props {
  deliveries: DispatchMapDelivery[];
  focusDeliveryId?: string;
  height?: number;
  compact?: boolean;
  pollIntervalSeconds?: number;
  onMarkerClick?: (delivery: DispatchMapDelivery) => void;
  followFirstMarker?: boolean;
  showTrails?: boolean;
  /** Show the four fleet counts (available, going, coming back, assigned) above the map. */
  showStatusSummary?: boolean;
}

// Pages that pass a delivery status but no truck state colour by status.
const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: FLEET_STATE_STYLE.ASSIGNED.color,
  IN_TRANSIT: FLEET_STATE_STYLE.ON_TRIP.color,
  OUT_FOR_DELIVERY: FLEET_STATE_STYLE.ON_TRIP.color,
  DELIVERED: FLEET_STATE_STYLE.AT_COMPANY.color,
  FAILED: OVER_LIMIT_COLOR,
};
const STATUS_GLYPH: Record<string, FleetState> = { ASSIGNED: 'ASSIGNED', IN_TRANSIT: 'ON_TRIP', OUT_FOR_DELIVERY: 'ON_TRIP', DELIVERED: 'AT_COMPANY' };

const DRIVER_STATE_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(FLEET_STATE_STYLE).map(([k, v]) => [k, v.color])
);

const DRIVER_STATE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(FLEET_STATE_STYLE).map(([k, v]) => [k, v.label])
);

// How much the tilted 3D map must be enlarged so its shrunken top edge
// still reaches both sides and the top of a box of this height.
function tiltCoverScale(height: number): number {
  const perspective = 900;
  const tilt = (18 * Math.PI) / 180;
  const above = height * 0.75; // distance from the tilt pivot up to the top edge
  const depth = above * Math.sin(tilt);
  const shrink = perspective / (perspective + depth);
  const needed = 1 / (shrink * Math.cos(tilt));
  return Math.round(needed * 1.04 * 1000) / 1000; // a little spare so no sliver shows
}

// Leaflet measures its box once; after expanding or collapsing the map it
// has to be told the box changed size, or tiles stay missing.
function InvalidateOnResize({ signature }: { signature: string }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220);
    return () => clearTimeout(t);
  }, [signature]);
  return null;
}

const SUMMARY_STATES: FleetState[] = ['AT_COMPANY', 'ASSIGNED', 'ON_TRIP', 'NEXT_TRIP', 'RETURNING'];

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center[0], center[1]]);
  return null;
}

function MapFlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 1.2 });
  }, [target]);
  return null;
}

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
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [signature]);
  return null;
}

function useAnimatedPosition(target: [number, number], durationMs = 1400): [number, number] {
  const [pos, setPos] = useState<[number, number]>(target);
  const posRef = useRef<[number, number]>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = posRef.current;
    const to = target;
    if (from[0] === to[0] && from[1] === to[1]) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dist = Math.hypot(from[0] - to[0], from[1] - to[1]);
    if (dist > 0.05) {
      posRef.current = to;
      setPos(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t * (2 - t);
      const next: [number, number] = [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased];
      posRef.current = next;
      setPos(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target[0], target[1], durationMs]);

  return pos;
}

function AnimatedTruckMarker({ position, icon, eventHandlers, children }: {
  position: [number, number];
  icon: L.DivIcon;
  eventHandlers?: L.LeafletEventHandlerFnMap;
  children?: ReactNode;
}) {
  const animatedPosition = useAnimatedPosition(position);
  return (
    <Marker position={animatedPosition} icon={icon} eventHandlers={eventHandlers}>
      {children}
    </Marker>
  );
}

export default function DispatchMap({ deliveries, focusDeliveryId, height = 540, compact = false, pollIntervalSeconds = 20, onMarkerClick, followFirstMarker = false, showTrails = false, showStatusSummary = false }: Props) {
  const [latestByDriver, setLatestByDriver] = useState<Record<string, LivePoint>>({});
  const [trail, setTrail] = useState<LivePoint[]>([]);
  const [trailsByDriver, setTrailsByDriver] = useState<Record<string, LivePoint[]>>({});
  const [routesByDelivery, setRoutesByDelivery] = useState<Record<string, RouteInfo>>({});
  const routeOriginRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const [layer, setLayer] = useState<MapLayer>('3d');
  const [companyLocation, setCompanyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [panTarget, setPanTarget] = useState<[number, number] | null>(null);
  const mountedRef = useRef(true);
  // The chips, depot card, map style switch and driver bubble stay hidden
  // behind one arrow so they don't cover the map.
  const [toolsOpen, setToolsOpen] = useState(false);
  // Expanded fills the screen; pressing again (or Escape) collapses it.
  const [expanded, setExpanded] = useState(false);
  const [viewportH, setViewportH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  useEffect(() => {
    if (!expanded) return;
    const onResize = () => setViewportH(window.innerHeight);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); };
  }, [expanded]);

  useEffect(() => { getCompanyLocation().then(loc => { if (mountedRef.current) setCompanyLocation(loc); }); }, []);

  // Risk's company speed limit, checked every 15 seconds like the phone
  // map, so a change shows up live. Only Risk or the CEO can edit it.
  const [fleetSpeedLimit, setFleetSpeedLimit] = useState(DEFAULT_FLEET_SPEED_LIMIT_KMH);
  const [canEditLimit, setCanEditLimit] = useState(false);
  const [editorName, setEditorName] = useState('Risk');
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitError, setLimitError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const loadLimit = () => getFleetSpeedLimitKmh().then(v => { if (!cancelled) setFleetSpeedLimit(v); });
    loadLimit();
    const stopLimit = setVisibleInterval(loadLimit, 15000);
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from('profiles').select('role, is_admin, full_name').eq('id', uid).maybeSingle();
      if (cancelled || !prof) return;
      setCanEditLimit(!!prof.is_admin || String(prof.role || '').toLowerCase() === 'risk');
      setEditorName(prof.full_name || 'Risk');
    });
    return () => { cancelled = true; stopLimit(); };
  }, []);
  const saveFleetSpeedLimit = async () => {
    const parsed = parseInt(limitDraft, 10);
    if (!parsed || parsed <= 0 || parsed > 300) { setLimitError('Enter a speed between 1 and 300 km/h.'); return; }
    setSavingLimit(true);
    const { error } = await setFleetSpeedLimitKmh(parsed, editorName);
    setSavingLimit(false);
    if (error) { setLimitError(error); return; }
    setFleetSpeedLimit(parsed);
    setEditingLimit(false);
    setLimitError('');
  };

  const driverIds = useMemo(
    () => Array.from(new Set(deliveries.map(d => d.driverId).filter((x): x is string => !!x))),
    [deliveries]
  );

  const fetchLatest = async () => {
    if (driverIds.length === 0) return;
    // One small query per driver, so a driver who pings often can't push
    // another driver's latest position out of a shared row limit.
    const rows = await Promise.all(driverIds.map(id =>
      supabase
        .from('driver_locations')
        .select('driver_id, latitude, longitude, recorded_at, speed')
        .eq('driver_id', id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => data as any)
    ));
    if (!mountedRef.current) return;
    const next: Record<string, LivePoint> = {};
    for (const row of rows) {
      if (row) next[row.driver_id] = { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at, speed: row.speed ?? null };
    }
    setLatestByDriver(next);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchLatest();
    const stopPoll = setVisibleInterval(fetchLatest, pollIntervalSeconds * 1000);
    return () => {
      mountedRef.current = false;
      stopPoll();
    };
  }, [driverIds.join(','), focusDeliveryId]);

  useRealtimeChannel('dispatch-map', [{ table: 'driver_locations', event: 'INSERT' }], (_table, payload) => {
    const row = payload.new;
    if (!driverIds.includes(row.driver_id)) return;
    setLatestByDriver(prev => ({
      ...prev,
      [row.driver_id]: { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at, speed: row.speed ?? null }
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

  useEffect(() => {
    if (!showTrails || focusDeliveryId || driverIds.length === 0) { setTrailsByDriver({}); return; }
    let cancelled = false;
    Promise.all(driverIds.map(id =>
      supabase
        .from('driver_locations')
        .select('latitude, longitude, recorded_at')
        .eq('driver_id', id)
        .order('recorded_at', { ascending: false })
        .limit(20)
        .then(({ data }) => [id, (data || []) as any[]] as const)
    )).then(results => {
      if (cancelled) return;
      const byDriver: Record<string, LivePoint[]> = {};
      for (const [id, rows] of results) {
        byDriver[id] = rows.slice().reverse().map(r => ({ lat: Number(r.latitude), lng: Number(r.longitude), recordedAt: r.recorded_at }));
      }
      setTrailsByDriver(byDriver);
    });
    return () => { cancelled = true; };
  }, [showTrails, focusDeliveryId, driverIds.join(',')]);

  const markers = deliveries
    .filter(d => !focusDeliveryId || d.id === focusDeliveryId)
    .map(d => {
      if (d.driverState === 'ASSIGNED' && companyLocation) {
        return { delivery: d, point: { lat: companyLocation.lat, lng: companyLocation.lng, recordedAt: '' }, isLive: false, atCompany: true };
      }
      const live = d.driverId ? latestByDriver[d.driverId] : undefined;
      const point = live || (d.active_coordinates ? { lat: d.active_coordinates.lat, lng: d.active_coordinates.lng, recordedAt: '' } : null);
      return point ? { delivery: d, point, isLive: !!live, atCompany: false } : null;
    })
    .filter((x): x is { delivery: DispatchMapDelivery; point: LivePoint; isLive: boolean; atCompany: boolean } => !!x);

  // Where each truck is heading: its stop, or the depot when coming back.
  const depotPoint = companyLocation || DEFAULT_DEPOT;
  const routeTarget = (d: DispatchMapDelivery) =>
    d.driverState === 'RETURNING' ? depotPoint
      : (d.driverState === 'ASSIGNED' || d.driverState === 'ON_TRIP' || d.driverState === 'NEXT_TRIP') ? d.destinationCoordinates || null
        : null;
  const routeEligible = markers.filter(m => !!routeTarget(m.delivery));

  useEffect(() => {
    let cancelled = false;
    for (const { delivery, point } of routeEligible) {
      const dest = routeTarget(delivery)!;
      const lastOrigin = routeOriginRef.current[delivery.id];
      const movedEnough = !lastOrigin || Math.hypot(lastOrigin.lat - point.lat, lastOrigin.lng - point.lng) > 0.0015;
      if (!movedEnough) continue;
      routeOriginRef.current[delivery.id] = { lat: point.lat, lng: point.lng };
      fetchRoute({ lat: point.lat, lng: point.lng }, dest).then(route => {
        if (cancelled || !route) return;
        setRoutesByDelivery(prev => ({ ...prev, [delivery.id]: route }));
      });
    }
    return () => { cancelled = true; };
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

  const fitSignature = markers
    .map(({ delivery, point }) => `${delivery.id}:${!!routesByDelivery[delivery.id]}:${point.lat.toFixed(2)}:${point.lng.toFixed(2)}`)
    .join(',');
  const hasAnyRoute = Object.keys(routesByDelivery).some(id => markers.some(m => m.delivery.id === id));

  const isPingFresh = (p: LivePoint) => !!p.recordedAt && Date.now() - new Date(p.recordedAt).getTime() <= STALE_MINUTES * 60000;
  const enRoute = markers.filter(m =>
    m.delivery.driverState ? m.delivery.driverState === 'ON_TRIP' || m.delivery.driverState === 'NEXT_TRIP' || m.delivery.driverState === 'RETURNING'
      : m.delivery.status === 'OUT_FOR_DELIVERY' || m.delivery.status === 'IN_TRANSIT'
  );

  // Determine active target for Primary Highlight Card
  const activeFocusDelivery = focusDeliveryId ? deliveries.find(d => d.id === focusDeliveryId) : markers[0]?.delivery;
  const activeRoute = activeFocusDelivery ? routesByDelivery[activeFocusDelivery.id] : null;

  // Each moving driver's live speed, for the strip above the map.
  const movingNow = markers
    .map(m => {
      const fresh = m.isLive && isPingFresh(m.point);
      const kmh = fresh ? speedKmh(m.point.speed) : null;
      return kmh != null && kmh > 2 ? { m, kmh, over: kmh > fleetSpeedLimit } : null;
    })
    .filter((x): x is { m: typeof markers[number]; kmh: number; over: boolean } => !!x)
    .sort((a, b) => b.kmh - a.kmh);

  const stateCounts = SUMMARY_STATES.map(key => ({
    key,
    label: FLEET_STATE_STYLE[key].count,
    count: deliveries.filter(d => d.driverState === key).length,
    first: markers.find(m => m.delivery.driverState === key),
  }));

  const mapHeight = expanded ? Math.max(320, viewportH - (showStatusSummary ? 190 : 140)) : height;
  const chipBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.85)', borderRadius: 999, padding: '6px 12px', cursor: 'pointer',
  };

  return (
    <div
      style={expanded
        ? { position: 'fixed', inset: 12, zIndex: 3000, background: 'var(--bg-card)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border)' }
        : { display: 'flex', flexDirection: 'column', gap: compact ? 6 : 10 }}
    >
      <style>{'@keyframes fleetOverLimitPulse { 0% { transform: scale(.8); opacity: .8 } 100% { transform: scale(1.8); opacity: 0 } }'}</style>

      {/* Speed limit and each moving driver's live speed, above the map */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--bg)', borderRadius: 14, padding: compact ? '5px 8px' : '8px 12px' }}>
        <Gauge size={15} color="var(--accent)" />
        {editingLimit ? (
          <>
            <input
              type="number" min={1} max={300} value={limitDraft} autoFocus
              onChange={e => { setLimitDraft(e.target.value); setLimitError(''); }}
              onKeyDown={e => e.key === 'Enter' && saveFleetSpeedLimit()}
              placeholder="km/h"
              style={{ width: 70, padding: '3px 6px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-card)' }}
            />
            <button onClick={saveFleetSpeedLimit} disabled={savingLimit} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{savingLimit ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setEditingLimit(false); setLimitError(''); }} title="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={14} /></button>
            {limitError && <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444' }}>{limitError}</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Fleet Speed Limit: {fleetSpeedLimit} km/h</span>
            {canEditLimit && !compact && (
              <button onClick={() => { setLimitDraft(String(fleetSpeedLimit)); setEditingLimit(true); }} style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--accent)', border: 'none', borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>Edit</button>
            )}
          </>
        )}
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '0 2px' }} />
        {movingNow.length === 0 ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>No vehicle moving right now</span>
        ) : movingNow.slice(0, compact ? 2 : 6).map(({ m, kmh, over }) => (
          <button key={m.delivery.id} onClick={() => setPanTarget([m.point.lat, m.point.lng])} title={over ? `Over the ${fleetSpeedLimit} km/h limit` : 'Within the limit'}
            style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700,
              background: over ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: over ? '#ef4444' : 'var(--accent)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{(m.delivery.driverName || 'Driver').split(' ')[0]}</span>
            {kmh} km/h
          </button>
        ))}
        {movingNow.length > (compact ? 2 : 6) && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{movingNow.length - (compact ? 2 : 6)} more</span>}
        <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse map' : 'Expand map'}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', borderRadius: 999, padding: compact ? '3px 8px' : '5px 11px', fontSize: 11, fontWeight: 700, background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {!compact && (expanded ? 'Collapse' : 'Expand')}
        </button>
      </div>

      {/* The four fleet counts */}
      {showStatusSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {stateCounts.map(st => {
            const color = DRIVER_STATE_COLOR[st.key];
            const Icon = st.key === 'AT_COMPANY' ? Warehouse : st.key === 'ON_TRIP' ? Truck : st.key === 'NEXT_TRIP' ? ArrowRight : st.key === 'RETURNING' ? Navigation : Clock;
            return (
              <button key={st.key} onClick={() => st.first && setPanTarget([st.first.point.lat, st.first.point.lng])}
                style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', textAlign: 'left', cursor: st.first ? 'pointer' : 'default', borderRadius: 14, padding: '8px 12px', background: 'var(--bg)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1f`, color, flexShrink: 0 }}><Icon size={15} /></span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1 }}>{st.count}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

    <div style={{ height: mapHeight, flex: expanded ? 1 : undefined, borderRadius: 8, overflow: 'hidden', position: 'relative', zIndex: 0, background: '#0F172A' }}>

      {/* One arrow opens the map tools, so they don't cover the map */}
      <button onClick={() => setToolsOpen(o => !o)} title={toolsOpen ? 'Hide map tools' : 'Show map tools'}
        style={{ position: 'absolute', top: 10, left: compact ? 52 : 56, zIndex: 1001, width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: toolsOpen ? 'var(--accent)' : 'rgba(255,255,255,0.95)', color: toolsOpen ? '#fff' : '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {toolsOpen ? <ChevronLeft size={compact ? 14 : 17} /> : <ChevronRight size={compact ? 14 : 17} />}
      </button>

      {/* Map style switch */}
      {toolsOpen && (
      <div style={{ position: 'absolute', top: compact ? 8 : 12, right: compact ? 8 : 12, zIndex: 1000, display: 'flex', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: 3, gap: 2 }}>
        {([
          { key: '3d' as MapLayer, label: '3D View', icon: Box },
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
              border: 'none', borderRadius: 8, padding: compact ? '4px 8px' : '6px 12px',
              fontSize: compact ? 11 : 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            <opt.icon size={compact ? 12 : 14} />
            {!compact && opt.label}
          </button>
        ))}
      </div>
      )}

      {/* Place chips */}
      {toolsOpen && !compact && (
        <div style={{ position: 'absolute', top: 10, left: 98, zIndex: 999, display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100% - 360px)' }}>
          <button onClick={() => setPanTarget(companyLocation ? [companyLocation.lat, companyLocation.lng] : ACCRA)} style={chipBtn}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Truck size={11} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Central Depot</span>
          </button>
          <button onClick={() => setPanTarget(TEMA_PORT)} style={chipBtn}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Anchor size={11} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Port Intake</span>
          </button>
          {enRoute.length > 0 && (
            <button onClick={() => setPanTarget([enRoute[0].point.lat, enRoute[0].point.lng])} style={chipBtn}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Navigation size={11} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>En Route</span>
              <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#F59E0B', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{enRoute.length}</span>
            </button>
          )}
        </div>
      )}

      {/* Depot or selected driver card */}
      {toolsOpen && !compact && (
        <div
          style={{
            position: 'absolute', top: 56, left: 56, zIndex: 999, width: 240,
            background: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(16px)',
            borderRadius: 18, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Truck size={17} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeFocusDelivery ? (activeFocusDelivery.driverName || 'Driver not set') : 'Company depot'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                {activeFocusDelivery ? (activeFocusDelivery.vehicleId || 'Vehicle not set') : 'No vehicle on the road'}
              </div>
            </div>
          </div>
          {activeFocusDelivery?.driverState && (
            <div style={{ fontSize: 11, fontWeight: 700, color: DRIVER_STATE_COLOR[activeFocusDelivery.driverState] || '#64748B' }}>
              {DRIVER_STATE_LABEL[activeFocusDelivery.driverState]}
            </div>
          )}
          {activeRoute && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>ETA: {formatDuration(activeRoute.durationSeconds)}</span>
              <span style={{ color: '#94A3B8' }}>·</span>
              <span>{formatDistance(activeRoute.distanceMeters)}</span>
            </div>
          )}
          <button
            onClick={() => {
              if (activeFocusDelivery && onMarkerClick) onMarkerClick(activeFocusDelivery);
              else setPanTarget(companyLocation ? [companyLocation.lat, companyLocation.lng] : ACCRA);
            }}
            style={{ marginTop: 2, background: '#0B2A63', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
          >
            <span>{activeFocusDelivery ? 'Inspect Delivery' : 'View Operations'}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* First driver bubble */}
      {toolsOpen && !compact && markers.length > 0 && (
        <div
          onClick={() => {
            const first = markers[0].delivery;
            if (onMarkerClick) onMarkerClick(first);
            setPanTarget([markers[0].point.lat, markers[0].point.lng]);
          }}
          title={markers[0].delivery.driverName || 'Driver'}
          style={{ position: 'absolute', bottom: 18, right: 18, zIndex: 999, width: 46, height: 46, borderRadius: '50%', background: '#FFFFFF', border: '2.5px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
        >
          <div style={{ width: '100%', height: '100%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent)', fontSize: 16 }}>
            {markers[0].delivery.driverName ? markers[0].delivery.driverName.charAt(0) : 'D'}
          </div>
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: markers[0].isLive && isPingFresh(markers[0].point) ? '#10B981' : '#94A3B8', border: '1.5px solid #fff' }} />
        </div>
      )}

      <MapContainer
        center={center}
        zoom={focusDeliveryId ? 13 : 11}
        style={{
          height: '100%',
          width: '100%',
          // Tilting the map back makes its top edge shrink, which left empty
          // dark corners. Scale it up just enough to cover the whole box at
          // this map's height (worked out from the same 900px perspective).
          transform: layer === '3d' ? `perspective(900px) rotateX(18deg) scale(${tiltCoverScale(mapHeight)})` : 'none',
          transformOrigin: 'center 75%',
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        scrollWheelZoom={!compact}
      >
        <TileLayer
          key={layer}
          attribution={TILE_LAYERS[layer].attribution}
          url={TILE_LAYERS[layer].url}
        />

        <MapFlyTo target={panTarget} />
        <InvalidateOnResize signature={`${expanded}:${mapHeight}`} />

        {/* Ground Glowing Neon Halos */}
        {/* 1. Central Depot Ground Halo (Blue Neon Glow) */}
        {companyLocation && (
          <>
            <Circle
              center={[companyLocation.lat, companyLocation.lng]}
              radius={400}
              pathOptions={{
                color: '#3B82F6',
                fillColor: '#3B82F6',
                fillOpacity: 0.16,
                weight: 2.5,
                dashArray: '5, 5',
              }}
            />
            <Marker
              position={[companyLocation.lat, companyLocation.lng]}
              icon={teardropPinIcon('#2563EB', 'hub')}
            >
              <Tooltip permanent={false} direction="top" offset={[0, -32]}>
                Central Depot & Staging Hub
              </Tooltip>
            </Marker>
          </>
        )}

        {/* 2. Tema Port Intake Ground Halo (Green Neon Glow) */}
        <Circle
          center={TEMA_PORT}
          radius={500}
          pathOptions={{
            color: '#10B981',
            fillColor: '#10B981',
            fillOpacity: 0.14,
            weight: 2.5,
            dashArray: '5, 5',
          }}
        />
        <Marker
          position={TEMA_PORT}
          icon={teardropPinIcon('#10B981', 'port')}
        >
          <Tooltip permanent={false} direction="top" offset={[0, -32]}>
            Tema Port Intake (Port Arrivals)
          </Tooltip>
        </Marker>

        {/* 3. Destination Ground Halos (Rose Neon Glow) */}
        {markers.map(({ delivery }) => {
          if (!delivery.destinationCoordinates) return null;
          return (
            <Circle
              key={`dest-halo-${delivery.id}`}
              center={[delivery.destinationCoordinates.lat, delivery.destinationCoordinates.lng]}
              radius={350}
              pathOptions={{
                color: '#F43F5E',
                fillColor: '#F43F5E',
                fillOpacity: 0.18,
                weight: 2.5,
                dashArray: '4, 4',
              }}
            />
          );
        })}

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
          const stale = !point.recordedAt || Date.now() - new Date(point.recordedAt).getTime() > STALE_MINUTES * 60000;
          const kmh = isLive && !stale ? speedKmh(point.speed) : null;
          const overLimit = kmh != null && kmh > fleetSpeedLimit;
          return (
            <AnimatedTruckMarker
              key={delivery.id}
              position={[point.lat, point.lng]}
              icon={truckIcon(color, kmh, fleetSpeedLimit, overLimit,
                delivery.driverState || STATUS_GLYPH[delivery.status || ''] || 'ON_TRIP',
                delivery.stopsTotal && delivery.stopsTotal > 1 && delivery.driverState !== 'AT_COMPANY'
                  ? `${Math.min((delivery.stopsDone || 0) + (delivery.driverState === 'RETURNING' ? 0 : 1), delivery.stopsTotal)}/${delivery.stopsTotal}` : undefined)}
              eventHandlers={onMarkerClick ? { click: () => onMarkerClick(delivery) } : undefined}
            >
              {delivery.driverName && (
                <Tooltip permanent direction="right" offset={[18, -20]} className="dispatch-driver-label" opacity={1}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: overLimit ? OVER_LIMIT_COLOR : color }} />
                    {delivery.driverName}
                  </span>
                </Tooltip>
              )}
              <Popup>
                <div style={{ fontSize: 12, minWidth: 140 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{delivery.driverName || 'Driver'}</p>
                  <p style={{ margin: '0 0 4px', color: '#64748b' }}>{delivery.vehicleId || 'Unassigned vehicle'}</p>
                  {delivery.driverState && (
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color }}>{DRIVER_STATE_LABEL[delivery.driverState]}</p>
                  )}
                  {!!delivery.stopsTotal && delivery.driverState !== 'AT_COMPANY' && (
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#0f172a' }}>
                      {delivery.driverState === 'RETURNING'
                        ? `${delivery.stopsDone || 0} of ${delivery.stopsTotal} stops done`
                        : `Stop ${Math.min((delivery.stopsDone || 0) + 1, delivery.stopsTotal)} of ${delivery.stopsTotal}`}
                    </p>
                  )}
                  {kmh != null && (
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: overLimit ? '#ef4444' : '#0f172a' }}>
                      {kmh} km/h · {overLimit ? `over the ${fleetSpeedLimit} km/h fleet limit` : `within the ${fleetSpeedLimit} km/h fleet limit`}
                    </p>
                  )}
                  {route && (
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#0f172a' }}>
                      {formatDuration(route.durationSeconds)} · {formatDistance(route.distanceMeters)}
                    </p>
                  )}
                  <p style={{ margin: 0, color: isLive && !stale ? '#10b981' : '#94a3b8' }}>
                    {isLive
                      ? stale
                        ? `Last seen ${new Date(point.recordedAt).toLocaleString()}`
                        : `Live · ${new Date(point.recordedAt).toLocaleTimeString()}`
                      : atCompany ? 'At the depot, trip not started yet' : 'No GPS ping yet, last known position'}
                  </p>
                  {onMarkerClick && <p style={{ margin: '4px 0 0', color: '#94a3b8', fontStyle: 'italic' }}>Click marker for full details</p>}
                </div>
              </Popup>
            </AnimatedTruckMarker>
          );
        })}
      </MapContainer>

      {markers.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text-muted)', gap: 6 }}>
          <Truck size={28} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 12, margin: 0, background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 8 }}>No active vehicle positions yet</p>
        </div>
      )}
    </div>
    </div>
  );
}
