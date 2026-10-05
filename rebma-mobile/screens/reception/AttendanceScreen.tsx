// rebma-mobile/screens/reception/AttendanceScreen.tsx
// Ports: rebma-web/src/views/reception/AttendanceView.tsx — GPS-gated
// check-in against a hardcoded workplace location + haversine distance,
// late-arrival flagging, mark-absent, delete. Reuses expo-location
// (already installed, Phase 7.0 — see DispatchHomeScreen.tsx for the
// same permission-request pattern), just a single
// getCurrentPositionAsync() call rather than that screen's continuous
// watchPositionAsync() stream.
//
// Direct correction: the "Virtual Check-In (GPS skipped)" toggle is
// cancelled — every check-in is now GPS-verified, no bypass. Clock-in/
// clock-out/late-after times are no longer hardcoded either; they're
// set by HR (screens/hr/AttendanceScreen.tsx's new Attendance Rules
// card, lib/attendanceRules.ts) and read here. A check-in that lands
// after the HR-set late-after time requires a mandatory reason before
// it can be submitted — the GPS step runs first, and only once it
// succeeds does the screen know whether to ask for one.
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
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import * as Location from 'expo-location';
import { MapPin, Search, Check, X as XIcon } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { enqueue, isOfflineError, QUEUE_KEYS } from '../../lib/offlineQueue';
import { getAttendanceRules, isPastTime, DEFAULT_ATTENDANCE_RULES, type AttendanceRules } from '../../lib/attendanceRules';
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
  late_reason?: string | null;
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
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'fail'>('idle');
  const [gpsError, setGpsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_ATTENDANCE_RULES);
  const [pendingLate, setPendingLate] = useState(false);
  const [lateReason, setLateReason] = useState('');

  // Direct instruction: an alternate, optional way to identify who's
  // checking in — type an employee number instead of the name. Looked
  // up on demand (not on every keystroke) against profiles.employee_number;
  // a match auto-fills the name field, exactly as if they'd typed it.
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<'idle' | 'found' | 'not_found'>('idle');

  const lookupByEmployeeNumber = async () => {
    const num = employeeNumber.trim();
    if (!num) return;
    setLookingUp(true);
    setLookupResult('idle');
    const { data } = await supabase.from('profiles').select('full_name').eq('employee_number', num).maybeSingle();
    setLookingUp(false);
    if (data?.full_name) {
      setFullName(data.full_name);
      setLookupResult('found');
    } else {
      setLookupResult('not_found');
    }
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('attendance').select('id, staff_name, check_in_time, status, date, attendance_type, gps_verified, department, late_reason').eq('date', today).order('check_in_time', { ascending: false });
    if (!error && data) setRows(data as any);
    setLoading(false);
    setRefreshing(false);
  }, [today]);

  useEffect(() => {
    load();
    getAttendanceRules().then(setRules);
  }, [load]);

  const resetCheckInForm = () => {
    setFullName('');
    setGpsStatus('idle');
    setGpsError('');
    setPendingLate(false);
    setLateReason('');
    setEmployeeNumber('');
    setLookupResult('idle');
    setShowCheckIn(false);
  };

  const doCheckIn = async (isLate: boolean, reason?: string) => {
    if (submitting) return;
    setSubmitting(true);
    const now = new Date();
    const payload = {
      staff_name: fullName.trim(),
      check_in_time: now.toISOString(),
      status: isLate ? 'LATE' : 'PRESENT',
      date: today,
      attendance_type: 'Physical',
      gps_verified: true,
      department,
      late_reason: isLate ? (reason || '').trim() : null,
      employee_number: employeeNumber.trim() || null,
    };
    const { error } = await supabase.from('attendance').insert(payload);
    setSubmitting(false);
    if (error && isOfflineError(error)) {
      await enqueue(QUEUE_KEYS.receptionAttendance, 'attendance', payload);
      Alert.alert('Saved Offline', 'No connection right now, so this check-in will sync automatically once you\'re back online.');
    } else if (error) {
      Alert.alert('Not checked in', error.message);
      return;
    }
    resetCheckInForm();
    load();
  };

  // Runs the real GPS check first — only once it succeeds do we know
  // the check-in's actual time, so lateness (and whether a reason is
  // required) can only be decided after this, not before.
  const runGpsCheck = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Info', 'Enter the staff member\'s name.');
      return;
    }
    setGpsStatus('locating');
    setGpsError('');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGpsStatus('fail');
      setGpsError('Location permission denied. Enable location access in your device settings to check in.');
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, WORKPLACE.lat, WORKPLACE.lng);
      if (dist <= WORKPLACE.radiusMeters) {
        setGpsStatus('ok');
        const isLate = isPastTime(new Date(), rules.lateAfterTime);
        if (isLate) {
          setPendingLate(true);
        } else {
          doCheckIn(false);
        }
      } else {
        setGpsStatus('fail');
        setGpsError(`You are ${Math.round(dist)}m from the office (max ${WORKPLACE.radiusMeters}m). Check in from the office.`);
      }
    } catch (e: any) {
      setGpsStatus('fail');
      setGpsError(`GPS error: ${e.message || 'unknown'}.`);
    }
  };

  const submitLateCheckIn = () => {
    if (!lateReason.trim()) {
      Alert.alert('Reason Required', 'Since you\'re checking in after the expected time, please give a short reason.');
      return;
    }
    doCheckIn(true, lateReason);
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
        collapsible
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
        onClose={resetCheckInForm}
        title="Staff Check-In"
        subtitle={`${WORKPLACE.name} · GPS radius ${WORKPLACE.radiusMeters}m`}
        side="bottom"
        footer={
          pendingLate ? (
            <Button label={submitting ? 'Submitting…' : 'Submit Check-In'} onPress={submitLateCheckIn} loading={submitting} disabled={submitting || !lateReason.trim()} fullWidth />
          ) : (
            <Button label={submitting || gpsStatus === 'locating' ? 'Checking In…' : 'Check In'} onPress={runGpsCheck} loading={submitting || gpsStatus === 'locating'} disabled={submitting || gpsStatus === 'locating'} fullWidth />
          )
        }
      >
        <Field label="Employee Number" hint="Optional, auto-fills the name below if it matches">
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input
                value={employeeNumber}
                onChangeText={(v) => { setEmployeeNumber(v); setLookupResult('idle'); }}
                placeholder="EMP-00001"
                autoCapitalize="characters"
                editable={!pendingLate}
              />
            </View>
            <Button label={lookingUp ? '…' : 'Look Up'} size="sm" variant="ghost" icon={<Search size={13} color={t.colors.textSecondary} />} onPress={lookupByEmployeeNumber} disabled={!employeeNumber.trim() || lookingUp || pendingLate} />
          </View>
          {lookupResult === 'found' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Check size={13} color={t.colors.status.success.text} />
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status.success.text }}>Name filled in below</Text>
            </View>
          ) : lookupResult === 'not_found' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <XIcon size={13} color={t.colors.status.danger.text} />
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status.danger.text }}>No match, type the name directly</Text>
            </View>
          ) : null}
        </Field>
        <Field label="Staff Name *"><Input value={fullName} onChangeText={setFullName} placeholder="Full name" editable={!pendingLate} /></Field>
        <Field label="Department"><Input value={department} onChangeText={setDepartment} placeholder="Department" editable={!pendingLate} /></Field>

        {pendingLate ? (
          <View style={{ backgroundColor: t.colors.status.warning.bg, borderRadius: t.radius.md, padding: t.spacing.md, marginTop: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.status.warning.text, marginBottom: t.spacing.xs }}>
              Location verified, but it's after {rules.lateAfterTime}
            </Text>
            <Field label="Reason for Lateness *">
              <Input value={lateReason} onChangeText={setLateReason} placeholder="e.g. Traffic on the highway" multiline numberOfLines={3} style={{ minHeight: 70, textAlignVertical: 'top' }} />
            </Field>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginTop: t.spacing.md }}>
            <MapPin size={13} color={t.colors.textMuted} />
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, flex: 1 }}>
              GPS will verify your location against {WORKPLACE.name} ({WORKPLACE.radiusMeters}m radius). Checking in after {rules.lateAfterTime} will ask for a reason.
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
