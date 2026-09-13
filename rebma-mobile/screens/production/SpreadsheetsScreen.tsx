// rebma-mobile/screens/production/SpreadsheetsScreen.tsx
// Thin wrapper (D67) — PRODUCTION already present in mobile's
// SpreadsheetGrid.tsx DEPT_TABLES (production_requests, production_logs,
// wip_stock). Zero new code.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="PRODUCTION" />
    </Screen>
  );
}
