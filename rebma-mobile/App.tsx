// rebma-mobile/App.tsx
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppFonts } from './theme/fonts';
import { useDeliveryStore } from './store/deliveryStore';
import { useAuthStore } from './store/authStore';
import { registerForPushNotifications } from './lib/pushNotifications';
import RootNavigator from './navigation/RootNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Phase 7.12, D119: status bar icons need to stay legible against
// whichever background ThemeProvider is currently rendering — light
// content on the dark-mode background, dark content on the light one.
// Lives inside ThemeProvider (not next to it) so it can read `darkMode`.
function AppStatusBar() {
  const t = useTheme();
  return <StatusBar style={t.darkMode ? 'light' : 'dark'} />;
}

export default function App() {
  const fontsReady = useAppFonts();
  const profileId = useAuthStore((s) => s.profile?.id);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  // Phase 7.12, D121: a single root-level NetInfo listener drives
  // `networkOnline` automatically for the whole app — previously this
  // flag was only ever flipped by a driver's own manual Switch.
  useEffect(() => {
    const unsubscribe = useDeliveryStore.getState().startConnectivityWatch();
    return unsubscribe;
  }, []);

  // Phase 7.12, D128: client registration on login/foreground. Degrades
  // silently (logs a reason, never throws or alerts the user) whenever
  // any of the three D130 blockers aren't cleared yet — this is expected
  // until the user runs `eas init` and Supabase access is restored, not
  // an error state to surface in the UI.
  useEffect(() => {
    if (!profileId) return;
    registerForPushNotifications(profileId).then((res) => {
      if (!res.token) console.log('[push] registration skipped:', res.reason);
    });
  }, [profileId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && profileId) {
        registerForPushNotifications(profileId).then((res) => {
          if (!res.token) console.log('[push] foreground re-registration skipped:', res.reason);
        });
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [profileId]);

  const onLayout = useCallback(() => {}, []);

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayout}>
      <ThemeProvider>
        <AppStatusBar />
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
