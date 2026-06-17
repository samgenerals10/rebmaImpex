import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, ClipboardCheck, ShieldCheck, Users, DollarSign, Download, BarChart2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';

interface Props { addNotification: (msg: string) => void }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const thisMonth = new Date().getMonth();

const approvalActivity = MONTHS.slice(0, thisMonth + 1).map((m, i) => ({
  month: m,
  cargo: Math.round(8 + Math.random() * 12 + i * 0.5),
  credit: Math.round(4 + Math.random() * 8),
  staff: Math.round(1 + Math.random() * 4),
}));

const yoyData = MONTHS.slice(0, thisMonth + 1).map((m, i) => ({
  month: m,
  current: Math.round(180000 + Math.random() * 80000 + i * 12000),
  previous: Math.round(140000 + Math.random() * 60000 + i * 8000),
}));

const deptRevenue = [
  { dept: 'Operations', revenue: 480000 },
  { dept: 'Marketing',  revenue: 320000 },
  { dept: 'Finance',    revenue: 290000 },
  { dept: 'Dispatch',   revenue: 180000 },
  { dept: 'Production', revenue: 150000 },
  { dept: 'HR',         revenue: 90000 },
  { dept: 'Reception',  revenue: 45000 },
].sort((a, b) => b.revenue - a.revenue);

const approvalStatus = [
  { name: 'Approved',   value: 148, color: '#10b981' },
  { name: 'In Review',  value: 34,  color: '#f59e0b' },
  { name: 'Pending',    value: 22,  color: '#6366f1' },
  { name: 'Rejected',   value: 18,  color: '#f43f5e' },
];

const performanceHeatmap = [
  { dept: 'Operations', w1: 92, w2: 88, w3: 95, w4: 90 },
  { dept: 'Finance',    w1: 85, w2: 91, w3: 87, w4: 93 },
  { dept: 'Marketing',  w1: 78, w2: 82, w3: 88, w4: 80 },
  { dept: 'Dispatch',   w1: 95, w2: 92, w3: 96, w4: 94 },
  { dept: 'HR',         w1: 72, w2: 68, w3: 75, w4: 70 },
  { dept: 'Reception',  w1: 88, w2: 90, w3: 85, w4: 92 },
  { dept: 'Production', w1: 80, w2: 84, w3: 79, w4: 86 },
];

const heatColor = (v: number) =>
  v >= 90 ? 'bg-emerald-500/80 text-white' :
  v >= 80 ? 'bg-emerald-400/50 text-emerald-800' :
  v >= 70 ? 'bg-amber-400/50 text-amber-800' :
  'bg-rose-400/50 text-rose-800';

// recentDecisions loaded from Supabase below

