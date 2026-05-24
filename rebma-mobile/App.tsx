// rebma-mobile/App.tsx

import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  SafeAreaView, 
  Switch, 
  Alert, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { 
  Truck, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  MapPin, 
  QrCode, 
  Users, 
  LogOut,
  Send,
  RefreshCw,
  FolderOpen
} from 'lucide-react-native';

// ==========================================
// 1. ZUSTAND STATE STORE FOR OFFLINE SYNC
// ==========================================
interface CoordinatePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface DeliveryStore {
  activeOrderId: string | null;
  gpsActive: boolean;
  networkOnline: boolean;
  coordinateBuffer: CoordinatePoint[];
  deliveredOrders: string[];
  setActiveOrder: (orderId: string | null) => void;
  setGpsActive: (active: boolean) => void;
  setNetworkOnline: (online: boolean) => void;
  bufferCoordinate: (point: CoordinatePoint) => void;
  clearBuffer: () => void;
  markOrderDelivered: (orderId: string) => void;
  loadPersistedData: () => Promise<void>;
}

const useDeliveryStore = create<DeliveryStore>((set, get) => ({
  activeOrderId: null,
  gpsActive: false,
  networkOnline: true,
  coordinateBuffer: [],
  deliveredOrders: [],

  setActiveOrder: (orderId) => set({ activeOrderId: orderId }),
  setGpsActive: (active) => set({ gpsActive: active }),
  
  setNetworkOnline: (online) => {
    set({ networkOnline: online });
    // Attempt auto-flush if network is re-established
    if (online && get().coordinateBuffer.length > 0) {
      get().loadPersistedData(); // Flush queue
    }
  },

  bufferCoordinate: async (point) => {
    const newBuffer = [...get().coordinateBuffer, point];
    set({ coordinateBuffer: newBuffer });
    await AsyncStorage.setItem('gps_buffer_queue', JSON.stringify(newBuffer));
    console.log(`[Zustand Buffer] Coordinate saved locally: ${point.latitude}, ${point.longitude}`);
  },

  clearBuffer: async () => {
    set({ coordinateBuffer: [] });
    await AsyncStorage.removeItem('gps_buffer_queue');
  },

  markOrderDelivered: async (orderId) => {
    const newDelivered = [...get().deliveredOrders, orderId];
    set({ deliveredOrders: newDelivered, activeOrderId: null, gpsActive: false });
    await AsyncStorage.setItem('delivered_orders', JSON.stringify(newDelivered));
  },

  loadPersistedData: async () => {
    try {
      const savedBuffer = await AsyncStorage.getItem('gps_buffer_queue');
      const savedDelivered = await AsyncStorage.getItem('delivered_orders');
      if (savedBuffer) {
        set({ coordinateBuffer: JSON.parse(savedBuffer) });
      }
      if (savedDelivered) {
        set({ deliveredOrders: JSON.parse(savedDelivered) });
      }
    } catch (e) {
      console.log('AsyncStorage load failed:', e);
    }
  }
}));

