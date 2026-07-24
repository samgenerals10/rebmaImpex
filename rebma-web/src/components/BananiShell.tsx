// rebma-web/src/components/BananiShell.tsx
// "Banani UI 1" — exact-match rebuild of the Banani-generated prototype
// (https://app.banani.co/prototype/N2Ya3K7lv5YO). Colors, radii, shadows,
// card/badge/button construction were pulled directly from that prototype's
// own compiled CSS via its API, not approximated from screenshots.
//
// Same contract as the other shells (FinovaShell, AczoneShell, etc.): the
// real sidebar/header from App.tsx stay untouched — this only reskins the
// main content area, rendering a Banani-styled overview above the
// department's existing screen (still reachable via `children`). Every
// action here (Approve/Reject, View Profile) is wired to the same real
// Supabase mutations the existing approval/customer screens use — nothing
// here is decorative or fake data.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, ShoppingCart, Boxes, Clock, Truck, Users, ClipboardList,
  Wallet, CreditCard, AlertTriangle, Factory, Warehouse, UserCheck,
  Briefcase, Calendar, MapPin, Package, ArrowUpRight, Download,
  Building2, Megaphone, Activity, ShieldCheck, CalendarClock, Banknote,
  Check, X, CalendarDays,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import DispatchMap, { type DispatchMapDelivery } from './dispatch/DispatchMap';
import {
  B as DARK_B, LIGHT_B, BananiThemeContext, KpiCard, BanCard, ApprovalCard, ProfileCard, Stepper, ProgressRow, Badge,
  thStyle, tdStyle, fmtMoney, type StepDef,
} from './banani/primitives';
import type { CurrentUser } from '../types/erp';

interface BananiShellProps {
  activeDepartment: string;
  activeSubTab?: string;
  currentUser: CurrentUser | null;
  darkMode?: boolean;
  children: React.ReactNode;
  setActiveSubTab?: (tab: string) => void;
}

// Matches the `id` of each department's "Dashboard" entry in Sidebar.tsx —
// the Banani overview only takes over that one landing screen; every other
// subtab (Orders, Customers, Invoices, ...) passes straight through to the
// real screen so it isn't duplicated under a stale overview on every page.
const DASHBOARD_SUBTAB: Record<string, string> = {
  CEO: 'Overview', FINANCE: 'Evaluation', MANAGEMENT: 'CargoApproval', HR: 'Employees',
  MARKETING: 'Overview', OPERATIONS: 'Overview', DISPATCH: 'Deliveries', RECEPTION: 'VisitorLog',
  PRODUCTION: 'Requisition', LOGISTICS: 'Overview',
};

const fmtAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

const priorityFor = (amount: number): 'HIGH' | 'CRITICAL' | 'NORMAL' =>
  amount > 50000 ? 'CRITICAL' : amount > 15000 ? 'HIGH' : 'NORMAL';

