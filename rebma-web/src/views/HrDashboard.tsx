// rebma-web/src/views/HrDashboard.tsx

import { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import type { Attendance, PendingRegistration, StaffMember } from '../types/erp';
import { FileSpreadsheet, FileText, Users, Clipboard, ShieldCheck, Activity, UserCheck, UserX, X, Copy, ChevronRight, User, MoreVertical, TrendingUp, TrendingDown } from 'lucide-react';
import MiniSparkline from '../components/MiniSparkline';
import KpiDetailView from '../components/KpiDetailView';
import CountUp from '../components/CountUp';
import { exportToCSV, exportToPDF } from '../utils/export';

interface HrDashboardProps {
  attendanceList: Attendance[];
  barChartData: Array<{ name: string; Staff: number; Visitors: number }>;
  activeSubTab: string;
  addNotification: (msg: string) => void;
  pendingRegistrations: PendingRegistration[];
  staffList: StaffMember[];
  onApprove: (reg: PendingRegistration, pw: string, token: string) => void;
  onDeny: (reg: PendingRegistration) => void;
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const handleSort = (
  field: string,
  currentField: string,
  setField: (f: string) => void,
  currentDir: 'asc' | 'desc',
  setDir: (d: 'asc' | 'desc') => void
) => {
  if (currentField === field) {
    setDir(currentDir === 'asc' ? 'desc' : 'asc');
  } else {
    setField(field);
    setDir('asc');
  }
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
  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
  const [localStaff, setLocalStaff] = useState<StaffMember[]>(staffList);
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>(attendanceList);
  const [approvalLog, setApprovalLog] = useState<Array<{ id: string; name: string; action: 'APPROVED' | 'REJECTED'; password?: string; at: string }>>([]);
  const [activeMobileDetail, setActiveMobileDetail] = useState<{
    type: 'staff' | 'attendance';
    data: StaffMember | Attendance;
  } | null>(null);
  const [credentialsPopup, setCredentialsPopup] = useState<{
    show: boolean;
    fullName: string;
    email: string;
    password?: string;
    magicLink?: string;
  } | null>(null);

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

  // Sorting states for Staff
  const [staffSortField, setStaffSortField] = useState<string>('');
  const [staffSortDir, setStaffSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for Attendance
  const [attendanceSortField, setAttendanceSortField] = useState<string>('');
  const [attendanceSortDir, setAttendanceSortDir] = useState<'asc' | 'desc'>('asc');

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
    { title: 'Total Staff Force', value: localStaff.length, suffix: ' Active', sub: 'Employee database profiles', icon: Users, color: 'text-blue-500' },
    { title: 'Present Today', value: presentToday, suffix: ' Present', sub: 'Check-in registered successfully', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'Late Today', value: lateToday, suffix: ' Late', sub: 'Incidents recorded after 8:00 AM', icon: Activity, color: 'text-rose-500' },
    { title: 'Pending Profiles', value: pendingApprovals, suffix: ' Approvals', sub: 'Registration approval queue', icon: Clipboard, color: 'text-amber-500' },
  ];

  const kpiDetails = [
    { title: 'Total Staff Force', metric: 'Active', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Management',value:8}, {name:'Operations',value:15}, {name:'Admin',value:7}], tableData: [{dept:'Management', count:8, active:7}, {dept:'Operations', count:15, active:14}], columns: [{key:'dept',label:'Department'}, {key:'count',label:'Total'}, {key:'active',label:'Active'}] },
    { title: 'Present Today', metric: 'Present', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Present',value:18}, {name:'Absent',value:4}, {name:'Leave',value:3}], tableData: [{name:'Felicia Asante', dept:'Finance', time:'07:52 AM'}, {name:'Daniel Tetteh', dept:'HR', time:'08:01 AM'}], columns: [{key:'name',label:'Employee'}, {key:'dept',label:'Department'}, {key:'time',label:'Check-in'}] },
    { title: 'Late Today', metric: 'Late', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'On Time',value:21}, {name:'Late',value:4}, {name:'Absent',value:2}], tableData: [{name:'Sandra Opoku', dept:'Operations', mins:15}, {name:'Eric Mensah', dept:'Dispatch', mins:22}], columns: [{key:'name',label:'Employee'}, {key:'dept',label:'Department'}, {key:'mins',label:'Minutes Late'}] },
    { title: 'Pending Profiles', metric: 'Pending', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'Approved',value:12}, {name:'Pending',value:5}, {name:'Rejected',value:2}], tableData: [{name:'James Owusu', role:'Accountant', date:'Jun 10'}, {name:'Abena Frimpong', role:'Dispatcher', date:'Jun 11'}], columns: [{key:'name',label:'Name'}, {key:'role',label:'Role'}, {key:'date',label:'Applied'}] }
  ];


  const handleApprove = (reg: PendingRegistration) => {
    const pw = generatePassword();
    const token = 'tok_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    onApprove(reg, pw, token);
    
    setCredentialsPopup({
      show: true,
      fullName: reg.fullName,
      email: reg.email,
      password: pw,
      magicLink: `https://rebma-web.com/login?token=${token}`
    });

    setApprovalLog(prev => [{ id: reg.id, name: reg.fullName, action: 'APPROVED', password: pw, at: new Date().toLocaleString() }, ...prev]);
    addNotification(`HR approved ${reg.fullName}. Login password and token generated.`);
    // Simulate email
    setTimeout(() => {
      alert(`[SIMULATED EMAIL → ${reg.email}]\nSubject: Your REBMA IMPEX ERP Account is ACTIVE\n\nDear ${reg.fullName},\n\nYour account has been approved.\nDepartment: ${reg.department}\nTemporary Password: ${pw}\nMagic Link URL: https://rebma-web.com/login?token=${token}\n\nPlease reset your password after login.\n\nRebma Impex Ghana Ltd — IT Department`);
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
  const handleAddStaff = async () => {
    const name = await prompt('Enter staff member full name:');
    if (!name) return;
    const dept = await prompt('Enter department (e.g. OPERATIONS, FINANCE, PRODUCTION):', 'OPERATIONS');
    if (!dept) return;
    const role = await prompt('Enter role:', 'Staff Associate');
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

  const handleEditStaff = async (staff: StaffMember) => {
    const newName = await prompt(`Edit name for ${staff.fullName}:`, staff.fullName);
    if (!newName) return;
    const newRole = await prompt(`Edit role for ${staff.fullName}:`, staff.role);
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

  const handleDeleteStaff = async (id: string) => {
    if (!await confirm('Are you sure you want to delete this staff record?')) return;
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
  const handleEditAttendance = async (att: Attendance) => {
    const newStatus = await prompt(`Edit status for ${att.fullName} (PRESENT/LATE):`, att.status);
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

  const handleDeleteAttendance = async (id: string) => {
    if (!await confirm('Are you sure you want to delete this attendance record?')) return;
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

  const sortedStaff = [...filteredStaff].sort((a, b) => {
    if (!staffSortField) return 0;
    const aVal = a[staffSortField as keyof StaffMember];
    const bVal = b[staffSortField as keyof StaffMember];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return staffSortDir === 'asc' ? comp : -comp;
  });

  const sortedAttendance = [...filteredAttendance].sort((a, b) => {
    if (!attendanceSortField) return 0;
    const aVal = a[attendanceSortField as keyof Attendance];
    const bVal = b[attendanceSortField as keyof Attendance];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return attendanceSortDir === 'asc' ? comp : -comp;
  });

  if (activeMobileDetail) {
    return (
      <div className="lg:hidden bg-bg-card min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-text-primary">
        {/* Header with Back button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-bg-card dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 rounded-full text-xs font-bold text-text-secondary dark:text-slate-350 cursor-pointer shadow-card"
          >
            ← Back
          </button>
          <h2 className="text-sm font-bold">Record Details</h2>
        </div>

        {activeMobileDetail.type === 'staff' ? (() => {
          const staff = activeMobileDetail.data as StaffMember;
          return (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-bg-card dark:bg-slate-850 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center font-bold text-xl">
                  {staff.fullName[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-slate-200">{staff.fullName}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{staff.id}</p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-[9px] font-bold uppercase tracking-wider">{staff.department}</span>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-bg-card dark:bg-slate-850 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Email</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{staff.email}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Role</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{staff.role}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Ghana Card</span>
                  <span className="font-mono font-semibold text-text-primary dark:text-slate-200">{staff.ghanaCard}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Phone</span>
                  <span className="font-mono font-semibold text-text-primary dark:text-slate-200">{staff.phone}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Joined</span>
                  <span className="font-semibold text-text-primary dark:text-slate-200">{staff.joinedAt}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Status</span>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${staff.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-text-muted'}`}>{staff.status}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { handleEditStaff(staff); setActiveMobileDetail(null); }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-700 cursor-pointer text-text-primary dark:text-slate-200"
                >
                  Edit Profile
                </button>
                <button 
                  onClick={() => { handleDeleteStaff(staff.id); setActiveMobileDetail(null); }}
                  className="py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Staff
                </button>
              </div>
            </div>
          );
        })() : (() => {
          const att = activeMobileDetail.data as Attendance;
          return (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl ${att.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'}`}>
                  {att.fullName[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-slate-200">{att.fullName}</h3>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{att.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Clock-In Time</span>
                  <span className="font-semibold font-mono text-text-primary dark:text-slate-200">{att.checkInTime}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-text-muted font-medium">Status</span>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${att.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{att.status}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { handleEditAttendance(att); setActiveMobileDetail(null); }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-700 cursor-pointer text-text-primary dark:text-slate-200"
                >
                  Edit Status
                </button>
                <button 
                  onClick={() => { handleDeleteAttendance(att.id); setActiveMobileDetail(null); }}
                  className="py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Log
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }


  if (kpiDetail !== null) {
    const d = kpiDetails[kpiDetail];
    return <KpiDetailView title={d.title} metric={d.metric} trendData={d.trendData} breakdownData={d.breakdownData} tableData={d.tableData} columns={d.columns} onBack={() => setKpiDetail(null)} />;
  }
  return (
    <>
      {/* ══ MOBILE LAYOUT (< lg) ══ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Human Resources</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Staff management & attendance</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(localAttendance, ['id', 'fullName', 'checkInTime', 'status'], 'hr_attendance')} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card"><FileSpreadsheet className="w-4 h-4 text-text-secondary" /></button>
            <button onClick={() => exportToPDF('Daily Staff Attendance Log', localAttendance, ['id', 'fullName', 'checkInTime', 'status'])} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card"><FileText className="w-4 h-4 text-text-secondary" /></button>
          </div>
        </div>

        {/* Physical card */}
        <div className="mobile-physical-card">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Total Staff Force</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{localStaff.length} Active</h2>
              <p className="text-[10px] text-white/70 mt-1">{presentToday} Present Today • {lateToday} Late</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">{pendingApprovals} Pending Approvals</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">HR Management System</p>
            </div>
            <div className="mobile-card-circles"><div className="mobile-card-circle-1" /><div className="mobile-card-circle-2" /></div>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Present Today', value: `${presentToday}`, sub: 'Checked in', bg: '#f0fdf4', color: '#16a34a', icon: ShieldCheck },
            { label: 'Pending', value: `${pendingApprovals}`, sub: 'Approval queue', bg: '#fef3c7', color: '#d97706', icon: Clipboard },
          ].map((s, i) => { const Icon = s.icon; return (
            <div key={i} className="mobile-stat-card">
              <div className="mobile-stat-icon" style={{ background: s.bg }}><Icon className="w-5 h-5" style={{ color: s.color }} /></div>
              <div className="min-w-0">
                <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider truncate">{s.label}</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{s.value}</p>
                <p className="text-[9px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ); })}
        </div>

        {/* Staff list */}
        <div>
          <p className="mobile-section-label">Staff Directory</p>
          <div className="space-y-2">
            {localStaff.slice(0, 8).map(s => (
              <div key={s.id} onClick={() => setActiveMobileDetail({ type: 'staff', data: s })} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>{s.fullName[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{s.fullName}</p>
                  <p className="text-[10px] text-text-muted truncate">{s.department} • {s.role}</p>
                </div>
                <span className={`mobile-status-pill ${s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-input text-text-secondary'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending approvals */}
        {pendingRegistrations.length > 0 && (
          <div>
            <p className="mobile-section-label">Pending Approvals</p>
            <div className="space-y-2">
              {pendingRegistrations.map(r => (
                <div key={r.id} className="mobile-data-row">
                  <div className="mobile-data-row-icon" style={{ background: '#fef3c7', color: '#d97706' }}>{r.fullName[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">{r.fullName}</p>
                    <p className="text-[10px] text-text-muted truncate">{r.department}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleApprove(r)} className="mobile-status-pill bg-emerald-50 text-emerald-700 cursor-pointer">✓ Approve</button>
                    <button onClick={() => handleDeny(r)} className="mobile-status-pill bg-rose-50 text-rose-700 cursor-pointer">✗ Deny</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ DESKTOP LAYOUT (lg+) ══ */}
      <div className="hidden lg:block text-[var(--text-primary)]">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Human Resources Workspace</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">Manage staff registrations, approvals, and daily attendance tracking.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => exportToCSV(localAttendance, ['id', 'fullName', 'checkInTime', 'status'], 'hr_attendance')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-transparent transition-all">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Attendance (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Daily Staff Attendance Log', localAttendance, ['id', 'fullName', 'checkInTime', 'status'])} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-transparent transition-all">
            <FileText className="w-3.5 h-3.5" /><span>Attendance (PDF)</span>
          </button>
        </div>
      </div>
 
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          const isProminent = idx < 2;
          return (
            <div key={idx} onClick={() => setKpiDetail(idx)} className="kpi-card group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setCardMenuOpen(cardMenuOpen === idx ? null : idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-[var(--accent-light)]">
                    <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                  {cardMenuOpen === idx && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                      <button onClick={() => { setKpiDetail(idx); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">View Details</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToCSV(d.tableData, d.columns.map(c => c.key), d.title.replace(/\s/g,'_').toLowerCase()); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export CSV</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToPDF(d.title, d.tableData, d.columns.map(c => c.label)); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export PDF</button>
                      <button onClick={() => { setCardMenuOpen(null); addNotification(`${stats[idx].title} refreshed.`); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Refresh</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between mt-2 gap-2">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none"><CountUp value={card.value} suffix={card.suffix} /></h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{card.sub}</p>
                </div>
                <MiniSparkline width={60} height={36} />
              </div>
            </div>
          );
        })}
      </div>
 
      {/* Chart */}
      <div className="p-4 sm:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)]">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Attendance & On-Time Performance Index</h3>
        <p className="text-xs text-[var(--text-muted)]">Weekly present vs late clock-in trends.</p>
        <div className="h-[200px] sm:h-60 lg:h-[300px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="Present" stroke="var(--accent)" strokeWidth={2.5} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Late" stroke="#f43f5e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
 
      {/* Tab views */}
      <div className="border-t border-[var(--border)] pt-6">
 
        {/* EMPLOYEE DATABASE */}
        {activeSubTab === 'Employees' && (
          <div className="space-y-6">
            {/* Registration Approval Queue */}
            <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">New Registration Approval Queue</h3>
              <p className="text-xs text-[var(--text-muted)]">Approve to generate login password & email; Deny to send rejection notice.</p>
              <div className="divide-y divide-[var(--border)]">
                {pendingRegistrations.filter(r => r.status === 'PENDING').map(reg => (
                  <div key={reg.id}>
                    {/* Mobile list card layout */}
                    <div className="lg:hidden mobile-list-card">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-[var(--accent,#068d5c)]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-primary dark:text-slate-200">{reg.fullName}</p>
                          <p className="text-xs text-text-muted font-medium">{reg.email}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">Dept: {reg.department} | Card: {reg.ghanaCard}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleApprove(reg)} className="p-2 bg-blue-600 text-white rounded-lg text-xs font-bold" title="Approve">✓</button>
                          <button onClick={() => handleDeny(reg)} className="p-2 bg-bg-input text-text-secondary dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-bold" title="Deny">✗</button>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </div>
 
                    {/* Desktop layout */}
                    <div className="hidden lg:flex py-4 items-center justify-between gap-3 border-b border-[var(--border)]">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{reg.fullName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{reg.email} | Dept: <strong>{reg.department}</strong></p>
                        {reg.phone && <p className="text-[10px] text-[var(--text-muted)]">Phone: {reg.phone}</p>}
                        <p className="text-[10px] text-[var(--text-muted)]">Ghana Card: <code className="bg-[var(--bg)] text-[var(--text-primary)] border border-[var(--border)] px-1.5 py-0.5 rounded">{reg.ghanaCard}</code> | Submitted: {reg.submittedAt}</p>
                      </div>
                      <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                        <button onClick={() => handleApprove(reg)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-bold cursor-pointer transition-all">
                          <UserCheck className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleDeny(reg)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-xs font-bold cursor-pointer transition-all">
                          <UserX className="w-3.5 h-3.5" /> Deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingRegistrations.filter(r => r.status === 'PENDING').length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-6">No pending registrations.</p>
                )}
              </div>
 
              {/* Approval log */}
              {approvalLog.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-bold text-[var(--text-muted)] mb-2">Recent Decisions</p>
                  <div className="space-y-2">
                    {approvalLog.slice(0, 5).map((log, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl text-[10px] ${log.action === 'APPROVED' ? 'bg-[var(--accent-light)] border border-[var(--accent)] text-[var(--text-primary)]' : 'bg-red-50/50 dark:bg-rose-950/10 border border-red-200 text-red-600'}`}>
                        <span className="font-semibold">{log.name}</span>
                        {log.action === 'APPROVED' && log.password && (
                          <span className="text-[var(--text-muted)]">Password: <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--border)]">{log.password}</code></span>
                        )}
                        <span className={`font-bold ${log.action === 'APPROVED' ? 'text-[var(--accent)]' : 'text-red-500'}`}>{log.action}</span>
                        <span className="text-[var(--text-muted)]">{log.at}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
 
            {/* Staff Members Table */}
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] overflow-hidden">
              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">Staff Members Directory</h3>
                  <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-2.5 py-0.5 rounded-full">{filteredStaff.length} users</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-text-muted text-xs pointer-events-none">🔍</span>
                    <input
                      type="text"
                      placeholder="Search staff…"
                      value={staffSearch}
                      onChange={e => setStaffSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder-slate-400 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition w-40"
                    />
                  </div>
                  {/* Status Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsStaffFilterOpen(!isStaffFilterOpen); }}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] px-3 py-1.5 rounded-lg transition-all border-none font-semibold cursor-pointer"
                    >
                      <span>Filter: {staffStatusFilter === 'ALL' ? 'All' : staffStatusFilter}</span>
                      <span className="text-[10px]">▼</span>
                    </button>
                    {isStaffFilterOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                        {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => { setStaffStatusFilter(st); setIsStaffFilterOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)] cursor-pointer"
                          >
                            <span className={`w-2 h-2 rounded-full ${st === 'ACTIVE' ? 'bg-emerald-400' : st === 'INACTIVE' ? 'bg-rose-400' : 'bg-text-muted'}`} />
                            {st === 'ALL' ? 'All Status' : st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Export */}
                  <button onClick={() => exportToCSV(filteredStaff, ['id', 'fullName', 'email', 'department', 'role', 'ghanaCard', 'phone', 'joinedAt', 'status'], 'staff_directory')} className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] px-3 py-1.5 rounded-lg transition-all border-none font-semibold cursor-pointer">
                    <span>⬇</span> Export
                  </button>
                  {/* Add Staff */}
                  <button onClick={handleAddStaff} className="flex items-center gap-1.5 text-xs text-white bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] hover:opacity-90 px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer">
                    <span>＋</span> Add Staff
                  </button>
                </div>
              </div>
 
              {/* Scrollable table / Card lists */}
              <div>
                {/* Mobile Card List */}
                <div className="lg:hidden space-y-3 p-4">
                  {sortedStaff.map(staff => (
                    <div 
                      key={staff.id} 
                      onClick={() => setActiveMobileDetail({ type: 'staff', data: staff })}
                      className="bg-bg-card dark:bg-slate-855 rounded-2xl shadow-card p-4 border border-[var(--border)] dark:border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-550 text-white flex items-center justify-center font-bold text-base shrink-0">
                          {staff.fullName[0]}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary dark:text-slate-200">{staff.fullName}</h4>
                          <p className="text-xs text-text-muted font-semibold">{staff.role}</p>
                          <p className="text-[10px] text-text-muted mt-0.5 font-mono">...{staff.id.slice(-8)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${staff.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-text-muted'}`}>
                          {staff.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </div>
                  ))}
                  {filteredStaff.length === 0 && (
                    <div className="p-8 text-center text-text-muted text-xs bg-bg-card dark:bg-slate-855 rounded-2xl">No staff members found.</div>
                  )}
                </div>
 
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto w-full animate-fade-in">
                  <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
                      <th className="py-3 px-5 whitespace-nowrap w-12">
                        <input
                          type="checkbox"
                          checked={filteredStaff.length > 0 && selectedStaffRows.size === filteredStaff.length}
                          onChange={handleSelectAllStaff}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </th>
                      <th onClick={() => handleSort('id', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <span>Staff ID</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'id' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('fullName', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                        <div className="flex items-center gap-1">
                          <span>Name</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'fullName' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('department', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                        <div className="flex items-center gap-1">
                          <span>Department</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'department' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('role', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <span>Role</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'role' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('ghanaCard', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <span>Ghana Card</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'ghanaCard' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('phone', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <span>Phone</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'phone' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('joinedAt', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <span>Joined</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'joinedAt' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('status', staffSortField, setStaffSortField, staffSortDir, setStaffSortDir)} className="py-3 px-3 whitespace-nowrap text-center cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                          <span className="text-[9px] opacity-70">{staffSortField === 'status' ? (staffSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th className="py-3 px-5 whitespace-nowrap text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {sortedStaff.map(staff => (
                      <tr key={staff.id} className="hover:bg-[var(--accent-light)] text-[var(--text-primary)] transition-colors duration-150 cursor-pointer" onClick={() => setActiveMobileDetail({ type: 'staff', data: staff })}>
                        <td className="py-3.5 px-5">
                          <input
                            type="checkbox"
                            checked={selectedStaffRows.has(staff.id)}
                            onChange={() => handleSelectStaffRow(staff.id)}
                            className="accent-[var(--accent)] w-3.5 h-3.5"
                          />
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold hidden sm:table-cell text-[var(--text-muted)]" title={staff.id}>
                          ...{staff.id.slice(-8)}
                        </td>
                        <td className="py-3.5 px-3 font-medium">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-[var(--text-primary)]">{staff.fullName}</span>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">{staff.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full text-[9px] font-bold">{staff.department}</span>
                        </td>
                        <td className="py-3.5 px-3 text-[var(--text-primary)] opacity-90 hidden sm:table-cell">{staff.role}</td>
                        <td className="py-3.5 px-3 font-mono text-[10px] text-[var(--text-muted)] hidden md:table-cell">{staff.ghanaCard}</td>
                        <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono hidden md:table-cell">{staff.phone}</td>
                        <td className="py-3.5 px-3 text-[var(--text-muted)] text-[10px] font-mono hidden lg:table-cell">{staff.joinedAt}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${staff.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-text-muted'}`}>
                            {staff.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveStaffMenu(activeStaffMenu === staff.id ? null : staff.id)}
                            className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] border border-[var(--border)] rounded-lg text-text-secondary dark:text-slate-400 transition-colors select-none"
                          >
                            ···
                          </button>
                          {activeStaffMenu === staff.id && (
                            <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                              <button onClick={() => handleEditStaff(staff)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">✏ Edit</button>
                              <button onClick={() => handleDuplicateStaff(staff)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">📋 Duplicate</button>
                              <button onClick={() => handleShareStaff(staff)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">🔗 Share Link</button>
                              <div className="h-px bg-[var(--border)] my-1"></div>
                              <button onClick={() => handleDeleteStaff(staff.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer">🗑 Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-[var(--text-muted)]">No staff members found.</td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
 
              {/* Table Footer / Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredStaff.length} of {localStaff.length} profiles</p>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded-lg border border-[var(--border)] cursor-not-allowed opacity-50" disabled>‹</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded-lg border border-[var(--border)] cursor-not-allowed opacity-50" disabled>›</button>
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* ATTENDANCE RECORDS */}
        {activeSubTab === 'Attendance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Today's Attendance — max 5 visible, rest scrollable */}
            <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Today's Attendance Logs</h3>
              <p className="text-xs text-[var(--text-muted)]">Showing today's check-ins (scroll for more).</p>
              {/* First 5 always visible */}
              <div className="space-y-2">
                {localAttendance.slice(0, 5).map(a => (
                  <div key={a.id}>
                    {/* Mobile list card layout */}
                    <div className="lg:hidden mobile-list-card">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          <User className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-primary dark:text-slate-200">{a.fullName}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">Checked In: {a.checkInTime}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{a.status}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                    </div>
 
                    {/* Desktop layout */}
                    <div className="hidden lg:flex justify-between items-center p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{a.fullName}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">Checked In: {a.checkInTime}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-550 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'}`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Overflow scrollable */}
              {localAttendance.length > 5 && (
                <div className="max-h-48 overflow-y-auto space-y-2 border-t border-[var(--border)] pt-2 pr-1">
                  {localAttendance.slice(5).map(a => (
                    <div key={a.id}>
                      {/* Mobile list card layout */}
                      <div className="lg:hidden mobile-list-card">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            <User className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-primary dark:text-slate-200">{a.fullName}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">Checked In: {a.checkInTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{a.status}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                        </div>
                      </div>
 
                      {/* Desktop layout */}
                      <div className="hidden lg:flex justify-between items-center p-3 bg-[var(--bg)] rounded-xl opacity-90 hover:opacity-100 transition-opacity border border-[var(--border)]">
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{a.fullName}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{a.checkInTime}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-550 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'}`}>{a.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
 
            {/* Attendance History Table */}
            <div className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] overflow-hidden lg:col-span-2">
              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">Attendance Log Ledger</h3>
                  <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-2.5 py-0.5 rounded-full">{filteredAttendance.length} records</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-text-muted text-xs pointer-events-none">🔍</span>
                    <input
                      type="text"
                      placeholder="Search name…"
                      value={attendanceSearch}
                      onChange={e => setAttendanceSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder-slate-400 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition w-36"
                    />
                  </div>
                  {/* Status Dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsAttendanceFilterOpen(!isAttendanceFilterOpen); }}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] px-3 py-1.5 rounded-lg transition-all border-none font-semibold cursor-pointer"
                    >
                      <span>Filter: {attendanceStatusFilter === 'ALL' ? 'All' : attendanceStatusFilter}</span>
                      <span className="text-[10px]">▼</span>
                    </button>
                    {isAttendanceFilterOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                        {(['ALL', 'PRESENT', 'LATE'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => { setAttendanceStatusFilter(st); setIsAttendanceFilterOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)] cursor-pointer"
                          >
                            <span className={`w-2 h-2 rounded-full ${st === 'PRESENT' ? 'bg-emerald-400' : st === 'LATE' ? 'bg-amber-400' : 'bg-text-muted'}`} />
                            {st === 'ALL' ? 'All Logs' : st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Export */}
                  <button onClick={() => exportToCSV(filteredAttendance, ['id', 'fullName', 'checkInTime', 'status'], 'attendance_history')} className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] px-3 py-1.5 rounded-lg transition-all border-none font-semibold cursor-pointer">
                    <span>⬇</span> Export
                  </button>
                </div>
              </div>
 
              {/* Scrollable Table / Card List */}
              <div>
                {/* Mobile Card List (lg:hidden, unchanged) */}
                <div className="lg:hidden space-y-3 p-4">
                  {sortedAttendance.map(a => (
                    <div 
                      key={a.id} 
                      onClick={() => setActiveMobileDetail({ type: 'attendance', data: a })}
                      className="bg-bg-card dark:bg-slate-855 rounded-2xl shadow-card p-4 border border-[var(--border)] dark:border-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {a.fullName[0]}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary dark:text-slate-200">{a.fullName}</h4>
                          <p className="text-xs text-text-muted font-semibold">{a.checkInTime}</p>
                          <p className="text-[10px] text-text-muted mt-0.5 font-mono">{a.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {a.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </div>
                  ))}
                  {filteredAttendance.length === 0 && (
                    <div className="p-8 text-center text-text-muted text-xs bg-bg-card dark:bg-slate-855 rounded-2xl">No attendance entries matched filters.</div>
                  )}
                </div>
 
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto w-full">
                  <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
                      <th className="py-3 px-5 whitespace-nowrap w-12">
                        <input
                          type="checkbox"
                          checked={filteredAttendance.length > 0 && selectedAttendanceRows.size === filteredAttendance.length}
                          onChange={handleSelectAllAttendance}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </th>
                      <th onClick={() => handleSort('id', attendanceSortField, setAttendanceSortField, attendanceSortDir, setAttendanceSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none w-28">
                        <div className="flex items-center gap-1">
                          <span>Staff ID</span>
                          <span className="text-[9px] opacity-70">{attendanceSortField === 'id' ? (attendanceSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('fullName', attendanceSortField, setAttendanceSortField, attendanceSortDir, setAttendanceSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                        <div className="flex items-center gap-1">
                          <span>Name</span>
                          <span className="text-[9px] opacity-70">{attendanceSortField === 'fullName' ? (attendanceSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('checkInTime', attendanceSortField, setAttendanceSortField, attendanceSortDir, setAttendanceSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none w-36">
                        <div className="flex items-center gap-1">
                          <span>Check-in Time</span>
                          <span className="text-[9px] opacity-70">{attendanceSortField === 'checkInTime' ? (attendanceSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th onClick={() => handleSort('status', attendanceSortField, setAttendanceSortField, attendanceSortDir, setAttendanceSortDir)} className="py-3 px-3 whitespace-nowrap text-center cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none w-28">
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                          <span className="text-[9px] opacity-70">{attendanceSortField === 'status' ? (attendanceSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </div>
                      </th>
                      <th className="py-3 px-5 whitespace-nowrap text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {sortedAttendance.map(a => (
                      <tr key={a.id} className="hover:bg-[var(--accent-light)] text-[var(--text-primary)] transition-colors duration-150">
                        <td className="py-3.5 px-5">
                          <input
                            type="checkbox"
                            checked={selectedAttendanceRows.has(a.id)}
                            onChange={() => handleSelectAttendanceRow(a.id)}
                            className="accent-[var(--accent)] w-3.5 h-3.5"
                          />
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-[var(--text-muted)]">{a.id}</td>
                        <td className="py-3.5 px-3 font-semibold text-sm">{a.fullName}</td>
                        <td className="py-3.5 px-3 text-[var(--text-muted)] font-mono">{a.checkInTime}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${a.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveAttendanceMenu(activeAttendanceMenu === a.id ? null : a.id)}
                            className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] border border-[var(--border)] rounded-lg text-text-secondary dark:text-slate-400 transition-colors select-none"
                          >
                            ···
                          </button>
                          {activeAttendanceMenu === a.id && (
                            <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                              <button onClick={() => handleEditAttendance(a)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">✏ Edit Status</button>
                              <button onClick={() => handleDuplicateAttendance(a)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">📋 Duplicate Log</button>
                              <button onClick={() => handleShareAttendance(a)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">🔗 Share Link</button>
                              <div className="h-px bg-[var(--border)] my-1"></div>
                              <button onClick={() => handleDeleteAttendance(a.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer">🗑 Delete Log</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">No attendance entries matched filters.</td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
 
              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] font-mono">Showing {filteredAttendance.length} of {localAttendance.length} records</p>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded-lg border border-[var(--border)] cursor-not-allowed opacity-50" disabled>‹</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                  <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded-lg border border-[var(--border)] cursor-not-allowed opacity-50" disabled>›</button>
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* STAFF PERFORMANCE */}
        {activeSubTab === 'Performance' && (
          <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Departmental Staff & Visitors</h3>
            <p className="text-xs text-[var(--text-muted)] font-semibold">Comparative chart of active personnel and daily visitor count.</p>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="Staff" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Visitors" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* INSTANT HR POPUP MODAL */}
        {credentialsPopup && credentialsPopup.show && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] border-0 md:border border-[var(--border)] rounded-none md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-md overflow-y-auto p-6 space-y-4 text-[var(--text-primary)] flex flex-col justify-center md:block">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="font-bold text-lg text-emerald-500">Account Credentials Generated</h3>
                <button 
                  onClick={() => setCredentialsPopup(null)}
                  className="text-text-muted hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-xs leading-relaxed text-[var(--text-primary)] opacity-90">
                <p><strong>Employee:</strong> {credentialsPopup.fullName} ({credentialsPopup.email})</p>
                <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)] font-mono space-y-2 relative">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Temporary Password</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 break-all select-all">{credentialsPopup.password}</p>
                  <div className="h-px bg-[var(--border)] my-2"></div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Magic Link URL</p>
                  <p className="text-[11px] text-blue-500 hover:underline break-all select-all">{credentialsPopup.magicLink}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const text = `Dear ${credentialsPopup.fullName},\n\nYour REBMA ERP account has been approved!\n\nStandard Login:\nEmail: ${credentialsPopup.email}\nTemporary Password: ${credentialsPopup.password}\n\nOne-Click Magic Link:\n${credentialsPopup.magicLink}\n\nPlease reset your password upon login.\nRebma Impex Ghana Ltd.`;
                    navigator.clipboard.writeText(text);
                    alert('Credentials copied to clipboard!');
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold transition-all text-sm cursor-pointer shadow-card shadow-emerald-600/20 text-center"
                >
                  📋 Copy Credentials
                </button>
                <button
                  onClick={() => setCredentialsPopup(null)}
                  className="px-4 py-2.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-xl transition-all font-semibold text-xs border border-[var(--border)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
