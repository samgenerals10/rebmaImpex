// rebma-mobile/components/splash/AnimatedSplashScreen.tsx
//
// Direct correction: this used to run a fixed ~1s spin-in and then hand
// off unconditionally, regardless of whether the app was actually ready
// (fonts + the auth/session check in RootNavigator). Handing off early
// meant a SECOND, different-looking spinner (a plain ActivityIndicator
// in RootNavigator) would appear right after this one finished — "the
// logo spins, and then the loading icon also shows up" was a real,
// reported bug, not a one-off.
//
// Fix: the logo still does its one-time spin-in entrance, but once that
// settles it keeps spinning in a continuous loop for as long as `ready`
// is false, instead of stopping. `onDone` only fires once BOTH the
// intro animation has settled AND `ready` is true, so this is now the
// only loading indicator the app ever shows — nothing hands off to a
// separate spinner. `ready` is driven by the real app-ready condition
// (fonts loaded + auth/session check finished), computed in App.tsx.
import { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

const LOGO_ASPECT = 398 / 237; // assets/logo-mark.png's real crop ratio
const FINAL_WIDTH = 200;

export default function AnimatedSplashScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.15)).current;
  const introRotate = useRef(new Animated.Value(0)).current;
  const loopRotate = useRef(new Animated.Value(0)).current;
  const [introDone, setIntroDone] = useState(false);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // One-time entrance: fade in, scale up with a small overshoot, spin
  // in from -220deg to 0deg. Fixed durations (not an open-ended spring)
  // so this phase always takes the same time on every platform.
  useEffect(() => {
    const intro = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
        Animated.timing(introRotate, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);
    intro.start(() => setIntroDone(true));
    return () => intro.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the intro settles, if the app still isn't ready, keep the same
  // logo spinning at a steady continuous rate — this IS the loading
  // indicator now, not a plain ActivityIndicator shown after it.
  useEffect(() => {
    if (!introDone || ready) return;
    loopRotate.setValue(0);
    const loop = Animated.loop(
      Animated.timing(loopRotate, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [introDone, ready]);

  // Hand off only once both the entrance has settled AND the app is
  // actually ready — never on a fixed timer alone.
  useEffect(() => {
    if (!introDone || !ready) return;
    loopRef.current?.stop();
    const t = setTimeout(onDone, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introDone, ready]);

  const introSpin = introRotate.interpolate({ inputRange: [0, 1], outputRange: ['-220deg', '0deg'] });
  const loopSpin = loopRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/logo-mark.png')}
        resizeMode="contain"
        style={[styles.logo, { opacity, transform: [{ scale }, { rotate: introDone ? loopSpin : introSpin }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  logo: { width: FINAL_WIDTH, height: FINAL_WIDTH / LOGO_ASPECT },
});
