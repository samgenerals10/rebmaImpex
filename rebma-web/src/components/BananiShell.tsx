// rebma-web/src/components/BananiShell.tsx
// "Banani UI 1" — dark neon "Command Center" template (theme id 'banani'),
// modeled on a Banani-generated prototype the business owner supplied
// (https://app.banani.co/prototype/N2Ya3K7lv5YO). Same contract as the other
// shells (FinovaShell, AczoneShell, etc.): renders a themed, real-data
// overview above the department's normal content, which still renders
// unchanged via `children` below it. Boardroom/Settings pass straight
// through since a themed "overview" makes no sense for either.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  DollarSign, ShoppingCart, Package, Clock, Truck, Users, TrendingUp,
  CheckCircle, XCircle, MapPin, Calendar, Briefcase, ArrowUpRight,
  CreditCard, Wallet, AlertTriangle, Boxes, ClipboardList, UserCheck,
  Factory, Warehouse,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import DispatchMap, { type DispatchMapDelivery } from './dispatch/DispatchMap';
import type { CurrentUser } from '../types/erp';

interface BananiShellProps {
  activeDepartment: string;
  currentUser: CurrentUser | null;
  children: React.ReactNode;
  setActiveSubTab?: (tab: string) => void;
}

// ── Palette ──────────────────────────────────────────────────────────────
const BG = '#0a0d14';
const CARD = '#12161f';
const CARD_BORDER = '#1f2530';
const TEXT = '#e7ebf3';
const MUTED = '#7c8797';
const BLUE = '#3b82f6';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const PURPLE = '#8b5cf6';
const CYAN = '#06b6d4';

const fmtMoney = (n: number) => `GHS ${Math.round(n).toLocaleString()}`;
const fmtAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

// ── Motion presets ───────────────────────────────────────────────────────
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.045, duration: 0.32, ease: 'easeOut' } }),
};
const fadeIn: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } };

// ── Primitives ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, index }: { icon: any; label: string; value: string | number; sub?: string; color: string; index: number }) {
  return (
    <motion.div
      custom={index} initial="hidden" animate="show" variants={cardVariants}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 1px ${color}25`, borderRadius: 16, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          <Icon size={18} />
        </div>
        {sub && <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{sub}</span>}
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
      <p style={{ fontSize: 12, color: MUTED, margin: '3px 0 0' }}>{label}</p>
    </motion.div>
  );
}

function SectionCard({ title, badge, badgeColor, action, index = 0, children }: { title: string; badge?: string; badgeColor?: string; action?: React.ReactNode; index?: number; children: React.ReactNode }) {
  return (
    <motion.div
      custom={index} initial="hidden" animate="show" variants={cardVariants}
      style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: 20 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>{title}</h3>
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${badgeColor || BLUE}22`, color: badgeColor || BLUE }}>{badge}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

const PRIORITY_COLOR: Record<string, string> = { HIGH: AMBER, CRITICAL: RED, NORMAL: BLUE };

function ApprovalRow({ title, priority, who, amount, ago, index }: { title: string; priority: string; who: string; amount: number; ago: string; index: number }) {
  const color = PRIORITY_COLOR[priority] || BLUE;
  return (
    <motion.div
      custom={index} initial="hidden" animate="show" variants={cardVariants}
      whileHover={{ x: 2 }}
      style={{ background: '#0e121a', border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{title}</span>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: `${color}22`, color }}>{priority}</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{fmtMoney(amount)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: MUTED }}>
        <span>{who}</span>
        <span>{ago}</span>
      </div>
    </motion.div>
  );
}

function GlowButton({ children, onClick, color = BLUE, variant = 'solid' }: { children: React.ReactNode; onClick?: () => void; color?: string; variant?: 'solid' | 'ghost' }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={variant === 'solid'
        ? { background: color, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
        : { background: 'transparent', color, border: `1px solid ${color}55`, borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
    >
      {children}
    </motion.button>
  );
}

function Avatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return photo ? (
    <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${CARD_BORDER}` }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${BLUE}22`, color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.35 }}>
      {initials || '?'}
    </div>
  );
}

