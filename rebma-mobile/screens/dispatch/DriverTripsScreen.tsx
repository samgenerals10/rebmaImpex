// rebma-mobile/screens/dispatch/DriverTripsScreen.tsx
//
// The driver's own "Trips" tab — their own delivery history only,
// filtered by driver_id, never every driver's trips (that full,
// unfiltered view already exists in Risk's own "Deliveries" screen —
// confirmed during planning, not rebuilt here).
//
// "Duration" is computed as updated_at - created_at on a delivered trip
// — there's no dedicated start/end timestamp pair in delivery_logs, so
// this is an honest approximation from the two real timestamps that do
// exist, not a made-up figure.
//
// Navigation is a plain hand-off to the phone's own Google/Apple Maps
// app (Linking.openURL) — the same pattern adminWarehouse/TrackingScreen.tsx
// already uses. Confirmed with the user directly: drivers don't need an
// in-app navigation engine, they need one tap that opens their real Maps
// app, which already does turn-by-turn properly. The company-side need
// (watching every driver's live position + delivery status) is a
// separate, Risk/CEO/Management-facing build, not this screen's job.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Linking, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge, { statusTone } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import PageTitle from '../../components/ui/PageTitle';
import { Navigation2 } from 'lucide-react-native';

interface Trip {
  id: string;
  order_id: string | null;
  customer_name: string | null;
  delivery_address: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  status: string;
  proof_photo: string | null;
  created_at: string;
  updated_at: string | null;
}

function fmtDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DriverTripsScreen() {
  const t = useTheme();
  const { driver } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!driver) { setLoading(false); return; }
    const { data } = await supabase
      .from('delivery_logs')
      .select('id, order_id, customer_name, delivery_address, destination_lat, destination_lng, status, proof_photo, created_at, updated_at')
      .eq('driver_id', driver.driver_id)
      .order('created_at', { ascending: false })
      .limit(100);
    setTrips(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [driver?.driver_id]);

  useEffect(() => { load(); }, [load]);

  const openInMaps = async (r: Trip) => {
    if (r.destination_lat == null || r.destination_lng == null) {
      Alert.alert('No Destination Set', 'This delivery has no destination coordinates yet.');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${r.destination_lat},${r.destination_lng}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could Not Open Maps', 'No maps app is available to open this location.');
    }
  };

  const columns: DataColumn<Trip>[] = [
    { key: 'customer_name', label: 'Delivered To', primary: true, render: (r) => r.customer_name || 'Client' },
    { key: 'delivery_address', label: 'Route', render: (r) => r.delivery_address || '—' },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status.replace(/_/g, ' ')} /> },
    { key: 'duration', label: 'Duration', render: (r) => fmtDuration(r.created_at, r.status === 'DELIVERED' ? r.updated_at : null) },
    { key: 'pod', label: 'Proof of Delivery', render: (r) => (r.proof_photo ? 'Submitted' : 'Not yet') },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <PageTitle title="My Trips" subtitle="Your own delivery history" />
        <Card padded={false}>
          <DataList
            columns={columns}
            data={trips}
            rowKey={(r) => r.id}
            loading={loading}
            emptyTitle="No trips yet"
            emptyDescription="Your completed and in-progress deliveries will show up here."
            renderActions={(r) =>
              r.status !== 'DELIVERED' ? (
                <Button label="Open in Maps" size="sm" icon={<Navigation2 size={12} color="#fff" />} onPress={() => openInMaps(r)} disabled={r.destination_lat == null} />
              ) : null
            }
          />
        </Card>
      </View>
    </Screen>
  );
}
