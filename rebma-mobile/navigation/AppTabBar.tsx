// rebma-mobile/navigation/AppTabBar.tsx
// Ports: rebma-web/src/components/layout/MobileNav.tsx.
//
// Current 5-slot layout: Home / Viber / raised center FAB / Analytics /
// Dashboard. Dashboard took Profile's old slot per direct correction —
// Profile itself stays fully reachable via the header Avatar's Account
// sheet ("Profile & Preferences" row), same header-only-access treatment
// AlertsTab already got a round earlier (see below).
//
// 'ViberTab' opens ViberStack (chats, with Boardroom reachable from
// inside it — see ViberHomeScreen.tsx). Its unread dot comes from
// useMessengerUnreadStore, the same store AppHeader's chat icon reads.
//
// 'AnalyticsTab' opens AnalyticsTabScreen, which routes to whichever
// department's real Analytics screen already exists (5 of 11 today —
// the rest are a documented next step, not silently missing).
//
// 'DashboardTab' opens the new compact cross-department-style summary
// (DashboardScreen.tsx) — deliberately not a duplicate of Home, which
// already opens the department's own full Overview screen.
//
// 'AlertsTab' (Notifications) and 'ProfileTab' both lost their bottom-tab
// buttons in earlier rounds — the 5 slots don't have room for everything
// — but both stay fully reachable via the header (bell icon, Account
// sheet), so nothing was actually removed, only their position in the bar.
//
// The center Quick Actions button IS a raised, bordered, elevated circle
// (see renderActionTab below). Per direct correction this round, its
// fill now DOES follow the shared `colors.accent`/`accentPressed`
// tokens — reversing the earlier "deliberate scoped exception" that
// pinned it to a literal violet regardless of the app's chosen accent
// color. Matching every other accent-driven surface (header gradient,
// active tab color, etc.) was the actual ask.
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, Plus, ChartColumn, LayoutGrid } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { useMessengerUnreadStore } from '../store/messengerUnreadStore';

const ICONS: Record<string, any> = { HomeTab: Home, ViberTab: MessageCircle, AnalyticsTab: ChartColumn, DashboardTab: LayoutGrid };
const LABELS: Record<string, string> = { HomeTab: 'Home', ViberTab: 'Viber', AnalyticsTab: 'Analytics', DashboardTab: 'Quick Links' };

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
      {renderTab('DashboardTab')}
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
          style={({ pressed }) => ({
            // Per direct correction: no shadow, and "hanging" — mostly
            // above the bar's top edge (like before) but sitting lower/
            // closer to the bar than a symmetrically-centered float, so
            // it visually hangs off the bar rather than floating free.
            top: -14,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: pressed ? t.colors.accentPressed : t.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 5,
            borderColor: t.colors.bgCard,
          })}
        >
          <Plus size={24} color="#ffffff" strokeWidth={3} />
        </Pressable>
      </View>
    );
  }
}
