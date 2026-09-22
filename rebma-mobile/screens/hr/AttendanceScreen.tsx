// rebma-mobile/screens/hr/AttendanceScreen.tsx
// Ports: rebma-web/src/views/hr/AttendanceView.tsx (494 lines, read in
// full) — D57. HR's company-wide oversight/edit tool, distinct from
// Reception's own personal GPS check-in screen (Phase 7.2) — two
// different real capabilities, no shared component.
//
// Direct correction: rebuilt around a real calendar — "the very day
// they start attendance, it should be like a calendar that they can see
// every day... sorted, filtered, and search as well." The old version
// was one flat, all-time paginated list; this is now day-first: a month
// grid up top (tap a day to jump to it, a small dot under any day that
// has records, colored by whether anyone was late/absent that day),
// and the table below shows just the selected day, with search, a
// status filter, and a sort control. Edit/duplicate/manual-add/delete
// are the same real, ported writes as before, just operating on the
// selected day's list instead of an all-time paginated one. Web's
// "Share" action (navigator.clipboard, web-only) and its non-functional
// "Workplace Settings" modal are both still not ported, same as before.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { Copy, Trash2, Clock, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { getAttendanceRules, setAttendanceRules, DEFAULT_ATTENDANCE_RULES, type AttendanceRules } from '../../lib/attendanceRules';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import SectionHeader from '../../components/ui/SectionHeader';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';
import SearchSortBar from '../../components/ui/SearchSortBar';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';

type AttStatus = 'PRESENT' | 'LATE' | 'ABSENT';

