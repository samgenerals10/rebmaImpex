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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CEO Command Terminal</h1>
          <p className="text-sm text-slate-500 text-muted">Global operations overview, metrics, and fleet map.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Operational KPI Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { title: 'Global Ingestion Flow', value: '1,020 Tons', sub: '+12% from last month', icon: Layers, color: 'text-blue-500' },
          { title: 'Processing Invoices', value: '4 Invoices', sub: '2 awaiting clearance', icon: DollarSign, color: 'text-emerald-500' },
          { title: 'Active Logistics Vehicles', value: '1 Truck', sub: 'GPS Streaming Live', icon: Truck, color: 'text-indigo-500' },
          { title: 'Total Registered Staff', value: '25 Active', sub: '3 Pending approvals', icon: Users, color: 'text-amber-500' }
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 app-card flex items-center justify-between hover:scale-102 transition-all">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">{card.title}</span>
                <h3 className="text-2xl font-bold mt-1">{card.value}</h3>
                <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}>
                <Icon className="w-6 h-6" />
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
          
          <div className="h-64 bg-slate-100 rounded-2xl relative overflow-hidden flex items-center justify-center border border-slate-200">
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
          <div className="h-60 mt-4">
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
  );
}
