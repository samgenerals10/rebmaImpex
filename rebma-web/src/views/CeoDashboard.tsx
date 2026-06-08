// rebma-web/src/views/CeoDashboard.tsx

import { Layers, DollarSign, Truck, Users, FileSpreadsheet, FileText } from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { motion } from 'framer-motion';
import { exportToCSV, exportToPDF } from '../utils/export';

interface CeoDashboardProps {
  activeCoordinates: { lat: number; lng: number };
  deliveryStatus: string;
  gpsInterval: number;
}

export default function CeoDashboard({
  activeCoordinates,
  deliveryStatus,
  gpsInterval
}: CeoDashboardProps) {
  
  const lineChartData = [
    { name: 'Mon', Inflow: 4000, Orders: 2400 },
    { name: 'Tue', Inflow: 3000, Orders: 1398 },
    { name: 'Wed', Inflow: 2000, Orders: 9800 },
    { name: 'Thu', Inflow: 2780, Orders: 3908 },
    { name: 'Fri', Inflow: 1890, Orders: 4800 },
  ];

  const handleExportCSV = () => {
    const data = [
      { Metric: 'Global Ingestion Flow', Value: '1,020 Tons', Details: 'Accra Port Operations' },
      { Metric: 'Processing Invoices', Value: '4 Invoices', Details: '2 awaiting finance clearance' },
      { Metric: 'Active Logistics Vehicles', Value: '1 Truck', Details: `GPS Location: ${activeCoordinates.lat.toFixed(4)}, ${activeCoordinates.lng.toFixed(4)}` },
      { Metric: 'Total Registered Staff', Value: '25 Active', Details: 'HR approval pending queue' }
    ];
    exportToCSV(data, ['Metric', 'Value', 'Details'], 'ceo_executive_summary');
  };

  const handleExportPDF = () => {
    const data = [
      { Metric: 'Global Ingestion Flow', Value: '1,020 Tons', Details: 'Accra Port Operations' },
      { Metric: 'Processing Invoices', Value: '4 Invoices', Details: '2 awaiting finance clearance' },
      { Metric: 'Active Logistics Vehicles', Value: '1 Truck', Details: `GPS Location: ${activeCoordinates.lat.toFixed(4)}, ${activeCoordinates.lng.toFixed(4)}` },
      { Metric: 'Total Registered Staff', Value: '25 Active', Details: 'HR approval pending queue' }
    ];
    exportToPDF('CEO Executive Summary', data, ['Metric', 'Value', 'Details']);
  };

  const smallStats = [
    { title: 'Logistics', value: '1 Truck', sub: 'GPS Live', icon: Truck, color: '#6366f1', bg: '#eef2ff' },
    { title: 'Staff Force', value: '25 Active', sub: '3 Pending', icon: Users, color: '#f59e0b', bg: '#fef3c7' },
  ];

  return (
    <>
      {/* ══════════════ MOBILE LAYOUT (< lg) ══════════════ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">CEO Command</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Global operations overview</p>
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

        {/* Physical card — Global Ingestion Flow */}
        <div className="mobile-physical-card">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Global Ingestion Flow</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">1,020 Tons</h2>
              <p className="text-[10px] text-white/70 mt-1">+12% from last month</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 4890</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Accra Port Operations</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Physical card 2 — Invoices */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Processing Invoices</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">4 Invoices</h2>
              <p className="text-[10px] text-white/70 mt-1">2 awaiting finance clearance</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 1024</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Finance Clearance Queue</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Small stat cards row */}
        <div className="grid grid-cols-2 gap-3">
          {smallStats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="mobile-stat-card">
                <div className="mobile-stat-icon" style={{ background: s.bg }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider truncate">{s.title}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
                  <p className="text-[9px] text-slate-400 truncate">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini Chart card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Inflow vs Orders</h3>
              <p className="text-[10px] text-slate-400">Weekly transactional volumes</p>
            </div>
            <svg width="60" height="26" viewBox="0 0 60 26" fill="none" className="opacity-60">
              <path d="M2 22 Q15 8 30 14 Q45 20 58 4" stroke="#068d5c" strokeWidth="2.5" strokeLinecap="round" fill="none" className="mobile-wave-path" />
            </svg>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Inflow" stroke="#068d5c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Orders" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet GPS mini card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-800 mb-2">Live Fleet Tracking</h3>
          <div className="h-32 bg-slate-50 rounded-xl relative overflow-hidden flex items-center justify-center border border-slate-100">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:14px_14px]" />
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute bg-emerald-500/20 border border-emerald-500 p-2 rounded-full z-10"
              style={{
                left: `${45 + (activeCoordinates.lat - 5.6037) * 2000}%`,
                top: `${50 + (activeCoordinates.lng + 0.1870) * 2000}%`
              }}
            >
              <div className="w-3 h-3 bg-emerald-600 rounded-full border-2 border-white" />
            </motion.div>
            <div className="absolute bottom-2 left-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg text-[9px] text-white space-y-0.5">
              <p className="font-semibold text-emerald-400">Truck #L-404</p>
              <p>Lat: {activeCoordinates.lat.toFixed(5)}</p>
              <p>Status: <span className="text-emerald-400 font-bold">{deliveryStatus}</span></p>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 text-right">Refresh: {gpsInterval}s</p>
        </div>
      </div>

      {/* ══════════════ DESKTOP LAYOUT (lg+) — UNCHANGED ══════════════ */}
      <div className="hidden lg:block">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">CEO Command Terminal</h1>
              <p className="text-xs sm:text-sm text-slate-500 text-muted">Global operations overview, metrics, and fleet map.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Operational KPI Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              { title: 'Global Ingestion Flow', value: '1,020 Tons', sub: '+12% from last month', icon: Layers, color: 'text-blue-500' },
              { title: 'Processing Invoices', value: '4 Invoices', sub: '2 awaiting clearance', icon: DollarSign, color: 'text-emerald-500' },
              { title: 'Active Logistics Vehicles', value: '1 Truck', sub: 'GPS Streaming Live', icon: Truck, color: 'text-indigo-500' },
              { title: 'Total Registered Staff', value: '25 Active', sub: '3 Pending approvals', icon: Users, color: 'text-amber-500' }
            ].map((card, idx) => {
              const Icon = card.icon;
              const isProminent = idx < 2;
              return (
                <div key={idx} className="p-4 sm:p-6 app-card flex items-center justify-between hover:scale-102 transition-all">
                  <div>
                    <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">{card.title}</span>
                    <h3 className={`font-bold mt-1 ${isProminent ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}>{card.value}</h3>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">{card.sub}</p>
                  </div>
                  <div className="p-3 sm:p-4 bg-slate-100 rounded-2xl text-blue-500 bg-accent-light shrink-0">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map and Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Fleet Tracking Map */}
            <div className="lg:col-span-2 p-6 app-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-lg font-bold">Live Fleet Tracking Map</h3>
                <p className="text-xs text-slate-500 text-muted">Simulated real-time vehicle GPS coordinate logging.</p>
              </div>
              
              <div className="h-[200px] sm:h-64 bg-slate-100 rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-200">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute bg-blue-500/30 border border-blue-500 p-2.5 rounded-full z-10"
                  style={{
                    left: `${45 + (activeCoordinates.lat - 5.6037) * 2000}%`,
                    top: `${50 + (activeCoordinates.lng + 0.1870) * 2000}%`
                  }}
                >
                  <div className="w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white"></div>
                </motion.div>
                
                <div className="absolute top-10 left-12 text-[10px] font-bold text-slate-400">Kotoka Intl Airport</div>
                <div className="absolute bottom-16 right-20 text-[10px] font-bold text-slate-400">Tema Harbour Port</div>
                <div className="absolute bottom-10 left-10 text-[10px] font-bold text-slate-400 font-semibold">Accra Central</div>

                <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-white space-y-0.5">
                  <p className="font-semibold text-blue-400">Truck #L-404 Active</p>
                  <p>Lat: {activeCoordinates.lat.toFixed(6)}</p>
                  <p>Lng: {activeCoordinates.lng.toFixed(6)}</p>
                  <p>Status: <span className="text-emerald-400 font-bold uppercase">{deliveryStatus}</span></p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>Map Provider: Google Maps Platform SDK</span>
                <span>Stream interval: {gpsInterval}s</span>
              </div>
            </div>

            {/* Line Chart */}
            <div className="p-6 app-card flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold">Inflow Revenue VS Orders</h3>
                <p className="text-xs text-slate-500 text-muted">Weekly transactional volumes.</p>
              </div>
              <div className="h-[200px] sm:h-60 lg:h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Inflow" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Orders" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
