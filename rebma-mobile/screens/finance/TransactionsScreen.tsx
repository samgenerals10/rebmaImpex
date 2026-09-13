// rebma-mobile/screens/finance/TransactionsScreen.tsx
// Thin wrapper around the shared components/shared/TransactionsGrid.tsx (D27).
import Screen from '../../components/ui/Screen';
import TransactionsGrid from '../../components/shared/TransactionsGrid';

export default function TransactionsScreen() {
  return (
    <Screen>
      <TransactionsGrid />
    </Screen>
  );
}
