// rebma-mobile/hooks/useCollapsibleHeader.ts
//
// Drop this into any department dashboard's ScrollView:
//
//   const { scrollHandler } = useCollapsibleHeader();
//   <Screen onScroll={scrollHandler} scrollEventThrottle={16} ...>
//
// Screen.tsx auto-detects the `onScroll` prop and switches into its
// dashboard layout (transparent spacer + rounded-top content sheet —
// see Screen.tsx and AppHeader.tsx's own header comments for why that
// alone is what makes the sheet visually rise and cover the header,
// with no animation needed for that part).
//
// This hook's only job is forwarding the raw scroll offset into
// HeaderAnimContext (1:1, no spring/threshold), which DashboardIconRow
// reads purely to fade the Chat/Bell icons out as the user scrolls.
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
