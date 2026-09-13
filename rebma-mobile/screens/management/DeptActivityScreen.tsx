// rebma-mobile/screens/management/DeptActivityScreen.tsx
// Thin wrapper around the shared components/shared/DeptActivityGrid.tsx
// (built Phase 7.5, D32 — confirmed reused verbatim across department
// routes on web, including Management).
import Screen from '../../components/ui/Screen';
import DeptActivityGrid from '../../components/shared/DeptActivityGrid';

export default function DeptActivityScreen() {
  return (
    <Screen>
      <DeptActivityGrid department="MANAGEMENT" />
    </Screen>
  );
}
