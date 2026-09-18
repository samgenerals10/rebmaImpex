// rebma-mobile/screens/reception/VisitorLogScreen.tsx
// Ports: rebma-web/src/views/reception/OverviewView.tsx
// Redesigned with Aczone Design System: Hero Card, 2x2 Metric Grid, Smooth Quick Check-in, Grouped Action Launcher.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { UserCheck, UserPlus, Users, LogOut, Clock, Building2, ShieldCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { enqueue, QUEUE_KEYS } from '../../lib/offlineQueue';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';
import SectionHeader from '../../components/ui/SectionHeader';

interface VisitorRow {
  id: string;
  full_name: string;
  purpose: string;
  host_name: string;
  check_in_time: string;
  check_out_time: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function VisitorLogScreen() {
  const t = useTheme();
  const { scrollHandler } = useCollapsibleHeader();
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const activeDepartment = useUIStore((s) => s.activeDepartment);
  const dept = getDepartmentEntry(activeDepartment || 'RECEPTION');

  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hostName, setHostName] = useState('');

  const load = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('visitors')
      .select('id, full_name, purpose, host_name, check_in_time, check_out_time')
      .gte('check_in_time', startOfDay.toISOString())
      .order('check_in_time', { ascending: false });
    if (!error && data) setVisitors(data);

    const { count } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('date', startOfDay.toISOString().slice(0, 10));
    setAttendanceToday(count || 0);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheckIn = async () => {
    if (!fullName.trim() || !purpose.trim() || !hostName.trim()) {
      Alert.alert('Missing Info', 'Enter the visitor name, purpose, and who they are visiting.');
      return;
    }
    setSubmitting(true);
    const payload = {
      full_name: fullName.trim(),
      purpose: purpose.trim(),
      host_name: hostName.trim(),
      checked_in_by_id: profile?.id || null,
      check_in_time: new Date().toISOString(),
    };
    const { error } = await supabase.from('visitors').insert(payload);
    setSubmitting(false);
    if (error) {
      await enqueue(QUEUE_KEYS.receptionVisitors, 'visitors', payload);
      Alert.alert('Saved Offline', "No connection right now, so this visitor will sync automatically once you're back online.");
    }
    setFullName('');
    setPurpose('');
    setHostName('');
    load();
  };

  const handleCheckOut = async (visitor: VisitorRow) => {
    setBusyId(visitor.id);
    const { error } = await supabase
      .from('visitors')
      .update({ check_out_time: new Date().toISOString() })
      .eq('id', visitor.id);
    setBusyId(null);
    if (error) {
      Alert.alert('Check-Out Failed', error.message);
      return;
    }
    load();
  };

  const stillIn = visitors.filter((v) => !v.check_out_time);
  const checkedOut = visitors.filter((v) => v.check_out_time);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} onScroll={scrollHandler} scrollEventThrottle={16}>
      <View style={{ gap: t.spacing.xl }}>
        {/* Aczone Reception Hero Card */}
        <Card tone="hero">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' }} />
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                  Front Desk & Access Control
                </Text>
              </View>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.kpi28.size, color: '#FFFFFF', marginTop: 2 }}>
                {loading ? '—' : `${stillIn.length} On Site`}
              </Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                {loading ? '' : `${visitors.length} visitor${visitors.length === 1 ? '' : 's'} registered · ${attendanceToday} staff check-in${attendanceToday === 1 ? '' : 's'}`}
              </Text>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>
        </Card>

        {/* Aczone 2x2 Metric Grid */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Traffic & Attendance" subtitle="Daily facility access activity" />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Visitors Today"
              value={loading ? '—' : visitors.length}
              sublabel="Total arrivals"
              icon={<UserPlus size={20} color={t.colors.action.sky} />}
              tone="info"
              onPress={() => navigation.navigate('Visitors')}
            />
            <MetricCard
              label="Currently Inside"
              value={loading ? '—' : stillIn.length}
              sublabel="Active badges"
              icon={<UserCheck size={20} color={t.colors.action.emerald} />}
              tone={stillIn.length > 0 ? 'accent' : 'neutral'}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <MetricCard
              label="Checked Out"
              value={loading ? '—' : checkedOut.length}
              sublabel="Departed visitors"
              icon={<LogOut size={20} color={t.colors.action.amber} />}
              tone="neutral"
            />
            <MetricCard
              label="Staff Checked In"
              value={loading ? '—' : attendanceToday}
              sublabel="Attendance log"
              icon={<Building2 size={20} color={t.colors.action.violet} />}
              tone="accent"
              onPress={() => navigation.navigate('EmployeeCheckin')}
            />
          </View>
        </View>

        {/* Visitor Quick Registration */}
        <Card>
          <SectionHeader title="Visitor Fast Check-In" subtitle="Record guest arrival and issue access clearance" />
          <View style={{ gap: t.spacing.md, marginTop: t.spacing.sm }}>
            <Input value={fullName} onChangeText={setFullName} placeholder="Visitor full name *" />
            <Input value={purpose} onChangeText={setPurpose} placeholder="Purpose of visit (e.g. Sales, Interview, Delivery)" />
            <Input value={hostName} onChangeText={setHostName} placeholder="Host / Person to visit *" />
            <Button
              label={submitting ? 'Registering Guest…' : 'Check In Visitor →'}
              onPress={handleCheckIn}
              disabled={submitting}
              loading={submitting}
              fullWidth
            />
          </View>
        </Card>

        {/* Currently On Site */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title={`Currently On Site (${stillIn.length})`} subtitle="Visitors with open check-in badges" />
          {loading ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Loading…</Text>
          ) : stillIn.length === 0 ? (
            <View
              style={[
                {
                  backgroundColor: t.colors.bgCard,
                  borderRadius: 18,
                  padding: t.spacing.lg,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: t.colors.border,
                },
                t.shadow('card'),
              ]}
            >
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
                No visitors currently checked in.
              </Text>
            </View>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {stillIn.map((v) => (
                <View
                  key={v.id}
                  style={[
                    {
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: t.colors.bgCard,
                      borderRadius: 18,
                      padding: t.spacing.md,
                      borderWidth: 1,
                      borderColor: t.colors.border,
                      gap: t.spacing.md,
                    },
                    t.shadow('card'),
                  ]}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: `${t.colors.accent}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.accent }}>
                      {v.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
                      {v.full_name}
                    </Text>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginTop: 2 }}>
                      {v.purpose} · Visiting <Text style={{ fontFamily: t.font.bold }}>{v.host_name}</Text>
                    </Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>
                      Checked in at {fmtTime(v.check_in_time)}
                    </Text>
                  </View>
                  <Button
                    label="Check Out"
                    onPress={() => handleCheckOut(v)}
                    disabled={busyId === v.id}
                    loading={busyId === v.id}
                    size="sm"
                    variant="ghost"
                    icon={<LogOut size={14} color={t.colors.textSecondary} />}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Grouped Action Hub */}
        <ModuleLauncher dept={dept} exclude={['VisitorLog']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
