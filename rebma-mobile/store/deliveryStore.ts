import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface DeliveryStore {
  activeOrderId: string | null;
  gpsActive: boolean;
  /** Effective connectivity = autoOnline && !forcedOffline — this is what every screen reads. */
  networkOnline: boolean;
  /** Real, netinfo-driven connectivity (Phase 7.12, D121). */
  autoOnline: boolean;
  /** The driver-facing manual override — "Force Offline Mode" for testing, kept from before this phase. */
  forcedOffline: boolean;
  coordinateBuffer: CoordinatePoint[];
  deliveredOrders: string[];
  setActiveOrder: (orderId: string | null) => void;
  setGpsActive: (active: boolean) => void;
  /** Deprecated alias for setForcedOffline(!online) — kept so existing call sites (the manual Switch) still work. */
  setNetworkOnline: (online: boolean) => void;
  setForcedOffline: (forced: boolean) => void;
  bufferCoordinate: (point: CoordinatePoint) => void;
  clearBuffer: () => void;
  markOrderDelivered: (orderId: string) => void;
  loadPersistedData: () => Promise<void>;
  /** Starts the real NetInfo listener; call once near the root. Returns an unsubscribe fn. */
  startConnectivityWatch: () => () => void;
}

export const useDeliveryStore = create<DeliveryStore>((set, get) => ({
  activeOrderId: null,
  gpsActive: false,
  networkOnline: true,
  autoOnline: true,
  forcedOffline: false,
  coordinateBuffer: [],
  deliveredOrders: [],

  setActiveOrder: (orderId) => set({ activeOrderId: orderId }),
  setGpsActive: (active) => set({ gpsActive: active }),

  // Kept as a thin alias over setForcedOffline so DispatchHomeScreen's
  // existing Switch (onValueChange={setNetworkOnline}) didn't need a
  // rewire — "online=false" from that Switch now means "force offline,"
  // not "the real network dropped," matching D121's override design.
  setNetworkOnline: (online) => get().setForcedOffline(!online),

  setForcedOffline: (forced) => {
    set({ forcedOffline: forced });
    const effective = get().autoOnline && !forced;
    set({ networkOnline: effective });
    if (effective && get().coordinateBuffer.length > 0) {
      get().loadPersistedData();
    }
  },

  startConnectivityWatch: () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const auto = !!state.isConnected;
      set({ autoOnline: auto });
      const effective = auto && !get().forcedOffline;
      const wasOffline = !get().networkOnline;
      set({ networkOnline: effective });
      if (effective && wasOffline && get().coordinateBuffer.length > 0) {
        get().loadPersistedData();
      }
    });
    return unsubscribe;
  },

  bufferCoordinate: async (point) => {
    const newBuffer = [...get().coordinateBuffer, point];
    set({ coordinateBuffer: newBuffer });
    await AsyncStorage.setItem('gps_buffer_queue', JSON.stringify(newBuffer));
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
      if (savedBuffer) set({ coordinateBuffer: JSON.parse(savedBuffer) });
      if (savedDelivered) set({ deliveredOrders: JSON.parse(savedDelivered) });
    } catch (e) {
      console.log('AsyncStorage load failed:', e);
    }
  }
}));
