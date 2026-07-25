import { useState, useEffect, useMemo } from 'react';
import {
  Users, UserCheck, Clock, BarChart2, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';

type Period = '7D' | '30D' | '90D' | '12M';
const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '30D': 30, '90D': 90, '12M': 365 };

const PURPOSE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#64748b', '#ef4444'];

const PEAK_HOURS = ['8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];

interface Props { addNotification: (msg: string) => void }

interface VisitorRow {
  full_name: string;
  purpose: string;
  host_name: string;
  check_in_time: string;
  check_out_time: string | null;
}

interface AttendanceRow {
  department: string;
  check_in_time: string;
  status: string;
}

export default function AnalyticsView({ addNotification }: Props) {
  const [period, setPeriod] = useState<Period>('7D');
  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = new Date(Date.now() - PERIOD_DAYS['12M'] * 24 * 60 * 60 * 1000).toISOString();
      const [{ data: v }, { data: a }] = await Promise.all([
        supabase.from('visitors').select('full_name, purpose, host_name, check_in_time, check_out_time').gte('check_in_time', since).then(r => r, () => ({ data: [] })),
        supabase.from('attendance').select('department, check_in_time, status').gte('check_in_time', since).then(r => r, () => ({ data: [] })),
      ]);
      setVisitors((v || []) as VisitorRow[]);
      setAttendance((a || []) as AttendanceRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const since = useMemo(() => new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000), [period]);
  const visitorsInPeriod = useMemo(() => visitors.filter(v => new Date(v.check_in_time) >= since), [visitors, since]);

  const trendData = useMemo(() => {
    const isMonth = period === '12M';
    const n = period === '7D' ? 7 : period === '30D' ? 30 : period === '90D' ? 12 : 12;
    const buckets = Array.from({ length: n }, (_, i) => {
      const d = new Date();
      if (isMonth) d.setMonth(d.getMonth() - (n - 1 - i)); else d.setDate(d.getDate() - (n - 1 - i));
      return {
        label: isMonth ? d.toLocaleDateString('en-GB', { month: 'short' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        visitors: 0,
        _key: isMonth ? `${d.getFullYear()}-${d.getMonth()}` : d.toDateString(),
      };
    });
    for (const v of visitorsInPeriod) {
      const d = new Date(v.check_in_time);
      const key = isMonth ? `${d.getFullYear()}-${d.getMonth()}` : d.toDateString();
      const b = buckets.find(x => x._key === key);
      if (b) b.visitors += 1;
    }
    return buckets.map(({ _key, ...rest }) => rest);
  }, [visitorsInPeriod, period]);

  const totalVisitors = visitorsInPeriod.length;
  const avgDaily = trendData.length > 0 ? Math.round(totalVisitors / trendData.length) : 0;

  const purposeData = useMemo(() => {
    const byPurpose: Record<string, number> = {};
    for (const v of visitorsInPeriod) { const p = v.purpose || 'Other'; byPurpose[p] = (byPurpose[p] || 0) + 1; }
    return Object.entries(byPurpose).map(([name, value], i) => ({ name, value, color: PURPOSE_COLORS[i % PURPOSE_COLORS.length] }));
  }, [visitorsInPeriod]);

  const deptAttendance = useMemo(() => {
    const byDept: Record<string, number> = {};
    for (const a of attendance) {
      if (new Date(a.check_in_time) < since) continue;
      const d = a.department || 'Other';
      byDept[d] = (byDept[d] || 0) + 1;
    }
    return Object.entries(byDept).map(([dept, count]) => ({ dept, count }));
  }, [attendance, since]);

  const avgAttendance = attendance.length > 0
    ? Math.round((attendance.filter(a => (a.status || '').toUpperCase() === 'PRESENT').length / attendance.length) * 100)
    : 0;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const checkinCheckout = useMemo(() => {
    const hours = Array.from({ length: 10 }, (_, i) => 8 + i);
    return hours.map(h => {
      const label = h <= 12 ? `${h}${h === 12 ? 'PM' : 'AM'}` : `${h - 12}PM`;
      const checkins = visitors.filter(v => { const d = new Date(v.check_in_time); return d >= today && d.getHours() === h; }).length;
      const checkouts = visitors.filter(v => v.check_out_time && (() => { const d = new Date(v.check_out_time!); return d >= today && d.getHours() === h; })()).length;
      return { hour: label, checkins, checkouts };
    });
  }, [visitors]);

  const heatmapData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    PEAK_HOURS.forEach(h => { map[h] = {}; DAYS.forEach(d => { map[h][d] = 0; }); });
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    for (const v of visitors) {
      const d = new Date(v.check_in_time);
      if (d < fourWeeksAgo) continue;
      const dayIdx = d.getDay(); // 0=Sun..6=Sat
      if (dayIdx === 0) continue; // skip Sunday, not in DAYS
      const dayLabel = DAYS[dayIdx - 1];
      const h = d.getHours();
      const hourLabel = h <= 12 ? `${h}${h === 12 ? 'PM' : 'AM'}` : `${h - 12}PM`;
      if (map[hourLabel] && dayLabel) map[hourLabel][dayLabel] = (map[hourLabel][dayLabel] || 0) + 1;
    }
    return map;
  }, [visitors]);

  const peakHour = useMemo(() => {
    let best = { hour: '—', count: -1 };
    for (const h of PEAK_HOURS) {
      const total = DAYS.reduce((s, d) => s + (heatmapData[h]?.[d] || 0), 0);
      if (total > best.count) best = { hour: h, count: total };
    }
    return best.hour;
  }, [heatmapData]);

  const frequentVisitors = useMemo(() => {
    const byName: Record<string, { visits: number; lastVisit: string; purpose: string }> = {};
    for (const v of visitors) {
      const key = v.full_name;
      if (!byName[key]) byName[key] = { visits: 0, lastVisit: v.check_in_time, purpose: v.purpose };
      byName[key].visits += 1;
      if (new Date(v.check_in_time) > new Date(byName[key].lastVisit)) byName[key].lastVisit = v.check_in_time;
    }
    return Object.entries(byName).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.visits - a.visits).slice(0, 5);
  }, [visitors]);

  const mostVisitedStaff = useMemo(() => {
    const byHost: Record<string, number> = {};
    for (const v of visitors) { byHost[v.host_name] = (byHost[v.host_name] || 0) + 1; }
    return Object.entries(byHost).map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits).slice(0, 5);
  }, [visitors]);

  const heatColor = (v: number) => {
    if (v === 0) return 'rgba(99,102,241,0.05)';
    if (v < 2) return 'rgba(99,102,241,0.15)';
    if (v < 4) return 'rgba(99,102,241,0.35)';
    if (v < 6) return 'rgba(99,102,241,0.6)';
    return 'rgba(99,102,241,0.9)';
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[var(--accent)]" />
            Reception Analytics
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Visitor patterns, attendance trends, and peak hour analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-0.5">
            {(['7D','30D','90D','12M'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all ${period === p ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => { exportToCSV(trendData, ['label','visitors'], `reception_analytics_${period}`); addNotification('Analytics exported'); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}
        </div>
      ) : (
      <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Visitors', value: totalVisitors, suffix: '', sub: `in ${period}`, icon: Users, color: 'var(--accent)' },
          { label: 'Avg Daily Visitors', value: avgDaily, suffix: '', sub: 'per day', icon: Calendar, color: '#6366f1' },
          { label: 'Avg Attendance Rate', value: avgAttendance, suffix: '%', sub: 'staff present', icon: UserCheck, color: '#10b981' },
          { label: 'Peak Hour', value: peakHour as (string | number), suffix: '', sub: 'busiest time (4wk)', icon: Clock, color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">{card.label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${card.color}20`, color: card.color }}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{typeof card.value === 'number' ? <CountUp value={card.value} suffix={card.suffix} /> : card.value}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Visitor Trend + Purpose Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Visitor Trend — {period}</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} barSize={period === '30D' ? 8 : 18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Bar dataKey="visitors" name="Visitors" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Visitor Purpose</h3>
          {purposeData.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">No visitors in this period.</p>
          ) : (
          <>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={purposeData} cx="50%" cy="50%" innerRadius={32} outerRadius={54} paddingAngle={3} dataKey="value">
                  {purposeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {purposeData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-[var(--text-muted)] flex-1 truncate">{d.name}</span>
                <span className="font-bold text-[var(--text-primary)]">{d.value}</span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Row 3: Dept Attendance Bar + Check-in vs Check-out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Attendance Check-ins by Department</h3>
          {deptAttendance.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">No attendance records in this period.</p>
          ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptAttendance} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                <YAxis dataKey="dept" type="category" stroke="var(--text-muted)" fontSize={10} width={50} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Bar dataKey="count" name="Check-ins" fill="#10b981" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Check-in vs Check-out (Today)</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkinCheckout} barSize={10} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="checkins" name="Check-ins" fill="var(--accent)" radius={[4,4,0,0]} />
                <Bar dataKey="checkouts" name="Check-outs" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Peak Hours Heatmap */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
        <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Peak Hours Heatmap — Visitors per Hour per Day (last 4 weeks)</h3>
        <div className="overflow-x-auto">
          <table className="text-[10px] w-full" style={{ minWidth: 500 }}>
            <thead>
              <tr>
                <th className="px-2 py-1 text-[var(--text-muted)] text-left font-semibold">Hour</th>
                {DAYS.map(d => (
                  <th key={d} className="px-2 py-1 text-[var(--text-muted)] font-semibold text-center">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PEAK_HOURS.map(h => (
                <tr key={h}>
                  <td className="px-2 py-1 font-semibold text-[var(--text-secondary)] whitespace-nowrap">{h}</td>
                  {DAYS.map(d => {
                    const v = heatmapData[h]?.[d] || 0;
                    return (
                      <td key={d} className="px-1 py-1">
                        <div className="h-7 w-full rounded-lg flex items-center justify-center font-bold text-[10px]"
                          style={{ background: heatColor(v), color: v >= 6 ? 'white' : 'var(--text-muted)' }}>
                          {v || '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[var(--text-muted)]">Low</span>
            {[0.05,0.15,0.35,0.6,0.9].map((o, i) => (
              <div key={i} className="w-5 h-3 rounded" style={{ background: `rgba(99,102,241,${o})` }} />
            ))}
            <span className="text-[10px] text-[var(--text-muted)]">High</span>
          </div>
        </div>
      </div>

      {/* Row 5: Frequent Visitors + Most Visited Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Most Frequent Visitors</h3>
          {frequentVisitors.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">No visitor history yet.</p>
          ) : (
          <div className="space-y-2">
            {frequentVisitors.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{v.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{v.purpose}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[var(--accent)]">{v.visits}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">visits</p>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Most Visited Staff</h3>
          {mostVisitedStaff.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">No visitor history yet.</p>
          ) : (
          <div className="space-y-2">
            {mostVisitedStaff.map((s) => (
              <div key={s.name} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-xs shrink-0">
                  {s.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{s.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{s.visits}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">visitors</p>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
