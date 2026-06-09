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
import { FileSpreadsheet, FileText, Truck, Settings, Activity, ShieldCheck } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';

export default function LogisticsDashboard() {
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

  const handleExportCSV = () => {
    exportToCSV(maintenanceSchedule, ['id', 'type', 'status', 'date', 'cost'], 'logistics_maintenance_schedule');
  };

  const handleExportPDF = () => {
    exportToPDF('Logistics Fleet Maintenance Schedule', maintenanceSchedule, ['id', 'type', 'status', 'date', 'cost']);
  };

  return (
    <>
      {/* ══════════════ MOBILE LAYOUT (< lg) ══════════════ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Logistics Panel</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Fleet maintenance & supply chain metrics</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm" title="Export CSV">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={handleExportPDF} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm" title="Export PDF">
              <FileText className="w-4 h-4 text-slate-500" />
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
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider truncate">{s.label}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
                  <p className="text-[9px] text-slate-400">{s.sub}</p>
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
                  <p className="text-xs font-bold text-slate-800 truncate">{log.id}</p>
                  <p className="text-[10px] text-slate-400 truncate">{log.type}</p>
                  <p className="text-[9px] text-slate-400">{log.date} • <strong>${log.cost}</strong></p>
                </div>
                <span className={`mobile-status-pill ${log.status === 'Operational' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini fleet performance chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-800 mb-1">Fleet Performance</h3>
          <p className="text-[10px] text-slate-400 mb-3">Weekly distance vs fuel</p>
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-800 mb-3">Fuel & Maintenance by Truck</h3>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {stats.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border-b-[3px] border-[var(--accent)] flex items-center justify-between hover:scale-102 transition-all">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase font-semibold">{card.title}</span>
                    <h3 className="text-xl md:text-2xl font-bold mt-1 text-[var(--text-primary)]">{card.value}</h3>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{card.sub}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-[var(--accent-light)] text-[var(--accent)] rounded-2xl">
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
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
