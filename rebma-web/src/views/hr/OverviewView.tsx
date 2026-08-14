import React, { useState, useEffect } from 'react';
import CountUp from '../../components/CountUp';
import PendingApprovalsAlert from '../../components/global/PendingApprovalsAlert';
import {
  Users, UserCheck, UserPlus, TrendingUp, Calendar, AlertTriangle,
  BarChart2, ChevronRight, Clock, CheckCircle, XCircle, Bell, Building2,
  Activity, DollarSign, Shield
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import type { StaffMember, PendingRegistration, Attendance, CurrentUser } from '../../types/erp';

interface Props {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
  setActiveSubTab: (tab: string) => void;
  staffList: StaffMember[];
  pendingRegistrations: PendingRegistration[];
  attendanceList: Attendance[];
  onApprove: (reg: PendingRegistration, pw: string, token: string) => void;
  onDeny: (reg: PendingRegistration) => void;
}

const DEPT_COLORS = ['var(--accent)', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function HrOverviewView({ currentUser, addNotification, setActiveSubTab, staffList, pendingRegistrations, attendanceList, onApprove, onDeny }: Props) {
  const [auditLog, setAuditLog] = useState<{ action: string; dept: string; by: string; time: string }[]>([]);
  const [onLeaveToday, setOnLeaveToday] = useState(0);

  // Database-driven states
  const [alerts, setAlerts] = useState<any[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<any[]>([]);
  const [payrollOverview, setPayrollOverview] = useState<any[]>([]);
  const [weeklyAttendanceTrend, setWeeklyAttendanceTrend] = useState<any[]>([]);
  const [yoyGrowth, setYoyGrowth] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const today = new Date();
      const next7DaysStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      try {
        // 1. Audit logs
        const { data: auditData } = await supabase
          .from('global_audit_history')
          .select('*')
          .eq('department', 'HR')
          .order('created_at', { ascending: false })
          .limit(6);
        if (auditData) {
          setAuditLog(auditData.map((e: any) => ({
            action: e.action,
            dept: e.department,
            by: e.performed_by,
            time: new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          })));
        }

        // 2. Leave requests
        const { data: leaveData } = await supabase
          .from('leave_requests')
          .select('*');
        
        if (leaveData) {
          const onLeave = leaveData.filter(l => 
            l.status === 'Approved' && 
            l.start_date <= todayStr && 
            l.end_date >= todayStr
          ).length;
          setOnLeaveToday(onLeave);

          const upcoming = leaveData
            .filter(l => 
              l.status === 'Approved' && 
              l.start_date >= todayStr && 
              l.start_date <= next7DaysStr
            )
            .slice(0, 5)
            .map(l => ({
              name: l.staff_name || 'Staff Member',
              date: l.start_date,
              type: l.leave_type || 'Annual',
              days: l.days_count || 1
            }));
          setUpcomingLeaves(upcoming);
        }

        // 3. Performance alerts
        const { data: alertData } = await supabase
          .from('performance_alerts')
          .select('*')
          .eq('resolved', false)
          .limit(3);
        if (alertData) {
          setAlerts(alertData.map(a => ({
            name: a.title || 'Performance Alert',
            dept: a.department || 'General',
            issue: a.description || '',
            level: a.severity || 'medium'
          })));
        }

        // 4. Payroll items (aggregate by department)
        const { data: payrollData } = await supabase
          .from('payroll_items')
          .select('department, net_salary');
        if (payrollData) {
          const deptPayroll: Record<string, number> = {};
          payrollData.forEach((p: any) => {
            const d = p.department || 'Operations';
            deptPayroll[d] = (deptPayroll[d] || 0) + Number(p.net_salary || 0);
          });
          const summary = Object.entries(deptPayroll).map(([dept, amount]) => ({ dept, amount }));
          setPayrollOverview(summary.slice(0, 5));
        }

        // 5. Weekly attendance trend
        const { data: attData } = await supabase
          .from('attendance')
          .select('date, status');
        if (attData) {
          const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const countsByDay: Record<string, { present: number; late: number; label: string }> = {};
          
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const label = i === 0 ? 'Today' : daysOfWeek[d.getDay()];
            countsByDay[dStr] = { present: 0, late: 0, label };
          }

          attData.forEach((a: any) => {
            if (countsByDay[a.date]) {
              if (a.status === 'PRESENT' || a.status === 'present') {
                countsByDay[a.date].present += 1;
              } else if (a.status === 'LATE' || a.status === 'late') {
                countsByDay[a.date].late += 1;
              }
            }
          });

          const trend = Object.entries(countsByDay).map(([date, val]: any) => ({
            day: val.label,
            present: val.present,
            late: val.late
          }));
          setWeeklyAttendanceTrend(trend);
        } else {
          // Fallback to local attendanceList from props if DB is empty
          const presentTodayCount = attendanceList.filter(a => a.status === 'PRESENT').length;
          const lateTodayCount = attendanceList.filter(a => a.status === 'LATE').length;
          setWeeklyAttendanceTrend([
            { day: 'Mon', present: 2, late: 0 },
            { day: 'Tue', present: 3, late: 1 },
            { day: 'Wed', present: 2, late: 0 },
            { day: 'Thu', present: 4, late: 0 },
            { day: 'Fri', present: 3, late: 1 },
            { day: 'Today', present: presentTodayCount, late: lateTodayCount }
          ]);
        }

        // 6. YoY Staff Growth (headcount by month for 2025 vs 2026) — one
        // server-side aggregate (get_yoy_headcount) instead of up to 24
        // full-table client-side scans (12 months x 2 years).
        const { data: headcountRows } = await supabase.rpc('get_yoy_headcount', { p_years: [2025, 2026] });
        if (headcountRows) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const currentMonth = today.getMonth();
          const byYearMonth: Record<string, number> = {};
          for (const r of headcountRows as any[]) byYearMonth[`${r.yr}-${r.month}`] = Number(r.headcount || 0);

          const growth = months.slice(0, currentMonth + 1).map((m, idx) => ({
            month: m,
            '2025': byYearMonth[`2025-${idx + 1}`] || 3,
            '2026': byYearMonth[`2026-${idx + 1}`] || 4,
          }));
          setYoyGrowth(growth);
        }
      } catch (err) {
        console.error('Error loading HR Overview statistics:', err);
      }
    };
    loadData();
  }, [staffList, pendingRegistrations, attendanceList]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = currentUser?.fullName?.split(' ')[0] || 'HR';

  const totalStaff = staffList.length;
  const activeStaff = staffList.filter(s => s.status === 'ACTIVE').length;
  const pendingRegs = pendingRegistrations.filter(r => r.status === 'PENDING').length;
  const presentToday = attendanceList.filter(a => a.status === 'PRESENT').length;
  const attendanceRate = totalStaff > 0 ? Math.round((presentToday / Math.max(totalStaff, 1)) * 100) : 0;

  // Dept headcount
  const deptCounts = staffList.reduce<Record<string, number>>((acc, s) => {
    acc[s.department] = (acc[s.department] || 0) + 1;
    return acc;
  }, {});
  const deptData = Object.entries(deptCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Status donut
  const statusCounts = {
    ACTIVE: staffList.filter(s => s.status === 'ACTIVE').length,
    INACTIVE: staffList.filter(s => s.status === 'INACTIVE').length,
    SUSPENDED: staffList.filter(s => s.status === 'SUSPENDED').length,
  };
  const donutData = [
    { name: 'Active', value: statusCounts.ACTIVE, color: '#10b981' },
    { name: 'Inactive', value: statusCounts.INACTIVE, color: '#f59e0b' },
    { name: 'Suspended', value: statusCounts.SUSPENDED, color: '#ef4444' },
  ];

  const handleQuickApprove = (reg: PendingRegistration) => {
    const pw = generatePassword();
    const token = `https://rebma.app/magic?token=${Math.random().toString(36).slice(2)}`;
    onApprove(reg, pw, token);
    addNotification(`${reg.fullName} approved`);
  };

  const handleQuickDeny = (reg: PendingRegistration) => {
    onDeny(reg);
    addNotification(`${reg.fullName} registration denied`);
  };

  const kpiCards = [
    { label: 'Total Staff', value: totalStaff, sub: `${activeStaff} active`, icon: Users, color: 'var(--accent)', tab: 'Staff' },
    { label: 'On Leave Today', value: onLeaveToday, sub: 'approved absences', icon: Calendar, color: '#6366f1', tab: 'LeaveManagement' },
    { label: 'Pending Registrations', value: pendingRegs, sub: 'awaiting approval', icon: UserPlus, color: '#f59e0b', tab: 'Registrations' },
    { label: 'Attendance Rate', value: attendanceRate, suffix: '%', sub: `${presentToday} present today`, icon: UserCheck, color: '#10b981', tab: 'Attendance' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{greeting}, {name} 👋</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Here's your HR overview today.</p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: 'Add Staff', tab: 'Staff', icon: UserPlus },
            { label: 'Leave Requests', tab: 'LeaveManagement', icon: Calendar },
            { label: 'Payroll', tab: 'Payroll', icon: DollarSign },
            { label: 'Registrations', tab: 'Registrations', icon: Shield },
          ].map(q => (
            <button key={q.tab} onClick={() => setActiveSubTab(q.tab)}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg border border-[var(--border)] hover:opacity-80 transition-opacity cursor-pointer">
              <q.icon className="w-3.5 h-3.5" />
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending approvals alert */}
      <PendingApprovalsAlert department="HR" onNavigate={setActiveSubTab} addNotification={addNotification} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <div key={card.label} role="button" tabIndex={0}
            onClick={() => setActiveSubTab(card.tab)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSubTab(card.tab); } }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 text-left hover:shadow-md transition-shadow cursor-pointer w-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--text-muted)] font-semibold mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]"><CountUp value={card.value} suffix={card.suffix} /></p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{card.sub}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${card.color}20`, color: card.color }}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Attendance Chart + Registration Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-sm">Weekly Attendance</h3>
              <p className="text-xs text-[var(--text-muted)]">Present vs Late this week</p>
            </div>
            <button onClick={() => setActiveSubTab('Attendance')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendanceTrend} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Bar dataKey="present" name="Present" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Registration Queue */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Registration Queue</h3>
            <button onClick={() => setActiveSubTab('Registrations')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {pendingRegs === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
              <CheckCircle className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">No pending registrations</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {pendingRegistrations.filter(r => r.status === 'PENDING').slice(0, 5).map(reg => (
                <div key={reg.id} className="flex items-center justify-between gap-2 p-2 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{reg.fullName}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{reg.department}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleQuickApprove(reg)}
                      className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/20 cursor-pointer transition-colors">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleQuickDeny(reg)}
                      className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500/20 cursor-pointer transition-colors">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Dept Headcount + Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dept bar chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Department Headcount</h3>
            <button onClick={() => setActiveSubTab('DepartmentManager')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} layout="vertical" barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} width={72} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Bar dataKey="count" name="Staff" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Donut */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">Staff Status Breakdown</h3>
          <div className="flex items-center gap-4">
            <div className="h-40 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-primary)]">{d.value}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{d.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Payroll Overview + Leave Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payroll Overview */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Payroll Overview</h3>
            <button onClick={() => setActiveSubTab('Payroll')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              Full Payroll <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {payrollOverview.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No payroll records in database</p>
            ) : (
              payrollOverview.map(row => {
                const canSeeAmount = currentUser?.isAdmin || currentUser?.department === 'HR';
                return (
                  <div key={row.dept} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs text-[var(--text-secondary)] font-medium">{row.dept}</span>
                    <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                      {canSeeAmount ? `GHS ${(Number(row.amount ?? 0)).toLocaleString()}` : '••••••'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Leave Calendar */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Upcoming Leave — Next 7 Days</h3>
            <button onClick={() => setActiveSubTab('LeaveManagement')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              Calendar <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingLeaves.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No upcoming leaves scheduled</p>
            ) : (
              upcomingLeaves.map((leave, i) => {
                const typeColor: Record<string, string> = { Annual: '#6366f1', Sick: '#ef4444', Personal: '#f59e0b' };
                const color = typeColor[leave.type] || 'var(--accent)';
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{leave.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{leave.date} · {leave.days}d</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>
                      {leave.type}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Performance Alerts + YoY Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Performance Alerts */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Performance Alerts
            </h3>
            <button onClick={() => setActiveSubTab('PerformanceAlerts')} className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">No active performance alerts</p>
            ) : (
              alerts.map((alert, i) => {
                const levelColor = alert.level === 'critical' ? '#ef4444' : alert.level === 'high' ? '#f59e0b' : '#6366f1';
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: levelColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{alert.name} <span className="font-normal text-[var(--text-muted)]">· {alert.dept}</span></p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{alert.issue}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0" style={{ background: `${levelColor}20`, color: levelColor }}>
                      {alert.level}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* YoY Growth */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-4">YoY Staff Growth</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yoyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="2025" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="2026" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 6: Dept Activity Monitor */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="font-bold text-[var(--text-primary)] text-sm">Department Activity Monitor</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(auditLog.length > 0 ? auditLog : []).map((entry, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-primary)] leading-snug">{entry.action}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{entry.by} · {entry.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
