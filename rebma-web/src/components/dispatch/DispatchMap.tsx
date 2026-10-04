import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Satellite, Map as MapIcon, Box, ArrowRight, Anchor, Navigation, Phone, CheckCircle2, Gauge, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { documentTemplates } from '../../services/apiClient';
import { getFleetSpeedLimitKmh, setFleetSpeedLimitKmh, speedKmh, DEFAULT_FLEET_SPEED_LIMIT_KMH } from '../../utils/fleetSpeedLimit';

type MapLayer = 'street' | '3d' | 'satellite';

const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  '3d': {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
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
  driverState?: 'ON_THE_WAY' | 'AT_COMPANY' | 'RETURNING' | 'ASSIGNED' | null;
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

function getCompanyLocation(): Promise<{ lat: number; lng: number } | null> {
  if (companyLocationCache !== undefined) return Promise.resolve(companyLocationCache);
  if (companyLocationPromise) return companyLocationPromise;
  companyLocationPromise = (async () => {
    try {
      const template = await documentTemplates.get('TICKET');
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

// A driver's pin with their live speed against Risk's company limit, the
// same reading the phone map shows. Over the limit, the pin pulses red.
function truckIcon(color: string, kmh: number | null, limitKmh: number, overLimit: boolean) {
  const base = teardropPinIcon(overLimit ? '#ef4444' : color, 'truck');
  const html = String((base.options as any).html || '');
  const badge = kmh != null && kmh > 2
    ? `<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:1px 6px;border-radius:999px;font:700 10px/16px system-ui,sans-serif;color:#fff;background:${overLimit ? '#ef4444' : 'rgba(15,23,42,0.85)'};">${kmh}/${limitKmh} km/h</div>`
    : '';
  const pulse = overLimit
    ? '<div style="position:absolute;inset:-6px;border-radius:50%;border:3px solid #ef4444;opacity:.7;animation:fleetOverLimitPulse 1.1s ease-out infinite;"></div>'
    : '';
  return L.divIcon({
    className: 'dispatch-teardrop-marker',
    html: `<div style="position:relative;">${pulse}${badge}${html}</div>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
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
}

const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: '#f59e0b',
  IN_TRANSIT: '#3b82f6',
  OUT_FOR_DELIVERY: '#3b82f6',
  DELIVERED: '#10b981',
  FAILED: '#ef4444',
};

const DRIVER_STATE_COLOR: Record<string, string> = {
  ASSIGNED: '#8b5cf6',     // violet
  ON_THE_WAY: '#3b82f6',   // blue
  RETURNING: '#f59e0b',    // amber
  AT_COMPANY: '#10b981',   // green
};

const DRIVER_STATE_LABEL: Record<string, string> = {
  ASSIGNED: 'Assigned, awaiting start',
  ON_THE_WAY: 'On the way',
  RETURNING: 'Returning to company',
  AT_COMPANY: 'At the company',
};

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

export default function DispatchMap({ deliveries, focusDeliveryId, height = 540, compact = false, pollIntervalSeconds = 20, onMarkerClick, followFirstMarker = false, showTrails = false }: Props) {
  const [latestByDriver, setLatestByDriver] = useState<Record<string, LivePoint>>({});
  const [trail, setTrail] = useState<LivePoint[]>([]);
  const [trailsByDriver, setTrailsByDriver] = useState<Record<string, LivePoint[]>>({});
  const [routesByDelivery, setRoutesByDelivery] = useState<Record<string, RouteInfo>>({});
  const routeOriginRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const [layer, setLayer] = useState<MapLayer>('3d');
  const [companyLocation, setCompanyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [panTarget, setPanTarget] = useState<[number, number] | null>(null);
  const mountedRef = useRef(true);

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
    const iv = setInterval(loadLimit, 15000);
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from('profiles').select('role, is_admin, full_name').eq('id', uid).maybeSingle();
      if (cancelled || !prof) return;
      setCanEditLimit(!!prof.is_admin || String(prof.role || '').toLowerCase() === 'risk');
      setEditorName(prof.full_name || 'Risk');
    });
    return () => { cancelled = true; clearInterval(iv); };
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
    const { data } = await supabase
      .from('driver_locations')
      .select('driver_id, latitude, longitude, recorded_at, speed')
      .in('driver_id', driverIds)
      .order('recorded_at', { ascending: false })
      .limit(200);
    if (!mountedRef.current || !data) return;
    const next: Record<string, LivePoint> = {};
    for (const row of data as any[]) {
      if (!next[row.driver_id]) {
        next[row.driver_id] = { lat: Number(row.latitude), lng: Number(row.longitude), recordedAt: row.recorded_at, speed: row.speed ?? null };
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
      if (d.driverState === 'ASSIGNED' && companyLocation) {
        return { delivery: d, point: { lat: companyLocation.lat, lng: companyLocation.lng, recordedAt: '' }, isLive: false, atCompany: true };
      }
      const live = d.driverId ? latestByDriver[d.driverId] : undefined;
      const point = live || (d.active_coordinates ? { lat: d.active_coordinates.lat, lng: d.active_coordinates.lng, recordedAt: '' } : null);
      return point ? { delivery: d, point, isLive: !!live, atCompany: false } : null;
    })
    .filter((x): x is { delivery: DispatchMapDelivery; point: LivePoint; isLive: boolean; atCompany: boolean } => !!x);

  const routeEligible = markers.filter(
    m => m.delivery.destinationCoordinates && (m.delivery.driverState === 'ASSIGNED' || m.delivery.driverState === 'ON_THE_WAY')
  );

  useEffect(() => {
    let cancelled = false;
    for (const { delivery, point } of routeEligible) {
      const dest = delivery.destinationCoordinates!;
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

  // Determine active target for Primary Highlight Card
  const activeFocusDelivery = focusDeliveryId ? deliveries.find(d => d.id === focusDeliveryId) : markers[0]?.delivery;
  const activeRoute = activeFocusDelivery ? routesByDelivery[activeFocusDelivery.id] : null;

  return (
    <div style={{ height, borderRadius: compact ? 16 : 24, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', zIndex: 0, background: '#0F172A' }}>
      
      {/* 3D Perspective Glowing HUD Bounding Frame Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: compact ? 8 : 14,
          borderRadius: compact ? 18 : 24,
          border: '2px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 0 25px rgba(255, 255, 255, 0.45), inset 0 0 30px rgba(91, 77, 255, 0.16)',
          pointerEvents: 'none',
          zIndex: 400,
        }}
      />

      {/* Layer Toggle Strip */}
      <div style={{ position: 'absolute', top: 16, right: 18, zIndex: 1000, display: 'flex', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 12, padding: 3, gap: 2, boxShadow: '0 4px 15px rgba(0,0,0,0.12)' }}>
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

      {/* Floating Waypoint Chips Bar (Aczone Pattern: Green Port, Amber Transit, Rose Client) */}
      {!compact && (
        <div style={{ position: 'absolute', top: 16, left: 18, zIndex: 999, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Central Hub Chip */}
          <button
            onClick={() => setPanTarget(companyLocation ? [companyLocation.lat, companyLocation.lng] : ACCRA)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.85)', borderRadius: 999, padding: '6px 12px',
              boxShadow: '0 4px 12px rgba(15,23,42,0.1)', cursor: 'pointer',
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Truck size={11} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Central Depot</span>
          </button>

          {/* Tema Port Intake Chip */}
          <button
            onClick={() => setPanTarget(TEMA_PORT)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.85)', borderRadius: 999, padding: '6px 12px',
              boxShadow: '0 4px 12px rgba(15,23,42,0.1)', cursor: 'pointer',
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Anchor size={11} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>Port Intake</span>
          </button>

          {/* En Route Active Chip */}
          {markers.length > 0 && (
            <button
              onClick={() => setPanTarget([markers[0].point.lat, markers[0].point.lng])}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.85)', borderRadius: 999, padding: '6px 12px',
                boxShadow: '0 4px 12px rgba(15,23,42,0.1)', cursor: 'pointer',
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Navigation size={11} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>En Route ({markers.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Primary Floating Action Card (modeled on the "First-Time Buyer" card in reference) */}
      {!compact && (
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 18,
            zIndex: 999,
            width: 250,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            borderRadius: 20,
            padding: '14px 16px',
            boxShadow: '0 16px 36px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(255,255,255,0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
              }}
            >
              <Truck size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeFocusDelivery?.driverName || 'Accra Central Depot'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                {activeFocusDelivery?.vehicleId || 'Main Staging Terminal'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '2px 0' }}>
            <div style={{ height: 6, width: '80%', background: '#E2E8F0', borderRadius: 3 }} />
            <div style={{ height: 6, width: '55%', background: '#CBD5E1', borderRadius: 3 }} />
          </div>

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
            style={{
              marginTop: 2,
              background: '#0B2A63',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            <span>{activeFocusDelivery ? 'Inspect Delivery' : 'View Operations'}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Floating Driver Avatar Badge (Bottom Right) */}
      {!compact && markers.length > 0 && (
        <div
          onClick={() => {
            const first = markers[0].delivery;
            if (onMarkerClick) onMarkerClick(first);
            setPanTarget([markers[0].point.lat, markers[0].point.lng]);
          }}
          title={markers[0].delivery.driverName || 'Driver'}
          style={{
            position: 'absolute',
            bottom: 22,
            right: 22,
            zIndex: 999,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#FFFFFF',
            border: '2.5px solid #FFFFFF',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '100%', height: '100%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent)', fontSize: 16 }}>
            {markers[0].delivery.driverName ? markers[0].delivery.driverName.charAt(0) : 'D'}
          </div>
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#10B981', border: '1.5px solid #fff' }} />
        </div>
      )}

      {/* Risk's company speed limit, the legend for the red pins */}
      <style>{'@keyframes fleetOverLimitPulse { 0% { transform: scale(.8); opacity: .8 } 100% { transform: scale(1.8); opacity: 0 } }'}</style>
      <div style={{ position: 'absolute', bottom: compact ? 10 : 22, left: compact ? 10 : 18, zIndex: 999, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.95)', borderRadius: 14, padding: compact ? '5px 10px' : '8px 12px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', maxWidth: 'calc(100% - 100px)' }}>
        <Gauge size={15} color="var(--accent)" />
        {editingLimit ? (
          <>
            <input
              type="number" min={1} max={300} value={limitDraft} autoFocus
              onChange={e => { setLimitDraft(e.target.value); setLimitError(''); }}
              onKeyDown={e => e.key === 'Enter' && saveFleetSpeedLimit()}
              placeholder="km/h"
              style={{ width: 70, padding: '3px 6px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, color: '#0f172a', background: '#fff' }}
            />
            <button onClick={saveFleetSpeedLimit} disabled={savingLimit} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{savingLimit ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setEditingLimit(false); setLimitError(''); }} title="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}><X size={14} /></button>
            {limitError && <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444' }}>{limitError}</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>Fleet Speed Limit: {fleetSpeedLimit} km/h</span>
            {canEditLimit && !compact && (
              <button onClick={() => { setLimitDraft(String(fleetSpeedLimit)); setEditingLimit(true); }} style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--accent)', border: 'none', borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>Edit</button>
            )}
          </>
        )}
      </div>

      <MapContainer
        center={center}
        zoom={focusDeliveryId ? 13 : 11}
        style={{
          height: '100%',
          width: '100%',
          transform: layer === '3d' ? 'perspective(900px) rotateX(18deg)' : 'none',
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
              icon={truckIcon(color, kmh, fleetSpeedLimit, overLimit)}
              eventHandlers={onMarkerClick ? { click: () => onMarkerClick(delivery) } : undefined}
            >
              {delivery.driverName && (
                <Tooltip permanent direction="right" offset={[14, 0]} className="dispatch-driver-label" opacity={1}>
                  {delivery.driverName}
                </Tooltip>
              )}
              <Popup>
                <div style={{ fontSize: 12, minWidth: 140 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{delivery.driverName || 'Driver'}</p>
                  <p style={{ margin: '0 0 4px', color: '#64748b' }}>{delivery.vehicleId || 'Unassigned vehicle'}</p>
                  {delivery.driverState && (
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color }}>{DRIVER_STATE_LABEL[delivery.driverState]}</p>
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
                  <p style={{ margin: 0, color: isLive ? '#10b981' : '#94a3b8' }}>
                    {isLive
                      ? `Live · ${point.recordedAt ? new Date(point.recordedAt).toLocaleTimeString() : 'now'}`
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
        <div style={{ position: 'relative', top: -height, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text-muted)', gap: 6 }}>
          <Truck size={28} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 12, margin: 0, background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 8 }}>No active vehicle positions yet</p>
        </div>
      )}
    </div>
  );
}
