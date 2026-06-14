import React, { useState, useEffect } from 'react';
import {
  Plus, Search, X, LogOut, Eye, Users, UserCheck, UserMinus, Clock,
  MoreVertical, Printer, Download, CheckCircle, AlertCircle, FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToPDF } from '../../utils/export';
import type { Visitor } from '../../types/erp';

const MOCK_VISITORS: (Visitor & { company?: string; badgeNumber: string; expectedTime?: string; idType?: string; idNumber?: string; notes?: string })[] = [
  { id: '1', fullName: 'Emmanuel Quaye', company: 'TechHub Ghana', purpose: 'Business Meeting', hostName: 'Kwame Mensah', checkInTime: '2026-06-12T08:30:00', badgeNumber: 'V-001' },
  { id: '2', fullName: 'Serwa Asiedu', company: 'AfriBank Ltd', purpose: 'Finance Review', hostName: 'Abena Owusu', checkInTime: '2026-06-12T09:10:00', checkOutTime: '2026-06-12T10:45:00', badgeNumber: 'V-002' },
  { id: '3', fullName: 'Bright Forson', company: 'Logistics Partners', purpose: 'Delivery', hostName: 'Kofi Asante', checkInTime: '2026-06-12T09:45:00', badgeNumber: 'V-003' },
  { id: '4', fullName: 'Patricia Mensah', company: 'Independent', purpose: 'Interview', hostName: 'Ama Boateng', checkInTime: '2026-06-12T10:00:00', checkOutTime: '2026-06-12T11:00:00', badgeNumber: 'V-004' },
  { id: '5', fullName: 'Daniel Appiah', company: 'Apex Supplies', purpose: 'Delivery', hostName: 'Nana Agyei', checkInTime: '2026-06-12T10:30:00', badgeNumber: 'V-005' },
  { id: '6', fullName: 'Grace Ntow', company: 'Gov Regulatory Office', purpose: 'Business Meeting', hostName: 'Maame Asare', checkInTime: '2026-06-12T11:00:00', badgeNumber: 'V-006' },
  { id: '7', fullName: 'Samuel Boadu', company: 'IT Solutions Ltd', purpose: 'Personal', hostName: 'Kwesi Ofori', checkInTime: '2026-06-12T11:30:00', checkOutTime: '2026-06-12T13:00:00', badgeNumber: 'V-007' },
  { id: '8', fullName: 'Felicia Osei', company: 'Creative Agency', purpose: 'Business Meeting', hostName: 'Yaw Darko', checkInTime: '2026-06-12T13:15:00', badgeNumber: 'V-008' },
  { id: '9', fullName: 'Kofi Bonsu', company: 'Construction Co.', purpose: 'Personal', hostName: 'Adwoa Sarpong', checkInTime: '2026-06-12T14:00:00', expectedTime: '2026-06-12T14:00:00', badgeNumber: 'V-009' },
  { id: '10', fullName: 'Akua Nkansah', company: 'Legal Associates', purpose: 'Business Meeting', hostName: 'Maame Asare', checkInTime: '2026-06-12T14:30:00', badgeNumber: 'V-010' },
];

type VisitorRecord = (typeof MOCK_VISITORS)[0];

const fmt = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

