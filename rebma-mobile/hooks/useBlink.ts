// rebma-mobile/hooks/useBlink.ts
//
// Shared pulsing-opacity loop for "this needs your attention right now" —
// the notification bell (when there's an unread alert) and any flagged
// KPI card (MetricCard's `flagged` prop) both use this same animation,
// so the two read as one consistent visual language across the app
// rather than two different one-off effects.
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function useBlink(active: boolean, opacityRange: [number, number] = [0.35, 1]) {
  const value = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: opacityRange[0], duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: opacityRange[1], duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return value;
}

// Border/color pulsing (a flagged MetricCard's red border) can't use the
// native driver — color interpolation is JS-driven only — so this is a
// deliberately separate hook from the opacity-only one above, not a
// shared implementation detail. Interpolates between the two given
// colors instead of fading the whole element, so the card's own text
// stays fully legible while it blinks.
export function useBlinkColor(active: boolean, colorA: string, colorB: string) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return progress.interpolate({ inputRange: [0, 1], outputRange: [colorA, colorB] });
}
