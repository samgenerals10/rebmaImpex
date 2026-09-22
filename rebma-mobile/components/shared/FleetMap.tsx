// rebma-mobile/components/shared/FleetMap.tsx
//
// A real, live, embedded map showing every driver's current position at
// once — for Risk, CEO Command, and Management to see "where is every
// vehicle right now" in one glance, not a list they have to read row by
// row. Confirmed directly with the user: this is the actual need behind
// "Tracking" for those three departments — drivers themselves just need
// a one-tap hand-off to their own Maps app (already built,
// DriverTripsScreen.tsx / DriverQuickActionsSheet.tsx), this is the
// company-monitoring side.
//
// No react-native-maps / expo-maps (both need a custom dev-client build
// this machine can't produce). Instead: react-native-webview (already
// installed) rendering Leaflet.js from a CDN inside its own sandboxed
// context, over free OpenStreetMap tiles — same approach already used
// for turn-by-turn navigation before that was scoped back to a plain
// Maps hand-off; the map-rendering technique itself is exactly what was
// needed here all along.
//
// Same source data TrackingScreen.tsx's list already reads
// (drivers + latest driver_locations row per driver) — this is a second,
// map-shaped view of the same real data, not a new data source. Polls
// every 15s (matching the GPS ping interval this app already offers as
// a CEO setting) rather than a live Realtime subscription, consistent
// with every other polling-based screen in this app.
//
// Direct-correction pass: real per-driver speed/heading (straight off
// the phone's own GPS — see DispatchHomeScreen.tsx's watchPositionAsync
// callback, which now persists both), a car icon that actually rotates
// to face the direction of travel instead of a plain dot, and a
// road-speed-limit check via OpenStreetMap's free Overpass API (user's
// explicit choice over a paid Roads API) — fetched only for the driver
// the viewer taps, not on every poll for every marker, since Overpass is
// a shared, rate-limited public service. Nothing here is hardcoded or
// seeded: every driver on this map is a real row in `drivers`, created
// the same way any new driver sign-up already is, and disappears from
// the map the moment they stop reporting a location.
import { createElement, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { X, Gauge } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';

// react-native-webview's <WebView> has no web-platform implementation
// (confirmed live: it renders "RNCWebView doesn't support this
// platform" instead of content) — on native (iOS/Android via Expo Go)
// it works as built, but this app's Browser-pane preview runs on the
// web platform, where a plain <iframe> hosting the exact same HTML is
// the real equivalent. Both support postMessage in and message-event
// out the same way, so MAP_HTML's own script needs zero changes.
const isWeb = Platform.OS === 'web';

// react-native's own JSX namespace has no `iframe` intrinsic (it's a raw
// DOM tag, not an RN component) — createElement + an `any` cast is the
// standard escape hatch, and it's only ever invoked when isWeb is true,
// i.e. when the underlying renderer really is react-dom.
function createIframe(props: Record<string, unknown>) {
  return createElement('iframe' as any, props as any);
}

interface DriverPoint {
  id: string;
  full_name: string;
  status: string;
  vehicle_id: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  /** Real device GPS speed, meters/second — null when the device hasn't
   * reported one (stationary, low-accuracy fix), never invented. */
  speed: number | null;
  /** Real device GPS heading, degrees clockwise from north — null when
   * unavailable, never invented. When null the marker falls back to a
   * plain dot rather than guessing a facing direction. */
  heading: number | null;
  recordedAt: string;
}

const STALE_MINUTES = 10;

function statusColor(status: string, stale: boolean): string {
  if (stale) return '#94a3b8';
  if (status === 'ON_DELIVERY' || status === 'ON_TRIP') return '#3b82f6';
  if (status === 'ACTIVE' || status === 'AVAILABLE') return '#22c55e';
  return '#94a3b8';
}

function speedKmh(speedMs: number | null): number | null {
  if (speedMs == null || speedMs < 0) return null;
  return Math.round(speedMs * 3.6);
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e2e8f0; }
    .fleet-dot { border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
    .fleet-car-wrap { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; }
    .fleet-car-badge {
      position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
      background: #0f172a; color: #fff; font: 700 9px sans-serif; padding: 1px 4px;
      border-radius: 6px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([5.6037, -0.187], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    const markers = {};
    let fittedOnce = false;

    function carSvg(color) {
      return '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="7" y="3" width="12" height="20" rx="5" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>' +
        '<rect x="9.5" y="6.5" width="7" height="5.5" rx="1.5" fill="rgba(255,255,255,0.9)"/>' +
        '</svg>';
    }

    function markerHtml(p) {
      if (p.heading == null) {
        return '<div class="fleet-dot" style="width:16px;height:16px;background:' + p.color + '"></div>';
      }
      var badge = (p.speedKmh != null && p.speedKmh > 2) ? '<div class="fleet-car-badge">' + p.speedKmh + ' km/h</div>' : '';
      return '<div style="position:relative;">' + badge +
        '<div class="fleet-car-wrap" style="transform: rotate(' + p.heading + 'deg);">' + carSvg(p.color) + '</div>' +
        '</div>';
    }

    function render(points) {
      const seen = new Set();
      points.forEach(function (p) {
        seen.add(p.id);
        const size = p.heading == null ? [16, 16] : [30, 30];
        const icon = L.divIcon({ className: '', html: markerHtml(p), iconSize: size });
        if (markers[p.id]) {
          markers[p.id].setLatLng([p.latitude, p.longitude]);
          markers[p.id].setIcon(icon);
        } else {
          const m = L.marker([p.latitude, p.longitude], { icon: icon }).addTo(map);
          m.on('click', function () {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: p.id }));
          });
          markers[p.id] = m;
        }
      });
      Object.keys(markers).forEach(function (id) {
        if (!seen.has(id)) { map.removeLayer(markers[id]); delete markers[id]; }
      });
      if (!fittedOnce && points.length > 0) {
        fittedOnce = true;
        const group = L.featureGroup(Object.values(markers));
        map.fitBounds(group.getBounds().pad(0.3));
      }
    }

    function handleMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'points') render(msg.points);
      } catch (e) {}
    }
    document.addEventListener('message', function (e) { handleMessage(e.data); });
    window.addEventListener('message', function (e) { handleMessage(e.data); });
  </script>
