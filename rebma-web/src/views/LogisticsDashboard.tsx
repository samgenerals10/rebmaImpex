// rebma-web/src/views/LogisticsDashboard.tsx

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import { useState } from 'react';
import { FileSpreadsheet, FileText, Truck, Settings, Activity, ShieldCheck, MoreVertical, TrendingUp, TrendingDown } from 'lucide-react';
import MiniSparkline from '../components/MiniSparkline';
import KpiDetailView from '../components/KpiDetailView';
import { exportToCSV, exportToPDF } from '../utils/export';

export default function LogisticsDashboard() {
  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
  const chartData = [
    { name: 'TRK-201', Fuel: 8.2, Maintenance: 120 },
    { name: 'TRK-202', Fuel: 7.9, Maintenance: 350 },
    { name: 'TRK-203', Fuel: 9.1, Maintenance: 0 },
    { name: 'TRK-204', Fuel: 8.8, Maintenance: 90 },
    { name: 'TRK-205', Fuel: 8.4, Maintenance: 180 }
  ];

  const lineChartData = [
    { name: 'Mon', Distance: 250, Fuel: 50 },
    { name: 'Tue', Distance: 400, Fuel: 85 },
    { name: 'Wed', Distance: 350, Fuel: 70 },
    { name: 'Thu', Distance: 600, Fuel: 120 },
    { name: 'Fri', Distance: 450, Fuel: 90 },
  ];

  const maintenanceSchedule = [
    { id: 'TRK-201', type: 'Oil & Filter Change', status: 'Operational', date: 'May 10, 2026', cost: 120 },
    { id: 'TRK-202', type: 'Brake Pad Replacement', status: 'In Service', date: 'May 22, 2026', cost: 350 },
    { id: 'TRK-205', type: 'Tire Rotation & Balance', status: 'Operational', date: 'May 18, 2026', cost: 180 }
  ];

  const stats = [
    { title: 'Total Fleet Vehicles', value: '12 Trucks', sub: '10 Operational | 2 In Shop', icon: Truck, color: 'text-blue-500', iconBg: '#eff6ff', iconColor: '#3b82f6' },
    { title: 'Monthly Fuel Efficiency', value: '8.5 km/L', sub: 'Optimal target threshold met', icon: Activity, color: 'text-emerald-500', iconBg: '#f0fdf4', iconColor: '#22c55e' },
    { title: 'Maintenance Pending', value: '2 Actions', sub: 'Awaiting scheduled service', icon: Settings, color: 'text-amber-500', iconBg: '#fefce8', iconColor: '#f59e0b' },
    { title: 'Completed Shipments', value: '142 Logs', sub: '98.6% on-time delivery rate', icon: ShieldCheck, color: 'text-indigo-500', iconBg: '#eef2ff', iconColor: '#6366f1' }
  ];

  const kpiDetails = [
    { title: 'Total Fleet Vehicles', metric: '12 Trucks', trendData: [{name:'Jan',value:12},{name:'Feb',value:12},{name:'Mar',value:11},{name:'Apr',value:13},{name:'May',value:12},{name:'Jun',value:12}], breakdownData: [{name:'Operational',value:10},{name:'In Service',value:2},{name:'Idle',value:0}], tableData: [{id:'TRK-201',model:'Mercedes Actros',status:'Operational'},{id:'TRK-202',model:'Volvo FH16',status:'In Service'},{id:'TRK-203',model:'MAN TGX',status:'Operational'}], columns: [{key:'id',label:'Truck ID'},{key:'model',label:'Model'},{key:'status',label:'Status'}] },
    { title: 'Monthly Fuel Efficiency', metric: '8.5 km/L', trendData: [{name:'Jan',value:8.1},{name:'Feb',value:8.3},{name:'Mar',value:8.0},{name:'Apr',value:8.5},{name:'May',value:8.4},{name:'Jun',value:8.5}], breakdownData: [{name:'Excellent',value:5},{name:'Good',value:4},{name:'Poor',value:3}], tableData: [{id:'TRK-201',efficiency:'8.2 km/L',month:'Jun'},{id:'TRK-202',efficiency:'7.9 km/L',month:'Jun'},{id:'TRK-203',efficiency:'9.1 km/L',month:'Jun'}], columns: [{key:'id',label:'Truck'},{key:'efficiency',label:'Efficiency'},{key:'month',label:'Month'}] },
    { title: 'Maintenance Pending', metric: '2 Actions', trendData: [{name:'Jan',value:3},{name:'Feb',value:2},{name:'Mar',value:4},{name:'Apr',value:2},{name:'May',value:3},{name:'Jun',value:2}], breakdownData: [{name:'Oil Change',value:1},{name:'Brake Service',value:1},{name:'Tire',value:0}], tableData: [{id:'TRK-202',type:'Brake Pad Replacement',due:'Jun 20'},{id:'TRK-205',type:'Tire Rotation',due:'Jun 22'}], columns: [{key:'id',label:'Truck'},{key:'type',label:'Service Type'},{key:'due',label:'Due Date'}] },
    { title: 'Completed Shipments', metric: '142 Logs', trendData: [{name:'Jan',value:22},{name:'Feb',value:28},{name:'Mar',value:24},{name:'Apr',value:30},{name:'May',value:20},{name:'Jun',value:18}], breakdownData: [{name:'On Time',value:138},{name:'Late',value:4},{name:'Cancelled',value:0}], tableData: [{id:'SHP-01',client:'Kama Industries',date:'Jun 10',status:'On Time'},{id:'SHP-02',client:'Accra Traders',date:'Jun 9',status:'On Time'}], columns: [{key:'id',label:'Shipment'},{key:'client',label:'Client'},{key:'date',label:'Date'},{key:'status',label:'Status'}] },
  ];

  const handleExportCSV = () => {
    exportToCSV(maintenanceSchedule, ['id', 'type', 'status', 'date', 'cost'], 'logistics_maintenance_schedule');
  };

  const handleExportPDF = () => {
    exportToPDF('Logistics Fleet Maintenance Schedule', maintenanceSchedule, ['id', 'type', 'status', 'date', 'cost']);
  };

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
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Logistics Panel</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Fleet maintenance & supply chain metrics</p>
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

        {/* Physical hero card — fleet */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Fleet Operations</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">12 Trucks</h2>
              <p className="text-[10px] text-white/70 mt-1">10 Operational • 2 In Shop</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">142 shipments completed</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">98.6% On-time Delivery</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Fuel Efficiency', value: '8.5 km/L', sub: 'Optimal', bg: '#f0fdf4', color: '#22c55e', icon: Activity },
            { label: 'Maintenance', value: '2 Pending', sub: 'Awaiting', bg: '#fefce8', color: '#f59e0b', icon: Settings },
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
                  <p className="text-[9px] text-text-muted">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Maintenance schedule list */}
        <div>
          <p className="mobile-section-label">Maintenance Schedule</p>
          <div className="space-y-2">
            {maintenanceSchedule.map((log, idx) => (
              <div key={idx} className="mobile-data-row">
                <div className="mobile-data-row-icon" style={{ background: log.status === 'Operational' ? '#f0fdf4' : '#fefce8', color: log.status === 'Operational' ? '#16a34a' : '#d97706' }}>
                  <Truck className="w-5 h-5" style={{ color: log.status === 'Operational' ? '#16a34a' : '#d97706' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{log.id}</p>
                  <p className="text-[10px] text-text-muted truncate">{log.type}</p>
                  <p className="text-[9px] text-text-muted">{log.date} • <strong>${log.cost}</strong></p>
                </div>
                <span className={`mobile-status-pill ${log.status === 'Operational' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini fleet performance chart */}
        <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4">
          <h3 className="text-xs font-bold text-text-primary mb-1">Fleet Performance</h3>
          <p className="text-[10px] text-text-muted mb-3">Weekly distance vs fuel</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Distance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Fuel" stroke="#068d5c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel & Maintenance bar chart */}
        <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4">
          <h3 className="text-xs font-bold text-text-primary mb-3">Fuel & Maintenance by Truck</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="Fuel" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Maintenance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══════════════ DESKTOP LAYOUT (lg+) — UNCHANGED ══════════════ */}
      <div className="hidden lg:block">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Logistics Control Panel</h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">Manage fleet maintenance records and monitor supply chain metrics.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Maintenance (CSV)</span>
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export Maintenance (PDF)</span>
              </button>
            </div>
          </div>

          {/* Stats KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {stats.map((card, idx) => {
              const sparkData = [[30,45,35,60,40,70,55],[25,38,28,50,33,55,42],[40,52,38,62,44,68,50],[15,25,20,35,25,40,30]][idx] || [40,50,45,60,55,65,50];
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
                      <p className="flex items-center gap-0.5 text-[10px] font-semibold mt-1.5 text-emerald-500">
                        <TrendingUp className="w-3 h-3" />{card.sub}
                      </p>
                    </div>
                    <MiniSparkline data={sparkData} color="var(--accent)" width={60} height={36} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance Chart */}
          <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] flex flex-col justify-between">
            <div>
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Logistics Fleet Performance</h3>
              <p className="text-xs text-[var(--text-muted)]">Weekly fleet distance logs vs fuel usage metrics.</p>
            </div>
            <div className="h-48 md:h-60 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="Distance" stroke="var(--accent)" strokeWidth={2.5} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="Fuel" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Fleet Maintenance Logs */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Fleet Maintenance Schedule</h3>
              <div className="space-y-3">
                {maintenanceSchedule.map((log, idx) => (
                  <div key={idx} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{log.id} - {log.type}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Service Date: {log.date} | Cost: <strong>${log.cost}</strong></p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                      log.status === 'Operational' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>{log.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supply Chain Performance charts */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Fuel Efficiency & Maintenance Metrics</h3>
              <div className="h-48 md:h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <Bar dataKey="Fuel" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Maintenance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
