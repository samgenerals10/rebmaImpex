// rebma-mobile/screens/NotificationsScreen.tsx
// Ports: rebma-web/src/components/global/NotificationsPanel.tsx (266
// lines, read in full) — D92, rebuilt from the Phase 7.0 empty-shell
// scaffold. That scaffold's own comment guessed the real backing table
// would be `supplier_order_notifications` — confirmed WRONG by direct
// source read. The real table is `notifications`, filtered by
// `recipient_id` OR `recipient_department` (matching NotificationsPanel.tsx
// exactly), with mark-read/mark-all-read/clear-all. No realtime (D80
// precedent) — polls every 8s while mounted. `supplier_order_notifications`
// is a separate department-level ops-alert queue, never a personal feed;
// the confirmed-orphaned `user_notifications` table (written nowhere
// real) is not ported.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Bell, CheckCheck, Trash2, ExternalLink } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useNotificationsStore } from '../store/notificationsStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import PageTitle from '../components/ui/PageTitle';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';

interface DbNotification {
  id: string; title: string; message: string; type: string; read: boolean;
  created_at: string; action_url: string | null; action_label: string | null;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_BG: Record<string, string> = { success: '#10b98120', warning: '#f59e0b20', error: '#f43f5e20' };

export default function NotificationsScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const refreshUnreadCount = useNotificationsStore((s) => s.refreshUnreadCount);
  const [notifs, setNotifs] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(`recipient_id.eq.${profile.id},recipient_department.eq.${profile.department}`)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifs((data as any) || []);
    setLoading(false);
    setRefreshing(false);
    refreshUnreadCount(profile.id, profile.department);
  }, [profile?.id, profile?.department]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const markRead = async (n: DbNotification) => {
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    if (profile) refreshUnreadCount(profile.id, profile.department);
    if (n.action_url?.startsWith('http')) Linking.openURL(n.action_url);
  };

  const markAllRead = async () => {
    const unreadIds = notifs.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    if (profile) refreshUnreadCount(profile.id, profile.department);
  };

  const clearAll = async () => {
    if (!profile) return;
    await supabase.from('notifications').delete().eq('recipient_id', profile.id);
    setNotifs([]);
    refreshUnreadCount(profile.id, profile.department);
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.lg }}>
        <PageTitle title={unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications'} />
      </View>
      {(unreadCount > 0 || notifs.length > 0) && (
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
          {unreadCount > 0 && <Button label="Mark all read" size="sm" variant="ghost" icon={<CheckCheck size={13} color={t.colors.accent} />} onPress={markAllRead} />}
          {notifs.length > 0 && <Button label="Clear all" size="sm" variant="ghost" icon={<Trash2 size={13} color={t.colors.textSecondary} />} onPress={clearAll} />}
        </View>
      )}

      {loading ? (
        <SkeletonList rows={4} />
      ) : notifs.length === 0 ? (
        <EmptyState icon={<Bell size={22} color={t.colors.textMuted} />} title="You're all caught up" description="New alerts for your department will show up here." />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {notifs.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => markRead(n)}
              style={{
                flexDirection: 'row', gap: t.spacing.sm, borderWidth: 1, borderColor: t.colors.border,
                borderRadius: t.radius.md, padding: t.spacing.md, backgroundColor: t.colors.bgCard, opacity: n.read ? 0.6 : 1,
              }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: TYPE_BG[n.type] || t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={14} color={t.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.sm }}>
                  <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textPrimary }} numberOfLines={2}>{n.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {n.action_url ? <ExternalLink size={11} color={t.colors.accent} /> : null}
                    {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.accent }} />}
                  </View>
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginTop: 2 }}>{n.message}</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>{timeAgo(n.created_at)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
