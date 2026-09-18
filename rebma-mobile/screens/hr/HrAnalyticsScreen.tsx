// rebma-mobile/screens/hr/HrAnalyticsScreen.tsx
//
// New — step 4 of the tab-bar rebuild. HR's Overview already shows
// Pending Staff / On Leave Today / Staff Directory / Departments, so
// this deliberately shows something different: today's attendance rate
// (computed live, same "real, not hardcoded" attendance figure already
// established for the Performance tab elsewhere in HR), plus a leave
// requests breakdown by status. Built against real attendance/
// leave_requests columns already verified elsewhere (AttendanceScreen,
// LeaveManagementScreen).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import BarChart from '../../components/ui/BarChart';

const LEAVE_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444',
};

export default function HrAnalyticsScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalStaff, setTotalStaff] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [byLeaveStatus, setByLeaveStatus] = useState<{ label: string; value: number; formattedValue: string; color: string }[]>([]);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [staffRes, attendanceRes, leaveRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('attendance').select('status').eq('date', today),
      supabase.from('leave_requests').select('status').limit(2000),
    ]);

    const todaysAttendance = attendanceRes.data || [];
    const presentToday = todaysAttendance.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const rate = todaysAttendance.length ? Math.round((presentToday / todaysAttendance.length) * 100) : 0;

    const leaveRows = leaveRes.data || [];
    const byStatusMap: Record<string, number> = {};
    leaveRows.forEach((r: any) => {
      const status = (r.status || 'PENDING').toUpperCase();
      byStatusMap[status] = (byStatusMap[status] || 0) + 1;
    });
    const leaveData = Object.entries(byStatusMap).map(([status, count]) => ({
      label: status.charAt(0) + status.slice(1).toLowerCase(),
      value: count,
      formattedValue: String(count),
      color: LEAVE_COLORS[status] || t.colors.accent,
    }));

    setTotalStaff(staffRes.count || 0);
    setAttendanceRate(rate);
    setPendingLeave(byStatusMap['PENDING'] || 0);
    setByLeaveStatus(leaveData);
    setLoading(false);
    setRefreshing(false);
  }, [t.colors.accent]);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Active Staff" value={loading ? '—' : totalStaff} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Attendance Today" value={loading ? '—' : `${attendanceRate}%`} tone={attendanceRate >= 80 ? 'success' : 'warning'} /></View>
          <View style={{ width: '100%' }}><MetricCard label="Pending Leave Requests" value={loading ? '—' : pendingLeave} tone={pendingLeave > 0 ? 'warning' : 'neutral'} emphasis="secondary" /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Leave Requests by Status</Text>
          {byLeaveStatus.length > 0 ? (
            <BarChart data={byLeaveStatus} />
          ) : (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No leave requests yet</Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
