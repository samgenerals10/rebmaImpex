// rebma-mobile/screens/reception/AttendanceScreen.tsx
// Ports: rebma-web/src/views/reception/AttendanceView.tsx — GPS-gated
// check-in against a hardcoded workplace location + haversine distance,
// a Physical/Virtual toggle, late-arrival flagging, mark-absent, delete.
// Reuses expo-location (already installed, Phase 7.0 — see
// DispatchHomeScreen.tsx for the same permission-request pattern), just a
// single getCurrentPositionAsync() call rather than that screen's
// continuous watchPositionAsync() stream.
//
// Writes directly to `attendance.staff_name` (not a `user_id` FK) — this
// is web's own AttendanceView.tsx behavior, confirmed by reading it
// (HR's separate apiClient.ts checkInAttendance() writes user_id instead;
// two different write shapes into the same table already exist on web
// today, not something introduced here).
//
// Phase 7.12, D123: a gate-location check-in is a real candidate for poor
// connectivity, so a failed insert is queued via lib/offlineQueue.ts
// instead of shown as a plain error — the user sees "Saved — will sync
// when back online" and the row lands for real on the next auto-flush
// (App.tsx's NetInfo listener) or a manual "Sync Now" tap
// (ConnectivityBanner).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Wifi } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { enqueue, QUEUE_KEYS } from '../../lib/offlineQueue';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';

const WORKPLACE = { lat: 5.6037, lng: -0.187, radiusMeters: 100, name: 'REBMA IMPEX HQ' };

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface AttendanceRow {
  id: string;
  staff_name: string;
  check_in_time: string;
  status: string;
  date: string;
  attendance_type: string;
  gps_verified: boolean;
  department: string;
}

export default function AttendanceScreen() {
  const t = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('Reception');
  const [virtual, setVirtual] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'fail'>('idle');
  const [gpsError, setGpsError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('attendance').select('id, staff_name, check_in_time, status, date, attendance_type, gps_verified, department').eq('date', today).order('check_in_time', { ascending: false });
    if (!error && data) setRows(data as any);
    setLoading(false);
    setRefreshing(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const doCheckIn = async (type: string, gpsVerified: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    const now = new Date();
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 0);
    const payload = {
      staff_name: fullName.trim(),
      check_in_time: now.toISOString(),
      status: isLate ? 'LATE' : 'PRESENT',
      date: today,
      attendance_type: type,
      gps_verified: gpsVerified,
      department,
    };
    const { error } = await supabase.from('attendance').insert(payload);
    setSubmitting(false);
    if (error) {
      await enqueue(QUEUE_KEYS.receptionAttendance, 'attendance', payload);
      Alert.alert('Saved Offline', 'No connection right now, so this check-in will sync automatically once you\'re back online.');
    }
    setFullName('');
    setVirtual(false);
    setGpsStatus('idle');
    setGpsError('');
    setShowCheckIn(false);
    load();
  };

  const handleCheckIn = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Info', 'Enter the staff member\'s name.');
      return;
    }
    if (virtual) {
      doCheckIn('Virtual', false);
      return;
    }
    setGpsStatus('locating');
    setGpsError('');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGpsStatus('fail');
      setGpsError('Location permission denied. Enable virtual mode to proceed.');
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, WORKPLACE.lat, WORKPLACE.lng);
      if (dist <= WORKPLACE.radiusMeters) {
        setGpsStatus('ok');
        doCheckIn('Physical', true);
      } else {
        setGpsStatus('fail');
        setGpsError(`You are ${Math.round(dist)}m from the office (max ${WORKPLACE.radiusMeters}m). Enable virtual mode or check in from the office.`);
      }
    } catch (e: any) {
      setGpsStatus('fail');
      setGpsError(`GPS error: ${e.message || 'unknown'}. Enable virtual mode to proceed.`);
    }
  };

  const markAbsent = async (r: AttendanceRow) => {
    const { error } = await supabase.from('attendance').update({ status: 'ABSENT' }).eq('id', r.id);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    load();
  };

  const remove = (r: AttendanceRow) => {
    Alert.alert('Delete Record', `Remove ${r.staff_name}'s attendance record?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('attendance').delete().eq('id', r.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<AttendanceRow>[] = [
    { key: 'staff_name', label: 'Staff', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={r.status === 'LATE' ? 'warning' : r.status === 'ABSENT' ? 'danger' : 'success'} label={r.status} /> },
    { key: 'department', label: 'Department' },
    { key: 'attendance_type', label: 'Type', render: (r) => `${r.attendance_type}${r.gps_verified ? ' · GPS' : ''}` },
    { key: 'check_in_time', label: 'Check-In', render: (r) => new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Check In Staff" onPress={() => setShowCheckIn(true)} fullWidth /></View>}
    >
      <DataList
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="No attendance logged today"
        renderActions={(r) => (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {r.status !== 'ABSENT' && <Button label="Mark Absent" size="sm" variant="ghost" onPress={() => markAbsent(r)} />}
            <Button label="Delete" size="sm" variant="danger" onPress={() => remove(r)} />
          </View>
        )}
      />

      <Sheet
        open={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        title="Staff Check-In"
        subtitle={`${WORKPLACE.name} · GPS radius ${WORKPLACE.radiusMeters}m`}
        side="bottom"
        footer={<Button label={submitting || gpsStatus === 'locating' ? 'Checking In…' : 'Check In'} onPress={handleCheckIn} loading={submitting || gpsStatus === 'locating'} disabled={submitting || gpsStatus === 'locating'} fullWidth />}
      >
        <Field label="Staff Name *"><Input value={fullName} onChangeText={setFullName} placeholder="Full name" /></Field>
        <Field label="Department"><Input value={department} onChangeText={setDepartment} placeholder="Department" /></Field>
        <Button
          variant={virtual ? 'primary' : 'ghost'}
          icon={<Wifi size={13} color={virtual ? t.colors.onAccent : t.colors.textSecondary} />}
          label={virtual ? 'Virtual Check-In (GPS skipped)' : 'Enable Virtual Check-In'}
          onPress={() => setVirtual((v) => !v)}
          fullWidth
        />
        {!virtual && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.md }}>
            <MapPin size={13} color={t.colors.textMuted} />
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, flex: 1 }}>
              GPS will verify your location against {WORKPLACE.name} ({WORKPLACE.radiusMeters}m radius)
            </Text>
          </View>
        )}
        {gpsError ? (
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.status.danger.text, marginTop: t.spacing.sm }}>{gpsError}</Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}
