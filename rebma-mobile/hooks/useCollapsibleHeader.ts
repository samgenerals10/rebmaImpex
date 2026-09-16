// rebma-mobile/hooks/useCollapsibleHeader.ts
//
// Drop this into any department overview ScrollView to get the
// collapsible floating header behaviour for free:
//
//   const { scrollHandler, scrollY } = useCollapsibleHeader();
//   <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} ...>
//
// The hook reads HeaderAnimContext from AppShell and drives it with a
// smooth spring so the header collapses when the user scrolls down 60px
// and re-expands immediately when they scroll back up.
import { useRef, useCallback } from 'react';
import { Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useHeaderAnim } from '../navigation/AppShell';

const COLLAPSE_THRESHOLD = 60; // px scrolled before header starts collapsing

export function useCollapsibleHeader() {
  const headerAnim = useHeaderAnim();
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const collapsed = useRef(false);

  const scrollHandler = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (!headerAnim) return;

      if (y > COLLAPSE_THRESHOLD && delta > 0 && !collapsed.current) {
        // Scrolling DOWN past threshold → collapse
        collapsed.current = true;
        Animated.spring(headerAnim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 80,
          friction: 12,
        }).start();
      } else if ((y < COLLAPSE_THRESHOLD || delta < -8) && collapsed.current) {
        // Scrolling UP or near top → expand
        collapsed.current = false;
        Animated.spring(headerAnim, {
          toValue: 0,
          useNativeDriver: false,
          tension: 80,
          friction: 12,
        }).start();
      }
    },
    [headerAnim],
  );

  return { scrollHandler, scrollY };
}
