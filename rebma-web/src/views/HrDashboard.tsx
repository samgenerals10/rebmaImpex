// rebma-web/src/views/HrDashboard.tsx

import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import type { Attendance, PendingRegistration, StaffMember } from '../types/erp';
import { FileSpreadsheet, FileText, Users, Clipboard, ShieldCheck, Activity, UserCheck, UserX } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';

interface HrDashboardProps {
  attendanceList: Attendance[];
  barChartData: Array<{ name: string; Staff: number; Visitors: number }>;
  activeSubTab: string;
  addNotification: (msg: string) => void;
}

// Seed data for pending registrations
const seedPendingRegistrations: PendingRegistration[] = [
  { id: 'usr-902', fullName: 'Justice Kwame', email: 'j.kwame@rembaimpex.com', department: 'PRODUCTION', ghanaCard: 'GHA-9827361-9', phone: '+233 20 111 2222', submittedAt: '3 mins ago', status: 'PENDING' },
  { id: 'usr-903', fullName: 'Derrick Osei', email: 'd.osei@rembaimpex.com', department: 'OPERATIONS', ghanaCard: 'GHA-0928374-2', phone: '+233 24 333 4444', submittedAt: '1 hour ago', status: 'PENDING' },
];

// Seed staff list
const seedStaff: StaffMember[] = [
  { id: 'ST-001', fullName: 'Samuel Remba', email: 'ceo@rembaimpex.com', department: 'CEO', role: 'Chief Executive Officer', ghanaCard: 'GHA-0000001-1', phone: '+233 20 000 0001', joinedAt: 'Jan 2020', status: 'ACTIVE' },
  { id: 'ST-002', fullName: 'Ama Owusu', email: 'finance@rembaimpex.com', department: 'FINANCE', role: 'Finance Lead', ghanaCard: 'GHA-1234567-2', phone: '+233 24 555 1234', joinedAt: 'Mar 2021', status: 'ACTIVE' },
  { id: 'ST-003', fullName: 'Kofi Mensah', email: 'ops@rembaimpex.com', department: 'OPERATIONS', role: 'Operations Manager', ghanaCard: 'GHA-2345678-3', phone: '+233 26 777 5678', joinedAt: 'Jun 2021', status: 'ACTIVE' },
  { id: 'ST-004', fullName: 'Abena Yeboah', email: 'hr@rembaimpex.com', department: 'HR', role: 'HR Manager', ghanaCard: 'GHA-3456789-4', phone: '+233 27 888 9012', joinedAt: 'Sep 2021', status: 'ACTIVE' },
  { id: 'ST-005', fullName: 'Kwame Boateng', email: 'marketing@rembaimpex.com', department: 'MARKETING', role: 'Marketing Director', ghanaCard: 'GHA-4567890-5', phone: '+233 23 999 3456', joinedAt: 'Feb 2022', status: 'ACTIVE' },
  { id: 'ST-006', fullName: 'Felicia Asante', email: 'dispatch@rembaimpex.com', department: 'DISPATCH', role: 'Dispatch Coordinator', ghanaCard: 'GHA-5678901-6', phone: '+233 20 111 7890', joinedAt: 'Apr 2022', status: 'ACTIVE' },
];

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export default function HrDashboard({
  attendanceList,
  barChartData,
  activeSubTab = 'Employees',
  addNotification
}: HrDashboardProps) {

  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>(seedPendingRegistrations);
  const [staffList] = useState<StaffMember[]>(seedStaff);
  const [approvalLog, setApprovalLog] = useState<Array<{ id: string; name: string; action: 'APPROVED' | 'REJECTED'; password?: string; at: string }>>([]);

  const lineChartData = [
    { name: 'Mon', Present: 22, Late: 1 },
    { name: 'Tue', Present: 23, Late: 0 },
    { name: 'Wed', Present: 20, Late: 3 },
    { name: 'Thu', Present: 24, Late: 1 },
    { name: 'Fri', Present: 21, Late: 2 },
  ];

  const presentToday = attendanceList.filter(a => a.status === 'PRESENT').length;
  const lateToday = attendanceList.filter(a => a.status === 'LATE').length;
  const pendingApprovals = pendingRegistrations.filter(r => r.status === 'PENDING').length;

  const stats = [
    { title: 'Total Staff Force', value: `${staffList.length} Active`, sub: 'Employee database profiles', icon: Users, color: 'text-blue-500' },
    { title: 'Present Today', value: `${presentToday} Present`, sub: 'Check-in registered successfully', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'Late Today', value: `${lateToday} Late`, sub: 'Incidents recorded after 8:00 AM', icon: Activity, color: 'text-rose-500' },
    { title: 'Pending Profiles', value: `${pendingApprovals} Approvals`, sub: 'Registration approval queue', icon: Clipboard, color: 'text-amber-500' },
  ];

  const handleApprove = (reg: PendingRegistration) => {
    const pw = generatePassword();
    setPendingRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'APPROVED' } : r));
    setApprovalLog(prev => [{ id: reg.id, name: reg.fullName, action: 'APPROVED', password: pw, at: new Date().toLocaleString() }, ...prev]);
    addNotification(`HR approved ${reg.fullName}. Login password generated & simulated email sent to ${reg.email}.`);
    // Simulate email
    setTimeout(() => {
      alert(`[SIMULATED EMAIL → ${reg.email}]\nSubject: Your REBMA IMPEX ERP Account is ACTIVE\n\nDear ${reg.fullName},\n\nYour account has been approved.\nDepartment: ${reg.department}\nTemporary Password: ${pw}\n\nPlease change your password after first login.\n\nRebma Impex Ghana Ltd — IT Department`);
    }, 300);
  };

  const handleDeny = (reg: PendingRegistration) => {
    setPendingRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'REJECTED' } : r));
    setApprovalLog(prev => [{ id: reg.id, name: reg.fullName, action: 'REJECTED', at: new Date().toLocaleString() }, ...prev]);
    addNotification(`HR denied ${reg.fullName}'s registration. Rejection email simulated.`);
    setTimeout(() => {
      alert(`[SIMULATED EMAIL → ${reg.email}]\nSubject: Your REBMA IMPEX ERP Registration Update\n\nDear ${reg.fullName},\n\nWe regret to inform you that your account registration request for the ${reg.department} department has not been approved at this time.\n\nFor any queries, contact HR directly.\n\nRebma Impex Ghana Ltd — HR Department`);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Human Resources Workspace</h1>
          <p className="text-sm text-slate-500 text-muted">Manage staff registrations, approvals, and attendance tracking.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(attendanceList, ['id', 'fullName', 'checkInTime', 'status'], 'hr_attendance')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Attendance (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Daily Staff Attendance Log', attendanceList, ['id', 'fullName', 'checkInTime', 'status'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileText className="w-3.5 h-3.5" /><span>Attendance (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
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

      {/* Chart */}
      <div className="p-6 app-card">
        <h3 className="text-lg font-bold">Attendance & On-Time Performance Index</h3>
        <p className="text-xs text-slate-500 text-muted">Weekly present vs late clock-in trends.</p>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Late" stroke="#f43f5e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab views */}
      <div className="border-t border-slate-100 pt-6">

        {/* EMPLOYEE DATABASE */}
        {activeSubTab === 'Employees' && (
          <div className="space-y-6">
            {/* Registration Approval Queue */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">New Registration Approval Queue</h3>
              <p className="text-xs text-slate-500 text-muted">Approve to generate login password & email; Deny to send rejection notice.</p>
              <div className="divide-y divide-slate-100">
                {pendingRegistrations.filter(r => r.status === 'PENDING').map(reg => (
                  <div key={reg.id} className="py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{reg.fullName}</p>
                      <p className="text-xs text-slate-500">{reg.email} | Dept: <strong>{reg.department}</strong></p>
                      {reg.phone && <p className="text-[10px] text-slate-400">Phone: {reg.phone}</p>}
                      <p className="text-[10px] text-slate-400">Ghana Card: <code className="bg-slate-100 px-1 rounded">{reg.ghanaCard}</code> | Submitted: {reg.submittedAt}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleApprove(reg)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                        <UserCheck className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleDeny(reg)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer">
                        <UserX className="w-3.5 h-3.5" /> Deny
                      </button>
                    </div>
                  </div>
                ))}
                {pendingRegistrations.filter(r => r.status === 'PENDING').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No pending registrations.</p>
                )}
              </div>

              {/* Approval log */}
              {approvalLog.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-600 mb-2">Recent Decisions</p>
                  <div className="space-y-2">
                    {approvalLog.slice(0, 5).map((log, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl text-[10px] ${log.action === 'APPROVED' ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                        <span className="font-medium">{log.name}</span>
                        {log.action === 'APPROVED' && log.password && (
                          <span className="text-slate-500">Password: <code className="bg-white px-1 rounded border">{log.password}</code></span>
                        )}
                        <span className={`font-bold ${log.action === 'APPROVED' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.action}</span>
                        <span className="text-slate-400">{log.at}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Staff Members Table */}
            <div className="p-6 app-card space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Staff Members Directory</h3>
                <button onClick={() => exportToCSV(staffList, ['id', 'fullName', 'email', 'department', 'role', 'ghanaCard', 'phone', 'joinedAt', 'status'], 'staff_directory')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export Staff CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                      <th className="py-2.5 px-3">Staff ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Ghana Card</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Joined</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map(staff => (
                      <tr key={staff.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{staff.id}</td>
                        <td className="py-2.5 px-3 font-medium">{staff.fullName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-bold">{staff.department}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{staff.role}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{staff.ghanaCard}</td>
                        <td className="py-2.5 px-3 text-slate-400">{staff.phone}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">{staff.joinedAt}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${staff.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{staff.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE RECORDS */}
        {activeSubTab === 'Attendance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Attendance — max 5 visible, rest scrollable */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">Today's Attendance Logs</h3>
              <p className="text-xs text-slate-400">Showing today's check-ins (scroll for more).</p>
              {/* First 5 always visible */}
              <div className="space-y-2">
                {attendanceList.slice(0, 5).map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{a.fullName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Checked In: {a.checkInTime}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
              {/* Overflow scrollable */}
              {attendanceList.length > 5 && (
                <div className="max-h-48 overflow-y-auto space-y-2 border-t border-slate-100 pt-2">
                  {attendanceList.slice(5).map(a => (
                    <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50/50 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-600">{a.fullName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{a.checkInTime}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance History Table */}
            <div className="p-6 app-card space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Attendance History</h3>
                <button onClick={() => exportToCSV(attendanceList, ['id', 'fullName', 'checkInTime', 'status'], 'attendance_history')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                      <th className="py-2.5 px-3">Staff ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Check-in Time</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceList.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{a.id}</td>
                        <td className="py-2.5 px-3 font-medium">{a.fullName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{a.checkInTime}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                    {attendanceList.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-slate-400">No attendance records.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STAFF PERFORMANCE */}
        {activeSubTab === 'Performance' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Departmental Staff & Visitors</h3>
            <p className="text-xs text-slate-500 text-muted">Comparative chart of active personnel and daily visitor count.</p>
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
        )}
      </div>
    </div>
  );
}
