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
import Card from '../../components/ui/Card';
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
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                Active Staff
              </Text>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: t.colors.onAccent, marginTop: t.spacing.xs }}>
                {loading ? '—' : activeStaff}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {loading ? '' : `of ${totalStaff} total staff`}
              </Text>
            </View>
            <View style={{ width: 52, height: 52, borderRadius: t.radius.lg, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={26} color={t.colors.onAccent} />
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <MetricCard label="Pending" value={loading ? '—' : pendingRegistrations} icon={<UserPlus size={16} color={t.colors.action.amber} />} tone="neutral" onPress={() => navigation.navigate('Registrations')} />
          <MetricCard label="On Leave" value={loading ? '—' : onLeaveToday} icon={<Calendar size={16} color={t.colors.action.sky} />} tone="neutral" />
          <MetricCard label="Total" value={loading ? '—' : totalStaff} icon={<Users size={16} color={t.colors.action.violet} />} tone="neutral" onPress={() => navigation.navigate('Staff')} />
        </View>

        {pendingRegistrations > 0 && (
          <Text
            onPress={() => navigation.navigate('Registrations')}
            style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.accent, textAlign: 'center' }}
          >
            {pendingRegistrations} registration{pendingRegistrations !== 1 ? 's' : ''} awaiting review
          </Text>
        )}

        <ApprovalHistoryPanel department="HR" title="Recent HR Activity" />

        <ModuleLauncher dept={dept} exclude={['Employees']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
