import React, { useState, useEffect } from 'react';
import {
  UserPlus, UserCheck, UserMinus, FileBarChart, Users, Calendar,
  MoreVertical, ChevronRight, Clock, TrendingUp, TrendingDown,
  Printer, Download, Search, CheckCircle
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import CountUp from '../../components/CountUp';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import type { Visitor, CurrentUser, Attendance } from '../../types/erp';

interface Props {
  visitorsList: Visitor[];
  onAddVisitor: (e: React.FormEvent<HTMLFormElement>) => void;
  onCheckoutVisitor: (id: string) => void;
  onCheckInAttendance: (e: React.FormEvent<HTMLFormElement>) => void;
  addNotification: (msg: string) => void;
  setActiveSubTab: (tab: string) => void;
  currentUser: CurrentUser | null;
}

const TRAFFIC_DATA = [
  { hour: '8AM', checkins: 3, checkouts: 0 },
  { hour: '9AM', checkins: 8, checkouts: 2 },
  { hour: '10AM', checkins: 6, checkouts: 5 },
  { hour: '11AM', checkins: 4, checkouts: 6 },
  { hour: '12PM', checkins: 2, checkouts: 3 },
  { hour: '1PM', checkins: 5, checkouts: 4 },
  { hour: '2PM', checkins: 7, checkouts: 6 },
  { hour: '3PM', checkins: 3, checkouts: 7 },
  { hour: '4PM', checkins: 2, checkouts: 5 },
  { hour: '5PM', checkins: 1, checkouts: 4 },
];

const PURPOSE_DATA = [
  { name: 'Business Meeting', value: 38, color: '#6366f1' },
  { name: 'Delivery', value: 22, color: '#f59e0b' },
  { name: 'Personal', value: 18, color: '#10b981' },
  { name: 'Interview', value: 14, color: '#8b5cf6' },
  { name: 'Other', value: 8, color: '#64748b' },
];

const PEAK_DATA = [
  { hour: '8AM', count: 3 },
  { hour: '9AM', count: 8 },
  { hour: '10AM', count: 6 },
  { hour: '11AM', count: 4 },
  { hour: '12PM', count: 2 },
  { hour: '1PM', count: 5 },
  { hour: '2PM', count: 7 },
  { hour: '3PM', count: 3 },
  { hour: '4PM', count: 2 },
  { hour: '5PM', count: 1 },
];

const SPARK_DATA = [4, 7, 5, 9, 6, 8, 11];

function MiniBar({ data }: { data: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm bg-[var(--accent)] opacity-60"
          style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

const purposeBadgeColor = (p: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    'Business Meeting': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    'Delivery': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    'Personal': { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    'Interview': { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  };
  return map[p] || { bg: 'rgba(100,116,139,0.12)', color: '#64748b' };
};

const fmt = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

const duration = (checkIn: string, checkOut?: string) => {
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  const mins = Math.floor((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export default function ReceptionOverviewView({ visitorsList, onAddVisitor, onCheckoutVisitor, onCheckInAttendance, addNotification, setActiveSubTab, currentUser }: Props) {
  const { getSetting } = useCeoSettings();
  const handlePrint = () => {
    if (!getSetting('print_enabled', true)) { addNotification('Printing is currently disabled by the CEO.'); return; }
    window.print();
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = currentUser?.fullName?.split(' ')[0] || 'Receptionist';

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [quickForm, setQuickForm] = useState({ fullName: '', phone: '', host: '', purpose: 'Business Meeting' });
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [kpiMenuOpen, setKpiMenuOpen] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('attendance').select('*').eq('date', today).then(({ data }) => {
      if (data && data.length > 0) setAttendance(data as Attendance[]);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayVisitors = visitorsList.filter(v => v.checkInTime?.startsWith(today));
  const currentlyIn = visitorsList.filter(v => !v.checkOutTime);
  const checkedOut = visitorsList.filter(v => !!v.checkOutTime);
  const staffPresent = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE');

  // Routed through the same onAddVisitor callback the rest of the app uses
  // (App.tsx's handleAddVisitor -> reception.checkInVisitor), which does a
  // real snake_case insert and lets the DB assign the id. The form's own
  // direct supabase.from('visitors').insert(...) call used to send
  // camelCase keys the live schema doesn't have, with its result ignored
  // either way — so check-ins here never actually persisted.
  const handleQuickCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    if (!getSetting('forms_control', true)) { e.preventDefault(); addNotification('Form submissions are currently disabled by the CEO.'); return; }
    if (!quickForm.fullName || !quickForm.host) return;
    onAddVisitor(e);
    setQuickForm({ fullName: '', phone: '', host: '', purpose: 'Business Meeting' });
  };

  const kpiCards = [
    {
      label: 'Visitors Today', value: todayVisitors.length, sub: `+${Math.max(0, todayVisitors.length - 8)} vs yesterday`,
      trend: 'up', tab: 'Visitors', spark: SPARK_DATA,
    },
    {
      label: 'Currently Inside', value: currentlyIn.length, sub: `${checkedOut.length} checked out`,
      trend: 'neutral', tab: 'Visitors', spark: [2, 4, 3, 5, 4, 6, currentlyIn.length],
    },
    {
      label: 'Staff Present', value: staffPresent.length, sub: `${attendance.filter(a => a.status === 'LATE').length} late arrivals`,
      trend: staffPresent.length > 20 ? 'up' : 'down', tab: 'EmployeeCheckin', spark: [18, 22, 20, 25, 21, 24, staffPresent.length],
    },
    {
      label: 'Expected Visitors', value: 3, sub: 'pre-registered today',
      trend: 'neutral', tab: 'Visitors', spark: [1, 2, 3, 2, 4, 3, 3],
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Greeting */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{greeting}, {name} 👋</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Here's today's reception overview.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Export CSV', icon: Download, action: () => exportToCSV(visitorsList, ['id', 'fullName', 'purpose', 'hostName', 'checkInTime', 'checkOutTime'], 'reception_log') },
            { label: 'Print Report', icon: Printer, action: handlePrint },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
              <btn.icon className="w-3.5 h-3.5" /> {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Check In Visitor', icon: UserPlus, tab: 'Visitors' },
          { label: 'Check In Staff', icon: UserCheck, tab: 'EmployeeCheckin' },
          { label: 'Check Out Visitor', icon: UserMinus, tab: 'Visitors' },
          { label: 'Daily Report', icon: FileBarChart, tab: 'DailyReports' },
          { label: 'View Visitors', icon: Users, tab: 'Visitors' },
          { label: 'View Attendance', icon: Calendar, tab: 'EmployeeCheckin' },
        ].map(qa => (
          <button key={qa.label} onClick={() => setActiveSubTab(qa.tab)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-full hover:bg-[var(--accent-light)] hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer transition-all">
            <qa.icon className="w-3.5 h-3.5" />
            {qa.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <div key={card.label} role="button" tabIndex={0}
            onClick={() => setActiveSubTab(card.tab)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSubTab(card.tab); } }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-left hover:shadow-md transition-shadow cursor-pointer w-full relative group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wide leading-tight">{card.label}</p>
              <div className="relative" onClick={e => { e.stopPropagation(); setKpiMenuOpen(kpiMenuOpen === idx ? null : idx); }}>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--accent-light)] cursor-pointer">
                  <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
                {kpiMenuOpen === idx && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1">
                    <button onClick={() => { setActiveSubTab(card.tab); setKpiMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left cursor-pointer">View Details</button>
                    <button onClick={() => { exportToCSV(visitorsList, ['id', 'fullName', 'purpose'], card.label); setKpiMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left cursor-pointer">Export CSV</button>
                    <button onClick={() => setKpiMenuOpen(null)} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left cursor-pointer">Refresh</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-bold text-[var(--text-primary)] leading-none"><CountUp value={card.value} /></p>
                <div className="flex items-center gap-1 mt-1.5">
                  {card.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : card.trend === 'down' ? <TrendingDown className="w-3 h-3 text-rose-500" /> : null}
                  <p className="text-[10px] text-[var(--text-secondary)]">{card.sub}</p>
                </div>
              </div>
              <div className="w-16 shrink-0">
                <MiniBar data={card.spark} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Traffic Chart + Quick Check-In */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Visitor Traffic Today</h3>
              <p className="text-xs text-[var(--text-muted)]">Check-ins vs Check-outs by hour</p>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TRAFFIC_DATA}>
                <defs>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="coGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Area type="monotone" dataKey="checkins" name="Check-ins" stroke="var(--accent)" fill="url(#ciGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="checkouts" name="Check-outs" stroke="#ef4444" fill="url(#coGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" /><span className="text-[10px] text-[var(--text-muted)]">Check-ins</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span className="text-[10px] text-[var(--text-muted)]">Check-outs</span></div>
          </div>
        </div>

        {/* Quick Check-In */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Quick Check In</h3>
          <form onSubmit={handleQuickCheckIn} className="space-y-2.5">
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">Visitor Name *</label>
              <input name="visitor" value={quickForm.fullName} onChange={e => setQuickForm(p => ({ ...p, fullName: e.target.value }))} required placeholder="Full name"
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">Phone</label>
              <input value={quickForm.phone} onChange={e => setQuickForm(p => ({ ...p, phone: e.target.value }))} placeholder="+233..."
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">Host *</label>
              <input name="host" value={quickForm.host} onChange={e => setQuickForm(p => ({ ...p, host: e.target.value }))} required placeholder="Staff name"
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">Purpose</label>
              <SearchableDropdown value={quickForm.purpose} onChange={v => setQuickForm(p => ({ ...p, purpose: v }))} options={['Business Meeting', 'Delivery', 'Personal', 'Interview', 'Other'].map(p => ({ value: p, label: p }))} />
            </div>
            <button type="submit"
              className="w-full py-2.5 bg-[var(--accent)] text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity mt-1">
              Check In Visitor
            </button>
          </form>
          {/* Recent check-ins */}
          {currentlyIn.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-2">Recent Check-ins</p>
              <div className="space-y-1.5">
                {currentlyIn.slice(0, 3).map(v => (
                  <div key={v.id} className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-[9px] font-bold shrink-0">
                      {v.fullName[0]}
                    </div>
                    <span className="text-[var(--text-primary)] font-medium truncate flex-1">{v.fullName}</span>
                    <span className="text-[var(--text-muted)] shrink-0">{fmt(v.checkInTime)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Current Visitors + Staff Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Visitors */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Currently Inside</h3>
            <button onClick={() => setActiveSubTab('Visitors')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {currentlyIn.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">No visitors currently inside</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentlyIn.map(v => {
                const pc = purposeBadgeColor(v.purpose);
                return (
                  <div key={v.id} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold text-sm shrink-0">
                      {v.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{v.fullName}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{v.hostName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.color }}>{v.purpose}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">{duration(v.checkInTime)}</span>
                    </div>
                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setMenuOpen(menuOpen === v.id ? null : v.id)}
                        className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {menuOpen === v.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1">
                          <button onClick={() => { setActiveSubTab('Visitors'); setMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">View Details</button>
                          <button onClick={() => { onCheckoutVisitor(v.id); addNotification(`${v.fullName} checked out`); setMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer">Check Out</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Staff Attendance Today */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Staff Check-ins Today</h3>
            <button onClick={() => setActiveSubTab('EmployeeCheckin')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              View Full <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {attendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
              <UserCheck className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">No staff checked in yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {attendance.slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {a.fullName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{a.fullName}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">{a.checkInTime}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {a.status === 'PRESENT' ? 'On Time' : 'Late'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Visitor Stats Donut + Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Visitors by Purpose</h3>
          <div className="flex items-center gap-4">
            <div className="h-44 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PURPOSE_DATA} cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={3} dataKey="value">
                    {PURPOSE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {PURPOSE_DATA.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-primary)]">{d.value}%</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{d.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Peak Visitor Hours</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PEAK_DATA} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
                <Bar dataKey="count" name="Visitors" fill="var(--accent)" radius={[4, 4, 0, 0]}
                  label={false}
                  // Highlight busiest bar
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Busiest hour: <strong className="text-[var(--accent)]">9AM</strong> (8 visitors)</p>
        </div>
      </div>

      {/* Row 5: Daily Summary */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm">Today's Summary</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={() => exportToPDF('Daily Reception Report', visitorsList, ['id', 'fullName', 'purpose', 'hostName', 'checkInTime', 'checkOutTime'])}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--accent)] text-white rounded-xl hover:opacity-90 cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Visitors', value: todayVisitors.length as (number | string), suffix: '', color: 'var(--accent)' },
            { label: 'Total Check-ins', value: todayVisitors.length as (number | string), suffix: '', color: '#10b981' },
            { label: 'Total Check-outs', value: checkedOut.length as (number | string), suffix: '', color: '#6366f1' },
            { label: 'Currently Inside', value: currentlyIn.length as (number | string), suffix: '', color: '#f59e0b' },
            { label: 'Staff Attendance', value: (staffPresent.length > 0 ? Math.round((staffPresent.length / Math.max(staffPresent.length + 5, 30)) * 100) : 0) as (number | string), suffix: '%', color: '#10b981' },
            { label: 'Peak Hour', value: '9AM' as (number | string), suffix: '', color: '#8b5cf6' },
          ].map(item => (
            <div key={item.label} className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] text-center">
              <p className="text-xl font-bold" style={{ color: item.color }}>{typeof item.value === 'number' ? <CountUp value={item.value} suffix={item.suffix} /> : item.value}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />}
      {kpiMenuOpen !== null && <div className="fixed inset-0 z-20" onClick={() => setKpiMenuOpen(null)} />}
    </div>
  );
}
