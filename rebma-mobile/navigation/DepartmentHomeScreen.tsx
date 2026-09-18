// rebma-mobile/navigation/DepartmentHomeScreen.tsx
//
// Registry-driven router (Phase 7.0) — replaces the hand-written
// switch(profile.department). Driver handling has moved out of this file
// entirely: it's now a root-stack decision (RootNavigator, D6), matching
// rebma-web's App.tsx where driver identity outranks department before any
// shell renders. This screen only ever runs for a non-driver session.
//
// Reads uiStore's `activeDepartment` (not profile.department directly) so
// the CEO/admin department switcher can actually change what's displayed —
// it's seeded from the signed-in profile's own department on login/session
// restore and only diverges when an admin explicitly switches channels.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { getDepartmentEntry } from './departmentRegistry';
import DepartmentPlaceholderScreen from '../screens/DepartmentPlaceholderScreen';
import { DashboardHeaderBackground, DashboardIconRow } from '../components/chrome/AppHeader';
import { useHeaderAnim } from './AppShell';

export default function DepartmentHomeScreen() {
  const { profile } = useAuthStore();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const setActiveDepartment = useUIStore((s) => s.setActiveDepartment);
  const headerAnim = useHeaderAnim();

  useEffect(() => {
    if (profile && !activeDepartment) setActiveDepartment(profile.department);
  }, [profile?.department]);

  if (!profile) return null;

  const effectiveDepartment = activeDepartment || profile.department;
  const dept = getDepartmentEntry(effectiveDepartment);
  const HomeScreen = dept.screens.home;

  return (
    <View style={{ flex: 1 }}>
      <DashboardHeaderBackground />
      <View style={{ flex: 1, zIndex: 1 }}>
        {HomeScreen ? <HomeScreen /> : <DepartmentPlaceholderScreen department={effectiveDepartment} />}
      </View>
      <DashboardIconRow scrollAnim={headerAnim ?? undefined} />
    </View>
  );
}
