import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertTriangle,
  Package, CreditCard, DollarSign, Activity, Users, BarChart2,
  ArrowRight, RefreshCw, ChevronDown
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EARNING_DATA = [
  { month: 'Jul', value: 420000 },
  { month: 'Aug', value: 380000 },
  { month: 'Sep', value: 510000 },
  { month: 'Oct', value: 470000 },
  { month: 'Nov', value: 620000 },
  { month: 'Dec', value: 580000 },
];

const SPENDING_DATA = [
  { month: 'Jul', logistics: 45000, operations: 120000, payroll: 85000 },
  { month: 'Aug', logistics: 42000, operations: 110000, payroll: 85000 },
  { month: 'Sep', logistics: 55000, operations: 145000, payroll: 87000 },
  { month: 'Oct', logistics: 48000, operations: 130000, payroll: 87000 },
  { month: 'Nov', logistics: 62000, operations: 160000, payroll: 90000 },
  { month: 'Dec', logistics: 58000, operations: 150000, payroll: 90000 },
];

const CASHFLOW_DATA = [
  { month: 'Jul', income: 420000, expense: 250000 },
  { month: 'Aug', income: 380000, expense: 237000 },
  { month: 'Sep', income: 510000, expense: 287000 },
  { month: 'Oct', income: 470000, expense: 265000 },
  { month: 'Nov', income: 620000, expense: 312000 },
  { month: 'Dec', income: 580000, expense: 298000 },
];

const DEPT_PERF_DATA = [
  { dept: 'OPS', score: 87 },
  { dept: 'FIN', score: 92 },
  { dept: 'MKT', score: 78 },
  { dept: 'LOG', score: 85 },
  { dept: 'DSP', score: 90 },
  { dept: 'HR', score: 83 },
];

const YOY_DATA = [
  { month: 'Jan', thisYear: 380000, lastYear: 310000 },
  { month: 'Feb', thisYear: 420000, lastYear: 340000 },
  { month: 'Mar', thisYear: 390000, lastYear: 360000 },
  { month: 'Apr', thisYear: 450000, lastYear: 380000 },
  { month: 'May', thisYear: 510000, lastYear: 400000 },
  { month: 'Jun', thisYear: 480000, lastYear: 420000 },
  { month: 'Jul', thisYear: 540000, lastYear: 430000 },
  { month: 'Aug', thisYear: 500000, lastYear: 410000 },
  { month: 'Sep', thisYear: 580000, lastYear: 450000 },
  { month: 'Oct', thisYear: 560000, lastYear: 470000 },
  { month: 'Nov', thisYear: 620000, lastYear: 490000 },
  { month: 'Dec', thisYear: 590000, lastYear: 510000 },
];

const STOCK_DATA = [
  { month: 'Aug', in: 850, out: 620 },
  { month: 'Sep', in: 1020, out: 780 },
  { month: 'Oct', in: 940, out: 850 },
  { month: 'Nov', in: 1150, out: 920 },
  { month: 'Dec', in: 1080, out: 980 },
];

const LOW_STOCK = [
  { name: 'Hydraulic Hose Fittings', sku: 'HHF-200', current: 12, capacity: 300 },
  { name: 'PVC Pipe 1/2"', sku: 'PVC-112', current: 28, capacity: 500 },
  { name: 'Copper Wire 2.5mm', sku: 'CW-25', current: 45, capacity: 400 },
  { name: 'Rubber Gaskets', sku: 'RG-88', current: 67, capacity: 600 },
];

const RECENT_TXN = [
  { id: 'TXN-001', description: 'Hydraulic Fittings Purchase', type: 'Debit', amount: 45000, date: '2024-12-10', status: 'Completed' },
  { id: 'TXN-002', description: 'Steel Pipe Sales — Tema Industrial', type: 'Credit', amount: 120000, date: '2024-12-09', status: 'Completed' },
  { id: 'TXN-003', description: 'Logistics Payment — Accra Run', type: 'Debit', amount: 8500, date: '2024-12-08', status: 'Pending' },
  { id: 'TXN-004', description: 'PVC Pipes Bulk Order', type: 'Credit', amount: 78000, date: '2024-12-07', status: 'Completed' },
];

const ACTIVITY_FEED_MOCK = [
  { dept: 'OPERATIONS', action: 'Cargo intake logged: 500 Hydraulic Fittings', time: '5 min ago', icon: Package, color: '#3b82f6' },
  { dept: 'FINANCE', action: 'Invoice #INV-2024-089 marked as paid — GHS 45,000', time: '23 min ago', icon: DollarSign, color: '#10b981' },
  { dept: 'MARKETING', action: 'New order: Tema Industrial — GHS 120,000', time: '1 hr ago', icon: CreditCard, color: '#8b5cf6' },
  { dept: 'HR', action: 'Staff registration submitted: Emmanuel Asante', time: '2 hr ago', icon: Users, color: '#f59e0b' },
  { dept: 'DISPATCH', action: '3 deliveries completed — Accra North route', time: '3 hr ago', icon: CheckCircle, color: '#06b6d4' },
  { dept: 'LOGISTICS', action: 'Vehicle GH-4521-21 scheduled for maintenance', time: '4 hr ago', icon: Activity, color: '#ef4444' },
];

