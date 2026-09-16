// rebma-mobile/screens/hr/OverviewScreen.tsx
// Ports: rebma-web/src/views/hr/OverviewView.tsx
// Redesigned with Aczone Design System: Hero Card, 2x2 Metric Grid, Quick Action Hubs, Linear styling.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, UserCheck, UserPlus, Calendar, Building2, Clock, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';

export default function OverviewScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const dept = getDepartmentEntry('HR');

  const [totalStaff, setTotalStaff] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [deptCount, setDeptCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const [total, active, pending, leave, depts] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'Approved').lte('start_date', today).gte('end_date', today).then((r) => r, () => ({ count: 0 })),
      supabase.from('departments').select('id', { count: 'exact', head: true }).then((r) => r, () => ({ count: 0 })),
    ]);
    setTotalStaff(total.count || 0);
    setActiveStaff(active.count || 0);
    setPendingRegistrations(pending.count || 0);
    setOnLeaveToday((leave as any).count || 0);
    setDeptCount((depts as any).count || 0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        {/* Aczone HR Hero Card */}
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Workforce & Human Capital
                </Text>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: '#FFFFFF', marginTop: 2 }}>
                {loading ? '—' : activeStaff}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {loading ? '' : `of ${totalStaff} registered staff across ${deptCount || 11} departments`}
              </Text>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>

        {/* Aczone 2x2 Metric Grid */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Staffing & Operations" subtitle="Active employee attendance & registration status" />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Pending Staff"
              value={loading ? '—' : pendingRegistrations}
              sublabel="New account reviews"
              icon={<UserPlus size={20} color={t.colors.action.amber} />}
              tone={pendingRegistrations > 0 ? 'warning' : 'neutral'}
              onPress={() => navigation.navigate('Registrations')}
            />
            <MetricCard
              label="On Leave Today"
              value={loading ? '—' : onLeaveToday}
              sublabel="Approved time off"
              icon={<Calendar size={20} color={t.colors.action.sky} />}
              tone="info"
              onPress={() => navigation.navigate('LeaveManagement')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Staff Directory"
              value={loading ? '—' : totalStaff}
              sublabel="Total employees"
              icon={<Users size={20} color={t.colors.action.violet} />}
              tone="neutral"
              onPress={() => navigation.navigate('Staff')}
            />
            <MetricCard
              label="Departments"
              value={loading ? '—' : deptCount || 11}
              sublabel="Organizational units"
              icon={<Building2 size={20} color={t.colors.action.emerald} />}
              tone="success"
              onPress={() => navigation.navigate('DepartmentManager')}
            />
          </View>
        </View>

        {pendingRegistrations > 0 && (
          <Button
            label={`Review ${pendingRegistrations} Staff Registration${pendingRegistrations !== 1 ? 's' : ''} →`}
            onPress={() => navigation.navigate('Registrations')}
            fullWidth
          />
        )}

        {/* Recent HR Activity */}
        <ApprovalHistoryPanel department="HR" title="Recent HR Activity" />

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['Employees']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
