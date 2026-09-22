// rebma-mobile/hooks/useCollapsibleHeader.ts
//
// Drop this into any department dashboard's ScrollView:
//
//   const { scrollHandler } = useCollapsibleHeader();
//   <Screen onScroll={scrollHandler} scrollEventThrottle={16} ...>
//
// Screen.tsx auto-detects the `onScroll` prop and switches into its
// dashboard layout: a fixed DashboardHeader (always on top, never
// covered) with content scrolling behind it. This hook forwards the
// raw scroll offset into HeaderAnimContext, which DashboardHeader
// reads purely to dim itself slightly once the page has scrolled —
// a cosmetic cue that content is behind it, not a z-order change.
import { useCallback } from 'react';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useHeaderAnim } from '../navigation/AppShell';

export function useCollapsibleHeader() {
  const headerAnim = useHeaderAnim();

  const scrollHandler = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      headerAnim?.setValue(Math.max(0, e.nativeEvent.contentOffset.y));
    },
    [headerAnim],
  );

  return { scrollHandler };
}