export default function BananiShell({ activeDepartment, activeSubTab, currentUser, darkMode = true, children, setActiveSubTab }: BananiShellProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const B = darkMode ? DARK_B : LIGHT_B;
  const isDashboardTab = activeSubTab === undefined || activeSubTab === DASHBOARD_SUBTAB[activeDepartment];
  const isPassthrough = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS' || !isDashboardTab;
  const performedBy = currentUser?.fullName || 'Management';

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  useEffect(() => {
    if (isPassthrough) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [
          { data: orders }, { data: cargo }, { data: prodReqs }, { data: genPurch },
          { data: floatReqs }, { data: matReqs }, { data: staff }, { data: driversRaw },
          { data: deliveries }, { data: customers }, { data: payments }, { data: stock },
          { data: attendance }, { data: goodsPrices }, { data: visitors },
          { data: auditHistory }, { data: expenses }, { data: leaveRequests }, { data: payrollBatches },
        ] = await Promise.all([
          supabase.from('orders').select('id, client_name, product_name, total_amount, status, payment_mode, created_at').order('created_at', { ascending: false }).limit(100),
          supabase.from('cargo_intake').select('id, status, quantity, unit_price, created_at').limit(200),
          supabase.from('production_requests').select('id, request_number, product_name, quantity, status, requested_by, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('general_purchases').select('id, item_name, cost, status, department, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('float_requests').select('id, amount, status, department, requested_by, reason, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('material_requisitions').select('id, status, items, requested_by, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('profiles').select('id, full_name, role, status, photo').eq('status', 'ACTIVE').limit(300),
          supabase.from('drivers').select('id, driver_id, full_name, vehicle_id, status, photo').neq('status', 'OFFLINE').then(r => r, () => ({ data: [] as any[] })),
          supabase.from('delivery_logs').select('id, status, driver_id, customer_name, created_at').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('customers').select('id, name, company_name, location, customer_photo').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('finance_payments').select('amount, payment_mode, created_at').limit(300).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('stock').select('product_name, quantity, unit').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('attendance').select('id, status, date').eq('date', new Date().toISOString().slice(0, 10)).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('goods_prices').select('product_name, unit_price').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('visitors').select('id, full_name, purpose, check_in_time, check_out_time').order('check_in_time', { ascending: false }).limit(50).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('global_audit_history').select('id, action, department, performed_by, timestamp').order('timestamp', { ascending: false }).limit(12).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('finance_expenses').select('id, category, amount, date, created_at').limit(300).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('payroll_batches').select('*').limit(24).then(r => r, () => ({ data: [] as any[] })),
        ]);
        if (!active) return;
        setData({
          orders: orders || [], cargo: cargo || [], prodReqs: prodReqs || [], genPurch: genPurch || [],
          floatReqs: floatReqs || [], matReqs: matReqs || [], staff: staff || [], drivers: driversRaw || [],
          deliveries: deliveries || [], customers: customers || [], payments: payments || [], stock: stock || [],
          attendance: attendance || [], goodsPrices: goodsPrices || [], visitors: visitors || [],
          auditHistory: auditHistory || [], expenses: expenses || [], leaveRequests: leaveRequests || [], payrollBatches: payrollBatches || [],
        });
      } catch (e) {
        console.error('BananiShell data load failed', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeDepartment, isPassthrough, refreshTick]);

  const refresh = () => setRefreshTick(t => t + 1);

  // ── Real actions — mirror the exact mutations MgmtApprovalsView.tsx /
  // MaterialRequisitionsPanel.tsx already perform, so a click here has the
  // identical effect as using the real Approvals Queue. ──────────────────
  async function approveOrderAction(order: any, approve: boolean) {
    const newStatus = approve ? 'PENDING_FINANCE' : 'REJECTED';
    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    if (approve) {
      await supabase.from('supplier_order_notifications').insert([
        { message: `Order approved by Management — now awaiting Finance processing: Sales Order for ${order.client_name}`, notified_department: 'FINANCE', read: false },
        { message: `Your order has been approved by Management and sent to Finance: Sales Order for ${order.client_name}`, notified_department: 'MARKETING', read: false },
      ]);
    } else {
      await supabase.from('supplier_order_notifications').insert([{ message: `Order REJECTED by Management: Sales Order for ${order.client_name}`, notified_department: 'MARKETING', read: false }]);
    }
    await supabase.from('global_audit_history').insert([{ department: 'MANAGEMENT', action: `${approve ? 'APPROVE' : 'REJECT'}: ORD-${String(order.id).slice(-6).toUpperCase()} — Sales Order for ${order.client_name} — GHS ${Number(order.total_amount || 0).toLocaleString()}`, performed_by: performedBy }]);
    refresh();
  }

  async function approveGeneralPurchaseAction(gp: any, approve: boolean) {
    const newStatus = approve ? 'APPROVED' : 'REJECTED';
    await supabase.from('general_purchases').update({ status: newStatus }).eq('id', gp.id);
    if (approve) {
      await supabase.from('supplier_order_notifications').insert([{ message: `General purchase APPROVED by Management: ${gp.item_name}`, notified_department: gp.department || 'OPERATIONS', read: false }]);
    }
    await supabase.from('global_audit_history').insert([{ department: 'MANAGEMENT', action: `${approve ? 'APPROVE' : 'REJECT'}: PURCH-${String(gp.id).slice(-6).toUpperCase()} — ${gp.item_name}`, performed_by: performedBy }]);
    refresh();
  }

  async function approveFloatAction(fr: any, approve: boolean) {
    const now = new Date().toISOString();
    if (approve) {
      await supabase.from('float_requests').update({ status: 'APPROVED', approved_by: performedBy, updated_at: now }).eq('id', fr.id);
      const { data: latestEntry } = await supabase.from('finance_petty_cash').select('balance_after').order('created_at', { ascending: false }).limit(1);
      const currentBalance = Number(latestEntry?.[0]?.balance_after) || 0;
      const amount = Number(fr.amount) || 0;
      await supabase.from('finance_petty_cash').insert({ date: now.slice(0, 10), description: `Replenishment approved by Management: ${fr.reason || 'Float top-up'}`, amount, disbursed_to: 'Petty Cash Float', category: 'Replenishment', type: 'replenishment', balance_after: currentBalance + amount, created_at: now });
      await supabase.from('supplier_order_notifications').insert([{ message: `Float replenishment APPROVED by Management: GHS ${amount.toLocaleString()} added to petty cash.`, notified_department: 'FINANCE', read: false }]);
    } else {
      await supabase.from('float_requests').update({ status: 'REJECTED', updated_at: now }).eq('id', fr.id);
      await supabase.from('supplier_order_notifications').insert([{ message: `Float replenishment REJECTED by Management: GHS ${Number(fr.amount).toLocaleString()} — ${fr.department}`, notified_department: 'FINANCE', read: false }]);
    }
    await supabase.from('global_audit_history').insert([{ department: 'MANAGEMENT', action: `${approve ? 'APPROVE' : 'REJECT'}: FLOAT-${String(fr.id).slice(-6).toUpperCase()} — Float replenishment GHS ${Number(fr.amount).toLocaleString()}`, performed_by: performedBy }]);
    refresh();
  }

  // Mirrors LeaveManagementView.tsx's approve mutation exactly. Rejection
  // needs a reason captured through a form, so — same pattern as Cargo
  // Intake above — it routes to the real Leave Management screen instead of
  // faking a reason here.
  async function approveLeaveAction(leave: any) {
    await supabase.from('leave_requests').update({ status: 'APPROVED' }).eq('id', leave.id);
    await supabase.from('global_audit_history').insert([{ department: 'HR', action: `APPROVE: Leave request — ${leave.staff_name} (${leave.leave_type}, ${leave.days_count} days)`, performed_by: performedBy }]);
    refresh();
  }

  const orders = data.orders || [];
  const pendingOrders = orders.filter((o: any) => o.status === 'PENDING_MANAGEMENT');
  const pendingCargo = (data.cargo || []).filter((c: any) => c.status === 'PENDING_MANAGEMENT_APPROVAL');
  const pendingGenPurch = (data.genPurch || []).filter((g: any) => g.status === 'PENDING_MANAGEMENT_APPROVAL');
  const pendingFloat = (data.floatReqs || []).filter((f: any) => f.status === 'PENDING_MANAGEMENT');
  const pendingProd = (data.prodReqs || []).filter((p: any) => p.status === 'PENDING_MANAGEMENT');
  const pendingMatReq = (data.matReqs || []).filter((m: any) => m.status === 'PENDING_MANAGEMENT');
  const totalPending = pendingCargo.length + pendingOrders.length + pendingProd.length + pendingGenPurch.length + pendingFloat.length + pendingMatReq.length;

  const approvedOrders = orders.filter((o: any) => ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status));
  const totalRevenue = approvedOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
  const activeOrdersCount = orders.filter((o: any) => !['DELIVERED', 'REJECTED'].includes(o.status)).length;
  const stockValue = (data.stock || []).reduce((s: number, r: any) => {
    const price = (data.goodsPrices || []).find((g: any) => g.product_name === r.product_name)?.unit_price || 0;
    return s + Number(price) * Number(r.quantity || 0);
  }, 0);
  const activeTrucks = (data.drivers || []).filter((d: any) => d.status === 'ACTIVE' || d.status === 'ON_DELIVERY').length;
  const totalDrivers = (data.drivers || []).length;
  const employeeCount = (data.staff || []).length;

  // Unified pending-approval feed with real per-type approve/reject actions.
  type MixedItem = { id: string; refId: string; title: string; who: string; description: string; amount: number; created: string; priority: 'HIGH' | 'CRITICAL' | 'NORMAL'; onApprove: () => Promise<void>; onReject: () => Promise<void> };
  const mixedApprovals: MixedItem[] = useMemo(() => {
    const rows: MixedItem[] = [];
    pendingOrders.forEach((o: any) => rows.push({
      id: `ord-${o.id}`, refId: `ORD-${String(o.id).slice(-6).toUpperCase()}`, title: `Sales Order — ${o.client_name}`,
      who: 'Marketing', description: `${o.payment_mode || 'CASH'} order for ${o.product_name || 'goods'} — awaiting Management approval`,
      amount: Number(o.total_amount || 0), created: o.created_at, priority: priorityFor(Number(o.total_amount || 0)),
      onApprove: () => approveOrderAction(o, true), onReject: () => approveOrderAction(o, false),
    }));
    pendingGenPurch.forEach((g: any) => rows.push({
      id: `gp-${g.id}`, refId: `PURCH-${String(g.id).slice(-6).toUpperCase()}`, title: g.item_name || 'General Purchase',
      who: g.department || 'Operations', description: `General purchase request from ${g.department || 'Operations'}`,
      amount: Number(g.cost || 0), created: g.created_at, priority: priorityFor(Number(g.cost || 0)),
      onApprove: () => approveGeneralPurchaseAction(g, true), onReject: () => approveGeneralPurchaseAction(g, false),
    }));
    pendingFloat.forEach((f: any) => rows.push({
      id: `fl-${f.id}`, refId: `FLOAT-${String(f.id).slice(-6).toUpperCase()}`, title: `Float Replenishment — ${f.department}`,
      who: f.requested_by || f.department, description: f.reason || 'Petty cash replenishment request',
      amount: Number(f.amount || 0), created: f.created_at, priority: 'NORMAL',
      onApprove: () => approveFloatAction(f, true), onReject: () => approveFloatAction(f, false),
    }));
    // Cargo Intake needs a damage/quantity form (unit cost, damaged count) that
    // doesn't fit a two-button card — surfaced here read-only, action happens
    // in the real Approvals Queue, same as Banani's own design doesn't attempt
    // to cram that workflow into this card type either.
    pendingCargo.forEach((c: any) => rows.push({
      id: `cg-${c.id}`, refId: `CARGO-${String(c.id).slice(-6).toUpperCase()}`, title: 'Cargo Intake — needs discrepancy review',
      who: 'Operations', description: 'Requires a damage/quantity review — opens the full Approvals Queue',
      amount: Number(c.quantity || 0) * Number(c.unit_price || 0), created: c.created_at, priority: 'HIGH',
      onApprove: async () => setActiveSubTab?.('CreditApproval'), onReject: async () => setActiveSubTab?.('CreditApproval'),
    }));
    return rows.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }, [data, currentUser]);

  const kanban = useMemo(() => {
    const cols = [
      { key: 'New', label: 'New', color: B.primary, statuses: ['PENDING_MANAGEMENT'] },
      { key: 'Finance', label: 'Payment Pending', color: B.warning, statuses: ['PENDING_FINANCE'] },
      { key: 'Approved', label: 'Approved', color: B.success, statuses: ['APPROVED'] },
      { key: 'Processing', label: 'Processing', color: B.purple, statuses: ['PROCESSING', 'OUT_FOR_DELIVERY'] },
    ];
    return cols.map(c => ({ ...c, items: orders.filter((o: any) => c.statuses.includes(o.status)).slice(0, 4), count: orders.filter((o: any) => c.statuses.includes(o.status)).length }));
  }, [orders]);

  const topCustomers = useMemo(() => {
    const byName: Record<string, { name: string; company: string; orders: number; value: number; photo?: string }> = {};
    orders.forEach((o: any) => {
      const key = o.client_name || 'Unknown';
      if (!byName[key]) {
        const c = (data.customers || []).find((c: any) => c.name === key);
        byName[key] = { name: key, company: c?.company_name || '—', orders: 0, value: 0, photo: c?.customer_photo };
      }
      byName[key].orders += 1;
      byName[key].value += Number(o.total_amount || 0);
    });
    return Object.values(byName).sort((a, b) => b.value - a.value).slice(0, 3);
  }, [orders, data.customers]);

  const fleetDeliveries: DispatchMapDelivery[] = useMemo(() => (data.drivers || []).map((d: any) => ({
    id: d.id, driverId: d.driver_id, driverName: d.full_name, vehicleId: d.vehicle_id,
    driverState: d.status === 'ON_DELIVERY' ? 'ON_THE_WAY' : 'AT_COMPANY',
  })), [data.drivers]);

  // Last 6 months of real revenue (delivered/approved orders) vs real
  // logged expenses, bucketed by month — feeds the CEO Revenue vs Expenses
  // chart with the same numbers Finance's own screens would show.
  const monthlyFinance = useMemo(() => {
    const months: { key: string; name: string; Revenue: number; Expenses: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, name: d.toLocaleString('default', { month: 'short' }), Revenue: 0, Expenses: 0 });
    }
    const byKey: Record<string, typeof months[0]> = {};
    months.forEach(m => { byKey[m.key] = m; });
    approvedOrders.forEach((o: any) => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (byKey[key]) byKey[key].Revenue += Number(o.total_amount || 0);
    });
    (data.expenses || []).forEach((e: any) => {
      const d = new Date(e.date || e.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (byKey[key]) byKey[key].Expenses += Number(e.amount || 0);
    });
    return months;
  }, [approvedOrders, data.expenses]);
  const totalExpenses = (data.expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const DEPT_ICON: Record<string, any> = {
    FINANCE: Wallet, OPERATIONS: Package, LOGISTICS: Truck, PRODUCTION: Factory, HR: Users, MARKETING: Megaphone,
    MANAGEMENT: ShieldCheck, DISPATCH: Truck, RECEPTION: Building2, CEO: ShieldCheck,
  };
  const activityFeed = useMemo(() => (data.auditHistory || []).map((a: any) => ({
    id: a.id, text: a.action, department: a.department, performedBy: a.performed_by, ago: fmtAgo(a.timestamp),
  })), [data.auditHistory]);

  // Department Overview — one honest real metric + real pending-action count
  // per department, not fabricated figures.
  const departmentOverview = useMemo(() => [
    { key: 'FINANCE', label: 'Finance', value: fmtMoney((data.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)), actions: pendingFloat.length + orders.filter((o: any) => o.status === 'PENDING_FINANCE').length },
    { key: 'OPERATIONS', label: 'Operations', value: `${(data.stock || []).length} SKU`, actions: pendingCargo.length },
    { key: 'LOGISTICS', label: 'Logistics', value: `${activeTrucks} trucks`, actions: (data.deliveries || []).filter((d: any) => d.status === 'FAILED').length },
    { key: 'PRODUCTION', label: 'Production', value: `${(data.prodReqs || []).length} reqs`, actions: pendingProd.length + pendingMatReq.length },
    { key: 'HR', label: 'HR', value: `${employeeCount} staff`, actions: (data.leaveRequests || []).filter((l: any) => l.status === 'PENDING').length },
    { key: 'MARKETING', label: 'Marketing', value: `${topCustomers.length} leads`, actions: pendingOrders.length },
  ], [data, pendingFloat, pendingCargo, pendingProd, pendingMatReq, activeTrucks, employeeCount, topCustomers, orders, pendingOrders]);

  // Quick Stats — real payment-mode split and delivery performance, using
  // the existing ProgressRow primitive (built earlier, previously unused).
  const cashOrders = orders.filter((o: any) => o.payment_mode === 'CASH').length;
  const creditOrders = orders.filter((o: any) => o.payment_mode === 'CREDIT').length;
  const deliveriesToday = (data.deliveries || []).filter((d: any) => new Date(d.created_at).toDateString() === new Date().toDateString());
  const deliveredCount = (data.deliveries || []).filter((d: any) => d.status === 'DELIVERED').length;
  const onTimeRate = (data.deliveries || []).length > 0 ? (deliveredCount / (data.deliveries || []).length) * 100 : 0;

  // HR: attendance / payroll / leave — real tables, same ones
  // AttendanceView / PayrollView / LeaveManagementView already read from.
  const presentToday = (data.attendance || []).filter((a: any) => a.status === 'PRESENT').length;
  const lateToday = (data.attendance || []).filter((a: any) => a.status === 'LATE').length;
  const onLeaveToday = (data.leaveRequests || []).filter((l: any) => {
    if (l.status !== 'APPROVED') return false;
    const today = new Date().toISOString().slice(0, 10);
    return l.start_date <= today && l.end_date >= today;
  }).length;
  const payrollTotal = (data.payrollBatches || []).reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  const payrollProcessed = (data.payrollBatches || []).filter((b: any) => b.status === 'PAID').reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0);
  const pendingLeaves = (data.leaveRequests || []).filter((l: any) => l.status === 'PENDING').slice(0, 5);

  const deptSubtitle: Record<string, string> = {
    CEO: 'Live overview of all business operations',
    MANAGEMENT: 'Approval workflow, pricing, and team oversight',
    MARKETING: 'Customer management, orders pipeline, and campaign tracking',
    FINANCE: "Here's what's happening with your finances today",
    HR: 'Employee management, attendance, payroll, and team analytics',
    OPERATIONS: 'Warehouse intake, stock levels, and discrepancy tracking',
    PRODUCTION: 'Production line requests and warehouse handoffs',
    DISPATCH: 'Fleet and delivery job overview',
    LOGISTICS: 'Fleet, fuel, and maintenance overview',
    RECEPTION: "Today's visitor and front-desk overview",
  };

  const oldestPendingOrder = pendingOrders[pendingOrders.length - 1] || orders.find((o: any) => o.status === 'PENDING_FINANCE');
  const orderSteps: StepDef[] = oldestPendingOrder ? [
    { label: 'Submitted', time: new Date(oldestPendingOrder.created_at).toLocaleDateString(), state: 'done' },
    { label: 'Management Approval', state: oldestPendingOrder.status === 'PENDING_MANAGEMENT' ? 'active' : 'done' },
    { label: 'Finance Review', state: oldestPendingOrder.status === 'PENDING_FINANCE' ? 'active' : oldestPendingOrder.status === 'PENDING_MANAGEMENT' ? 'pending' : 'done' },
    { label: 'Dispatch', state: ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(oldestPendingOrder.status) ? 'done' : 'pending' },
  ] : [];

  if (isPassthrough) return <>{children}</>;

  return (
    <BananiThemeContext.Provider value={B}>
    <div style={{ background: B.bgGradient, margin: '-16px -16px 0', padding: 16, borderRadius: B.radiusXl, fontFamily: B.font }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: B.fg, fontFamily: B.font }}>{greeting}, {currentUser?.fullName?.split(' ')[0] || 'there'} 👋</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: B.mutedFg }}>{deptSubtitle[activeDepartment] || 'Department overview'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${B.warning}1a`, border: `1px solid ${B.warning}33`, borderRadius: 999, padding: '5px 12px' }}>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: '50%', background: B.warning, display: 'inline-block', boxShadow: `0 0 6px ${B.warning}` }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: B.warning }}>{totalPending} Pending</span>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 18 }}>
          {[0, 1, 2, 3].map(i => (
            <motion.div key={i} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.1 }} style={{ height: 108, borderRadius: B.radiusXl, background: B.glass, border: `1px solid ${B.glassBorder}` }} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeDepartment + refreshTick} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {activeDepartment === 'CEO' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 18 }}>
                  <KpiCard index={0} icon={DollarSign} label="Total Revenue" value={totalRevenue} format={fmtMoney} trend={`${approvedOrders.length} approved`} color={B.primary} />
                  <KpiCard index={1} icon={ShoppingCart} label="Active Orders" value={activeOrdersCount} trend="in pipeline" color={B.cyan} />
                  <KpiCard index={2} icon={Boxes} label="Inventory Value" value={stockValue} format={fmtMoney} trend={`${(data.stock || []).length} SKUs`} color={B.success} />
                  <KpiCard index={3} icon={Clock} label="Pending Approvals" value={totalPending} trend={totalPending > 0 ? 'needs review' : 'all clear'} trendUp={totalPending === 0} color={B.warning} />
                  <KpiCard index={4} icon={Truck} label="Active Trucks" value={activeTrucks} trend={`of ${totalDrivers}`} color={B.purple} />
                  <KpiCard index={5} icon={Users} label="Employees" value={employeeCount} trend="active" color="#ef4444" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 16, marginBottom: 16 }}>
                  <BanCard title="Live Fleet Tracker" badge={activeTrucks} badgeColor={B.success} index={0}>
                    <div style={{ borderRadius: B.radiusLg, overflow: 'hidden' }}>
                      <DispatchMap deliveries={fleetDeliveries} height={280} compact />
                    </div>
                  </BanCard>
                  <BanCard title="Approval Center" icon={ClipboardList} badge={totalPending} badgeColor={B.warning} index={1}
                    action={<button onClick={() => setActiveSubTab?.('ControlCenter')} style={{ fontSize: 11, color: B.primary, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>}
                    noPad>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                      {mixedApprovals.length === 0 ? (
                        <p style={{ color: B.mutedFg, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>All clear — nothing pending.</p>
                      ) : mixedApprovals.slice(0, 4).map((a, i) => (
                        <ApprovalCard key={a.id} index={i} title={a.title} priority={a.priority} who={a.who} amount={a.amount} ago={fmtAgo(a.created)} refId={a.refId} onApprove={a.onApprove} onReject={a.onReject} />
                      ))}
                    </div>
                  </BanCard>
                </div>

                <BanCard title="Revenue vs Expenses" badge="6mo" index={2}>
                  <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: B.primary }}>{fmtMoney(totalRevenue)}</div><div style={{ fontSize: 11, color: B.mutedFg }}>Total Revenue</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: B.purple }}>{fmtMoney(totalExpenses)}</div><div style={{ fontSize: 11, color: B.mutedFg }}>Total Expenses</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: B.success }}>{fmtMoney(netProfit)}</div><div style={{ fontSize: 11, color: B.mutedFg }}>Net Profit</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700, color: B.fg }}>{profitMargin.toFixed(1)}%</div><div style={{ fontSize: 11, color: B.mutedFg }}>Profit Margin</div></div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyFinance}>
                      <defs>
                        <linearGradient id="banRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={B.primary} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={B.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="banExpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={B.purple} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={B.purple} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={B.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: B.mutedFg }} axisLine={{ stroke: B.border }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: B.mutedFg }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <RTooltip contentStyle={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, color: B.fg }} formatter={(v: any) => fmtMoney(Number(v))} />
                      <Area type="monotone" dataKey="Revenue" stroke={B.primary} fill="url(#banRevGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Expenses" stroke={B.purple} fill="url(#banExpGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </BanCard>

                <div style={{ marginTop: 16 }}>
                  <BanCard title="Department Overview" badge={departmentOverview.reduce((s, d) => s + d.actions, 0)} badgeColor={B.warning} index={3}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      {departmentOverview.map((d, i) => {
                        const Icon = DEPT_ICON[d.key] || Building2;
                        return (
                          <motion.div key={d.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            style={{ background: B.glass, border: `1px solid ${B.glassBorder}`, borderRadius: B.radiusLg, padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <Icon size={16} color={B.primary} />
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: d.actions > 0 ? `${B.warning}26` : `${B.success}26`, color: d.actions > 0 ? B.warning : B.success }}>{d.actions > 0 ? `${d.actions} actions` : 'Active'}</span>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: B.fg }}>{d.value}</div>
                            <div style={{ fontSize: 11, color: B.mutedFg, marginTop: 2 }}>{d.label}</div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </BanCard>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(240px,1fr)', gap: 16, marginTop: 16 }}>
                  <BanCard title="Live Activity Feed" icon={Activity} index={4} noPad>
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {activityFeed.length === 0 ? (
                        <p style={{ color: B.mutedFg, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No activity logged yet.</p>
                      ) : activityFeed.map((a: any, i: number) => {
                        const Icon = DEPT_ICON[a.department] || Activity;
                        return (
                          <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px', borderBottom: `1px solid ${B.border}` }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${B.primary}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon size={13} color={B.primary} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 12, color: B.fg }}>{a.text}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                <span style={{ fontSize: 10, color: B.mutedFg }}>{a.ago}</span>
                                <Badge color={B.secondaryFg} size="xs">{a.department}</Badge>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </BanCard>
                  <BanCard title="Quick Stats" index={5} noPad>
                    <ProgressRow index={0} label="Cash Orders" value={orders.length > 0 ? (cashOrders / orders.length) * 100 : 0} display={String(cashOrders)} color={B.success} />
                    <ProgressRow index={1} label="Credit Orders" value={orders.length > 0 ? (creditOrders / orders.length) * 100 : 0} display={String(creditOrders)} color={B.warning} />
                    <ProgressRow index={2} label="Deliveries Today" value={deliveriesToday.length > 0 ? 100 : 0} display={`${deliveriesToday.filter((d: any) => d.status === 'DELIVERED').length} / ${deliveriesToday.length}`} color={B.primary} />
                    <ProgressRow index={3} label="On-time Rate" value={onTimeRate} display={`${onTimeRate.toFixed(1)}%`} color={B.cyan} />
                  </BanCard>
                </div>
              </>
            )}

            {activeDepartment === 'MANAGEMENT' && (
              <>
                <BanCard
                  title={oldestPendingOrder ? `Approval Workflow — ${oldestPendingOrder.client_name || 'Order'}` : 'Approval Workflow'}
                  badge={oldestPendingOrder ? undefined : undefined}
                  action={oldestPendingOrder ? <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, fontWeight: 500, background: `${B.warning}26`, color: B.warning }}>{oldestPendingOrder.status.replace(/_/g, ' ')}</span> : undefined}
                  index={0}
                >
                  {orderSteps.length > 0 ? <Stepper steps={orderSteps} /> : <p style={{ color: B.mutedFg, fontSize: 13 }}>No orders in the pipeline right now.</p>}
                </BanCard>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, margin: '16px 0' }}>
                  {mixedApprovals.slice(0, 3).map((a, i) => (
                    <ApprovalCard key={a.id} variant="full" index={i} title={a.title} priority={a.priority} who={a.who} description={a.description} amount={a.amount} ago={fmtAgo(a.created)} refId={a.refId} onApprove={a.onApprove} onReject={a.onReject} />
                  ))}
                  {mixedApprovals.length === 0 && <p style={{ color: B.mutedFg, fontSize: 13 }}>Nothing pending right now — you're all caught up.</p>}
                </div>
                <BanCard title="Price Setting — Active Products" badge={(data.goodsPrices || []).length} index={2} noPad>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={thStyle(B)}>Product</th><th style={thStyle(B)}>Selling Price</th><th style={thStyle(B)}>In Stock</th></tr></thead>
                      <tbody>
                        {(data.goodsPrices || []).slice(0, 6).map((g: any) => (
                          <tr key={g.product_name}>
                            <td style={{ ...tdStyle(B), fontWeight: 600, color: B.secondaryFg }}>{g.product_name}</td>
                            <td style={{ ...tdStyle(B), color: B.success, fontWeight: 700 }}>{fmtMoney(Number(g.unit_price))}</td>
                            <td style={{ ...tdStyle(B), color: B.mutedFg }}>{(data.stock || []).find((s: any) => s.product_name === g.product_name)?.quantity ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BanCard>
              </>
            )}

            {activeDepartment === 'MARKETING' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                  {kanban.map((col, ci) => (
                    <motion.div key={col.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.06 }}
                      style={{ background: B.glass, border: `1px solid ${col.color}40`, borderRadius: B.radiusXl, padding: 14, minHeight: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${col.color}40` }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: B.fg }}>{col.label}</span>
                        <span style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', fontSize: 11, fontWeight: 700, color: col.color, background: B.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{col.count}</span>
                      </div>
                      {col.items.length === 0 ? <p style={{ fontSize: 11, color: B.mutedFg }}>Nothing here</p> : col.items.map((o: any) => (
                        <div key={o.id} style={{ background: B.glass, borderRadius: B.radiusMd, padding: 10, marginBottom: 8, border: `1px solid ${col.color}30` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: B.fg, margin: '0 0 2px' }}>{o.client_name}</p>
                            <ArrowUpRight size={13} color={col.color} />
                          </div>
                          <p style={{ fontSize: 10, color: B.mutedFg, margin: '0 0 8px' }}>{o.product_name}</p>
                          <div style={{ borderTop: `1px solid ${B.border}`, paddingTop: 6 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: col.color, margin: 0, textAlign: 'right' }}>{fmtMoney(Number(o.total_amount))}</p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                  {topCustomers.length === 0 ? <p style={{ color: B.mutedFg, fontSize: 13 }}>No customer orders recorded yet.</p> : topCustomers.map((c: any, i) => (
                    <ProfileCard key={c.name} index={i} name={c.name} sub={c.company} photo={c.photo}
                      rating={c.value > 100000 ? 'A+' : c.value > 30000 ? 'A' : 'B+'}
                      ratingColor={c.value > 100000 ? B.success : c.value > 30000 ? B.primary : B.warning}
                      stats={[{ label: 'Orders', value: String(c.orders) }, { label: 'Total Value', value: fmtMoney(c.value), accent: true }]}
                      actionLabel="View Profile" onAction={() => setActiveSubTab?.('RegisterCustomer')}
                    />
                  ))}
                </div>
                <BanCard title="Recent Sales Orders" index={4} noPad
                  action={<button onClick={() => setActiveSubTab?.('SalesHistory')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: B.primary, background: `${B.primary}14`, border: `1px solid ${B.primary}40`, borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}><Download size={12} /> Export</button>}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        <th style={thStyle(B)}>Order ID</th><th style={thStyle(B)}>Customer</th><th style={thStyle(B)}>Value</th>
                        <th style={thStyle(B)}>Status</th><th style={thStyle(B)}>Date</th>
                      </tr></thead>
                      <tbody>
                        {orders.length === 0 ? (
                          <tr><td colSpan={5} style={{ ...tdStyle(B), color: B.mutedFg, textAlign: 'center' }}>No orders yet.</td></tr>
                        ) : orders.slice(0, 6).map((o: any) => {
                          const statusColor = ['PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status) ? B.purple
                            : o.status === 'PENDING_FINANCE' ? B.warning
                            : o.status === 'APPROVED' ? B.cyan
                            : o.status === 'DELIVERED' ? B.success
                            : o.status === 'REJECTED' ? B.danger
                            : B.primary;
                          return (
                            <tr key={o.id}>
                              <td style={{ ...tdStyle(B), fontWeight: 700, color: B.secondaryFg }}>{String(o.id).slice(-8).toUpperCase()}</td>
                              <td style={tdStyle(B)}>{o.client_name}</td>
                              <td style={{ ...tdStyle(B), fontWeight: 700 }}>{fmtMoney(Number(o.total_amount))}</td>
                              <td style={tdStyle(B)}><Badge color={statusColor}>{o.status.replace(/_/g, ' ')}</Badge></td>
                              <td style={{ ...tdStyle(B), color: B.mutedFg }}>{new Date(o.created_at).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </BanCard>
              </>
            )}

            {activeDepartment === 'FINANCE' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <KpiCard index={0} icon={DollarSign} label="Total Revenue" value={totalRevenue} format={fmtMoney} trend={`${approvedOrders.length} orders`} color={B.primary} />
                <KpiCard index={1} icon={Wallet} label="Payments Recorded" value={(data.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)} format={fmtMoney} trend={`${(data.payments || []).length} txns`} color={B.cyan} />
                <KpiCard index={2} icon={CreditCard} label="Pending Finance" value={orders.filter((o: any) => o.status === 'PENDING_FINANCE').length} trend="awaiting payment" color={B.warning} />
                <KpiCard index={3} icon={AlertTriangle} label="Pending Approvals" value={totalPending} trend="company-wide" color="#ef4444" />
              </div>
            )}

            {activeDepartment === 'HR' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <KpiCard index={0} icon={Users} label="Total Staff" value={employeeCount} trend="active" color={B.purple} />
                  <KpiCard index={1} icon={UserCheck} label="Present Today" value={(data.attendance || []).filter((a: any) => a.status === 'PRESENT').length} trend={`of ${employeeCount}`} color={B.success} />
                  <KpiCard index={2} icon={Clock} label="Late Today" value={(data.attendance || []).filter((a: any) => a.status === 'LATE').length} color={B.warning} />
                  <KpiCard index={3} icon={Briefcase} label="Departments" value={new Set((data.staff || []).map((s: any) => s.role)).size} color={B.primary} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
                  {(data.staff || []).slice(0, 4).map((s: any, i: number) => (
                    <ProfileCard key={s.id} index={i} name={s.full_name} sub={s.role} photo={s.photo}
                      stats={[{ label: 'Role', value: s.role }]}
                      actionLabel="View Profile" onAction={() => setActiveSubTab?.('Staff')}
                    />
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                  <BanCard title="Today's Attendance" badge={`${employeeCount > 0 ? Math.round((presentToday / employeeCount) * 100) : 0}%`} badgeColor={B.success} index={0} noPad>
                    <div style={{ padding: '4px 20px' }}>
                      {[
                        { label: 'Present', value: presentToday, icon: Check, color: B.success },
                        { label: 'On Leave', value: onLeaveToday, icon: CalendarDays, color: B.warning },
                        { label: 'Late', value: lateToday, icon: Clock, color: B.cyan },
                      ].map((row, i) => (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? `1px solid ${B.border}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <row.icon size={14} color={row.color} />
                            <span style={{ fontSize: 13, color: B.fg }}>{row.label}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: B.fg }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </BanCard>
                  <BanCard title="Payroll Status" action={<button onClick={() => setActiveSubTab?.('Payroll')} style={{ fontSize: 11, color: B.primary, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>} index={1} noPad>
                    <div style={{ padding: '4px 20px' }}>
                      {[
                        { label: 'Total Payroll', value: fmtMoney(payrollTotal), icon: Banknote, color: B.primary },
                        { label: 'Processed', value: fmtMoney(payrollProcessed), icon: Check, color: B.success },
                        { label: 'Batches', value: String((data.payrollBatches || []).length), icon: ClipboardList, color: B.mutedFg },
                      ].map((row, i) => (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? `1px solid ${B.border}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <row.icon size={14} color={row.color} />
                            <span style={{ fontSize: 13, color: B.fg }}>{row.label}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: B.fg }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </BanCard>
                </div>

                <BanCard title="Pending Leave Requests" badge={pendingLeaves.length} badgeColor={B.warning} index={2}
                  action={<button onClick={() => setActiveSubTab?.('LeaveManagement')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: B.primary, background: `${B.primary}14`, border: `1px solid ${B.primary}40`, borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}><CalendarClock size={12} /> New Request</button>}
                  noPad>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        <th style={thStyle(B)}>Employee</th><th style={thStyle(B)}>Department</th><th style={thStyle(B)}>Leave Type</th>
                        <th style={thStyle(B)}>Dates</th><th style={thStyle(B)}>Days</th><th style={thStyle(B)}>Action</th>
                      </tr></thead>
                      <tbody>
                        {pendingLeaves.length === 0 ? (
                          <tr><td colSpan={6} style={{ ...tdStyle(B), color: B.mutedFg, textAlign: 'center' }}>No pending leave requests.</td></tr>
                        ) : pendingLeaves.map((l: any) => (
                          <tr key={l.id}>
                            <td style={{ ...tdStyle(B), fontWeight: 600, color: B.secondaryFg }}>{l.staff_name}</td>
                            <td style={tdStyle(B)}>{l.department}</td>
                            <td style={tdStyle(B)}><Badge color={B.purple}>{l.leave_type}</Badge></td>
                            <td style={{ ...tdStyle(B), color: B.mutedFg }}>{l.start_date} → {l.end_date}</td>
                            <td style={tdStyle(B)}>{l.days_count}</td>
                            <td style={tdStyle(B)}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => approveLeaveAction(l)} title="Approve" style={{ width: 26, height: 26, borderRadius: B.radiusMd, background: `${B.success}26`, color: B.success, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={13} /></button>
                                <button onClick={() => setActiveSubTab?.('LeaveManagement')} title="Reject (needs a reason)" style={{ width: 26, height: 26, borderRadius: B.radiusMd, background: `${B.danger}26`, color: B.danger, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BanCard>
              </>
            )}

            {activeDepartment === 'OPERATIONS' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <KpiCard index={0} icon={Package} label="Cargo Logged" value={(data.cargo || []).length} color={B.primary} />
                <KpiCard index={1} icon={Clock} label="Pending Approval" value={pendingCargo.length} color={B.warning} />
                <KpiCard index={2} icon={Warehouse} label="Stock Value" value={stockValue} format={fmtMoney} trend={`${(data.stock || []).length} SKUs`} color={B.cyan} />
                <KpiCard index={3} icon={UserCheck} label="Approved Intakes" value={(data.cargo || []).filter((c: any) => c.status === 'APPROVED').length} color={B.success} />
              </div>
            )}

            {activeDepartment === 'PRODUCTION' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <KpiCard index={0} icon={Factory} label="Requests" value={(data.prodReqs || []).length} color={B.purple} />
                <KpiCard index={1} icon={Clock} label="Pending Management" value={pendingProd.length} color={B.warning} />
                <KpiCard index={2} icon={ClipboardList} label="Material Requests" value={(data.matReqs || []).length} trend={`${pendingMatReq.length} pending`} color={B.primary} />
                <KpiCard index={3} icon={UserCheck} label="Tickets Issued" value={(data.prodReqs || []).filter((p: any) => p.status === 'TICKETS_ISSUED').length} color={B.success} />
              </div>
            )}

            {(activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <KpiCard index={0} icon={Truck} label="Active Vehicles" value={activeTrucks} trend={`of ${totalDrivers}`} color={B.primary} />
                  <KpiCard index={1} icon={MapPin} label="In Transit" value={(data.deliveries || []).filter((d: any) => ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(d.status)).length} color={B.warning} />
                  <KpiCard index={2} icon={UserCheck} label="Delivered" value={(data.deliveries || []).filter((d: any) => d.status === 'DELIVERED').length} color={B.success} />
                  <KpiCard index={3} icon={AlertTriangle} label="Failed" value={(data.deliveries || []).filter((d: any) => d.status === 'FAILED').length} color="#ef4444" />
                </div>
                <BanCard title="Live Fleet Tracker" badge={activeTrucks} badgeColor={B.success} index={0}>
                  <div style={{ borderRadius: B.radiusLg, overflow: 'hidden' }}>
                    <DispatchMap deliveries={fleetDeliveries} height={300} compact />
                  </div>
                </BanCard>
              </>
            )}

            {activeDepartment === 'RECEPTION' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <KpiCard index={0} icon={Users} label="Visitors Today" value={(data.visitors || []).filter((v: any) => new Date(v.check_in_time).toDateString() === new Date().toDateString()).length} color={B.primary} />
                <KpiCard index={1} icon={UserCheck} label="Currently On-Site" value={(data.visitors || []).filter((v: any) => !v.check_out_time).length} color={B.success} />
                <KpiCard index={2} icon={Calendar} label="Total Logged" value={(data.visitors || []).length} color={B.purple} />
              </div>
            )}

            {!['CEO', 'MANAGEMENT', 'MARKETING', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCTION', 'DISPATCH', 'LOGISTICS', 'RECEPTION'].includes(activeDepartment) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <KpiCard index={0} icon={DollarSign} label="Total Revenue" value={totalRevenue} format={fmtMoney} color={B.success} />
                <KpiCard index={1} icon={Clock} label="Pending Approvals" value={totalPending} color={B.warning} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={{ marginTop: 22 }}>
        {children}
      </motion.div>
    </div>
    </BananiThemeContext.Provider>
  );
}
