// rebma-web/src/views/ReceptionDashboard.tsx

import type { Visitor } from '../types/erp';

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Front-desk Terminal</h1>
        <p className="text-sm text-slate-500 text-muted">Check-in daily staff and visitor logs.</p>
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
