// src/views/AnalyticsDashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, RefreshCw, TrendingUp, TrendingDown, DollarSign, Users, Package, Truck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { CurrentUser } from '../types/erp';
import { exportToCSV } from '../utils/export';

interface AnalyticsDashboardProps {
  department: string;
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

type Period = '7d' | '30d' | '90d' | '12m';

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d',  label: '7 Days'    },
  { value: '30d', label: '30 Days'   },
  { value: '90d', label: '90 Days'   },
  { value: '12m', label: '12 Months' },
];

const CHART_COLORS = ['var(--accent)', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function StatCard({ label, value, sub, trend, icon: Icon }: { label: string; value: string; sub?: string; trend?: number; icon?: any }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{value}</p>
          {sub && <p className="text-xs text-[var(--text-secondary)] mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[var(--accent)]" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {Math.abs(trend).toFixed(1)}% vs last period
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{title}</h3>
      {children}
    </div>
  );
}

// Generate synthetic trend data for a period
function genTrend(period: Period, label: string) {
  const n = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 12 : 12;
  const isMonth = period === '12m';
  return Array.from({ length: n }, (_, i) => {
    const base = 40 + Math.random() * 60;
    const d = new Date();
    if (isMonth) d.setMonth(d.getMonth() - (n - 1 - i));
    else d.setDate(d.getDate() - (n - 1 - i));
    return {
      name: isMonth
        ? d.toLocaleDateString('en-GB', { month: 'short' })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      [label]: Math.round(base),
    };
  });
}

function genComparison(period: Period) {
  const n = period === '7d' ? 7 : period === '30d' ? 8 : period === '90d' ? 9 : 12;
  return Array.from({ length: n }, (_, i) => ({
    name: `W${i + 1}`,
    Current: Math.round(30 + Math.random() * 70),
    Previous: Math.round(20 + Math.random() * 60),
  }));
}

export default function AnalyticsDashboard({ department, currentUser, addNotification }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(false);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setRevenueData(genTrend(period, 'Value'));
    setActivityData(genTrend(period, 'Activity'));
    setCompareData(genComparison(period));
    setLoading(false);
  }, [period]);

  useEffect(() => {
    load();
    // Generate pie data per department
    const deptPie: Record<string, { name: string; value: number }[]> = {
      CEO: [
        { name: 'Revenue',  value: 42 },
        { name: 'Expenses', value: 28 },
        { name: 'Payroll',  value: 20 },
        { name: 'Other',    value: 10 },
      ],
      FINANCE: [
        { name: 'Invoiced',  value: 55 },
        { name: 'Collected', value: 30 },
        { name: 'Overdue',   value: 15 },
      ],
      HR: [
        { name: 'Active',   value: 68 },
        { name: 'On Leave', value: 12 },
        { name: 'New',      value: 20 },
      ],
      MARKETING: [
        { name: 'Leads',     value: 45 },
        { name: 'Converted', value: 35 },
        { name: 'Lost',      value: 20 },
      ],
      OPERATIONS: [
        { name: 'In Stock',  value: 60 },
        { name: 'Allocated', value: 25 },
        { name: 'Low Stock', value: 15 },
      ],
      DISPATCH: [
        { name: 'Delivered', value: 70 },
        { name: 'In Transit', value: 20 },
        { name: 'Pending',   value: 10 },
      ],
      PRODUCTION: [
        { name: 'Completed', value: 65 },
        { name: 'WIP',       value: 25 },
        { name: 'Defects',   value: 10 },
      ],
      RECEPTION: [
        { name: 'Visitors',   value: 50 },
        { name: 'Staff',      value: 35 },
        { name: 'Scheduled',  value: 15 },
      ],
    };
    setPieData(deptPie[department] || [{ name: 'Activity', value: 100 }]);
  }, [period, department, load]);

  const deptStats: Record<string, { label: string; value: string; sub?: string; trend: number; icon: any }[]> = {
    CEO: [
      { label: 'Total Revenue',    value: 'GHS 2.4M', sub: 'This period',   trend: 12.4,  icon: DollarSign },
      { label: 'Active Depts',     value: '9',        sub: 'All reporting', trend: 0,     icon: Users },
      { label: 'Shipments',        value: '148',      sub: 'This period',   trend: 7.2,   icon: Truck },
      { label: 'Staff Headcount',  value: '63',       sub: 'Total staff',   trend: 3.1,   icon: Users },
    ],
    FINANCE: [
      { label: 'Total Invoiced',   value: 'GHS 890K', sub: 'This period',  trend: 8.5,   icon: DollarSign },
      { label: 'Collected',        value: 'GHS 712K', sub: '80% rate',     trend: 3.2,   icon: TrendingUp },
      { label: 'Overdue',          value: 'GHS 178K', sub: 'Action needed',trend: -5.0,  icon: TrendingDown },
      { label: 'Payroll Cost',     value: 'GHS 245K', sub: 'This month',   trend: 0,     icon: DollarSign },
    ],
    HR: [
      { label: 'Total Staff',      value: '63',       sub: 'Headcount',    trend: 3.1,   icon: Users },
      { label: 'Avg Attendance',   value: '87%',      sub: 'This period',  trend: 2.4,   icon: Users },
      { label: 'Leave Requests',   value: '7',        sub: 'Pending',      trend: 0,     icon: Users },
      { label: 'Open Positions',   value: '4',        sub: 'Recruiting',   trend: 0,     icon: Users },
    ],
    MARKETING: [
      { label: 'Orders Created',   value: '224',      sub: 'This period',  trend: 15.2,  icon: Package },
      { label: 'New Customers',    value: '18',       sub: 'This period',  trend: 9.0,   icon: Users },
      { label: 'Revenue',          value: 'GHS 1.1M', sub: 'This period',  trend: 11.0,  icon: DollarSign },
      { label: 'Avg Order Value',  value: 'GHS 4.9K', sub: 'Per order',    trend: -2.1,  icon: TrendingDown },
    ],
    OPERATIONS: [
      { label: 'Cargo Intakes',    value: '34',       sub: 'This period',  trend: 5.0,   icon: Package },
      { label: 'Stock Items',      value: '1,248',    sub: 'In warehouse', trend: 2.2,   icon: Package },
      { label: 'Fulfillments',     value: '89',       sub: 'This period',  trend: 8.3,   icon: Truck },
      { label: 'Discrepancies',    value: '3',        sub: 'Open',         trend: -33.3, icon: TrendingDown },
    ],
    DISPATCH: [
      { label: 'Deliveries',       value: '96',       sub: 'This period',  trend: 12.0,  icon: Truck },
      { label: 'On-time Rate',     value: '94%',      sub: 'Delivery rate', trend: 3.5,  icon: TrendingUp },
      { label: 'Active Drivers',   value: '8',        sub: 'On route',     trend: 0,     icon: Users },
      { label: 'Avg Delivery Time',value: '2.3 hrs',  sub: 'Per delivery', trend: -8.0,  icon: TrendingDown },
    ],
    PRODUCTION: [
      { label: 'Units Produced',   value: '3,840',    sub: 'This period',  trend: 7.0,   icon: Package },
      { label: 'Defect Rate',      value: '1.2%',     sub: 'Quality',      trend: -15.0, icon: TrendingDown },
      { label: 'Efficiency',       value: '88%',      sub: 'Line uptime',  trend: 4.2,   icon: TrendingUp },
      { label: 'Requisitions',     value: '22',       sub: 'This period',  trend: 0,     icon: Package },
    ],
    RECEPTION: [
      { label: 'Visitors Logged',  value: '312',      sub: 'This period',  trend: 6.0,   icon: Users },
      { label: 'Staff Check-ins',  value: '891',      sub: 'This period',  trend: 2.0,   icon: Users },
      { label: 'Avg Visitors/Day', value: '15',       sub: 'Daily avg',    trend: 6.0,   icon: Users },
      { label: 'Appointments',     value: '47',       sub: 'Scheduled',    trend: 12.5,  icon: Users },
    ],
  };

  const stats = deptStats[department] || deptStats['CEO'];

  const deptTitle: Record<string, string> = {
    CEO: 'Executive Analytics', FINANCE: 'Finance Analytics', HR: 'HR Analytics',
    MARKETING: 'Sales & Marketing Analytics', OPERATIONS: 'Operations Analytics',
    DISPATCH: 'Dispatch Analytics', PRODUCTION: 'Production Analytics',
    RECEPTION: 'Reception Analytics', LOGISTICS: 'Fleet Analytics',
    MANAGEMENT: 'Management Analytics',
  };

  const handleExport = () => {
    exportToCSV(revenueData, Object.keys(revenueData[0] || { name: '', Value: '' }), `analytics_${department.toLowerCase()}_${period}`);
    addNotification('Analytics exported to CSV.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{deptTitle[department] || 'Analytics'}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time performance insights — {currentUser?.department}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-xl overflow-hidden text-[10px] font-semibold">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 cursor-pointer transition-colors ${period === p.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 border border-[var(--border)] rounded-xl hover:bg-[var(--accent-light)] text-[var(--text-secondary)] cursor-pointer" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard key={i} label={s.label} value={s.value} sub={s.sub} trend={s.trend} icon={s.icon} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Trend Overview">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="Value" stroke="var(--accent)" fill="url(#areaGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Current vs Previous Period">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Current"  fill="var(--accent)"  radius={[4,4,0,0]} />
              <Bar dataKey="Previous" fill="var(--accent)" fillOpacity={0.35} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Activity Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={(entry) => `${entry.name ?? ''} ${(((entry.percent as number | undefined) ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Daily Activity">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="Activity" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Department-specific section */}
      {department === 'HR' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Attendance Trend">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={genTrend(period, 'Attendance')}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="Attendance" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Department Headcount">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { dept: 'HR', count: 4 }, { dept: 'Finance', count: 6 }, { dept: 'Ops', count: 8 },
                { dept: 'Mktg', count: 7 }, { dept: 'Prod', count: 12 }, { dept: 'Dispatch', count: 9 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dept" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {(department === 'CEO' || department === 'MANAGEMENT') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Revenue by Department">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { dept: 'Marketing', value: 420 }, { dept: 'Operations', value: 280 },
                { dept: 'Production', value: 380 }, { dept: 'Dispatch', value: 195 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dept" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} unit="K" />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Monthly Cash Flow">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={Array.from({ length: 6 }, (_, i) => {
                const m = new Date(); m.setMonth(m.getMonth() - (5 - i));
                return {
                  name: m.toLocaleDateString('en-GB', { month: 'short' }),
                  Inflow: Math.round(200 + Math.random() * 300),
                  Outflow: Math.round(100 + Math.random() * 200),
                };
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} unit="K" />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Inflow"  stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="Outflow" stroke="#ef4444"        fill="#ef4444"        fillOpacity={0.1}  strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
