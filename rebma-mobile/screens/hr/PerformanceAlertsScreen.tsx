// rebma-mobile/screens/hr/PerformanceAlertsScreen.tsx
// Thin wrapper (D59) — HR's real PerformanceAlerts sub-tab is the shared
// components/shared/PerformanceAlertsPanel.tsx (built Phase 7.6), not
// rebma-web/src/views/hr/PerformanceAlertsView.tsx, which is dead code
// (App.tsx routes activeSubTab==='PerformanceAlerts' to the shared
// PerformanceAlertsPanel before HR's own department-scoped block runs).
import Screen from '../../components/ui/Screen';
import PerformanceAlertsPanel from '../../components/shared/PerformanceAlertsPanel';

export default function PerformanceAlertsScreen() {
  return (
    <Screen>
      <PerformanceAlertsPanel />
    </Screen>
  );
}
