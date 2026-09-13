// rebma-mobile/screens/finance/SpreadsheetsScreen.tsx
// Thin wrapper — DEPT_TABLES.FINANCE (finance_payments, orders, stock) is
// already baked into the shared components/shared/SpreadsheetGrid.tsx.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="FINANCE" />
    </Screen>
  );
}
