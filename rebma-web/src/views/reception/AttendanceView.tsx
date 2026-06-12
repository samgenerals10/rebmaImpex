// src/views/reception/AttendanceView.tsx
import { useState, useEffect } from 'react';
import { UserCheck, Clock, Plus, X, Check, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import type { Attendance } from '../../types/erp';

const DEPTS = ['CEO','MANAGEMENT','HR','MARKETING','OPERATIONS','FINANCE','PRODUCTION','RECEPTION','DISPATCH','LOGISTICS'];

const MOCK: Attendance[] = Array.from({ length: 15 }, (_, i) => ({
  id: `ATT-${String(i+1).padStart(3,'0')}`,
  fullName: ['Kofi Atta','Ama Mensah','Yaw Darko','Abena Serwaa','Kwame Asante','Akosua Boateng','Emmanuel Tetteh','Adwoa Frimpong','Kojo Asare','Nana Owusu','Grace Adjei','Francis Ampoh','Rita Mensah','Samuel Boadu','Abena Kusi'][i],
  checkInTime: `0${7 + Math.floor(i/3)}:${(i*7)%60 < 10 ? '0' : ''}${(i*7)%60} AM`,
  status: (i % 7 === 0 ? 'LATE' : 'PRESENT') as 'PRESENT' | 'LATE',
  date: new Date().toISOString().slice(0,10),
}));

interface Props { addNotification: (msg: string) => void }

export default function AttendanceView({ addNotification }: Props) {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0,10));
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', department: 'HR', virtual: false });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('attendance').select('*').eq('date', filterDate).order('checkInTime');
        setRows(data && data.length > 0 ? data : MOCK);
      } catch { setRows(MOCK); }
      setLoading(false);
    };
    load();
  }, [filterDate]);

  const handleCheckIn = () => {
    if (!form.fullName.trim()) return;
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const time = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    const isLate = h > 8 || (h === 8 && m > 30);
    const rec: Attendance = {
      id: `ATT-${Date.now().toString().slice(-4)}`,
      fullName: form.fullName,
      checkInTime: time,
      status: isLate ? 'LATE' : 'PRESENT',
      date: filterDate,
    };
    setRows(prev => [rec, ...prev]);
    supabase.from('attendance').insert({ ...rec, department: form.department, virtual: form.virtual }).then(() => {}, () => {});
    addNotification(`${form.fullName} checked in${isLate ? ' (late)' : ''}.`);
    setForm({ fullName: '', department: 'HR', virtual: false });
    setModal(false);
  };

  const filtered = rows.filter(r => {
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchSearch = !search || r.fullName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const present = rows.filter(r => r.status === 'PRESENT').length;
  const late = rows.filter(r => r.status === 'LATE').length;
  const absent = Math.max(0, 30 - rows.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Employee Attendance</h2>
          <p className="text-xs text-[var(--text-muted)]">Track daily staff check-ins</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filtered, ['id','fullName','checkInTime','status','date'], 'attendance_report')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Check In
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Expected', val: 30, cls: 'text-[var(--text-primary)]', bg: 'bg-[var(--bg-card)]' },
          { label: 'Present', val: present, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Late', val: late, cls: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Absent', val: absent, cls: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]`}>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-extrabold mt-1 ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name…"
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none w-40 focus:ring-1 focus:ring-[var(--accent)]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="ALL">All Status</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] uppercase">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] uppercase">Check-In Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] uppercase">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-[var(--text-muted)]">No attendance records found.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-[9px] font-bold shrink-0">
                          {r.fullName.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        {r.fullName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono">{r.checkInTime}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{r.date || filterDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-input)]">
            <p className="text-[10px] text-[var(--text-muted)]">Showing {filtered.length} of {rows.length} records</p>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Staff Check-In</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase mb-1">Employee Name</label>
                <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Full name…"
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase mb-1">Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none cursor-pointer">
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.virtual} onChange={e => setForm(f => ({ ...f, virtual: e.target.checked }))} className="accent-[var(--accent)]" />
                <span className="text-xs text-[var(--text-secondary)]">Virtual / Remote check-in</span>
              </label>
              {form.virtual && <p className="text-[10px] text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">GPS verification skipped for remote workers.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(false)} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={handleCheckIn} disabled={!form.fullName.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Confirm Check-In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
