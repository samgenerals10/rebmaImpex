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
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { getDepartmentEntry } from './departmentRegistry';
import DepartmentPlaceholderScreen from '../screens/DepartmentPlaceholderScreen';

export default function DepartmentHomeScreen() {
  const { profile } = useAuthStore();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const setActiveDepartment = useUIStore((s) => s.setActiveDepartment);

  useEffect(() => {
    if (profile && !activeDepartment) setActiveDepartment(profile.department);
  }, [profile?.department]);

  if (!profile) return null;

  const effectiveDepartment = activeDepartment || profile.department;
  const dept = getDepartmentEntry(effectiveDepartment);
  const HomeScreen = dept.screens.home;

  if (HomeScreen) return <HomeScreen />;

  return <DepartmentPlaceholderScreen department={effectiveDepartment} />;
}