const PERIODS = ['7D', '30D', '90D', '12M'] as const;
type Period = typeof PERIODS[number];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-[var(--text-primary)] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 10000 ? `GHS ${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  );
};

interface Decision { date: string; type: string; description: string; decision: string; outcome: string; ref: string; }

export default function MgmtAnalyticsView({ addNotification }: Props) {
  const [period, setPeriod] = useState<Period>('30D');
  const [totalApprovals, setTotalApprovals] = useState(0);
  const [approvalRate, setApprovalRate] = useState(0);
  const [revenueGrowth] = useState(0);
  const [staffScore] = useState(0);
  const [recentDecisions, setRecentDecisions] = useState<Decision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [appRes, rejRes] = await Promise.all([
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
          supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
        ]);
        const approved = appRes.count ?? 0;
        const rejected = rejRes.count ?? 0;
        const total = approved + rejected;
        setTotalApprovals(total);
        setApprovalRate(total > 0 ? Math.round((approved / total) * 100) : 0);
      } catch {}

      try {
        const { data } = await supabase
          .from('global_audit_history')
          .select('*')
          .eq('department', 'MANAGEMENT')
          .order('timestamp', { ascending: false })
          .limit(10);
        if (data && data.length > 0) {
          setRecentDecisions(data.map((r: any) => ({
            date: r.timestamp ? r.timestamp.split('T')[0] : '',
            type: r.action?.replace(/_/g, ' ') ?? '—',
            description: r.details ?? '—',
            decision: r.action?.includes('REJECT') ? 'Rejected' : r.action?.includes('APPROVE') ? 'Approved' : 'Actioned',
            outcome: r.details ?? '—',
            ref: r.id?.slice(0, 8) ?? '—',
          })));
        } else {
          setRecentDecisions([]);
        }
      } catch {
        setRecentDecisions([]);
      } finally {
        setLoadingDecisions(false);
      }
    };
    load();
  }, []);

  const handleExport = () => {
    exportToCSV(recentDecisions, ['date','type','description','decision','outcome','ref'], 'management_analytics');
    addNotification('Management analytics exported to CSV.');
  };

  const KPI_CARDS = [
    { label: 'Total Approvals Made', value: totalApprovals.toLocaleString(), change: +18, icon: ClipboardCheck, color: 'var(--accent)' },
    { label: 'Approval Rate', value: `${approvalRate}%`, change: +2.1, icon: ShieldCheck, color: '#10b981' },
    { label: 'Revenue Growth', value: `+${revenueGrowth}%`, change: +3.2, icon: TrendingUp, color: '#8b5cf6' },
    { label: 'Staff Performance', value: `${staffScore}/100`, change: +4, icon: Users, color: '#f59e0b' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Management Analytics</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Approval trends, revenue performance & department insights (CEO excluded)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${period === p ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{p}</button>
            ))}
          </div>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-semibold transition-opacity cursor-pointer shadow">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wide">{card.label}</p>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${card.change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {card.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{card.change > 0 ? '+' : ''}{card.change} vs last period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 1: Approval Activity + Status Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Approval Activity by Type</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={approvalActivity} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Bar dataKey="cargo" name="Cargo" fill="var(--accent)" radius={[3,3,0,0]} />
              <Bar dataKey="credit" name="Credit" fill="#8b5cf6" radius={[3,3,0,0]} />
              <Bar dataKey="staff"  name="Staff Reg." fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Approval Status Distribution</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={approvalStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0}>
                  {approvalStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} approvals`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {approvalStatus.map(s => (
                <div key={s.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-[var(--text-secondary)]">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{s.value}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-1">({Math.round(s.value / approvalStatus.reduce((a,b) => a+b.value,0) * 100)}%)</span>
                  </div>
                </div>
              ))}
              <div className="mt-1 pt-2 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)]">Total: <strong className="text-[var(--text-primary)]">{approvalStatus.reduce((a,b) => a+b.value,0)}</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Revenue by Dept + Year-on-Year */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Revenue by Department</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptRevenue} layout="vertical" margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="dept" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`GHS ${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[0,4,4,0]}>
                {deptRevenue.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 18}, 70%, 55%)`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Year on Year Comparison</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={yoyData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="currGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Line type="monotone" dataKey="current" name="Current Year" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="previous" name="Last Year" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Heatmap */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Department Performance Heatmap (Activity Score / 100)</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Green ≥ 90 · Teal ≥ 80 · Amber ≥ 70 · Red &lt; 70</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
                <th className="py-3 px-5 text-left">Department</th>
                <th className="py-3 px-4 text-center">Week 1</th>
                <th className="py-3 px-4 text-center">Week 2</th>
                <th className="py-3 px-4 text-center">Week 3</th>
                <th className="py-3 px-4 text-center">Week 4</th>
                <th className="py-3 px-4 text-center">Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {performanceHeatmap.map(row => {
                const avg = Math.round((row.w1 + row.w2 + row.w3 + row.w4) / 4);
                return (
                  <tr key={row.dept} className="hover:bg-[var(--accent-light)] transition-colors">
                    <td className="py-3 px-5 font-semibold text-[var(--text-primary)]">{row.dept}</td>
                    {[row.w1, row.w2, row.w3, row.w4].map((v, i) => (
                      <td key={i} className="py-3 px-4 text-center">
                        <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(v)}`}>{v}</span>
                      </td>
                    ))}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(avg)}`}>{avg}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Management Decisions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent Management Decisions</h2>
          <button onClick={handleExport} className="text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold text-[10px]">
                {['Date','Type','Description','Decision','Outcome','Reference'].map(h => (
                  <th key={h} className="py-3 px-5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loadingDecisions ? (
                <tr><td colSpan={6} className="py-6 px-5">{[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-7 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}</td></tr>
              ) : recentDecisions.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-[var(--text-muted)] text-xs">No management decisions recorded yet</td></tr>
              ) : recentDecisions.map((row, i) => (
                <tr key={i} className="hover:bg-[var(--accent-light)] transition-colors">
                  <td className="py-3 px-5 text-[var(--text-muted)] whitespace-nowrap">{row.date}</td>
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600">{row.type}</span>
                  </td>
                  <td className="py-3 px-5 text-[var(--text-primary)] max-w-[200px] truncate">{row.description}</td>
                  <td className="py-3 px-5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.decision === 'Approved' || row.decision === 'Broadcast' || row.decision === 'Actioned' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>{row.decision}</span>
                  </td>
                  <td className="py-3 px-5 text-[var(--text-muted)]">{row.outcome}</td>
                  <td className="py-3 px-5 font-mono text-[var(--accent)]">{row.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
