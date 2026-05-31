// rebma-web/src/views/HrDashboard.tsx

import { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import type { Attendance, PendingRegistration, StaffMember } from '../types/erp';
import { FileSpreadsheet, FileText, Users, Clipboard, ShieldCheck, Activity, UserCheck, UserX } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';

interface HrDashboardProps {
  attendanceList: Attendance[];
  barChartData: Array<{ name: string; Staff: number; Visitors: number }>;
  activeSubTab: string;
  addNotification: (msg: string) => void;
  pendingRegistrations: PendingRegistration[];
  staffList: StaffMember[];
  onApprove: (reg: PendingRegistration, pw: string) => void;
  onDeny: (reg: PendingRegistration) => void;
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export default function HrDashboard({
  attendanceList,
  barChartData,
  activeSubTab = 'Employees',
  addNotification,
  pendingRegistrations,
  staffList,
  onApprove,
  onDeny
}: HrDashboardProps) {

  // Local state initialized from props for full interactivity
  const [localStaff, setLocalStaff] = useState<StaffMember[]>(staffList);
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>(attendanceList);
  const [approvalLog, setApprovalLog] = useState<Array<{ id: string; name: string; action: 'APPROVED' | 'REJECTED'; password?: string; at: string }>>([]);

  // Search & Filter state for Staff
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isStaffFilterOpen, setIsStaffFilterOpen] = useState(false);
  const [selectedStaffRows, setSelectedStaffRows] = useState<Set<string>>(new Set());
  const [activeStaffMenu, setActiveStaffMenu] = useState<string | null>(null);

  // Search & Filter state for Attendance
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');
  const [isAttendanceFilterOpen, setIsAttendanceFilterOpen] = useState(false);
  const [selectedAttendanceRows, setSelectedAttendanceRows] = useState<Set<string>>(new Set());
  const [activeAttendanceMenu, setActiveAttendanceMenu] = useState<string | null>(null);

  // Sync props to local state
  useEffect(() => {
    setLocalStaff(staffList);
  }, [staffList]);

  useEffect(() => {
    setLocalAttendance(attendanceList);
  }, [attendanceList]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveStaffMenu(null);
      setActiveAttendanceMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const lineChartData = [
    { name: 'Mon', Present: 22, Late: 1 },
    { name: 'Tue', Present: 23, Late: 0 },
    { name: 'Wed', Present: 20, Late: 3 },
    { name: 'Thu', Present: 24, Late: 1 },
    { name: 'Fri', Present: 21, Late: 2 },
  ];

  const presentToday = localAttendance.filter(a => a.status === 'PRESENT').length;
  const lateToday = localAttendance.filter(a => a.status === 'LATE').length;
  const pendingApprovals = pendingRegistrations.filter(r => r.status === 'PENDING').length;

  const stats = [
    { title: 'Total Staff Force', value: `${localStaff.length} Active`, sub: 'Employee database profiles', icon: Users, color: 'text-blue-500' },
    { title: 'Present Today', value: `${presentToday} Present`, sub: 'Check-in registered successfully', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'Late Today', value: `${lateToday} Late`, sub: 'Incidents recorded after 8:00 AM', icon: Activity, color: 'text-rose-500' },
    { title: 'Pending Profiles', value: `${pendingApprovals} Approvals`, sub: 'Registration approval queue', icon: Clipboard, color: 'text-amber-500' },
  ];

  const handleApprove = (reg: PendingRegistration) => {
    const pw = generatePassword();
    onApprove(reg, pw);
    setApprovalLog(prev => [{ id: reg.id, name: reg.fullName, action: 'APPROVED', password: pw, at: new Date().toLocaleString() }, ...prev]);
    addNotification(`HR approved ${reg.fullName}. Login password generated & simulated email sent to ${reg.email}.`);
    // Simulate email
    setTimeout(() => {
      alert(`[SIMULATED EMAIL → ${reg.email}]\nSubject: Your REBMA IMPEX ERP Account is ACTIVE\n\nDear ${reg.fullName},\n\nYour account has been approved.\nDepartment: ${reg.department}\nTemporary Password: ${pw}\n\nPlease change your password after first login.\n\nRebma Impex Ghana Ltd — IT Department`);
    }, 300);
  };

  const handleDeny = (reg: PendingRegistration) => {
    onDeny(reg);
    setApprovalLog(prev => [{ id: reg.id, name: reg.fullName, action: 'REJECTED', at: new Date().toLocaleString() }, ...prev]);
    addNotification(`HR denied ${reg.fullName}'s registration. Rejection email simulated.`);
    setTimeout(() => {
      alert(`[SIMULATED EMAIL → ${reg.email}]\nSubject: Your REBMA IMPEX ERP Registration Update\n\nDear ${reg.fullName},\n\nWe regret to inform you that your account registration request for the ${reg.department} department has not been approved at this time.\n\nFor any queries, contact HR directly.\n\nRebma Impex Ghana Ltd — HR Department`);
    }, 300);
  };

  // Staff Table Handlers
  const handleAddStaff = () => {
    const name = prompt('Enter staff member full name:');
    if (!name) return;
    const dept = prompt('Enter department (e.g. OPERATIONS, FINANCE, PRODUCTION):', 'OPERATIONS');
    if (!dept) return;
    const role = prompt('Enter role:', 'Staff Associate');
    const email = `${name.toLowerCase().replace(/\s+/g, '')}@rembaimpex.com`;
    const newStaff: StaffMember = {
      id: `ST-${Math.floor(100 + Math.random() * 900)}`,
      fullName: name,
      email,
      department: dept.toUpperCase(),
      role: role || 'Staff Associate',
      ghanaCard: `GHA-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(Math.random() * 9)}`,
      phone: '+233 24 ' + Math.floor(1000000 + Math.random() * 9000000),
      joinedAt: new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      status: 'ACTIVE'
    };
    setLocalStaff(prev => [newStaff, ...prev]);
    addNotification(`Staff profile created for ${name} (${newStaff.id})`);
  };

  const handleEditStaff = (staff: StaffMember) => {
    const newName = prompt(`Edit name for ${staff.fullName}:`, staff.fullName);
    if (!newName) return;
    const newRole = prompt(`Edit role for ${staff.fullName}:`, staff.role);
    setLocalStaff(prev => prev.map(s => s.id === staff.id ? { ...s, fullName: newName, role: newRole || s.role } : s));
    addNotification(`Updated staff profile details for ${staff.id}`);
  };

  const handleDuplicateStaff = (staff: StaffMember) => {
    const duplicated: StaffMember = {
      ...staff,
      id: `ST-${Math.floor(100 + Math.random() * 900)}`,
      fullName: `${staff.fullName} (Copy)`,
      email: `copy.${staff.email}`
    };
    setLocalStaff(prev => [duplicated, ...prev]);
    addNotification(`Duplicated staff profile of ${staff.fullName} as ${duplicated.id}`);
  };

  const handleShareStaff = (staff: StaffMember) => {
    const shareText = `Rebma Staff Profile: ${staff.fullName} (${staff.id}) - Dept: ${staff.department}, Role: ${staff.role}, Phone: ${staff.phone}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied profile link details for ${staff.fullName} to clipboard!`);
    }).catch(() => {
      alert(shareText);
    });
  };

  const handleDeleteStaff = (id: string) => {
    if (!confirm('Are you sure you want to delete this staff record?')) return;
    setLocalStaff(prev => prev.filter(s => s.id !== id));
    addNotification(`Deleted staff profile for ${id}`);
  };

  // Staff Checkbox Handlers
  const handleSelectAllStaff = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStaffRows(new Set(filteredStaff.map(s => s.id)));
    } else {
      setSelectedStaffRows(new Set());
    }
  };

  const handleSelectStaffRow = (id: string) => {
    const updated = new Set(selectedStaffRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedStaffRows(updated);
  };

  // Attendance Table Handlers
  const handleEditAttendance = (att: Attendance) => {
    const newStatus = prompt(`Edit status for ${att.fullName} (PRESENT/LATE):`, att.status);
    if (!newStatus || !['PRESENT', 'LATE'].includes(newStatus.toUpperCase())) return;
    setLocalAttendance(prev => prev.map(a => a.id === att.id ? { ...a, status: newStatus.toUpperCase() as any } : a));
    addNotification(`Updated attendance status for ${att.fullName} to ${newStatus.toUpperCase()}`);
  };

  const handleDuplicateAttendance = (att: Attendance) => {
    const duplicated: Attendance = {
      ...att,
      id: `${att.id}-dup-${Math.floor(Math.random() * 100)}`,
      fullName: `${att.fullName} (Duplicate Entry)`
    };
    setLocalAttendance(prev => [duplicated, ...prev]);
    addNotification(`Duplicated attendance log for ${att.fullName}`);
  };

  const handleShareAttendance = (att: Attendance) => {
    const shareText = `Rebma Attendance Log: ${att.fullName} - Checked-in at: ${att.checkInTime} - Status: ${att.status}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied attendance link details for ${att.fullName} to clipboard!`);
    }).catch(() => {
      alert(shareText);
    });
  };

  const handleDeleteAttendance = (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    setLocalAttendance(prev => prev.filter(a => a.id !== id));
    addNotification(`Deleted attendance record ${id}`);
  };

  // Attendance Checkbox Handlers
  const handleSelectAllAttendance = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedAttendanceRows(new Set(filteredAttendance.map(a => a.id)));
    } else {
      setSelectedAttendanceRows(new Set());
    }
  };

  const handleSelectAttendanceRow = (id: string) => {
    const updated = new Set(selectedAttendanceRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedAttendanceRows(updated);
  };

  // Filtering Lists
  const filteredStaff = localStaff.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(staffSearch.toLowerCase()) ||
                          s.id.toLowerCase().includes(staffSearch.toLowerCase()) ||
                          s.email.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesStatus = staffStatusFilter === 'ALL' || s.status === staffStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAttendance = localAttendance.filter(a => {
    const matchesSearch = a.fullName.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
                          a.id.toLowerCase().includes(attendanceSearch.toLowerCase());
    const matchesStatus = attendanceStatusFilter === 'ALL' || a.status === attendanceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Human Resources Workspace</h1>
          <p className="text-sm text-muted">Manage staff registrations, approvals, and attendance tracking.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(localAttendance, ['id', 'fullName', 'checkInTime', 'status'], 'hr_attendance')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Attendance (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Daily Staff Attendance Log', localAttendance, ['id', 'fullName', 'checkInTime', 'status'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileText className="w-3.5 h-3.5" /><span>Attendance (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 app-card flex items-center justify-between hover:scale-102 transition-all duration-300">
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
        <p className="text-xs text-muted">Weekly present vs late clock-in trends.</p>
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
      <div className="border-t border-custom pt-6">

        {/* EMPLOYEE DATABASE */}
        {activeSubTab === 'Employees' && (
          <div className="space-y-6">
            {/* Registration Approval Queue */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">New Registration Approval Queue</h3>
              <p className="text-xs text-muted">Approve to generate login password & email; Deny to send rejection notice.</p>
              <div className="divide-y divide-custom">
                {pendingRegistrations.filter(r => r.status === 'PENDING').map(reg => (
                  <div key={reg.id} className="py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{reg.fullName}</p>
                      <p className="text-xs text-slate-500">{reg.email} | Dept: <strong>{reg.department}</strong></p>
                      {reg.phone && <p className="text-[10px] text-slate-400">Phone: {reg.phone}</p>}
                      <p className="text-[10px] text-slate-400">Ghana Card: <code className="bg-slate-100 dark:bg-slate-800 text-[var(--text-primary)] px-1 rounded">{reg.ghanaCard}</code> | Submitted: {reg.submittedAt}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleApprove(reg)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                        <UserCheck className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleDeny(reg)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:text-slate-300 dark:bg-slate-800 rounded-lg text-xs font-bold cursor-pointer transition-colors">
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
                <div className="mt-4 pt-4 border-t border-custom">
                  <p className="text-xs font-bold text-slate-500 mb-2">Recent Decisions</p>
                  <div className="space-y-2">
                    {approvalLog.slice(0, 5).map((log, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl text-[10px] ${log.action === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50' : 'bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50'}`}>
                        <span className="font-medium">{log.name}</span>
                        {log.action === 'APPROVED' && log.password && (
                          <span className="text-slate-500">Password: <code className="bg-white dark:bg-slate-850 px-1 rounded border border-custom">{log.password}</code></span>
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
            <div className="theme-table-wrapper">
              {/* Table Toolbar */}
              <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">Staff Members Directory</h3>
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredStaff.length} users</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                    <input
                      type="text"
                      placeholder="Search staff…"
                      value={staffSearch}
                      onChange={e => setStaffSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
                    />
                  </div>
                  {/* Status Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsStaffFilterOpen(!isStaffFilterOpen); }}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
                    >
                      <span>Filter: {staffStatusFilter === 'ALL' ? 'All' : staffStatusFilter}</span>
                      <span className="text-[10px]">▼</span>
                    </button>
                    {isStaffFilterOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                        {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => { setStaffStatusFilter(st); setIsStaffFilterOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                          >
                            <span className={`w-2 h-2 rounded-full ${st === 'ACTIVE' ? 'bg-emerald-400' : st === 'INACTIVE' ? 'bg-rose-400' : 'bg-slate-400'}`} />
                            {st === 'ALL' ? 'All Status' : st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Export */}
                  <button onClick={() => exportToCSV(filteredStaff, ['id', 'fullName', 'email', 'department', 'role', 'ghanaCard', 'phone', 'joinedAt', 'status'], 'staff_directory')} className="flex items-center gap-1 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom">
                    <span>⬇</span> Export
                  </button>
                  {/* Add Staff */}
                  <button onClick={handleAddStaff} className="flex items-center gap-1 text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors font-bold">
                    <span>＋</span> Add Staff
                  </button>
                </div>
              </div>

              {/* Scrollable table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                      <th className="py-3 px-5 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={filteredStaff.length > 0 && selectedStaffRows.size === filteredStaff.length}
                          onChange={handleSelectAllStaff}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </th>
                      <th className="py-3 px-3 whitespace-nowrap">Staff ID</th>
                      <th className="py-3 px-3 whitespace-nowrap">Name</th>
                      <th className="py-3 px-3 whitespace-nowrap">Department</th>
                      <th className="py-3 px-3 whitespace-nowrap">Role</th>
                      <th className="py-3 px-3 whitespace-nowrap">Ghana Card</th>
                      <th className="py-3 px-3 whitespace-nowrap">Phone</th>
                      <th className="py-3 px-3 whitespace-nowrap">Joined</th>
                      <th className="py-3 px-3 whitespace-nowrap text-center">Status</th>
                      <th className="py-3 px-5 whitespace-nowrap text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-custom">
                    {filteredStaff.map(staff => (
                      <tr key={staff.id} className="theme-table-row group">
                        <td className="py-3.5 px-5">
                          <input
                            type="checkbox"
                            checked={selectedStaffRows.has(staff.id)}
                            onChange={() => handleSelectStaffRow(staff.id)}
                            className="accent-blue-600 w-3.5 h-3.5"
                          />
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold">{staff.id}</td>
                        <td className="py-3.5 px-3 font-medium">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{staff.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{staff.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-[9px] font-bold">{staff.department}</span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-400">{staff.role}</td>
                        <td className="py-3.5 px-3 font-mono text-[10px] text-slate-400">{staff.ghanaCard}</td>
                        <td className="py-3.5 px-3 text-slate-400 font-mono">{staff.phone}</td>
                        <td className="py-3.5 px-3 text-slate-400 text-[10px] font-mono">{staff.joinedAt}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${staff.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                            {staff.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveStaffMenu(activeStaffMenu === staff.id ? null : staff.id)}
                            className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                          >
                            ···
                          </button>
                          {activeStaffMenu === staff.id && (
                            <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                              <button onClick={() => handleEditStaff(staff)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit</button>
                              <button onClick={() => handleDuplicateStaff(staff)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate</button>
                              <button onClick={() => handleShareStaff(staff)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                              <button onClick={() => handleDeleteStaff(staff.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-slate-400">No staff members found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Pagination */}
              <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
                <p className="text-xs text-slate-400 font-mono">Showing {filteredStaff.length} of {localStaff.length} profiles</p>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE RECORDS */}
        {activeSubTab === 'Attendance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Today's Attendance — max 5 visible, rest scrollable */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">Today's Attendance Logs</h3>
              <p className="text-xs text-slate-400">Showing today's check-ins (scroll for more).</p>
              {/* First 5 always visible */}
              <div className="space-y-2">
                {localAttendance.slice(0, 5).map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="text-xs font-bold">{a.fullName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Checked In: {a.checkInTime}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
              {/* Overflow scrollable */}
              {localAttendance.length > 5 && (
                <div className="max-h-48 overflow-y-auto space-y-2 border-t border-custom pt-2">
                  {localAttendance.slice(5).map(a => (
                    <div key={a.id} className="flex justify-between items-center p-3 bg-slate-100/20 dark:bg-slate-800/20 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-400">{a.fullName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{a.checkInTime}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance History Table */}
            <div className="theme-table-wrapper lg:col-span-2">
              {/* Table Toolbar */}
              <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">Attendance Log Ledger</h3>
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredAttendance.length} records</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                    <input
                      type="text"
                      placeholder="Search name…"
                      value={attendanceSearch}
                      onChange={e => setAttendanceSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-36"
                    />
                  </div>
                  {/* Status Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsAttendanceFilterOpen(!isAttendanceFilterOpen); }}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
                    >
                      <span>Filter: {attendanceStatusFilter === 'ALL' ? 'All' : attendanceStatusFilter}</span>
                      <span className="text-[10px]">▼</span>
                    </button>
                    {isAttendanceFilterOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                        {(['ALL', 'PRESENT', 'LATE'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => { setAttendanceStatusFilter(st); setIsAttendanceFilterOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                          >
                            <span className={`w-2 h-2 rounded-full ${st === 'PRESENT' ? 'bg-emerald-400' : st === 'LATE' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                            {st === 'ALL' ? 'All Logs' : st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Export */}
                  <button onClick={() => exportToCSV(filteredAttendance, ['id', 'fullName', 'checkInTime', 'status'], 'attendance_history')} className="flex items-center gap-1 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom">
                    <span>⬇</span> Export
                  </button>
                </div>
              </div>

              {/* Scrollable Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                      <th className="py-3 px-5 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={filteredAttendance.length > 0 && selectedAttendanceRows.size === filteredAttendance.length}
                          onChange={handleSelectAllAttendance}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </th>
                      <th className="py-3 px-3 whitespace-nowrap">Staff ID</th>
                      <th className="py-3 px-3 whitespace-nowrap">Name</th>
                      <th className="py-3 px-3 whitespace-nowrap">Check-in Time</th>
                      <th className="py-3 px-3 whitespace-nowrap text-center">Status</th>
                      <th className="py-3 px-5 whitespace-nowrap text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-custom">
                    {filteredAttendance.map(a => (
                      <tr key={a.id} className="theme-table-row group">
                        <td className="py-3.5 px-5">
                          <input
                            type="checkbox"
                            checked={selectedAttendanceRows.has(a.id)}
                            onChange={() => handleSelectAttendanceRow(a.id)}
                            className="accent-blue-600 w-3.5 h-3.5"
                          />
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold">{a.id}</td>
                        <td className="py-3.5 px-3 font-semibold text-sm">{a.fullName}</td>
                        <td className="py-3.5 px-3 text-slate-400 font-mono">{a.checkInTime}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveAttendanceMenu(activeAttendanceMenu === a.id ? null : a.id)}
                            className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                          >
                            ···
                          </button>
                          {activeAttendanceMenu === a.id && (
                            <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                              <button onClick={() => handleEditAttendance(a)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Status</button>
                              <button onClick={() => handleDuplicateAttendance(a)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate Log</button>
                              <button onClick={() => handleShareAttendance(a)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                              <button onClick={() => handleDeleteAttendance(a.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete Log</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">No attendance entries matched filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
                <p className="text-xs text-slate-400 font-mono">Showing {filteredAttendance.length} of {localAttendance.length} records</p>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAFF PERFORMANCE */}
        {activeSubTab === 'Performance' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Departmental Staff & Visitors</h3>
            <p className="text-xs text-muted font-semibold text-slate-500">Comparative chart of active personnel and daily visitor count.</p>
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
