// rebma-mobile/screens/adminWarehouse/SpreadsheetsScreen.tsx
// Thin wrapper — the actual logic lives in the shared
// components/shared/SpreadsheetGrid.tsx (both DATA and FREE modes, plus
// the spreadsheets_enabled access gate), built once so every department's
// own Spreadsheets sub-tab can reuse it unmodified with just a different
// `department` prop.
import Screen from '../../components/ui/Screen';
import SpreadsheetGrid from '../../components/shared/SpreadsheetGrid';

export default function SpreadsheetsScreen() {
  return (
    <Screen>
      <SpreadsheetGrid department="ADMIN_WAREHOUSE" />
    </Screen>
  );
}
