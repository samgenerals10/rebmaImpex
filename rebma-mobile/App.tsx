// rebma-mobile/App.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
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
import AnimatedSplashScreen from './components/splash/AnimatedSplashScreen';
import AppAlertHost from './components/ui/AppAlertHost';

SplashScreen.preventAutoHideAsync().catch(() => {});

// PersistentIconRow's colored gradient header is a fixed, always-on-top
// overlay on every single screen (dashboard or plain) — so the status
// bar icons need to stay 'light' always, not toggle with dark mode; the
// bar they sit over is never the page background, it's always that
// gradient. This SDK's expo-status-bar has no `translucent`/
// `backgroundColor` prop at all (checked its actual .d.ts, not assumed —
// edge-to-edge is the platform default now, not something this
// component configures), so 'style' is the only real lever left. This
// is now the ONLY StatusBar control in the app; Screen.tsx used to
// render a second, conflicting one (react-native's own core StatusBar,
// with a solid backgroundColor) on every screen, fighting this one for
// the same native state — removed there, not duplicated here.
function AppStatusBar() {
  return <StatusBar style="light" />;
}

export default function App() {
  const fontsReady = useAppFonts();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const profileId = useAuthStore((s) => s.profile?.id);
  // Auth/session initialization now starts here, immediately, instead of
  // waiting for the animated splash to hand off to RootNavigator first —
  // that's what used to make the splash's fixed ~1s intro finish and then
  // a SECOND, different-looking spinner (RootNavigator's own
  // ActivityIndicator) appear right after it. Kicking this off in
  // parallel with the splash animation, and gating the splash's own
  // handoff on it being done (see the `ready` prop below), means the
  // Rebma logo is the only loading indicator the app ever shows.
  const authInitializing = useAuthStore((s) => s.initializing);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {showAnimatedSplash ? (
          <AnimatedSplashScreen ready={!authInitializing} onDone={() => setShowAnimatedSplash(false)} />
        ) : (
          <RootNavigator />
        )}
        <AppAlertHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
