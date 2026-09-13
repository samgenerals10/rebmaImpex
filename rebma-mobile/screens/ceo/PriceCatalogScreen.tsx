// rebma-mobile/screens/ceo/PriceCatalogScreen.tsx
// Thin wrapper (D69) — PriceCatalogGrid (Phase 7.3) is already
// parameterized by `department`; CEO is already in its CAN_SEE_COST list,
// so this renders Cost Price/Margin exactly like the web version does for
// a CEO viewer. Zero new code.
import Screen from '../../components/ui/Screen';
import PriceCatalogGrid from '../../components/shared/PriceCatalogGrid';

export default function PriceCatalogScreen() {
  return (
    <Screen>
      <PriceCatalogGrid department="CEO" />
    </Screen>
  );
}
