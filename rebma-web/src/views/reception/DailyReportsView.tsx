// src/views/reception/DailyReportsView.tsx
import { useState } from 'react';
import {
  FileText, Printer, Download, Calendar, Users, UserCheck, TrendingUp,
  Mail, X, Send, Eye, ChevronRight
} from 'lucide-react';
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

const STAFF_EMAILS = [
  'ceo@rebmaimpex.com', 'hr@rebmaimpex.com', 'finance@rebmaimpex.com',
  'operations@rebmaimpex.com', 'management@rebmaimpex.com',
];

interface Props { addNotification: (msg: string) => void }

export default function DailyReportsView({ addNotification }: Props) {
  const today = new Date().toISOString().slice(0,10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [viewingPast, setViewingPast] = useState<typeof PAST_REPORTS[0] | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailSearch, setEmailSearch] = useState('');
  const [emailTo, setEmailTo] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isToday = selectedDate === today;
  const totalPresent = DEPTS.reduce((s, d) => s + d.present, 0);
  const totalStaff = DEPTS.reduce((s, d) => s + d.total, 0);
  const attendanceRate = Math.round((totalPresent / totalStaff) * 100);

  const handleExportPDF = () => {
    exportToPDF(`Daily Report — ${selectedDate}`, VISITORS_TODAY, ['id','name','company','purpose','host','in','out']);
    addNotification('Daily report exported as PDF.');
  };

  const handleOpenEmailModal = () => {
    setEmailSubject(`Daily Reception Report — ${selectedDate}`);
    setEmailMessage(`Hello,\n\nPlease find today's reception summary:\n\n• Total Visitors: ${VISITORS_TODAY.length}\n• Staff Present: ${totalPresent}/${totalStaff} (${attendanceRate}%)\n• Check-outs: ${VISITORS_TODAY.filter(v => v.out).length}\n\nThis report was generated automatically by REBMA IMPEX ERP.\n\nReception Team`);
    setEmailModal(true);
  };

  const handleSendEmail = () => {
    if (!emailTo.length) { addNotification('Please select at least one recipient'); return; }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setEmailModal(false);
      setEmailTo([]);
      addNotification(`Report emailed to ${emailTo.length} recipient${emailTo.length > 1 ? 's' : ''}`);
    }, 1500);
  };

  const toggleEmailRecipient = (email: string) => {
    setEmailTo(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };

  const filteredEmails = STAFF_EMAILS.filter(e => e.includes(emailSearch.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Daily Reports</h2>
          <p className="text-xs text-[var(--text-muted)]">Auto-generated daily summary</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setViewingPast(null); }}
            className="px-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none" />
          <button onClick={handleOpenEmailModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
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

      {/* Past Reports - Better Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Past Reports — Last 7 Days</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                {['Date', 'Visitors', 'Attendance Rate', 'Check-ins', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[var(--text-muted)] font-semibold uppercase text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PAST_REPORTS.map((r, i) => (
                <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                    {new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.visitors}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden max-w-20">
                        <div className={`h-1.5 rounded-full ${r.attendanceRate >= 95 ? 'bg-emerald-500' : r.attendanceRate >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${r.attendanceRate}%` }} />
                      </div>
                      <span className="text-[var(--text-muted)]">{r.attendanceRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.checkins}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedDate(r.date); setViewingPast(r); }}
                        className="flex items-center gap-1 px-2 py-1 bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-semibold rounded-lg cursor-pointer hover:opacity-90">
                        <Eye className="w-3 h-3" /> View
                      </button>
                      <button onClick={() => exportToPDF(`Daily Report ${r.date}`, VISITORS_TODAY, ['id','name','company','purpose','host','in','out'])}
                        className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-input)] text-[var(--text-secondary)] text-[10px] font-semibold rounded-lg cursor-pointer hover:bg-[var(--accent-light)] border border-[var(--border)]">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--accent)]" /> Email Report
              </h3>
              <button onClick={() => setEmailModal(false)} className="cursor-pointer"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">To (select recipients)</label>
                <input value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Search email…"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none mb-1" />
                <div className="space-y-1 max-h-32 overflow-y-auto border border-[var(--border)] rounded-xl p-2 bg-[var(--bg)]">
                  {filteredEmails.map(e => (
                    <label key={e} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer">
                      <input type="checkbox" checked={emailTo.includes(e)} onChange={() => toggleEmailRecipient(e)} className="accent-[var(--accent)]" />
                      <span className="text-xs text-[var(--text-secondary)]">{e}</span>
                    </label>
                  ))}
                </div>
                {emailTo.length > 0 && (
                  <p className="text-[10px] text-[var(--accent)] mt-1">{emailTo.length} recipient{emailTo.length > 1 ? 's' : ''} selected</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">Subject</label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">Message</label>
                <textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} rows={5}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEmailModal(false)} className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] cursor-pointer">Cancel</button>
              <button onClick={handleSendEmail} disabled={sending || !emailTo.length}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
