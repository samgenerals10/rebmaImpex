// rebma-mobile/screens/BoardroomHomeScreen.tsx
//
// Pushed from ViberHomeScreen's "Boardroom" button — lists the 4
// meeting-related screens (Live Video Minutes, Announcements, Direct
// Messages, Meetings Organizer). BOARDROOM's registry entry still exists
// (excluded only from availableDepartments(), same treatment SETTINGS
// already had), so ModuleLauncher renders it exactly like a department
// home screen would.
import Screen from '../components/ui/Screen';
import ModuleLauncher from '../components/chrome/ModuleLauncher';
import { getDepartmentEntry } from '../navigation/departmentRegistry';

const BOARDROOM = getDepartmentEntry('BOARDROOM');

export default function BoardroomHomeScreen({ navigation }: any) {
  return (
    <Screen>
      <ModuleLauncher dept={BOARDROOM} onSelect={(id) => navigation.navigate(id)} />
    </Screen>
  );
}
