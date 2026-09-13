// rebma-mobile/screens/marketing/SpreadsheetsScreen.tsx
// Thin wrapper — DEPT_TABLES.MARKETING (orders) is already baked into the
// shared components/shared/SpreadsheetGrid.tsx from Phase 7.1.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="MARKETING" />
    </Screen>
  );
}
