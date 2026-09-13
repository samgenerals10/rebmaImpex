// rebma-mobile/screens/ceo/SpreadsheetsScreen.tsx
// Thin wrapper (D69) — CEO already present in mobile's SpreadsheetGrid.tsx
// DEPT_TABLES (orders, finance_payments, delivery_logs, global_audit_history,
// stock, cargo_intake). Zero new code.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="CEO" />
    </Screen>
  );
}