interface AttendanceRow {
  id: string; fullName: string; checkInTime: string; checkInSortKey: string; status: AttStatus; date: string; lateReason: string | null;
}
function mapRow(a: any): AttendanceRow {
  return {
    id: a.id, fullName: a.user?.full_name || a.staff_name || 'Unknown',
    checkInTime: a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    checkInSortKey: a.check_in_time || '',
    status: a.status, date: a.date || (a.check_in_time ? a.check_in_time.slice(0, 10) : ''),
    lateReason: a.late_reason || null,
  };
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const toKey = (d: Date) => d.toISOString().slice(0, 10);

// A day's "worst" status decides its calendar dot color — matches the
// same danger > warning > success severity order Badge tones already use
// elsewhere in this app.
function dayDotTone(statuses: AttStatus[]): 'danger' | 'warning' | 'success' | null {
  if (!statuses.length) return null;
  if (statuses.includes('ABSENT')) return 'danger';
  if (statuses.includes('LATE')) return 'warning';
  return 'success';
}

function MonthCalendar({
  month, selectedDate, onSelectDate, onChangeMonth, daySummary,
}: {
  month: Date;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  onChangeMonth: (delta: number) => void;
  daySummary: Record<string, AttStatus[]>;
}) {
  const t = useTheme();
  const today = toKey(new Date());

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstOfMonth = new Date(year, m, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const out: { key: string; day: number | null }[] = [];
    for (let i = 0; i < startOffset; i++) out.push({ key: `pad-${i}`, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ key: toKey(new Date(year, m, d)), day: d });
    }
    return out;
  }, [month]);

  const dotColor = (tone: 'danger' | 'warning' | 'success') =>
    tone === 'danger' ? t.colors.status.danger.text : tone === 'warning' ? t.colors.status.warning.text : t.colors.status.success.text;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.md }}>
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={8} style={{ padding: 6 }}>
          <ChevronLeft size={18} color={t.colors.textSecondary} />
        </Pressable>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>
          {month.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={8} style={{ padding: 6 }}>
          <ChevronRight size={18} color={t.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <View key={`wd-${i}`} style={{ flex: 1, alignItems: 'center', paddingBottom: 4 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.label9.size, color: t.colors.textMuted }}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((c) => {
          if (c.day == null) return <View key={c.key} style={{ width: `${100 / 7}%`, height: 40 }} />;
          const isSelected = c.key === selectedDate;
          const isToday = c.key === today;
          const tone = dayDotTone(daySummary[c.key] || []);
          return (
            <Pressable
              key={c.key}
              onPress={() => onSelectDate(c.key)}
              style={{ width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? t.colors.accent : 'transparent',
                  borderWidth: isToday && !isSelected ? 1.5 : 0,
                  borderColor: t.colors.accent,
                }}
              >
                <Text style={{ fontFamily: isSelected ? t.font.bold : t.font.medium, fontSize: t.type.body12.size, color: isSelected ? t.colors.onAccent : t.colors.textPrimary }}>
                  {c.day}
                </Text>
              </View>
              {tone ? (
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: dotColor(tone), marginTop: 2 }} />
              ) : (
                <View style={{ width: 5, height: 5, marginTop: 2 }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function AttendanceScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);

  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState(() => toKey(new Date()));
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);
  const [daySummary, setDaySummary] = useState<Record<string, AttStatus[]>>({});
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'time' | 'name'>('time');

  const [selected, setSelected] = useState<AttendanceRow | null>(null);
  const [editStatus, setEditStatus] = useState<AttStatus>('PRESENT');
  const [editTime, setEditTime] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', checkInTime: '', status: 'PRESENT' as AttStatus });
  const [submitting, setSubmitting] = useState(false);

  // Direct instruction: clock-in/clock-out/late times are set by HR, not
  // CEO — a small self-contained rules card right on HR's own attendance
  // screen (lib/attendanceRules.ts), read by Reception's check-in screen
  // to decide lateness and whether to demand a reason.
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_ATTENDANCE_RULES);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    getAttendanceRules().then(setRules);
  }, []);

  const saveRules = async () => {
    setSavingRules(true);
    const { error } = await setAttendanceRules(rules, profile?.fullName || 'HR');
    setSavingRules(false);
    if (error) {
      Alert.alert('Save Failed', error);
      return;
    }
    Alert.alert('Saved', 'Attendance times updated — the check-in screen will use these from now on.');
  };

  const loadMonthSummary = useCallback(async (month: Date) => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const start = toKey(new Date(year, m, 1));
    const end = toKey(new Date(year, m + 1, 0));
    const { data } = await supabase.from('attendance').select('date, status').gte('date', start).lte('date', end);
    const summary: Record<string, AttStatus[]> = {};
    for (const row of data || []) {
      const key = row.date;
      if (!summary[key]) summary[key] = [];
      summary[key].push(row.status);
    }
    setDaySummary(summary);
  }, []);

  const loadDay = useCallback(async (date: string) => {
    setLoading(true);
    setRecordsError(null);
    const { data, error } = await supabase
      .from('attendance')
      .select('id, staff_name, check_in_time, status, date, late_reason, user:profiles(full_name)')
      .eq('date', date)
      .order('check_in_time', { ascending: true });
    if (error) {
      setRecordsError(error.message);
      setRecords([]);
    } else {
      setRecords((data || []).map(mapRow));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadMonthSummary(calendarMonth);
  }, [calendarMonth, loadMonthSummary]);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  const refreshBoth = () => {
    setRefreshing(true);
    loadDay(selectedDate);
    loadMonthSummary(calendarMonth);
  };

  const changeMonth = (delta: number) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = records.filter((r) => {
      const matchSearch = !q || r.fullName.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
    return [...list].sort((a, b) =>
      sortBy === 'name' ? a.fullName.localeCompare(b.fullName) : a.checkInSortKey.localeCompare(b.checkInSortKey)
    );
  }, [records, search, statusFilter, sortBy]);

  const bumpDaySummary = (date: string, status: AttStatus) => {
    setDaySummary((prev) => ({ ...prev, [date]: [...(prev[date] || []), status] }));
  };

  const openEdit = (r: AttendanceRow) => { setSelected(r); setEditStatus(r.status); setEditTime(r.checkInTime); setShowEdit(true); };

  const saveEdit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const recordDate = new Date(`${selectedDate}T00:00:00`);
      const [hours, minutes] = editTime.split(':');
      if (hours && minutes) recordDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const { error } = await supabase.from('attendance').update({ status: editStatus, check_in_time: recordDate.toISOString() }).eq('id', selected.id);
      if (error) throw error;
      setRecords((prev) => prev.map((r) => (r.id === selected.id ? { ...r, status: editStatus, checkInTime: editTime, checkInSortKey: recordDate.toISOString() } : r)));
      setShowEdit(false);
      setSelected(null);
      loadMonthSummary(calendarMonth);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const duplicate = async (r: AttendanceRow) => {
    try {
      const { data: prof } = await supabase.from('profiles').select('id').ilike('full_name', r.fullName).limit(1);
      const userId = prof?.[0]?.id ?? null;
      const now = new Date(`${selectedDate}T00:00:00`);
      const nowISO = now.toISOString();
      const { data: inserted, error } = await supabase.from('attendance').insert([{ user_id: userId, staff_name: r.fullName, status: r.status, check_in_time: nowISO, date: selectedDate }]).select().single();
      if (error) throw error;
      setRecords((prev) => [{ ...r, id: inserted.id, checkInTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), checkInSortKey: nowISO, date: selectedDate }, ...prev]);
      bumpDaySummary(selectedDate, r.status);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to duplicate log.');
    }
  };

  const handleDelete = (r: AttendanceRow) => {
    Alert.alert('Delete Log', 'Are you sure you want to delete this log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('attendance').delete().eq('id', r.id);
        if (error) { Alert.alert('Error', error.message); return; }
        setRecords((prev) => prev.filter((x) => x.id !== r.id));
        loadMonthSummary(calendarMonth);
      } },
    ]);
  };

  const saveAdd = async () => {
    if (!addForm.fullName) return;
    setSubmitting(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('id').ilike('full_name', addForm.fullName).limit(1);
      const userId = prof?.[0]?.id ?? null;
      const checkInDate = new Date(`${selectedDate}T00:00:00`);
      if (addForm.checkInTime) {
        const [hours, minutes] = addForm.checkInTime.split(':');
        checkInDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      }
      const nowISO = checkInDate.toISOString();
      const { data: inserted, error } = await supabase.from('attendance').insert([{ user_id: userId, staff_name: addForm.fullName, status: addForm.status, check_in_time: nowISO, date: selectedDate }]).select().single();
      if (error) throw error;
      setRecords((prev) => [{ id: inserted.id, fullName: addForm.fullName, checkInTime: addForm.checkInTime || checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), checkInSortKey: nowISO, status: addForm.status, date: selectedDate, lateReason: null }, ...prev]);
      bumpDaySummary(selectedDate, addForm.status);
      setShowAdd(false);
      setAddForm({ fullName: '', checkInTime: '', status: 'PRESENT' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add attendance log.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusTone = (s: AttStatus) => (s === 'PRESENT' ? 'success' : s === 'LATE' ? 'warning' : 'danger');

  const columns: DataColumn<AttendanceRow>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={statusTone(r.status)} label={r.status} size="xs" /> },
    { key: 'checkInTime', label: 'Check In' },
    { key: 'lateReason', label: 'Late Reason', render: (r) => r.lateReason || '—' },
  ];

  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const dayCounts = { present: records.filter((r) => r.status === 'PRESENT').length, late: records.filter((r) => r.status === 'LATE').length, absent: records.filter((r) => r.status === 'ABSENT').length };

  return (
    <Screen refreshing={refreshing} onRefresh={refreshBoth}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Log" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        {/* Direct correction: previously two separate Cards (Rules, then a
            second card for the day's controls) with the calendar buried
            inside the Rules card — now one connected section: all 3 times
            in a single row, then the calendar + search + sort + filter
            in their own single row right below it, then the table follows
            immediately with nothing separating them. */}
        <Card>
          <SectionHeader title="Attendance" subtitle={`Set by HR to flag lateness · ${selectedDateLabel} — ${dayCounts.present} present · ${dayCounts.late} late · ${dayCounts.absent} absent`} />

          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Clock In"><Input value={rules.clockInTime} onChangeText={(v) => setRules((r) => ({ ...r, clockInTime: v }))} placeholder="08:00" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Clock Out"><Input value={rules.clockOutTime} onChangeText={(v) => setRules((r) => ({ ...r, clockOutTime: v }))} placeholder="17:00" /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Late After"><Input value={rules.lateAfterTime} onChangeText={(v) => setRules((r) => ({ ...r, lateAfterTime: v }))} placeholder="09:00" /></Field>
            </View>
          </View>
          <Button label={savingRules ? 'Saving…' : 'Save Times'} icon={<Clock size={14} color={t.colors.onAccent} />} onPress={saveRules} loading={savingRules} disabled={savingRules} fullWidth />

          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center', marginTop: t.spacing.lg }}>
            <Pressable
              onPress={() => setShowCalendarSheet(true)}
              style={{
                width: 52, height: 52,
                borderRadius: t.radius.md, backgroundColor: t.colors.accentSoft,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CalendarDays size={20} color={t.colors.accent} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <SearchSortBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name..."
                sortOptions={[{ value: 'time', label: 'Time' }, { value: 'name', label: 'Name' }]}
                sortValue={sortBy}
                onSortChange={(v) => setSortBy(v as 'time' | 'name')}
                filterOptions={['All', 'PRESENT', 'LATE', 'ABSENT'].map((s) => ({ value: s, label: s }))}
                filterValue={statusFilter}
                onFilterChange={setStatusFilter}
                filterLabel="Status"
              />
            </View>
          </View>
        </Card>

        <DataList
          collapsible
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          emptyTitle={recordsError ? 'Couldn’t load records' : 'No attendance logged this day'}
          emptyDescription={recordsError || undefined}
          onRowPress={openEdit}
          renderActions={(r) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Duplicate" size="sm" variant="ghost" icon={<Copy size={12} color={t.colors.textSecondary} />} onPress={() => duplicate(r)} />
              <Button label="Delete" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => handleDelete(r)} />
            </View>
          )}
        />
      </View>

      <Sheet open={showEdit} onClose={() => setShowEdit(false)} title="Edit Attendance" subtitle={selected?.fullName} side="bottom" maxHeight={360}
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={saveEdit} loading={submitting} disabled={submitting} fullWidth />}>
        <Field label="Status"><SearchablePicker value={editStatus} onChange={(v) => setEditStatus(v as AttStatus)} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }, { value: 'ABSENT', label: 'Absent' }]} /></Field>
        <Field label="Check-In Time"><Input value={editTime} onChangeText={setEditTime} placeholder="HH:MM" /></Field>
      </Sheet>

      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Add Attendance Log" subtitle={selectedDateLabel} side="bottom" maxHeight={420}
        footer={<Button label={submitting ? 'Saving…' : 'Add'} onPress={saveAdd} loading={submitting} disabled={submitting || !addForm.fullName} fullWidth />}>
        <Field label="Full Name"><Input value={addForm.fullName} onChangeText={(v) => setAddForm((f) => ({ ...f, fullName: v }))} /></Field>
        <Field label="Check-In Time" hint="Optional, defaults to now"><Input value={addForm.checkInTime} onChangeText={(v) => setAddForm((f) => ({ ...f, checkInTime: v }))} placeholder="HH:MM" /></Field>
        <Field label="Status"><SearchablePicker value={addForm.status} onChange={(v) => setAddForm((f) => ({ ...f, status: v as AttStatus }))} options={[{ value: 'PRESENT', label: 'Present' }, { value: 'LATE', label: 'Late' }, { value: 'ABSENT', label: 'Absent' }]} /></Field>
      </Sheet>

      <Sheet open={showCalendarSheet} onClose={() => setShowCalendarSheet(false)} title="Pick a Day" subtitle="Sorts and filters the table below to that day" side="bottom" maxHeight={560}>
        <MonthCalendar
          month={calendarMonth}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setShowCalendarSheet(false); }}
          onChangeMonth={changeMonth}
          daySummary={daySummary}
        />
      </Sheet>
    </Screen>
  );
}
