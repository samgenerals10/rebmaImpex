import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import {
  Truck, UserCheck, MapPin, Camera, History, BarChart2,
  TrendingUp, TrendingDown, RefreshCw, MoreVertical, ChevronRight,
  Plus, AlertCircle, CheckCircle, Clock, Eye
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';
import { exportToCSV } from '../../utils/export';
import { dispatch as dispatchApi } from '../../services/apiClient';
import type { Driver, DeliveryRecord, CurrentUser } from '../../types/erp';
import DispatchMap from '../../components/dispatch/DispatchMap';
import CountUp from '../../components/CountUp';

interface Props {
  addNotification?: (msg: string) => void;
  setActiveSubTab?: (tab: string) => void;
  currentUser?: CurrentUser | null;
}

// ── seed data ─────────────────────────────────────────────────────────────────
// Seed arrays removed — data loaded from Supabase in component

// UPCOMING removed — scheduled deliveries derived from Supabase data in component

// ── helpers ───────────────────────────────────────────────────────────────────
function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
const DAY_MS = 24 * 60 * 60 * 1000;
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function daysAgo(n: number) { return new Date(Date.now() - n * DAY_MS); }
function formatDuration(ms: number | null) {
  if (ms == null) return '—';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING_ASSIGNMENT: { bg: 'bg-gray-100',   color: 'text-gray-600',   label: 'Pending' },
  ASSIGNED:           { bg: 'bg-yellow-100', color: 'text-yellow-700', label: 'Assigned' },
  IN_TRANSIT:         { bg: 'bg-blue-100',   color: 'text-blue-700',   label: 'In Transit' },
  DELIVERED:          { bg: 'bg-green-100',  color: 'text-green-700',  label: 'Delivered' },
  FAILED:             { bg: 'bg-red-100',    color: 'text-red-700',    label: 'Failed' },
};

const DRIVER_STATUS: Record<string, { dot: string; label: string }> = {
  ACTIVE:       { dot: 'bg-green-500', label: 'Available' },
  ON_DELIVERY:  { dot: 'bg-blue-500',  label: 'On Delivery' },
  OFFLINE:      { dot: 'bg-gray-400',  label: 'Offline' },
};

const ChartTt = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill: string }[]; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)] mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ── component ─────────────────────────────────────────────────────────────────
export default function DispatchOverviewView({ addNotification, setActiveSubTab, currentUser }: Props) {
  const firstName = currentUser?.fullName?.split(' ')[0] || 'Dispatch';
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [loadingDrivers, setLoadingDrivers]       = useState(true);
  const [menuOpen, setMenuOpen]     = useState<string | null>(null);
  const [menuOpenUp, setMenuOpenUp] = useState(false);
  const [volPeriod, setVolPeriod]   = useState('This Week');
  const [perfPeriod, setPerfPeriod] = useState('This Week');

  // Assign driver form state
  const [assignDeliveryId, setAssignDeliveryId] = useState('');
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Load from Supabase
  const loadDeliveries = async () => {
    try {
      const { data } = await supabase.from('delivery_logs').select('*').order('created_at', { ascending: false }).limit(50);
      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        orderId: row.order_id || '',
        clientName: row.customer_name || '',
        destination: row.delivery_address || '',
        driverName: row.driver_name || '',
        driverId: row.driver_id || '',
        dispatchedAt: row.created_at || '',
        deliveredAt: row.delivered_at || undefined,
        status: row.status || 'PENDING_ASSIGNMENT',
        vehicleId: row.vehicle_id || undefined,
        proofUrl: row.proof_photo || undefined,
        recipientName: row.recipient_name || undefined,
        deliveryNotes: row.notes || undefined,
      }));
      setDeliveries(mapped);
    } catch {
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const loadDrivers = async () => {
    try {
      const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
      setDrivers((data ?? []).map((db: any) => ({
        id: db.id,
        driverId: db.driver_id || db.id || '',
        fullName: db.full_name || db.fullName || '',
        phone: db.phone || '',
        ghanaCard: db.ghana_card_id || db.ghanaCard || '',
        licenseNumber: db.license_number || db.licenseNumber || '',
        truckId: db.vehicle_id || db.truckId || '',
        status: db.status || 'OFFLINE',
        totalDeliveries: Number(db.total_deliveries || 0),
        joinedAt: db.created_at || db.joinedAt || '',
      } as Driver)));
    } catch {
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
    loadDrivers();
  }, []);

  useRealtimeChannel('dispatch-overview-realtime', ['delivery_logs', 'drivers'], (table) => {
    if (table === 'delivery_logs') loadDeliveries();
    else loadDrivers();
  });

  const handleRefresh = () => {
    loadDeliveries();
    loadDrivers();
    addNotification?.('Dashboard refreshed');
  };

  // KPI counts
  const todayStr = new Date().toDateString();
  const todayDeliveries  = deliveries.filter(d => new Date(d.dispatchedAt).toDateString() === todayStr).length;
  const inTransit        = deliveries.filter(d => d.status === 'IN_TRANSIT').length;
  const deliveredToday   = deliveries.filter(d => d.status === 'DELIVERED' && d.deliveredAt && new Date(d.deliveredAt).toDateString() === todayStr).length;
  const pendingAssign    = deliveries.filter(d => d.status === 'PENDING_ASSIGNMENT').length;

  const activeDeliveries = deliveries.filter(d => ['ASSIGNED', 'IN_TRANSIT'].includes(d.status)).slice(0, 6);
  const availableDrivers = drivers.filter(d => d.status === 'ACTIVE');
  const upcoming = deliveries.filter(d => ['PENDING_ASSIGNMENT', 'ASSIGNED'].includes(d.status)).slice(0, 4);
  const pendingDeliveries = deliveries.filter(d => d.status === 'PENDING_ASSIGNMENT');

  // ── Delivery Performance card — computed from delivery_logs, not mocked.
  // "On-time" isn't a concept the schema tracks (no SLA/expected-time field),
  // so this measures success rate (delivered vs failed among ones that have
  // actually resolved) rather than inventing a fake on-time threshold.
  const perfWindowDays = perfPeriod === 'Today' ? 1 : perfPeriod === 'This Week' ? 7 : 30;
  const perfWindowStart = startOfDay(daysAgo(perfWindowDays - 1));
  const perfPrevStart = startOfDay(daysAgo(perfWindowDays * 2 - 1));
  const perfPrevEnd = perfWindowStart;
  const inPerfWindow = deliveries.filter(d => new Date(d.dispatchedAt) >= perfWindowStart);
  const inPerfPrevWindow = deliveries.filter(d => {
    const t = new Date(d.dispatchedAt);
    return t >= perfPrevStart && t < perfPrevEnd;
  });
  const successStats = (list: DeliveryRecord[]) => {
    const delivered = list.filter(d => d.status === 'DELIVERED').length;
    const failed = list.filter(d => d.status === 'FAILED').length;
    const finished = delivered + failed;
    return { delivered, failed, finished, rate: finished ? (delivered / finished) * 100 : null };
  };
  const perfNow = successStats(inPerfWindow);
  const perfPrev = successStats(inPerfPrevWindow);
  const successTrend = (perfNow.rate !== null && perfPrev.rate !== null) ? perfNow.rate - perfPrev.rate : null;
  const inProgressCount = inPerfWindow.length - perfNow.delivered - perfNow.failed;
  const deliveredPct = inPerfWindow.length ? Math.round((perfNow.delivered / inPerfWindow.length) * 100) : 0;
  const inProgressPct = inPerfWindow.length ? Math.round((inProgressCount / inPerfWindow.length) * 100) : 0;
  const failedPct = inPerfWindow.length ? Math.max(0, 100 - deliveredPct - inProgressPct) : 0;
  const deliveredWithTimes = inPerfWindow.filter(d => d.status === 'DELIVERED' && d.deliveredAt);
  const avgDeliveryMs = deliveredWithTimes.length
    ? deliveredWithTimes.reduce((sum, d) => sum + (new Date(d.deliveredAt!).getTime() - new Date(d.dispatchedAt).getTime()), 0) / deliveredWithTimes.length
    : null;
  const perfTrendLabel = perfPeriod === 'Today' ? 'vs yesterday' : perfPeriod === 'This Week' ? 'vs last week' : 'vs last month';

  // ── Deliveries Movement / Delivery Volume charts — buckets computed from
  // delivery_logs, not mocked. Both cards share the same `volPeriod` control.
  const buildVolumeBuckets = (period: string): { day: string; assigned: number; completed: number }[] => {
    if (period === 'This Month') {
      return Array.from({ length: 4 }).map((_, i) => {
        const weeksBack = 3 - i;
        const start = startOfDay(daysAgo(weeksBack * 7 + 6));
        const end = new Date(startOfDay(daysAgo(weeksBack * 7)).getTime() + DAY_MS);
        const assigned = deliveries.filter(d => { const t = new Date(d.dispatchedAt); return t >= start && t < end; }).length;
        const completed = deliveries.filter(d => d.deliveredAt && new Date(d.deliveredAt) >= start && new Date(d.deliveredAt) < end).length;
        return { day: `Wk ${i + 1}`, assigned, completed };
      });
    }
    if (period === 'This Quarter') {
      const now = new Date();
      return Array.from({ length: 3 }).map((_, i) => {
        const monthsBack = 2 - i;
        const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
        const assigned = deliveries.filter(d => { const t = new Date(d.dispatchedAt); return t >= start && t < end; }).length;
        const completed = deliveries.filter(d => d.deliveredAt && new Date(d.deliveredAt) >= start && new Date(d.deliveredAt) < end).length;
        return { day: start.toLocaleDateString('en-GB', { month: 'short' }), assigned, completed };
      });
    }
    // This Week — last 7 days ending today
    return Array.from({ length: 7 }).map((_, i) => {
      const dayStart = startOfDay(daysAgo(6 - i));
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const assigned = deliveries.filter(d => { const t = new Date(d.dispatchedAt); return t >= dayStart && t < dayEnd; }).length;
      const completed = deliveries.filter(d => d.deliveredAt && new Date(d.deliveredAt) >= dayStart && new Date(d.deliveredAt) < dayEnd).length;
      return { day: dayStart.toLocaleDateString('en-GB', { weekday: 'short' }), assigned, completed };
    });
  };
  // delivery_logs is loaded capped at 50 rows (see loadDeliveries above) — fine
  // for the current data volume, but Month/Quarter buckets will silently under-
  // count once the account has more than 50 recent deliveries. Flagging rather
  // than solving here since a real fix means paginating loadDeliveries itself.
  const volumeData = buildVolumeBuckets(volPeriod);
  const totalAssigned = volumeData.reduce((s, b) => s + b.assigned, 0);
  const totalCompleted = volumeData.reduce((s, b) => s + b.completed, 0);
  const volPeriodDays = volPeriod === 'This Week' ? 7 : volPeriod === 'This Month' ? 30 : 90;
  const volPrevStart = startOfDay(daysAgo(volPeriodDays * 2 - 1));
  const volPrevEnd = startOfDay(daysAgo(volPeriodDays - 1));
  const prevAssigned = deliveries.filter(d => { const t = new Date(d.dispatchedAt); return t >= volPrevStart && t < volPrevEnd; }).length;
  const prevCompleted = deliveries.filter(d => d.deliveredAt && new Date(d.deliveredAt) >= volPrevStart && new Date(d.deliveredAt) < volPrevEnd).length;
  const assignedDelta = totalAssigned - prevAssigned;
  const completedDelta = totalCompleted - prevCompleted;
  const volTrendLabel = volPeriod === 'This Week' ? 'vs last week' : volPeriod === 'This Month' ? 'vs last month' : 'vs last quarter';

  // Assign driver handler — updates a delivery Operations already created
  // (status PENDING_ASSIGNMENT) rather than inserting a brand new one from a
  // typed order ID. Dispatch picking any Finance-approved order directly,
  // with no validation, was the same bypass the "New Delivery" flow in
  // DeliveriesView.tsx had — Operations clicking Dispatch/Fulfillment is
  // meant to be the only thing that creates a delivery job.
  const handleAssign = async () => {
    if (!assignDeliveryId || !assignDriverId) { addNotification?.('Please fill in all fields.'); return; }
    setAssigning(true);
    const driver = drivers.find(d => d.id === assignDriverId);
    const delivery = deliveries.find(d => d.id === assignDeliveryId);
    if (!driver || !delivery) { addNotification?.('Selection no longer valid — please try again.'); setAssigning(false); return; }
    const now = new Date().toISOString();
    try {
      const { pending } = await dispatchApi.assignDriverToDelivery(assignDeliveryId, driver.id, driver.fullName, driver.truckId || null);
      if (pending) {
        addNotification?.(`Assignment of ${driver.fullName} to ${delivery.orderId} sent to Management for approval.`);
        setAssignDeliveryId(''); setAssignDriverId('');
        setAssigning(false);
        return;
      }

      setDeliveries(prev => prev.map(d => d.id === assignDeliveryId
        ? { ...d, driverName: driver.fullName, driverId: driver.id, vehicleId: driver.truckId, status: 'ASSIGNED' }
        : d));

      await supabase.from('supplier_order_notifications').insert({
        message: `Driver ${driver.fullName} assigned to ${delivery.orderId}`,
        notified_department: 'OPERATIONS', read: false, created_at: now,
      });
      await supabase.from('global_audit_history').insert({
        department: 'DISPATCH', action: `Driver ${driver.fullName} assigned to ${delivery.orderId}`,
        performed_by: currentUser?.fullName || 'Dispatch', timestamp: now,
      });
      addNotification?.(`Driver ${driver.fullName} assigned to ${delivery.orderId}`);
      try {
        await dispatchApi.sendWhatsAppDirections(driver.id);
        addNotification?.(`WhatsApp opened with the trip link for ${driver.fullName} — tap Send to deliver it.`);
      } catch (e: any) {
        addNotification?.(`Assigned, but couldn't open WhatsApp: ${e.message}`);
      }
    } catch (err: any) {
      addNotification?.(`Failed to assign driver: ${err.message}`);
    } finally {
      setAssignDeliveryId(''); setAssignDriverId('');
      setAssigning(false);
    }
  };

  // Mark delivered quick action
  const handleMarkDelivered = async (id: string) => {
    if (assigning) return;
    const now = new Date().toISOString();
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'DELIVERED', deliveredAt: now } : d));
    try {
      await supabase.from('delivery_logs').update({ status: 'DELIVERED', delivered_at: now }).eq('id', id);
      addNotification?.(`Delivery ${id} marked as delivered.`);
    } catch (err: any) {
      addNotification?.(`Failed to mark delivered: ${err.message}`);
    } finally {
      setMenuOpen(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto" onClick={() => setMenuOpen(null)}>

      {/* ── Greeting ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{timeGreeting()}, {firstName} 👋</h1>
          <p className="text-sm text-[var(--text-secondary)]">Here's your delivery overview today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { label: 'New Delivery',     tab: 'ActiveDeliveries', icon: Truck },
          { label: 'Assign Driver',    tab: 'ActiveDeliveries', icon: UserCheck },
          { label: 'GPS Tracking',     tab: 'Tracking',         icon: MapPin },
          { label: 'Proof of Delivery',tab: 'ProofOfDelivery',  icon: Camera },
          { label: 'Delivery History', tab: 'DispatchHistory',  icon: History },
          { label: 'Analytics',        tab: 'DispatchAnalytics',icon: BarChart2 },
        ].map(({ label, tab, icon: Icon }) => (
          <button key={label} onClick={() => setActiveSubTab?.(tab)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Deliveries Today',    value: todayDeliveries, change: '+3', up: true,  sub: 'vs yesterday', color: 'var(--accent)',  tab: 'ActiveDeliveries' },
          { label: 'In Transit',          value: inTransit,       change: 'live', up: true, sub: 'tracking active', color: '#3b82f6', tab: 'Tracking' },
          { label: 'Delivered Today',     value: deliveredToday,  change: '+2', up: true,  sub: 'completed',      color: '#10b981', tab: 'ActiveDeliveries' },
          { label: 'Pending Assignment',  value: pendingAssign,   change: pendingAssign > 3 ? '! urgent' : 'normal', up: pendingAssign <= 3, sub: 'need driver', color: pendingAssign > 3 ? '#ef4444' : '#f59e0b', tab: 'ActiveDeliveries' },
        ].map(({ label, value, change, up, sub, color, tab }, i) => (
          <div key={i} onClick={() => setActiveSubTab?.(tab)}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer hover:border-[var(--accent)] transition-colors">
            <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-wide font-bold">{label}</p>
            <p className="text-3xl font-bold" style={{ color }}><CountUp value={value} /></p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>{change}</span>
              <span className="text-xs text-[var(--text-secondary)]">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROW 2: Active Deliveries + Quick Driver Assignment ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Active Deliveries Job Board */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Active Deliveries</h3>
            <button onClick={() => setActiveSubTab?.('ActiveDeliveries')}
              className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {loadingDeliveries && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            ))}
            {!loadingDeliveries && activeDeliveries.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
                <Truck size={28} className="opacity-30" />
                <p className="text-sm">No active deliveries</p>
              </div>
            )}
            {!loadingDeliveries && activeDeliveries.map(del => {
              const badge = STATUS_BADGE[del.status];
              return (
                <div key={del.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl group hover:bg-[var(--border)] transition-colors cursor-pointer"
                  onClick={e => { e.stopPropagation(); setActiveSubTab?.('ActiveDeliveries'); }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>
                    {initials(del.driverName || del.clientName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{del.driverName || 'Unassigned'}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{del.clientName} · {del.orderId}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{del.destination}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge?.bg} ${badge?.color}`}>{badge?.label}</span>
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button onClick={e => {
                        if (menuOpen === del.id) { setMenuOpen(null); return; }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const estimatedMenuHeight = 170;
                        const spaceBelow = window.innerHeight - rect.bottom;
                        setMenuOpenUp(spaceBelow < estimatedMenuHeight && rect.top > spaceBelow);
                        setMenuOpen(del.id);
                      }}
                        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-card)] transition-all">
                        <MoreVertical size={13} className="text-[var(--text-muted)]" />
                      </button>
                      {menuOpen === del.id && (
                        <div className={`absolute right-0 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[160px] ${menuOpenUp ? 'bottom-6' : 'top-6'}`}>
                          <button onClick={() => { setActiveSubTab?.('ActiveDeliveries'); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Eye size={11} /> View Details</button>
                          <button onClick={() => { setActiveSubTab?.('Tracking'); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><MapPin size={11} /> Track on Map</button>
                          {del.status === 'IN_TRANSIT' && (
                            <button onClick={() => handleMarkDelivered(del.id)} className="w-full text-left px-3 py-2 text-xs text-green-600 hover:bg-[var(--bg-input)] flex items-center gap-2"><CheckCircle size={11} /> Mark Delivered</button>
                          )}
                          <button onClick={() => { setActiveSubTab?.('ProofOfDelivery'); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Camera size={11} /> Proof of Delivery</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Driver Assignment */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Assign Driver</h3>
            <button onClick={() => setActiveSubTab?.('Drivers')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              See All Drivers <ChevronRight size={12} />
            </button>
          </div>
          {/* Driver avatar row */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {drivers.map(d => {
              const ds = DRIVER_STATUS[d.status];
              return (
                <div key={d.id} onClick={() => setAssignDriverId(d.id)}
                  className={`flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 transition-all ${assignDriverId === d.id ? 'scale-105' : ''}`}>
                  <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 transition-all ${assignDriverId === d.id ? 'border-[var(--accent)]' : 'border-transparent'}`} style={{ background: d.status === 'ACTIVE' ? '#10b981' : d.status === 'ON_DELIVERY' ? '#3b82f6' : '#94a3b8' }}>
                    {initials(d.fullName)}
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--bg-card)] ${ds.dot}`} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-medium text-center whitespace-nowrap max-w-[60px] truncate">{d.fullName.split(' ')[0]}</p>
                  <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">{d.truckId}</p>
                </div>
              );
            })}
            <button onClick={() => setActiveSubTab?.('Drivers')}
              className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-[var(--text-muted)]">
              <Plus size={16} />
            </button>
          </div>
          {/* Driver status legend */}
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-4">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />On Delivery</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" />Offline</span>
          </div>
          {/* Assignment form */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Delivery Awaiting Driver</label>
              <SearchableDropdown
                value={assignDeliveryId}
                onChange={setAssignDeliveryId}
                placeholder={pendingDeliveries.length === 0 ? 'No deliveries awaiting a driver' : 'Choose a delivery...'}
                options={pendingDeliveries.map(d => ({ value: d.id, label: `${d.orderId}, ${d.clientName || 'Unnamed client'}` }))}
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">Only deliveries Operations has already sent over show up here.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Select Driver</label>
              <SearchableDropdown
                value={assignDriverId}
                onChange={setAssignDriverId}
                placeholder="Choose a driver..."
                options={availableDrivers.map(d => ({ value: d.id, label: `${d.fullName}, ${d.truckId}` }))}
              />
            </div>
            <button onClick={handleAssign} disabled={assigning || !assignDeliveryId || !assignDriverId}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90" style={{ background: 'var(--accent)' }}>
              {assigning ? 'Assigning...' : 'Assign Driver'}
            </button>
          </div>
          {/* Recent assignments */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Recent Assignments</p>
            {deliveries.filter(d => d.status === 'ASSIGNED').slice(0, 3).map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--text-secondary)]">{d.orderId}</span>
                <span className="font-medium text-[var(--text-primary)]">{d.driverName || 'Unassigned'}</span>
                <span className="text-[var(--text-muted)]">{timeAgo(d.dispatchedAt)}</span>
              </div>
            ))}
            {deliveries.filter(d => d.status === 'ASSIGNED').length === 0 && (
              <p className="text-xs text-[var(--text-muted)] py-2">No recent assignments</p>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 3: GPS Fleet Map + Delivery Performance ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* GPS Fleet Map */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Live Fleet Tracking</h3>
            <button onClick={() => setActiveSubTab?.('Tracking')}
              className="text-xs font-medium hover:underline px-3 py-1.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-input)] text-[var(--text-secondary)]">
              Full Screen
            </button>
          </div>
          <DispatchMap
            deliveries={activeDeliveries.map(d => ({ id: d.id, driverId: d.driverId, driverName: d.driverName, vehicleId: d.vehicleId, status: d.status }))}
            height={256}
            compact
          />
          <div className="mt-2 text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5">
            <span className="font-bold" style={{ color: 'var(--accent)' }}>🚛 {inTransit} trucks in transit</span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-blue-500" />In Transit</span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-yellow-500" />Assigned</span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-green-500" />Delivered</span>
          </div>
        </div>

        {/* Delivery Performance */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Delivery Performance</h3>
            <SearchableDropdown value={perfPeriod} onChange={setPerfPeriod} options={['Today', 'This Week', 'This Month'].map(p => ({ value: p, label: p }))} className="w-32" />
          </div>
          {/* Success Rate */}
          <div className="flex items-end gap-3 mb-5">
            <p className="text-4xl font-bold text-[var(--text-primary)]">
              {perfNow.rate !== null ? <><CountUp value={perfNow.rate} decimals={1} /><span className="text-xl">%</span></> : <span className="text-2xl text-[var(--text-muted)]">—</span>}
            </p>
            <div className="pb-1">
              {successTrend !== null ? (
                <div className={`flex items-center gap-1 text-xs ${successTrend >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {successTrend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {successTrend >= 0 ? '+' : ''}{successTrend.toFixed(1)}% {perfTrendLabel}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">no prior data to compare</p>
              )}
              <p className="text-xs text-[var(--text-muted)]">success rate (delivered vs failed)</p>
            </div>
          </div>
          {/* Performance bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
              <span>Status Breakdown</span>
              <span className="text-[var(--text-secondary)]">{perfPeriod}</span>
            </div>
            {inPerfWindow.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-2">No deliveries dispatched in this period yet.</p>
            ) : (
              <>
                <div className="h-4 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${deliveredPct}%` }} title="Delivered" />
                  <div className="bg-yellow-400 h-full" style={{ width: `${inProgressPct}%` }} title="In Progress" />
                  <div className="bg-red-400 h-full" style={{ width: `${failedPct}%` }} title="Failed" />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-green-500" />Delivered ({deliveredPct}%)</span>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-yellow-400" />In Progress ({inProgressPct}%)</span>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-2 h-2 rounded-full bg-red-400" />Failed ({failedPct}%)</span>
                </div>
              </>
            )}
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Avg Delivery Time', value: formatDuration(avgDeliveryMs), numeric: null, suffix: '', icon: Clock },
              { label: 'Failed',            value: null, numeric: perfNow.failed, suffix: '', icon: AlertCircle },
              { label: 'Active Drivers',    value: `${availableDrivers.length} / ${drivers.length}`, numeric: null, suffix: '', icon: UserCheck },
              { label: 'Completed Today',   value: null, numeric: deliveredToday, suffix: '', icon: CheckCircle },
            ].map(({ label, value, numeric, suffix, icon: Icon }) => (
              <div key={label} className="p-3 bg-[var(--bg-input)] rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={12} style={{ color: 'var(--accent)' }} />
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                </div>
                <p className="text-base font-bold text-[var(--text-primary)]">{numeric !== null ? <CountUp value={numeric} suffix={suffix} /> : value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 4: Deliveries Movement + Upcoming Deliveries ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Deliveries Movement */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Deliveries Movement</h3>
            <SearchableDropdown value={volPeriod} onChange={setVolPeriod} options={['This Week', 'This Month', 'This Quarter'].map(p => ({ value: p, label: p }))} className="w-36" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Deliveries Dispatched</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]"><CountUp value={totalAssigned} /></p>
              <div className={`flex items-center gap-1 mt-0.5 ${assignedDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                {assignedDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span className="text-xs">{assignedDelta >= 0 ? '+' : ''}{assignedDelta} {volTrendLabel}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Deliveries Completed</p>
              <p className="text-3xl font-bold text-[var(--text-primary)]"><CountUp value={totalCompleted} /></p>
              <div className={`flex items-center gap-1 mt-0.5 ${completedDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                {completedDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span className="text-xs">{completedDelta >= 0 ? '+' : ''}{completedDelta} {volTrendLabel}</span>
              </div>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTt />} />
                <Bar dataKey="assigned" name="Assigned" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.7} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Deliveries */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Scheduled Deliveries</h3>
            <button onClick={() => setActiveSubTab?.('ActiveDeliveries')} className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          {loadingDeliveries ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
              <AlertCircle size={28} className="opacity-30 mb-2" />
              <p className="text-sm">No scheduled deliveries</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 bg-[var(--bg-input)] rounded-xl group hover:bg-[var(--border)] transition-colors cursor-pointer"
                  onClick={() => setActiveSubTab?.('ActiveDeliveries')}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: !u.driverName ? '#ef4444' : 'var(--accent)' }}>
                    <Truck size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{u.clientName}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{u.destination}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${!u.driverName ? 'text-red-500 font-medium' : 'text-[var(--text-muted)]'}`}>{u.driverName || 'Unassigned'}</span>
                      <span className="text-xs text-[var(--text-muted)]">·</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">{u.orderId}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 5: Full-Width Delivery Volume Chart ───────────────────────────── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Delivery Volume</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">Assigned vs completed deliveries — {volPeriod.toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <SearchableDropdown value={volPeriod} onChange={setVolPeriod} options={['This Week', 'This Month', 'This Quarter'].map(p => ({ value: p, label: p }))} className="w-36" />
            <button
              onClick={() => exportToCSV(volumeData, ['day', 'assigned', 'completed'], 'delivery_volume')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors">
              <BarChart2 size={12} /> Export
            </button>
          </div>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} barGap={4}>
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTt />} cursor={{ fill: 'var(--accent-light)' }} />
              <Bar dataKey="assigned" name="Assigned" fill="var(--accent)" radius={[5, 5, 0, 0]} opacity={0.8} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--accent)', opacity: 0.8 }} />Assigned</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><span className="w-3 h-3 rounded-sm bg-green-500" />Completed</span>
        </div>
      </div>

    </div>
  );
}
