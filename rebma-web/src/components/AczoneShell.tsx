// rebma-web/src/components/AczoneShell.tsx
// Full AC Zone template layout — wraps all departments when theme-aczone is active

import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, ShoppingBag, Users, BarChart3,
  TrendingUp, TrendingDown, MoreVertical, Package,
  Truck, ClipboardList, Star, AlertTriangle,
  CalendarCheck, ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import type { CurrentUser } from '../types/erp';
import { supabase } from '../lib/supabaseClient';

interface AczoneShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
}

/* ── Status badge styles ── */
const statusStyle: Record<string, string> = {
  'Completed':  'aczone-badge-completed',
  'Processing': 'aczone-badge-processing',
  'On the Way': 'aczone-badge-onway',
  'Cancelled':  'aczone-badge-cancelled',
};

/* ── Tiny sparkline component ── */
const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 36, gap = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * gap},${h - ((v - min) / range) * (h - 6) - 3}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle
        cx={(data.length - 1) * gap}
        cy={h - ((data[data.length - 1] - min) / range) * (h - 6) - 3}
        r="3.5" fill={color}
      />
    </svg>
  );
};

export default function AczoneShell({ activeDepartment, currentUser, children }: AczoneShellProps) {
  const [kpis, setKpis] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [sale, setSale] = useState({ value: '₵0', trend: '0%' });
  const [resv, setResv] = useState({ count: '0', label: 'Items', trend: '0 vs yesterday' });
  const [stockCount, setStockCount] = useState('0');
  const [salesChartData, setSalesChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isBoardroomOrSettings = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';

  const deptTitle: Record<string, string> = {
    CEO: 'CEO Command', MANAGEMENT: 'Management', MARKETING: 'Marketing',
    HR: 'Human Resources', OPERATIONS: 'Operations', FINANCE: 'Finance',
    PRODUCTION: 'Production', RECEPTION: 'Reception', DISPATCH: 'Dispatch',
    LOGISTICS: 'Logistics',
  };

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
        const chart = days.map(d => ({ day: d, value: dailyTotal[d] || 0 }));
        if (active) setSalesChartData(chart);

        // 2. Fetch department statistics
        if (activeDepartment === 'CEO' || activeDepartment === 'MANAGEMENT' || activeDepartment === 'FINANCE') {
          const { data: payData } = await supabase.from('finance_payments').select('amount');
          const totalRev = (payData ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);

          const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
          const { count: custCount } = await supabase.from('customers').select('id', { count: 'exact', head: true });
          const avgOrderVal = orderCount ? Math.round(totalRev / orderCount) : 0;

          const { data: recOrders } = await supabase
            .from('orders')
            .select('id, product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedOrders = (recOrders ?? []).map(o => ({
            name: o.product_name || 'Order',
            id: o.ticket_number || `#${o.id.substring(0, 8)}`,
            status: o.status === 'APPROVED' || o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'Completed' : o.status === 'REJECTED' ? 'Cancelled' : 'Processing',
            time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: `₵${(o.total_amount || 0).toLocaleString()}`
          }));

          if (active) {
            setKpis([
              { label: 'Total Revenue', value: `₵${totalRev.toLocaleString()}`, trend: '+18.6%', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign, data: [3, 5, 4, 7, 6, 9, 8] },
              { label: 'Total Orders', value: String(orderCount || 0), trend: '+12.4%', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: ShoppingBag, data: [2, 4, 3, 6, 5, 7, 6] },
              { label: 'Active Customers', value: String(custCount || 0), trend: '+9.3%', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users, data: [1, 3, 2, 5, 4, 6, 5] },
              { label: 'Avg. Order Value', value: `₵${avgOrderVal.toLocaleString()}`, trend: '-4.2%', up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3, data: [8, 6, 7, 5, 6, 4, 5] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: `₵${totalRev.toLocaleString()}`, trend: '+18.6%' });
            setResv({ count: String(orderCount || 0), label: 'Port Batches', trend: '+12% vs yesterday' });
            setStockCount('3');
          }
        } else if (activeDepartment === 'MARKETING') {
          const { data: salesRevData } = await supabase.from('orders').select('total_amount').in('status', ['APPROVED', 'DELIVERED', 'COMPLETED']);
          const marketingRev = (salesRevData ?? []).reduce((s, o) => s + Number(o.total_amount || 0), 0);

          const { count: orderCount } = await supabase.from('orders').select('id', { count: 'exact', head: true });
          const { count: custCount } = await supabase.from('customers').select('id', { count: 'exact', head: true });
          const avgOrderVal = orderCount ? Math.round(marketingRev / orderCount) : 0;

          const { data: recOrders } = await supabase
            .from('orders')
            .select('id, product_name, ticket_number, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedOrders = (recOrders ?? []).map(o => ({
            name: o.product_name || 'Order',
            id: o.ticket_number || `#${o.id.substring(0, 8)}`,
            status: o.status === 'APPROVED' || o.status === 'DELIVERED' || o.status === 'COMPLETED' ? 'Completed' : o.status === 'REJECTED' ? 'Cancelled' : 'Processing',
            time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: `₵${(o.total_amount || 0).toLocaleString()}`
          }));

          if (active) {
            setKpis([
              { label: 'Sales Revenue', value: `₵${marketingRev.toLocaleString()}`, trend: '+22.4%', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign, data: [3, 5, 4, 7, 6, 9, 8] },
              { label: 'Total Orders', value: String(orderCount || 0), trend: '+18.6%', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: ShoppingBag, data: [2, 4, 3, 6, 5, 7, 6] },
              { label: 'Customers', value: String(custCount || 0), trend: '+9.8%', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: Users, data: [1, 3, 2, 5, 4, 6, 5] },
              { label: 'Avg. Order Value', value: `₵${avgOrderVal.toLocaleString()}`, trend: '-2.1%', up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: BarChart3, data: [8, 6, 7, 5, 6, 4, 5] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: `₵${marketingRev.toLocaleString()}`, trend: '+22.4%' });
            setResv({ count: String(custCount || 0), label: 'Active Deals', trend: '+15% vs yesterday' });
            setStockCount('2');
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

          const mappedOrders = (recProfiles ?? []).map(p => ({
            name: p.full_name || p.email,
            id: p.role || 'Staff',
            status: p.status === 'ACTIVE' ? 'Completed' : 'Processing',
            time: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: p.status
          }));

          if (active) {
            setKpis([
              { label: 'Payroll Est.', value: '₵148,200', trend: '+4.2%', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign, data: [4, 5, 5, 6, 6, 7, 7] },
              { label: 'Total Staff', value: String(staffCount || 0), trend: '+2', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: Users, data: [2, 3, 3, 4, 4, 5, 5] },
              { label: 'Attendance Rate', value: `${rate}%`, trend: '+1.2%', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3, data: [6, 7, 6, 7, 8, 8, 9] },
              { label: 'Open Positions', value: '3', trend: '+1', up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: ClipboardList, data: [2, 2, 3, 3, 3, 4, 3] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: '₵148,200', trend: '+4.2%' });
            setResv({ count: String(pendingStaff || 0), label: 'Pending Requests', trend: '+1 vs yesterday' });
            setStockCount('0');
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

          const mappedOrders = (recCargo ?? []).map(c => ({
            name: c.product_name,
            id: c.goods_code || c.id,
            status: c.status === 'APPROVED' ? 'Completed' : c.status === 'DISCREPANCY_FLAGGED' ? 'Cancelled' : 'Processing',
            time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: `${c.quantity} Units`
          }));

          if (active) {
            setKpis([
              { label: 'Stock Value', value: `₵${stockVal.toLocaleString()}`, trend: '+6.4%', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign, data: [5, 6, 5, 7, 6, 8, 7] },
              { label: 'Ingestions', value: `${totalTons.toLocaleString()}T`, trend: '+9.1%', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: Package, data: [3, 4, 3, 6, 5, 7, 6] },
              { label: 'Warehouses', value: '3', trend: '0%', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3, data: [3, 3, 3, 3, 3, 3, 3] },
              { label: 'Defect Rate', value: '0.8%', trend: '-0.3%', up: true, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [5, 4, 4, 3, 3, 3, 2] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: `₵${stockVal.toLocaleString()}`, trend: '+6.4%' });
            setResv({ count: `${totalTons.toLocaleString()}`, label: 'Tons Ingested', trend: '+9% vs yesterday' });
            setStockCount(String(faultCount));
          }
        } else if (activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS') {
          const { count: delCount } = await supabase.from('delivery_logs').select('id', { count: 'exact', head: true });
          const { count: activeCount } = await supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT');
          const { count: compCount } = await supabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'DELIVERED');

          const { data: recDel } = await supabase
            .from('delivery_logs')
            .select('id, driver_name, vehicle_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

          const mappedOrders = (recDel ?? []).map(d => ({
            name: `${d.driver_name || 'Driver'} (${d.vehicle_id || 'Truck'})`,
            id: d.id,
            status: d.status === 'DELIVERED' ? 'Completed' : d.status === 'ASSIGNED' ? 'Processing' : 'On the Way',
            time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: d.status
          }));

          if (active) {
            setKpis([
              { label: 'Deliveries', value: String(delCount || 0), trend: '+2', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: Truck, data: [3, 4, 3, 5, 4, 6, 5] },
              { label: 'Revenue', value: `₵${((delCount || 0) * 1200).toLocaleString()}`, trend: '+8.4%', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: DollarSign, data: [2, 3, 3, 5, 4, 6, 5] },
              { label: 'On-Time Rate', value: '91%', trend: '+3%', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3, data: [6, 7, 7, 8, 8, 9, 9] },
              { label: 'Avg. Distance', value: '42 km', trend: '-5km', up: true, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: Star, data: [7, 6, 6, 5, 5, 5, 4] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: `₵${((delCount || 0) * 1200).toLocaleString()}`, trend: '+8.4%' });
            setResv({ count: String(activeCount || 0), label: 'Active Routes', trend: '0 vs yesterday' });
            setStockCount('3');
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

          const mappedOrders = (recProd ?? []).map(p => {
            const keys = Object.keys(p.items || {});
            return {
              name: keys.length > 0 ? `${keys[0]} batch` : 'Production batch',
              id: `#${p.id.substring(0, 8)}`,
              status: p.status === 'COMPLETED' ? 'Completed' : p.status === 'REJECTED' ? 'Cancelled' : 'Processing',
              time: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              amount: p.status
            };
          });

          if (active) {
            setKpis([
              { label: 'Batch Revenue', value: '₵186,400', trend: '+7.8%', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: DollarSign, data: [4, 5, 5, 6, 6, 7, 7] },
              { label: 'Batches', value: String(reqCount || 0), trend: '+3', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: Package, data: [3, 4, 3, 5, 4, 5, 5] },
              { label: 'Completion Rate', value: `${pct}%`, trend: '+2%', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3, data: [7, 7, 8, 8, 9, 9, 9] },
              { label: 'Material Waste', value: '3.1%', trend: '-0.4%', up: true, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [5, 5, 4, 4, 3, 3, 3] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: '₵186,400', trend: '+7.8%' });
            setResv({ count: String(reqCount || 0), label: 'Active Batches', trend: '+3 vs yesterday' });
            setStockCount('4');
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

          const mappedOrders = (recVisitors ?? []).map(v => ({
            name: v.full_name,
            id: v.purpose || 'Visit',
            status: v.check_out_time ? 'Completed' : 'Processing',
            time: new Date(v.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            amount: v.check_out_time ? 'Checked Out' : 'Active'
          }));

          if (active) {
            setKpis([
              { label: 'Visitors Today', value: String(visCount), trend: '+4', up: true, iconBg: '#ede9fe', iconColor: '#7c3aed', Icon: Users, data: [2, 4, 3, 5, 4, 6, 5] },
              { label: 'Check-ins', value: String(attCount), trend: '+2', up: true, iconBg: '#ffedd5', iconColor: '#f97316', Icon: ClipboardList, data: [2, 3, 3, 4, 4, 5, 4] },
              { label: 'Avg. Visit', value: '28 min', trend: '-4min', up: true, iconBg: '#ccfbf1', iconColor: '#14b8a6', Icon: BarChart3, data: [7, 6, 6, 5, 5, 4, 4] },
              { label: 'Pending Badges', value: String(visCount - (recVisitors?.filter(v => v.check_out_time).length || 0)), trend: '+1', up: false, iconBg: '#fce7f3', iconColor: '#ec4899', Icon: AlertTriangle, data: [1, 2, 2, 3, 3, 3, 3] }
            ]);
            setRecentOrders(mappedOrders);
            setSale({ value: `₵${(visCount * 120).toLocaleString()}`, trend: '+2.1%' });
            setResv({ count: String(visCount), label: 'Visitors Today', trend: '+15% vs yesterday' });
            setStockCount('1');
          }
        }

        // Fetch Top Items (based on cargo intake volume)
        const { data: topCargo } = await supabase.from('cargo_intake').select('product_name');
        const counts: Record<string, number> = {};
        for (const item of topCargo ?? []) {
          counts[item.product_name] = (counts[item.product_name] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const mappedTop = sorted.map(([name, count], i) => ({
          num: i + 1,
          numColor: i === 0 ? '#7c3aed' : i === 1 ? '#f97316' : '#14b8a6',
          name,
          count: `${count} ingestion${count > 1 ? 's' : ''}`,
          price: '₵1,200/unit'
        }));
        if (active && mappedTop.length > 0) {
          setTopItems(mappedTop);
        } else if (active) {
          setTopItems([
            { num: 1, numColor: '#7c3aed', name: 'Cocoa Beans (Grade A)', count: '12 orders', price: '₵4,800/ton' },
            { num: 2, numColor: '#f97316', name: 'Palm Oil (Refined)', count: '8 orders', price: '₵2,400/barrel' },
            { num: 3, numColor: '#14b8a6', name: 'Maize (Yellow Dent)', count: '5 orders', price: '₵1,200/bag' }
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
    <div className="aczone-shell pb-10">

      {/* ── GREETING ─────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Welcome back, {currentUser?.fullName?.split(' ')[0] || 'there'}! 👋
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Here's what's happening with your {deptTitle[activeDepartment]?.toLowerCase() || 'department'} today.
        </p>
      </div>

      {/* ── 4 KPI CARDS ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aczone-kpi-card animate-pulse">
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
              </div>
            </div>
          ))
        ) : (
          kpis.map((kpi, i) => {
            const Icon = kpi.Icon;
            return (
              <div key={i} className="aczone-kpi-card">
                <div className="flex items-start justify-between">
                  {/* Soft circle icon */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: kpi.iconBg }}>
                    <Icon className="w-5 h-5" style={{ color: kpi.iconColor }} />
                  </div>
                  {/* Sparkline right */}
                  <Sparkline data={kpi.data} color={kpi.iconColor} />
                </div>
                <div className="mt-3">
                  <p className="text-[11px] text-[var(--text-muted)] font-medium">{kpi.label}</p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] mt-0.5">{kpi.value}</h3>
                  <p className={`flex items-center gap-1 text-[11px] font-semibold mt-1 ${kpi.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {kpi.up
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />}
                    <span>{kpi.trend}</span>
                    <span className="text-[var(--text-muted)] font-normal">vs yesterday</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── SALES OVERVIEW + RECENT ORDERS ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Sales Overview — area chart */}
        <div className="lg:col-span-2 aczone-card rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Sales Overview</p>
              <div className="flex items-baseline gap-3 mt-1">
                <h3 className="text-2xl font-extrabold text-[var(--text-primary)]">{sale.value}</h3>
                <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-500">
                  <TrendingUp className="w-3 h-3" /> {sale.trend}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">vs last week</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select className="text-[11px] border border-[var(--border)] bg-[var(--bg-page)] text-[var(--text-secondary)] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer font-medium">
                <option>This Week</option>
                <option>Last Week</option>
                <option>This Month</option>
              </select>
              <button className="p-1.5 rounded-lg hover:bg-[var(--bg-page)] transition-colors cursor-pointer">
                <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aczoneAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.20} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.8} />
                <XAxis
                  dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const isThursday = payload.value === 'Thu';
                    return (
                      <g transform={`translate(${x},${y})`}>
                        {isThursday && (
                          <rect x={-18} y={2} width={36} height={18} rx={9} fill="#7c3aed" />
                        )}
                        <text x={0} y={14} textAnchor="middle" fill={isThursday ? '#fff' : 'var(--text-muted)'} fontSize={11} fontWeight={isThursday ? 700 : 400}>
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v === 0 ? '0' : `${v/1000}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 11, color: '#fff', padding: '4px 10px' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ display: 'none' }}
                  formatter={(v) => [`₵${Number(v).toLocaleString()}`, '']}
                  cursor={{ stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#aczoneAreaGrad)"
                  dot={{ fill: '#7c3aed', strokeWidth: 2, stroke: '#fff', r: 4 }}
                  activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="aczone-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">Recent Orders</p>
            <button className="text-[11px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">View all</button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <Package className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs">No recent activity logged.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-[#7c3aed]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{order.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{order.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusStyle[order.status] || ''}`}>
                      {order.status}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{order.time}</span>
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{order.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TOP ITEMS + RESERVATIONS + LOW STOCK ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Top Items */}
        <div className="lg:col-span-2 aczone-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS' ? 'Top Routes' : 'Top Items'}
            </p>
            <button className="text-[11px] text-[#7c3aed] font-semibold hover:underline cursor-pointer">View all</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aczone-top-item-card rounded-xl p-4 animate-pulse">
                  <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-xl mx-auto mb-3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mx-auto" />
                </div>
              ))
            ) : (
              topItems.map((item, i) => (
                <div key={i} className="aczone-top-item-card rounded-xl p-4">
                  {/* Numbered badge + icon placeholder */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                      style={{ background: item.numColor }}>
                      {item.num}
                    </div>
                  </div>
                  {/* Icon circle */}
                  <div className="w-14 h-14 rounded-xl bg-[#ede9fe] flex items-center justify-center mb-3 mx-auto">
                    <Package className="w-6 h-6 text-[#7c3aed]" />
                  </div>
                  <p className="text-[11px] font-bold text-[var(--text-primary)] text-center leading-snug mb-1">{item.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] text-center mb-1">{item.count}</p>
                  <p className="text-[12px] font-extrabold text-[#7c3aed] text-center">{item.price}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reservations Today + Low Stock */}
        <div className="flex flex-col gap-4">
          {/* Reservations / Batches today */}
          <div className="aczone-card rounded-2xl p-5 flex-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ede9fe] flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 text-[#7c3aed]" />
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">{resv.label}</p>
                <h3 className="text-3xl font-extrabold text-[var(--text-primary)] leading-none mt-1">{resv.count}</h3>
                <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 mt-1.5">
                  <TrendingUp className="w-3 h-3" /> {resv.trend}
                </p>
              </div>
            </div>
          </div>

          {/* Low Stock / Alerts */}
          <div className="aczone-card rounded-2xl p-5 flex-1">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fce7f3] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#ec4899]" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-[var(--text-muted)] font-medium">
                  {activeDepartment === 'OPERATIONS' || activeDepartment === 'PRODUCTION' ? 'Low Stock Items' : 'Active Alerts'}
                </p>
                <h3 className="text-3xl font-extrabold text-[var(--text-primary)] leading-none mt-1">
                  {stockCount} <span className="text-base font-semibold text-[var(--text-muted)]">Items</span>
                </h3>
                <button className="mt-2 text-[10px] font-bold text-white bg-[#7c3aed] hover:bg-[#6d28d9] px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1">
                  View Details <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main dashboard content */}
      <div className="mt-6">
        {children}
      </div>

    </div>
  );
}
