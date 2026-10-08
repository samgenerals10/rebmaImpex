// Reveal on scroll for the phone, the twin of the web's SmoothScrollArea.
// Screen shares its scroll position; each card or list row works out where
// it sits and fades and rises in as that spot scrolls into view. Things
// already on screen when the page opens are fully shown at once, and
// anything not yet measured is shown normally, so nothing can stay hidden.
// Off when the phone's "Reduce motion" setting is on, and outside a
// scrolling Screen (sheets, dialogs).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';

export interface RevealInfo {
  scrollY: Animated.Value;
  viewportH: number;
  /** Window y of the top of the scroll view, measured on layout. */
  viewportTop: number;
  /** Current scroll offset, read once when a card measures itself. */
  currentScroll: () => number;
}

export const RevealContext = createContext<RevealInfo | null>(null);

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; }).catch(() => {});

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function RevealView({ children, style }: Props) {
  const info = useContext(RevealContext);
  const ref = useRef<any>(null);
  const [contentY, setContentY] = useState<number | null>(null);

  const measure = () => {
    if (!info || reduceMotion || !info.viewportH) return;
    ref.current?.measureInWindow?.((_x: number, y: number) => {
      if (typeof y !== 'number' || Number.isNaN(y)) return;
      setContentY(y - info.viewportTop + info.currentScroll());
    });
  };

  useEffect(() => { measure(); }, [info?.viewportH]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info || reduceMotion || contentY == null || !info.viewportH) {
    return <Animated.View ref={ref} style={style} onLayout={measure}>{children}</Animated.View>;
  }

  // Already visible when the page opened: no animation at all.
  const start = contentY - info.viewportH;
  if (start < -60) {
    return <Animated.View ref={ref} style={style} onLayout={measure}>{children}</Animated.View>;
  }
  const opacity = info.scrollY.interpolate({ inputRange: [start - 10, start + 90], outputRange: [0, 1], extrapolate: 'clamp' });
  const translateY = info.scrollY.interpolate({ inputRange: [start - 10, start + 110], outputRange: [18, 0], extrapolate: 'clamp' });
  return (
    <Animated.View ref={ref} style={[style, { opacity, transform: [{ translateY }] }]} onLayout={measure}>
      {children}
    </Animated.View>
  );
}
