// src/views/reception/AttendanceView.tsx
import { useState, useEffect } from 'react';
import {
  UserCheck, Clock, Plus, X, Check, Download, MapPin, Wifi,
  MoreVertical, Eye, UserMinus, AlertTriangle, Navigation
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import type { Attendance } from '../../types/erp';

const DEPTS = ['CEO','MANAGEMENT','HR','MARKETING','OPERATIONS','FINANCE','PRODUCTION','RECEPTION','DISPATCH','LOGISTICS'];

const WORKPLACE = { lat: 5.6037, lng: -0.1870, radiusMeters: 100, name: 'REBMA IMPEX HQ' };

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MOCK: (Attendance & { type?: string; gpsVerified?: boolean })[] = Array.from({ length: 15 }, (_, i) => ({
  id: `ATT-${String(i+1).padStart(3,'0')}`,
  fullName: ['Kofi Atta','Ama Mensah','Yaw Darko','Abena Serwaa','Kwame Asante','Akosua Boateng','Emmanuel Tetteh','Adwoa Frimpong','Kojo Asare','Nana Owusu','Grace Adjei','Francis Ampoh','Rita Mensah','Samuel Boadu','Abena Kusi'][i],
  checkInTime: `0${7 + Math.floor(i/3)}:${(i*7)%60 < 10 ? '0' : ''}${(i*7)%60}`,
  status: (i % 7 === 0 ? 'LATE' : 'PRESENT') as 'PRESENT' | 'LATE',
  date: new Date().toISOString().slice(0,10),
  type: i % 5 === 0 ? 'Virtual' : 'Physical',
  gpsVerified: i % 5 !== 0,
}));

type AttendanceRow = (typeof MOCK)[0];

interface Props { addNotification: (msg: string) => void }

export default function AttendanceView({ addNotification }: Props) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0,10));
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [detailRow, setDetailRow] = useState<AttendanceRow | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle'|'locating'|'ok'|'fail'|'virtual'>('idle');
  const [gpsError, setGpsError] = useState('');
  const [gpsDistance, setGpsDistance] = useState<number|null>(null);
  const [form, setForm] = useState({ fullName: '', department: 'HR', virtual: false });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('attendance').select('*').eq('date', filterDate).order('checkInTime');
        if (error) throw error;
        setRows((data || []) as AttendanceRow[]);
      } catch { setRows(MOCK); }
      setLoading(false);
    };
    load();
  }, [filterDate]);

  const handleCheckIn = () => {
    if (!form.fullName.trim()) return;
    if (form.virtual) {
      doCheckIn('Virtual', false);
    } else {
      setGpsStatus('locating');
      setGpsError('');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, WORKPLACE.lat, WORKPLACE.lng);
          setGpsDistance(Math.round(dist));
          if (dist <= WORKPLACE.radiusMeters) {
            setGpsStatus('ok');
            doCheckIn('Physical', true);
          } else {
            setGpsStatus('fail');
            setGpsError(`You are ${Math.round(dist)}m from the office (max ${WORKPLACE.radiusMeters}m). Enable virtual mode or check in from the office.`);
          }
        },
        (err) => {
          setGpsStatus('fail');
          setGpsError(`GPS error: ${err.message}. Enable virtual mode to proceed.`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const doCheckIn = async (type: string, gpsVerified: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      const time = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
      const isLate = h > 9 || (h === 9 && m > 0);
      const rec: AttendanceRow = {
        id: `ATT-${Date.now().toString().slice(-4)}`,
        fullName: form.fullName,
        checkInTime: time,
        status: isLate ? 'LATE' : 'PRESENT',
        date: filterDate,
        type,
        gpsVerified,
      };
      setRows(prev => [rec, ...prev]);
      await supabase.from('attendance').insert({ ...rec, department: form.department });
      addNotification(`${form.fullName} checked in${isLate ? ' (late)' : ''} — ${type}`);
      setForm({ fullName: '', department: 'HR', virtual: false });
      setGpsStatus('idle');
      setGpsDistance(null);
      setModal(false);
    } catch {
      addNotification('Failed to record check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAbsent = async (id: string, name: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'ABSENT' as any } : r));
      await supabase.from('attendance').update({ status: 'ABSENT' }).eq('id', id);
      addNotification(`${name} marked absent`);
    } catch {
      addNotification('Failed to mark absent.');
    } finally {
      setSubmitting(false);
    }
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
          <p className="text-xs text-[var(--text-muted)]">GPS-verified daily staff check-ins</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filtered, ['id','fullName','checkInTime','status','date','type','gpsVerified'], 'attendance_report')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => { setModal(true); setGpsStatus('idle'); setGpsError(''); setGpsDistance(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Check In
          </button>
        </div>
      </div>

      {/* GPS Info Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--accent-light)] border border-[var(--border)] rounded-2xl text-xs">
        <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <span className="text-[var(--text-secondary)]">
          Workplace: <strong className="text-[var(--text-primary)]">{WORKPLACE.name}</strong> ·
          GPS radius: <strong className="text-[var(--text-primary)]">{WORKPLACE.radiusMeters}m</strong> ·
          Late threshold: <strong className="text-[var(--text-primary)]">9:00 AM</strong>
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Expected', val: 30, cls: 'text-[var(--text-primary)]' },
          { label: 'Present', val: present, cls: 'text-emerald-600' },
          { label: 'Late', val: late, cls: 'text-amber-600' },
          { label: 'Absent / Not In', val: absent, cls: 'text-rose-600' },
        ].map((s, i) => (
          <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-extrabold mt-1 ${s.cls}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name…"
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none w-44 focus:ring-1 focus:ring-[var(--accent)]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none cursor-pointer">
          <option value="ALL">All Status</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                  {['Name','Check-In Time','Date','Type','GPS','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[var(--text-muted)] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-[var(--text-muted)]">No attendance records found.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
                    onClick={() => setDetailRow(r)}>
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
                      <div className="flex items-center gap-1">
                        {r.type === 'Virtual' ? <Wifi className="w-3 h-3 text-blue-500" /> : <MapPin className="w-3 h-3 text-emerald-500" />}
                        <span className={`text-[10px] font-semibold ${r.type === 'Virtual' ? 'text-blue-500' : 'text-emerald-600'}`}>{r.type || 'Physical'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.gpsVerified
                        ? <span className="text-emerald-600 text-[10px] font-bold flex items-center gap-0.5"><Navigation className="w-3 h-3" /> Verified</span>
                        : <span className="text-slate-400 text-[10px]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
                          className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpen === r.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1">
                            <button onClick={() => { setDetailRow(r); setMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                            <button onClick={() => { handleMarkAbsent(r.id, r.fullName); setMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-amber-600 hover:bg-amber-500/10 rounded-lg cursor-pointer">
                              <AlertTriangle className="w-3.5 h-3.5" /> Mark Absent
                            </button>
                            <button onClick={() => { exportToPDF('Attendance Record', [r], ['id','fullName','checkInTime','status','date','type']); setMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                              <Download className="w-3.5 h-3.5" /> Export PDF
                            </button>
                            <button onClick={async () => {
                                if (submitting) return;
                                setSubmitting(true);
                                try {
                                  await supabase.from('attendance').delete().eq('id', r.id);
                                  setRows(prev => prev.filter(x => x.id !== r.id));
                                  addNotification(`${r.fullName} record removed`);
                                } catch {
                                  addNotification('Failed to delete record.');
                                } finally {
                                  setSubmitting(false);
                                  setMenuOpen(null);
                                }
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer disabled:opacity-50">
                              <UserMinus className="w-3.5 h-3.5" /> Delete Log
                            </button>
                          </div>
                        )}
                      </div>
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

      {/* Check In Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Staff Check-In</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase mb-1">Employee Name *</label>
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

              {/* Physical vs Virtual */}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setForm(f => ({ ...f, virtual: false })); setGpsStatus('idle'); setGpsError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${!form.virtual ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border)]'}`}>
                  <MapPin className="w-3.5 h-3.5" /> Physical
                </button>
                <button type="button" onClick={() => { setForm(f => ({ ...f, virtual: true })); setGpsStatus('virtual'); setGpsError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${form.virtual ? 'bg-blue-500 text-white border-blue-500' : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border)]'}`}>
                  <Wifi className="w-3.5 h-3.5" /> Virtual
                </button>
              </div>

              {!form.virtual && (
                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-secondary)] flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 text-[var(--accent)]" />
                  GPS will verify your location against {WORKPLACE.name} ({WORKPLACE.radiusMeters}m radius)
                </div>
              )}
              {form.virtual && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-600">
                  Virtual check-in — no GPS verification required.
                </div>
              )}

              {gpsStatus === 'locating' && (
                <div className="flex items-center gap-2 text-xs text-[var(--accent)] bg-[var(--accent-light)] rounded-xl px-3 py-2">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Acquiring GPS location…
                </div>
              )}
              {gpsStatus === 'ok' && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-xl px-3 py-2">
                  <Check className="w-3.5 h-3.5" /> Location verified ({gpsDistance}m from office)
                </div>
              )}
              {gpsStatus === 'fail' && (
                <div className="flex items-start gap-2 text-xs text-rose-600 bg-rose-500/10 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {gpsError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(false)} disabled={submitting} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleCheckIn} disabled={!form.fullName.trim() || gpsStatus === 'locating' || submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <UserCheck className="w-3.5 h-3.5" /> {submitting ? 'Saving...' : gpsStatus === 'locating' ? 'Locating…' : 'Check In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Attendance Record</h3>
              <button onClick={() => setDetailRow(null)} className="cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold">
                {detailRow.fullName.split(' ').map(n => n[0]).join('').slice(0,2)}
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-sm">{detailRow.fullName}</p>
                <p className="text-[10px] text-[var(--text-muted)]">Record ID: {detailRow.id}</p>
              </div>
            </div>
            <div className="space-y-2 text-xs mb-4">
              {[
                { label: 'Check-In Time', value: detailRow.checkInTime },
                { label: 'Date', value: detailRow.date || filterDate },
                { label: 'Status', value: detailRow.status },
                { label: 'Type', value: detailRow.type || 'Physical' },
                { label: 'GPS Verified', value: detailRow.gpsVerified ? 'Yes' : 'No' },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-1.5 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">{item.label}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{item.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setDetailRow(null)}
              className="w-full py-2 border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
