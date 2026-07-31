import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Switch, Alert, StatusBar } from 'react-native';
import * as Location from 'expo-location';
import { Wifi, WifiOff, LogOut, RefreshCw } from 'lucide-react-native';
import { supabase, type DriverRow } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useDeliveryStore } from '../../store/deliveryStore';

export default function DispatchHomeScreen() {
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
    coordinateBuffer,
    setActiveOrder,
    setGpsActive,
    setNetworkOnline,
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

  const handleDeliver = async () => {
    if (!activeOrderId) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('delivery_logs')
      .update({ status: 'DELIVERED', delivered_at: now, updated_at: now })
      .eq('id', activeOrderId);
    if (error) {
      Alert.alert('Failed to Update', error.message);
      return;
    }
    if (activeDeliveryOrderId) {
      await supabase.from('orders').update({ status: 'DELIVERED', updated_at: now }).eq('id', activeDeliveryOrderId);
    }
    markOrderDelivered(activeOrderId);
    setActiveDeliveryClient('');
    setActiveDeliveryDestination('');
    setActiveDeliveryOrderId(null);
    setActiveDeliveryStatus(null);
    Alert.alert('Delivery Logged', 'Order status updated to DELIVERED.', [{ text: 'Dismiss' }]);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.userTitle}>{driver?.full_name || profile?.fullName}</Text>
          <Text style={styles.roleSub}>Dispatch Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={[styles.networkStatusContainer, networkOnline ? styles.networkOnlineBg : styles.networkOfflineBg]}>
        <View style={styles.networkInfo}>
          {networkOnline ? <Wifi size={14} color="#10b981" /> : <WifiOff size={14} color="#f43f5e" />}
          <Text style={[styles.networkStatusText, networkOnline ? styles.textOnline : styles.textOffline]}>
            {networkOnline ? 'Server Connection: Active' : 'Server Connection: Offline Mode'}
          </Text>
        </View>
        <Switch
          value={networkOnline}
          onValueChange={setNetworkOnline}
          thumbColor={networkOnline ? '#10b981' : '#f43f5e'}
          trackColor={{ false: '#fca5a5', true: '#a7f3d0' }}
        />
      </View>

      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionSpace}>
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Active Route Assignments</Text>

            {!activeOrderId ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No routes currently active. Dispatch will assign your next delivery.</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={() => driver && loadActiveDelivery(driver)}>
                  <Text style={styles.actionBtnText}>Check for New Assignment</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.routeDetails}>
                <View style={styles.routeHeader}>
                  <Text style={styles.routeId}>Order Ref: {activeOrderId}</Text>
                  <Text style={styles.routeTarget}>Client: {activeDeliveryClient || 'N/A'}</Text>
                  {!!activeDeliveryDestination && <Text style={styles.routeTarget}>To: {activeDeliveryDestination}</Text>}
                </View>

                <View style={styles.trackingMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Latitude</Text>
                    <Text style={styles.metricValue}>{lastLat !== null ? lastLat.toFixed(5) : '—'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Longitude</Text>
                    <Text style={styles.metricValue}>{lastLng !== null ? lastLng.toFixed(5) : '—'}</Text>
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Share Live Location with Dispatch</Text>
                  <Switch value={gpsActive} onValueChange={setGpsActive} />
                </View>
                <Text style={styles.subText}>Keep this app open while tracking is on — location only updates while the app is in the foreground.</Text>

                <TouchableOpacity style={styles.deliverBtn} onPress={handleDeliver}>
                  <Text style={styles.btnText}>Mark Order as Delivered</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.queueHeader}>
              <Text style={styles.cardHeader}>Offline Sync Buffer Queue</Text>
              {coordinateBuffer.length > 0 && (
                <TouchableOpacity style={styles.syncBtn} onPress={triggerBufferSync}>
                  <RefreshCw size={14} color="#0f55ff" />
                  <Text style={styles.syncBtnText}>Sync Queue</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.queueStats}>
              Coordinates buffered locally: <Text style={styles.queueCount}>{coordinateBuffer.length}</Text>
            </Text>

            <ScrollView style={styles.logConsole} nestedScrollEnabled>
              {coordinateBuffer.length === 0 ? (
                <Text style={styles.emptyLogText}>Queue is empty. Active tracking streams live to the server.</Text>
              ) : (
                coordinateBuffer.map((pt, index) => (
                  <Text key={index} style={styles.logLine}>
                    [{index + 1}] Lat: {pt.latitude.toFixed(5)} | Lng: {pt.longitude.toFixed(5)} (Stored offline)
                  </Text>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  userTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  roleSub: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 50 },
  networkStatusContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1,
  },
  networkOnlineBg: { backgroundColor: '#ecfdf5', borderBottomColor: '#a7f3d0' },
  networkOfflineBg: { backgroundColor: '#fff1f2', borderBottomColor: '#fca5a5' },
  networkInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  networkStatusText: { fontSize: 11, fontWeight: 'bold' },
  textOnline: { color: '#10b981' },
  textOffline: { color: '#f43f5e' },
  contentContainer: { flex: 1 },
  scrollContent: { padding: 20 },
  sectionSpace: { gap: 20 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 3, borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardHeader: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  emptyContainer: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 12, color: '#64748b', marginBottom: 16 },
  actionBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#0f55ff', borderRadius: 12 },
  actionBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  routeDetails: { gap: 16 },
  routeHeader: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  routeId: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  routeTarget: { fontSize: 11, color: '#64748b', marginTop: 2 },
  trackingMetrics: { flexDirection: 'row', gap: 12 },
  metricItem: { flex: 1, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  metricLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase' },
  metricValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 12, color: '#475569' },
  deliverBtn: { height: 44, backgroundColor: '#10b981', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#e0f2fe', borderRadius: 8 },
  syncBtnText: { fontSize: 10, fontWeight: 'bold', color: '#0f55ff' },
  queueStats: { fontSize: 12, color: '#475569', marginBottom: 12 },
  queueCount: { fontWeight: 'bold', color: '#0f55ff' },
  logConsole: { height: 150, backgroundColor: '#0f172a', borderRadius: 12, padding: 12 },
  emptyLogText: { fontSize: 11, color: '#64748b', fontStyle: 'italic' },
  logLine: { fontSize: 10, fontFamily: 'monospace', color: '#cbd5e1', marginBottom: 6 },
  subText: { fontSize: 12, color: '#64748b', marginBottom: 16 },
});
