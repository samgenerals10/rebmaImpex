// A gentle rise-in for content that has just appeared (a tab's content, a
// new section). Same feel as the web app: about 0.24s with a soft
// ease-out. Give it a `key` that changes with the content so it replays.
// Turns itself off when the phone's "Reduce motion" setting is on.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far, in points, the content rises. */
  distance?: number;
  duration?: number;
}

export default function FadeInView({ children, style, distance = 8, duration = 240 }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) { progress.setValue(1); return; }
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }).start();
      })
      .catch(() => progress.setValue(1));
    return () => { cancelled = true; };
  }, [progress, duration]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
