// rebma-web/src/views/LogisticsDashboard.tsx

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export default function LogisticsDashboard() {
  const chartData = [
    { name: 'TRK-201', Fuel: 8.2, Maintenance: 120 },
    { name: 'TRK-202', Fuel: 7.9, Maintenance: 350 },
    { name: 'TRK-203', Fuel: 9.1, Maintenance: 0 },
    { name: 'TRK-204', Fuel: 8.8, Maintenance: 90 },
    { name: 'TRK-205', Fuel: 8.4, Maintenance: 180 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logistics Control Panel</h1>
        <p className="text-sm text-slate-500 text-muted">Manage fleet maintenance records and monitor supply chain metrics.</p>
      </div>

      {/* Supply Chain KPI row font metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 app-card">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Fleet Vehicles</span>
          <h3 className="text-2xl font-bold mt-1">12 Trucks</h3>
          <p className="text-[10px] text-slate-400 mt-1">10 Operational | 2 In Maintenance</p>
        </div>
        <div className="p-6 app-card">
          <span className="text-xs text-slate-400 uppercase font-semibold">Monthly Fuel Efficiency</span>
          <h3 className="text-2xl font-bold mt-1">8.5 km/L</h3>
          <p className="text-[10px] text-slate-400 mt-1">Optimal target threshold met</p>
        </div>
        <div className="p-6 app-card">
          <span className="text-xs text-slate-400 uppercase font-semibold">Deliveries Dispatched</span>
          <h3 className="text-2xl font-bold mt-1">142 Shipments</h3>
          <p className="text-[10px] text-emerald-500 font-semibold mt-1">98.6% on-time delivery rate</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Fleet Maintenance Logs */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Fleet Maintenance Schedule</h3>
          <div className="space-y-3">
            {[
              { id: 'TRK-201', type: 'Oil & Filter Change', status: 'Operational', date: 'May 10, 2026', cost: 120 },
              { id: 'TRK-202', type: 'Brake Pad Replacement', status: 'In Service', date: 'May 22, 2026', cost: 350 },
              { id: 'TRK-205', type: 'Tire Rotation & Balance', status: 'Operational', date: 'May 18, 2026', cost: 180 }
            ].map((log, idx) => (
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
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Fuel Efficiency & Maintenance Metrics</h3>
          <div className="h-64 mt-4">
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
