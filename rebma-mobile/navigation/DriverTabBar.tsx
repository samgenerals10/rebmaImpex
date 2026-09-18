// rebma-mobile/navigation/DriverTabBar.tsx
//
// The driver's own bottom bar — same 5-slot shape and violet FAB as
// AppTabBar.tsx, confirmed with the user before building: Home / Viber /
// raised center FAB / Trips / Profile. A separate file rather than a
// parameterized AppTabBar, so changing one never risks breaking the
// other.
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, Plus, Truck, User } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useUIStore } from '../store/uiStore';
import { useMessengerUnreadStore } from '../store/messengerUnreadStore';

const FAB_COLOR = '#7C5CFC';
const FAB_COLOR_PRESSED = '#6A47E8';

const ICONS: Record<string, any> = { HomeTab: Home, ViberTab: MessageCircle, TripsTab: Truck, ProfileTab: User };
const LABELS: Record<string, string> = { HomeTab: 'Home', ViberTab: 'Viber', TripsTab: 'Trips', ProfileTab: 'Profile' };

export default function DriverTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const openQuickActions = useUIStore((s) => s.openQuickActions);
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
      {renderTab('TripsTab')}
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
        onPress={() => navigation.navigate(routeName)}
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