</body>
</html>`;

// Free OpenStreetMap Overpass lookup for the posted speed limit of the
// nearest tagged road to a point — user's explicit choice over a paid
// Roads API. Best-effort: many roads (especially untagged local streets)
// have no maxspeed tag at all, and this returns null rather than a
// guess when that happens. Called only once per tap on a driver, not on
// every poll for every marker, since this is a shared, rate-limited
// public service.
async function fetchSpeedLimitKmh(lat: number, lng: number): Promise<number | null> {
  const query = `[out:json][timeout:8];way(around:40,${lat},${lng})["highway"]["maxspeed"];out tags center 5;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
    const data = await res.json();
    const elements: any[] = data?.elements || [];
    if (elements.length === 0) return null;

    // Overpass's `around` filter already limits results to ways with a
    // node within 40m — pick the one whose returned center is literally
    // nearest to the tapped point rather than trusting result order.
    let best: any = null;
    let bestDist = Infinity;
    for (const el of elements) {
      const c = el.center;
      if (!c) continue;
      const d = Math.hypot(c.lat - lat, c.lon - lng);
      if (d < bestDist) { bestDist = d; best = el; }
    }
    const raw = best?.tags?.maxspeed;
    if (!raw) return null;

    const mphMatch = /^(\d+)\s*mph$/i.exec(raw);
    if (mphMatch) return Math.round(parseFloat(mphMatch[1]) * 1.60934);
    const numeric = /^(\d+)(\s*km\/?h)?$/i.exec(raw);
    if (numeric) return parseInt(numeric[1], 10);
    return null; // e.g. "national", "walk", "none" — no numeric limit to compare against
  } catch {
    return null;
  }
}

