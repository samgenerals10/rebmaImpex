// src/views/reception/DailyReportsView.tsx
import { useState } from 'react';
import { FileText, Printer, Download, Calendar, Users, UserCheck, TrendingUp } from 'lucide-react';
import { exportToPDF } from '../../utils/export';

const DEPTS = [
  { name: 'Management', present: 4, total: 5 },
  { name: 'Finance', present: 6, total: 7 },
  { name: 'Marketing', present: 5, total: 6 },
  { name: 'Operations', present: 8, total: 9 },
  { name: 'HR', present: 3, total: 4 },
  { name: 'Dispatch', present: 10, total: 12 },
  { name: 'Production', present: 9, total: 11 },
  { name: 'Reception', present: 2, total: 2 },
];

const PAST_REPORTS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - i - 1);
  return {
    date: d.toISOString().slice(0,10),
    visitors: Math.floor(8 + Math.random() * 12),
    attendanceRate: Math.floor(88 + Math.random() * 10),
    checkins: Math.floor(5 + Math.random() * 8),
  };
});

const VISITORS_TODAY = [
  { id: 'V001', name: 'John Mensah', company: 'Accra Traders', purpose: 'Business Meeting', host: 'CEO', in: '09:15', out: '10:45' },
  { id: 'V002', name: 'Ama Boateng', company: 'Gulf Imports', purpose: 'Delivery', host: 'Operations', in: '10:00', out: '10:20' },
  { id: 'V003', name: 'Kofi Asante', company: 'Prime Suppliers', purpose: 'Invoice Payment', host: 'Finance', in: '11:30', out: null },
  { id: 'V004', name: 'Abena Kusi', company: 'Delta Logistics', purpose: 'Interview', host: 'HR', in: '14:00', out: '15:30' },
];

interface Props { addNotification: (msg: string) => void }

export default function DailyReportsView({ addNotification }: Props) {
  const today = new Date().toISOString().slice(0,10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [viewingPast, setViewingPast] = useState<typeof PAST_REPORTS[0] | null>(null);

  const isToday = selectedDate === today;
  const totalPresent = DEPTS.reduce((s, d) => s + d.present, 0);
  const totalStaff = DEPTS.reduce((s, d) => s + d.total, 0);
  const attendanceRate = Math.round((totalPresent / totalStaff) * 100);

  const handleExportPDF = () => {
    exportToPDF(`Daily Report — ${selectedDate}`, VISITORS_TODAY, ['id','name','company','purpose','host','in','out']);
    addNotification('Daily report exported as PDF.');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Daily Reports</h2>
          <p className="text-xs text-[var(--text-muted)]">Auto-generated daily summary</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setViewingPast(null); }}
            className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none" />
          <button onClick={() => { window.print(); addNotification('Print dialog opened.'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Hero summary card */}
      <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #0298d0 100%)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 opacity-80" />
          <p className="text-sm font-semibold opacity-90">{new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Visitors', val: VISITORS_TODAY.length, icon: Users },
            { label: 'Staff Present', val: totalPresent, icon: UserCheck },
            { label: 'Attendance Rate', val: `${attendanceRate}%`, icon: TrendingUp },
            { label: 'Check-Outs', val: VISITORS_TODAY.filter(v => v.out).length, icon: FileText },
          ].map((s, i) => { const Icon = s.icon; return (
            <div key={i} className="bg-white/15 rounded-xl p-3">
              <Icon className="w-4 h-4 mb-1 opacity-80" />
              <p className="text-xl font-bold">{s.val}</p>
              <p className="text-[10px] opacity-75">{s.label}</p>
            </div>
          ); })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Visitor Summary */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Visitor Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">Name</th>
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">Purpose</th>
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">In</th>
                <th className="px-3 py-2 text-left text-[var(--text-muted)] font-semibold">Out</th>
              </tr></thead>
              <tbody>
                {VISITORS_TODAY.map(v => (
                  <tr key={v.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                    <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{v.name}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{v.purpose}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)] font-mono">{v.in}</td>
                    <td className="px-3 py-2 font-mono">{v.out ? <span className="text-[var(--text-muted)]">{v.out}</span> : <span className="text-emerald-600 font-semibold">On Site</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Staff Attendance by Dept */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Staff Attendance by Department</h3>
          </div>
          <div className="p-4 space-y-3">
            {DEPTS.map(d => {
              const pct = Math.round((d.present / d.total) * 100);
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                    <span className="text-[var(--text-muted)]">{d.present}/{d.total} — {pct}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Incidents */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] p-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Incidents & Notes</h3>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700 font-semibold mb-3">
          No incidents reported today.
        </div>
        <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase mb-1">Receptionist Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Add daily notes here…" rows={3}
          className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none" />
        <div className="flex items-center justify-between mt-2">
          {notesSaved && <span className="text-xs text-emerald-600 font-semibold">Notes saved.</span>}
          <button onClick={() => { setNotesSaved(true); addNotification('Notes saved.'); setTimeout(() => setNotesSaved(false), 3000); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            Save Notes
          </button>
        </div>
      </div>

      {/* Past Reports */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Past Reports (Last 7 Days)</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {PAST_REPORTS.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--accent-light)] transition-colors">
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">{new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{r.visitors} visitors · {r.attendanceRate}% attendance</p>
              </div>
              <button onClick={() => { setSelectedDate(r.date); setViewingPast(r); }}
                className="px-3 py-1 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold rounded-lg cursor-pointer hover:opacity-90">
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
