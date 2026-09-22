// rebma-mobile/navigation/RootNavigator.tsx
//
// Root stack (Phase 7.0). Driver identity outranks department (D6),
// mirroring rebma-web's App.tsx exactly: an unconditional `drivers` lookup
// runs on every profile load (store/authStore.ts loadProfileAndDriver),
// and a driver session never sees the department tab shell (AppShell) —
// it goes straight to DriverShell, its own separate tab shell (Home /
// Viber / + / Trips / Profile), whatever its `role` string says. This is
// a plain decision tree, not a switch on department. DriverShell's Home
// tab is DispatchHomeScreen, unmodified from before this pass — it used
// to be the entire screen with no chrome at all; it's now wrapped in a
// tab bar, nothing about its own GPS/offline logic changed.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DriverShell from './DriverShell';
import AppShell from './AppShell';
import MessengerStack from './MessengerStack';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const t = useTheme();
  const { initializing, profile, driver } = useAuthStore();

  // App.tsx now owns kicking off auth.initialize() (in parallel with the
  // animated splash's logo, which is the app's one and only loading
  // indicator — see AnimatedSplashScreen.tsx) and only mounts this
  // component once that has already finished, so this branch is a
  // defensive fallback for an edge-case timing gap, not a real loading
  // screen of its own — no second spinner here.
  if (initializing) {
    return null;
  }

  const navTheme = {
    dark: false,
    colors: {
      primary: t.colors.accent,
      background: t.colors.bgPage,
      card: t.colors.bgCard,
      text: t.colors.textPrimary,
      border: t.colors.border,
      notification: t.colors.status.danger.text,
    },
    fonts: {
      regular: { fontFamily: t.font.regular, fontWeight: '400' as const },
      medium: { fontFamily: t.font.medium, fontWeight: '500' as const },
      bold: { fontFamily: t.font.bold, fontWeight: '700' as const },
      heavy: { fontFamily: t.font.extrabold, fontWeight: '800' as const },
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!profile ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : driver ? (
          <Stack.Screen name="DriverTracking" component={DriverShell} />
        ) : (
          <>
            <Stack.Screen name="App" component={AppShell} />
            <Stack.Screen name="Messenger" component={MessengerStack} options={{ presentation: 'card' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