const APPROVAL_PIE = [
  { name: 'Approved', value: 68, color: '#10b981' },
  { name: 'Pending', value: 24, color: '#f59e0b' },
  { name: 'Rejected', value: 8, color: '#ef4444' },
];

const PENDING_APPROVALS_MOCK = [
  { id: 'REQ-001', type: 'Cargo Intake', desc: 'Hydraulic Hose Fittings — 500 units', priority: 'High', amount: 45000 },
  { id: 'REQ-002', type: 'Credit Order', desc: 'Steel Pipe Fittings — Tema Industrial', priority: 'High', amount: 120000 },
  { id: 'REQ-003', type: 'Staff Reg', desc: 'Emmanuel Asante — Warehouse Associate', priority: 'Medium', amount: null },
  { id: 'REQ-004', type: 'Discrepancy', desc: 'Rubber Gaskets — Qty mismatch (200 vs 185)', priority: 'Medium', amount: 3500 },
];

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtGHS(n: number) {
  return `GHS ${(n / 1000).toFixed(0)}K`;
}

export default function MgmtOverviewView({ addNotification, setActiveSubTab, currentUser }: Props) {
  const [pendingCount, setPendingCount] = useState(4);
  const [approvedCount, setApprovedCount] = useState(68);
  const [cashflowTab, setCashflowTab] = useState<'income' | 'expense' | 'savings'>('income');
  const [earnPeriod, setEarnPeriod] = useState('6M');
  const [activities, setActivities] = useState(ACTIVITY_FEED_MOCK);
  const feedRef = useRef<NodeJS.Timeout | null>(null);

  const firstName = currentUser?.fullName?.split(' ')[0] || 'Manager';

  useEffect(() => {
    loadStats();
    feedRef.current = setInterval(refreshFeed, 30000);
    return () => { if (feedRef.current) clearInterval(feedRef.current); };
  }, []);

  async function loadStats() {
    try {
      const { data } = await supabase.from('cargo_intake').select('id, status').eq('status', 'PENDING_MANAGEMENT_APPROVAL');
      if (data) setPendingCount(data.length || 4);
    } catch (_) {}
  }

  async function refreshFeed() {
    try {
      const { data } = await supabase
        .from('global_audit_history')
        .select('*')
        .neq('department', 'CEO')
        .order('created_at', { ascending: false })
        .limit(6);
      if (data && data.length > 0) {
        setActivities(data.map((row: Record<string, unknown>) => ({
          dept: String(row.department || ''),
          action: String(row.action || ''),
          time: timeAgo(String(row.created_at || '')),
          icon: Activity,
          color: 'var(--accent)',
        })));
      }
    } catch (_) {}
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    return `${Math.floor(h / 24)} days ago`;
  }

  const cashflowValue = CASHFLOW_DATA[CASHFLOW_DATA.length - 1];
  const cashflowDisplay = cashflowTab === 'income' ? cashflowValue.income : cashflowTab === 'expense' ? cashflowValue.expense : cashflowValue.income - cashflowValue.expense;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
        <p className="text-[var(--text-muted)] mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {typeof p.value === 'number' && p.value > 999 ? fmtGHS(p.value) : p.value}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Here's what needs your attention today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => { loadStats(); refreshFeed(); addNotification?.('Dashboard refreshed'); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'Approvals Queue', tab: 'CreditApproval', icon: CheckCircle, badge: pendingCount },
          { label: 'Set Prices', tab: 'SetPrices', icon: BarChart2 },
          { label: 'Transactions', tab: 'Transactions', icon: DollarSign },
          { label: 'Audit Log', tab: 'Ledger', icon: Activity },
          { label: 'Dept Activity', tab: 'DeptActivity', icon: Users },
          { label: 'Analytics', tab: 'MgmtAnalytics', icon: TrendingUp },
        ].map(({ label, tab, icon: Icon, badge }) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab?.(tab)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors relative"
          >
            <Icon size={13} />
            {label}
            {badge ? <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ROW 1: KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Revenue', value: 'GHS 580K', change: '+12.3%', up: true, sub: 'vs last month' },
          { label: 'Pending Approvals', value: pendingCount, change: `${PENDING_APPROVALS_MOCK.filter(p => p.priority === 'High').length} high priority`, up: false, sub: 'requires action' },
          { label: 'Avg Profit Margin', value: '52.4%', change: '+2.1%', up: true, sub: 'across products' },
          { label: 'Staff Performance', value: '87/100', change: '+5 pts', up: true, sub: 'this quarter' },
        ].map(({ label, value, change, up, sub }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>{change}</span>
              <span className="text-xs text-[var(--text-muted)]">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2: Earning + Spending */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Earning Overview */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Earning Overview</h3>
              <p className="text-xs text-[var(--text-muted)]">Total revenue trend</p>
            </div>
            <select value={earnPeriod} onChange={e => setEarnPeriod(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none">
              <option value="3M">3 Months</option>
              <option value="6M">6 Months</option>
              <option value="12M">12 Months</option>
            </select>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={EARNING_DATA}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#earnGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending Overview */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Spending Breakdown</h3>
              <p className="text-xs text-[var(--text-muted)]">By category</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Logistics</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Operations</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />Payroll</span>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SPENDING_DATA}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="logistics" name="Logistics" fill="#60a5fa" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="operations" name="Operations" fill="#c084fc" stackId="a" />
                <Bar dataKey="payroll" name="Payroll" fill="var(--accent)" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ROW 3: Cash Flow + Pending Approvals */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Cash Flow */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-3">Cash Flow</h3>
          <div className="flex items-center gap-2 mb-4">
            {(['income', 'expense', 'savings'] as const).map(t => (
              <button key={t} onClick={() => setCashflowTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${cashflowTab === t ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg-input)]'}`} style={cashflowTab === t ? { background: 'var(--accent)' } : {}}>{t}</button>
            ))}
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-4">{fmtGHS(cashflowDisplay)}</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CASHFLOW_DATA}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey={cashflowTab === 'income' ? 'income' : cashflowTab === 'expense' ? 'expense' : 'income'} name={cashflowTab} fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Pending Approvals</h3>
              <p className="text-xs text-[var(--text-muted)]">{pendingCount} requests awaiting action</p>
            </div>
            <button onClick={() => setActiveSubTab?.('CreditApproval')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {PENDING_APPROVALS_MOCK.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl hover:bg-[var(--border)] transition-colors cursor-pointer" onClick={() => setActiveSubTab?.('CreditApproval')}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.priority === 'High' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.desc}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.type} · {item.id}</p>
                </div>
                {item.amount !== null && (
                  <p className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">GHS {(item.amount / 1000).toFixed(0)}K</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 4: Department Performance + Approval Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Dept Performance Bar */}
        <div className="xl:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Department Performance</h3>
              <p className="text-xs text-[var(--text-muted)]">Score out of 100</p>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEPT_PERF_DATA} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="dept" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" name="Score" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Approval Status Donut */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 flex flex-col">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">Approval Status</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">This month</p>
          <div className="relative flex-1 flex items-center justify-center">
            <div style={{ width: 140, height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={APPROVAL_PIE} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65} strokeWidth={0}>
                    {APPROVAL_PIE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-[var(--text-primary)]">{approvedCount + pendingCount + 8}</p>
              <p className="text-xs text-[var(--text-muted)]">Total</p>
            </div>
          </div>
          <div className="space-y-2 mt-3">
            {APPROVAL_PIE.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-[var(--text-secondary)]">{item.name}</span>
                </div>
                <span className="font-semibold text-[var(--text-primary)]">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 5: Department Activity Feed */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Department Activity Feed</h3>
            <p className="text-xs text-[var(--text-muted)]">Auto-refreshes every 30 seconds</p>
          </div>
          <button onClick={() => setActiveSubTab?.('DeptActivity')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            Full Log <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {activities.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}20` }}>
                  <Icon size={14} style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] leading-snug truncate">{a.action}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{a.dept} · {a.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROW 6: Year-on-Year + Low Stock */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* YoY Revenue */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Year-on-Year Revenue</h3>
              <p className="text-xs text-[var(--text-muted)]">2024 vs 2023</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />2024</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />2023</span>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={YOY_DATA}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="thisYear" name="2024" stroke="var(--accent)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lastYear" name="2023" stroke="#9ca3af" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Low Stock Alerts</h3>
              <p className="text-xs text-[var(--text-muted)]">{LOW_STOCK.length} items below threshold</p>
            </div>
            <AlertTriangle size={16} className="text-yellow-500" />
          </div>
          <div className="space-y-4">
            {LOW_STOCK.map(item => {
              const pct = Math.round((item.current / item.capacity) * 100);
              const color = pct < 10 ? '#ef4444' : pct < 20 ? '#f59e0b' : '#10b981';
              return (
                <div key={item.sku}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">{item.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.sku}</p>
                    </div>
                    <p className="text-xs font-semibold" style={{ color }}>{item.current} / {item.capacity}</p>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 7: Recent Transactions + Stock Movement */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Recent Transactions */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Recent Transactions</h3>
            <button onClick={() => setActiveSubTab?.('Transactions')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {RECENT_TXN.map(txn => (
              <div key={txn.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${txn.type === 'Credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {txn.type === 'Credit' ? <TrendingUp size={14} className="text-green-600" /> : <TrendingDown size={14} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{txn.description}</p>
                  <p className="text-xs text-[var(--text-muted)]">{txn.id} · {txn.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${txn.type === 'Credit' ? 'text-green-500' : 'text-red-500'}`}>
                    {txn.type === 'Credit' ? '+' : '-'}GHS {(txn.amount / 1000).toFixed(0)}K
                  </p>
                  <p className={`text-xs ${txn.status === 'Completed' ? 'text-green-500' : 'text-yellow-500'}`}>{txn.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stock In vs Out */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Stock Movement</h3>
              <p className="text-xs text-[var(--text-muted)]">Stock In vs Stock Out</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} />In</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Out</span>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={STOCK_DATA}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="in" name="Stock In" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Stock Out" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
