// rebma-mobile/screens/management/TransactionsScreen.tsx
// Thin wrapper around the shared components/shared/TransactionsGrid.tsx —
// web itself reuses ceo/TransactionsView.tsx verbatim for Management's
// Transactions sub-tab (management/TransactionsView.tsx is a 2-line
// re-export), so this mirrors that reuse (D45).
import Screen from '../../components/ui/Screen';
import TransactionsGrid from '../../components/shared/TransactionsGrid';

export default function TransactionsScreen() {
  return (
    <Screen>
      <TransactionsGrid />
    </Screen>
  );
}
