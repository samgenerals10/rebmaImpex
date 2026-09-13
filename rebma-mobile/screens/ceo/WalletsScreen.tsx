// rebma-mobile/screens/ceo/WalletsScreen.tsx
// Thin wrapper (D69) — web re-exports ceo/WalletsView.tsx verbatim for
// Finance; mobile's WalletsGrid (Phase 7.4) already mirrors that reuse.
// Zero new code.
import Screen from '../../components/ui/Screen';
import WalletsGrid from '../../components/shared/WalletsGrid';

export default function WalletsScreen() {
  return (
    <Screen>
      <WalletsGrid />
    </Screen>
  );
}
