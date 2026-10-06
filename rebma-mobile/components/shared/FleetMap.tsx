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
//
// Second direct-correction pass (route/trail/call/geocoding): per the
// user's own explicit choice, the plain car silhouette is replaced with
// a more detailed illustrated car graphic (not a literal photo — a real
// photo distorts and blurs when rotated/scaled at marker size, the same
// reason Uber/Bolt/Google Maps all use illustrated icons, not photos,
// for this exact spot; explained and agreed with the user directly).
// Route line uses OSRM's free public demo routing server (no API key,
// same "free public service" spirit as the Overpass speed-limit lookup,
// same honest caveat: shared and not meant for heavy production load).
// Reverse geocoding (real place names) uses Nominatim, also free —
// fetched once per selection, not on every poll tick, respecting
// Nominatim's own usage policy against high-frequency calls. Trail and
// route both key off the selected driver's own latest position, so they
// recompute live as that driver's GPS ping updates, without a second
// polling loop.
import { createElement, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Platform, Linking, Animated, Easing, Modal, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  X, Gauge, Navigation, Phone, MessageCircle, Search, Layers, Locate, Maximize2, Minimize2,
  Landmark, Play, Pause, ChevronLeft, ChevronRight, Warehouse, Truck, Clock,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabaseClient';
import { Alert } from '../../lib/appAlert';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { getFleetSpeedLimitKmh, setFleetSpeedLimitKmh, DEFAULT_FLEET_SPEED_LIMIT_KMH } from '../../lib/fleetSpeedLimit';
import { getCeoSetting } from '../../lib/ceoSetting';
import Avatar from '../ui/Avatar';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { setActiveInterval } from '../../lib/activeInterval';

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
  /** drivers.driver_id — the short business id (e.g. "DRV-QA01"), which
   * is what driver_locations.driver_id actually references, NOT this
   * row's own `id` UUID. Kept separately so the trail query below (and
   * anything else reading driver_locations) uses the right column. */
  driverBusinessId: string;
  full_name: string;
  status: string;
  vehicle_id: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  /** False when this driver has never reported a real GPS position —
   * `latitude`/`longitude` are then Rebma Impex Limited's own real
   * coordinates (see REBMA_HQ), the true, physical place every driver's
   * day actually starts, not a fabricated GPS reading. Everything that
   * would otherwise treat this as a live report (staleness, "time ago",
   * the speed badge) checks this flag first. */
  hasRealLocation: boolean;
  /** Real device GPS speed, meters/second — null when the device hasn't
   * reported one (stationary, low-accuracy fix), never invented. */
  speed: number | null;
  /** Real device GPS heading, degrees clockwise from north — null when
   * unavailable (stationary, or hasn't reported yet), never invented.
   * The marker still renders as a car (see markerHtml) using a neutral
   * default facing when this is null — only a stale/offline driver ever
   * falls back to a plain dot. */
  heading: number | null;
  recordedAt: string | null;
  /** Real photo from the driver's own linked profile (drivers.user_id ->
   * profiles.photo), or null when they haven't set one — Avatar's own
   * initials fallback handles that case, nothing fabricated here. */
  photo: string | null;
  /** The driver's current active delivery's own status ('ASSIGNED' or
   * 'IN_TRANSIT'), or null when they have none right now — this is what
   * actually drives the marker's color (see markerColor()), not the
   * coarser drivers.status field. */
  deliveryStatus: string | null;
  /** The driver's current active delivery, if any — real rows from
   * delivery_logs, not invented. Null fields mean "no active delivery on
   * file right now", rendered as an honest empty state, not hidden. */
  deliveryAddress: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
}

interface RouteInfo {
  coords: [number, number][]; // [lat, lng] pairs, already swapped from OSRM's [lng, lat]
  distanceMeters: number;
  durationSeconds: number;
}

const STALE_MINUTES = 10;
const TRAIL_LOOKBACK_MINUTES = 60;
const TRAIL_MAX_POINTS = 40;

// Four real, distinguishable states — driven by the driver's actual
// active delivery_logs.status plus real, live GPS speed, never invented.
// "Returning to base" has no dedicated database column (no delivery_logs
// status exists for a post-delivery return trip), so it's an honest
// inference from state that IS real: no active delivery assigned, a
// real non-stale location on file, and currently, actually moving. A
// driver sitting still with no job is "Available"; the exact same driver
// moving with no job is "Returning" — the distinction is real telemetry,
// not a guess.
function markerColor(deliveryStatus: string | null, stale: boolean, movingWithNoJob: boolean): { color: string; label: string } {
  if (stale) return { color: '#94a3b8', label: 'Offline' };
  if (deliveryStatus === 'IN_TRANSIT') return { color: '#3b82f6', label: 'En route to delivery' };
  if (deliveryStatus === 'ASSIGNED') return { color: '#f59e0b', label: 'Assigned, preparing to depart' };
  if (movingWithNoJob) return { color: '#14b8a6', label: 'Returning to Rebma Impex Limited' };
  return { color: '#22c55e', label: 'Available' };
}

function speedKmh(speedMs: number | null): number | null {
  if (speedMs == null || speedMs < 0) return null;
  return Math.round(speedMs * 3.6);
}

