// rebma-web/src/views/ReceptionDashboard.tsx

import type { Visitor } from '../types/erp';
import { FileSpreadsheet, FileText, Users, ShieldCheck, Activity, Clock } from 'lucide-react';
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

  const handleExportCSV = () => {
    exportToCSV(visitorsList, ['id', 'fullName', 'purpose', 'hostName', 'checkInTime', 'checkOutTime'], 'reception_visitors_log');
  };

  const handleExportPDF = () => {
    exportToPDF('Reception Visitor Logs', visitorsList, ['id', 'fullName', 'purpose', 'hostName', 'checkInTime', 'checkOutTime']);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Front-desk Terminal</h1>
          <p className="text-sm text-slate-500 text-muted">Check-in daily staff and visitor logs.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Logs (CSV)</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Logs (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((card, idx) => {
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

      {/* Performance Chart */}
      <div className="p-6 app-card flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold">Front-desk Traffic Metrics</h3>
          <p className="text-xs text-slate-500 text-muted">Weekly visitor check-ins vs check-out logs.</p>
        </div>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="CheckIns" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="CheckOuts" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visitor Log form */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Log Visitor Arrival</h3>
          <form onSubmit={onAddVisitor} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Visitor Name</label>
              <input 
                type="text" 
                name="visitor"
                required 
                placeholder="Grace Mensah"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Visit Purpose</label>
              <input 
                type="text" 
                name="purpose"
                required 
                placeholder="Supplier meeting"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Host Contact</label>
              <input 
                type="text" 
                name="host"
                required 
                placeholder="Manager Frank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Check In Visitor
            </button>
          </form>
        </div>

        {/* Active Visitors logs */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Checked-in Visitors</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {visitorsList.length === 0 ? (
              <p className="text-xs text-slate-400">No visitors logged today.</p>
            ) : (
              visitorsList.map(v => (
                <div key={v.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{v.fullName}</p>
                    <p className="text-[10px] text-slate-500">Host: <strong>{v.hostName}</strong> | Purpose: {v.purpose}</p>
                    <p className="text-[9px] text-slate-400 mt-1">In: {v.checkInTime} {v.checkOutTime && `| Out: ${v.checkOutTime}`}</p>
                  </div>
                  {!v.checkOutTime && (
                    <button 
                      onClick={() => onCheckoutVisitor(v.id)}
                      className="px-2 py-1 bg-red-100 text-red-700 font-bold rounded text-[10px] cursor-pointer hover:bg-red-200"
                    >
                      Checkout
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Attendance check-in desk */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Staff check-in Kiosk</h3>
          <form onSubmit={onCheckInAttendance} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Employee Name</label>
              <input 
                type="text" 
                name="name"
                required 
                placeholder="Michael Osei"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Check In Employee
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
