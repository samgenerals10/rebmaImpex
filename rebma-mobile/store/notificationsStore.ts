// rebma-mobile/store/notificationsStore.ts
// Phase 7.11, D92. A minimal Zustand store (matching uiStore.ts's existing
// pattern) holding a polled unread count from the real `notifications`
// table (recipient_id OR recipient_department match, mirroring
// NotificationsPanel.tsx exactly — not supplier_order_notifications, not
// the confirmed-orphaned user_notifications). Feeds a badge dot on both
// AppHeader's bell and AppTabBar's Alerts tab icon. No realtime (D80
// precedent) — refreshUnreadCount is called on an interval by whichever
// screen/component needs it live.
import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

interface NotificationsState {
  unreadCount: number;
  refreshUnreadCount: (userId: string, department: string) => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unreadCount: 0,
  refreshUnreadCount: async (userId, department) => {
    if (!userId && !department) return;
    let query = supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false);
    query = userId && department
      ? query.or(`recipient_id.eq.${userId},recipient_department.eq.${department}`)
      : userId
      ? query.eq('recipient_id', userId)
      : query.eq('recipient_department', department);
    const { count } = await query;
    set({ unreadCount: count || 0 });
  },
}));