// One shared builder for the 'points' message, used at all 3 places it's
// posted (the polling effect, and the web/native initial-load handlers)
// — deliberately not duplicated a 4th time, since this exact "3 copies of
// the same mapper" shape is what caused real, confirmed bugs elsewhere in
// this app before (the customer/staff re-map drift, see this project's
// own history). `stale` now travels with each point so the map can
// decide whether to show the live-pulse ring (animation 2). `overLimit`
// is computed here, live, for every driver against Risk's own
// fleetSpeedLimitKmh — cheap (a local number compare), unlike the
// road's own legal-limit lookup below, which stays deliberately scoped
// to just the selected driver since it costs a real external API call.
function buildPointsPayload(drivers: DriverPoint[], fleetSpeedLimitKmh: number) {
  return drivers.map((d) => {
    // A driver who hasn't started sharing GPS yet isn't "stale" (that
    // means was reporting and stopped) — they're simply at Rebma Impex
    // Limited, not yet on the road, which is a real, current, correct
    // status, not an anomaly to grey out.
    const stale = d.hasRealLocation && d.recordedAt != null
      ? Date.now() - new Date(d.recordedAt).getTime() > STALE_MINUTES * 60000
      : false;
    const kmh = speedKmh(d.speed);
    const movingWithNoJob = !d.deliveryStatus && !stale && kmh != null && kmh > 2;
    const { color } = markerColor(d.deliveryStatus, stale, movingWithNoJob);
    return {
      id: d.id,
      latitude: d.latitude,
      longitude: d.longitude,
      color,
      heading: d.heading,
      speedKmh: kmh,
      fleetLimitKmh: fleetSpeedLimitKmh,
      stale,
      overLimit: !stale && kmh != null && kmh > fleetSpeedLimitKmh,
    };
  });
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function etaClockTime(seconds: number): string {
  const eta = new Date(Date.now() + seconds * 1000);
  return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Animation 9: three dots pulsing in sequence while the road-limit or
// route lookup is in flight — replaces what was static "…" text, so a
// genuinely-working background fetch actually reads as "in progress"
// rather than looking like nothing is happening.
function LoadingDots({ color }: { color: string }) {
  const values = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;

  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 350, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 350, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 3, marginLeft: 2 }}>
      {values.map((v, i) => (
        <Animated.View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, opacity: v }} />
      ))}
    </View>
  );
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #0F172A; }
    .fleet-dot { border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
    .fleet-car-wrap { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2; }
    .fleet-car-badge {
      position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
      background: #0f172a; color: #fff; font: 700 9px sans-serif; padding: 1px 4px;
      border-radius: 6px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .fleet-dest-pin { display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5)); animation: fleetPinDrop 0.55s cubic-bezier(.34,1.56,.64,1); }

    /* Neon ground halo pulse for fixed waypoints */
    @keyframes neonHaloPulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 0.25; }
    }
    .leaflet-interactive.fleet-neon-halo { animation: neonHaloPulse 3s ease-in-out infinite; }

    /* Animation 1: smooth marker movement */
    .leaflet-marker-icon { transition: transform 0.8s linear; }

    /* Animation 2: pulsing ring behind live drivers */
    .fleet-pulse-ring {
      position: absolute; top: 50%; left: 50%; width: 40px; height: 40px;
      margin-top: -20px; margin-left: -20px; border-radius: 50%; z-index: 1;
      background: radial-gradient(circle, rgba(34,197,94,0.35) 0%, rgba(34,197,94,0) 70%);
      animation: fleetPulse 2s ease-out infinite;
    }
    @keyframes fleetPulse {
      0% { transform: scale(0.5); opacity: 0.9; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* Animation 3: new marker pop-in */
    @keyframes fleetPopIn {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    .fleet-pop-in { animation: fleetPopIn 0.4s cubic-bezier(.34,1.56,.64,1); }

    /* Animation 4: marker fade-out */
    .leaflet-marker-icon.fleet-fading { transition: opacity 0.4s ease, transform 0.8s linear; opacity: 0 !important; }

    /* Animation 5: over-limit danger pulse */
    @keyframes fleetDangerPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
      50% { box-shadow: 0 0 0 9px rgba(239,68,68,0); }
    }
    .fleet-car-wrap.fleet-over-limit { border-radius: 50%; animation: fleetDangerPulse 1.1s ease-out infinite; }

    /* Animation 6: destination pin bounce */
    @keyframes fleetPinDrop {
      0% { transform: translateY(-22px) scale(0.6); opacity: 0; }
      65% { transform: translateY(3px) scale(1.05); opacity: 1; }
      100% { transform: translateY(0) scale(1); }
    }

    /* Tooltips, both the default (place-name) style and the dark info
       style, roughly half the padding/font-size of Leaflet's own
       default, so a label reads as a small compact chip, not a big box. */
    .leaflet-tooltip {
      padding: 3px 6px;
      font-size: 9px;
      border-radius: 4px;
    }
    .leaflet-tooltip.fleet-info-tooltip {
      background: #0f172a; color: #fff; font: 700 9px sans-serif; padding: 2px 5px;
      border-radius: 5px; border: none; box-shadow: 0 1px 4px rgba(0,0,0,0.35); white-space: nowrap;
    }
    .leaflet-tooltip.fleet-info-tooltip::before { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script>
    // Initial paint, before any real driver data arrives, centered on
    // Rebma Impex Limited itself (the same coordinate CENTRAL_DEPOT below
    // uses), since that's the real, physical place a driver with no GPS
    // fix yet defaults to. This used to be a leftover placeholder Accra
    // coordinate (5.6037, -0.187) from before the depot location was
    // corrected, ~13km from the real depot, which pushed every driver
    // marker off-screen on first load until fitBounds (below) caught up.
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([5.694949, -0.010621], 14);

    // Real, confirmed bug fix: Leaflet caches its container's pixel size
    // at creation time and only recomputes marker/tile positions against
    // that cached size, it never re-measures on its own. The WebView/
    // iframe hosting this map can genuinely resize after that (the RN
    // side's own layout settling, a tab switch, entering/leaving
    // fullscreen, an orientation change), and once the cached size goes
    // stale every latlng-to-pixel conversion is wrong, markers compute a
    // pixel position far outside the real visible area and simply never
    // appear, even though their own lat/lng, icon, and cluster membership
    // are all completely correct (confirmed directly: a driver's own
    // marker had the right coordinates and was a real member of the
    // cluster, but its computed container point was hundreds of pixels
    // outside the actual, much larger, rendered viewport). A ResizeObserver
    // on the map's own container is the standard fix for an embedded,
    // responsively-sized Leaflet map, it calls invalidateSize() every
    // time the real box actually changes, keeping Leaflet's cache honest.
    const mapEl = document.getElementById('map');
    if (mapEl && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(function () {
        map.invalidateSize();
      });
      ro.observe(mapEl);
    }
    // Also catch it once on the next tick after initial load, in case the
    // very first measurement raced with the surrounding page's own layout
    // still settling (before the observer's first real resize fires).
    setTimeout(function () { map.invalidateSize(); }, 0);

    // Basemap layers: street (OpenStreetMap) and satellite (Esri World
    // Imagery), both genuinely free, no API key. A third "3D Voyager"
    // CartoDB layer was tried here at one point; dropped because CartoDB
    // now gates that tile endpoint behind a paid API key, so it rendered
    // nothing but "API KEY REQUIRED" watermark tiles as the default view.
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    streetLayer.addTo(map);
    let currentBasemap = 'street';
    // A real, modern-styled basemap, only exists once Risk enters a real
    // MapTiler key in Control Center's new API Keys section (see
    // 'set-maptiler-key' below). No key means no layer, and the toggle
    // stays a plain, honest street/satellite choice on free tiles, never
    // a fake "modern" option that silently isn't actually configured.
    let modernLayer = null;
    let userPickedBasemap = false;
    function setBasemap(mode) {
      if (mode === currentBasemap) return;
      [streetLayer, satelliteLayer, modernLayer].forEach(function(l) { if (l && map.hasLayer(l)) map.removeLayer(l); });
      if (mode === 'satellite') satelliteLayer.addTo(map);
      else if (mode === 'modern' && modernLayer) modernLayer.addTo(map);
      else streetLayer.addTo(map);
      currentBasemap = mode;
    }

    // Fixed waypoint constants. CENTRAL_DEPOT is Rebma Impex Limited's
    // own real, confirmed location (from a Google Maps link the user
    // shared), this is also the real, physical place every driver's day
    // actually starts, and doubles as the default position for a driver
    // who hasn't started sharing live GPS yet (see buildPointsPayload's
    // REBMA_HQ fallback below). No longer the placeholder Accra
    // coordinate this used to share with rebma-web's DispatchMap.tsx —
    // that web file still has the old placeholder value, a known,
    // deliberate divergence, not an oversight.
    var TEMA_PORT = [5.6268, -0.0076];
    var CENTRAL_DEPOT = [5.694949, -0.010621];

    // Neon ground halos for fixed waypoints
    var depotHalo = L.circle(CENTRAL_DEPOT, {
      radius: 400, color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.16,
      weight: 2.5, dashArray: '5, 5', className: 'fleet-neon-halo'
    }).addTo(map);
    var portHalo = L.circle(TEMA_PORT, {
      radius: 500, color: '#10B981', fillColor: '#10B981', fillOpacity: 0.14,
      weight: 2.5, dashArray: '5, 5', className: 'fleet-neon-halo'
    }).addTo(map);

    // Teardrop pin icons for fixed waypoints
    function teardropPin(color, emoji) {
      var pin = '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.8 20.2 0 13 0z" fill="' + color + '"/>' +
        '<circle cx="13" cy="13" r="9.5" fill="#fff"/>' +
        '</svg>';
      return L.divIcon({
        className: '',
        html: '<div style="position:relative;width:26px;height:34px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.4));">' + pin +
          '<div style="position:absolute;top:1px;left:0;width:26px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;">' + emoji + '</div>' +
          '</div>',
        iconSize: [26, 34],
        iconAnchor: [13, 34],
      });
    }

    // Fixed waypoint markers, real company reference points. The
    // quick-jump chip buttons for these live on the RN side (in the
    // search dropdown), not as HTML elements floating inside this
    // WebView/iframe, that avoided a real stacking conflict, since an
    // absolutely-positioned element in here at top-left would sit
    // directly under the RN Fleet Speed Limit banner and weather chip,
    // which occupy that same screen region from outside the WebView.
    // Tapping a waypoint pin now opens a small RN-side info card (name +
    // a Directions action), matching the shape of Google Maps' own
    // location card the user pointed to as a reference, a rounded card
    // with an icon-in-circle quick action under the place name, not a
    // plain black tooltip bubble.
    L.marker(CENTRAL_DEPOT, { icon: teardropPin('#2563EB', '🏭') })
      .bindTooltip('Rebma Impex Limited', { direction: 'top' })
      .on('click', function () { sendToParent({ type: 'select-waypoint', label: 'Rebma Impex Limited', lat: CENTRAL_DEPOT[0], lng: CENTRAL_DEPOT[1] }); })
      .addTo(map);
    L.marker(TEMA_PORT, { icon: teardropPin('#10B981', '⚓') })
      .bindTooltip('Tema Port Intake', { direction: 'top' })
      .on('click', function () { sendToParent({ type: 'select-waypoint', label: 'Tema Port Intake', lat: TEMA_PORT[0], lng: TEMA_PORT[1] }); })
      .addTo(map);

    // Real, confirmed bug fix: this group was referenced (.addLayer/
    // .removeLayer, inside render() below) but never actually declared
    // anywhere, and its own CDN plugin was loaded for nothing. Every call
    // to render(points) threw "markerCluster is not defined" the moment a
    // real driver point existed, inside handleMessage's own try/catch —
    // swallowed silently, so no driver marker (car or stale dot) ever
    // reached the map, no matter how correct the RN-side data was.
    // disableClusteringAtZoom keeps individual driver icons/colors visible
    // at any normal fleet-viewing zoom; only very zoomed-out views bundle
    // nearby drivers into a plain count bubble.
    const markerCluster = L.markerClusterGroup({
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
    });
    markerCluster.addTo(map);

    const markers = {};
    let fittedOnce = false;
    let firstRenderSent = false;
    let routeLine = null;
    let trailLine = null;
    let destMarker = null;
    // Which driver marker (if any) currently carries the road-legal-limit
    // tooltip, and the nearest-other-driver connector line, both live
    // directly on the map now, bound/unbound as selection changes.
    let roadLimitMarkerId = null;
    let nearestLine = null;

    // Structures & Places layer, real nearby OSM-tagged places (fuel,
    // hospital, police, market, bus/lorry station, warehouse), shown only
    // around the selected driver and only while toggled on from the RN
    // side. Kept off the marker cluster group entirely, these aren't
    // fleet vehicles.
    const placesLayer = L.layerGroup();
    // Teardrop pin with a white inner circle and the category's icon
    // centered inside, a color-coded pin + icon badge, matching the
    // reference the user shared (colored pin + icon, not a plain dot).
    function placeCategoryColor(category) {
      return { fuel: '#f59e0b', hospital: '#ef4444', police: '#3b82f6', market: '#10b981', station: '#8b5cf6', warehouse: '#64748b', place: '#0f172a' }[category] || '#0f172a';
    }
    function placeIcon(category) {
      var emoji = { fuel: '⛽', hospital: '🏥', police: '🚓', market: '🛒', station: '🚌', warehouse: '🏭', place: '📍' }[category] || '📍';
      var color = placeCategoryColor(category);
      var pin = '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.8 20.2 0 13 0z" fill="' + color + '"/>' +
        '<circle cx="13" cy="13" r="9.5" fill="#fff"/>' +
        '</svg>';
      return L.divIcon({
        className: '',
        html: '<div style="position:relative;width:26px;height:34px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));">' + pin +
          '<div style="position:absolute;top:1px;left:0;width:26px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;">' + emoji + '</div>' +
          '</div>',
        iconSize: [26, 34],
        iconAnchor: [13, 34],
      });
    }
    function renderPlaces(places) {
      placesLayer.clearLayers();
      (places || []).forEach(function (p) {
        L.marker([p.lat, p.lng], { icon: placeIcon(p.category) }).bindTooltip(p.name, { direction: 'top' }).addTo(placesLayer);
      });
      if ((places || []).length > 0) {
        if (!map.hasLayer(placesLayer)) placesLayer.addTo(map);
      } else if (map.hasLayer(placesLayer)) {
        map.removeLayer(placesLayer);
      }
    }

    // Feature 7: trail replay, steps a small marker along a driver's own
    // already-fetched breadcrumb trail, reporting progress back to RN so
    // the panel can show "12 / 40" and a Stop button.
    let replayMarker = null;
    let replayInterval = null;
    function replayDotHtml() {
      return '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.35);"></div>';
    }
    function startReplay(trail) {
      stopReplay();
      if (!trail || trail.length < 2) return;
      var icon = L.divIcon({ className: '', html: replayDotHtml(), iconSize: [14, 14] });
      replayMarker = L.marker(trail[0], { icon: icon }).addTo(map);
      replayMarker.bindTooltip('1 / ' + trail.length, { permanent: true, direction: 'top', className: 'fleet-info-tooltip' }).openTooltip();
      var i = 0;
      replayInterval = setInterval(function () {
        if (i >= trail.length) {
          stopReplay();
          sendToParent({ type: 'replay-done' });
          return;
        }
        replayMarker.setLatLng(trail[i]);
        replayMarker.setTooltipContent((i + 1) + ' / ' + trail.length);
        sendToParent({ type: 'replay-progress', index: i, total: trail.length });
        i++;
      }, 350);
    }
    function stopReplay() {
      if (replayInterval) { clearInterval(replayInterval); replayInterval = null; }
      if (replayMarker) { map.removeLayer(replayMarker); replayMarker = null; }
    }

    // A more detailed, illustrated top-down car (windshield, roof
    // shading, wheel hints, headlight dots) rather than a plain rounded
    // rectangle, a real car IMAGE (a photograph) would blur and distort
    // when rotated to face travel direction at this size, so this is the
    // deliberate, explained alternative: a clean illustration, not a
    // photo, the same choice real navigation apps make for this exact UI
    // spot.
    function carSvg(color) {
      return '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="15" cy="16" rx="9" ry="12" fill="rgba(0,0,0,0.15)"/>' +
        '<rect x="6" y="3" width="18" height="23" rx="7" fill="' + color + '" stroke="#0f172a" stroke-width="1"/>' +
        '<rect x="8.5" y="6" width="13" height="6.5" rx="2" fill="#dbeafe" opacity="0.9"/>' +
        '<rect x="8.5" y="15" width="13" height="7" rx="2" fill="rgba(255,255,255,0.35)"/>' +
        '<circle cx="9.5" cy="5.5" r="1.3" fill="#fde68a"/>' +
        '<circle cx="20.5" cy="5.5" r="1.3" fill="#fde68a"/>' +
        '<rect x="4.5" y="9" width="2.5" height="5" rx="1.2" fill="#1e293b"/>' +
        '<rect x="23" y="9" width="2.5" height="5" rx="1.2" fill="#1e293b"/>' +
        '<rect x="4.5" y="18" width="2.5" height="5" rx="1.2" fill="#1e293b"/>' +
        '<rect x="23" y="18" width="2.5" height="5" rx="1.2" fill="#1e293b"/>' +
        '</svg>';
    }

    function destSvg(arrived) {
      var color = arrived ? '#16a34a' : '#ef4444';
      return '<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 23 15 23s15-11.75 15-23C30 6.7 23.3 0 15 0z" fill="' + color + '"/>' +
        '<circle cx="15" cy="15" r="6" fill="#fff"/>' +
        '</svg>';
    }

    function markerHtml(p, isNew) {
      // Animation 2's pulse ring only makes sense for a genuinely live,
      // non-stale vehicle, a greyed-out stale marker shouldn't look like
      // it's actively reporting.
      var pulse = p.stale ? '' : '<div class="fleet-pulse-ring"></div>';
      // The pop-in class deliberately goes on an OUTER wrapper, never on
      // .fleet-car-wrap itself, that element already owns its own
      // inline rotate() transform (real GPS heading), and a second
      // animated 'transform' on the same element would fight it and
      // leave the car facing the wrong way once the animation ends.
      var popClass = isNew ? ' fleet-pop-in' : '';
      // Every non-stale driver renders as the illustrated car, a real
      // reported heading rotates it to face the actual direction of
      // travel; no heading yet (stationary, or hasn't started moving
      // today) just faces it forward rather than guessing. Only a
      // genuinely stale/offline driver (was reporting, stopped) falls
      // back to a plain dot, that's a real, different status, not the
      // same thing as "hasn't moved yet."
      if (p.stale) {
        return pulse + '<div class="' + popClass.trim() + '"><div class="fleet-dot" style="width:16px;height:16px;background:' + p.color + '"></div></div>';
      }
      var heading = p.heading != null ? p.heading : 0;
      // Speed shown against the fleet limit directly on the marker
      // ("22/60 km/h"), the actionable number is now visible on the map
      // itself for every driver at a glance, not just the tapped one.
      var badge = (p.speedKmh != null && p.speedKmh > 2)
        ? '<div class="fleet-car-badge">' + p.speedKmh + '/' + p.fleetLimitKmh + ' km/h</div>'
        : '';
      var overLimitClass = p.overLimit ? ' fleet-over-limit' : '';
      return pulse + '<div class="' + popClass.trim() + '" style="position:relative;">' + badge +
        '<div class="fleet-car-wrap' + overLimitClass + '" style="transform: rotate(' + heading + 'deg);">' + carSvg(p.color) + '</div>' +
        '</div>';
    }

    // Direct correction, found while verifying this exact tap-to-select
    // interaction live: window.ReactNativeWebView only exists inside a
    // real native WebView. On the web-preview fallback (a plain iframe),
    // it's undefined, so the old unconditional call here threw on every
    // click and silently killed the selection feature in that context.
    // This picks whichever channel actually exists.
    function sendToParent(payload) {
      var json = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(json);
      } else if (window.parent) {
        window.parent.postMessage(json, '*');
      }
    }

    // Animation 4: a marker that stops being reported fades out instead
    // of just vanishing. Leaflet has no built-in animated removal, so
    // this fakes it, flip on the CSS opacity transition, then actually
    // detach the layer once that transition has had time to finish.
    function removeMarkerAnimated(id) {
      const m = markers[id];
      if (!m) return;
      delete markers[id];
      const el = m.getElement && m.getElement();
      if (el) {
        el.classList.add('fleet-fading');
        setTimeout(function () { markerCluster.removeLayer(m); }, 420);
      } else {
        // No element to fade (e.g. the marker is currently hidden inside
        // a cluster badge), just remove it from the cluster group.
        markerCluster.removeLayer(m);
      }
    }

    function render(points) {
      const seen = new Set();
      points.forEach(function (p) {
        seen.add(p.id);
        const isNew = !markers[p.id];
        const size = p.stale ? [16, 16] : [34, 34];
        const icon = L.divIcon({ className: '', html: markerHtml(p, isNew), iconSize: size });
        // Real, confirmed bug fix: a marker already inside a
        // MarkerClusterGroup does not reliably keep rendering after its
        // own setLatLng()/setIcon() is called, even a remove-then-readd
        // of that SAME marker instance was tested live and still went
        // invisible, which points at internal DOM-icon state the plugin
        // caches per marker instance across a removeLayer/addLayer cycle,
        // not just the well-known "don't call setLatLng while clustered"
        // limitation. The reliable fix, verified live for both the
        // initial add and every subsequent move: never mutate an existing
        // marker instance, always discard it and create a fresh one.
        // This is what actually made "a driver's car marker moves on the
        // map" work at all; without it, every driver's marker froze after
        // its first ever render, no matter how the position update
        // itself was implemented.
        if (markers[p.id]) {
          markerCluster.removeLayer(markers[p.id]);
          delete markers[p.id];
        }
        const m = L.marker([p.latitude, p.longitude], { icon: icon });
        m.on('click', function () {
          sendToParent({ type: 'select', id: p.id });
        });
        markerCluster.addLayer(m);
        markers[p.id] = m;
      });
      Object.keys(markers).forEach(function (id) {
        if (!seen.has(id)) removeMarkerAnimated(id);
      });
      if (!fittedOnce && points.length > 0) {
        fittedOnce = true;
        const group = L.featureGroup(Object.values(markers));
        // maxZoom caps how tight fitBounds is allowed to go, without it,
        // a single driver (a zero-area bounding box even after padding)
        // pushes the map to its absolute max zoom (19), showing almost no
        // street context around them. 16 still reads as "zoomed to that
        // driver" while keeping enough surrounding area visible to be
        // useful, and matches the initial setView's own zoom level above.
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 16 });
      }
      // Signals the wrapper that the real, edited map (with actual marker
      // icons/badges drawn, not just a bare tile layer) is now showing —
      // fires once, on the very first points render, so the RN side can
      // hide its loading cover exactly when there's something real to see
      // instead of a moment of the plain default map first.
      if (!firstRenderSent) {
        firstRenderSent = true;
        sendToParent({ type: 'ready' });
      }
    }

    // Animation 5 (every driver's marker glows/pulses red while over
    // Risk's fleet speed limit) is now driven straight from each point's
    // own 'overLimit' field in the regular 'points' message. Cheap
    // enough to compute for the whole fleet on every poll, since it's
    // just a local number compare against Risk's configured limit, not
    // an external API call. markerHtml() above already reads p.overLimit.

    // Animations 7 & 8: the trail and route lines "draw" themselves in
    // (the stroke progressively extending from nothing to its full
    // length) rather than just appearing fully formed. Leaflet renders
    // polylines as SVG <path> elements, so this is the standard SVG
    // stroke-dasharray/dashoffset trick, set the dash length to the
    // path's own total length (so it reads as one continuous unbroken
    // line, not a dashed one), start fully offset (invisible), then
    // transition the offset back to zero.
    function animateDrawIn(line, delayMs, durationSec) {
      if (!line || !line.getElement) return;
      const path = line.getElement();
      if (!path || !path.getTotalLength) return;
      const length = path.getTotalLength();
      path.style.strokeDasharray = length + ' ' + length;
      path.style.strokeDashoffset = length;
      // Force a reflow so the browser registers the starting state above
      // before the transition below is applied, without this the two
      // style writes get batched together and nothing visibly animates.
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset ' + durationSec + 's ease-out ' + delayMs + 'ms';
      path.style.strokeDashoffset = '0';
    }

    function clearSelectionLayers() {
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (trailLine) { map.removeLayer(trailLine); trailLine = null; }
      if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
      if (roadLimitMarkerId && markers[roadLimitMarkerId]) { markers[roadLimitMarkerId].unbindTooltip(); }
      roadLimitMarkerId = null;
      if (nearestLine) { map.removeLayer(nearestLine); nearestLine = null; }
    }

    function renderSelection(msg) {
      clearSelectionLayers();
      if (msg.trail && msg.trail.length > 1) {
        trailLine = L.polyline(msg.trail, { color: '#64748b', weight: 3, opacity: 0.6, dashArray: '2,8' }).addTo(map);
        setTimeout(function () { animateDrawIn(trailLine, 0, 0.9); }, 30);
      }
      if (msg.route && msg.route.length > 1) {
        routeLine = L.polyline(msg.route, { color: msg.routeColor || '#2563eb', weight: 5, opacity: 0.85 }).addTo(map);
        setTimeout(function () { animateDrawIn(routeLine, 150, 1.3); }, 30);
      }
      if (msg.destination) {
        const icon = L.divIcon({ className: 'fleet-dest-pin', html: destSvg(!!msg.arrived), iconSize: [30, 38], iconAnchor: [15, 38] });
        destMarker = L.marker([msg.destination.lat, msg.destination.lng], { icon: icon }).addTo(map);
        // Distance/ETA/countdown (or "Arrived") lives right on the
        // destination pin itself now, not as a text row in the panel.
        if (msg.routeLabel) {
          destMarker.bindTooltip(msg.routeLabel, { permanent: true, direction: 'top', offset: [0, -36], className: 'fleet-info-tooltip' }).openTooltip();
        }
      } else if (routeLine && msg.routeLabel) {
        // "Returning to base" has no synthetic destination pin, Rebma
        // Impex Limited already has its own permanent waypoint marker,
        // so the label binds to the route line itself instead.
        routeLine.bindTooltip(msg.routeLabel, { permanent: true, direction: 'center', className: 'fleet-info-tooltip' }).openTooltip();
      }
    }

    // Nearest-other-driver: a dashed connector line with a distance label
    // bound to its midpoint, drawn directly between the two markers —
    // replaces the "Nearest driver: X · Y away" text row.
    function renderNearest(msg) {
      if (nearestLine) { map.removeLayer(nearestLine); nearestLine = null; }
      if (!msg || !msg.from || !msg.to) return;
      nearestLine = L.polyline([msg.from, msg.to], { color: '#8b5cf6', weight: 2, opacity: 0.7, dashArray: '4,6' }).addTo(map);
      if (msg.label) {
        nearestLine.bindTooltip(msg.label, { permanent: true, direction: 'center', className: 'fleet-info-tooltip' }).openTooltip();
      }
    }

    function handleMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'points') render(msg.points);
        else if (msg.type === 'selection') renderSelection(msg);
        else if (msg.type === 'clear-selection') clearSelectionLayers();
        else if (msg.type === 'places') renderPlaces(msg.places);
        else if (msg.type === 'replay-start') startReplay(msg.trail);
        else if (msg.type === 'replay-stop') stopReplay();
        else if (msg.type === 'fit-all') {
          const vals = Object.values(markers);
          if (vals.length > 0) map.fitBounds(L.featureGroup(vals).getBounds().pad(0.3), { maxZoom: 16 });
        }
        else if (msg.type === 'focus') map.setView([msg.lat, msg.lng], 16, { animate: true });
        else if (msg.type === 'set-basemap') { userPickedBasemap = true; setBasemap(msg.mode); }
        else if (msg.type === 'set-maptiler-key') {
          if (msg.key) {
            modernLayer = L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=' + msg.key, { maxZoom: 20 });
            sendToParent({ type: 'modern-basemap-available' });
            // Only switch to it automatically the first time it becomes
            // available and nobody has already picked a basemap by hand
            // this session, never override an explicit choice.
            if (!userPickedBasemap && currentBasemap === 'street') setBasemap('modern');
          }
        }
        else if (msg.type === 'road-limit') {
          if (roadLimitMarkerId && markers[roadLimitMarkerId]) {
            markers[roadLimitMarkerId].unbindTooltip();
          }
          roadLimitMarkerId = null;
          if (msg.id && msg.label && markers[msg.id]) {
            markers[msg.id].bindTooltip(msg.label, { permanent: true, direction: 'right', offset: [18, 0], className: 'fleet-info-tooltip' }).openTooltip();
            roadLimitMarkerId = msg.id;
          }
        }
        else if (msg.type === 'route-label') {
          if (destMarker && destMarker.getTooltip()) destMarker.setTooltipContent(msg.label);
          else if (routeLine && routeLine.getTooltip()) routeLine.setTooltipContent(msg.label);
        }
        else if (msg.type === 'nearest-driver') renderNearest(msg);
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
    return null; // e.g. "national", "walk", "none", no numeric limit to compare against
  } catch {
    return null;
  }
}

