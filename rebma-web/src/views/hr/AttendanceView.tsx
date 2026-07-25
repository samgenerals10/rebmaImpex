import React, { useState, useEffect } from 'react';
import {
  UserCheck, Search, Download, MapPin, Settings, CheckCircle, Clock,
  AlertCircle, X, Edit2, Trash2, Copy, Share2, MoreVertical, Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import CountUp from '../../components/CountUp';
import { exportToCSV } from '../../utils/export';
import type { Attendance } from '../../types/erp';

interface WorkplaceSettings {
  lat: number;
  lng: number;
  radiusMeters: number;
  allowVirtual: boolean;
  officeName: string;
}

const DEFAULT_SETTINGS: WorkplaceSettings = {
  lat: 5.6037,
  lng: -0.1870,
  radiusMeters: 100,
  allowVirtual: true,
  officeName: 'REBMA IMPEX HQ, Accra',
};

interface Props {
  attendanceList: Attendance[];
  addNotification: (msg: string) => void;
}

export default function AttendanceView({ attendanceList, addNotification }: Props) {
  const [records, setRecords] = useState<Attendance[]>(attendanceList);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<WorkplaceSettings>(DEFAULT_SETTINGS);
  const [editRec, setEditRec] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'LATE'>('PRESENT');
  const [editTime, setEditTime] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', checkInTime: '', status: 'PRESENT' as 'PRESENT' | 'LATE' });

  const loadAttendance = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, user:profiles(full_name)')
      .order('check_in_time', { ascending: false });
    if (!error && data) {
      setRecords(data.map((a: any) => ({
        id: a.id,
        fullName: a.user?.full_name || a.fullName || 'Unknown',
        checkInTime: a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        status: a.status as 'PRESENT' | 'LATE',
        date: a.date || (a.check_in_time ? new Date(a.check_in_time).toLocaleString() : '')
      })));
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const filtered = records.filter(r => {
    const matchSearch = r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const present = records.filter(r => r.status === 'PRESENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  const handleEditSave = async () => {
    if (!editRec) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const recordDate = editRec.date || new Date().toISOString().slice(0, 10);
      const [hours, minutes] = editTime.split(':');
      const checkInDate = new Date(recordDate);
      if (hours && minutes) {
        checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }
      const checkInTimeISO = checkInDate.toISOString();

      const { error } = await supabase
        .from('attendance')
        .update({
          status: editStatus,
          check_in_time: checkInTimeISO
        })
        .eq('id', editRec.id);

      if (!error) {
        const updated = { ...editRec, status: editStatus, checkInTime: editTime };
        setRecords(prev => prev.map(r => r.id === editRec.id ? updated : r));
        addNotification(`${editRec.fullName} attendance updated`);
        setEditRec(null);
      } else {
        alert(error.message || 'Failed to update attendance');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating attendance');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  };

  const handleDuplicate = async (r: Attendance) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const dupId = `ATT-${Date.now().toString().slice(-6)}`;
      const { data: prof } = await supabase.from('profiles').select('id').ilike('full_name', r.fullName).limit(1);
      const userId = prof && prof[0] ? prof[0].id : null;
      
      // Default time is now
      const nowISO = new Date().toISOString();
      const { error } = await supabase.from('attendance').insert([{
        id: dupId,
        user_id: userId,
        status: r.status,
        check_in_time: nowISO,
        date: nowISO.slice(0, 10)
      }]);

      if (!error) {
        const dup: Attendance = {
          ...r,
          id: dupId,
          checkInTime: new Date(nowISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(nowISO).toLocaleDateString()
        };
        setRecords(prev => [dup, ...prev]);
        addNotification(`Duplicated log for ${r.fullName}`);
      } else {
        alert(error.message || 'Failed to duplicate attendance log');
      }
    } catch (e: any) {
      alert(e.message || 'Error duplicating attendance log');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  };

  const handleShare = (r: Attendance) => {
    navigator.clipboard.writeText(`Attendance: ${r.fullName} | ${r.checkInTime} | ${r.status}`);
    addNotification('Attendance link copied');
    setMenuOpen(null);
  };

  const handleDelete = async (id: string) => {
    if (submitting) return;
    const rec = records.find(r => r.id === id);
    if (!await confirm(`Are you sure you want to delete this log?`)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (!error) {
        setRecords(prev => prev.filter(r => r.id !== id));
        addNotification(`Log deleted${rec ? ` for ${rec.fullName}` : ''}`);
      } else {
        alert(error.message || 'Failed to delete attendance log');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting log');
    } finally {
      setSubmitting(false);
      setMenuOpen(null);
    }
  };

  const handleAdd = async () => {
    if (!addForm.fullName) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: prof } = await supabase.from('profiles').select('id').ilike('full_name', addForm.fullName).limit(1);
      const userId = prof && prof[0] ? prof[0].id : null;

      const checkInDate = new Date();
      if (addForm.checkInTime) {
        const [hours, minutes] = addForm.checkInTime.split(':');
        checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }
      
      const newRecId = `ATT-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from('attendance').insert([{
        id: newRecId,
        user_id: userId,
        status: addForm.status,
        check_in_time: checkInDate.toISOString(),
        date: checkInDate.toISOString().slice(0, 10)
      }]);

      if (!error) {
        const newRec: Attendance = {
          id: newRecId,
          fullName: addForm.fullName,
          checkInTime: addForm.checkInTime || checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: addForm.status,
          date: checkInDate.toLocaleDateString()
        };
        setRecords(prev => [newRec, ...prev]);
        addNotification(`Attendance added for ${addForm.fullName}`);
        setShowAdd(false);
        setAddForm({ fullName: '', checkInTime: '', status: 'PRESENT' });
      } else {
        alert(error.message || 'Failed to add attendance log');
      }
    } catch (e: any) {
      alert(e.message || 'Error adding attendance log');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettings = () => {
    addNotification('Workplace settings saved');
    setShowSettings(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[var(--accent)]" />
            Attendance
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Track and manage employee attendance with GPS verification</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
            <Settings className="w-3.5 h-3.5" /> Workplace Settings
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--accent)] text-white rounded-xl hover:opacity-90 cursor-pointer transition-opacity">
            <Plus className="w-3.5 h-3.5" /> Add Log
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: records.length, color: 'var(--accent)', icon: UserCheck },
          { label: 'Present', value: present, color: '#10b981', icon: CheckCircle },
          { label: 'Late', value: late, color: '#f59e0b', icon: Clock },
          { label: 'Attendance Rate', value: rate, suffix: '%', color: '#6366f1', icon: AlertCircle },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wide">{card.label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}20`, color: card.color }}>
                <card.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]"><CountUp value={card.value} suffix={card.suffix} /></p>
          </div>
        ))}
      </div>

      {/* GPS Verification Info */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">GPS Verification Active</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Office: <strong>{settings.officeName}</strong> · Radius: <strong>{settings.radiusMeters}m</strong> ·
            Virtual check-in: <strong>{settings.allowVirtual ? 'Allowed' : 'Disabled'}</strong>
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Within {settings.radiusMeters}m = Physical · Outside = Virtual (if enabled) · No GPS = Fail
          </p>
        </div>
        <button onClick={() => setShowSettings(true)}
          className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer shrink-0">
          Edit Settings
        </button>
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..."
            className="bg-transparent border-none outline-none text-[var(--text-primary)] text-xs w-full" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs">
          {['All', 'PRESENT', 'LATE'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => exportToCSV(filtered, ['id', 'fullName', 'checkInTime', 'status'], 'attendance_export')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--border)] rounded-xl hover:opacity-80 cursor-pointer transition-opacity">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] font-semibold">
                <th className="py-3 px-4 text-left">Staff ID</th>
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-left">Check-In Time</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-[var(--accent-light)] transition-colors">
                  <td className="py-3 px-4 font-mono text-[var(--text-muted)] font-bold">{r.id}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${r.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {r.fullName[0]}
                      </div>
                      <span className="font-semibold text-[var(--text-primary)]">{r.fullName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{r.checkInTime}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
                      className="w-7 h-7 inline-flex items-center justify-center bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {menuOpen === r.id && (
                      <div className="absolute right-4 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                        <button onClick={() => { setEditRec(r); setEditStatus(r.status); setEditTime(r.checkInTime); setMenuOpen(null); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors cursor-pointer">
                          <Edit2 className="w-3.5 h-3.5" /> Edit Log
                        </button>
                        <button onClick={() => handleDuplicate(r)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors cursor-pointer">
                          <Copy className="w-3.5 h-3.5" /> Duplicate Log
                        </button>
                        <button onClick={() => handleShare(r)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors cursor-pointer">
                          <Share2 className="w-3.5 h-3.5" /> Share Link
                        </button>
                        <div className="h-px bg-[var(--border)] my-1" />
                        <button onClick={() => handleDelete(r.id)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" /> Delete Log
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-[var(--text-muted)] text-sm">No attendance records found</div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">Showing {filtered.length} of {records.length} records</p>
        </div>
      </div>

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />}

      {/* Edit modal */}
      {editRec && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Edit Attendance Log</h3>
              <button onClick={() => setEditRec(null)} className="text-[var(--text-muted)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">{editRec.fullName}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1 font-semibold">Check-In Time</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1.5 font-semibold">Status</label>
                <div className="flex gap-2">
                  {(['PRESENT', 'LATE'] as const).map(s => (
                    <button key={s} onClick={() => setEditStatus(s)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${editStatus === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEditRec(null)} disabled={submitting} className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleEditSave} disabled={submitting} className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Add Attendance Log</h3>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Full Name</label>
                <input value={addForm.fullName} onChange={e => setAddForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Check-In Time</label>
                <input type="time" value={addForm.checkInTime} onChange={e => setAddForm(p => ({ ...p, checkInTime: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Status</label>
                <div className="flex gap-2">
                  {(['PRESENT', 'LATE'] as const).map(s => (
                    <button key={s} onClick={() => setAddForm(p => ({ ...p, status: s }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer ${addForm.status === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border)]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} disabled={submitting} className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleAdd} disabled={submitting} className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50">{submitting ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Workplace Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--accent)]" /> Workplace Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-[var(--text-muted)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Office Name</label>
                <input value={settings.officeName} onChange={e => setSettings(p => ({ ...p, officeName: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Latitude</label>
                  <input type="number" step="0.0001" value={settings.lat} onChange={e => setSettings(p => ({ ...p, lat: parseFloat(e.target.value) }))}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Longitude</label>
                  <input type="number" step="0.0001" value={settings.lng} onChange={e => setSettings(p => ({ ...p, lng: parseFloat(e.target.value) }))}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Check-In Radius (meters)</label>
                <input type="number" value={settings.radiusMeters} onChange={e => setSettings(p => ({ ...p, radiusMeters: parseInt(e.target.value) }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none" />
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Allow Virtual Check-In</p>
                  <p className="text-xs text-[var(--text-muted)]">Employees outside radius can check in as Virtual</p>
                </div>
                <button onClick={() => setSettings(p => ({ ...p, allowVirtual: !p.allowVirtual }))}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.allowVirtual ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${settings.allowVirtual ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-3">
              Rule: Within {settings.radiusMeters}m = Physical · Outside = Virtual (if enabled) · No GPS = Fail
            </p>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] cursor-pointer">Cancel</button>
              <button onClick={handleSaveSettings} className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-xl font-semibold cursor-pointer">Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
