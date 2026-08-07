import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Satellite, Map as MapIcon } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

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

export default function DispatchMap({ deliveries, focusDeliveryId, height = 320, compact = false, pollIntervalSeconds = 20, onMarkerClick, followFirstMarker = false, showTrails = false }: Props) {
  const [latestByDriver, setLatestByDriver] = useState<Record<string, LivePoint>>({});
  const [trail, setTrail] = useState<LivePoint[]>([]);
  const [trailsByDriver, setTrailsByDriver] = useState<Record<string, LivePoint[]>>({});
  const [layer, setLayer] = useState<MapLayer>('street');
  const mountedRef = useRef(true);

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

    const channel = supabase.channel('dispatch-map-' + Math.random().toString(36).substring(7))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' }, (payload: any) => {
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
      })
      .subscribe();

    const poll = setInterval(fetchLatest, pollIntervalSeconds * 1000);

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [driverIds.join(','), focusDeliveryId]);

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
      const live = d.driverId ? latestByDriver[d.driverId] : undefined;
      const point = live || (d.active_coordinates ? { lat: d.active_coordinates.lat, lng: d.active_coordinates.lng, recordedAt: '' } : null);
      return point ? { delivery: d, point, isLive: !!live } : null;
    })
    .filter((x): x is { delivery: DispatchMapDelivery; point: LivePoint; isLive: boolean } => !!x);

  const center: [number, number] = focusDeliveryId && markers[0]
    ? [markers[0].point.lat, markers[0].point.lng]
    : followFirstMarker && markers.length > 0
      ? [markers[0].point.lat, markers[0].point.lng]
      : ACCRA;

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
        {focusDeliveryId && markers[0] && <Recenter center={[markers[0].point.lat, markers[0].point.lng]} />}
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
        {markers.map(({ delivery, point, isLive }) => {
          const color = delivery.driverState
            ? DRIVER_STATE_COLOR[delivery.driverState] || '#64748b'
            : STATUS_COLOR[delivery.status || ''] || '#64748b';
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
                  <p style={{ margin: 0, color: isLive ? '#10b981' : '#94a3b8' }}>
                    {isLive ? `Live · ${point.recordedAt ? new Date(point.recordedAt).toLocaleTimeString() : 'now'}` : 'No GPS ping yet — last known position'}
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
