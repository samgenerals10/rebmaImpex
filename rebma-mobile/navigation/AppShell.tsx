// rebma-mobile/navigation/AppShell.tsx
//
// The persistent chrome around the whole signed-in, non-driver app —
// AppHeader is shown on the Home tab (matching rebma-web's Header.tsx,
// which is global on web's SPA but is scoped to the dashboard entry point
// here since Alerts/Profile already carry their own PageTitle headers via
// the Screen primitive). The three overlays (department switcher, quick
// actions, search) are siblings driven by useUIStore rather than navigator
// routes (see store/uiStore.ts for why).
import { useEffect } from 'react';
import { View } from 'react-native';
import { joinLiveUsersChannel } from '../lib/presence';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppTabBar from './AppTabBar';
import DepartmentHomeScreen from './DepartmentHomeScreen';
import { getDepartmentEntry } from './departmentRegistry';
import { navigateToSubTab } from './navigationRef';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DesignSystemScreen from '../screens/DesignSystemScreen';
import SearchScreen from '../screens/SearchScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import PayslipsScreen from '../screens/PayslipsScreen';
import AppHeader from '../components/chrome/AppHeader';
import DepartmentSwitcherSheet from '../components/chrome/DepartmentSwitcherSheet';
import QuickActionsSheet from '../components/chrome/QuickActionsSheet';
import ConnectivityBanner from '../components/chrome/ConnectivityBanner';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';

const Tab = createBottomTabNavigator();
const DepartmentStack = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();

// Phase 7.1, D13: registered sub-tab screens push onto this same stack —
// one <DepartmentStack.Screen> per entry in the active department's
// `screens` map (excluding `home`, which stays fixed at the
// `DepartmentHome` route). The Navigator is remounted (via `key`) whenever
// the active department changes, so switching departments always resets
// back to DepartmentHome with no stale routes left over from the last one.
function DepartmentStackScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const effectiveDepartment = activeDepartment || profile?.department || '';
  const dept = getDepartmentEntry(effectiveDepartment);

  const subScreens = Object.entries(dept.screens).filter(([id]) => id !== 'home');

  return (
    <DepartmentStack.Navigator key={dept.code} screenOptions={{ headerShown: false }}>
      <DepartmentStack.Screen name="DepartmentHome" component={DepartmentHomeScreen} />
      {subScreens.map(([id, Component]) => {
        const subTab = dept.subTabs.find((s) => s.id === id);
        return (
          <DepartmentStack.Screen
            key={id}
            name={id}
            component={Component}
            options={{
              headerShown: true,
              headerTitle: subTab?.label || id,
              headerStyle: { backgroundColor: t.colors.bgHeader },
              headerTitleStyle: { fontFamily: t.font.bold, color: t.colors.textPrimary, fontSize: t.type.base16.size },
              headerTintColor: t.colors.accent,
              headerShadowVisible: false,
            }}
          />
        );
      })}
    </DepartmentStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileHome">
        {({ navigation }) => (
          <ProfileScreen
            onOpenDesignSystem={() => navigation.navigate('DesignSystem')}
            onOpenSettings={() => { useUIStore.getState().setActiveDepartment('SETTINGS'); navigation.getParent()?.navigate('HomeTab'); }}
            onOpenFeedback={() => navigation.navigate('Feedback')}
            onOpenPayslips={() => navigation.navigate('Payslips')}
          />
        )}
      </ProfileStackNav.Screen>
      <ProfileStackNav.Screen name="DesignSystem" component={DesignSystemScreen} options={{ headerShown: true, headerTitle: 'Design System' }} />
      <ProfileStackNav.Screen name="Feedback" component={FeedbackScreen} options={{ headerShown: true, headerTitle: 'Feedback' }} />
      <ProfileStackNav.Screen name="Payslips" component={PayslipsScreen} options={{ headerShown: true, headerTitle: 'My Payslips' }} />
    </ProfileStackNav.Navigator>
  );
}

// Dummy screen for the FAB's tab slot — tabPress is intercepted in
// AppTabBar so this component body never actually renders.
function ActionPlaceholder() {
  return null;
}

export default function AppShell() {
  const searchOpen = useUIStore((s) => s.searchOpen);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const { profile } = useAuthStore();

  // Phase 10.3 — Live Users. AppShell only ever mounts for a signed-in,
  // non-driver session, so this tracks exactly once per login and
  // untracks on sign-out/unmount — same shape as web's App.tsx effect.
  useEffect(() => {
    if (!profile) return;
    const channel = joinLiveUsersChannel({
      userId: profile.id,
      fullName: profile.fullName,
      department: profile.department,
      photo: profile.photo,
      loggedInAt: new Date().toISOString(),
    });
    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (searchOpen) {
    return <SearchScreen onClose={closeSearch} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ConnectivityBanner />
      <Tab.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="HomeTab">
          {({ navigation }) => (
            <View style={{ flex: 1 }}>
              <AppHeader
                onNavigateProfile={() => navigation.getParent()?.navigate('ProfileTab')}
                onNavigateAlerts={() => navigation.getParent()?.navigate('AlertsTab')}
              />
              <DepartmentStackScreen />
            </View>
          )}
        </Tab.Screen>
        <Tab.Screen
          name="ActionTab"
          component={ActionPlaceholder}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              useUIStore.getState().openQuickActions();
            },
          }}
        />
        <Tab.Screen name="AlertsTab" component={NotificationsScreen} />
        <Tab.Screen name="ProfileTab" component={ProfileStackScreen} />
      </Tab.Navigator>

      <DepartmentSwitcherSheet
        onSelectDepartment={(code) => useUIStore.getState().setActiveDepartment(code)}
        onOpenSettings={() => useUIStore.getState().setActiveDepartment('SETTINGS')}
      />
      <QuickActionsSheet onNavigateSubTab={navigateToSubTab} />
    </View>
  );
}
