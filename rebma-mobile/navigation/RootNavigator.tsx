// rebma-mobile/navigation/RootNavigator.tsx
//
// Root stack (Phase 7.0). Driver identity outranks department (D6),
// mirroring rebma-web's App.tsx exactly: an unconditional `drivers` lookup
// runs on every profile load (store/authStore.ts loadProfileAndDriver),
// and a driver session never sees the tab shell — it goes straight to the
// restyled DispatchHomeScreen with no chrome, whatever its `role` string
// says. This is a plain decision tree, not a switch on department.
import { useEffect } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DispatchHomeScreen from '../screens/dispatch/DispatchHomeScreen';
import AppShell from './AppShell';
import MessengerStack from './MessengerStack';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const t = useTheme();
  const { initializing, profile, driver, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bgPage }}>
        <StatusBar barStyle="dark-content" backgroundColor={t.colors.bgPage} />
        <ActivityIndicator color={t.colors.accent} size="large" />
      </View>
    );
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
          <Stack.Screen name="DriverTracking" component={DispatchHomeScreen} />
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
