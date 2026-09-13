// rebma-mobile/screens/reception/SpreadsheetsScreen.tsx
// Thin wrapper — same pattern as adminWarehouse/SpreadsheetsScreen.tsx.
// DEPT_TABLES.RECEPTION (visitors, attendance) is already baked into the
// shared components/shared/SpreadsheetGrid.tsx from Phase 7.1.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="RECEPTION" />
    </Screen>
  );
}
