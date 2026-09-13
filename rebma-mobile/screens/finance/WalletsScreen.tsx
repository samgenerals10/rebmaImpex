// rebma-mobile/screens/finance/WalletsScreen.tsx
// Thin wrapper around the shared components/shared/WalletsGrid.tsx (D27).
import Screen from '../../components/ui/Screen';
import WalletsGrid from '../../components/shared/WalletsGrid';

export default function WalletsScreen() {
  return (
    <Screen>
      <WalletsGrid />
    </Screen>
  );
}
