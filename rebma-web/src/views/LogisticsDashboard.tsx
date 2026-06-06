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
    { title: 'Total Fleet Vehicles', value: '12 Trucks', sub: '10 Operational | 2 In Shop', icon: Truck, color: 'text-blue-500' },
    { title: 'Monthly Fuel Efficiency', value: '8.5 km/L', sub: 'Optimal target threshold met', icon: Activity, color: 'text-emerald-500' },
    { title: 'Maintenance Pending', value: '2 Actions', sub: 'Awaiting scheduled service', icon: Settings, color: 'text-amber-500' },
    { title: 'Completed Shipments', value: '142 Logs', sub: '98.6% on-time delivery rate', icon: ShieldCheck, color: 'text-indigo-500' }
  ];

  const handleExportCSV = () => {
    exportToCSV(maintenanceSchedule, ['id', 'type', 'status', 'date', 'cost'], 'logistics_maintenance_schedule');
  };

  const handleExportPDF = () => {
    exportToPDF('Logistics Fleet Maintenance Schedule', maintenanceSchedule, ['id', 'type', 'status', 'date', 'cost']);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Logistics Control Panel</h1>
          <p className="text-xs sm:text-sm text-slate-500 text-muted">Manage fleet maintenance records and monitor supply chain metrics.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Maintenance (CSV)</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
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
            <div key={idx} className="p-4 md:p-6 app-card flex items-center justify-between hover:scale-102 transition-all">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">{card.title}</span>
                <h3 className="text-xl md:text-2xl font-bold mt-1">{card.value}</h3>
                <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`p-3 md:p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}>
                <Icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Performance Chart */}
      <div className="p-4 md:p-6 app-card flex flex-col justify-between">
        <div>
          <h3 className="text-base md:text-lg font-bold">Logistics Fleet Performance</h3>
          <p className="text-xs text-slate-500 text-muted">Weekly fleet distance logs vs fuel usage metrics.</p>
        </div>
        <div className="h-48 md:h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Distance" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Fuel" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Fleet Maintenance Logs */}
        <div className="p-4 md:p-6 app-card space-y-4">
          <h3 className="text-base md:text-lg font-bold">Fleet Maintenance Schedule</h3>
          <div className="space-y-3">
            {maintenanceSchedule.map((log, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{log.id} - {log.type}</p>
                  <p className="text-[10px] text-slate-500">Service Date: {log.date} | Cost: <strong>${log.cost}</strong></p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  log.status === 'Operational' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>{log.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Supply Chain Performance charts */}
        <div className="p-4 md:p-6 app-card space-y-4">
          <h3 className="text-base md:text-lg font-bold">Fuel Efficiency & Maintenance Metrics</h3>
          <div className="h-48 md:h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Bar dataKey="Fuel" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Maintenance" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
