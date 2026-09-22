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
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import FleetMap from '../../components/shared/FleetMap';

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

  const load = useCallback(async () => {
    const { data: driverRows } = await supabase.from('drivers').select('id, full_name, status, vehicle_id').order('full_name');
    const driverIds = (driverRows || []).map((d: any) => d.id);
    let locations: LocationRow[] = [];
    if (driverIds.length > 0) {
      const { data: locRows } = await supabase
        .from('driver_locations')
        .select('driver_id, latitude, longitude, recorded_at')
        .in('driver_id', driverIds)
        .order('recorded_at', { ascending: false })
        .limit(200);
      locations = (locRows as any) || [];
    }
    const latestByDriver: Record<string, LocationRow> = {};
    for (const l of locations) {
      if (!latestByDriver[l.driver_id]) latestByDriver[l.driver_id] = l;
    }
    const combined: Combined[] = (driverRows || []).map((d: any) => ({
      ...d,
      latitude: latestByDriver[d.id]?.latitude ?? null,
      longitude: latestByDriver[d.id]?.longitude ?? null,
      recordedAt: latestByDriver[d.id]?.recorded_at ?? null,
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
    { key: 'vehicle_id', label: 'Vehicle', render: (d) => d.vehicle_id || '—' },
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
    <Screen refreshing={view === 'list' ? refreshing : false} onRefresh={view === 'list' ? () => { setRefreshing(true); load(); } : undefined} scroll={view === 'list'}>
      <View style={{ marginBottom: t.spacing.lg }}>
        <Tabs
          variant="segmented"
          value={view}
          onChange={(v) => setView(v as 'map' | 'list')}
          options={[{ value: 'map', label: 'Live Map' }, { value: 'list', label: 'Driver List' }]}
        />
      </View>

      {view === 'map' ? (
        <FleetMap />
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
    </Screen>
  );
}
