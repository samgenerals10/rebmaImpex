import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, ClipboardCheck, ShieldCheck, Users, DollarSign, Download, BarChart2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

interface Props { addNotification: (msg: string) => void }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEPT_LIST = ['Operations','Finance','Marketing','Dispatch','Production','HR','Reception','Logistics'];

const heatColor = (v: number) =>
  v >= 90 ? 'bg-emerald-500/80 text-white' :
  v >= 80 ? 'bg-emerald-400/50 text-emerald-800' :
  v >= 70 ? 'bg-amber-400/50 text-amber-800' :
  v > 0   ? 'bg-rose-400/50 text-rose-800' :
  'bg-[var(--bg)] text-[var(--text-muted)]';

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
  const [loading, setLoading] = useState(true);

  // KPI
  const [totalApprovals, setTotalApprovals] = useState(0);
  const [approvalRate, setApprovalRate] = useState(0);

  // Charts
  const [approvalStatus, setApprovalStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [approvalActivity, setApprovalActivity] = useState<{ month: string; cargo: number; credit: number; staff: number }[]>([]);
  const [deptRevenue, setDeptRevenue] = useState<{ dept: string; revenue: number }[]>([]);
  const [yoyData, setYoyData] = useState<{ month: string; current: number; previous: number }[]>([]);
  const [performanceHeatmap, setPerformanceHeatmap] = useState<{ dept: string; w1: number; w2: number; w3: number; w4: number }[]>([]);

  // Decisions
  const [recentDecisions, setRecentDecisions] = useState<Decision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(true);

  const fetchAll = async () => {
    setLoading(true);

    // ── Approval Status from cargo_intake ──────────────────────────────────
    try {
      const [appRes, rejRes, pendRes, revRes] = await Promise.all([
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('cargo_intake').select('id', { count: 'exact', head: true }).eq('status', 'IN_REVIEW'),
      ]);
      const approved = appRes.count ?? 0;
      const rejected = rejRes.count ?? 0;
      const pending  = pendRes.count ?? 0;
      const inReview = revRes.count ?? 0;
      const total = approved + rejected + pending + inReview;
      setTotalApprovals(total);
      setApprovalRate(total > 0 ? Math.round((approved / total) * 100) : 0);
      const statuses = [
        { name: 'Approved',  value: approved, color: '#10b981' },
        { name: 'In Review', value: inReview,  color: '#f59e0b' },
        { name: 'Pending',   value: pending,   color: '#6366f1' },
        { name: 'Rejected',  value: rejected,  color: '#f43f5e' },
      ].filter(s => s.value > 0);
      setApprovalStatus(statuses.length > 0 ? statuses : [{ name: 'No Data', value: 1, color: 'var(--border)' }]);
    } catch {}

    // ── Approval Activity by Type from audit history ───────────────────────
    try {
      const { data: auditData } = await supabase
        .from('global_audit_history')
        .select('action, timestamp')
        .order('timestamp', { ascending: true });
      if (auditData && auditData.length > 0) {
        const byMonth: Record<string, { cargo: number; credit: number; staff: number }> = {};
        MONTHS.forEach(m => { byMonth[m] = { cargo: 0, credit: 0, staff: 0 }; });
        auditData.forEach((r: any) => {
          if (!r.timestamp) return;
          const m = MONTHS[new Date(r.timestamp).getMonth()];
          const action = (r.action || '').toUpperCase();
          if (action.includes('CARGO') || action.includes('INTAKE') || action.includes('PORT')) byMonth[m].cargo++;
          else if (action.includes('CREDIT') || action.includes('PAYMENT') || action.includes('ORDER')) byMonth[m].credit++;
          else if (action.includes('STAFF') || action.includes('HR') || action.includes('PAYROLL') || action.includes('LEAVE')) byMonth[m].staff++;
          else byMonth[m].credit++;
        });
        const thisMonth = new Date().getMonth();
        const activity = MONTHS.slice(0, thisMonth + 1).map(m => ({ month: m, ...byMonth[m] }))
          .filter(d => d.cargo + d.credit + d.staff > 0);
        setApprovalActivity(activity.length > 0 ? activity : MONTHS.slice(0, thisMonth + 1).map(m => ({ month: m, cargo: 0, credit: 0, staff: 0 })));
      } else {
        setApprovalActivity(MONTHS.slice(0, new Date().getMonth() + 1).map(m => ({ month: m, cargo: 0, credit: 0, staff: 0 })));
      }
    } catch {}

    // ── Department Revenue from orders (marketing) + payments (finance) ────
    try {
      const [ordersRes, paymentsRes, purchasesRes] = await Promise.all([
        supabase.from('orders').select('total').neq('status', 'CANCELLED'),
        supabase.from('finance_payments').select('amount'),
        supabase.from('general_purchases').select('total_cost'),
      ]);
      const marketingRev = (ordersRes.data ?? []).reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
      const financeRev   = (paymentsRes.data ?? []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      const opsRev       = (purchasesRes.data ?? []).reduce((s: number, r: any) => s + (Number(r.total_cost) || 0), 0);
      const depts = [
        { dept: 'Marketing',  revenue: marketingRev },
        { dept: 'Finance',    revenue: financeRev },
        { dept: 'Operations', revenue: opsRev },
      ].filter(d => d.revenue > 0).sort((a, b) => b.revenue - a.revenue);
      setDeptRevenue(depts.length > 0 ? depts : []);
    } catch {}

    // ── Year on Year from finance_payments ────────────────────────────────
    try {
      const { data: payData } = await supabase.from('finance_payments').select('amount, created_at');
      if (payData && payData.length > 0) {
        const currentYear = new Date().getFullYear();
        const currByMonth: Record<string, number> = {};
        const prevByMonth: Record<string, number> = {};
        MONTHS.forEach(m => { currByMonth[m] = 0; prevByMonth[m] = 0; });
        payData.forEach((r: any) => {
          if (!r.created_at) return;
          const d = new Date(r.created_at);
          const m = MONTHS[d.getMonth()];
          const amt = Number(r.amount) || 0;
          if (d.getFullYear() === currentYear) currByMonth[m] += amt;
          else if (d.getFullYear() === currentYear - 1) prevByMonth[m] += amt;
        });
        const thisMonth = new Date().getMonth();
        const yoy = MONTHS.slice(0, thisMonth + 1).map(m => ({ month: m, current: currByMonth[m], previous: prevByMonth[m] }));
        setYoyData(yoy);
      } else {
        setYoyData(MONTHS.slice(0, new Date().getMonth() + 1).map(m => ({ month: m, current: 0, previous: 0 })));
      }
    } catch {}

    // ── Performance Heatmap from audit history activity counts ────────────
    try {
      const now = Date.now();
      const { data: heatData } = await supabase.from('global_audit_history').select('department, timestamp');
      if (heatData && heatData.length > 0) {
        const deptWeek: Record<string, Record<string, number>> = {};
        DEPT_LIST.forEach(d => { deptWeek[d.toUpperCase()] = { w1: 0, w2: 0, w3: 0, w4: 0 }; });
        heatData.forEach((r: any) => {
          if (!r.timestamp || !r.department) return;
          const dept = String(r.department).toUpperCase();
          if (!deptWeek[dept]) return;
          const daysAgo = Math.floor((now - new Date(r.timestamp).getTime()) / 86400000);
          if (daysAgo <= 7) deptWeek[dept].w4++;
          else if (daysAgo <= 14) deptWeek[dept].w3++;
          else if (daysAgo <= 21) deptWeek[dept].w2++;
          else if (daysAgo <= 28) deptWeek[dept].w1++;
        });
        // Normalize to /100: max activity in any week across all depts
        const allCounts = Object.values(deptWeek).flatMap(w => Object.values(w));
        const maxCount = Math.max(...allCounts, 1);
        const heatmap = DEPT_LIST.map(dept => {
          const w = deptWeek[dept.toUpperCase()];
          const norm = (v: number) => Math.min(100, Math.round((v / maxCount) * 100));
          return { dept, w1: norm(w.w1), w2: norm(w.w2), w3: norm(w.w3), w4: norm(w.w4) };
        }).filter(row => row.w1 + row.w2 + row.w3 + row.w4 > 0);
        setPerformanceHeatmap(heatmap.length > 0 ? heatmap : []);
      } else {
        setPerformanceHeatmap([]);
      }
    } catch {}

    // ── Recent Management Decisions ───────────────────────────────────────
    setLoadingDecisions(true);
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
    }
    setLoadingDecisions(false);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleExport = () => {
    exportToCSV(recentDecisions, ['date','type','description','decision','outcome','ref'], 'management_analytics');
    addNotification('Management analytics exported to CSV.');
  };

  const KPI_CARDS = [
    { label: 'Total Cargo Reviewed', value: totalApprovals, prefix: '', suffix: '', icon: ClipboardCheck, color: 'var(--accent)' },
    { label: 'Approval Rate', value: approvalRate, prefix: '', suffix: '%', icon: ShieldCheck, color: '#10b981' },
    { label: 'Revenue Tracked', value: deptRevenue.length > 0 ? deptRevenue.reduce((s,d) => s + d.revenue, 0) : null, prefix: 'GHS ', suffix: '', icon: DollarSign, color: '#8b5cf6' },
    { label: 'Departments Active', value: performanceHeatmap.length > 0 ? `${performanceHeatmap.length}/${DEPT_LIST.length}` : '—', prefix: '', suffix: '', icon: Users, color: '#f59e0b' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Management Analytics</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Approval trends, revenue performance & department insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${period === p ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{p}</button>
            ))}
          </div>
          <button onClick={fetchAll} className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {loading ? '—' : typeof card.value === 'number'
                  ? <CountUp value={card.value} prefix={card.prefix} suffix={card.suffix} />
                  : card.value}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Live from database</p>
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
          {approvalActivity.every(d => d.cargo + d.credit + d.staff === 0) ? (
            <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">No activity recorded yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={approvalActivity} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                <Bar dataKey="cargo"  name="Cargo"    fill="var(--accent)" radius={[3,3,0,0]} />
                <Bar dataKey="credit" name="Orders/Payments" fill="#8b5cf6" radius={[3,3,0,0]} />
                <Bar dataKey="staff"  name="HR/Staff" fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Approval Status Distribution</h2>
          {approvalStatus[0]?.name === 'No Data' ? (
            <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">No cargo intake records yet</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={approvalStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0}>
                    {approvalStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}`, '']} />
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
          )}
        </div>
      </div>

      {/* Row 2: Revenue by Dept + Year-on-Year */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Revenue by Department</h2>
          {deptRevenue.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptRevenue} layout="vertical" margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="dept" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`GHS ${Number(v).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--accent)" radius={[0,4,4,0]}>
                  {deptRevenue.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 18}, 70%, 55%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--box-shadow)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">Year on Year Comparison (Payments)</h2>
          {yoyData.every(d => d.current === 0 && d.previous === 0) ? (
            <div className="h-64 flex items-center justify-center text-[var(--text-muted)] text-sm">No payment data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={yoyData} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
                <Line type="monotone" dataKey="current"  name="Current Year" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="previous" name="Last Year"    stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Performance Heatmap */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Department Performance Heatmap (Activity Score / 100)</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Based on audit activity — Green ≥ 90 · Teal ≥ 80 · Amber ≥ 70 · Red &lt; 70</p>
        </div>
        {performanceHeatmap.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-sm">No activity data recorded yet</div>
        ) : (
          <div className="p-3">
            <ResponsiveDataView<typeof performanceHeatmap[number]>
              columns={[
                { key: 'dept', label: 'Department', primary: true },
                { key: 'w1', label: 'Week 1 (28d ago)', align: 'center', render: row => <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(row.w1)}`}>{row.w1}</span> },
                { key: 'w2', label: 'Week 2 (21d ago)', align: 'center', render: row => <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(row.w2)}`}>{row.w2}</span> },
                { key: 'w3', label: 'Week 3 (14d ago)', align: 'center', render: row => <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(row.w3)}`}>{row.w3}</span> },
                { key: 'w4', label: 'Week 4 (7d ago)', align: 'center', render: row => <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(row.w4)}`}>{row.w4}</span> },
                {
                  key: 'avg', label: 'Avg', align: 'center', render: row => {
                    const avg = Math.round((row.w1 + row.w2 + row.w3 + row.w4) / 4);
                    return <span className={`inline-block w-12 py-1 rounded-lg text-[10px] font-bold ${heatColor(avg)}`}>{avg}</span>;
                  }
                },
              ]}
              data={performanceHeatmap}
              rowKey={row => row.dept}
            />
          </div>
        )}
      </div>

      {/* Recent Management Decisions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Recent Management Decisions</h2>
          <button onClick={handleExport} className="text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer">Export CSV</button>
        </div>
        <div className="p-3">
          <ResponsiveDataView<typeof recentDecisions[number]>
            columns={[
              { key: 'description', label: 'Description', primary: true },
              { key: 'date', label: 'Date' },
              { key: 'type', label: 'Type', render: row => <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600">{row.type}</span> },
              {
                key: 'decision', label: 'Decision', status: true, render: row => (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${row.decision === 'Approved' || row.decision === 'Actioned' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>{row.decision}</span>
                )
              },
              { key: 'outcome', label: 'Outcome' },
              { key: 'ref', label: 'Reference', render: row => <span className="font-mono text-[var(--accent)]">{row.ref}</span> },
            ]}
            data={recentDecisions}
            rowKey={row => String(recentDecisions.indexOf(row))}
            loading={loadingDecisions}
            emptyTitle="No management decisions recorded yet"
          />
        </div>
      </div>
    </div>
  );
}
