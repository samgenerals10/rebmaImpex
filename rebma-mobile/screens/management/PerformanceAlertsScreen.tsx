// rebma-mobile/screens/management/PerformanceAlertsScreen.tsx
// Thin wrapper around the new shared components/shared/PerformanceAlertsPanel.tsx (D44).
import Screen from '../../components/ui/Screen';
import PerformanceAlertsPanel from '../../components/shared/PerformanceAlertsPanel';

export default function PerformanceAlertsScreen() {
  return (
    <Screen>
      <PerformanceAlertsPanel />
    </Screen>
  );
}
