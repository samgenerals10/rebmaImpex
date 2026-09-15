// rebma-mobile/navigation/AppTabBar.tsx
// Ports: rebma-web/src/components/layout/MobileNav.tsx.
//
// Correction (mobile-ui-fluidity skill, bottom-nav section): this used to
// raise the Quick Actions button into an elevated center FAB, floating
// above the bar. Confirmed directly against the reference images and the
// user's own live build that this reads as wrong — the reference never
// raises or resizes any single item across all nine of its screens; every
// bottom bar is a plain flat row, same size, same baseline, all four items.
// Quick Actions is now a normal flat tab item like the other three, just
// with its own icon/label — same real functionality, no special elevation.
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Zap, Bell, User } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationsStore } from '../store/notificationsStore';

const ICONS: Record<string, any> = { HomeTab: Home, AlertsTab: Bell, ProfileTab: User };
const LABELS: Record<string, string> = { HomeTab: 'Home', AlertsTab: 'Alerts', ProfileTab: 'Profile' };

export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const openQuickActions = useUIStore((s) => s.openQuickActions);
  const profile = useAuthStore((s) => s.profile);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);

  const activeRouteName = state.routes[state.index].name;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 64,
        backgroundColor: t.colors.bgCard,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        paddingBottom: 4,
        ...t.shadow('tabBar'),
      }}
    >
      {renderTab('HomeTab')}
      {renderActionTab()}
      {renderTab('AlertsTab')}
      {renderTab('ProfileTab')}
    </View>
  );

  function renderTab(routeName: string) {
    const Icon = ICONS[routeName];
    const isActive = activeRouteName === routeName;
    const color = isActive ? t.colors.accent : t.colors.textMuted;

    return (
      <Pressable
        key={routeName}
        onPress={() => {
          if (routeName === 'HomeTab' && isActive) {
            // Matches MobileNav.tsx's "Home resets to your own department" behaviour.
            navigation.navigate('HomeTab', { screen: 'DepartmentHome' });
          } else {
            navigation.navigate(routeName);
          }
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
      >
        <View>
          <Icon size={20} color={color} strokeWidth={isActive ? 2.4 : 2} />
          {routeName === 'AlertsTab' && unreadCount > 0 && (
            <View style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.status.danger.text }} />
          )}
        </View>
        <Text style={{ fontFamily: isActive ? t.font.bold : t.font.regular, fontSize: t.type.label9.size, color }}>
          {LABELS[routeName]}
        </Text>
      </Pressable>
    );
  }

  function renderActionTab() {
    return (
      <Pressable
        onPress={openQuickActions}
        disabled={!profile}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
      >
        <Zap size={20} color={t.colors.textMuted} />
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.label9.size, color: t.colors.textMuted }}>
          Actions
        </Text>
      </Pressable>
    );
  }
}
