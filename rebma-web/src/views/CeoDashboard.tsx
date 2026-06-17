// rebma-web/src/views/CeoDashboard.tsx

import { useState, useEffect } from 'react';
import { Layers, DollarSign, Truck, Users, FileSpreadsheet, FileText, MoreVertical, TrendingUp, TrendingDown, ShoppingBag, Clock, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import MiniSparkline from '../components/MiniSparkline';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { motion } from 'framer-motion';
import { exportToCSV, exportToPDF } from '../utils/export';

interface SupplierOrderSummary {
  id: string;
  order_number: string;
  supplier_name: string;
  supplier_country: string;
  total_amount: number;
  currency: string;
  total_amount_ghs: number;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending:            { color: '#b45309', bg: '#fef3c7' },
  payment_authorised: { color: '#1d4ed8', bg: '#dbeafe' },
  shipped:            { color: '#7c3aed', bg: '#ede9fe' },
  arrived:            { color: '#c2410c', bg: '#fff7ed' },
  received:           { color: '#15803d', bg: '#dcfce7' },
  completed:          { color: '#166534', bg: '#bbf7d0' },
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', payment_authorised: 'Authorised', shipped: 'Shipped',
  arrived: 'Arrived', received: 'Received', completed: 'Completed',
};

interface CeoDashboardProps {
  activeCoordinates: { lat: number; lng: number };
  deliveryStatus: string;
  gpsInterval: number;
  onNavigateToSupplierOrders?: () => void;
  setActiveSubTab?: (tab: string) => void;
}

const COUNTRY_FLAGS: Record<string, string> = { Poland: '🇵🇱', Turkey: '🇹🇷', Germany: '🇩🇪', UK: '🇬🇧', USA: '🇺🇸', Other: '🌍' };


export default function CeoDashboard({
  activeCoordinates,
  deliveryStatus,
  gpsInterval,
  onNavigateToSupplierOrders,
  setActiveSubTab,
}: CeoDashboardProps) {
  const [recentOrders, setRecentOrders] = useState<SupplierOrderSummary[]>([]);
  const [pendingOrders, setPendingOrders] = useState<SupplierOrderSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);

  // Live KPI state
  const [kpiIngestion, setKpiIngestion] = useState<number | null>(null);
  const [kpiInvoices, setKpiInvoices] = useState<number | null>(null);
  const [kpiFleet, setKpiFleet] = useState<number | null>(null);
  const [kpiStaff, setKpiStaff] = useState<number | null>(null);
  const [activeDriverName, setActiveDriverName] = useState<string | null>(null);
  const [lineChartData, setLineChartData] = useState<{ name: string; Inflow: number; Orders: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('supplier_orders')
          .select('id,order_number,supplier_name,supplier_country,total_amount,currency,total_amount_ghs,status,created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentOrders(data ?? []);
      } catch {
        setRecentOrders([]);
      } finally {
        setLoadingRecent(false);
      }
    };
    const loadPending = async () => {
      try {
        const { data } = await supabase
          .from('supplier_orders')
          .select('id,order_number,supplier_name,supplier_country,total_amount,currency,total_amount_ghs,status,created_at')
          .eq('payment_authorised', false)
          .order('created_at', { ascending: false });
        setPendingOrders(data ?? []);
      } catch {
        setPendingOrders([]);
      } finally {
        setLoadingPending(false);
      }
    };
    const loadKPIs = async () => {
      try {
        // Cargo ingestion total quantity
        const { data: cargo } = await supabase.from('cargo_intake').select('qty_received');
        const totalTons = (cargo as { qty_received: number }[] ?? []).reduce((s, r) => s + (r.qty_received || 0), 0);
        setKpiIngestion(totalTons);

        // Processing invoices — orders awaiting finance
        const { count: invoiceCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'finance_approved');
        setKpiInvoices(invoiceCount ?? 0);

        // Active fleet
        const { count: fleetCount } = await supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ACTIVE');
        setKpiFleet(fleetCount ?? 0);

        // Total staff
        const { count: staffCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ACTIVE');
        setKpiStaff(staffCount ?? 0);

        // Active driver name for GPS overlay
        const { data: drivers } = await supabase
          .from('drivers')
          .select('name, vehicle_id')
          .eq('status', 'ACTIVE')
          .not('vehicle_id', 'is', null)
          .limit(1);
        if (drivers && drivers.length > 0) {
          setActiveDriverName((drivers[0] as { name: string }).name || null);
        }

        // Weekly inflow chart from finance_payments
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const { data: payments } = await supabase
          .from('finance_payments')
          .select('amount, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        const { data: weekOrders } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        const inflowByDay: Record<string, number> = {};
        const ordersByDay: Record<string, number> = {};
        for (const p of (payments as { amount: number; created_at: string }[] ?? [])) {
          const d = days[new Date(p.created_at).getDay()];
          inflowByDay[d] = (inflowByDay[d] || 0) + (p.amount || 0);
        }
        for (const o of (weekOrders as { total_amount: number; created_at: string }[] ?? [])) {
          const d = days[new Date(o.created_at).getDay()];
          ordersByDay[d] = (ordersByDay[d] || 0) + (o.total_amount || 0);
        }
        const last5Days = Array.from({ length: 5 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (4 - i));
          const name = days[d.getDay()];
          return { name, Inflow: inflowByDay[name] || 0, Orders: ordersByDay[name] || 0 };
        });
        setLineChartData(last5Days);
      } catch {
        // leave KPIs null — UI will show 0
      }
    };
    load();
    loadPending();
    loadKPIs();
  }, []);

  const handleExportCSV = () => {
    const data = [
      { Metric: 'Global Ingestion Flow', Value: kpiIngestion !== null ? `${kpiIngestion.toLocaleString()} Tons` : '—', Details: 'Accra Port Operations' },
      { Metric: 'Processing Invoices', Value: kpiInvoices !== null ? `${kpiInvoices} Invoices` : '—', Details: 'Awaiting finance clearance' },
      { Metric: 'Active Logistics Vehicles', Value: kpiFleet !== null ? `${kpiFleet} Trucks` : '—', Details: `GPS Location: ${activeCoordinates.lat.toFixed(4)}, ${activeCoordinates.lng.toFixed(4)}` },
      { Metric: 'Total Registered Staff', Value: kpiStaff !== null ? `${kpiStaff} Active` : '—', Details: 'HR approval pending queue' }
    ];
    exportToCSV(data, ['Metric', 'Value', 'Details'], 'ceo_executive_summary');
  };

  const handleExportPDF = () => {
    const data = [
      { Metric: 'Global Ingestion Flow', Value: kpiIngestion !== null ? `${kpiIngestion.toLocaleString()} Tons` : '—', Details: 'Accra Port Operations' },
      { Metric: 'Processing Invoices', Value: kpiInvoices !== null ? `${kpiInvoices} Invoices` : '—', Details: 'Awaiting finance clearance' },
      { Metric: 'Active Logistics Vehicles', Value: kpiFleet !== null ? `${kpiFleet} Trucks` : '—', Details: `GPS Location: ${activeCoordinates.lat.toFixed(4)}, ${activeCoordinates.lng.toFixed(4)}` },
      { Metric: 'Total Registered Staff', Value: kpiStaff !== null ? `${kpiStaff} Active` : '—', Details: 'HR approval pending queue' }
    ];
    exportToPDF('CEO Executive Summary', data, ['Metric', 'Value', 'Details']);
  };

  const smallStats = [
    { title: 'Logistics', value: kpiFleet !== null ? `${kpiFleet} Truck${kpiFleet !== 1 ? 's' : ''}` : '—', sub: 'GPS Live', icon: Truck, color: '#6366f1', bg: '#eef2ff', tab: 'Fleet' },
    { title: 'Staff Force', value: kpiStaff !== null ? `${kpiStaff} Active` : '—', sub: 'From HR', icon: Users, color: '#f59e0b', bg: '#fef3c7', tab: 'Staff' },
  ];

  return (
    <>
      {/* ══════════════ MOBILE LAYOUT (< lg) ══════════════ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">CEO Command</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Global operations overview</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export CSV">
              <FileSpreadsheet className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={handleExportPDF} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card" title="Export PDF">
              <FileText className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Physical card — Global Ingestion Flow */}
        <div className="mobile-physical-card">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Global Ingestion Flow</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{kpiIngestion !== null ? `${kpiIngestion.toLocaleString()} Tons` : '—'}</h2>
              <p className="text-[10px] text-white/70 mt-1">Total cargo intake</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 4890</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Accra Port Operations</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Physical card 2 — Invoices */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Processing Invoices</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{kpiInvoices !== null ? `${kpiInvoices} Invoice${kpiInvoices !== 1 ? 's' : ''}` : '—'}</h2>
              <p className="text-[10px] text-white/70 mt-1">Awaiting finance clearance</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 1024</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Finance Clearance Queue</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Small stat cards row */}
        <div className="grid grid-cols-2 gap-3">
          {smallStats.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={i} className="mobile-stat-card text-left cursor-pointer" onClick={() => setActiveSubTab?.(s.tab)}>
                <div className="mobile-stat-icon" style={{ background: s.bg }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider truncate">{s.title}</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.value}</p>
                  <p className="text-[9px] text-text-muted truncate">{s.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Mini Chart card */}
        <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-text-primary">Inflow vs Orders</h3>
              <p className="text-[10px] text-text-muted">Weekly transactional volumes</p>
            </div>
            <svg width="60" height="26" viewBox="0 0 60 26" fill="none" className="opacity-60">
              <path d="M2 22 Q15 8 30 14 Q45 20 58 4" stroke="#068d5c" strokeWidth="2.5" strokeLinecap="round" fill="none" className="mobile-wave-path" />
            </svg>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Inflow" stroke="#068d5c" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Orders" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet GPS mini card */}
        <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4">
          <h3 className="text-xs font-bold text-text-primary mb-2">Live Fleet Tracking</h3>
          <div className="h-32 bg-bg-page rounded-xl relative overflow-hidden flex items-center justify-center border border-[var(--border)]">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:14px_14px]" />
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute bg-emerald-500/20 border border-emerald-500 p-2 rounded-full z-10"
              style={{
                left: `${45 + (activeCoordinates.lat - 5.6037) * 2000}%`,
                top: `${50 + (activeCoordinates.lng + 0.1870) * 2000}%`
              }}
            >
              <div className="w-3 h-3 bg-emerald-600 rounded-full border-2 border-white" />
            </motion.div>
            <div className="absolute bottom-2 left-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg text-[9px] text-white space-y-0.5">
              <p className="font-semibold text-emerald-400">{activeDriverName || 'Fleet tracking'}</p>
              <p>Lat: {activeCoordinates.lat.toFixed(5)}</p>
              <p>Status: <span className="text-emerald-400 font-bold">{deliveryStatus}</span></p>
            </div>
          </div>
          <p className="text-[9px] text-text-muted mt-2 text-right">Refresh: {gpsInterval}s</p>
        </div>
      </div>

      {/* ══════════════ DESKTOP LAYOUT (lg+) ══════════════ */}
      <div className="hidden lg:block text-[var(--text-primary)]">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">CEO Command Terminal</h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">Global operations overview, metrics, and fleet map.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button 
                onClick={handleExportPDF}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
 
          {/* Operational KPI Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {[
              { title: 'Global Ingestion Flow', value: kpiIngestion !== null ? `${kpiIngestion.toLocaleString()} Tons` : '—', data: [30,45,35,60,40,70,55], tab: 'Cargo' },
              { title: 'Processing Invoices',   value: kpiInvoices !== null ? `${kpiInvoices} Invoice${kpiInvoices !== 1 ? 's' : ''}` : '—', data: [20,35,25,50,30,55,45], tab: 'Orders' },
              { title: 'Active Fleet Vehicles',  value: kpiFleet !== null ? `${kpiFleet} Truck${kpiFleet !== 1 ? 's' : ''}` : '—', data: [40,40,40,40,40,40,40], tab: 'Fleet' },
              { title: 'Total Registered Staff', value: kpiStaff !== null ? `${kpiStaff} Active` : '—', data: [15,25,20,35,25,40,30], tab: 'Staff' }
            ].map((card, idx) => (
              <button key={idx} className="kpi-card group text-left cursor-pointer hover:ring-2 hover:ring-[var(--accent)] transition-all" onClick={() => setActiveSubTab?.(card.tab)}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                  <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                </div>
                <div className="flex items-end justify-between mt-2 gap-2">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none">{card.value}</h3>
                    <p className="flex items-center gap-0.5 text-[10px] font-semibold mt-1.5 text-[var(--text-muted)]">—</p>
                  </div>
                  <MiniSparkline data={card.data} color="var(--accent)" width={60} height={36} />
                </div>
              </button>
            ))}
          </div>
 
          {/* Supplier Order Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Recent Supplier Orders */}
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--box-shadow)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Supplier Orders</h3>
                </div>
                <button onClick={onNavigateToSupplierOrders}
                  className="flex items-center gap-1 text-xs text-[var(--accent)] font-semibold hover:opacity-80">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {loadingRecent ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
                  <ShoppingBag className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No supplier orders yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 5).map(o => {
                    const sc = STATUS_COLORS[o.status] || { color: '#6b7280', bg: '#f3f4f6' };
                    return (
                      <div key={o.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--accent-light)] rounded-lg px-2 transition-colors" onClick={onNavigateToSupplierOrders}>
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-semibold text-[var(--accent)]">{o.order_number}</p>
                          <p className="text-xs text-[var(--text-secondary)] truncate">{COUNTRY_FLAGS[o.supplier_country] || '🌍'} {o.supplier_name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">{o.currency} {o.total_amount.toLocaleString()}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ background: sc.bg, color: sc.color }}>{STATUS_LABELS[o.status] || o.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Payment Authorisations */}
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--box-shadow)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Pending Payment Authorisations</h3>
              </div>
              {loadingPending ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                  ))}
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <p className="text-sm text-emerald-600 font-semibold">All payments authorised</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold text-[var(--text-primary)]">{o.order_number}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{o.supplier_name}</p>
                        <p className="text-xs font-bold text-emerald-600">GHS {(o.total_amount_ghs || 0).toLocaleString()}</p>
                      </div>
                      <button onClick={onNavigateToSupplierOrders}
                        className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700">
                        Authorise
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map and Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Fleet Tracking Map */}
            <div className="lg:col-span-2 p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Live Fleet Tracking Map</h3>
                <p className="text-xs text-[var(--text-muted)]">Simulated real-time vehicle GPS coordinate logging.</p>
              </div>
              
              <div className="h-[200px] sm:h-64 bg-[var(--bg)] rounded-2xl relative overflow-hidden flex items-center justify-center border border-[var(--border)]">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(var(--accent)_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute bg-[var(--accent-light)] border border-[var(--accent)] p-2.5 rounded-full z-10"
                  style={{
                    left: `${45 + (activeCoordinates.lat - 5.6037) * 2000}%`,
                    top: `${50 + (activeCoordinates.lng + 0.1870) * 2000}%`
                  }}
                >
                  <div className="w-3.5 h-3.5 bg-[var(--accent)] rounded-full border-2 border-white"></div>
                </motion.div>
                
                <div className="absolute top-10 left-12 text-[10px] font-bold text-[var(--text-muted)]">Kotoka Intl Airport</div>
                <div className="absolute bottom-16 right-20 text-[10px] font-bold text-[var(--text-muted)]">Tema Harbour Port</div>
                <div className="absolute bottom-10 left-10 text-[10px] font-bold text-[var(--text-muted)] font-semibold">Accra Central</div>
 
                <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-white space-y-0.5 shadow-lg">
                  <p className="font-semibold text-[var(--accent)]">{activeDriverName ? `${activeDriverName} — Active` : kpiFleet === 0 ? 'No active fleet' : 'Loading driver…'}</p>
                  <p className="opacity-90">Lat: {activeCoordinates.lat.toFixed(6)}</p>
                  <p className="opacity-90">Lng: {activeCoordinates.lng.toFixed(6)}</p>
                  <p className="opacity-90">Status: <span className="text-emerald-400 font-bold uppercase">{deliveryStatus}</span></p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Map Provider: Google Maps Platform SDK</span>
                <span>Stream interval: {gpsInterval}s</span>
              </div>
            </div>
 
            {/* Line Chart */}
            <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Inflow Revenue VS Orders</h3>
                <p className="text-xs text-[var(--text-muted)]">Weekly transactional volumes.</p>
              </div>
              <div className="h-[200px] sm:h-60 lg:h-[300px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    <Line type="monotone" dataKey="Inflow" stroke="var(--accent)" strokeWidth={2.5} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Orders" stroke="#6366f1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
 
          </div>
        </div>
      </div>
    </>
  );
}
