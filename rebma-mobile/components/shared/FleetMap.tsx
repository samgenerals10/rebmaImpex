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
import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';

interface DriverPoint {
  id: string;
  full_name: string;
  status: string;
  vehicle_id: string | null;
  latitude: number;
  longitude: number;
  recordedAt: string;
}

const STALE_MINUTES = 10;

function statusColor(status: string, stale: boolean): string {
  if (stale) return '#94a3b8';
  if (status === 'ON_DELIVERY' || status === 'ON_TRIP') return '#3b82f6';
  if (status === 'ACTIVE' || status === 'AVAILABLE') return '#22c55e';
  return '#94a3b8';
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e2e8f0; }
    .fleet-dot { border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
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

    function render(points) {
      const seen = new Set();
      points.forEach(function (p) {
        seen.add(p.id);
        const icon = L.divIcon({ className: '', html: '<div class="fleet-dot" style="width:16px;height:16px;background:' + p.color + '"></div>', iconSize: [16, 16] });
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

export default function FleetMap() {
  const t = useTheme();
  const webviewRef = useRef<WebView>(null);
  const [drivers, setDrivers] = useState<DriverPoint[]>([]);
  const [selected, setSelected] = useState<DriverPoint | null>(null);

  const load = useCallback(async () => {
    const { data: driverRows } = await supabase.from('drivers').select('id, full_name, status, vehicle_id');
    const ids = (driverRows || []).map((d: any) => d.id);
    if (ids.length === 0) { setDrivers([]); return; }

    const { data: locRows } = await supabase
      .from('driver_locations')
      .select('driver_id, latitude, longitude, recorded_at')
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
        latitude: latestByDriver[d.id].latitude,
        longitude: latestByDriver[d.id].longitude,
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
    const payload = drivers.map((d) => {
      const stale = Date.now() - new Date(d.recordedAt).getTime() > STALE_MINUTES * 60000;
      return { id: d.id, latitude: d.latitude, longitude: d.longitude, color: statusColor(d.status, stale) };
    });
    webviewRef.current?.postMessage(JSON.stringify({ type: 'points', points: payload }));
  }, [drivers]);

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  return (
    <View style={{ flex: 1, minHeight: 420, borderRadius: t.radius.lg, overflow: 'hidden' }}>
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
            return { id: d.id, latitude: d.latitude, longitude: d.longitude, color: statusColor(d.status, stale) };
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

      {drivers.length === 0 && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bgCard }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No drivers reporting a location yet</Text>
        </View>
      )}

      {selected && (
        <View
          style={{
            position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: t.spacing.md,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.md,
            flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, ...t.shadow('raised'),
          }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor(selected.status, Date.now() - new Date(selected.recordedAt).getTime() > STALE_MINUTES * 60000) }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{selected.full_name}</Text>
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
              {selected.status.replace(/_/g, ' ')} · {selected.vehicle_id || 'No vehicle'} · {timeAgo(selected.recordedAt)}
            </Text>
          </View>
          <Pressable onPress={() => setSelected(null)} hitSlop={8} style={{ padding: 4 }}>
            <X size={16} color={t.colors.textMuted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
