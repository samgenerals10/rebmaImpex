import { useState } from 'react';
import type { Visitor } from '../types/erp';
import { FileSpreadsheet, FileText, Users, ShieldCheck, Activity, Clock, ChevronRight, MoreVertical, TrendingUp, TrendingDown } from 'lucide-react';
import MiniSparkline from '../components/MiniSparkline';
import PendingApprovalsAlert from '../components/global/PendingApprovalsAlert';
import KpiDetailView from '../components/KpiDetailView';
import { exportToCSV, exportToPDF } from '../utils/export';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

interface ReceptionDashboardProps {
  visitorsList: Visitor[];
  onAddVisitor: (e: React.FormEvent<HTMLFormElement>) => void;
  onCheckoutVisitor: (id: string) => void;
  onCheckInAttendance: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function ReceptionDashboard({
  visitorsList,
  onAddVisitor,
  onCheckoutVisitor,
  onCheckInAttendance
}: ReceptionDashboardProps) {

  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
  const [activeMobileDetail, setActiveMobileDetail] = useState<Visitor | null>(null);

  const lineChartData = [
    { name: 'Mon', CheckIns: 14, CheckOuts: 12 },
    { name: 'Tue', CheckIns: 19, CheckOuts: 18 },
    { name: 'Wed', CheckIns: 25, CheckOuts: 20 },
    { name: 'Thu', CheckIns: 12, CheckOuts: 12 },
    { name: 'Fri', CheckIns: 30, CheckOuts: 26 },
  ];

  const totalVisitorsCount = visitorsList.length;
  const activeVisitorsCount = visitorsList.filter(v => !v.checkOutTime).length;
  const completedVisitsCount = visitorsList.filter(v => v.checkOutTime).length;

  const stats = [
    { title: 'Total Daily Visitors', value: `${totalVisitorsCount} Logged`, sub: 'Arrival badge registry', icon: Users, color: 'text-blue-500' },
    { title: 'Active Visitors', value: `${activeVisitorsCount} On-Site`, sub: 'Currently in workspace', icon: Clock, color: 'text-emerald-500' },
    { title: 'Completed Visits', value: `${completedVisitsCount} Checked Out`, sub: 'Visits concluded successfully', icon: ShieldCheck, color: 'text-indigo-500' },
    { title: 'Visitor Safety Audits', value: '100% Passed', sub: 'ID credentials confirmed', icon: Activity, color: 'text-rose-500' }
  ];

  const kpiDetails = [
    { title: 'Total Daily Visitors', metric: 'Logged', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Business',value:18}, {name:'Personal',value:6}, {name:'Delivery',value:4}], tableData: [{name:'John Mensah', purpose:'Meeting', host:'Mr. Asante'}, {name:'Ama Boafo', purpose:'Delivery', host:'Reception'}], columns: [{key:'name',label:'Visitor'}, {key:'purpose',label:'Purpose'}, {key:'host',label:'Host'}] },
    { title: 'Active Visitors', metric: 'On-Site', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Active',value:8}, {name:'Checked Out',value:14}, {name:'Expected',value:3}], tableData: [{name:'David Larbi', in:'09:30 AM', location:'Floor 2'}, {name:'Grace Oti', in:'10:15 AM', location:'Boardroom'}], columns: [{key:'name',label:'Visitor'}, {key:'in',label:'Check-In'}, {key:'location',label:'Location'}] },
    { title: 'Completed Visits', metric: 'Checked Out', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Completed',value:14}, {name:'Overstay',value:1}, {name:'No-Show',value:2}], tableData: [{name:'John Mensah', in:'09:00 AM', out:'10:30 AM', duration:'1h 30m'}, {name:'Kofi Atta', in:'08:30 AM', out:'09:45 AM', duration:'1h 15m'}], columns: [{key:'name',label:'Visitor'}, {key:'in',label:'In'}, {key:'out',label:'Out'}, {key:'duration',label:'Duration'}] },
    { title: 'Visitor Safety Audits', metric: 'Passed', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Cleared',value:24}, {name:'Flagged',value:0}, {name:'Pending',value:1}], tableData: [{id:'AUD-01', visitor:'John Mensah', result:'Cleared', date:'Jun 12'}, {id:'AUD-02', visitor:'Ama Boafo', result:'Cleared', date:'Jun 12'}], columns: [{key:'id',label:'Audit'}, {key:'visitor',label:'Visitor'}, {key:'result',label:'Result'}, {key:'date',label:'Date'}] }
  ];


  const handleExportCSV = () => {
    exportToCSV(visitorsList, ['id', 'fullName', 'purpose', 'hostName', 'checkInTime', 'checkOutTime'], 'reception_visitors_log');
  };

  const handleExportPDF = () => {
    exportToPDF('Reception Visitor Logs', visitorsList, ['id', 'fullName', 'purpose', 'hostName', 'checkInTime', 'checkOutTime']);
  };

  if (activeMobileDetail) {
    return (
      <div className="lg:hidden bg-bg-card min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-text-primary">
        {/* Header with Back button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-bg-card dark:bg-slate-855 border border-[var(--border)] dark:border-slate-800 rounded-full text-xs font-bold text-text-secondary dark:text-slate-350 cursor-pointer shadow-card"
          >
            ← Back
          </button>
          <h2 className="text-sm font-bold">Visitor Details</h2>
        </div>

        <div className="space-y-6">
          <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-450 flex items-center justify-center font-bold text-xl shrink-0">
              {activeMobileDetail.fullName[0]}
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary dark:text-slate-205">{activeMobileDetail.fullName}</h3>
              <p className="text-xs text-text-muted font-mono mt-0.5">{activeMobileDetail.id}</p>
            </div>
          </div>

          <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Visitor Name</span>
              <span className="font-semibold text-text-primary dark:text-slate-205">{activeMobileDetail.fullName}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Purpose of Visit</span>
              <span className="font-semibold text-text-primary dark:text-slate-205">{activeMobileDetail.purpose}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Host Contact</span>
              <span className="font-semibold text-text-primary dark:text-slate-205">{activeMobileDetail.hostName}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Check-In Time</span>
              <span className="font-semibold text-text-primary dark:text-slate-205 font-mono">{activeMobileDetail.checkInTime}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Check-Out Time</span>
              <span className="font-semibold text-text-primary dark:text-slate-250 font-mono">{activeMobileDetail.checkOutTime || 'Still On-Site'}</span>
            </div>
          </div>

          {!activeMobileDetail.checkOutTime && (
            <button 
              onClick={() => { onCheckoutVisitor(activeMobileDetail.id); setActiveMobileDetail(null); }}
              className="w-full py-3 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer shadow"
            >
              Checkout Visitor
            </button>
          )}
        </div>
      </div>
    );
  }


  if (kpiDetail !== null) {
    const d = kpiDetails[kpiDetail];
    return <KpiDetailView title={d.title} metric={d.metric} trendData={d.trendData} breakdownData={d.breakdownData} tableData={d.tableData} columns={d.columns} onBack={() => setKpiDetail(null)} />;
  }
  return (
    <>
      {/* ══════════════ MOBILE LAYOUT (< lg) ══════════════ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Front-desk</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Visitor & staff check-in logs</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export CSV">
              <FileSpreadsheet className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={handleExportPDF} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export PDF">
              <FileText className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Physical hero card — visitor count */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0f172a 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Today's Visitors</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{totalVisitorsCount} Logged</h2>
              <p className="text-[10px] text-white/70 mt-1">{activeVisitorsCount} On-Site • {completedVisitsCount} Checked Out</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">100% Safety Passed</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">ID Credentials Confirmed</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Active On-Site', value: `${activeVisitorsCount}`, sub: 'Currently in workspace', bg: '#f0fdf4', color: '#16a34a', icon: Users },
            { label: 'Completed', value: `${completedVisitsCount}`, sub: 'Visits concluded', bg: '#eef2ff', color: '#6366f1', icon: ShieldCheck },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="mobile-stat-card">
                <div className="mobile-stat-icon" style={{ background: s.bg }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider truncate">{s.label}</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.value}</p>
                  <p className="text-[9px] text-text-muted truncate">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visitor list */}
        <div>
          <p className="mobile-section-label">Active Visitors</p>
          <div className="space-y-2">
            {visitorsList.length === 0 ? (
              <div className="mobile-data-row justify-center">
                <p className="text-xs text-text-muted">No visitors logged today.</p>
              </div>
            ) : (
              visitorsList.map(v => (
                <div
                  key={v.id}
                  onClick={() => setActiveMobileDetail(v)}
                  className="mobile-data-row cursor-pointer"
                >
                  <div className="mobile-data-row-icon" style={{ background: v.checkOutTime ? '#f8fafc' : '#f0fdf4', color: v.checkOutTime ? '#94a3b8' : '#16a34a' }}>
                    {v.fullName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">{v.fullName}</p>
                    <p className="text-[10px] text-text-muted truncate">{v.purpose} — {v.hostName}</p>
                  </div>
                  <span className={`mobile-status-pill ${v.checkOutTime ? 'bg-slate-100 text-text-secondary' : 'bg-emerald-50 text-emerald-700'}`}>
                    {v.checkOutTime ? 'Done' : 'On-Site'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Log Visitor form */}
        <div>
          <p className="mobile-section-label">Log Visitor</p>
          <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4">
            <form onSubmit={onAddVisitor} className="space-y-3">
              <input type="text" name="visitor" required placeholder="Visitor Name" className="w-full px-3 py-2 bg-slate-50 border border-[var(--border)] rounded-xl text-xs focus:outline-none" />
              <input type="text" name="purpose" required placeholder="Visit Purpose" className="w-full px-3 py-2 bg-slate-50 border border-[var(--border)] rounded-xl text-xs focus:outline-none" />
              <input type="text" name="host" required placeholder="Host Contact" className="w-full px-3 py-2 bg-slate-50 border border-[var(--border)] rounded-xl text-xs focus:outline-none" />
              <button type="submit" className="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold cursor-pointer">Check In Visitor</button>
            </form>
          </div>
        </div>

        {/* Staff check-in kiosk */}
        <div>
          <p className="mobile-section-label">Staff Kiosk</p>
          <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4">
            <form onSubmit={onCheckInAttendance} className="space-y-3">
              <input type="text" name="name" required placeholder="Employee Name" className="w-full px-3 py-2 bg-slate-50 border border-[var(--border)] rounded-xl text-xs focus:outline-none" />
              <button type="submit" className="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold cursor-pointer">Check In Employee</button>
            </form>
          </div>
        </div>
      </div>

      {/* ══════════════ DESKTOP LAYOUT (lg+) — UNCHANGED ══════════════ */}
      <div className="hidden lg:block">
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[var(--text-primary)]">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Front-desk Terminal</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] opacity-85">Check-in daily staff and visitor logs.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Logs (CSV)</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Logs (PDF)</span>
          </button>
        </div>
      </div>

      {/* Pending approvals alert */}
      <PendingApprovalsAlert department="RECEPTION" />

      {/* Stats KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} onClick={() => setKpiDetail(idx)} className="kpi-card group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setCardMenuOpen(cardMenuOpen === idx ? null : idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-[var(--accent-light)]">
                    <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                  {cardMenuOpen === idx && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                      <button onClick={() => { setKpiDetail(idx); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">View Details</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToCSV(d.tableData, d.columns.map(c => c.key), d.title.replace(/\s/g,'_').toLowerCase()); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export CSV</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToPDF(d.title, d.tableData, d.columns.map(c => c.label)); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export PDF</button>
                      <button onClick={() => setCardMenuOpen(null)} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Refresh</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between mt-2 gap-2">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none">{card.value}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{card.sub}</p>
                </div>
                <MiniSparkline width={60} height={36} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Performance Chart */}
      <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] flex flex-col justify-between text-[var(--text-primary)]">
        <div>
          <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Front-desk Traffic Metrics</h3>
          <p className="text-xs text-[var(--text-secondary)] opacity-80">Weekly visitor check-ins vs check-out logs.</p>
        </div>
        <div className="h-48 md:h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="CheckIns" stroke="var(--accent)" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="CheckOuts" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visitor Log form */}
        <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
          <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Log Visitor Arrival</h3>
          <form onSubmit={onAddVisitor} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Visitor Name</label>
              <input 
                type="text" 
                name="visitor"
                required 
                placeholder="Grace Mensah"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Visit Purpose</label>
              <input 
                type="text" 
                name="purpose"
                required 
                placeholder="Supplier meeting"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Host Contact</label>
              <input 
                type="text" 
                name="host"
                required 
                placeholder="Manager Frank"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-opacity"
            >
              Check In Visitor
            </button>
          </form>
        </div>

        {/* Active Visitors logs */}
        <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
          <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Checked-in Visitors</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {visitorsList.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] opacity-85">No visitors logged today.</p>
            ) : (
              visitorsList.map(v => (
                <div 
                  key={v.id} 
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setActiveMobileDetail(v);
                    }
                  }}
                  className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">{v.fullName}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-85">Host: <strong>{v.hostName}</strong> | Purpose: {v.purpose}</p>
                    <p className="text-[9px] text-[var(--text-secondary)] opacity-80 mt-1">In: {v.checkInTime} {v.checkOutTime && `| Out: ${v.checkOutTime}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${v.checkOutTime ? 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {v.checkOutTime ? 'Completed' : 'On-Site'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted lg:hidden" />
                    {!v.checkOutTime && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onCheckoutVisitor(v.id); }}
                        className="hidden lg:block px-2 py-1 bg-red-50 text-red-600 font-bold rounded text-[10px] cursor-pointer hover:bg-red-100 border border-red-200"
                      >
                        Checkout
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Attendance check-in desk */}
        <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
          <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Staff check-in Kiosk</h3>
          <form onSubmit={onCheckInAttendance} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Employee Name</label>
              <input 
                type="text" 
                name="name"
                required 
                placeholder="Michael Osei"
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-opacity"
            >
              Check In Employee
            </button>
          </form>
        </div>

      </div>
      </div>
      </div>
    </>
  );
}