function Stepper({ steps }: { steps: { label: string; time?: string; state: 'done' | 'active' | 'pending' }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {steps.map((s, i) => {
        const color = s.state === 'done' ? GREEN : s.state === 'active' ? BLUE : '#3a4150';
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 92 }}>
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.08 }}
                style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, background: s.state === 'pending' ? 'transparent' : `${color}15` }}
              >
                {s.state === 'done' ? <CheckCircle size={16} /> : s.state === 'active' ? <Clock size={16} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
              </motion.div>
              <span style={{ fontSize: 11, fontWeight: 600, color: s.state === 'pending' ? MUTED : TEXT, marginTop: 8, textAlign: 'center' }}>{s.label}</span>
              <span style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{s.time || (s.state === 'pending' ? 'Awaiting' : '')}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 40, height: 2, background: steps[i + 1].state !== 'pending' || s.state === 'done' ? `${GREEN}88` : '#232a38', marginBottom: 26 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────
export default function BananiShell({ activeDepartment, currentUser, children, setActiveSubTab }: BananiShellProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});
  const isPassthrough = activeDepartment === 'BOARDROOM' || activeDepartment === 'SETTINGS';

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
        ] = await Promise.all([
          supabase.from('orders').select('id, client_name, product_name, total_amount, status, payment_mode, created_at').order('created_at', { ascending: false }).limit(100),
          supabase.from('cargo_intake').select('id, status, quantity, unit_price, created_at').limit(200),
          supabase.from('production_requests').select('id, status, quantity, requested_by, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('general_purchases').select('id, item_name, cost, status, department, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('float_requests').select('id, amount, status, department, requested_by, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('material_requisitions').select('id, status, items, requested_by, created_at').limit(100).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('profiles').select('id, full_name, role, status, photo').eq('status', 'ACTIVE').limit(300),
          supabase.from('drivers').select('id, driver_id, full_name, vehicle_id, status, photo').neq('status', 'OFFLINE').then(r => r, () => ({ data: [] as any[] })),
          supabase.from('delivery_logs').select('id, status, driver_id, customer_name, created_at').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('customers').select('id, name, company_name, location').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('finance_payments').select('amount, payment_mode, created_at').limit(300).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('stock').select('product_name, quantity, unit').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('attendance').select('id, status, date').eq('date', new Date().toISOString().slice(0, 10)).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('goods_prices').select('product_name, unit_price').limit(200).then(r => r, () => ({ data: [] as any[] })),
          supabase.from('visitors').select('id, full_name, purpose, check_in_time, check_out_time').order('check_in_time', { ascending: false }).limit(50).then(r => r, () => ({ data: [] as any[] })),
        ]);
        if (!active) return;
        setData({
          orders: orders || [], cargo: cargo || [], prodReqs: prodReqs || [], genPurch: genPurch || [],
          floatReqs: floatReqs || [], matReqs: matReqs || [], staff: staff || [], drivers: driversRaw || [],
          deliveries: deliveries || [], customers: customers || [], payments: payments || [], stock: stock || [],
          attendance: attendance || [], goodsPrices: goodsPrices || [], visitors: visitors || [],
        });
      } catch (e) {
        console.error('BananiShell data load failed', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeDepartment, isPassthrough]);

  if (isPassthrough) return <>{children}</>;

  // ── Derived, real numbers ──────────────────────────────────────────────
  const orders = data.orders || [];
  const approvedOrders = orders.filter((o: any) => ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status));
  const totalRevenue = approvedOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
  const activeOrdersCount = orders.filter((o: any) => !['DELIVERED', 'REJECTED'].includes(o.status)).length;
  const stockValue = (data.stock || []).reduce((s: number, r: any) => {
    const price = (data.goodsPrices || []).find((g: any) => g.product_name === r.product_name)?.unit_price || 0;
    return s + Number(price) * Number(r.quantity || 0);
  }, 0);

  const pendingCargo = (data.cargo || []).filter((c: any) => c.status === 'PENDING_MANAGEMENT_APPROVAL');
  const pendingOrders = orders.filter((o: any) => o.status === 'PENDING_MANAGEMENT');
  const pendingProd = (data.prodReqs || []).filter((p: any) => p.status === 'PENDING_MANAGEMENT');
  const pendingGenPurch = (data.genPurch || []).filter((g: any) => g.status === 'PENDING_MANAGEMENT_APPROVAL');
  const pendingFloat = (data.floatReqs || []).filter((f: any) => f.status === 'PENDING_MANAGEMENT');
  const pendingMatReq = (data.matReqs || []).filter((m: any) => m.status === 'PENDING_MANAGEMENT');
  const totalPending = pendingCargo.length + pendingOrders.length + pendingProd.length + pendingGenPurch.length + pendingFloat.length + pendingMatReq.length;

  const activeTrucks = (data.drivers || []).filter((d: any) => d.status === 'ACTIVE' || d.status === 'ON_DELIVERY').length;
  const totalDrivers = (data.drivers || []).length;
  const employeeCount = (data.staff || []).length;

  const mixedApprovals = useMemo(() => {
    const rows: { id: string; title: string; who: string; amount: number; ago: string; created: string; priority: string; type: string }[] = [];
    pendingOrders.forEach((o: any) => rows.push({ id: o.id, title: `Sales Order — ${o.client_name}`, who: 'Marketing', amount: Number(o.total_amount || 0), ago: fmtAgo(o.created_at), created: o.created_at, priority: Number(o.total_amount) > 50000 ? 'CRITICAL' : Number(o.total_amount) > 15000 ? 'HIGH' : 'NORMAL', type: 'Order' }));
    pendingCargo.forEach((c: any) => rows.push({ id: c.id, title: 'Cargo Intake Approval', who: 'Operations', amount: Number(c.quantity || 0) * Number(c.unit_price || 0), ago: fmtAgo(c.created_at), created: c.created_at, priority: 'HIGH', type: 'Cargo' }));
    pendingGenPurch.forEach((g: any) => rows.push({ id: g.id, title: g.item_name || 'General Purchase', who: g.department || 'Operations', amount: Number(g.cost || 0), ago: fmtAgo(g.created_at), created: g.created_at, priority: Number(g.cost) > 50000 ? 'CRITICAL' : 'NORMAL', type: 'Purchase' }));
    pendingFloat.forEach((f: any) => rows.push({ id: f.id, title: `Float Replenishment — ${f.department}`, who: f.requested_by || f.department, amount: Number(f.amount || 0), ago: fmtAgo(f.created_at), created: f.created_at, priority: 'NORMAL', type: 'Float' }));
    return rows.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).slice(0, 6);
  }, [data]);

  const kanban = useMemo(() => {
    const cols = [
      { key: 'New', label: 'New', color: BLUE, statuses: ['PENDING_MANAGEMENT'] },
      { key: 'Finance', label: 'Payment Pending', color: AMBER, statuses: ['PENDING_FINANCE'] },
      { key: 'Approved', label: 'Approved', color: GREEN, statuses: ['APPROVED'] },
      { key: 'Processing', label: 'Processing', color: PURPLE, statuses: ['PROCESSING', 'OUT_FOR_DELIVERY'] },
    ];
    return cols.map(c => ({ ...c, items: orders.filter((o: any) => c.statuses.includes(o.status)).slice(0, 4) }));
  }, [orders]);

  const topCustomers = useMemo(() => {
    const byName: Record<string, { name: string; company: string; orders: number; value: number }> = {};
    orders.forEach((o: any) => {
      const key = o.client_name || 'Unknown';
      if (!byName[key]) byName[key] = { name: key, company: (data.customers || []).find((c: any) => c.name === key)?.company_name || '—', orders: 0, value: 0 };
      byName[key].orders += 1;
      byName[key].value += Number(o.total_amount || 0);
    });
    return Object.values(byName).sort((a, b) => b.value - a.value).slice(0, 3);
  }, [orders, data.customers]);

  const fleetDeliveries: DispatchMapDelivery[] = useMemo(() => (data.drivers || []).map((d: any) => ({
    id: d.id, driverId: d.driver_id, driverName: d.full_name, vehicleId: d.vehicle_id,
    driverState: d.status === 'ON_DELIVERY' ? 'ON_THE_WAY' : 'AT_COMPANY',
  })), [data.drivers]);

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

  return (
    <div style={{ background: BG, margin: '-16px -16px 0', padding: 16, borderRadius: 20 }}>
      <motion.div initial="hidden" animate="show" variants={fadeIn} style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: TEXT }}>
              {greeting}, {currentUser?.fullName?.split(' ')[0] || 'there'} 👋
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>{deptSubtitle[activeDepartment] || 'Department overview'}</p>
          </div>
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${GREEN}18`, color: GREEN, border: `1px solid ${GREEN}40`, borderRadius: 99, padding: '5px 12px', fontSize: 11, fontWeight: 700 }}
          >
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
            Live
          </motion.span>
        </div>
      </motion.div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 18 }}>
          {[0, 1, 2, 3].map(i => (
            <motion.div key={i} animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.1 }} style={{ height: 108, borderRadius: 16, background: CARD, border: `1px solid ${CARD_BORDER}` }} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeDepartment} initial="hidden" animate="show" exit={{ opacity: 0 }}>

            {/* ── CEO ─────────────────────────────────────────────── */}
            {activeDepartment === 'CEO' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 18 }}>
                  <StatCard index={0} icon={DollarSign} label="Total Revenue" value={fmtMoney(totalRevenue)} sub={`${approvedOrders.length} approved`} color={GREEN} />
                  <StatCard index={1} icon={ShoppingCart} label="Active Orders" value={activeOrdersCount} sub="in pipeline" color={BLUE} />
                  <StatCard index={2} icon={Boxes} label="Inventory Value" value={fmtMoney(stockValue)} sub={`${(data.stock || []).length} SKUs`} color={CYAN} />
                  <StatCard index={3} icon={Clock} label="Pending Approvals" value={totalPending} sub={totalPending > 0 ? 'needs review' : 'all clear'} color={AMBER} />
                  <StatCard index={4} icon={Truck} label="Active Trucks" value={`${activeTrucks} / ${totalDrivers}`} sub="in depot" color={PURPLE} />
                  <StatCard index={5} icon={Users} label="Employees" value={employeeCount} sub="active" color={RED} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 16 }}>
                  <SectionCard title="Live Fleet Tracker" badge={`${activeTrucks} active vehicles`} badgeColor={GREEN} index={0}>
                    <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${CARD_BORDER}` }}>
                      <DispatchMap deliveries={fleetDeliveries} height={280} compact />
                    </div>
                  </SectionCard>
                  <SectionCard title="Approval Center" badge={`${totalPending} pending`} badgeColor={AMBER} index={1}
                    action={<GlowButton variant="ghost" onClick={() => setActiveSubTab?.('ControlCenter')}>View all →</GlowButton>}>
                    {mixedApprovals.length === 0 ? (
                      <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>All clear — nothing pending.</p>
                    ) : mixedApprovals.map((a, i) => (
                      <ApprovalRow key={a.id} index={i} title={a.title} priority={a.priority} who={a.who} amount={a.amount} ago={a.ago} />
                    ))}
                  </SectionCard>
                </div>
              </>
            )}

            {/* ── MANAGEMENT ──────────────────────────────────────── */}
            {activeDepartment === 'MANAGEMENT' && (
              <>
                <SectionCard
                  title={oldestPendingOrder ? `Approval Workflow — ${oldestPendingOrder.client_name || 'Order'}` : 'Approval Workflow'}
                  badge={oldestPendingOrder ? oldestPendingOrder.status.replace(/_/g, ' ') : 'No pending orders'} badgeColor={AMBER} index={0}
                >
                  <Stepper steps={[
                    { label: 'Submitted', time: oldestPendingOrder ? new Date(oldestPendingOrder.created_at).toLocaleDateString() : undefined, state: 'done' },
                    { label: 'Management Approval', state: oldestPendingOrder?.status === 'PENDING_MANAGEMENT' ? 'active' : 'done' },
                    { label: 'Finance Review', state: oldestPendingOrder?.status === 'PENDING_FINANCE' ? 'active' : oldestPendingOrder?.status === 'PENDING_MANAGEMENT' ? 'pending' : 'done' },
                    { label: 'Dispatch', state: ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(oldestPendingOrder?.status) ? 'done' : 'pending' },
                  ]} />
                </SectionCard>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, margin: '16px 0' }}>
                  {mixedApprovals.slice(0, 3).map((a, i) => (
                    <motion.div key={a.id} custom={i} initial="hidden" animate="show" variants={cardVariants}
                      style={{ background: CARD, border: `1px solid ${(PRIORITY_COLOR[a.priority] || BLUE)}35`, borderRadius: 16, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{a.type}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: `${PRIORITY_COLOR[a.priority]}22`, color: PRIORITY_COLOR[a.priority] }}>{a.priority}</span>
                      </div>
                      <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>{a.who} · {a.ago}</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>{fmtMoney(a.amount)}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <GlowButton variant="ghost" color={RED} onClick={() => setActiveSubTab?.('CreditApproval')}>Review</GlowButton>
                        <GlowButton color={GREEN} onClick={() => setActiveSubTab?.('CreditApproval')}>Open Queue</GlowButton>
                      </div>
                    </motion.div>
                  ))}
                  {mixedApprovals.length === 0 && (
                    <p style={{ color: MUTED, fontSize: 13 }}>Nothing pending right now — you're all caught up.</p>
                  )}
                </div>
                <SectionCard title="Price Setting — Active Products" badge={`${(data.goodsPrices || []).length} products`} index={2}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: MUTED, textAlign: 'left' }}>
                          <th style={{ padding: '6px 8px', fontWeight: 600 }}>Product</th>
                          <th style={{ padding: '6px 8px', fontWeight: 600 }}>Selling Price</th>
                          <th style={{ padding: '6px 8px', fontWeight: 600 }}>In Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.goodsPrices || []).slice(0, 5).map((g: any) => (
                          <tr key={g.product_name} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                            <td style={{ padding: '8px', color: TEXT, fontWeight: 600 }}>{g.product_name}</td>
                            <td style={{ padding: '8px', color: GREEN, fontWeight: 700 }}>{fmtMoney(Number(g.unit_price))}</td>
                            <td style={{ padding: '8px', color: MUTED }}>{(data.stock || []).find((s: any) => s.product_name === g.product_name)?.quantity ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── MARKETING ───────────────────────────────────────── */}
            {activeDepartment === 'MARKETING' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
                  {kanban.map((col, ci) => (
                    <motion.div key={col.key} custom={ci} initial="hidden" animate="show" variants={cardVariants}
                      style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 14, minHeight: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{col.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: col.color, background: `${col.color}1f`, borderRadius: 99, padding: '1px 8px' }}>{orders.filter((o: any) => col.statuses.includes(o.status)).length}</span>
                      </div>
                      {col.items.length === 0 ? (
                        <p style={{ fontSize: 11, color: MUTED }}>Nothing here</p>
                      ) : col.items.map((o: any) => (
                        <div key={o.id} style={{ background: '#0e121a', borderRadius: 10, padding: 10, marginBottom: 8, border: `1px solid ${CARD_BORDER}` }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, margin: '0 0 2px' }}>{o.client_name}</p>
                          <p style={{ fontSize: 10, color: MUTED, margin: '0 0 6px' }}>{o.product_name}</p>
                          <p style={{ fontSize: 13, fontWeight: 800, color: col.color, margin: 0 }}>{fmtMoney(Number(o.total_amount))}</p>
                        </div>
                      ))}
                    </motion.div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  {topCustomers.length === 0 ? (
                    <p style={{ color: MUTED, fontSize: 13 }}>No customer orders recorded yet.</p>
                  ) : topCustomers.map((c, i) => (
                    <motion.div key={c.name} custom={i} initial="hidden" animate="show" variants={cardVariants}
                      style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <Avatar name={c.name} />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{c.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{c.company}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 12 }}>
                        <div><p style={{ margin: 0, color: MUTED, fontSize: 10 }}>ORDERS</p><p style={{ margin: 0, color: TEXT, fontWeight: 700 }}>{c.orders}</p></div>
                        <div style={{ textAlign: 'right' }}><p style={{ margin: 0, color: MUTED, fontSize: 10 }}>TOTAL VALUE</p><p style={{ margin: 0, color: BLUE, fontWeight: 700 }}>{fmtMoney(c.value)}</p></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* ── FINANCE ─────────────────────────────────────────── */}
            {activeDepartment === 'FINANCE' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <StatCard index={0} icon={DollarSign} label="Total Revenue" value={fmtMoney(totalRevenue)} sub={`${approvedOrders.length} orders`} color={GREEN} />
                <StatCard index={1} icon={Wallet} label="Payments Recorded" value={fmtMoney((data.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0))} sub={`${(data.payments || []).length} txns`} color={CYAN} />
                <StatCard index={2} icon={CreditCard} label="Pending Finance" value={orders.filter((o: any) => o.status === 'PENDING_FINANCE').length} sub="awaiting payment" color={AMBER} />
                <StatCard index={3} icon={AlertTriangle} label="Pending Approvals" value={totalPending} sub="company-wide" color={RED} />
              </div>
            )}

            {/* ── HR ──────────────────────────────────────────────── */}
            {activeDepartment === 'HR' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <StatCard index={0} icon={Users} label="Total Staff" value={employeeCount} sub="active" color={PURPLE} />
                  <StatCard index={1} icon={UserCheck} label="Present Today" value={(data.attendance || []).filter((a: any) => a.status === 'PRESENT').length} sub={`of ${employeeCount}`} color={GREEN} />
                  <StatCard index={2} icon={Clock} label="Late Today" value={(data.attendance || []).filter((a: any) => a.status === 'LATE').length} color={AMBER} />
                  <StatCard index={3} icon={Briefcase} label="Departments" value={new Set((data.staff || []).map((s: any) => s.role)).size} color={BLUE} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  {(data.staff || []).slice(0, 4).map((s: any, i: number) => (
                    <motion.div key={s.id} custom={i} initial="hidden" animate="show" variants={cardVariants}
                      style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Avatar name={s.full_name} photo={s.photo} size={48} /></div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>{s.full_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED, textTransform: 'capitalize' }}>{s.role}</p>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* ── OPERATIONS ──────────────────────────────────────── */}
            {activeDepartment === 'OPERATIONS' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <StatCard index={0} icon={Package} label="Cargo Logged" value={(data.cargo || []).length} color={BLUE} />
                <StatCard index={1} icon={Clock} label="Pending Approval" value={pendingCargo.length} color={AMBER} />
                <StatCard index={2} icon={Warehouse} label="Stock Value" value={fmtMoney(stockValue)} sub={`${(data.stock || []).length} SKUs`} color={CYAN} />
                <StatCard index={3} icon={CheckCircle} label="Approved Intakes" value={(data.cargo || []).filter((c: any) => c.status === 'APPROVED').length} color={GREEN} />
              </div>
            )}

            {/* ── PRODUCTION ──────────────────────────────────────── */}
            {activeDepartment === 'PRODUCTION' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <StatCard index={0} icon={Factory} label="Requests" value={(data.prodReqs || []).length} color={PURPLE} />
                <StatCard index={1} icon={Clock} label="Pending Management" value={pendingProd.length} color={AMBER} />
                <StatCard index={2} icon={ClipboardList} label="Material Requests" value={(data.matReqs || []).length} sub={`${pendingMatReq.length} pending`} color={BLUE} />
                <StatCard index={3} icon={CheckCircle} label="Tickets Issued" value={(data.prodReqs || []).filter((p: any) => p.status === 'TICKETS_ISSUED').length} color={GREEN} />
              </div>
            )}

            {/* ── DISPATCH / LOGISTICS ──────────────────────────────── */}
            {(activeDepartment === 'DISPATCH' || activeDepartment === 'LOGISTICS') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <StatCard index={0} icon={Truck} label="Active Vehicles" value={`${activeTrucks} / ${totalDrivers}`} color={BLUE} />
                  <StatCard index={1} icon={MapPin} label="Deliveries In Transit" value={(data.deliveries || []).filter((d: any) => ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(d.status)).length} color={AMBER} />
                  <StatCard index={2} icon={CheckCircle} label="Delivered" value={(data.deliveries || []).filter((d: any) => d.status === 'DELIVERED').length} color={GREEN} />
                  <StatCard index={3} icon={XCircle} label="Failed" value={(data.deliveries || []).filter((d: any) => d.status === 'FAILED').length} color={RED} />
                </div>
                <SectionCard title="Live Fleet Tracker" badge={`${activeTrucks} active`} badgeColor={GREEN} index={0}>
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${CARD_BORDER}` }}>
                    <DispatchMap deliveries={fleetDeliveries} height={300} compact />
                  </div>
                </SectionCard>
              </>
            )}

            {/* ── RECEPTION ───────────────────────────────────────── */}
            {activeDepartment === 'RECEPTION' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <StatCard index={0} icon={Users} label="Visitors Today" value={(data.visitors || []).filter((v: any) => new Date(v.check_in_time).toDateString() === new Date().toDateString()).length} color={BLUE} />
                <StatCard index={1} icon={UserCheck} label="Currently On-Site" value={(data.visitors || []).filter((v: any) => !v.check_out_time).length} color={GREEN} />
                <StatCard index={2} icon={Calendar} label="Total Logged" value={(data.visitors || []).length} color={PURPLE} />
              </div>
            )}

            {/* ── Fallback for anything else ────────────────────────── */}
            {!['CEO', 'MANAGEMENT', 'MARKETING', 'FINANCE', 'HR', 'OPERATIONS', 'PRODUCTION', 'DISPATCH', 'LOGISTICS', 'RECEPTION'].includes(activeDepartment) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <StatCard index={0} icon={TrendingUp} label="Total Revenue" value={fmtMoney(totalRevenue)} color={GREEN} />
                <StatCard index={1} icon={Clock} label="Pending Approvals" value={totalPending} color={AMBER} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} style={{ marginTop: 22 }}>
        {children}
      </motion.div>
    </div>
  );
}
