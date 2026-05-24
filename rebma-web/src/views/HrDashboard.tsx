// rebma-web/src/views/HrDashboard.tsx

import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import type { Attendance } from '../types/erp';

interface HrDashboardProps {
  attendanceList: Attendance[];
  barChartData: Array<{ name: string; Staff: number; Visitors: number }>;
}

export default function HrDashboard({
  attendanceList,
  barChartData
}: HrDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Human Resources Workspace</h1>
        <p className="text-sm text-slate-500 text-muted">Review staff registrations, and inspect check-in audits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Approval Queue */}
        <div className="p-6 app-card lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold">New Registrations Approval Queue</h3>
          <div className="divide-y divide-slate-100">
            {[
              { id: 'usr-902', fullName: 'Justice Kwame', email: 'j.kwame@rebmaimpex.com', department: 'PRODUCTION', card: 'GHA-9827361-9', date: '3 mins ago' },
              { id: 'usr-903', fullName: 'Derrick Osei', email: 'd.osei@rebmaimpex.com', department: 'OPERATIONS', card: 'GHA-0928374-2', date: '1 hour ago' }
            ].map(staff => (
              <div key={staff.id} className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">{staff.fullName}</p>
                  <p className="text-xs text-slate-500">{staff.email} | Dept: <strong>{staff.department}</strong></p>
                  <p className="text-[10px] text-slate-400 mt-1">Ghana Card: <code>{staff.card}</code> | Registered: {staff.date}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer">Approve Staff</button>
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer">Deny</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance summary */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Today's Attendance Logs</h3>
          <div className="space-y-3">
            {attendanceList.map(a => (
              <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-700">{a.fullName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Checked In: {a.checkInTime}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                  a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Departmental Staff & Visitors Bar Chart */}
      <div className="p-6 app-card space-y-4">
        <div>
          <h3 className="text-lg font-bold">Departmental Staff & Visitors</h3>
          <p className="text-xs text-slate-500 text-muted">Comparative chart of active personnel and daily visitor count.</p>
        </div>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Bar dataKey="Staff" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Visitors" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
