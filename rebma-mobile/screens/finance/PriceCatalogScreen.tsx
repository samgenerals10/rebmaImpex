// rebma-mobile/screens/finance/PriceCatalogScreen.tsx
// Thin wrapper — Finance is in CAN_SEE_COST, so PriceCatalogGrid shows
// Cost Price/Margin correctly here, unlike Marketing's read of this same
// shared component.
import Screen from '../../components/ui/Screen';
import PriceCatalogGrid from '../../components/shared/PriceCatalogGrid';

export default function PriceCatalogScreen() {
  return (
    <Screen>
      <PriceCatalogGrid department="FINANCE" />
    </Screen>
  );
}