// ==========================================
// 2. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // Local state controls
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'DISPATCH' | 'OPERATIONS' | 'RECEPTION'>('DISPATCH');
  const [driverName, setDriverName] = useState<string>('Kofi Boateng');
  const [emailInput, setEmailInput] = useState<string>('driver@rebmaimpex.com');
  const [passwordInput, setPasswordInput] = useState<string>('');

  // Active delivery coordinates simulator
  const [simulatedLat, setSimulatedLat] = useState<number>(5.6037); // Accra
  const [simulatedLng, setSimulatedLng] = useState<number>(-0.1870);

  // Warehouse scan demo states
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [totalCratesToLoad] = useState<number>(5);

  // Local state hooks to get Zustand updates
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
    loadPersistedData
  } = useDeliveryStore();

  // Load offline logs on startup
  useEffect(() => {
    loadPersistedData();
  }, []);

  // Simulate background GPS tracking logs generator
  useEffect(() => {
    let interval: any;
    if (gpsActive && activeOrderId) {
      interval = setInterval(() => {
        // Increment coordinates slightly to simulate motion
        const nextLat = simulatedLat + (Math.random() - 0.5) * 0.0003;
        const nextLng = simulatedLng + (Math.random() - 0.5) * 0.0003;
        setSimulatedLat(nextLat);
        setSimulatedLng(nextLng);

        const newPoint: CoordinatePoint = {
          latitude: nextLat,
          longitude: nextLng,
          timestamp: Date.now()
        };

        if (networkOnline) {
          // Stream directly to server
          console.log(`[API POST Stream] Outbound coordinates sent to server: ${nextLat.toFixed(5)}, ${nextLng.toFixed(5)}`);
        } else {
          // Buffer locally in Zustand + AsyncStorage
          bufferCoordinate(newPoint);
        }
      }, 5000); // Track every 5 seconds
    }
    return () => clearInterval(interval);
  }, [gpsActive, activeOrderId, networkOnline, simulatedLat, simulatedLng]);

  // Handle Login authentication
  const handleLogin = () => {
    if (!emailInput) {
      Alert.alert('Authentication Error', 'Please enter your work email.');
      return;
    }
    
    // Assign role based on login email prefix
    if (emailInput.includes('ops')) {
      setUserRole('OPERATIONS');
      setDriverName('Ama Serwah (Warehouse)');
    } else if (emailInput.includes('reception')) {
      setUserRole('RECEPTION');
      setDriverName('Ekow Blankson (Receptionist)');
    } else {
      setUserRole('DISPATCH');
      setDriverName('Kofi Boateng (Driver)');
    }
    setIsAuthenticated(true);
  };

  // Sync buffered coordinate points
  const triggerBufferSync = async () => {
    if (!networkOnline) {
      Alert.alert('Offline Mode', 'Cannot sync logs while disconnected.');
      return;
    }
    if (coordinateBuffer.length === 0) {
      Alert.alert('Sync Complete', 'No buffered coordinate logs to process.');
      return;
    }

    Alert.alert(
      'Syncing Coordinates',
      `Sending ${coordinateBuffer.length} buffered logs to Neon PostgreSQL server...`,
      [
        {
          text: 'Confirm Sync',
          onPress: async () => {
            // Mock API Sync call success
            setTimeout(async () => {
              await clearBuffer();
              Alert.alert('Postgres Synchronized', 'Offline GPS tracking queue flushed successfully.');
            }, 1000);
          }
        }
      ]
    );
  };

  const handleDeliver = () => {
    if (activeOrderId) {
      markOrderDelivered(activeOrderId);
      Alert.alert(
        'Delivery Logged',
        'Order status updated to DELIVERED. Global socket alerts emitted to Marketing, Operations, Management, and Finance.',
        [{ text: 'Dismiss' }]
      );
    }
  };

  // Warehouse Scans
  const handleScanCrate = () => {
    if (scannedItems.length >= totalCratesToLoad) {
      Alert.alert('Load Finished', 'All cargo crates successfully loaded.');
      return;
    }
    const nextItem = `CRATE-0${scannedItems.length + 1}`;
    setScannedItems(prev => [...prev, nextItem]);
  };

  // Reception checkin logs
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorLogs, setVisitorLogs] = useState<string[]>([]);
  const handleVisitorCheckIn = () => {
    if (!visitorName) return;
    setVisitorLogs(prev => [`[Check-In] ${visitorName} at ${new Date().toLocaleTimeString()}`, ...prev]);
    setVisitorName('');
  };

  // Render Login Layout
  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.logoCircle}>
          <Truck size={42} color="#0f55ff" />
        </View>
        <Text style={styles.appName}>REBMA MOBILE</Text>
        <Text style={styles.subHeader}>Enterprise Field Operations</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Work Email</Text>
          <TextInput 
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="driver@rebmaimpex.com"
            placeholderTextColor="#888"
            style={styles.input}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Terminal Password</Text>
          <TextInput 
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="••••••••"
            placeholderTextColor="#888"
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.btnText}>Access Workspace</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Authenticated Dashboard Layout
  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.userTitle}>{driverName}</Text>
          <Text style={styles.roleSub}>{userRole} Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setIsAuthenticated(false)}>
          <LogOut size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Connectivity Controller Status Bar */}
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
        
        {/* ==========================================
            SCREEN: DISPATCH DRIVER MAP & COORDINATES
           ========================================== */}
        {userRole === 'DISPATCH' && (
          <View style={styles.sectionSpace}>
            
            {/* Active order panel */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Active Route Assignments</Text>
              
              {!activeOrderId ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No routes currently active.</Text>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => {
                      setActiveOrder('ORD-101');
                      setGpsActive(true);
                    }}
                  >
                    <Text style={styles.actionBtnText}>Start Delivery Order ORD-101</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.routeDetails}>
                  <View style={styles.routeHeader}>
                    <Text style={styles.routeId}>Order Ref: {activeOrderId}</Text>
                    <Text style={styles.routeTarget}>Client: West Coast Agro</Text>
                  </View>

                  <View style={styles.trackingMetrics}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Latitude</Text>
                      <Text style={styles.metricValue}>{simulatedLat.toFixed(5)}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Longitude</Text>
                      <Text style={styles.metricValue}>{simulatedLng.toFixed(5)}</Text>
                    </View>
                  </View>

                  {/* GPS Tracking status toggles */}
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Background GPS Coordinate Stream</Text>
                    <Switch value={gpsActive} onValueChange={setGpsActive} />
                  </View>

                  {/* Deliver Action */}
                  <TouchableOpacity style={styles.deliverBtn} onPress={handleDeliver}>
                    <Text style={styles.btnText}>Mark Order as Delivered</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Offline sync queue log console */}
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
                Coordinates buffered in Zustand store: <Text style={styles.queueCount}>{coordinateBuffer.length}</Text>
              </Text>
              
              <ScrollView style={styles.logConsole} nestedScrollEnabled>
                {coordinateBuffer.length === 0 ? (
                  <Text style={styles.emptyLogText}>Queue is empty. Active tracking streams live to Neon database.</Text>
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
        )}

        {/* ==========================================
            SCREEN: OPERATIONS SCAN CARGO TERMINAL
           ========================================== */}
        {userRole === 'OPERATIONS' && (
          <View style={styles.sectionSpace}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Warehouse Loader QR Scanner</Text>
              <Text style={styles.subText}>Load inventory release orders into Dispatch vehicles.</Text>

              <View style={styles.scannerViewport}>
                <QrCode size={48} color="#666" />
                <Text style={styles.scannerTargetText}>Crate scanning targeting active</Text>
              </View>

              <TouchableOpacity style={styles.scanBtn} onPress={handleScanCrate}>
                <Text style={styles.btnText}>Scan & Register Crate C-0{scannedItems.length + 1}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeader}>Loading Manifest Checklists</Text>
              <Text style={styles.manifestHeader}>
                Crates Checked in: {scannedItems.length} of {totalCratesToLoad}
              </Text>

              <View style={styles.manifestList}>
                {scannedItems.map((item, idx) => (
                  <View key={idx} style={styles.manifestItem}>
                    <FolderOpen size={16} color="#0f55ff" />
                    <Text style={styles.manifestItemText}>{item} - Verified & Loaded</Text>
                  </View>
                ))}
                {scannedItems.length === 0 && (
                  <Text style={styles.emptyLogText}>Load cargo packages to initialize loading manifest.</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ==========================================
            SCREEN: RECEPTIONIST ATTENDANCE LOG TABLE
           ========================================== */}
        {userRole === 'RECEPTION' && (
          <View style={styles.sectionSpace}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Visitor Check-In Terminal</Text>
              
              <View style={styles.receptionForm}>
                <TextInput 
                  value={visitorName}
                  onChangeText={setVisitorName}
                  placeholder="Enter visitor full name"
                  placeholderTextColor="#888"
                  style={styles.receptionInput}
                />
                <TouchableOpacity style={styles.receptionBtn} onPress={handleVisitorCheckIn}>
                  <Text style={styles.btnText}>Register Visitor</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeader}>Today's Guest Presence Log</Text>
              <ScrollView style={styles.logConsole} nestedScrollEnabled>
                {visitorLogs.map((log, index) => (
                  <Text key={index} style={styles.visitorLogLine}>{log}</Text>
                ))}
                {visitorLogs.length === 0 && (
                  <Text style={styles.emptyLogText}>No visitor logs recorded today.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// 3. CODE STYLING SHEETS
// ==========================================
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#0a1f33',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subHeader: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 32,
  },
  formCard: {
    width: '100%',
    backgroundColor: '#0f2942',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#0c2035',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  loginBtn: {
    height: 48,
    backgroundColor: '#0f55ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  userTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  roleSub: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 50,
  },
  networkStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  networkOnlineBg: {
    backgroundColor: '#ecfdf5',
    borderBottomColor: '#a7f3d0',
  },
  networkOfflineBg: {
    backgroundColor: '#fff1f2',
    borderBottomColor: '#fca5a5',
  },
  networkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  textOnline: {
    color: '#10b981',
  },
  textOffline: {
    color: '#f43f5e',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionSpace: {
    gap: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0f55ff',
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  routeDetails: {
    gap: 16,
  },
  routeHeader: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  routeTarget: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  trackingMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    color: '#475569',
  },
  deliverBtn: {
    height: 44,
    backgroundColor: '#10b981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
  },
  syncBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f55ff',
  },
  queueStats: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 12,
  },
  queueCount: {
    fontWeight: 'bold',
    color: '#0f55ff',
  },
  logConsole: {
    height: 150,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
  },
  emptyLogText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  logLine: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  subText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  scannerViewport: {
    height: 180,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    marginBottom: 16,
  },
  scannerTargetText: {
    fontSize: 11,
    color: '#64748b',
  },
  scanBtn: {
    height: 44,
    backgroundColor: '#0f55ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manifestHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 12,
  },
  manifestList: {
    gap: 8,
  },
  manifestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  manifestItemText: {
    fontSize: 12,
    color: '#0f172a',
  },
  receptionForm: {
    gap: 12,
  },
  receptionInput: {
    height: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  receptionBtn: {
    height: 44,
    backgroundColor: '#0f55ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorLogLine: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
    lineHeight: 16,
  }
});
