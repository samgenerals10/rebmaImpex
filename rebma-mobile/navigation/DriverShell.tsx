// rebma-mobile/navigation/DriverShell.tsx
//
// The driver's own tab shell — same 5-slot shape as AppShell.tsx (Home /
// Viber / + / Trips / Profile), confirmed with the user before building.
// DispatchHomeScreen is mounted here completely unmodified — its GPS and
// offline-buffer logic is the highest-risk code in this app and none of
// it was touched, only where it's mounted changed (it used to be the
// entire screen with no chrome; now it's the Home tab's content, same as
// before but with a tab bar added around it).
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DriverTabBar from './DriverTabBar';
import ViberStack from './ViberStack';
import DriverProfileStack from './DriverProfileStack';
import DriverQuickActionsSheet from '../components/chrome/DriverQuickActionsSheet';
import DispatchHomeScreen from '../screens/dispatch/DispatchHomeScreen';
import DriverTripsScreen from '../screens/dispatch/DriverTripsScreen';
import { useUIStore } from '../store/uiStore';

const Tab = createBottomTabNavigator();

function ActionPlaceholder() {
  return null;
}

// Sheets render as siblings of the Tab.Navigator, same pattern
// AppShell.tsx already uses for its own QuickActionsSheet.
function DriverQuickActionsSheetHost() {
  const navigation = useNavigation<any>();
  return (
    <DriverQuickActionsSheet
      onGoHome={() => navigation.navigate('HomeTab')}
      onReportIssue={() => navigation.navigate('ProfileTab', { screen: 'Feedback' })}
    />
  );
}

export default function DriverShell() {
  return (
    <>
      <Tab.Navigator tabBar={(props) => <DriverTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="HomeTab" component={DispatchHomeScreen} />
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
        <Tab.Screen name="TripsTab" component={DriverTripsScreen} />
        <Tab.Screen name="ProfileTab" component={DriverProfileStack} />
      </Tab.Navigator>
      <DriverQuickActionsSheetHost />
    </>
  );
}