export default function FleetMap() {
  const t = useTheme();
  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [drivers, setDrivers] = useState<DriverPoint[]>([]);
  const [selected, setSelected] = useState<DriverPoint | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [speedLimit, setSpeedLimit] = useState<number | null | 'loading'>(null);

  const postToChild = useCallback((payload: object) => {
    if (isWeb) {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    } else {
      webviewRef.current?.postMessage(JSON.stringify(payload));
    }
  }, []);

  const load = useCallback(async () => {
    const { data: driverRows } = await supabase.from('drivers').select('id, full_name, status, vehicle_id, phone');
    const ids = (driverRows || []).map((d: any) => d.id);
    if (ids.length === 0) { setDrivers([]); return; }

    const { data: locRows } = await supabase
      .from('driver_locations')
      .select('driver_id, latitude, longitude, speed, heading, recorded_at')
      .in('driver_id', ids)
      .order('recorded_at', { ascending: false })
      .limit(500);

    const latestByDriver: Record<string, any> = {};
    for (const l of locRows || []) {
      if (!latestByDriver[l.driver_id]) latestByDriver[l.driver_id] = l;
    }

    const points: DriverPoint[] = (driverRows || [])
      .filter((d: any) => latestByDriver[d.id])
      .map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        status: d.status,
        vehicle_id: d.vehicle_id,
        phone: d.phone,
        latitude: latestByDriver[d.id].latitude,
        longitude: latestByDriver[d.id].longitude,
        speed: latestByDriver[d.id].speed ?? null,
        heading: latestByDriver[d.id].heading ?? null,
        recordedAt: latestByDriver[d.id].recorded_at,
      }));

    setDrivers(points);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!isWeb || iframeLoaded) {
      const payload = drivers.map((d) => {
        const stale = Date.now() - new Date(d.recordedAt).getTime() > STALE_MINUTES * 60000;
        return {
          id: d.id,
          latitude: d.latitude,
          longitude: d.longitude,
          color: statusColor(d.status, stale),
          heading: stale ? null : d.heading,
          speedKmh: speedKmh(d.speed),
        };
      });
      postToChild({ type: 'points', points: payload });
    }
  }, [drivers, iframeLoaded, postToChild]);

  // Web-only: the iframe's "select" messages arrive via the browser's own
  // window message event, not a WebView onMessage prop.
  useEffect(() => {
    if (!isWeb) return;
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'select') {
          setDrivers((current) => {
            const d = current.find((x) => x.id === msg.id);
            if (d) setSelected(d);
            return current;
          });
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Speed-limit lookup runs only for the driver actually tapped, and only
  // once per tap — not on a timer, and not for every marker on the map.
  useEffect(() => {
    if (!selected) { setSpeedLimit(null); return; }
    let cancelled = false;
    setSpeedLimit('loading');
    fetchSpeedLimitKmh(selected.latitude, selected.longitude).then((limit) => {
      if (!cancelled) setSpeedLimit(limit);
    });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.latitude, selected?.longitude]);

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  const selectedSpeedKmh = selected ? speedKmh(selected.speed) : null;
  const isOverLimit = typeof speedLimit === 'number' && selectedSpeedKmh != null && selectedSpeedKmh > speedLimit;

  return (
    <View style={{ flex: 1, minHeight: 420, borderRadius: t.radius.lg, overflow: 'hidden' }}>
      {isWeb
        ? // Plain iframe — react-native-webview has no web target, this is
          // the real browser equivalent hosting the identical MAP_HTML.
          createIframe({
            ref: iframeRef,
            srcDoc: MAP_HTML,
            style: { flex: 1, border: 0, width: '100%', height: '100%' },
            onLoad: () => {
              setIframeLoaded(true);
              const payload = drivers.map((d) => {
                const stale = Date.now() - new Date(d.recordedAt).getTime() > STALE_MINUTES * 60000;
                return {
                  id: d.id,
                  latitude: d.latitude,
                  longitude: d.longitude,
                  color: statusColor(d.status, stale),
                  heading: stale ? null : d.heading,
                  speedKmh: speedKmh(d.speed),
                };
              });
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'points', points: payload }), '*');
            },
          })
        : (
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: MAP_HTML }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            onLoadEnd={() => {
              // Fires once the page (and its own message listeners) is ready
              // — pushes whatever we already have instead of waiting for the
              // next 15s poll tick.
              const payload = drivers.map((d) => {
                const stale = Date.now() - new Date(d.recordedAt).getTime() > STALE_MINUTES * 60000;
                return {
                  id: d.id,
                  latitude: d.latitude,
                  longitude: d.longitude,
                  color: statusColor(d.status, stale),
                  heading: stale ? null : d.heading,
                  speedKmh: speedKmh(d.speed),
                };
              });
              webviewRef.current?.postMessage(JSON.stringify({ type: 'points', points: payload }));
            }}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'select') {
                  const d = drivers.find((x) => x.id === msg.id);
                  if (d) setSelected(d);
                }
              } catch {}
            }}
          />
        )}

      {drivers.length === 0 && (
        // A small floating banner, not a full opaque cover — per direct
        // correction ("the live map doesn't show"), hiding the real map
        // tiles behind a solid empty-state box made the map itself look
        // broken/missing whenever no driver has reported a location yet.
        // The map (empty, centered on Accra) is still visible underneath.
        <View
          style={{
            position: 'absolute', top: t.spacing.md, left: t.spacing.md, right: t.spacing.md,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md,
            alignItems: 'center', ...t.shadow('raised'),
          }}
        >
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No drivers reporting a location yet</Text>
        </View>
      )}

      {selected && (
        <View
          style={{
            position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: t.spacing.md,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.md,
            gap: t.spacing.sm, ...t.shadow('raised'),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor(selected.status, Date.now() - new Date(selected.recordedAt).getTime() > STALE_MINUTES * 60000) }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{selected.full_name}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
                {selected.status.replace(/_/g, ' ')} · {selected.vehicle_id || 'No vehicle'}{selected.phone ? ` · ${selected.phone}` : ''} · {timeAgo(selected.recordedAt)}
              </Text>
            </View>
            <Pressable onPress={() => setSelected(null)} hitSlop={8} style={{ padding: 4 }}>
              <X size={16} color={t.colors.textMuted} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
              backgroundColor: isOverLimit ? `${t.colors.status.danger.text}18` : t.colors.bgPage,
              borderRadius: t.radius.md, paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm,
            }}
          >
            <Gauge size={14} color={isOverLimit ? t.colors.status.danger.text : t.colors.textMuted} />
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: isOverLimit ? t.colors.status.danger.text : t.colors.textSecondary }}>
              {selectedSpeedKmh != null ? `${selectedSpeedKmh} km/h` : 'Speed unavailable'}
              {'  ·  '}
              {speedLimit === 'loading'
                ? 'Checking road limit…'
                : typeof speedLimit === 'number'
                ? `Limit ${speedLimit} km/h${isOverLimit ? ' — OVER LIMIT' : ''}`
                : 'Road limit unknown'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
