// rebma-mobile/screens/reception/DailyReportsScreen.tsx
// Ports: rebma-web/src/views/reception/DailyReportsView.tsx — real
// client-side aggregation for a selected date (visitor list, per-department
// attendance-vs-headcount progress bars with the same hardcoded fallback
// department list web uses when `departments` is empty, past-7-days
// summary table). Web's "Email Report" button is fully mocked
// (setTimeout, no real send, verified by reading the source) — not
// ported, since there's no real capability behind it to port.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import DataList, { type DataColumn } from '../../components/ui/DataList';

interface DeptRow {
  name: string;
  present: number;
  total: number;
}

interface PastReportRow {
  date: string;
  visitors: number;
  attendanceRate: number;
  checkins: number;
}

const FALLBACK_DEPTS = ['Management', 'Finance', 'Marketing', 'Operations', 'HR', 'Dispatch', 'Production', 'Reception'];

export default function DailyReportsScreen() {
  const t = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [visitorsToday, setVisitorsToday] = useState<{ id: string; name: string; company: string; purpose: string; host: string; in: string; out: string | null }[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [pastReports, setPastReports] = useState<PastReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: visData } = await supabase
      .from('visitors')
      .select('*')
      .gte('check_in_time', `${selectedDate}T00:00:00Z`)
      .lte('check_in_time', `${selectedDate}T23:59:59Z`);

    setVisitorsToday((visData || []).map((v: any) => ({
      id: v.id,
      name: v.full_name || '—',
      company: v.company || '—',
      purpose: v.purpose || '—',
      host: v.host_name || '—',
      in: v.check_in_time ? new Date(v.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—',
      out: v.check_out_time ? new Date(v.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null,
    })));

    const { data: deptData } = await supabase.from('departments').select('name, headcount');
    const { data: attData } = await supabase.from('attendance').select('department, check_in_time').eq('date', selectedDate);

    const deptMap: Record<string, DeptRow> = {};
    for (const d of deptData || []) deptMap[d.name] = { name: d.name, present: 0, total: d.headcount || 0 };
    for (const d of FALLBACK_DEPTS) {
      if (!deptMap[d]) deptMap[d] = { name: d, present: 0, total: d === 'Dispatch' ? 12 : d === 'Production' ? 11 : 5 };
    }
    for (const a of attData || []) {
      const name = a.department;
      if (deptMap[name]) deptMap[name].present += 1;
      else deptMap[name] = { name, present: 1, total: 1 };
    }
    setDepts(Object.values(deptMap));

    const past7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i - 1);
      past7Days.push(d.toISOString().slice(0, 10));
    }
    const { data: visPast } = await supabase.from('visitors').select('check_in_time').gte('check_in_time', `${past7Days[6]}T00:00:00Z`);
    const { data: attPast } = await supabase.from('attendance').select('date').in('date', past7Days);
    const totalStaffForRate = Object.values(deptMap).reduce((s, d) => s + d.total, 0) || 1;

    setPastReports(past7Days.map((date) => {
      const visCount = (visPast || []).filter((v: any) => v.check_in_time && v.check_in_time.startsWith(date)).length;
      const attCount = (attPast || []).filter((a: any) => a.date === date).length;
      return { date, visitors: visCount, attendanceRate: Math.min(100, Math.round((attCount / totalStaffForRate) * 100)), checkins: attCount };
    }));

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  const visitorColumns: DataColumn<typeof visitorsToday[number]>[] = [
    { key: 'name', label: 'Visitor', primary: true },
    { key: 'company', label: 'Company' },
    { key: 'host', label: 'Host' },
    { key: 'in', label: 'In', render: (r) => r.in },
    { key: 'out', label: 'Out', render: (r) => r.out || '—' },
  ];

  const pastColumns: DataColumn<PastReportRow>[] = [
    { key: 'date', label: 'Date', primary: true },
    { key: 'attendanceRate', label: 'Rate', status: true, render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.attendanceRate}%</Text> },
    { key: 'visitors', label: 'Visitors' },
    { key: 'checkins', label: 'Check-ins' },
  ];

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <Input value={selectedDate} onChangeText={setSelectedDate} placeholder="YYYY-MM-DD" />

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Visitors — {selectedDate}</Text>
          <DataList columns={visitorColumns} data={visitorsToday} rowKey={(v) => v.id} loading={loading} emptyTitle="No visitors on this date" />
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Department Attendance</Text>
          <View style={{ gap: t.spacing.md }}>
            {depts.map((d) => {
              const pct = d.total > 0 ? Math.min(1, d.present / d.total) : 0;
              return (
                <View key={d.name} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{d.name}</Text>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{d.present}/{d.total}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.bgPage, overflow: 'hidden' }}>
                    <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: t.colors.accent }} />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Past 7 Days</Text>
          <DataList columns={pastColumns} data={pastReports} rowKey={(r) => r.date} loading={loading} emptyTitle="No data" />
        </Card>
      </View>
    </Screen>
  );
}