// Free OSRM public demo routing server — real road-based routing (not a
// straight line), no API key. Same honest caveat as Overpass above: a
// shared public service, not meant for heavy production traffic. Returns
// null on any failure (offline, no road path found, service busy) rather
// than fabricating a route.
async function fetchRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<RouteInfo | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    const coords: [number, number][] = (route.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]]);
    return { coords, distanceMeters: route.distance, durationSeconds: route.duration };
  } catch {
    return null;
  }
}

// Free Nominatim reverse geocoding — a real place name instead of raw
// coordinates. Fetched once per selection (not on every position update)
// per Nominatim's own usage policy against high-frequency automated
// calls; a custom User-Agent is required by that same policy.
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
      { headers: { 'User-Agent': 'RebmaImpexFleetTracking/1.0' } }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

// Straight-line ground distance between two points, meters. Used for the
// "nearest other driver" figure and the destination-arrival geofence —
// both are simple proximity checks, not routing, so a plain haversine is
// the right tool rather than another OSRM call.
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ARRIVAL_RADIUS_METERS = 150;

// Fixed company reference points — same coordinates as the map's own
// pinned markers (see MAP_HTML) and rebma-web's DispatchMap.tsx, kept
// here too since the RN-side quick-jump control needs the coordinates
// and the WebView's own JS scope isn't reachable from out here.
const CENTRAL_DEPOT = { lat: 5.694949, lng: -0.010621, label: 'Rebma Impex Limited' };
const TEMA_PORT = { lat: 5.6268, lng: -0.0076, label: 'Tema Port Intake' };

