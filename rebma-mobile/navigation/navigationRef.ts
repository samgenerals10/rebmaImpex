// rebma-mobile/navigation/navigationRef.ts
//
// Phase 7.1, D13. QuickActionsSheet is rendered as a sibling of
// Tab.Navigator (see AppShell.tsx), not inside DepartmentStack, so it has
// no `navigation` prop of its own to call .navigate() on. This ref, set on
// RootNavigator.tsx's <NavigationContainer>, lets it (and anything else
// outside the navigator tree) trigger navigation from the outside.
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Navigates to a department sub-tab screen by its registry subTab id (the
// DepartmentStack route name). No-ops if the container isn't ready yet
// (e.g. a Quick Action tapped before the first render settles) rather than
// throwing — matching this app's general "degrade, don't crash" posture.
export function navigateToSubTab(subTabId: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(subTabId as never);
}
