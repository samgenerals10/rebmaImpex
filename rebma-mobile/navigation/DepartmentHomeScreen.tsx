import { useAuthStore } from '../store/authStore';
import DispatchHomeScreen from '../screens/dispatch/DispatchHomeScreen';
import OperationsHomeScreen from '../screens/operations/OperationsHomeScreen';
import ReceptionHomeScreen from '../screens/reception/ReceptionHomeScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';

// Picks which department's screen to render based on the signed-in profile.
// Mirrors rebma-web's App.tsx department switch (activeDepartment derived from
// profiles.role) — new departments get slotted in here as they're built.
export default function DepartmentHomeScreen() {
  const { profile, driver } = useAuthStore();
  if (!profile) return null;

  switch (profile.department) {
    case 'DISPATCH':
      return driver
        ? <DispatchHomeScreen />
        : <ComingSoonScreen department="Dispatch" reason="This account isn't linked to a driver profile yet — ask Dispatch to invite you from the Drivers screen." />;
    case 'OPERATIONS':
      return <OperationsHomeScreen />;
    case 'RECEPTION':
      return <ReceptionHomeScreen />;
    default:
      return <ComingSoonScreen department={profile.department} />;
  }
}