// Free Open-Meteo current-weather lookup — no API key, generous free-tier
// limits. Fetched once per selection (matches the same low-frequency
// pattern as reverseGeocode), not on every GPS ping.
async function fetchWeather(lat: number, lng: number): Promise<{ tempC: number; code: number } | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
    const data = await res.json();
    const cw = data?.current_weather;
    if (!cw || typeof cw.temperature !== 'number') return null;
    return { tempC: cw.temperature, code: cw.weathercode };
  } catch {
    return null;
  }
}

// WMO weather codes, the standard Open-Meteo returns — collapsed to a
// short human label rather than showing a bare numeric code.
// A compact glyph for the floating map chip — the whole point of that
// chip is to fit on the map itself, so no full-text label variant.
function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌡️';
}

// Free OpenStreetMap Overpass lookup for real nearby structures/places —
// same free service already used for the road speed-limit lookup, just a
// different query. Scoped to a 1.5km radius around the selected driver,
// fetched only when the Places layer is actually toggled on.
async function fetchNearbyPlaces(lat: number, lng: number): Promise<Array<{ lat: number; lng: number; name: string; category: string }>> {
  const query = `[out:json][timeout:10];(
    node["amenity"="fuel"](around:1500,${lat},${lng});
    node["amenity"="hospital"](around:1500,${lat},${lng});
    node["amenity"="police"](around:1500,${lat},${lng});
    node["amenity"="marketplace"](around:1500,${lat},${lng});
    node["amenity"="bus_station"](around:1500,${lat},${lng});
    node["building"="warehouse"](around:1500,${lat},${lng});
  );out center 30;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
    const data = await res.json();
    const elements: any[] = data?.elements || [];
    return elements
      .map((el) => {
        const lt = el.lat ?? el.center?.lat;
        const lg = el.lon ?? el.center?.lon;
        const category = placeCategoryOf(el.tags);
        return { lat: lt, lng: lg, name: el.tags?.name || placeCategoryLabel(category), category };
      })
      .filter((p) => p.lat != null && p.lng != null);
  } catch {
    return [];
  }
}
function placeCategoryOf(tags: any): string {
  if (tags?.amenity === 'fuel') return 'fuel';
  if (tags?.amenity === 'hospital') return 'hospital';
  if (tags?.amenity === 'police') return 'police';
  if (tags?.amenity === 'marketplace') return 'market';
  if (tags?.amenity === 'bus_station') return 'station';
  if (tags?.building === 'warehouse') return 'warehouse';
  return 'place';
}
function placeCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    fuel: 'Fuel Station', hospital: 'Hospital', police: 'Police Station',
    market: 'Market', station: 'Bus Station', warehouse: 'Warehouse', place: 'Place',
  };
  return labels[category] || 'Place';
}

// Live countdown to arrival — "mm:ss left" (or "Xh Ym left" past an hour),
// ticking every second while a route is on file, distinct from the fixed
// clock-time ETA already shown alongside it.
function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m left`;
  return `${m}:${rem.toString().padStart(2, '0')} left`;
}

// Shared by the initial selection post and the once-a-second tick below
// it, so the label bound to the destination pin on the map reads
// identically whether it's the first paint or a live update.
function formatRouteLabel(distanceMeters: number, durationSeconds: number, remainingSeconds: number | null, arrived: boolean): string {
  if (arrived) return 'Arrived at destination';
  return `${formatDistance(distanceMeters)} · ETA ${etaClockTime(durationSeconds)}${remainingSeconds != null ? ` · ${formatCountdown(remainingSeconds)}` : ''}`;
}

interface FleetMapProps {
  /** Fired whenever the selected driver (or their live speed) changes,
   * so a parent screen can show a persistent speed readout of its own —
   * e.g. TrackingScreen's bar above the Live Map / Driver List tabs,
   * always visible rather than only inside the tap-to-open panel. Fires
   * with null the moment nothing is selected. */
  onSelectedChange?: (info: { name: string; speedKmh: number | null } | null) => void;
}

