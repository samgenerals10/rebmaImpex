import { useState, useEffect } from 'react';
import { Text, View, Pressable, ScrollView, Switch, Alert, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Wifi, WifiOff, LogOut, RefreshCw, Navigation } from 'lucide-react-native';
import { supabase, type DriverRow } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useDeliveryStore } from '../../store/deliveryStore';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

// Root-level screen (D6) — rendered outside the tab shell entirely, exactly
// as rebma-web's App.tsx short-circuits to DriverTrackingView before any
// department chrome renders. Phase 7.0: restyled in place, GPS/offline
// logic below is byte-identical to before this pass.
//
// Phase 7.12, D121: `networkOnline` is now driven automatically by a real
// NetInfo listener (App.tsx's root-level startConnectivityWatch()), not
// only this Switch. The Switch is kept, but relabeled "Force Offline" —
// it now drives `forcedOffline`, a manual override for testing that ANDs
// against the real connectivity signal, rather than being the sole source
// of truth it was before this phase.
export default function DispatchHomeScreen() {
  const t = useTheme();
  const { profile, driver, signOut } = useAuthStore();
  const [activeDeliveryClient, setActiveDeliveryClient] = useState('');
  const [activeDeliveryDestination, setActiveDeliveryDestination] = useState('');
  const [activeDeliveryOrderId, setActiveDeliveryOrderId] = useState<string | null>(null);
  const [activeDeliveryStatus, setActiveDeliveryStatus] = useState<string | null>(null);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);

  const {
    activeOrderId,
    gpsActive,
    networkOnline,
    forcedOffline,
    coordinateBuffer,
    setActiveOrder,
    setGpsActive,
    setForcedOffline,
    bufferCoordinate,
    clearBuffer,
    markOrderDelivered,
    loadPersistedData,
  } = useDeliveryStore();

  useEffect(() => {
    loadPersistedData();
  }, []);

  const loadActiveDelivery = async (d: DriverRow) => {
    const { data } = await supabase
      .from('delivery_logs')
      .select('id, order_id, customer_name, delivery_address, status')
      .eq('driver_id', d.driver_id)
      .in('status', ['ASSIGNED', 'IN_TRANSIT'])
      .order('created_at', { ascending: false })
      .limit(1);
    const delivery = data?.[0];
    if (delivery) {
      setActiveOrder(delivery.id);
      setActiveDeliveryClient(delivery.customer_name || 'Client');
      setActiveDeliveryDestination(delivery.delivery_address || '');
      setActiveDeliveryOrderId(delivery.order_id);
      setActiveDeliveryStatus(delivery.status);
    } else {
      setActiveOrder(null);
      setActiveDeliveryClient('');
      setActiveDeliveryDestination('');
      setActiveDeliveryOrderId(null);
      setActiveDeliveryStatus(null);
    }
  };

  useEffect(() => {
    if (driver) loadActiveDelivery(driver);
  }, [driver?.id]);

  // The real "out for delivery" moment — not when a driver gets assigned,
  // but when they actually start the trip. Sharing live location is the
  // driver's own explicit signal that they're moving, so this is where
  // delivery_logs/orders flip from ASSIGNED to IN_TRANSIT/OUT_FOR_DELIVERY,
  // not at dispatch-assignment time. Mirrors the web driver portal's
  // DriverTrackingView, which already worked this way.
  useEffect(() => {
    if (!gpsActive || !activeOrderId || activeDeliveryStatus !== 'ASSIGNED') return;
    const now = new Date().toISOString();
    (async () => {
      await supabase.from('delivery_logs').update({ status: 'IN_TRANSIT', updated_at: now }).eq('id', activeOrderId);
      if (activeDeliveryOrderId) {
        await supabase.from('orders').update({ status: 'OUT_FOR_DELIVERY', updated_at: now }).eq('id', activeDeliveryOrderId);
      }
      setActiveDeliveryStatus('IN_TRANSIT');
    })();
  }, [gpsActive, activeOrderId, activeDeliveryStatus, activeDeliveryOrderId]);

  // Real GPS tracking: stream the phone's actual location to driver_locations
  // while gpsActive is on and a delivery is assigned. Foreground-only — the
  // app must stay open for tracking to keep running.
  useEffect(() => {
    if (!gpsActive || !activeOrderId || !driver) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Required', 'Enable location access to share your position with dispatch.');
        setGpsActive(false);
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 25 },
        async (loc) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy } = loc.coords;
          setLastLat(latitude);
          setLastLng(longitude);

          if (networkOnline) {
            const { error } = await supabase.from('driver_locations').insert({
              driver_id: driver.driver_id,
              delivery_id: activeOrderId,
              latitude,
              longitude,
              accuracy: accuracy ?? null,
            });
            if (error) {
              bufferCoordinate({ latitude, longitude, timestamp: Date.now() });
            }
          } else {
            bufferCoordinate({ latitude, longitude, timestamp: Date.now() });
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [gpsActive, activeOrderId, networkOnline, driver]);

  const triggerBufferSync = async () => {
    if (!networkOnline) {
      Alert.alert('Offline Mode', 'Cannot sync logs while disconnected.');
      return;
    }
    if (coordinateBuffer.length === 0) {
      Alert.alert('Sync Complete', 'No buffered coordinate logs to process.');
      return;
    }
    if (!driver) return;

    Alert.alert(
      'Syncing Coordinates',
      `Sending ${coordinateBuffer.length} buffered location points to the server...`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Sync',
          onPress: async () => {
            const rows = coordinateBuffer.map(p => ({
              driver_id: driver.driver_id,
              delivery_id: activeOrderId,
              latitude: p.latitude,
              longitude: p.longitude,
              recorded_at: new Date(p.timestamp).toISOString(),
            }));
            const { error } = await supabase.from('driver_locations').insert(rows);
            if (error) {
              Alert.alert('Sync Failed', error.message);
              return;
            }
            await clearBuffer();
            Alert.alert('Synced', 'Offline GPS tracking queue flushed to the server.');
          }
        }
      ]
    );
  };

  const handleNavigate = () => {
    if (!activeDeliveryDestination) return;
    setGpsActive(true);
    Linking.openURL(mapsLink(activeDeliveryDestination));
  };

  const handleDeliver = async () => {
    if (!activeOrderId) return;
    const now = new Date().toISOString();
    // Driver completion must NOT be able to bypass Risk — this now always
    // enters PENDING_RISK_REVIEW, never DELIVERED directly. Risk's own POD
    // Review screen is what ultimately marks the delivery DELIVERED, via
    // the risk_review_pod() RPC, which is the only path either
    // delivery_logs.status or orders.status can reach DELIVERED —
    // enforced by a database trigger, not just this screen's convention.
    const { error } = await supabase
      .from('delivery_logs')
      .update({ status: 'PENDING_RISK_REVIEW', updated_at: now })
      .eq('id', activeOrderId);
    if (error) {
      Alert.alert('Failed to Update', error.message);
      return;
    }
    try {
      await supabase.from('supplier_order_notifications').insert([{ message: `Proof of delivery submitted for Risk review: Delivery ${activeOrderId}`, notified_department: 'RISK', read: false }]);
    } catch {}
    markOrderDelivered(activeOrderId);
    setActiveDeliveryClient('');
    setActiveDeliveryDestination('');
    setActiveDeliveryOrderId(null);
    setActiveDeliveryStatus(null);
    Alert.alert('Submitted for Review', 'Delivery submitted to Risk for review before it can be marked delivered.', [{ text: 'Dismiss' }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bgPage }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={t.colors.bgPage} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, borderBottomWidth: 1, borderBottomColor: t.colors.border, backgroundColor: t.colors.bgCard }}>
        <View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.base16.size, color: t.colors.textPrimary }}>{driver?.full_name || profile?.fullName}</Text>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted, textTransform: 'uppercase', marginTop: 2 }}>Dispatch Driver</Text>
        </View>
        <Pressable onPress={signOut} style={{ padding: t.spacing.sm, backgroundColor: t.colors.status.danger.bg, borderRadius: t.radius.pill }}>
          <LogOut size={18} color={t.colors.status.danger.text} />
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.smd, borderBottomWidth: 1,
          backgroundColor: networkOnline ? t.colors.status.success.bg : t.colors.status.danger.bg,
          borderBottomColor: networkOnline ? t.colors.status.success.text : t.colors.status.danger.text,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          {networkOnline ? <Wifi size={14} color={t.colors.status.success.text} /> : <WifiOff size={14} color={t.colors.status.danger.text} />}
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: networkOnline ? t.colors.status.success.text : t.colors.status.danger.text }}>
            {networkOnline ? 'Server Connection: Active' : forcedOffline ? 'Server Connection: Forced Offline' : 'Server Connection: Offline (no signal)'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Switch value={forcedOffline} onValueChange={setForcedOffline} thumbColor={forcedOffline ? t.colors.status.danger.text : t.colors.status.success.text} trackColor={{ false: '#a7f3d0', true: '#fca5a5' }} />
          <Text style={{ fontFamily: t.font.regular, fontSize: 9, color: networkOnline ? t.colors.status.success.text : t.colors.status.danger.text, marginTop: 2 }}>Force Offline</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl }}>
        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Active Route Assignments</Text>

          {!activeOrderId ? (
            <View style={{ alignItems: 'center', paddingVertical: t.spacing.lg }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, marginBottom: t.spacing.lg, textAlign: 'center' }}>
                No routes currently active. Dispatch will assign your next delivery.
              </Text>
              <Button label="Check for New Assignment" onPress={() => driver && loadActiveDelivery(driver)} />
            </View>
          ) : (
            <View style={{ gap: t.spacing.lg }}>
              <View style={{ padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Order Ref: {activeOrderId}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>Client: {activeDeliveryClient || 'N/A'}</Text>
                {!!activeDeliveryDestination && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 2 }}>To: {activeDeliveryDestination}</Text>}
              </View>

              <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                <View style={{ flex: 1, padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textMuted, textTransform: 'uppercase' }}>Latitude</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }}>{lastLat !== null ? lastLat.toFixed(5) : '—'}</Text>
                </View>
                <View style={{ flex: 1, padding: t.spacing.md, backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textMuted, textTransform: 'uppercase' }}>Longitude</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }}>{lastLng !== null ? lastLng.toFixed(5) : '—'}</Text>
                </View>
              </View>

              {!!activeDeliveryDestination && (
                <Button label="Navigate" onPress={handleNavigate} fullWidth icon={<Navigation size={14} color="#fff" />} />
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginRight: t.spacing.sm }}>Share Live Location with Dispatch</Text>
                <Switch value={gpsActive} onValueChange={setGpsActive} trackColor={{ false: t.colors.border, true: t.colors.accentSoft }} thumbColor={gpsActive ? t.colors.accent : undefined} />
              </View>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
                Keep this app open while tracking is on — location only updates while the app is in the foreground.
              </Text>

              <Button label="Mark Order as Delivered" onPress={handleDeliver} fullWidth />
            </View>
          )}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.md }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Offline Sync Buffer Queue</Text>
            {coordinateBuffer.length > 0 && (
              <Pressable onPress={triggerBufferSync} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.md, backgroundColor: t.colors.status.info.bg, borderRadius: t.radius.sm }}>
                <RefreshCw size={14} color={t.colors.status.info.text} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.info.text }}>Sync Queue</Text>
              </Pressable>
            )}
          </View>

          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, marginBottom: t.spacing.md }}>
            Coordinates buffered locally: <Text style={{ fontFamily: t.font.bold, color: t.colors.status.info.text }}>{coordinateBuffer.length}</Text>
          </Text>

          <ScrollView style={{ height: 150, backgroundColor: t.colors.textPrimary, borderRadius: t.radius.md, padding: t.spacing.md }} nestedScrollEnabled>
            {coordinateBuffer.length === 0 ? (
              <Text style={{ fontFamily: t.font.regular, fontStyle: 'italic', fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Queue is empty. Active tracking streams live to the server.</Text>
            ) : (
              coordinateBuffer.map((pt, index) => (
                <Text key={index} style={{ fontFamily: 'monospace', fontSize: t.type.meta10.size, color: '#cbd5e1', marginBottom: 6 }}>
                  [{index + 1}] Lat: {pt.latitude.toFixed(5)} | Lng: {pt.longitude.toFixed(5)} (Stored offline)
                </Text>
              ))
            )}
          </ScrollView>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
