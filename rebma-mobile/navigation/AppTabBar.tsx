// rebma-mobile/navigation/AppTabBar.tsx
// Ports: rebma-web/src/components/layout/MobileNav.tsx.
//
// Final confirmed 5-slot layout: Home / Viber / raised center FAB /
// Analytics / Profile, violet FAB — restyled to the user's own reference
// image, then walked through slot-by-slot with the user before anything
// was built (see conversation record, not just this file).
//
// 'ViberTab' opens ViberStack (chats, with Boardroom reachable from
// inside it — see ViberHomeScreen.tsx). Its unread dot comes from
// useMessengerUnreadStore, the same store AppHeader's chat icon reads.
//
// 'AnalyticsTab' opens AnalyticsTabScreen, which routes to whichever
// department's real Analytics screen already exists (5 of 11 today —
// the rest are a documented next step, not silently missing).
//
// 'AlertsTab' (Notifications) lost its bottom-tab button in this
// restyle — the 5 slots didn't have room for it — but it's still fully
// reachable via the header bell (AppHeader's onNavigateAlerts), so
// nothing was actually removed, only its position in the bar.
//
// The center Quick Actions button IS a raised, bordered, elevated circle
// (see renderActionTab below) — confirmed against the user's own live
// build as the correct, current design. Its fill color is the
// reference's violet (#7C5CFC), not the app's green accent — a
// deliberate, scoped exception: the user gave this one component an
// explicit literal reference to match, this doesn't touch the shared
// `colors.accent` token or repaint anything else in the app.
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, Plus, ChartColumn, User } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { useMessengerUnreadStore } from '../store/messengerUnreadStore';

const FAB_COLOR = '#7C5CFC';
const FAB_COLOR_PRESSED = '#6A47E8';

const ICONS: Record<string, any> = { HomeTab: Home, ViberTab: MessageCircle, AnalyticsTab: ChartColumn, ProfileTab: User };
const LABELS: Record<string, string> = { HomeTab: 'Home', ViberTab: 'Viber', AnalyticsTab: 'Analytics', ProfileTab: 'Profile' };

export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const openQuickActions = useUIStore((s) => s.openQuickActions);
  const profile = useAuthStore((s) => s.profile);
  const viberUnreadCount = useMessengerUnreadStore((s) => s.unreadCount);

  const activeRouteName = state.routes[state.index].name;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 68,
        backgroundColor: t.colors.bgCard,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        paddingBottom: 6,
        paddingHorizontal: 4,
        ...t.shadow('tabBar'),
      }}
    >
      {renderTab('HomeTab')}
      {renderTab('ViberTab')}
      {renderActionTab()}
      {renderTab('AnalyticsTab')}
      {renderTab('ProfileTab')}
    </View>
  );

  function renderTab(routeName: string) {
    const Icon = ICONS[routeName] || Home;
    const isActive = activeRouteName === routeName;
    const color = isActive ? t.colors.accent : t.colors.textMuted;

    return (
      <Pressable
        key={routeName}
        onPress={() => {
          if (routeName === 'HomeTab' && isActive) {
            navigation.navigate('HomeTab', { screen: 'DepartmentHome' });
          } else {
            navigation.navigate(routeName);
          }
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={color} strokeWidth={isActive ? 2.5 : 2} />
          {routeName === 'ViberTab' && viberUnreadCount > 0 && (
            <View style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.status.danger.text }} />
          )}
        </View>
        <Text style={{ fontFamily: isActive ? t.font.bold : t.font.medium, fontSize: t.type.label9.size, color }}>
          {LABELS[routeName]}
        </Text>
      </Pressable>
    );
  }

  function renderActionTab() {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          onPress={openQuickActions}
          disabled={!profile}
          style={({ pressed }) => [
            {
              top: -14,
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: pressed ? FAB_COLOR_PRESSED : FAB_COLOR,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 4,
              borderColor: t.colors.bgCard,
            },
            t.shadow('fab'),
          ]}
        >
          <Plus size={24} color="#ffffff" strokeWidth={3} />
        </Pressable>
      </View>
    );
  }
}
