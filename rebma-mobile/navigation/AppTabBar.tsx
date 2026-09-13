// rebma-mobile/navigation/AppTabBar.tsx
// Ports: rebma-web/src/components/layout/MobileNav.tsx — custom tabBar (not
// screenOptions) because the centre FAB overhangs the bar and can't be a
// normal tab button.
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Plus, Bell, User } from 'lucide-react-native';
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
      {renderFab()}
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
          <Icon size={20} color={color} />
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

  function renderFab() {
    return (
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          onPress={openQuickActions}
          disabled={!profile}
          style={({ pressed }) => [
            {
              width: 48,
              height: 48,
              borderRadius: 24,
              marginTop: -24,
              backgroundColor: t.colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.2)',
              transform: [{ scale: pressed ? 0.95 : 1 }],
              ...t.shadow('fab'),
            },
          ]}
        >
          <Plus size={24} color={t.colors.onAccent} />
        </Pressable>
      </View>
    );
  }
}
