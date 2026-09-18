// rebma-mobile/screens/AnalyticsTabScreen.tsx
//
// The Analytics bottom tab. Routes to whichever screen already covers
// analytics for the current department. All 9 non-Boardroom/Settings
// departments have a real Analytics screen as of step 4 — 5 already
// existed, Finance/CEO/Risk/HR are new (FinAnalyticsScreen,
// CeoAnalyticsScreen, RiskAnalyticsScreen, HrAnalyticsScreen).
//
// Admin & Warehouse tie-break resolved: it has two real analytics
// screens (Warehouse + Fleet) with genuinely different data behind
// them, and the standing rule here is "don't hide anything" — so both
// are reachable via a segmented toggle rather than picking one and
// dropping the other.
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Screen from '../components/ui/Screen';
import EmptyState from '../components/ui/EmptyState';
import Tabs from '../components/ui/Tabs';
import { ChartColumn } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import OpsAnalyticsScreen from './adminWarehouse/OpsAnalyticsScreen';
import FleetAnalyticsScreen from './adminWarehouse/FleetAnalyticsScreen';
import MgmtAnalyticsScreen from './management/MgmtAnalyticsScreen';
import MarketingAnalyticsScreen from './marketing/AnalyticsScreen';
import ProdAnalyticsScreen from './production/AnalyticsScreen';
import ReceptionAnalyticsScreen from './reception/AnalyticsScreen';
import FinAnalyticsScreen from './finance/FinAnalyticsScreen';
import CeoAnalyticsScreen from './ceo/CeoAnalyticsScreen';
import RiskAnalyticsScreen from './risk/RiskAnalyticsScreen';
import HrAnalyticsScreen from './hr/HrAnalyticsScreen';

const BUILT: Record<string, any> = {
  MANAGEMENT: MgmtAnalyticsScreen,
  MARKETING: MarketingAnalyticsScreen,
  PRODUCTION: ProdAnalyticsScreen,
  RECEPTION: ReceptionAnalyticsScreen,
  FINANCE: FinAnalyticsScreen,
  CEO: CeoAnalyticsScreen,
  RISK: RiskAnalyticsScreen,
  HR: HrAnalyticsScreen,
};

function AdminWarehouseAnalytics() {
  const t = useTheme();
  const [view, setView] = useState<'warehouse' | 'fleet'>('warehouse');
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bgPage }}>
      {/* Own top-safe wrapper for the tab row only (the two child
          screens each own a full Screen with its own SafeAreaView) —
          costs a little extra top whitespace before their content
          starts, in exchange for the tab row never sitting under the
          notch/status bar. */}
      <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: t.colors.bgPage }}>
        <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm }}>
          <Tabs
            variant="segmented"
            value={view}
            onChange={(v) => setView(v as 'warehouse' | 'fleet')}
            options={[{ value: 'warehouse', label: 'Warehouse' }, { value: 'fleet', label: 'Fleet' }]}
          />
        </View>
      </SafeAreaView>
      {view === 'warehouse' ? <OpsAnalyticsScreen /> : <FleetAnalyticsScreen />}
    </View>
  );
}

export default function AnalyticsTabScreen() {
  const t = useTheme();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const profile = useAuthStore((s) => s.profile);
  const dept = activeDepartment || profile?.department || '';

  if (dept === 'ADMIN_WAREHOUSE') return <AdminWarehouseAnalytics />;

  const Built = BUILT[dept];
  if (Built) return <Built />;

  return (
    <Screen>
      <EmptyState
        icon={<ChartColumn size={20} color={t.colors.textMuted} />}
        title="Analytics not built yet"
        description="A dedicated Analytics screen for this department is coming, not wired up yet."
      />
    </Screen>
  );
}
