// rebma-mobile/screens/ceo/TransactionsScreen.tsx
// Thin wrapper (D69) — web itself re-exports the same ceo/TransactionsView.tsx
// for Finance/Management; mobile's TransactionsGrid (Phase 7.4) already
// mirrors that reuse. Zero new code.
import Screen from '../../components/ui/Screen';
import TransactionsGrid from '../../components/shared/TransactionsGrid';

export default function TransactionsScreen() {
  return (
    <Screen>
      <TransactionsGrid />
    </Screen>
  );
}
