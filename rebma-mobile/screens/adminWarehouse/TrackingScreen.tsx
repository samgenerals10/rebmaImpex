// rebma-mobile/screens/adminWarehouse/TrackingScreen.tsx
//
// Real, live fleet position map (components/shared/FleetMap.tsx) — every
// driver on one screen at once, for Risk/CEO/Management to actually
// answer "where is every vehicle right now" — plus the original list
// view kept alongside it (real value of its own: last-ping time, a
// per-driver "Open in Maps" hand-off). Confirmed directly with the user
// this is the real company-side need; the driver's own in-app navigation
// was explicitly scoped back to a plain Maps hand-off
// (DriverTripsScreen.tsx / DriverQuickActionsSheet.tsx) since that's all
// drivers themselves need.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getFleetSpeedLimitKmh, DEFAULT_FLEET_SPEED_LIMIT_KMH } from '../../lib/fleetSpeedLimit';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import FleetMap from '../../components/shared/FleetMap';
import SpeedGauge from '../../components/shared/SpeedGauge';
import { setActiveInterval } from '../../lib/activeInterval';

interface DriverRow {
  id: string;
  full_name: string;
  status: string;
  vehicle_id: string | null;
}

interface LocationRow {
  driver_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface Combined extends DriverRow {
  latitude: number | null;
  longitude: number | null;
  recordedAt: string | null;
}

function timeAgo(iso: string | null) {
  if (!iso) return 'No signal';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function TrackingScreen() {
  const t = useTheme();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [drivers, setDrivers] = useState<Combined[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Per direct correction — the speed gauge needed to be visible without
  // having to tap a driver first, so it now lives here too, above both
  // tabs, fed live by FleetMap's own onSelectedChange callback.
  const [tracked, setTracked] = useState<{ name: string; speedKmh: number | null } | null>(null);
  const [fleetLimit, setFleetLimit] = useState(DEFAULT_FLEET_SPEED_LIMIT_KMH);
  const handleSelectedChange = useCallback((info: { name: string; speedKmh: number | null } | null) => {
    setTracked(info);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const limit = await getFleetSpeedLimitKmh();
      if (!cancelled) setFleetLimit(limit);
    };
    poll();
    const stop = setActiveInterval(poll, 15000);
    return () => { cancelled = true; stop(); };
  }, []);

  const load = useCallback(async () => {
    // Same direct correction as FleetMap.tsx: driver_locations.driver_id
    // references drivers.driver_id (the short business id), not this
    // row's own `id` UUID — querying by `id` can never match, which is
    // why this list has never actually shown a real last-ping time.
    const { data: driverRows } = await supabase.from('drivers').select('id, driver_id, full_name, status, vehicle_id').order('full_name');
    const businessIds = (driverRows || []).map((d: any) => d.driver_id).filter(Boolean);
    let locations: LocationRow[] = [];
    if (businessIds.length > 0) {
      const { data: locRows } = await supabase
        .from('driver_locations')
        .select('driver_id, latitude, longitude, recorded_at')
        .in('driver_id', businessIds)
        .order('recorded_at', { ascending: false })
        .limit(200);
      locations = (locRows as any) || [];
    }
    const latestByBusinessId: Record<string, LocationRow> = {};
    for (const l of locations) {
      if (!latestByBusinessId[l.driver_id]) latestByBusinessId[l.driver_id] = l;
    }
    const combined: Combined[] = (driverRows || []).map((d: any) => ({
      ...d,
      latitude: latestByBusinessId[d.driver_id]?.latitude ?? null,
      longitude: latestByBusinessId[d.driver_id]?.longitude ?? null,
      recordedAt: latestByBusinessId[d.driver_id]?.recorded_at ?? null,
    }));
    setDrivers(combined);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openInMaps = async (d: Combined) => {
    if (d.latitude == null || d.longitude == null) {
      Alert.alert('No Location Yet', `${d.full_name} hasn't shared a GPS position yet.`);
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could Not Open Maps', 'No maps app is available to open this location.');
    }
  };

  const columns: DataColumn<Combined>[] = [
    { key: 'full_name', label: 'Driver', primary: true },
    { key: 'status', label: 'Status', status: true, render: (d) => <Badge tone={d.status === 'ACTIVE' ? 'success' : d.status === 'ON_DELIVERY' ? 'info' : 'muted'} label={d.status.replace(/_/g, ' ')} /> },
    { key: 'vehicle_id', label: 'Vehicle', render: (d) => d.vehicle_id || 'Not set' },
    {
      key: 'lastPing', label: 'Last Ping',
      render: (d) => (
        <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: d.recordedAt ? t.colors.textSecondary : t.colors.textMuted }}>
          {timeAgo(d.recordedAt)}
        </Text>
      ),
    },
  ];

  return (
    <Screen
      refreshing={view === 'list' ? refreshing : false}
      onRefresh={view === 'list' ? () => { setRefreshing(true); load(); } : undefined}
      scroll={view === 'list'}
      padded={false}
      edges={['left', 'right']}
    >
      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.xs, paddingBottom: view === 'list' ? t.spacing.lg : 0, flex: view === 'map' ? 1 : undefined }}>
        {/* Always visible, whichever tab is active — per direct
            correction, the speed gauge shouldn't only exist inside the
            map's own tap-to-open panel. Shows a dash until a driver is
            actually tapped on the map; this bar itself doesn't pick a
            driver on its own. */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm,
            backgroundColor: t.colors.bgCard, borderRadius: t.radius.lg,
            padding: t.spacing.sm, marginBottom: t.spacing.sm, ...t.shadow('card'),
          }}
        >
          <SpeedGauge speedKmh={tracked?.speedKmh ?? null} limitKmh={fleetLimit} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>
              {tracked ? tracked.name : 'No driver selected'}
            </Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }} numberOfLines={1}>
              {tracked ? `Live speed vs. the ${fleetLimit} km/h fleet limit` : `Tap a driver on the map to see their live speed`}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: t.spacing.sm }}>
          <Tabs
            variant="segmented"
            value={view}
            onChange={(v) => setView(v as 'map' | 'list')}
            options={[{ value: 'map', label: 'Live Map' }, { value: 'list', label: 'Driver List' }]}
          />
        </View>

      {view === 'map' ? (
        <FleetMap onSelectedChange={handleSelectedChange} />
      ) : (
        <DataList
          collapsible
          columns={columns}
          data={drivers}
          rowKey={(d) => d.id}
          loading={loading}
          emptyTitle="No drivers on file"
          renderActions={(d) => (
            // Not disabled when there's no GPS fix yet — openInMaps()
            // already handles that gracefully with a clear alert, per
            // direct correction the button itself shouldn't look dead.
            <Button label="Open in Maps" size="sm" icon={<MapPin size={12} color="#fff" />} onPress={() => openInMaps(d)} />
          )}
        />
      )}
      </View>
    </Screen>
  );
}
