// rebma-mobile/screens/marketing/PriceCatalogScreen.tsx
// Thin wrapper — the actual logic lives in the shared
// components/shared/PriceCatalogGrid.tsx (D22), reused by Finance/
// Management/CEO's own phases with a different `department`.
import Screen from '../../components/ui/Screen';
import PriceCatalogGrid from '../../components/shared/PriceCatalogGrid';

export default function PriceCatalogScreen() {
  return (
    <Screen>
      <PriceCatalogGrid department="MARKETING" />
    </Screen>
  );
}
