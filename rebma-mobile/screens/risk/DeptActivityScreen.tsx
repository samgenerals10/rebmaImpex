// rebma-mobile/screens/risk/DeptActivityScreen.tsx
// Thin wrapper around the shared components/shared/DeptActivityGrid.tsx (D32).
import Screen from '../../components/ui/Screen';
import DeptActivityGrid from '../../components/shared/DeptActivityGrid';

export default function DeptActivityScreen() {
  return (
    <Screen>
      <DeptActivityGrid department="RISK" />
    </Screen>
  );
}
