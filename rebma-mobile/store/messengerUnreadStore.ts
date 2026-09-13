// rebma-mobile/store/messengerUnreadStore.ts
// Phase 11.0. Same minimal-Zustand pattern as notificationsStore.ts — a
// polled global unread count, this time summed across
// messenger.getUnreadCounts()'s per-channel map, feeding a badge dot on
// AppHeader's chat icon (the icon exists even when MessengerChannelsScreen
// has never mounted, so it can't rely on that screen's own local state).
import { create } from 'zustand';
import { messenger } from '../lib/messenger';

interface MessengerUnreadState {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

export const useMessengerUnreadStore = create<MessengerUnreadState>((set) => ({
  unreadCount: 0,
  refreshUnreadCount: async () => {
    const map = await messenger.getUnreadCounts();
    set({ unreadCount: Object.values(map).reduce((a, b) => a + b, 0) });
  },
}));
