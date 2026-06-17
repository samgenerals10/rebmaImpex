// rebma-web/src/components/FoodieShell.tsx
// Full Foodie template layout — wraps all departments when theme-foodie is active

import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag, DollarSign, Users, Star, TrendingUp, TrendingDown,
  MoreVertical, Bell, Search, Calendar, Package, Truck, BarChart3,
  ShieldCheck, Activity, Clipboard, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { CurrentUser } from '../types/erp';
import { supabase } from '../lib/supabaseClient';

interface FoodieShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

// Render star rating
const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5 text-amber-400 text-[10px]">
    {[1,2,3,4,5].map(i => (
      <span key={i} className={i <= Math.round(rating) ? 'opacity-100' : 'opacity-25'}>★</span>
    ))}
    <span className="text-[10px] text-[var(--text-muted)] ml-1 font-medium">{rating}</span>
  </span>
);

// Icon avatar with solid purple circle (Foodie style)
const FoodieIcon = ({ Icon }: { Icon: React.ElementType }) => (
  <div className="w-11 h-11 rounded-full bg-[#7c3aed] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(124,58,237,0.35)]">
    <Icon className="w-5 h-5 text-white" />
  </div>
);

// Mini line sparkline for KPI cards
const Sparkline = ({ up }: { up: boolean }) => {
  const points = up
    ? [[0,20],[10,16],[20,18],[30,10],[40,14],[50,6],[60,10],[70,4]]
    : [[0,4],[10,8],[20,6],[30,14],[40,10],[50,18],[60,12],[70,20]];
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return (
    <svg width="72" height="24" viewBox="0 0 72 24" fill="none">
      <path d={d} stroke={up ? '#7c3aed' : '#f43f5e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const statusColor: Record<string, string> = {
  Delivered: 'bg-emerald-100 text-emerald-700',
  Processing: 'bg-amber-100 text-amber-700',
  Cancelled: 'bg-rose-100 text-rose-700',
};

export default function FoodieShell({ activeDepartment, currentUser, children }: FoodieShellProps) {
  const [kpis, setKpis] = useState<any[]>([]);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [totalRevenueVal, setTotalRevenueVal] = useState('₵0');
  const [loading, setLoading] = useState(true);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const deptLabel: Record<string, string> = {
    CEO: 'operations', MANAGEMENT: 'cargo approvals', MARKETING: 'sales pipeline',
    HR: 'workforce', OPERATIONS: 'warehouse floor', FINANCE: 'ledgers',
    PRODUCTION: 'production line', RECEPTION: 'visitor desk', DISPATCH: 'fleet',
    LOGISTICS: 'logistics network', BOARDROOM: 'boardroom', SETTINGS: 'settings',
  };

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';

  useEffect(() => {
    if (isBoardroomOrSettings) return;

    let active = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Weekly Sales Chart Data
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const { data: weekData } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        
        const dailyTotal: Record<string, number> = {};
        for (const o of weekData ?? []) {
          const d = days[new Date(o.created_at).getDay()];
          dailyTotal[d] = (dailyTotal[d] || 0) + Number(o.total_amount || 0);
        }
        const salesChart = days.map(d => ({ day: d, value: dailyTotal[d] || 0 }));
        if (active) setSalesData(salesChart);

        // 2. Fetch live payments for total revenue
        const { data: payData } = await supabase.from('finance_payments').select('amount');
        const totalRev = (payData ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
        if (active) setTotalRevenueVal(`₵${totalRev.toLocaleString()}`);

        // Build monthly bar chart
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const monthlyRev = months.map(m => ({
          month: m,
          value: Math.round(totalRev * 0.15 + Math.random() * 5000)
        }));
        if (active) setRevenueData(monthlyRev);

        // Calculate Category Data from orders product_name
        const { data: orderProducts } = await supabase.from('orders').select('product_name');
        const prodCounts: Record<string, number> = {};
        for (const o of orderProducts ?? []) {
          const name = o.product_name || 'Import Orders';
          prodCounts[name] = (prodCounts[name] || 0) + 1;
        }
        const totalProds = (orderProducts ?? []).length || 1;
        const colorPalette = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ede9fe'];
        const mappedCats = Object.entries(prodCounts).map(([name, count], idx) => ({
          name,
          value: Math.round(count / totalProds * 100),
          color: colorPalette[idx % colorPalette.length]
        }));
        if (active && mappedCats.length > 0) setCategoryData(mappedCats);
        else if (active) {
          setCategoryData([
            { name: 'Import Orders', value: 40, color: '#7c3aed' },
            { name: 'Local Supply', value: 30, color: '#a78bfa' },
            { name: 'Export', value: 20, color: '#c4b5fd' },
            { name: 'Returns', value: 10, color: '#ede9fe' }
          ]);
        }

        // 3. Department KPIs and Recents
        if (activeDepartment === 'CEO' || activeDepartment === 'MANAGEMENT' || activeDepartment === 'FINANCE') {
          const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
          const { count: staffCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE');

          const { data: recOrders } = await supabase
            .from('orders')
            .select('id, product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedRecent = (recOrders ?? []).map(o => ({
            id: o.ticket_number || `#${o.id.substring(0, 8)}`,
            item: o.product_name || 'Order Cargo',
            status: o.status === 'APPROVED' || o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'Delivered' : o.status === 'REJECTED' ? 'Cancelled' : 'Processing',
            time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: `₵${(o.total_amount || 0).toLocaleString()}`
          }));

          if (active) {
            setKpis([
              { label: 'Total Orders', value: String(orderCount || 0), trend: '+12.5%', up: true, icon: ShoppingBag },
              { label: 'Revenue (GHS)', value: `₵${totalRev.toLocaleString()}`, trend: '+8.3%', up: true, icon: DollarSign },
              { label: 'Active Staff', value: String(staffCount || 0), trend: '+2', up: true, icon: Users },
              { label: 'Avg. Rating', value: '4.8', trend: '+0.2', up: true, icon: Star }
            ]);
            setRecentItems(mappedRecent);
          }
        } else if (activeDepartment === 'MARKETING') {
          const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
          const { count: custCount } = await supabase.from('customers').select('id', { count: 'exact', head: true });

          const { data: recOrders } = await supabase
            .from('orders')
            .select('id, product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedRecent = (recOrders ?? []).map(o => ({
            id: o.ticket_number || `#${o.id.substring(0, 8)}`,
            item: o.product_name || 'Sales Order',
            status: o.status === 'APPROVED' || o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'Delivered' : o.status === 'REJECTED' ? 'Cancelled' : 'Processing',
            time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: `₵${(o.total_amount || 0).toLocaleString()}`
          }));

          if (active) {
            setKpis([
              { label: 'Total Orders', value: String(orderCount || 0), trend: '+18%', up: true, icon: ShoppingBag },
              { label: 'Revenue (GHS)', value: `₵${totalRev.toLocaleString()}`, trend: '+11%', up: true, icon: DollarSign },
              { label: 'New Customers', value: String(custCount || 0), trend: '+6', up: true, icon: Users },
              { label: 'Conversion Rate', value: '6.4%', trend: '+0.8%', up: true, icon: TrendingUp }
            ]);
            setRecentItems(mappedRecent);
          }
        } else if (activeDepartment === 'HR') {
          const { count: staffCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE');
          const { data: attToday } = await supabase.from('attendance').select('id').eq('date', new Date().toISOString().split('T')[0]);
          const rate = staffCount ? Math.round(((attToday ?? []).length / staffCount) * 100) : 94;

          const { count: pendingStaff } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL');

          const { data: recProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedRecent = (recProfiles ?? []).map(p => ({
            id: p.role || 'Staff',
            item: p.full_name || p.email,
            status: p.status === 'ACTIVE' ? 'Delivered' : 'Processing',
            time: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: p.status
          }));

          if (active) {
            setKpis([
              { label: 'Total Staff', value: String(staffCount || 0), trend: '+2', up: true, icon: Users },
              { label: 'Attendance Rate', value: `${rate}%`, trend: '+1.2%', up: true, icon: Activity },
              { label: 'Pending Requests', value: String(pendingStaff || 0), trend: '-1', up: true, icon: Clipboard },
              { label: 'Avg. Performance', value: '4.6', trend: '+0.1', up: true, icon: Star }
            ]);
            setRecentItems(mappedRecent);
          }
        } else if (activeDepartment === 'OPERATIONS') {
          const { data: stockData } = await supabase.from('stock').select('current, unit_price');
          const stockVal = (stockData ?? []).reduce((s, p) => s + (p.current || 0) * (p.unit_price || 120), 0);

          const { data: cargoData } = await supabase.from('cargo_intake').select('qty_received');
          const totalTons = (cargoData ?? []).reduce((s, c) => s + (c.qty_received || 0), 0);

          const { data: faults } = await supabase.from('cargo_intake').select('id').eq('is_fault_or_damaged', true);
          const faultCount = faults?.length || 0;

          const { data: recCargo } = await supabase
            .from('cargo_intake')
            .select('id, product_name, goods_code, quantity, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedRecent = (recCargo ?? []).map(c => ({
            id: c.goods_code || c.id,
            item: c.product_name,
            status: c.status === 'APPROVED' ? 'Delivered' : c.status === 'DISCREPANCY_FLAGGED' ? 'Cancelled' : 'Processing',
            time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: `${c.quantity} Units`
          }));

          if (active) {
            setKpis([
              { label: 'Port Ingestions', value: `${totalTons.toLocaleString()}T`, trend: '+9%', up: true, icon: Package },
              { label: 'Stock Value (GHS)', value: `₵${stockVal.toLocaleString()}`, trend: '+4%', up: true, icon: DollarSign },
              { label: 'Active Warehouses', value: '3', trend: '0', up: true, icon: BarChart3 },
              { label: 'Defect Rate', value: '0.8%', trend: '-0.3%', up: true, icon: Star }
            ]);
            setRecentItems(mappedRecent);
          }
        } else if (activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS') {
          const { count: delCount } = await supabase.from('delivery_logs').select('id', { count: 'exact', head: true });
          const { count: activeCount } = await supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT');

          const { data: recDel } = await supabase
            .from('delivery_logs')
            .select('id, driver_name, vehicle_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedRecent = (recDel ?? []).map(d => ({
            id: d.id,
            item: `${d.driver_name || 'Driver'} — ${d.vehicle_id || 'Truck'}`,
            status: d.status === 'DELIVERED' ? 'Delivered' : d.status === 'ASSIGNED' ? 'Processing' : 'Cancelled',
            time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: d.status
          }));

          if (active) {
            setKpis([
              { label: 'Active Trucks', value: String(activeCount || 0), trend: '0', up: true, icon: Truck },
              { label: 'Deliveries Today', value: String(delCount || 0), trend: '+2', up: true, icon: Package },
              { label: 'On-Time Rate', value: '91%', trend: '+3%', up: true, icon: TrendingUp },
              { label: 'Avg. Distance', value: '42km', trend: '-5km', up: true, icon: Star }
            ]);
            setRecentItems(mappedRecent);
          }
        } else if (activeDepartment === 'PRODUCTION') {
          const { count: reqCount } = await supabase.from('production_requests').select('id', { count: 'exact', head: true });
          const { count: completedCount } = await supabase.from('production_requests').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED');
          const pct = reqCount ? Math.round((completedCount || 0) / reqCount * 100) : 96;

          const { data: recProd } = await supabase
            .from('production_requests')
            .select('id, items, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedRecent = (recProd ?? []).map(p => {
            const keys = Object.keys(p.items || {});
            return {
              id: `#${p.id.substring(0, 8)}`,
              item: keys.length > 0 ? `${keys[0]} batch` : 'Production batch',
              status: p.status === 'COMPLETED' ? 'Delivered' : p.status === 'REJECTED' ? 'Cancelled' : 'Processing',
              time: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              amount: p.status
            };
          });

          if (active) {
            setKpis([
              { label: 'Batch Orders', value: String(reqCount || 0), trend: '+3', up: true, icon: Package },
              { label: 'Completion Rate', value: `${pct}%`, trend: '+2%', up: true, icon: Activity },
              { label: 'Material Waste', value: '3.1%', trend: '-0.4%', up: true, icon: Clipboard },
              { label: 'Avg. Output', value: '420kg', trend: '+30kg', up: true, icon: Star }
            ]);
            setRecentItems(mappedRecent);
          }
        } else if (activeDepartment === 'RECEPTION') {
          const { data: vis } = await supabase.from('visitors').select('id').gte('check_in_time', new Date().toISOString().split('T')[0]);
          const visCount = vis?.length || 0;

          const { data: att } = await supabase.from('attendance').select('id').gte('check_in_time', new Date().toISOString().split('T')[0]);
          const attCount = att?.length || 0;

          const { data: recVisitors } = await supabase
            .from('visitors')
            .select('id, full_name, purpose, check_in_time, check_out_time')
            .order('check_in_time', { ascending: false })
            .limit(5);

          const mappedRecent = (recVisitors ?? []).map(v => ({
            id: v.purpose || 'Visit',
            item: v.full_name,
            status: v.check_out_time ? 'Delivered' : 'Processing',
            time: new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: v.check_out_time ? 'Checked Out' : 'Active'
          }));

          if (active) {
            setKpis([
              { label: 'Visitors Today', value: String(visCount), trend: '+4', up: true, icon: Users },
              { label: 'Check-ins', value: String(attCount), trend: '+2', up: true, icon: Activity },
              { label: 'Pending Badges', value: String(visCount - (recVisitors?.filter(v => v.check_out_time).length || 0)), trend: '+1', up: false, icon: ShieldCheck },
              { label: 'Avg. Visit (min)', value: '28', trend: '-4', up: true, icon: Star }
            ]);
            setRecentItems(mappedRecent);
          }
        }

        // Fetch Top items from live database
        const { data: topCargo } = await supabase.from('cargo_intake').select('product_name');
        const counts: Record<string, number> = {};
        for (const item of topCargo ?? []) {
          counts[item.product_name] = (counts[item.product_name] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const mappedTop = sorted.map(([name, count], i) => ({
          name,
          count: `${count} orders`,
          rating: 4.8
        }));
        if (active && mappedTop.length > 0) {
          setTopItems(mappedTop);
        } else if (active) {
          setTopItems([
            { name: 'Cocoa Beans (Grade A)', count: '312 orders', rating: 4.9 },
            { name: 'Palm Oil (Refined)', count: '248 orders', rating: 4.7 },
            { name: 'Maize (Yellow Dent)', count: '196 orders', rating: 4.8 },
            { name: 'Shea Butter (Raw)', count: '154 orders', rating: 4.6 }
          ]);
        }

      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [activeDepartment, isBoardroomOrSettings]);

  if (isBoardroomOrSettings) return <>{children}</>;

  return (
    <div className="foodie-shell pb-8">
      {/* ── GREETING ROW ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">
            {greeting}, {currentUser?.fullName?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Here's what's happening with your {deptLabel[activeDepartment] || 'department'} today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] font-medium shadow-[var(--shadow-card)]">
            <Calendar className="w-3.5 h-3.5 text-[#7c3aed]" />
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="foodie-kpi-card animate-pulse">
              <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 mb-3" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-2" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
            </div>
          ))
        ) : (
          kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="foodie-kpi-card">
                <div className="flex items-start justify-between mb-3">
                  <FoodieIcon Icon={Icon} />
                  <MoreVertical className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-medium mb-1">{kpi.label}</p>
                <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-none mb-2">{kpi.value}</h3>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${kpi.up ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {kpi.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpi.trend}
                  </span>
                  <Sparkline up={kpi.up} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── CHARTS ROW ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Sales Overview — area chart */}
        <div className="lg:col-span-2 foodie-chart-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Sales Overview</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Weekly transaction volume</p>
            </div>
            <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-lg px-2 py-1 outline-none cursor-pointer">
              <option>This Week</option>
              <option>Last Week</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-44 sm:h-52">
            {loading ? (
              <div className="animate-pulse h-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="foodieGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11 }} />
                  <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#foodieGrad)" dot={false} activeDot={{ r: 5, fill: '#7c3aed' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Orders by Category — donut */}
        <div className="foodie-chart-card">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Orders by Category</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Distribution this month</p>
          </div>
          {loading ? (
            <div className="animate-pulse h-36 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto" style={{ width: 144 }} />
          ) : (
            <>
              <div className="h-36 sm:h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {categoryData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-[var(--text-secondary)]">{d.name}</span>
                    </div>
                    <span className="font-semibold text-[var(--text-primary)]">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── PROMO / ALERT CARD ──────────────────────────── */}
      <div className="foodie-promo-card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2">Port Alert</span>
            <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
              Tema Port Clearance<br className="hidden sm:block" /> — Priority Queue Open
            </h3>
            <p className="text-white/75 text-xs mt-1 max-w-xs">Expedited clearance available for REBMA IMPEX cargo until end of day. 50% reduced handling fees apply.</p>
          </div>
          <button className="shrink-0 bg-white text-[#7c3aed] text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors shadow-lg cursor-pointer flex items-center gap-1.5">
            Learn More <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── RECENT ORDERS + TOP ITEMS ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 foodie-chart-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Activity</h3>
            <button className="text-[10px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">See All</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
              <Package className="w-8 h-8 opacity-30 mb-1" />
              <p className="text-xs">No activity logged.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentItems.map((item, i) => (
                <div key={i} className="foodie-order-row">
                  <div className="w-9 h-9 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-[#7c3aed]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{item.item}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{item.id} · {item.time}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor[item.status] || 'bg-gray-100 text-gray-600'}`}>{item.status}</span>
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{item.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Items */}
        <div className="foodie-chart-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Top Items</h3>
            <button className="text-[10px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">View All</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0 text-sm font-bold text-[#7c3aed]">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                    <Stars rating={item.rating} />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] shrink-0">{item.count}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── REVENUE OVERVIEW ────────────────────────────── */}
      <div className="foodie-chart-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wide">Revenue Overview</p>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">{totalRevenueVal}</h2>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" /> +23.1%
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">vs. same period last year</p>
          </div>
          <select className="text-[10px] border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-lg px-2 py-1 outline-none cursor-pointer self-start">
            <option>Last 6 Months</option>
            <option>This Year</option>
            <option>Last Year</option>
          </select>
        </div>
        <div className="h-44 sm:h-52">
          {loading ? (
            <div className="animate-pulse h-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(v) => [`₵${Number(v).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="mt-6">
        {children}
      </div>

    </div>
  );
}
