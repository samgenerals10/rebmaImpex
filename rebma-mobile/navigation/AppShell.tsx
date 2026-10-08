// rebma-mobile/navigation/AppShell.tsx
//
// The persistent chrome around the whole signed-in, non-driver app. The
// department dashboard header (AppHeader.tsx's DashboardHeader) is
// fixed (position:absolute, always on top, never covered) — content
// scrolls behind/under it, dimming the header slightly via
// headerScrollAnim rather than ever letting content capture clicks
// meant for the header (see AppHeader.tsx's own header comment for the
// two rounds that tried the other way around and hit real bugs). The
// three overlays (department switcher, quick actions, search) are
// siblings driven by useUIStore rather than navigator routes (see
// store/uiStore.ts for why).
import { useEffect, useRef, createContext, useContext } from 'react';
import { View, Animated } from 'react-native';
import { useSafeAreaInsets, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { joinLiveUsersChannel, leaveLiveUsersChannel } from '../lib/presence';
import PersistentIconRow, { ICON_ROW_H } from '../components/chrome/PersistentIconRow';
import FloatingHelpButton from '../components/chrome/FloatingHelpButton';

/** Raw scroll offset from whichever department dashboard is mounted — purely to dim the fixed header as content scrolls behind it. */
export const HeaderAnimContext = createContext<Animated.Value | null>(null);
export const useHeaderAnim = () => useContext(HeaderAnimContext);
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppTabBar from './AppTabBar';
import DepartmentHomeScreen from './DepartmentHomeScreen';
import { getDepartmentEntry } from './departmentRegistry';
import { navigateToSubTab } from './navigationRef';
import NotificationsScreen from '../screens/NotificationsScreen';
import ViberStack from './ViberStack';
import AnalyticsTabScreen from '../screens/AnalyticsTabScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DesignSystemScreen from '../screens/DesignSystemScreen';
import SearchScreen from '../screens/SearchScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import HrQueriesScreen from '../screens/hr/HrQueriesScreen';
import PayslipsScreen from '../screens/PayslipsScreen';
import NotesScreen from '../screens/NotesScreen';
import TasksScreen from '../screens/TasksScreen';
import EmailsScreen from '../screens/EmailsScreen';
import HelpDeskScreen from '../screens/HelpDeskScreen';
import SubScreenHeader from '../components/chrome/SubScreenHeader';
import DepartmentSwitcherSheet from '../components/chrome/DepartmentSwitcherSheet';
import QuickActionsSheet from '../components/chrome/QuickActionsSheet';
import ConnectivityBanner from '../components/chrome/ConnectivityBanner';
import IncomingCallSheet from '../components/shared/IncomingCallSheet';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';

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
  const { profile } = useAuthStore();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const effectiveDepartment = activeDepartment || profile?.department || '';
  const dept = getDepartmentEntry(effectiveDepartment);

  const subScreens = Object.entries(dept.screens).filter(([id]) => id !== 'home');

  return (
    <DepartmentStack.Navigator key={dept.code} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
              header: (props) => <SubScreenHeader {...props} />,
            }}
          />
        );
      })}
    </DepartmentStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <ProfileStackNav.Screen name="ProfileHome">
        {({ navigation }) => (
          <ProfileScreen
            onOpenDesignSystem={() => navigation.navigate('DesignSystem')}
            onOpenSettings={() => { useUIStore.getState().setActiveDepartment('SETTINGS'); navigation.getParent()?.navigate('HomeTab'); }}
            onOpenFeedback={() => navigation.navigate('Feedback')}
            onOpenHrQueries={() => navigation.navigate('HrQueries')}
            onOpenPayslips={() => navigation.navigate('Payslips')}
            onOpenNotes={() => navigation.navigate('Notes')}
            onOpenTasks={() => navigation.navigate('Tasks')}
            onOpenEmails={() => navigation.navigate('Emails')}
            onOpenHelp={() => navigation.navigate('HelpDesk')}
          />
        )}
      </ProfileStackNav.Screen>
      <ProfileStackNav.Screen
        name="DesignSystem"
        component={DesignSystemScreen}
        options={{ headerShown: true, headerTitle: 'Design System', header: (props) => <SubScreenHeader {...props} /> }}
      />
      <ProfileStackNav.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ headerShown: true, headerTitle: 'Feedback', header: (props) => <SubScreenHeader {...props} /> }}
      />
      <ProfileStackNav.Screen
        name="HrQueries"
        component={HrQueriesScreen}
        options={{ headerShown: true, headerTitle: 'HR Queries', header: (props) => <SubScreenHeader {...props} /> }}
      />
      <ProfileStackNav.Screen
        name="Payslips"
        component={PayslipsScreen}
        options={{ headerShown: true, headerTitle: 'My Payslips', header: (props) => <SubScreenHeader {...props} /> }}
      />
      <ProfileStackNav.Screen name="Notes" component={NotesScreen} options={{ headerShown: true, headerTitle: 'My Notes', header: (props) => <SubScreenHeader {...props} /> }} />
      <ProfileStackNav.Screen name="Tasks" component={TasksScreen} options={{ headerShown: true, headerTitle: 'Tasks', header: (props) => <SubScreenHeader {...props} /> }} />
      <ProfileStackNav.Screen name="Emails" component={EmailsScreen} options={{ headerShown: true, headerTitle: 'Emails', header: (props) => <SubScreenHeader {...props} /> }} />
      <ProfileStackNav.Screen name="HelpDesk" component={HelpDeskScreen} options={{ headerShown: true, headerTitle: 'Help & News', header: (props) => <SubScreenHeader {...props} /> }} />
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
  const headerScrollAnim = useRef(new Animated.Value(0)).current;
  // The true, unadjusted device insets — PersistentIconRow itself needs
  // these (it's the thing establishing the offset). Everything rendered
  // below it instead sees an INFLATED `top` (see adjustedInsets below),
  // so every screen in the app — every tab, every pushed sub-page —
  // automatically renders starting below the icon row with zero
  // per-screen changes, since SafeAreaView / useSafeAreaInsets() /
  // SubScreenHeader's own insets.top padding all just read whatever
  // SafeAreaInsetsContext value is active in the tree at that point.
  const trueInsets = useSafeAreaInsets();
  const adjustedInsets = { ...trueInsets, top: trueInsets.top + ICON_ROW_H };

  // Phase 10.3 — Live Users.
  useEffect(() => {
    if (!profile) return;
    joinLiveUsersChannel({
      userId: profile.id,
      fullName: profile.fullName,
      department: profile.department,
      photo: profile.photo,
      loggedInAt: new Date().toISOString(),
    });
    return () => { leaveLiveUsersChannel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <HeaderAnimContext.Provider value={headerScrollAnim}>
      <View style={{ flex: 1 }}>
        <ConnectivityBanner />
        {/* Rings like a phone when someone calls you in a chat */}
        <IncomingCallSheet />
        <SafeAreaInsetsContext.Provider value={adjustedInsets}>
          {searchOpen ? (
            // Same rule as every other screen: "nothing should go above the
            // icons" is blanket, not dashboard-only — Search used to be an
            // early return above the whole tree (skipping PersistentIconRow
            // and the adjusted-insets provider entirely), which is exactly
            // why its logo/chat/bell/avatar row went missing. It now lives
            // inside the same provider every tab/sub-page already uses.
            <SearchScreen onClose={closeSearch} />
          ) : (
            <>
              <Tab.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
                <Tab.Screen name="HomeTab" component={DepartmentStackScreen} />
                <Tab.Screen name="ViberTab" component={ViberStack} />
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
                <Tab.Screen name="AnalyticsTab" component={AnalyticsTabScreen} />
                <Tab.Screen name="DashboardTab" component={DashboardScreen} />
                {/* AlertsTab and ProfileTab both stay registered (reachable via
                    the header bell / Account sheet's "Profile & Preferences" row)
                    even though AppTabBar no longer renders bottom-tab buttons for
                    them, DashboardTab took Profile's old bottom-nav slot per
                    direct correction, same "still a real route, just header-only
                    access now" treatment AlertsTab already got a round earlier. */}
                <Tab.Screen name="AlertsTab" component={NotificationsScreen} />
                <Tab.Screen name="ProfileTab" component={ProfileStackScreen} />
              </Tab.Navigator>

              <DepartmentSwitcherSheet
                onSelectDepartment={(code) => useUIStore.getState().setActiveDepartment(code)}
                onOpenSettings={() => useUIStore.getState().setActiveDepartment('SETTINGS')}
              />
              <QuickActionsSheet onNavigateSubTab={navigateToSubTab} />
            </>
          )}
        </SafeAreaInsetsContext.Provider>

        {/* Always on top of every tab and every pushed sub-page — "nothing
            should go above the icons" is a blanket rule, not one scoped to
            the department dashboard's own Overview screen. Rendered OUTSIDE
            the adjusted-insets provider above since it's the thing
            establishing that offset; it needs the TRUE inset. */}
        <PersistentIconRow topInset={trueInsets.top} />
        <FloatingHelpButton />
      </View>
    </HeaderAnimContext.Provider>
  );
}
