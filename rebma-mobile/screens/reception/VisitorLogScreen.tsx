// rebma-mobile/screens/reception/VisitorLogScreen.tsx
//
// Renamed+extended from screens/reception/ReceptionHomeScreen.tsx (Phase
// 7.2, D18) — load()/handleCheckIn()/handleCheckOut() are byte-identical
// to that file; only the JSX gained a KPI tile strip + a ModuleLauncher
// (Phase 7.1's D13 pattern every department's home screen follows).
//
// Ports rebma-web/src/views/reception/OverviewView.tsx: its KPI tiles and
// "currently inside" list are real (kept); its sparkline/traffic-area/
// purpose-pie/peak-hours charts are seeded from hardcoded mock arrays in
// the component, not live queries (verified by reading the file) — not
// ported, per D16, since there is no real data behind them to port.
//
// Phase 7.12, D123: the gate/entrance check-in is a real candidate for
// poor connectivity, so a failed insert is queued via lib/offlineQueue.ts
// instead of shown as a plain error — see AttendanceScreen.tsx for the
// same pattern applied to its own check-in form.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { UserCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { enqueue, QUEUE_KEYS } from '../../lib/offlineQueue';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import MetricCard from '../../components/ui/MetricCard';
import ModuleLauncher from '../../components/chrome/ModuleLauncher';

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
      Alert.alert('Saved Offline', 'No connection right now, so this visitor will sync automatically once you\'re back online.');
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

  const stillIn = visitors.filter(v => !v.check_out_time);
  const checkedOut = visitors.filter(v => v.check_out_time);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Visitors Today" value={loading ? '—' : visitors.length} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Currently Inside" value={loading ? '—' : stillIn.length} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Checked Out" value={loading ? '—' : checkedOut.length} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Attendance Today" value={loading ? '—' : attendanceToday} tone="accent" onPress={() => navigation.navigate('EmployeeCheckin')} /></View>
        </View>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Visitor Check-In</Text>
          <View style={{ gap: t.spacing.md }}>
            <Input value={fullName} onChangeText={setFullName} placeholder="Visitor full name" />
            <Input value={purpose} onChangeText={setPurpose} placeholder="Purpose of visit" />
            <Input value={hostName} onChangeText={setHostName} placeholder="Who are they visiting?" />
            <Button label={submitting ? 'Checking In…' : 'Register Visitor'} onPress={handleCheckIn} disabled={submitting} loading={submitting} fullWidth />
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Currently On Site ({stillIn.length})</Text>
          {loading ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Loading…</Text>
          ) : stillIn.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>No visitors currently checked in.</Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              {stillIn.map(v => (
                <View key={v.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.colors.bgPage, borderRadius: t.radius.md, padding: t.spacing.md, borderWidth: 1, borderColor: t.colors.border }}>
                  <View style={{ flex: 1, paddingRight: t.spacing.sm }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{v.full_name}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>{v.purpose} · Visiting {v.host_name}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>In at {fmtTime(v.check_in_time)}</Text>
                  </View>
                  <Button
                    label="Check Out"
                    onPress={() => handleCheckOut(v)}
                    disabled={busyId === v.id}
                    loading={busyId === v.id}
                    size="sm"
                    icon={<UserCheck size={13} color="#fff" />}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>

        {checkedOut.length > 0 && (
          <Card>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Checked Out Today ({checkedOut.length})</Text>
            <View>
              {checkedOut.map(v => (
                <View key={v.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>{v.full_name}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{fmtTime(v.check_in_time)} – {fmtTime(v.check_out_time!)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <ModuleLauncher dept={dept} exclude={['VisitorLog']} onSelect={(id) => navigation.navigate(id)} />
      </View>
    </Screen>
  );
}
