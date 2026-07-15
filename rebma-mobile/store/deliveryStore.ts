import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CoordinatePoint {
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

export const useDeliveryStore = create<DeliveryStore>((set, get) => ({
  activeOrderId: null,
  gpsActive: false,
  networkOnline: true,
  coordinateBuffer: [],
  deliveredOrders: [],

  setActiveOrder: (orderId) => set({ activeOrderId: orderId }),
  setGpsActive: (active) => set({ gpsActive: active }),

  setNetworkOnline: (online) => {
    set({ networkOnline: online });
    if (online && get().coordinateBuffer.length > 0) {
      get().loadPersistedData();
    }
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
