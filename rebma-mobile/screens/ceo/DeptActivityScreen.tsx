// rebma-mobile/screens/ceo/DeptActivityScreen.tsx
// Thin wrapper (D69) — DeptActivityGrid (Phase 7.5) is already reused by
// Management/Risk; CEO's own `isCeo` check inside the grid (profile.department
// === 'CEO') already unlocks the CEO-inclusive feed for this viewer with
// no prop needed beyond `department`. Zero new code.
import Screen from '../../components/ui/Screen';
import DeptActivityGrid from '../../components/shared/DeptActivityGrid';

export default function DeptActivityScreen() {
  return (
    <Screen>
      <DeptActivityGrid department="CEO" />
    </Screen>
  );
}
