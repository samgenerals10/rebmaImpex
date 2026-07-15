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
      {trend !== undefined && trend !== 0 && (
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

// ── real time-series bucketing ──────────────────────────────────────────────
function periodConfig(period: Period) {
  const n = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 12 : 12;
  const isMonth = period === '12m';
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  return { n, isMonth, days };
}

function bucketKey(d: Date, isMonth: boolean) {
  return isMonth ? `${d.getFullYear()}-${d.getMonth()}` : d.toDateString();
}

// Buckets real {created_at, value} rows into `n` periods ending today, summing value per bucket.
function bucketRows(rows: { created_at: string; value: number }[], period: Period, label: string) {
  const { n, isMonth } = periodConfig(period);
  const buckets = Array.from({ length: n }, (_, i) => {
    const d = new Date();
    if (isMonth) d.setMonth(d.getMonth() - (n - 1 - i));
    else d.setDate(d.getDate() - (n - 1 - i));
    return {
      name: isMonth ? d.toLocaleDateString('en-GB', { month: 'short' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      [label]: 0,
      _key: bucketKey(d, isMonth),
    };
  });
  for (const r of rows) {
    if (!r.created_at) continue;
    const d = new Date(r.created_at);
    const key = bucketKey(d, isMonth);
    const bucket = buckets.find(b => b._key === key);
    if (bucket) (bucket as any)[label] += r.value;
  }
  return buckets.map(({ _key, ...rest }) => rest);
}

// Per-department: which real table/column drives the primary trend + a secondary activity count
interface DeptSeriesConfig {
  table: string;
  dateField: string;
  valueField?: string; // sum this field; omit to count rows
  filter?: (q: any) => any;
}

const TREND_CONFIG: Record<string, DeptSeriesConfig> = {
  CEO: { table: 'finance_payments', dateField: 'created_at', valueField: 'amount' },
  MANAGEMENT: { table: 'finance_payments', dateField: 'created_at', valueField: 'amount' },
  FINANCE: { table: 'finance_payments', dateField: 'created_at', valueField: 'amount' },
  HR: { table: 'attendance', dateField: 'created_at' },
  MARKETING: { table: 'orders', dateField: 'created_at', valueField: 'total_amount' },
  OPERATIONS: { table: 'cargo_intake', dateField: 'created_at' },
  DISPATCH: { table: 'delivery_logs', dateField: 'created_at' },
  PRODUCTION: { table: 'production_logs', dateField: 'created_at', valueField: 'boxes_produced' },
  RECEPTION: { table: 'visitors', dateField: 'check_in_time' },
  LOGISTICS: { table: 'fuel_logs', dateField: 'created_at', valueField: 'cost' },
};

const ACTIVITY_CONFIG: Record<string, DeptSeriesConfig> = {
  CEO: { table: 'orders', dateField: 'created_at' },
  MANAGEMENT: { table: 'orders', dateField: 'created_at' },
  FINANCE: { table: 'orders', dateField: 'created_at' },
  HR: { table: 'leave_requests', dateField: 'created_at' },
  MARKETING: { table: 'customers', dateField: 'registered_at' },
  OPERATIONS: { table: 'stock_ledger', dateField: 'created_at' },
  DISPATCH: { table: 'delivery_logs', dateField: 'created_at' },
  PRODUCTION: { table: 'production_requests', dateField: 'created_at' },
  RECEPTION: { table: 'attendance', dateField: 'created_at' },
  LOGISTICS: { table: 'maintenance_schedule', dateField: 'created_at' },
};

async function fetchSeries(cfg: DeptSeriesConfig, sinceIso: string): Promise<{ created_at: string; value: number }[]> {
  try {
    const cols = cfg.valueField ? `${cfg.dateField}, ${cfg.valueField}` : cfg.dateField;
    const { data } = await supabase.from(cfg.table).select(cols).gte(cfg.dateField, sinceIso);
    return (data || []).map((r: any) => ({
      created_at: r[cfg.dateField],
      value: cfg.valueField ? Number(r[cfg.valueField] || 0) : 1,
    }));
  } catch {
    return [];
  }
}

export default function AnalyticsDashboard({ department, currentUser, addNotification }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(false);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [liveStats, setLiveStats] = useState<{ label: string; value: string; sub?: string; trend: number; icon: any }[]>([]);
  const [extraA, setExtraA] = useState<any[]>([]);
  const [extraB, setExtraB] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { days } = periodConfig(period);
    const now = new Date();
    const sinceCurrent = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const sincePrevious = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    const trendCfg = TREND_CONFIG[department] || TREND_CONFIG.CEO;
    const activityCfg = ACTIVITY_CONFIG[department] || ACTIVITY_CONFIG.CEO;

    const [currentTrendRows, previousTrendRows, activityRows] = await Promise.all([
      fetchSeries(trendCfg, sinceCurrent.toISOString()),
      fetchSeries(trendCfg, sincePrevious.toISOString()).then(rows => rows.filter(r => new Date(r.created_at) < sinceCurrent)),
      fetchSeries(activityCfg, sinceCurrent.toISOString()),
    ]);

    setRevenueData(bucketRows(currentTrendRows, period, 'Value'));
    setActivityData(bucketRows(activityRows, period, 'Activity'));

    const currentBuckets = bucketRows(currentTrendRows, period, 'Value');
    const previousBuckets = bucketRows(previousTrendRows, period, 'Value');
    setCompareData(currentBuckets.map((c, i) => ({
      name: `P${i + 1}`,
      Current: (c as any).Value,
      Previous: (previousBuckets[i] as any)?.Value || 0,
    })));

    setLoading(false);
  }, [period, department]);

  const loadLiveStats = useCallback(async () => {
    try {
      if (department === 'CEO' || department === 'MANAGEMENT') {
        const [{ count: orderCount }, { data: revenueRows }, { count: driverCount }, { count: staffCount }] = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }),
          supabase.from('finance_payments').select('amount'),
          supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        ]);
        const totalRev = (revenueRows ?? []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
        setLiveStats([
          { label: 'Total Revenue', value: `GHS ${totalRev.toLocaleString()}`, sub: 'All payments', trend: 0, icon: DollarSign },
          { label: 'Total Orders', value: `${orderCount ?? 0}`, sub: 'All time', trend: 0, icon: Package },
          { label: 'Active Drivers', value: `${driverCount ?? 0}`, sub: 'On roster', trend: 0, icon: Truck },
          { label: 'Staff Headcount', value: `${staffCount ?? 0}`, sub: 'Total active', trend: 0, icon: Users },
        ]);

        const { data: orders } = await supabase.from('orders').select('status');
        const byStatus: Record<string, number> = {};
        for (const o of orders || []) byStatus[(o as any).status] = (byStatus[(o as any).status] || 0) + 1;
        setPieData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));

        const { data: rev } = await supabase.from('orders').select('total_amount, department').in('status', ['APPROVED', 'PROCESSING', 'DELIVERED', 'OUT_FOR_DELIVERY']);
        const byDept: Record<string, number> = {};
        for (const r of rev || []) { const d = (r as any).department || 'MARKETING'; byDept[d] = (byDept[d] || 0) + Number((r as any).total_amount || 0); }
        setExtraA(Object.entries(byDept).map(([dept, value]) => ({ dept, value: Math.round(value / 1000) })));

        const { data: payments } = await supabase.from('finance_payments').select('amount, created_at');
        const { data: expenses } = await supabase.from('finance_expenses').select('amount, created_at').eq('status', 'Approved');
        const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return d; });
        setExtraB(months.map(m => {
          const key = `${m.getFullYear()}-${m.getMonth()}`;
          const inflow = (payments || []).filter((p: any) => { const d = new Date(p.created_at); return `${d.getFullYear()}-${d.getMonth()}` === key; }).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const outflow = (expenses || []).filter((e: any) => { const d = new Date(e.created_at); return `${d.getFullYear()}-${d.getMonth()}` === key; }).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
          return { name: m.toLocaleDateString('en-GB', { month: 'short' }), Inflow: Math.round(inflow), Outflow: Math.round(outflow) };
        }));
      } else if (department === 'FINANCE') {
        const [{ data: orders }, { data: payments }] = await Promise.all([
          supabase.from('orders').select('total_amount, status, payment_mode'),
          supabase.from('finance_payments').select('amount'),
        ]);
        const invoiced = (orders ?? []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
        const collected = (payments ?? []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
        const credit = (orders ?? []).filter((o: any) => o.payment_mode === 'CREDIT').reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
        setLiveStats([
          { label: 'Total Invoiced', value: `GHS ${invoiced.toLocaleString()}`, sub: 'All orders', trend: 0, icon: DollarSign },
          { label: 'Collected', value: `GHS ${collected.toLocaleString()}`, sub: 'Payments in', trend: 0, icon: TrendingUp },
          { label: 'Outstanding', value: `GHS ${(invoiced - collected).toLocaleString()}`, sub: 'Uncollected', trend: 0, icon: TrendingDown },
          { label: 'Credit Extended', value: `GHS ${credit.toLocaleString()}`, sub: 'Credit terms', trend: 0, icon: DollarSign },
        ]);
        const byMode: Record<string, number> = {};
        for (const o of orders || []) { const m = (o as any).payment_mode || 'CASH'; byMode[m] = (byMode[m] || 0) + 1; }
        setPieData(Object.entries(byMode).map(([name, value]) => ({ name, value })));
      } else if (department === 'HR') {
        const [{ count: total }, { count: onLeave }, { count: pending }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
          supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
          supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        ]);
        setLiveStats([
          { label: 'Total Staff', value: `${total ?? 0}`, sub: 'Headcount', trend: 0, icon: Users },
          { label: 'On Leave', value: `${onLeave ?? 0}`, sub: 'Approved leaves', trend: 0, icon: Users },
          { label: 'Leave Requests', value: `${pending ?? 0}`, sub: 'Pending review', trend: 0, icon: Users },
          { label: 'Active', value: `${Math.max(0, (total ?? 0) - (onLeave ?? 0))}`, sub: 'Working today', trend: 0, icon: Users },
        ]);
        const { data: profiles } = await supabase.from('profiles').select('role');
        const byRole: Record<string, number> = {};
        for (const p of profiles || []) { const r = (p as any).role || 'Staff'; byRole[r] = (byRole[r] || 0) + 1; }
        setPieData(Object.entries(byRole).map(([name, value]) => ({ name, value })));
        setExtraA(Object.entries(byRole).map(([dept, count]) => ({ dept, count })));
      } else if (department === 'MARKETING') {
        const [{ count: ordersC }, { count: custsC }, { count: pendC }, { data: revRows }] = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }),
          supabase.from('customers').select('*', { count: 'exact', head: true }),
          supabase.from('orders').select('*', { count: 'exact', head: true }).like('status', 'PENDING%'),
          supabase.from('orders').select('total_amount'),
        ]);
        const rev = (revRows ?? []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
        setLiveStats([
          { label: 'Orders Created', value: `${ordersC ?? 0}`, sub: 'Total bookings', trend: 0, icon: Package },
          { label: 'Customers', value: `${custsC ?? 0}`, sub: 'Registered', trend: 0, icon: Users },
          { label: 'Revenue', value: `GHS ${rev.toLocaleString()}`, sub: 'All orders', trend: 0, icon: DollarSign },
          { label: 'Pending', value: `${pendC ?? 0}`, sub: 'Awaiting approval', trend: 0, icon: TrendingDown },
        ]);
        const { data: orders } = await supabase.from('orders').select('status');
        const byStatus: Record<string, number> = {};
        for (const o of orders || []) byStatus[(o as any).status] = (byStatus[(o as any).status] || 0) + 1;
        setPieData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
      } else if (department === 'OPERATIONS') {
        const [{ count: cargoC }, { count: stockC }, { count: discC }] = await Promise.all([
          supabase.from('cargo_intake').select('*', { count: 'exact', head: true }),
          supabase.from('stock').select('*', { count: 'exact', head: true }),
          supabase.from('cargo_intake').select('*', { count: 'exact', head: true }).neq('discrepancies', 'None'),
        ]);
        setLiveStats([
          { label: 'Cargo Intakes', value: `${cargoC ?? 0}`, sub: 'Total logged', trend: 0, icon: Package },
          { label: 'Stock Items', value: `${stockC ?? 0}`, sub: 'In warehouse', trend: 0, icon: Package },
          { label: 'Discrepancies', value: `${discC ?? 0}`, sub: 'Open issues', trend: 0, icon: TrendingDown },
          { label: 'Fulfillments', value: '—', sub: 'Check deliveries', trend: 0, icon: Truck },
        ]);
        const { data: cargo } = await supabase.from('cargo_intake').select('status');
        const byStatus: Record<string, number> = {};
        for (const c of cargo || []) byStatus[(c as any).status] = (byStatus[(c as any).status] || 0) + 1;
        setPieData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
      } else if (department === 'DISPATCH') {
        const [{ count: total }, { count: inTransit }, { count: delivered }, { count: drivers }] = await Promise.all([
          supabase.from('delivery_logs').select('*', { count: 'exact', head: true }),
          supabase.from('delivery_logs').select('*', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
          supabase.from('delivery_logs').select('*', { count: 'exact', head: true }).eq('status', 'DELIVERED'),
          supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        ]);
        setLiveStats([
          { label: 'Deliveries', value: `${total ?? 0}`, sub: 'Total', trend: 0, icon: Truck },
          { label: 'In Transit', value: `${inTransit ?? 0}`, sub: 'Currently active', trend: 0, icon: Truck },
          { label: 'Delivered', value: `${delivered ?? 0}`, sub: 'Completed', trend: 0, icon: TrendingUp },
          { label: 'Active Drivers', value: `${drivers ?? 0}`, sub: 'On roster', trend: 0, icon: Users },
        ]);
        const { data: deliveries } = await supabase.from('delivery_logs').select('status');
        const byStatus: Record<string, number> = {};
        for (const d of deliveries || []) byStatus[(d as any).status] = (byStatus[(d as any).status] || 0) + 1;
        setPieData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
      } else if (department === 'PRODUCTION') {
        const [{ count: reqC }, { data: outputRows }] = await Promise.all([
          supabase.from('production_requests').select('*', { count: 'exact', head: true }),
          supabase.from('production_logs').select('boxes_produced, total_sachets'),
        ]);
        const totalBoxes = (outputRows ?? []).reduce((s: number, r: any) => s + (r.boxes_produced || 0), 0);
        const totalSachets = (outputRows ?? []).reduce((s: number, r: any) => s + (r.total_sachets || 0), 0);
        setLiveStats([
          { label: 'Requests', value: `${reqC ?? 0}`, sub: 'Production orders', trend: 0, icon: Package },
          { label: 'Boxes Produced', value: `${totalBoxes}`, sub: 'Total output', trend: 0, icon: Package },
          { label: 'Sachets', value: `${totalSachets}`, sub: 'Total sachets', trend: 0, icon: Package },
          { label: 'Efficiency', value: '—', sub: 'Quality rate', trend: 0, icon: TrendingUp },
        ]);
        const { data: reqs } = await supabase.from('production_requests').select('status');
        const byStatus: Record<string, number> = {};
        for (const r of reqs || []) byStatus[(r as any).status] = (byStatus[(r as any).status] || 0) + 1;
        setPieData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
      } else if (department === 'RECEPTION') {
        const today = new Date().toISOString().split('T')[0];
        const [{ count: totalC }, { count: insideC }, { count: outC }] = await Promise.all([
          supabase.from('visitors').select('*', { count: 'exact', head: true }).gte('check_in_time', today),
          supabase.from('visitors').select('*', { count: 'exact', head: true }).gte('check_in_time', today).is('check_out_time', null),
          supabase.from('visitors').select('*', { count: 'exact', head: true }).gte('check_in_time', today).not('check_out_time', 'is', null),
        ]);
        setLiveStats([
          { label: 'Visitors Today', value: `${totalC ?? 0}`, sub: 'Checked in', trend: 0, icon: Users },
          { label: 'Inside Now', value: `${insideC ?? 0}`, sub: 'Still on premises', trend: 0, icon: Users },
          { label: 'Checked Out', value: `${outC ?? 0}`, sub: 'Departed today', trend: 0, icon: Users },
          { label: 'Total Logged', value: `${totalC ?? 0}`, sub: 'All time today', trend: 0, icon: Users },
        ]);
        const { data: visitors } = await supabase.from('visitors').select('purpose');
        const byPurpose: Record<string, number> = {};
        for (const v of visitors || []) { const p = (v as any).purpose || 'Other'; byPurpose[p] = (byPurpose[p] || 0) + 1; }
        setPieData(Object.entries(byPurpose).slice(0, 6).map(([name, value]) => ({ name, value })));
      } else if (department === 'LOGISTICS') {
        const [{ count: vehicleC }, { count: activeC }, { count: maintC }, { data: fuelRows }] = await Promise.all([
          supabase.from('fleet_vehicles').select('*', { count: 'exact', head: true }),
          supabase.from('fleet_vehicles').select('*', { count: 'exact', head: true }).eq('status', 'Operational'),
          supabase.from('maintenance_schedule').select('*', { count: 'exact', head: true }).neq('status', 'Completed'),
          supabase.from('fuel_logs').select('cost'),
        ]);
        const fuelCost = (fuelRows ?? []).reduce((s: number, r: any) => s + Number(r.cost || 0), 0);
        setLiveStats([
          { label: 'Total Vehicles', value: `${vehicleC ?? 0}`, sub: 'Fleet size', trend: 0, icon: Truck },
          { label: 'Operational', value: `${activeC ?? 0}`, sub: 'Ready to run', trend: 0, icon: Truck },
          { label: 'Pending Maintenance', value: `${maintC ?? 0}`, sub: 'Open work orders', trend: 0, icon: Package },
          { label: 'Fuel Spend', value: `GHS ${fuelCost.toLocaleString()}`, sub: 'All time', trend: 0, icon: DollarSign },
        ]);
        const { data: vehicles } = await supabase.from('fleet_vehicles').select('status');
        const byStatus: Record<string, number> = {};
        for (const v of vehicles || []) byStatus[(v as any).status] = (byStatus[(v as any).status] || 0) + 1;
        setPieData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
      }
    } catch { /* silent */ }
  }, [department]);

  useEffect(() => {
    loadLiveStats();
  }, [loadLiveStats]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = liveStats;

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
        {stats.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)
        ) : (
          stats.map((s, i) => <StatCard key={i} label={s.label} value={s.value} sub={s.sub} trend={s.trend} icon={s.icon} />)
        )}
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
          {pieData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-[var(--text-muted)]">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={(entry) => `${entry.name ?? ''} ${entry.value}`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
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
          <ChartCard title="Attendance Records (period)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="Activity" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Headcount by Role">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={extraA}>
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
          <ChartCard title="Revenue by Department (GHS '000)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={extraA}>
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
              <AreaChart data={extraB}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
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
