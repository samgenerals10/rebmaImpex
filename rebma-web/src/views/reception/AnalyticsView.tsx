import React, { useState } from 'react';
import {
  TrendingUp, Users, UserCheck, Clock, BarChart2, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { exportToCSV } from '../../utils/export';

type Period = '7D' | '30D' | '90D' | '12M';

const VISITOR_TREND = {
  '7D': [
    { label: 'Mon', visitors: 12, attendance: 89 },
    { label: 'Tue', visitors: 15, attendance: 92 },
    { label: 'Wed', visitors: 8, attendance: 88 },
    { label: 'Thu', visitors: 18, attendance: 95 },
    { label: 'Fri', visitors: 11, attendance: 91 },
    { label: 'Sat', visitors: 4, attendance: 72 },
    { label: 'Sun', visitors: 2, attendance: 0 },
  ],
  '30D': Array.from({ length: 30 }, (_, i) => ({
    label: `D${i+1}`, visitors: Math.floor(6 + Math.random() * 18), attendance: Math.floor(80 + Math.random() * 18),
  })),
  '90D': Array.from({ length: 12 }, (_, i) => ({
    label: `W${i+1}`, visitors: Math.floor(40 + Math.random() * 60), attendance: Math.floor(82 + Math.random() * 15),
  })),
  '12M': [
    { label: 'Jan', visitors: 210, attendance: 88 }, { label: 'Feb', visitors: 195, attendance: 91 },
    { label: 'Mar', visitors: 230, attendance: 87 }, { label: 'Apr', visitors: 245, attendance: 93 },
    { label: 'May', visitors: 260, attendance: 89 }, { label: 'Jun', visitors: 220, attendance: 90 },
    { label: 'Jul', visitors: 180, attendance: 85 }, { label: 'Aug', visitors: 200, attendance: 88 },
    { label: 'Sep', visitors: 240, attendance: 92 }, { label: 'Oct', visitors: 255, attendance: 91 },
    { label: 'Nov', visitors: 270, attendance: 94 }, { label: 'Dec', visitors: 190, attendance: 83 },
  ],
};

const PURPOSE_DATA = [
  { name: 'Business Meeting', value: 38, color: '#6366f1' },
  { name: 'Delivery', value: 22, color: '#f59e0b' },
  { name: 'Personal', value: 18, color: '#10b981' },
  { name: 'Interview', value: 14, color: '#8b5cf6' },
  { name: 'Other', value: 8, color: '#64748b' },
];

const DEPT_ATTENDANCE = [
  { dept: 'Ops', rate: 95 }, { dept: 'Finance', rate: 92 }, { dept: 'HR', rate: 90 },
  { dept: 'Mkt', rate: 88 }, { dept: 'Dispatch', rate: 86 }, { dept: 'Prod', rate: 84 },
  { dept: 'Mgmt', rate: 91 }, { dept: 'Rec', rate: 96 },
];

const CHECKIN_CHECKOUT = [
  { hour: '8AM', checkins: 3, checkouts: 0 }, { hour: '9AM', checkins: 8, checkouts: 2 },
  { hour: '10AM', checkins: 6, checkouts: 5 }, { hour: '11AM', checkins: 4, checkouts: 6 },
  { hour: '12PM', checkins: 2, checkouts: 3 }, { hour: '1PM', checkins: 5, checkouts: 4 },
  { hour: '2PM', checkins: 7, checkouts: 6 }, { hour: '3PM', checkins: 3, checkouts: 7 },
  { hour: '4PM', checkins: 2, checkouts: 5 }, { hour: '5PM', checkins: 1, checkouts: 4 },
];

const PEAK_HOURS = ['8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const HEATMAP_DATA: Record<string,Record<string,number>> = {};
PEAK_HOURS.forEach(h => {
  HEATMAP_DATA[h] = {};
  DAYS.forEach(d => { HEATMAP_DATA[h][d] = Math.floor(Math.random() * 15); });
});

const FREQUENT_VISITORS = [
  { name: 'Emmanuel Quaye', company: 'TechHub Ghana', visits: 12, lastVisit: '2026-06-12' },
  { name: 'Serwa Asiedu', company: 'AfriBank Ltd', visits: 9, lastVisit: '2026-06-11' },
  { name: 'Grace Ntow', company: 'Gov Office', visits: 7, lastVisit: '2026-06-10' },
  { name: 'Kofi Bonsu', company: 'Construction Co.', visits: 6, lastVisit: '2026-06-08' },
  { name: 'Felicia Osei', company: 'Creative Agency', visits: 5, lastVisit: '2026-06-07' },
];

const MOST_VISITED_STAFF = [
  { name: 'Kwame Mensah', dept: 'Operations', visits: 18 },
  { name: 'Abena Owusu', dept: 'Finance', visits: 15 },
  { name: 'Maame Asare', dept: 'Management', visits: 12 },
  { name: 'Ama Boateng', dept: 'HR', visits: 10 },
  { name: 'Kofi Asante', dept: 'Logistics', visits: 9 },
];

interface Props { addNotification: (msg: string) => void }

export default function AnalyticsView({ addNotification }: Props) {
  const [period, setPeriod] = useState<Period>('7D');

  const trendData = VISITOR_TREND[period];
  const totalVisitors = trendData.reduce((s, d) => s + d.visitors, 0);
  const avgDaily = Math.round(totalVisitors / trendData.length);
  const avgAttendance = Math.round(trendData.reduce((s, d) => s + d.attendance, 0) / trendData.filter(d => d.attendance > 0).length);
  const peakHour = '9AM';

  const heatColor = (v: number) => {
    if (v === 0) return 'rgba(99,102,241,0.05)';
    if (v < 4) return 'rgba(99,102,241,0.15)';
    if (v < 8) return 'rgba(99,102,241,0.35)';
    if (v < 12) return 'rgba(99,102,241,0.6)';
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
          {/* Period selector */}
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-0.5">
            {(['7D','30D','90D','12M'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all ${period === p ? 'bg-[var(--accent)] text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => { exportToCSV(trendData, ['label','visitors','attendance'], `reception_analytics_${period}`); addNotification('Analytics exported'); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Visitors', value: totalVisitors, sub: `in ${period}`, icon: Users, color: 'var(--accent)' },
          { label: 'Avg Daily Visitors', value: avgDaily, sub: 'per day', icon: Calendar, color: '#6366f1' },
          { label: 'Avg Attendance Rate', value: `${avgAttendance}%`, sub: 'staff present', icon: UserCheck, color: '#10b981' },
          { label: 'Peak Hour', value: peakHour, sub: 'busiest time', icon: Clock, color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">{card.label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${card.color}20`, color: card.color }}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
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
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={PURPOSE_DATA} cx="50%" cy="50%" innerRadius={32} outerRadius={54} paddingAngle={3} dataKey="value">
                  {PURPOSE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {PURPOSE_DATA.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-[var(--text-muted)] flex-1">{d.name}</span>
                <span className="font-bold text-[var(--text-primary)]">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Dept Attendance Bar + Check-in vs Check-out */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Staff Attendance by Department</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEPT_ATTENDANCE} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} horizontal={false} />
                <XAxis type="number" domain={[0,100]} stroke="var(--text-muted)" fontSize={10} />
                <YAxis dataKey="dept" type="category" stroke="var(--text-muted)" fontSize={10} width={40} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} formatter={(v) => [`${v}%`, 'Rate']} />
                <Bar dataKey="rate" name="Attendance %" fill="#10b981" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Check-in vs Check-out (Today)</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHECKIN_CHECKOUT} barSize={10} barCategoryGap="30%">
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
        <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Peak Hours Heatmap — Visitors per Hour per Day</h3>
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
                    const v = HEATMAP_DATA[h][d];
                    return (
                      <td key={d} className="px-1 py-1">
                        <div className="h-7 w-full rounded-lg flex items-center justify-center font-bold text-[10px]"
                          style={{ background: heatColor(v), color: v >= 8 ? 'white' : 'var(--text-muted)' }}>
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
          <div className="space-y-2">
            {FREQUENT_VISITORS.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{v.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{v.company}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[var(--accent)]">{v.visits}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">visits</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Most Visited Staff</h3>
          <div className="space-y-2">
            {MOST_VISITED_STAFF.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-xs shrink-0">
                  {s.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{s.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{s.dept}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{s.visits}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">visitors</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
