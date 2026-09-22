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
// DepartmentStack route name, nested inside the bottom tab bar's HomeTab).
// No-ops if the container isn't ready yet (e.g. a Quick Action tapped
// before the first render settles) rather than throwing — matching this
// app's general "degrade, don't crash" posture.
//
// Explicitly targets HomeTab first (`{ screen: subTabId }`), rather than
// a bare `navigate(subTabId)` — confirmed live that the bare form throws
// "action NAVIGATE... was not handled by any navigator" when called from
// a sibling tab (e.g. the Dashboard tab) whose own navigator has no
// screen by that name; React Navigation's plain `navigate(name)` only
// reliably resolves a name that's a descendant of the CURRENTLY FOCUSED
// tab, not an arbitrary sibling tab's nested stack. The `{screen: ...}`
// form is the documented, always-reliable way to jump into a specific
// tab's nested navigator from anywhere.
export function navigateToSubTab(subTabId: string) {
  if (!navigationRef.isReady()) return;
  (navigationRef.navigate as (name: string, params?: object) => void)('HomeTab', { screen: subTabId });
}