export default function FleetMap({ onSelectedChange }: FleetMapProps = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // The search, map style, fit, places buttons stay hidden behind one
  // arrow so they don't cover the map (matches the web map).
  const [toolsOpen, setToolsOpen] = useState(false);
  const { profile } = useAuthStore();
  const isRisk = (profile?.department || '').toUpperCase() === 'RISK' || profile?.isAdmin;
  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const [drivers, setDrivers] = useState<DriverPoint[]>([]);
  const [selected, setSelected] = useState<DriverPoint | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [speedLimit, setSpeedLimit] = useState<number | null | 'loading'>(null);
  const [route, setRoute] = useState<RouteInfo | null | 'loading'>(null);
  const [driverPlace, setDriverPlace] = useState<string | null>(null);
  // Real, Risk-configured company speed limit — live, polled alongside
  // the driver positions so a change Risk makes shows up here (and on
  // every driver's own app) within one poll cycle, not just on refresh.
  const [fleetSpeedLimit, setFleetSpeedLimitState] = useState<number>(DEFAULT_FLEET_SPEED_LIMIT_KMH);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // Animation 10: the detail panel slides up from below rather than just
  // appearing — one shared value driving both its vertical offset and
  // its fade-in, reset and replayed each time a (possibly different)
  // driver is selected.
  const panelAnim = useRef(new Animated.Value(0)).current;

  // Live ETA countdown: routeFetchedAt anchors when `route.durationSeconds`
  // was true, nowTick ticks every second so the remaining time visibly
  // counts down rather than sitting static.
  const [routeFetchedAt, setRouteFetchedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  // The selected driver's own breadcrumb trail, kept in state (not just
  // posted to the map) so the Replay controls know whether there's
  // anything to replay and can hand it back to the WebView on demand.
  const [trailPoints, setTrailPoints] = useState<[number, number][]>([]);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState<{ index: number; total: number } | null>(null);
  const [weather, setWeather] = useState<{ tempC: number; code: number } | null | 'loading'>(null);
  // Structures & Places layer — off by default, only fetched (a real
  // Overpass call) once toggled on for a selected driver.
  const [placesEnabled, setPlacesEnabled] = useState(false);
  const [places, setPlaces] = useState<Array<{ lat: number; lng: number; name: string; category: string }> | 'loading' | null>(null);
  const [basemap, setBasemapState] = useState<'street' | 'modern' | 'satellite'>('street');
  // Whether Risk has actually entered a real MapTiler key in Control
  // Center's API Keys section — the toggle only ever offers the
  // "modern" option once this is true, never a fake choice that would
  // silently do nothing.
  const [hasModernBasemap, setHasModernBasemap] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  // True once the embedded map has actually drawn its first real markers
  // (the 'ready' signal from render()'s first call) — until then a
  // loading cover sits over the WebView/iframe so what's briefly visible
  // is never the plain, unstyled default map before the real one is up.
  const [mapReady, setMapReady] = useState(false);
  // Tapping the Central Depot or Tema Port pin opens a small info card,
  // separate from the driver-selection panel — a fixed reference point
  // isn't a driver, and shouldn't reuse that panel's Call/WhatsApp/speed
  // gauge content.
  const [selectedWaypoint, setSelectedWaypoint] = useState<{ label: string; lat: number; lng: number } | null>(null);
  // Per direct correction: Call/WhatsApp should use the driver's own
  // registered number, but when one was never entered at sign-up, Risk
  // can type it in here — a real, persisted fix to the driver's own
  // record (drivers.phone), not a local-only override that would be
  // lost and asked for again next time.
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // A remount of the WebView/iframe (fullscreen toggling swaps which
  // parent it's rendered under) means Leaflet re-initializes from
  // scratch, so the loading cover needs to come back for that moment too.
  useEffect(() => {
    setMapReady(false);
  }, [fullscreen]);

  // Safety net: the 'ready' signal depends on Leaflet's own CDN scripts
  // actually loading over the network. If that's ever slow or blocked
  // (confirmed live: a slow/504'd CDN fetch on a fullscreen remount), the
  // cover would otherwise sit there forever with no way out. After a
  // generous 8s, show the map anyway rather than trap the user behind a
  // permanent loading screen.
  useEffect(() => {
    if (mapReady) return;
    const timeout = setTimeout(() => setMapReady(true), 8000);
    return () => clearTimeout(timeout);
  }, [mapReady, fullscreen]);

  useEffect(() => {
    if (!selected) return;
    panelAnim.setValue(0);
    Animated.timing(panelAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [selected?.id]);

  const postToChild = useCallback((payload: object) => {
    if (isWeb) {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    } else {
      webviewRef.current?.postMessage(JSON.stringify(payload));
    }
  }, []);

  // Once Risk has entered a real MapTiler key in Control Center's API
  // Keys section, every live map picks it up automatically — no code
  // change, no separate "wire it up" step. Sent only once the map is
  // actually ready to receive it (and again on a fullscreen remount,
  // which re-initializes the whole embedded page from scratch).
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    getCeoSetting<string>('api_key_maptiler', '').then((key) => {
      if (!cancelled && key) postToChild({ type: 'set-maptiler-key', key });
    });
    return () => { cancelled = true; };
  }, [mapReady, postToChild]);

  const load = useCallback(async () => {
    // Direct correction, found while verifying this exact screen live:
    // `driver_locations.driver_id` references `drivers.driver_id` (the
    // short business id, e.g. "DRV-QA01"), while `delivery_logs.driver_id`
    // references `drivers.id` (the row's own UUID) — two different tables
    // pointing at two different columns of the same `drivers` row. This
    // screen was querying driver_locations with the UUID, which can never
    // match, so the live map has never actually shown a real position.
    // Both ids are fetched here and used against the table that actually
    // expects them.
    const { data: driverRows } = await supabase.from('drivers').select('id, driver_id, full_name, status, vehicle_id, phone, user_id');
    const uuids = (driverRows || []).map((d: any) => d.id);
    const businessIds = (driverRows || []).map((d: any) => d.driver_id).filter(Boolean);
    const userIds = (driverRows || []).map((d: any) => d.user_id).filter(Boolean);
    if (uuids.length === 0) { setDrivers([]); return; }

    const [{ data: locRows }, { data: deliveryRows }, { data: profileRows }] = await Promise.all([
      businessIds.length > 0
        ? supabase
            .from('driver_locations')
            .select('driver_id, latitude, longitude, speed, heading, recorded_at')
            .in('driver_id', businessIds)
            .order('recorded_at', { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('delivery_logs')
        .select('driver_id, delivery_address, destination_lat, destination_lng, status, created_at')
        .in('driver_id', uuids)
        .in('status', ['ASSIGNED', 'IN_TRANSIT'])
        .order('created_at', { ascending: false }),
      // Real photo, from the driver's own linked profile — not a new
      // upload flow, just reading what registration already collected.
      userIds.length > 0
        ? supabase.from('profiles').select('id, photo').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const latestByBusinessId: Record<string, any> = {};
    for (const l of locRows || []) {
      if (!latestByBusinessId[l.driver_id]) latestByBusinessId[l.driver_id] = l;
    }
    const deliveryByUuid: Record<string, any> = {};
    for (const d of deliveryRows || []) {
      if (!deliveryByUuid[d.driver_id]) deliveryByUuid[d.driver_id] = d;
    }
    const photoByUserId: Record<string, string | null> = {};
    for (const p of profileRows || []) {
      photoByUserId[p.id] = p.photo ?? null;
    }

    const points: DriverPoint[] = (driverRows || [])
      .filter((d: any) => d.driver_id)
      .map((d: any) => {
        const loc = latestByBusinessId[d.driver_id];
        return {
          id: d.id,
          driverBusinessId: d.driver_id,
          full_name: d.full_name,
          status: d.status,
          vehicle_id: d.vehicle_id,
          phone: d.phone,
          photo: d.user_id ? (photoByUserId[d.user_id] ?? null) : null,
          deliveryStatus: deliveryByUuid[d.id]?.status ?? null,
          hasRealLocation: !!loc,
          // A driver with no driver_locations row yet has never started
          // sharing GPS — rather than hiding them from the map (this
          // screen's old behavior), they show at the real, physical
          // place their day actually starts: Rebma Impex Limited itself.
          latitude: loc ? loc.latitude : CENTRAL_DEPOT.lat,
          longitude: loc ? loc.longitude : CENTRAL_DEPOT.lng,
          speed: loc ? (loc.speed ?? null) : null,
          heading: loc ? (loc.heading ?? null) : null,
          recordedAt: loc ? loc.recorded_at : null,
          deliveryAddress: deliveryByUuid[d.id]?.delivery_address ?? null,
          destinationLat: deliveryByUuid[d.id]?.destination_lat ?? null,
          destinationLng: deliveryByUuid[d.id]?.destination_lng ?? null,
        };
      });

    setDrivers(points);
  }, []);

  useEffect(() => {
    load();
    return setActiveInterval(load, 15000);
  }, [load]);

  // Same 15s cadence as the driver positions — a limit change Risk makes
  // shows up live here and on every driver's own screen, not just after
  // a manual refresh.
  useEffect(() => {
    let cancelled = false;
    const loadLimit = () => getFleetSpeedLimitKmh().then((v) => { if (!cancelled) setFleetSpeedLimitState(v); });
    loadLimit();
    const stop = setActiveInterval(loadLimit, 15000);
    return () => { cancelled = true; stop(); };
  }, []);

  const saveFleetSpeedLimit = async () => {
    const parsed = parseInt(limitDraft, 10);
    if (!parsed || parsed <= 0) return;
    setSavingLimit(true);
    const { error } = await setFleetSpeedLimitKmh(parsed, profile?.fullName || 'Risk');
    setSavingLimit(false);
    if (!error) {
      setFleetSpeedLimitState(parsed);
      setEditingLimit(false);
    }
  };

  useEffect(() => {
    if (!isWeb || iframeLoaded) {
      postToChild({ type: 'points', points: buildPointsPayload(drivers, fleetSpeedLimit) });
    }
  }, [drivers, iframeLoaded, postToChild]);

  // Shared dispatcher for every message the embedded map sends back —
  // used by both the native WebView's onMessage prop and the web-preview
  // iframe's window message event, so the handling logic exists in one
  // place instead of being duplicated per platform.
  const handleChildMessage = useCallback((raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'select') {
        setSelectedWaypoint(null);
        setDrivers((current) => {
          const d = current.find((x) => x.id === msg.id);
          if (d) setSelected(d);
          return current;
        });
      } else if (msg.type === 'replay-progress') {
        setReplayProgress({ index: msg.index, total: msg.total });
      } else if (msg.type === 'replay-done') {
        setReplayPlaying(false);
        setReplayProgress(null);
      } else if (msg.type === 'ready') {
        setMapReady(true);
      } else if (msg.type === 'select-waypoint') {
        setSelected(null);
        setSelectedWaypoint({ label: msg.label, lat: msg.lat, lng: msg.lng });
      } else if (msg.type === 'modern-basemap-available') {
        setHasModernBasemap(true);
        setBasemapState((current) => (current === 'street' ? 'modern' : current));
      }
    } catch {}
  }, []);

  // Web-only: the iframe's messages arrive via the browser's own window
  // message event, not a WebView onMessage prop.
  useEffect(() => {
    if (!isWeb) return;
    const handler = (e: MessageEvent) => handleChildMessage(e.data);
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleChildMessage]);

  // Speed-limit lookup runs only for the driver actually tapped, and only
  // once per tap — not on a timer, and not for every marker on the map.
  // Once known, it's posted straight to the map as a tooltip bound to
  // that driver's own marker, rather than a text row in the panel.
  useEffect(() => {
    if (!selected) { setSpeedLimit(null); return; }
    let cancelled = false;
    setSpeedLimit('loading');
    fetchSpeedLimitKmh(selected.latitude, selected.longitude).then((limit) => {
      if (cancelled) return;
      setSpeedLimit(limit);
      postToChild({
        type: 'road-limit',
        id: selected.id,
        label: limit != null ? `Road limit ${limit} km/h` : null,
      });
    });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.latitude, selected?.longitude, postToChild]);

  // Route + trail: recompute whenever the selected driver's own position
  // updates (naturally "live" as new GPS pings arrive via the 15s poll,
  // with no separate polling loop needed here). Both are cleared, and
  // A different driver (or none) selected always closes out any
  // in-progress phone-number entry for whoever was selected before.
  useEffect(() => {
    setEditingPhone(false);
    setPhoneDraft('');
  }, [selected?.id]);

  // the map's overlay layers wiped, the moment nothing is selected.
  useEffect(() => {
    if (!selected) {
      postToChild({ type: 'clear-selection' });
      setRoute(null);
      setRouteFetchedAt(null);
      setTrailPoints([]);
      setReplayPlaying(false);
      setReplayProgress(null);
      return;
    }
    let cancelled = false;
    // A new driver may have been selected mid-replay of the previous
    // one — stop it rather than leaving a stale replay marker running
    // for a trail that no longer belongs to whoever's now shown.
    setReplayPlaying(false);
    setReplayProgress(null);
    postToChild({ type: 'replay-stop' });

    (async () => {
      const trailSince = new Date(Date.now() - TRAIL_LOOKBACK_MINUTES * 60000).toISOString();
      const { data: trailRows } = await supabase
        .from('driver_locations')
        .select('latitude, longitude, recorded_at')
        .eq('driver_id', selected.driverBusinessId)
        .gte('recorded_at', trailSince)
        .order('recorded_at', { ascending: true })
        .limit(TRAIL_MAX_POINTS);
      const trail = (trailRows || []).map((r: any) => [r.latitude, r.longitude] as [number, number]);
      if (cancelled) return;
      setTrailPoints(trail);

      // No active delivery, but genuinely moving? Real, honest inference
      // (see isMovingWithNoJob) that they're heading back — draw the
      // route home instead of drawing nothing. No synthetic destination
      // pin gets created for this case: Rebma Impex Limited already has
      // its own permanent waypoint marker, so a second pin on top of it
      // would just be visual clutter, not new information.
      const hasRealDestination = selected.destinationLat != null && selected.destinationLng != null;
      const routeTarget = getRouteTarget(selected);
      const isReturning = !!routeTarget?.isReturning;

      let routeInfo: RouteInfo | null = null;
      if (routeTarget) {
        setRoute('loading');
        routeInfo = await fetchRoute(selected.latitude, selected.longitude, routeTarget.lat, routeTarget.lng);
      }
      if (cancelled) return;
      setRoute(routeInfo);
      setRouteFetchedAt(routeInfo ? Date.now() : null);

      const arrived = !!routeTarget && haversineMeters(selected.latitude, selected.longitude, routeTarget.lat, routeTarget.lng) < ARRIVAL_RADIUS_METERS;

      const routeLabel = !routeInfo
        ? null
        : isReturning
          ? (arrived ? 'Arrived back at Rebma Impex Limited' : `Returning · ${formatDistance(routeInfo.distanceMeters)} · ETA ${etaClockTime(routeInfo.durationSeconds)}`)
          : formatRouteLabel(routeInfo.distanceMeters, routeInfo.durationSeconds, routeInfo.durationSeconds, arrived);

      postToChild({
        type: 'selection',
        trail,
        route: routeInfo?.coords || null,
        // The teal "returning" route reads as a different kind of trip
        // from the blue "heading to a delivery" one — same real color as
        // this driver's own marker in that state.
        routeColor: isReturning ? '#14b8a6' : '#2563eb',
        destination: hasRealDestination ? { lat: selected.destinationLat, lng: selected.destinationLng } : null,
        routeLabel,
        arrived,
      });
    })();

    return () => { cancelled = true; };
  }, [selected?.id, selected?.latitude, selected?.longitude, selected?.destinationLat, selected?.destinationLng, selected?.deliveryStatus, postToChild]);

  // Ticks once a second while a route is on file, so the live countdown
  // ("mm:ss left") actually counts down instead of sitting static.
  useEffect(() => {
    if (!route || route === 'loading') return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [route]);

  // Reacts to that tick by pushing an updated label onto the destination
  // pin's own map tooltip — the countdown lives on the map, not as a
  // re-rendered text row in the panel.
  useEffect(() => {
    if (!selected || !route || route === 'loading' || routeFetchedAt == null) return;
    const routeTarget = getRouteTarget(selected);
    if (!routeTarget) return;
    const remaining = Math.max(0, route.durationSeconds - (nowTick - routeFetchedAt) / 1000);
    const arrived = haversineMeters(selected.latitude, selected.longitude, routeTarget.lat, routeTarget.lng) < ARRIVAL_RADIUS_METERS;
    const label = routeTarget.isReturning
      ? (arrived ? 'Arrived back at Rebma Impex Limited' : `Returning · ${formatDistance(route.distanceMeters)} · ETA ${etaClockTime(route.durationSeconds)}`)
      : formatRouteLabel(route.distanceMeters, route.durationSeconds, remaining, arrived);
    postToChild({ type: 'route-label', label });
  }, [nowTick, selected?.id, route, routeFetchedAt, postToChild]);

  // Weather at the selected driver's current position — once per
  // selection, matching the same low-frequency pattern as the place-name
  // lookup right below it.
  useEffect(() => {
    if (!selected) { setWeather(null); return; }
    let cancelled = false;
    setWeather('loading');
    fetchWeather(selected.latitude, selected.longitude).then((w) => { if (!cancelled) setWeather(w); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  // Structures & Places layer — real Overpass data, fetched only while
  // the toggle is on and a driver is selected; cleared (and the map's
  // places layer wiped) the moment either condition stops holding.
  useEffect(() => {
    if (!placesEnabled || !selected) {
      setPlaces(null);
      postToChild({ type: 'places', places: [] });
      return;
    }
    let cancelled = false;
    setPlaces('loading');
    fetchNearbyPlaces(selected.latitude, selected.longitude).then((list) => {
      if (cancelled) return;
      setPlaces(list);
      postToChild({ type: 'places', places: list });
    });
    return () => { cancelled = true; };
  }, [placesEnabled, selected?.id, postToChild]);

  // Real place name for the driver's own current position — shown in the
  // panel header. The destination's own place name isn't needed anymore:
  // distance/ETA now lives directly on the destination pin's map tooltip.
  useEffect(() => {
    if (!selected) { setDriverPlace(null); return; }
    let cancelled = false;
    setDriverPlace(null);
    reverseGeocode(selected.latitude, selected.longitude).then((name) => { if (!cancelled) setDriverPlace(name); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  const timeAgo = (iso: string | null) => {
    if (!iso) return 'not started yet';
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  // Shared with buildPointsPayload's own definition — a driver with no
  // real location report yet is never "stale" (that means was reporting
  // and stopped), so this always checks hasRealLocation first.
  const isDriverStale = (d: DriverPoint) =>
    d.hasRealLocation && d.recordedAt != null && Date.now() - new Date(d.recordedAt).getTime() > STALE_MINUTES * 60000;

  // Same "returning to base" inference buildPointsPayload uses for the
  // map markers, mirrored here so the panel header agrees with whatever
  // color the driver's own marker is showing.
  const isMovingWithNoJob = (d: DriverPoint) => {
    const kmh = speedKmh(d.speed);
    return !d.deliveryStatus && !isDriverStale(d) && kmh != null && kmh > 2;
  };

  // Shared by the selection effect (first paint) and the per-second tick
  // effect (live updates) so both agree on where the route line is
  // actually headed — a real delivery destination when one exists,
  // otherwise Rebma Impex Limited itself when the driver is genuinely
  // moving with no job, otherwise nowhere (no route to draw).
  const getRouteTarget = (d: DriverPoint): { lat: number; lng: number; isReturning: boolean } | null => {
    if (d.destinationLat != null && d.destinationLng != null) {
      return { lat: d.destinationLat, lng: d.destinationLng, isReturning: false };
    }
    if (isMovingWithNoJob(d)) {
      return { lat: CENTRAL_DEPOT.lat, lng: CENTRAL_DEPOT.lng, isReturning: true };
    }
    return null;
  };

  const callDriver = () => {
    if (!selected?.phone) return;
    Linking.openURL(`tel:${selected.phone}`).catch(() => {});
  };

  const whatsAppDriver = () => {
    if (!selected?.phone) return;
    const message = selected.deliveryAddress
      ? `Hi ${selected.full_name}, checking in on your delivery to: ${selected.deliveryAddress}`
      : `Hi ${selected.full_name}, checking in on your current trip.`;
    const phone = selected.phone.replace(/[^\d+]/g, '');
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const savePhone = async () => {
    if (!selected) return;
    const cleaned = phoneDraft.trim();
    if (!cleaned) return;
    setSavingPhone(true);
    const { error } = await supabase.from('drivers').update({ phone: cleaned }).eq('id', selected.id);
    setSavingPhone(false);
    if (error) {
      Alert.alert('Could Not Save Number', error.message);
      return;
    }
    // Real, immediate reflection in this screen's own state — the next
    // 15s poll would pick it up anyway, but there's no reason to make
    // Risk wait to see the number they just entered.
    setSelected((current) => (current ? { ...current, phone: cleaned } : current));
    setDrivers((current) => current.map((d) => (d.id === selected.id ? { ...d, phone: cleaned } : d)));
    setEditingPhone(false);
    setPhoneDraft('');
  };

  // Live speed for the round speedometer gauge in the panel below — the
  // same real GPS-derived number every marker's own badge already shows,
  // just presented big and clearly for whichever driver is selected.
  const selectedSpeedKmh = selected ? speedKmh(selected.speed) : null;
  // Whether there's anywhere for the route to actually go right now — a
  // real delivery destination, or a genuine "returning" inference. Drives
  // the panel's fallback text so "No destination on file" only shows
  // when that's actually true, not whenever a driver simply has no
  // delivery assigned.
  const selectedRouteTarget = selected ? getRouteTarget(selected) : null;

  // Tells the parent screen (TrackingScreen's always-visible bar above
  // the tabs) about the currently selected driver's live speed, so the
  // gauge doesn't only exist inside this map's own tap-to-open panel.
  useEffect(() => {
    onSelectedChange?.(selected ? { name: selected.full_name, speedKmh: selectedSpeedKmh } : null);
  }, [selected?.id, selectedSpeedKmh, onSelectedChange]);

  // Feature 8: nearest other active driver to whoever is selected.
  const nearestDriverInfo = (() => {
    if (!selected) return null;
    let best: { name: string; meters: number; lat: number; lng: number } | null = null;
    for (const d of drivers) {
      if (d.id === selected.id) continue;
      const meters = haversineMeters(selected.latitude, selected.longitude, d.latitude, d.longitude);
      if (!best || meters < best.meters) best = { name: d.full_name, meters, lat: d.latitude, lng: d.longitude };
    }
    return best;
  })();

  // Draws the nearest-other-driver connector directly on the map (a
  // dashed line + distance label) instead of a text row in the panel.
  useEffect(() => {
    if (!selected) return; // the main clear-selection message already wipes this
    if (!nearestDriverInfo) {
      postToChild({ type: 'nearest-driver', from: null, to: null, label: null });
      return;
    }
    postToChild({
      type: 'nearest-driver',
      from: [selected.latitude, selected.longitude],
      to: [nearestDriverInfo.lat, nearestDriverInfo.lng],
      label: `${nearestDriverInfo.name} · ${formatDistance(nearestDriverInfo.meters)}`,
    });
  }, [selected?.id, selected?.latitude, selected?.longitude, nearestDriverInfo?.lat, nearestDriverInfo?.lng, nearestDriverInfo?.meters, postToChild]);

  // Feature 1: live countdown, recomputed every tick from the fixed
  // duration OSRM returned plus how long ago that was fetched.
  const remainingSeconds =
    route && typeof route === 'object' && routeFetchedAt != null
      ? Math.max(0, route.durationSeconds - (nowTick - routeFetchedAt) / 1000)
      : null;

  const toggleBasemap = () => {
    // street -> modern (only when a real key exists) -> satellite -> street
    const cycle: Array<'street' | 'modern' | 'satellite'> = hasModernBasemap
      ? ['street', 'modern', 'satellite']
      : ['street', 'satellite'];
    const next = cycle[(cycle.indexOf(basemap) + 1) % cycle.length];
    setBasemapState(next);
    postToChild({ type: 'set-basemap', mode: next });
  };
  const fitAll = () => postToChild({ type: 'fit-all' });
  const focusOnDriver = (d: DriverPoint) => {
    setSelectedWaypoint(null);
    setSelected(d);
    postToChild({ type: 'focus', lat: d.latitude, lng: d.longitude });
    setSearchOpen(false);
    setSearchQuery('');
  };
  const focusOnWaypoint = (lat: number, lng: number, label: string) => {
    setSelected(null);
    setSelectedWaypoint({ label, lat, lng });
    postToChild({ type: 'focus', lat, lng });
    setSearchOpen(false);
  };
  const directionsToWaypoint = () => {
    if (!selectedWaypoint) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedWaypoint.lat},${selectedWaypoint.lng}`).catch(() => {});
  };
  const startTrailReplay = () => {
    if (trailPoints.length < 2) return;
    setReplayPlaying(true);
    setReplayProgress({ index: 0, total: trailPoints.length });
    postToChild({ type: 'replay-start', trail: trailPoints });
  };
  const stopTrailReplay = () => {
    setReplayPlaying(false);
    setReplayProgress(null);
    postToChild({ type: 'replay-stop' });
  };
  const searchResults = searchQuery.trim().length > 0
    ? drivers.filter((d) => d.full_name.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  const toolbarBtn = {
    width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.bgCard,
    alignItems: 'center' as const, justifyContent: 'center' as const, ...t.shadow('raised'),
  };

  // Feature 10: fullscreen toggle. Built as a Modal (rather than an
  // absolutely-positioned overlay) so it reliably covers the whole device
  // screen regardless of whatever parent layout — a ScrollView, a
  // SafeAreaView with its own padding — this component happens to be
  // embedded in on whichever screen renders it.
  const mapBody = (
    // No minHeight floor here on purpose. TrackingScreen.tsx already
    // establishes a real flex:1 chain from the screen root down to this
    // View, so flex:1 alone correctly sizes the map to exactly whatever
    // space is left above the bottom tab bar. A hardcoded floor (420 used
    // to sit here) forced the map taller than that available space on
    // shorter screens, pushing it to visually bleed under the tab bar —
    // the fullscreen button above is the intended way to see it bigger,
    // not a forced minimum size.
    <View style={{ flex: 1, gap: t.spacing.sm, paddingTop: fullscreen ? insets.top + t.spacing.sm : 0, paddingHorizontal: fullscreen ? t.spacing.md : 0, paddingBottom: fullscreen ? insets.bottom + t.spacing.sm : 0 }}>
      {/* Speed limit and each moving driver's live speed, above the map.
          Every marker turns red the moment its driver goes over this
          Risk-set limit (see markerColor/overLimit). */}
      <View
        style={{
          backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md,
          flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.spacing.sm,
        }}
      >
        <Gauge size={16} color={t.colors.accent} />
        {editingLimit ? (
          <>
            <View style={{ flex: 1 }}>
              <Input value={limitDraft} onChangeText={setLimitDraft} keyboardType="number-pad" placeholder="km/h" style={{ paddingVertical: 4 }} />
            </View>
            <Button label={savingLimit ? 'Saving...' : 'Save'} size="sm" onPress={saveFleetSpeedLimit} disabled={savingLimit} loading={savingLimit} />
            <Pressable onPress={() => setEditingLimit(false)} hitSlop={8}><X size={16} color={t.colors.textMuted} /></Pressable>
          </>
        ) : (
          <>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
              Fleet Speed Limit: {fleetSpeedLimit} km/h
            </Text>
            {isRisk && (
              <Pressable
                onPress={() => { setLimitDraft(String(fleetSpeedLimit)); setEditingLimit(true); }}
                style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}
              >
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.accent }}>Edit</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setFullscreen((f) => !f)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.bgPage, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}
            >
              {fullscreen ? <Minimize2 size={13} color={t.colors.textSecondary} /> : <Maximize2 size={13} color={t.colors.textSecondary} />}
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textSecondary }}>{fullscreen ? 'Collapse' : 'Expand'}</Text>
            </Pressable>
          </>
        )}
        {(() => {
          const moving = drivers
            .map((d) => ({ d, kmh: speedKmh(d.speed) }))
            .filter((x): x is { d: DriverPoint; kmh: number } => x.d.hasRealLocation && !isDriverStale(x.d) && x.kmh != null && x.kmh > 2)
            .sort((a, b) => b.kmh - a.kmh);
          return (
            <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {moving.length === 0 ? (
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>No vehicle moving right now</Text>
              ) : moving.slice(0, 6).map(({ d, kmh }) => {
                const over = kmh > fleetSpeedLimit;
                return (
                  <Pressable key={d.id} onPress={() => focusOnDriver(d)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9,
                      backgroundColor: over ? 'rgba(239,68,68,0.12)' : t.colors.accentSoft }}>
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{d.full_name.split(' ')[0]}</Text>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: over ? '#ef4444' : t.colors.accent }}>{`${kmh} km/h`}</Text>
                  </Pressable>
                );
              })}
              {moving.length > 6 ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{`+${moving.length - 6} more`}</Text> : null}
            </View>
          );
        })()}
      </View>

      {/* The four fleet counts, using the same states as the markers */}
      {(() => {
        const moving = (d: DriverPoint) => isMovingWithNoJob(d);
        const counts = [
          { key: 'avail', label: 'Available at the depot', color: '#22c55e', Icon: Warehouse, list: drivers.filter((d) => !d.deliveryStatus && !moving(d)) },
          { key: 'going', label: 'Going out on delivery', color: '#3b82f6', Icon: Truck, list: drivers.filter((d) => d.deliveryStatus === 'IN_TRANSIT') },
          { key: 'back', label: 'Coming back', color: '#14b8a6', Icon: Navigation, list: drivers.filter((d) => moving(d)) },
          { key: 'assigned', label: 'Assigned to a delivery', color: '#f59e0b', Icon: Clock, list: drivers.filter((d) => d.deliveryStatus === 'ASSIGNED') },
        ];
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {counts.map((c) => (
              <Pressable key={c.key} onPress={() => c.list[0] && focusOnDriver(c.list[0])}
                style={{ flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${c.color}1f` }}>
                  <c.Icon size={15} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.extrabold ?? t.font.bold, fontSize: t.type.base16.size, color: c.color }}>{c.list.length}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textSecondary }}>{c.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        );
      })()}

    <View style={{ flex: 1, minHeight: 240, borderRadius: t.radius.lg, overflow: 'hidden' }}>
      {/* One arrow opens the map tools */}
      <Pressable
        onPress={() => setToolsOpen((o) => !o)}
        style={{ position: 'absolute', top: t.spacing.md, right: t.spacing.md, zIndex: 12, width: 36, height: 36, borderRadius: 18,
          alignItems: 'center', justifyContent: 'center', backgroundColor: toolsOpen ? t.colors.accent : t.colors.bgCard }}
      >
        {toolsOpen ? <ChevronRight size={18} color="#fff" /> : <ChevronLeft size={18} color={t.colors.textPrimary} />}
      </Pressable>

      {/* Search, basemap toggle, fit-all, fullscreen, and structures/
          places, a small vertical column of icon controls, kept clear
          of the Fleet Speed Limit banner above it. Places needs a
          selected driver (it queries around that position), so it's
          greyed out and inert until one is tapped. */}
      {toolsOpen && (
      <View style={{ position: 'absolute', top: 56, right: t.spacing.md, zIndex: 11, gap: t.spacing.sm }}>
        <Pressable onPress={() => setSearchOpen((o) => !o)} style={toolbarBtn}>
          <Search size={16} color={searchOpen ? t.colors.accent : t.colors.textPrimary} />
        </Pressable>
        <Pressable onPress={toggleBasemap} style={toolbarBtn}>
          <Layers size={16} color={basemap !== 'street' ? t.colors.accent : t.colors.textPrimary} />
        </Pressable>
        <Pressable onPress={fitAll} style={toolbarBtn}>
          <Locate size={16} color={t.colors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={() => selected && setPlacesEnabled((v) => !v)}
          style={[toolbarBtn, !selected ? { opacity: 0.4 } : null, { position: 'relative' }]}
        >
          <Landmark size={16} color={placesEnabled ? t.colors.accent : t.colors.textPrimary} />
          {places === 'loading' && (
            <View
              style={{
                position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4,
                backgroundColor: t.colors.accent, borderWidth: 1.5, borderColor: t.colors.bgCard,
              }}
            />
          )}
        </Pressable>
      </View>
      )}

      {/* Weather at the selected driver's own position — a compact
          floating chip on the map itself, not a panel text row. */}
      {!!selected && (
        <View
          style={{
            position: 'absolute', top: t.spacing.md, left: t.spacing.md, zIndex: 11,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.pill,
            paddingVertical: 6, paddingHorizontal: 10,
            flexDirection: 'row', alignItems: 'center', gap: 6, ...t.shadow('raised'),
          }}
        >
          {weather === 'loading' ? (
            <LoadingDots color={t.colors.textMuted} />
          ) : (
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>
              {weather && typeof weather === 'object' ? `${weatherEmoji(weather.code)} ${Math.round(weather.tempC)}°C` : 'Not set'}
            </Text>
          )}
        </View>
      )}

      {searchOpen && (
        <View
          style={{
            position: 'absolute', top: 56, left: t.spacing.md, right: t.spacing.md + 44, zIndex: 12,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.sm, ...t.shadow('raised'), maxHeight: 240,
          }}
        >
          {!searchQuery.trim() && (
            <View style={{ flexDirection: 'row', gap: t.spacing.xs, marginBottom: t.spacing.sm }}>
              <Pressable
                onPress={() => focusOnWaypoint(CENTRAL_DEPOT.lat, CENTRAL_DEPOT.lng, CENTRAL_DEPOT.label)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.bgPage, borderRadius: t.radius.pill, paddingVertical: 6, paddingHorizontal: 8 }}
              >
                <Text style={{ fontSize: 12 }}>🏭</Text>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textPrimary }} numberOfLines={1}>Rebma Impex</Text>
              </Pressable>
              <Pressable
                onPress={() => focusOnWaypoint(TEMA_PORT.lat, TEMA_PORT.lng, TEMA_PORT.label)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.bgPage, borderRadius: t.radius.pill, paddingVertical: 6, paddingHorizontal: 8 }}
              >
                <Text style={{ fontSize: 12 }}>⚓</Text>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.textPrimary }} numberOfLines={1}>Tema Port</Text>
              </Pressable>
            </View>
          )}
          <Input value={searchQuery} onChangeText={setSearchQuery} placeholder="Search drivers by name" autoFocus />
          {searchQuery.trim().length > 0 && (
            <View style={{ marginTop: t.spacing.xs }}>
              {searchResults.length === 0 ? (
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, padding: t.spacing.sm }}>
                  No matching drivers
                </Text>
              ) : (
                searchResults.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => focusOnDriver(d)}
                    style={{ paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.sm, borderRadius: t.radius.md }}
                  >
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{d.full_name}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{d.vehicle_id || 'No vehicle'}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      )}

      {isWeb
        ? // Plain iframe — react-native-webview has no web target, this is
          // the real browser equivalent hosting the identical MAP_HTML.
          createIframe({
            ref: iframeRef,
            srcDoc: MAP_HTML,
            style: { flex: 1, border: 0, width: '100%', height: '100%' },
            onLoad: () => {
              setIframeLoaded(true);
              iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'points', points: buildPointsPayload(drivers, fleetSpeedLimit) }), '*');
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
            // Real device hardening: an inline-HTML WebView shouldn't be
            // able to serve a stale cached copy of MAP_HTML after an
            // edit, but Android's WebView is known to cache aggressively
            // even for source={{html}} in some cases — cacheEnabled
            // false + incognito force every mount to actually reparse
            // this exact string rather than risk a device showing an
            // old, unstyled version of this same map.
            cacheEnabled={false}
            incognito
            onLoadEnd={() => {
              // Fires once the page (and its own message listeners) is ready
              // — pushes whatever we already have instead of waiting for the
              // next 15s poll tick.
              webviewRef.current?.postMessage(JSON.stringify({ type: 'points', points: buildPointsPayload(drivers, fleetSpeedLimit) }));
            }}
            onMessage={(e) => handleChildMessage(e.nativeEvent.data)}
          />
        )}

      {/* Covers the plain, unstyled default map until the embedded page
          has actually drawn real markers (the 'ready' signal) — so what's
          briefly visible on first open is never the bare map before the
          edited one swaps in. */}
      {!mapReady && (
        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5,
            backgroundColor: t.colors.bgPage, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LoadingDots color={t.colors.accent} />
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>
            Loading live map
          </Text>
        </View>
      )}

      {drivers.length === 0 && (
        // A small floating banner, not a full opaque cover — per direct
        // correction ("the live map doesn't show"), hiding the real map
        // tiles behind a solid empty-state box made the map itself look
        // broken/missing whenever no driver has reported a location yet.
        // The map (empty, centered on Accra) is still visible underneath.
        <View
          style={{
            position: 'absolute', top: 56, left: t.spacing.md, right: t.spacing.md,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md,
            alignItems: 'center', ...t.shadow('raised'),
          }}
        >
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No drivers reporting a location yet</Text>
        </View>
      )}

      {selected && (
        <Animated.View
          style={{
            position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: t.spacing.md,
            maxHeight: '70%',
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.md,
            gap: t.spacing.sm, ...t.shadow('raised'),
            opacity: panelAnim,
            transform: [{ translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Pressable
              onPress={() => selected.photo && setPhotoPreview(selected.photo)}
              disabled={!selected.photo}
              style={{ position: 'relative' }}
            >
              <Avatar name={selected.full_name} photo={selected.photo} size={40} />
              <View
                style={{
                  position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6,
                  backgroundColor: markerColor(selected.deliveryStatus, isDriverStale(selected), isMovingWithNoJob(selected)).color,
                  borderWidth: 2, borderColor: t.colors.bgCard,
                }}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{selected.full_name}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
                {markerColor(selected.deliveryStatus, isDriverStale(selected), isMovingWithNoJob(selected)).label} · {selected.vehicle_id || 'No vehicle'}{selected.phone ? ` · ${selected.phone}` : ''} · {timeAgo(selected.recordedAt)}
              </Text>
              {!!driverPlace && (
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                  📍 {driverPlace}
                </Text>
              )}
            </View>
            {trailPoints.length > 1 && (
              <Pressable
                onPress={replayPlaying ? stopTrailReplay : startTrailReplay}
                hitSlop={8}
                style={{
                  width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: replayPlaying ? t.colors.accentSoft : t.colors.bgPage,
                }}
              >
                {replayPlaying ? <Pause size={14} color={t.colors.accent} /> : <Play size={14} color={t.colors.accent} />}
              </Pressable>
            )}
            <Pressable onPress={() => setSelected(null)} hitSlop={8} style={{ padding: 4 }}>
              <X size={16} color={t.colors.textMuted} />
            </Pressable>
          </View>

          {/* The round speedometer now lives in TrackingScreen's own bar,
              always visible above both tabs, not just inside this
              tap-to-open panel, per direct correction. This row keeps
              just the context text (over-limit / road's own legal
              limit), since that's still worth a line here. */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
              backgroundColor: selectedSpeedKmh != null && selectedSpeedKmh > fleetSpeedLimit ? `${t.colors.status.danger.text}18` : t.colors.bgPage,
              borderRadius: t.radius.md, paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm,
            }}
          >
            <Gauge size={14} color={selectedSpeedKmh != null && selectedSpeedKmh > fleetSpeedLimit ? t.colors.status.danger.text : t.colors.textMuted} />
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: selectedSpeedKmh != null && selectedSpeedKmh > fleetSpeedLimit ? t.colors.status.danger.text : t.colors.textSecondary }}>
              {selectedSpeedKmh != null && selectedSpeedKmh > fleetSpeedLimit
                ? `Currently over the ${fleetSpeedLimit} km/h fleet limit`
                : speedLimit != null && typeof speedLimit === 'number'
                  ? `Road's own legal limit here: ${speedLimit} km/h`
                  : `Within the ${fleetSpeedLimit} km/h fleet limit`}
            </Text>
          </View>

          {/* Distance/ETA/countdown (or "Arrived") is now a tooltip on
              the destination pin; the nearest-other-driver distance is a
              labeled line on the map; structures/places is a toggle in
              the toolbar. The only case still worth a line here is when
              there's genuinely nothing to show on the map yet (no
              destination on file, or the route couldn't be computed). */}
          {(!selectedRouteTarget || route === 'loading' || !route) && (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs,
                backgroundColor: t.colors.bgPage, borderRadius: t.radius.md,
                paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm,
              }}
            >
              <Navigation size={14} color={t.colors.accent} />
              {!selectedRouteTarget ? (
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                  No destination on file for this delivery
                </Text>
              ) : route === 'loading' ? (
                <>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                    {selectedRouteTarget.isReturning ? 'Calculating route back to Rebma Impex Limited' : 'Calculating route'}
                  </Text>
                  <LoadingDots color={t.colors.textMuted} />
                </>
              ) : (
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Route unavailable right now</Text>
              )}
            </View>
          )}

          {selected.phone ? (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Pressable
                onPress={callDriver}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, paddingVertical: t.spacing.sm }}
              >
                <Phone size={14} color={t.colors.accent} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.accent }}>Call</Text>
              </Pressable>
              <Pressable
                onPress={whatsAppDriver}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#dcfce7', borderRadius: t.radius.md, paddingVertical: t.spacing.sm }}
              >
                <MessageCircle size={14} color="#16a34a" />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: '#16a34a' }}>WhatsApp</Text>
              </Pressable>
            </View>
          ) : editingPhone ? (
            <View style={{ flexDirection: 'row', gap: t.spacing.xs, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Input value={phoneDraft} onChangeText={setPhoneDraft} placeholder="Driver's phone number" keyboardType="phone-pad" style={{ paddingVertical: 8 }} autoFocus />
              </View>
              <Button label={savingPhone ? 'Saving…' : 'Save'} size="sm" onPress={savePhone} disabled={savingPhone || !phoneDraft.trim()} loading={savingPhone} />
              <Pressable onPress={() => { setEditingPhone(false); setPhoneDraft(''); }} hitSlop={8}><X size={16} color={t.colors.textMuted} /></Pressable>
            </View>
          ) : (
            // No number was captured at registration — Risk can enter
            // one here rather than being stuck with no way to reach a
            // driver at all.
            <Pressable
              onPress={() => setEditingPhone(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, paddingVertical: t.spacing.sm }}
            >
              <Phone size={14} color={t.colors.textMuted} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>No number on file · Add one</Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {/* Fixed-waypoint info card — modeled on the Google Maps location
          card the user pointed to as a reference: place name up top, one
          icon-in-a-circle quick action underneath, not a plain tooltip
          bubble. Deliberately smaller/simpler than the driver panel above
          (no speed gauge, no Call/WhatsApp) since a depot isn't a person. */}
      {!!selectedWaypoint && (
        <View
          style={{
            position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: t.spacing.md,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg, padding: t.spacing.md,
            ...t.shadow('raised'),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
              {selectedWaypoint.label}
            </Text>
            <Pressable onPress={() => setSelectedWaypoint(null)} hitSlop={8} style={{ padding: 4 }}>
              <X size={16} color={t.colors.textMuted} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
            {selectedWaypoint.lat.toFixed(6)}, {selectedWaypoint.lng.toFixed(6)}
          </Text>
          <Pressable onPress={directionsToWaypoint} style={{ alignItems: 'center', marginTop: t.spacing.md, width: 64 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={18} color={t.colors.accent} />
            </View>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.accent, marginTop: 4 }}>Directions</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={!!photoPreview} transparent animationType="fade" onRequestClose={() => setPhotoPreview(null)}>
        <Pressable
          onPress={() => setPhotoPreview(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: t.spacing.lg }}
        >
          {!!photoPreview && (
            <Image source={{ uri: photoPreview }} style={{ width: '100%', aspectRatio: 1, borderRadius: t.radius.lg }} resizeMode="cover" />
          )}
          <Pressable
            onPress={() => setPhotoPreview(null)}
            hitSlop={12}
            style={{ position: 'absolute', top: 48, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </View>
  );

  if (fullscreen) {
    return (
      <Modal visible transparent={false} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: t.colors.bgPage }}>{mapBody}</View>
      </Modal>
    );
  }
  return mapBody;
}
