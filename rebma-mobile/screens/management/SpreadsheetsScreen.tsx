// rebma-mobile/screens/management/SpreadsheetsScreen.tsx
// Thin wrapper — MANAGEMENT already present in mobile's SpreadsheetGrid.tsx
// DEPT_TABLES (ported verbatim in Phase 7.1). Zero new code.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="MANAGEMENT" />
    </Screen>
  );
}
