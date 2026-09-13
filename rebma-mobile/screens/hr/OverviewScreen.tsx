// rebma-mobile/screens/hr/OverviewScreen.tsx
// Ports: rebma-web/src/views/hr/OverviewView.tsx (546 lines) — condensed
// (D61) per the established Overview precedent (Finance/Risk/Management):
// real KPI tiles + one real needs-attention list + ApprovalHistoryPanel +
// module launcher. Not a port of the recharts-heavy dashboard (area/bar/
// pie/line charts + a YoY headcount RPC).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, UserCheck, UserPlus, Calendar } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import MetricCard from '../../components/ui/MetricCard';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

export default function OverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('HR');

  const [totalStaff, setTotalStaff] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const [total, active, pending, leave] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'Approved').lte('start_date', today).gte('end_date', today).then((r) => r, () => ({ count: 0 })),
    ]);
    setTotalStaff(total.count || 0);
    setActiveStaff(active.count || 0);
    setPendingRegistrations(pending.count || 0);
    setOnLeaveToday((leave as any).count || 0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Staff" value={loading ? '—' : totalStaff} icon={<Users size={16} color={t.colors.accent} />} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Active Staff" value={loading ? '—' : activeStaff} tone="accent" icon={<UserCheck size={16} color={t.colors.accent} />} /></View>
          <View style={{ width: '47%' }}>
            <MetricCard label="Pending Registrations" value={loading ? '—' : pendingRegistrations} tone="warning" icon={<UserPlus size={16} color={t.colors.status.warning.text} />} onPress={() => navigation.navigate('Registrations')} />
          </View>
          <View style={{ width: '47%' }}><MetricCard label="On Leave Today" value={loading ? '—' : onLeaveToday} icon={<Calendar size={16} color={t.colors.textSecondary} />} /></View>
        </View>

        {pendingRegistrations > 0 && (
          <Text
            onPress={() => navigation.navigate('Registrations')}
            style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent, textAlign: 'center' }}
          >
            {pendingRegistrations} registration{pendingRegistrations !== 1 ? 's' : ''} awaiting review →
          </Text>
        )}

        <ApprovalHistoryPanel department="HR" title="Recent HR Activity" />

        <ModuleLauncher dept={dept} exclude={['Employees']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
