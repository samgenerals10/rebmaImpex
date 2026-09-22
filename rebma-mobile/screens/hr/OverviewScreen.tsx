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
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import ApprovalHistoryPanel from '../../components/shared/ApprovalHistoryPanel';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';
import TrackedSection from '../../components/ui/TrackedSection';

export default function OverviewScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
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
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        {/* Workforce Snapshot — two clickable tiles, not one oversized
            banner (per direct correction: a full-bleed color block that
            does nothing on tap doesn't belong in a mobile app). */}
        <TrackedSection id="hero" title="Workforce Snapshot" icon={UserCheck}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone="accent"
              label="Active Staff"
              value={loading ? '—' : activeStaff}
              sublabel={`of ${totalStaff} registered`}
              icon={<UserCheck size={18} color={t.colors.accent} />}
              onPress={() => navigation.navigate('Staff')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard
              emphasis="primary"
              tone={pendingRegistrations > 0 ? 'warning' : 'accent'}
              label="Pending Staff"
              value={loading ? '—' : pendingRegistrations}
              sublabel="New reviews"
              icon={<UserPlus size={18} color={pendingRegistrations > 0 ? t.colors.status.warning.text : t.colors.accent} />}
              onPress={() => navigation.navigate('Registrations')}
            />
          </View>
        </View>
        </TrackedSection>

        {/* Key Metrics */}
        <TrackedSection id="metrics" title="Staffing & Operations" icon={Users}>
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Staffing & Operations" subtitle="Active employee attendance & registration status" />
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="On Leave"
                value={loading ? '—' : onLeaveToday}
                sublabel="Approved off"
                icon={<Calendar size={14} color={t.colors.action.sky} />}
                tone="info"
                onPress={() => navigation.navigate('LeaveManagement')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Staff"
                value={loading ? '—' : totalStaff}
                sublabel="Employees"
                icon={<Users size={14} color={t.colors.action.violet} />}
                tone="neutral"
                onPress={() => navigation.navigate('Staff')}
              />
              </View>
              <View style={{ flex: 1 }}>
              <MetricCard
                emphasis="compact"
                label="Departments"
                value={loading ? '—' : deptCount || 11}
                sublabel="Org units"
                icon={<Building2 size={14} color={t.colors.action.emerald} />}
                tone="success"
                onPress={() => navigation.navigate('DepartmentManager')}
              />
              </View>
            </View>
          </View>
        </View>
        </TrackedSection>

        {pendingRegistrations > 0 && (
          <Button
            label={`Review ${pendingRegistrations} Staff Registration${pendingRegistrations !== 1 ? 's' : ''} →`}
            onPress={() => navigation.navigate('Registrations')}
            fullWidth
          />
        )}

        {/* Recent HR Activity */}
        <TrackedSection id="recent-activity" title="Recent HR Activity" icon={Clock}>
        <ApprovalHistoryPanel department="HR" title="Recent HR Activity" />
        </TrackedSection>

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['Employees']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
