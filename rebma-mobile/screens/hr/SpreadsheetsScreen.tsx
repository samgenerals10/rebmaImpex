// rebma-mobile/screens/hr/SpreadsheetsScreen.tsx
// Thin wrapper (D60) — HR already present in mobile's SpreadsheetGrid.tsx
// DEPT_TABLES (profiles → "Staff Profiles", attendance → "Attendance Logs").
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="HR" />
    </Screen>
  );
}
