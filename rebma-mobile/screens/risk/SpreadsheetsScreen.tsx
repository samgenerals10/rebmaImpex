// rebma-mobile/screens/risk/SpreadsheetsScreen.tsx
// Thin wrapper — DEPT_TABLES has no RISK entry on web (confirmed by grep),
// matching the already-ported mobile SpreadsheetGrid.tsx, which also has
// none. Renders the same "No data tables configured" empty state web does.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="RISK" />
    </Screen>
  );
}