const PURPOSE_BADGE: Record<string, { bg: string; color: string }> = {
  'Business Meeting': { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  'Delivery':         { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  'Personal':         { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  'Interview':        { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
};
const purposeStyle = (p: string) => PURPOSE_BADGE[p] || { bg: 'rgba(100,116,139,0.12)', color: '#64748b' };

const VISITOR_PASS_HTML = (v: VisitorRecord) => `
  <html><head><style>
    body { font-family: Arial, sans-serif; padding: 24px; max-width: 400px; margin: auto; }
    .badge { border: 2px solid #333; border-radius: 12px; padding: 24px; }
    h2 { margin: 0 0 4px; font-size: 20px; }
    p { margin: 4px 0; font-size: 13px; color: #555; }
    .badge-num { font-size: 28px; font-weight: 900; color: #0268c5; letter-spacing: 2px; margin: 12px 0; }
    .label { font-size: 10px; text-transform: uppercase; color: #999; font-weight: 600; }
    hr { border: 1px solid #eee; margin: 12px 0; }
    @media print { body { padding: 0; } }
  </style></head>
  <body><div class="badge">
    <div class="label">REBMA IMPEX — VISITOR PASS</div>
    <div class="badge-num">${v.badgeNumber}</div>
    <hr/>
    <div class="label">Name</div>
    <h2>${v.fullName}</h2>
    <div class="label">Company</div>
    <p>${v.company || '—'}</p>
    <div class="label">Purpose</div>
    <p>${v.purpose}</p>
    <div class="label">Host</div>
    <p>${v.hostName}</p>
    <div class="label">Check-In</div>
    <p>${fmt(v.checkInTime)}</p>
  </div></body></html>
`;

function printVisitorPass(v: VisitorRecord) {
  const win = window.open('', '_blank', 'width=500,height=700');
  if (!win) return;
  win.document.write(VISITOR_PASS_HTML(v));
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

interface Props { addNotification: (msg: string) => void }

export default function VisitorsView({ addNotification }: Props) {
  const [visitors, setVisitors] = useState<VisitorRecord[]>(MOCK_VISITORS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [purposeFilter, setPurposeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('2026-06-12');
  const [showAdd, setShowAdd] = useState(false);
  const [detailVisitor, setDetailVisitor] = useState<VisitorRecord | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '', company: '', purpose: 'Business Meeting', hostName: '',
    expectedTime: '', idType: 'Ghana Card', idNumber: '', notes: '',
  });

  useEffect(() => {
    supabase.from('visitors').select('*').then(({ data, error }) => {
      if (!error && data && data.length > 0) setVisitors(data as VisitorRecord[]);
    });
  }, []);

  const todayVisitors = visitors.filter(v => v.checkInTime.startsWith(dateFilter));
  const currentlyIn = todayVisitors.filter(v => !v.checkOutTime).length;
  const checkedOut = todayVisitors.filter(v => !!v.checkOutTime).length;
  const expected = visitors.filter(v => v.expectedTime && v.expectedTime.startsWith(dateFilter) && !v.checkInTime).length;

  const filtered = todayVisitors.filter(v => {
    const matchSearch = v.fullName.toLowerCase().includes(search.toLowerCase()) || v.hostName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || (statusFilter === 'Checked In' && !v.checkOutTime) || (statusFilter === 'Checked Out' && !!v.checkOutTime);
    const matchPurpose = purposeFilter === 'All' || v.purpose === purposeFilter;
    return matchSearch && matchStatus && matchPurpose;
  });

  const handleCheckOut = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('visitors').update({ checkOutTime: now }).eq('id', id);
    setVisitors(prev => prev.map(v => v.id === id ? { ...v, checkOutTime: now } : v));
    addNotification('Visitor checked out');
  };

  const handleAdd = async () => {
    if (!form.fullName.trim()) return;
    const newVisitor: VisitorRecord = {
      id: Date.now().toString(),
      fullName: form.fullName,
      company: form.company,
      purpose: form.purpose,
      hostName: form.hostName,
      checkInTime: new Date().toISOString(),
      expectedTime: form.expectedTime || undefined,
      badgeNumber: `V-${String(visitors.length + 1).padStart(3, '0')}`,
      idType: form.idType,
      idNumber: form.idNumber,
      notes: form.notes,
    };
    const { error } = await supabase.from('visitors').insert([newVisitor]);
    setVisitors(prev => [newVisitor, ...prev]);
    supabase.from('supplier_order_notifications').insert([{
      order_id: newVisitor.id,
      message: `Visitor ${form.fullName} (${form.purpose}) has arrived to see ${form.hostName}. Badge: ${newVisitor.badgeNumber}`,
      notified_department: 'ALL',
      read: false,
      created_at: new Date().toISOString(),
    }]).then(() => {}, () => {});
    addNotification(`Visitor ${form.fullName} checked in — Badge: ${newVisitor.badgeNumber}`);
    setShowAdd(false);
    setForm({ fullName: '', company: '', purpose: 'Business Meeting', hostName: '', expectedTime: '', idType: 'Ghana Card', idNumber: '', notes: '' });
    if (error) console.error(error);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Visitor Registry</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Track and manage visitor access</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToPDF('Visitor Report', filtered, ['badgeNumber','fullName','company','purpose','hostName','checkInTime','checkOutTime'])}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold rounded-xl cursor-pointer hover:bg-[var(--accent-light)]">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Check In Visitor
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Visitors", value: todayVisitors.length, color: 'var(--accent)', icon: Users },
          { label: 'Currently Inside', value: currentlyIn, color: '#10b981', icon: UserCheck },
          { label: 'Checked Out', value: checkedOut, color: '#64748b', icon: UserMinus },
          { label: 'Expected', value: expected, color: '#f59e0b', icon: Clock },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${card.color}20`, color: card.color }}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 flex-1 min-w-44">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or host..."
            className="bg-transparent border-none outline-none text-[var(--text-primary)] text-xs w-full" />
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none cursor-pointer">
          {['All', 'Checked In', 'Checked Out'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={purposeFilter} onChange={e => setPurposeFilter(e.target.value)}
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none cursor-pointer">
          {['All', 'Business Meeting', 'Delivery', 'Personal', 'Interview', 'Other'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 750 }}>
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                {['Badge', 'Name', 'Company', 'Purpose', 'Host', 'Check-In', 'Check-Out', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[var(--text-muted)] font-semibold uppercase text-[10px] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const onSite = !v.checkOutTime;
                const ps = purposeStyle(v.purpose);
                return (
                  <tr key={v.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
                    onClick={() => setDetailVisitor(v)}>
                    <td className="px-4 py-3 text-[var(--accent)] font-bold whitespace-nowrap">{v.badgeNumber}</td>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-semibold whitespace-nowrap">{v.fullName}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{v.company || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: ps.bg, color: ps.color }}>{v.purpose}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{v.hostName}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono whitespace-nowrap">{fmt(v.checkInTime)}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] font-mono whitespace-nowrap">{v.checkOutTime ? fmt(v.checkOutTime) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${onSite ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
                        {onSite ? 'On Site' : 'Left'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === v.id ? null : v.id)}
                          className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpen === v.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1">
                            <button onClick={() => { setDetailVisitor(v); setMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                            {onSite && (
                              <button onClick={() => { handleCheckOut(v.id); setMenuOpen(null); }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-amber-600 hover:bg-amber-500/10 rounded-lg cursor-pointer">
                                <LogOut className="w-3.5 h-3.5" /> Check Out
                              </button>
                            )}
                            <button onClick={() => { printVisitorPass(v); setMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                              <Printer className="w-3.5 h-3.5" /> Print Visitor Pass
                            </button>
                            <button onClick={() => { exportToPDF('Visitor Record', [v], ['badgeNumber','fullName','company','purpose','hostName','checkInTime','checkOutTime']); setMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                              <Download className="w-3.5 h-3.5" /> Export PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[var(--text-muted)] text-sm">No visitors found</div>
        )}
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)]">
          <p className="text-[10px] text-[var(--text-muted)]">Showing {filtered.length} of {todayVisitors.length} visitors</p>
        </div>
      </div>

      {/* Add Visitor Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">Check In Visitor</h3>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'fullName', label: 'Full Name *', placeholder: 'Visitor full name' },
                { key: 'company', label: 'Company / Organization', placeholder: 'Company name' },
                { key: 'hostName', label: 'Host (Staff Name) *', placeholder: 'Staff to visit' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent)]" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">Purpose *</label>
                <select value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none">
                  {['Business Meeting', 'Delivery', 'Personal', 'Interview', 'Other'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">ID Type</label>
                  <select value={form.idType} onChange={e => setForm(p => ({ ...p, idType: e.target.value }))}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none">
                    {['Ghana Card', 'Passport', 'Driver License', 'Voter ID', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">ID Number</label>
                  <input value={form.idNumber} onChange={e => setForm(p => ({ ...p, idNumber: e.target.value }))} placeholder="GHA-123..."
                    className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">Expected Duration</label>
                <input type="datetime-local" value={form.expectedTime} onChange={e => setForm(p => ({ ...p, expectedTime: e.target.value }))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] cursor-pointer">Cancel</button>
              <button onClick={handleAdd} disabled={!form.fullName.trim() || !form.hostName.trim()}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90 disabled:opacity-50">
                Check In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailVisitor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Visitor Details</p>
                <h3 className="font-bold text-[var(--text-primary)] text-lg leading-tight">{detailVisitor.fullName}</h3>
                <span className="text-xs font-bold text-[var(--accent)]">{detailVisitor.badgeNumber}</span>
              </div>
              <button onClick={() => setDetailVisitor(null)} className="text-[var(--text-muted)] cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {/* Timeline */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 text-xs">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[var(--text-muted)]">Checked in</p>
                  <p className="font-semibold text-[var(--text-primary)]">{fmt(detailVisitor.checkInTime)}</p>
                </div>
              </div>
              {detailVisitor.checkOutTime && (
                <div className="flex items-center gap-3 text-xs">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[var(--text-muted)]">Checked out</p>
                    <p className="font-semibold text-[var(--text-primary)]">{fmt(detailVisitor.checkOutTime)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs mb-4">
              {[
                { label: 'Company', value: detailVisitor.company || '—' },
                { label: 'Purpose', value: detailVisitor.purpose },
                { label: 'Host', value: detailVisitor.hostName },
                ...(detailVisitor.idType ? [{ label: 'ID Type', value: detailVisitor.idType }] : []),
                ...(detailVisitor.idNumber ? [{ label: 'ID Number', value: detailVisitor.idNumber }] : []),
                ...(detailVisitor.notes ? [{ label: 'Notes', value: detailVisitor.notes }] : []),
              ].map(item => (
                <div key={item.label} className="flex justify-between py-1.5 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">{item.label}</span>
                  <span className="text-[var(--text-primary)] font-medium text-right max-w-40">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { printVisitorPass(detailVisitor); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold cursor-pointer hover:bg-[var(--accent-light)]">
                <Printer className="w-3.5 h-3.5" /> Print Pass
              </button>
              {!detailVisitor.checkOutTime && (
                <button onClick={() => { handleCheckOut(detailVisitor.id); setDetailVisitor(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90">
                  <LogOut className="w-3.5 h-3.5" /> Check Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
