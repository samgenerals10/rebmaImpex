// rebma-web/src/views/CeoDashboard.tsx

import { useState, useEffect } from 'react';
import { Layers, DollarSign, Truck, Users, FileSpreadsheet, FileText, MoreVertical, TrendingUp, TrendingDown, ShoppingBag, Clock, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import MiniSparkline from '../components/MiniSparkline';
import PendingApprovalsAlert from '../components/global/PendingApprovalsAlert';
import ActivityFeed from '../components/global/ActivityFeed';
import DispatchMap from '../components/dispatch/DispatchMap';
import ProductCatalogCard from '../components/ProductCatalogCard';
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
  gpsInterval: number;
  onNavigateToSupplierOrders?: () => void;
  setActiveSubTab?: (tab: string) => void;
}

const COUNTRY_FLAGS: Record<string, string> = { Poland: '🇵🇱', Turkey: '🇹🇷', Germany: '🇩🇪', UK: '🇬🇧', USA: '🇺🇸', Other: '🌍' };

export default function CeoDashboard({
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
  const [lineChartData, setLineChartData] = useState<{ name: string; Inflow: number; Orders: number }[]>([]);
  
  // Oversight stats
  const [totalFinishedGoods, setTotalFinishedGoods] = useState<number>(0);
  const [finishedGoodsVal, setFinishedGoodsVal] = useState<number>(0);
  const [totalRawMaterials, setTotalRawMaterials] = useState<number>(0);
  const [totalGeneralPurchases, setTotalGeneralPurchases] = useState<number>(0);
  const [generalPurchasesVal, setGeneralPurchasesVal] = useState<number>(0);
  const [cargoDiscrepancies, setCargoDiscrepancies] = useState<any[]>([]);
  
  // Live GPS tracking state
  const [transitVehicles, setTransitVehicles] = useState<any[]>([]);
  const [goodsPrices, setGoodsPrices] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [soldLedger, setSoldLedger] = useState<any[]>([]);

  const loadTransit = async () => {
    try {
      const { data } = await supabase
        .from('delivery_logs')
        .select('id, driver_id, driver_name, vehicle_id, active_coordinates, status')
        .in('status', ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);
      setTransitVehicles(data ?? []);
    } catch {
      setTransitVehicles([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('cargo_intake')
          .select('id,goods_code,product_name,company,country,weight,status,created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentOrders((data ?? []).map((r: any) => ({
          id: r.id,
          order_number: r.goods_code || r.id,
          supplier_name: r.company || '—',
          supplier_country: r.country || '—',
          total_amount: r.weight || 0,
          total_amount_ghs: 0,
          currency: 'Tons',
          status: r.status,
          created_at: r.created_at,
        })));
      } catch {
        setRecentOrders([]);
      } finally {
        setLoadingRecent(false);
      }
    };
    const loadPending = async () => {
      try {
        const { data } = await supabase
          .from('cargo_intake')
          .select('id,goods_code,product_name,company,country,weight,status,created_at')
          .eq('status', 'PENDING_MANAGEMENT_APPROVAL')
          .order('created_at', { ascending: false });
        setPendingOrders((data ?? []).map((r: any) => ({
          id: r.id,
          order_number: r.goods_code || r.id,
          supplier_name: r.company || '—',
          supplier_country: r.country || '—',
          total_amount: r.weight || 0,
          total_amount_ghs: 0,
          currency: 'Tons',
          status: r.status,
          created_at: r.created_at,
        })));
      } catch {
        setPendingOrders([]);
      } finally {
        setLoadingPending(false);
      }
    };
    const loadKPIs = async () => {
      try {
        // Cargo ingestion — total weight (metric tons) of APPROVED cargo
        const { data: cargo } = await supabase.from('cargo_intake').select('weight').eq('status', 'APPROVED');
        const totalTons = (cargo as { weight: number }[] ?? []).reduce((s, r) => s + (r.weight || 0), 0);
        setKpiIngestion(totalTons);

        // Processing invoices — orders awaiting Finance review
        const { count: invoiceCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING_FINANCE');
        setKpiInvoices(invoiceCount ?? 0);

        // Active fleet
        const { count: fleetCount } = await supabase
          .from('delivery_logs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'IN_TRANSIT');
        setKpiFleet(fleetCount ?? 0);

        // Total staff
        const { count: staffCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ACTIVE');
        setKpiStaff(staffCount ?? 0);

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

        // Finished Goods
        try {
          const { data: stockData } = await supabase.from('stock').select('quantity');
          const fgUnits = (stockData as { quantity: number }[] ?? []).reduce((s, r) => s + (r.quantity || 0), 0);
          setTotalFinishedGoods(fgUnits);
          setFinishedGoodsVal(fgUnits * 45.5);
        } catch (e) {
          console.error(e);
        }

        // Raw Materials
        try {
          const { data: wipData } = await supabase.from('wip_stock').select('qty').eq('stage', 'Raw Materials');
          const rmUnits = (wipData as { qty: number }[] ?? []).reduce((s, r) => s + (r.qty || 0), 0);
          setTotalRawMaterials(rmUnits);
        } catch (e) {
          console.error(e);
        }

        // Approved General Purchases
        try {
          const { data: gpData } = await supabase.from('general_purchases').select('quantity, cost').eq('status', 'APPROVED');
          const gpUnits = (gpData as { quantity: number }[] ?? []).reduce((s, r) => s + (r.quantity || 0), 0);
          const gpCost = (gpData as { cost: number }[] ?? []).reduce((s, r) => s + (r.cost || 0), 0);
          setTotalGeneralPurchases(gpUnits);
          setGeneralPurchasesVal(gpCost);
        } catch (e) {
          console.error(e);
        }

        // Live Products Available to Sell
        try {
          const { data: gpPrices } = await supabase.from('goods_prices').select('product_name, unit_price, cost_price, currency, category, product_image');
          if (gpPrices) setGoodsPrices(gpPrices);
          const { data: stList } = await supabase.from('stock').select('product_name, quantity');
          if (stList) setStockList(stList);
          // Actual quantity sold — real deductions logged when a sale is confirmed (see deductStockForOrder)
          const { data: soldLedger } = await supabase
            .from('stock_ledger')
            .select('product_name, quantity')
            .eq('movement_type', 'REMOVE');
          if (soldLedger) setSoldLedger(soldLedger);
        } catch (e) {
          console.error(e);
        }

        // Fetch approved discrepancies
        try {
          const { data: discData } = await supabase
            .from('cargo_intake')
            .select('id, goods_code, product_name, company, quantity, unit_price, discrepancies, is_fault_or_damaged, status')
            .eq('status', 'APPROVED')
            .eq('is_fault_or_damaged', true);
          
          if (discData) {
            const parsed = discData.map((c: any) => {
              let originalQty = c.quantity || 0;
              let damagedCount = 0;
              let unitCost = Number(c.unit_price || 0);
              let costLoss = 0;
              let sellingPriceVal = 0;
              let notes = c.discrepancies || '';

              try {
                if (c.discrepancies && c.discrepancies.trim().startsWith('{')) {
                  const parsedJson = JSON.parse(c.discrepancies);
                  originalQty = parsedJson.originalQty ?? originalQty;
                  damagedCount = parsedJson.damagedCount ?? 0;
                  unitCost = parsedJson.unitCost ?? unitCost;
                  costLoss = parsedJson.costLoss ?? (damagedCount * unitCost);
                  sellingPriceVal = parsedJson.sellingPrice ?? 0;
                  notes = parsedJson.notes ?? '';
                } else if (c.discrepancies && c.discrepancies !== 'None') {
                  const dmgMatch = c.discrepancies.match(/Confirmed:\s*(\d+)/i);
                  if (dmgMatch) {
                    damagedCount = parseInt(dmgMatch[1], 10);
                    costLoss = damagedCount * unitCost;
                  }
                }
              } catch (err) {
                console.error('Error parsing discrepancies JSON:', err);
              }

              return {
                id: c.id,
                goodsCode: c.goods_code || c.id,
                productName: c.product_name || 'Unknown',
                company: c.company || 'N/A',
                originalQty,
                damagedCount,
                unitCost,
                costLoss,
                sellingPrice: sellingPriceVal,
                notes
              };
            }).filter((d: any) => d.damagedCount > 0);
            setCargoDiscrepancies(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      } catch {
        // leave KPIs null — UI will show 0
      }
    };

    load();
    loadPending();
    loadKPIs();
    loadTransit();

    const channel = supabase.channel('ceo-dashboard-realtime-' + Math.random().toString(36).substring(7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadKPIs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_payments' }, () => {
        loadKPIs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cargo_intake' }, () => {
        load();
        loadPending();
        loadKPIs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        loadKPIs();
      })
      .subscribe();

    const interval = setInterval(loadTransit, gpsInterval ? gpsInterval * 1000 : 5000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [gpsInterval]);

  const handleExportCSV = () => {
    const data = [
      { Metric: 'Global Ingestion Flow', Value: kpiIngestion !== null ? `${kpiIngestion.toLocaleString()} Tons` : '—', Details: 'Accra Port Operations' },
      { Metric: 'Processing Invoices', Value: kpiInvoices !== null ? `${kpiInvoices} Invoices` : '—', Details: 'Awaiting finance clearance' },
      { Metric: 'Active Logistics Vehicles', Value: kpiFleet !== null ? `${kpiFleet} Trucks` : '—', Details: `${transitVehicles.length} vehicles currently in transit` },
      { Metric: 'Total Registered Staff', Value: kpiStaff !== null ? `${kpiStaff} Active` : '—', Details: 'HR approval pending queue' }
    ];
    exportToCSV(data, ['Metric', 'Value', 'Details'], 'ceo_executive_summary');
  };

  const handleExportPDF = () => {
    const data = [
      { Metric: 'Global Ingestion Flow', Value: kpiIngestion !== null ? `${kpiIngestion.toLocaleString()} Tons` : '—', Details: 'Accra Port Operations' },
      { Metric: 'Processing Invoices', Value: kpiInvoices !== null ? `${kpiInvoices} Invoices` : '—', Details: 'Awaiting finance clearance' },
      { Metric: 'Active Logistics Vehicles', Value: kpiFleet !== null ? `${kpiFleet} Trucks` : '—', Details: `${transitVehicles.length} vehicles currently in transit` },
      { Metric: 'Total Registered Staff', Value: kpiStaff !== null ? `${kpiStaff} Active` : '—', Details: 'HR approval pending queue' }
    ];
    exportToPDF('CEO Executive Summary', data, ['Metric', 'Value', 'Details']);
  };

  // Products priced by Management, with live remaining vs. sold quantities
  const inventoryItems = goodsPrices.map((gp: any) => {
    const key = String(gp.product_name || '').toLowerCase().trim();
    const qty = stockList.filter((s: any) => String(s.product_name || '').toLowerCase().trim() === key).reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
    const soldQty = soldLedger.filter((l: any) => String(l.product_name || '').toLowerCase().trim() === key)
      .reduce((sum: number, l: any) => sum + (Number(l.quantity) || 0), 0);
    return { name: gp.product_name, unitPrice: Number(gp.unit_price || 0), currency: gp.currency || 'GHS', qty, soldQty, image: gp.product_image || '' };
  });

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

        {/* Pending approvals alert */}
        <PendingApprovalsAlert department="CEO" onNavigate={setActiveSubTab} />

        {/* Available Products — priced by Management, ready to sell */}
        {inventoryItems.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-card space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--border)]">
                <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-500" /> Products Available to Sell
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold">
                  {inventoryItems.length} priced
                </span>
              </div>
              <div className="space-y-2">
                {inventoryItems.map((item: any) => (
                  <div key={item.name} className="p-3 bg-bg-page border border-[var(--border)] rounded-xl flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate">{item.name}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Price: <strong className="text-emerald-600 font-mono">{item.currency} {item.unitPrice.toLocaleString()}</strong></p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full block mb-1 ${item.qty > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-500/10 text-text-muted'}`}>
                        {item.qty > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                      <p className="text-[10px] text-text-secondary font-semibold font-mono">Sold: {item.soldQty.toLocaleString()} · Left: {item.qty.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        )}

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

        {/* Mobile Inventory & Asset Oversight Panel */}
        <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-primary">Inventory & Assets Oversight</h3>
            <span className="text-[9px] text-text-muted font-mono">Live</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Finished Goods', value: `${totalFinishedGoods.toLocaleString()} Units`, sub: `Valued GHS ${finishedGoodsVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: '📦' },
              { label: 'Raw Materials (WIP)', value: `${totalRawMaterials.toLocaleString()} Units`, sub: 'In production stage', icon: '🧱' },
              { label: 'General Purchases', value: `${totalGeneralPurchases.toLocaleString()} Items`, sub: `Spent GHS ${generalPurchasesVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: '💰' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 bg-bg-page rounded-xl border border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-[10px] font-bold text-text-primary">{item.label}</p>
                    <p className="text-[9px] text-text-muted">{item.sub}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-text-primary font-mono">{item.value}</span>
              </div>
            ))}
          </div>
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
          <DispatchMap
            deliveries={transitVehicles.map(v => ({ id: v.id, driverId: v.driver_id, driverName: v.driver_name, vehicleId: v.vehicle_id, status: v.status, active_coordinates: v.active_coordinates }))}
            height={128}
            compact
            pollIntervalSeconds={gpsInterval}
          />
          <p className="text-[9px] text-text-muted mt-2 text-right">Refresh: {gpsInterval}s</p>
        </div>

        {/* Cargo Discrepancy Statement Mobile */}
        <div className="bg-bg-card rounded-2xl border border-[var(--border)] shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <AlertCircle size={14} className="text-red-500 animate-pulse" /> Discrepancies
            </h3>
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] font-bold">
              Loss: GHS {cargoDiscrepancies.reduce((s, d) => s + d.costLoss, 0).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {cargoDiscrepancies.map(d => (
              <div key={d.id} className="p-2 bg-bg-page rounded-xl border border-[var(--border)] text-[11px] space-y-1">
                <div className="flex justify-between font-bold text-text-primary">
                  <span>{d.productName}</span>
                  <span className="text-red-500">{d.damagedCount} damaged</span>
                </div>
                <div className="flex justify-between text-text-secondary text-[10px]">
                  <span>Supplier: {d.company}</span>
                  <span className="font-semibold">Loss: GHS {d.costLoss.toLocaleString()}</span>
                </div>
                {d.notes && <p className="text-text-muted text-[10px] italic">Notes: {d.notes}</p>}
              </div>
            ))}
            {cargoDiscrepancies.length === 0 && (
              <p className="text-center text-text-muted text-[10px] py-4">No approved cargo discrepancies.</p>
            )}
          </div>
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
 
          {/* Pending approvals alert */}
          <PendingApprovalsAlert department="CEO" onNavigate={setActiveSubTab} />

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

          {/* Products Available to Sell */}
          {inventoryItems.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <CheckCircle size={15} className="text-emerald-500" /> Products Available to Sell
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {inventoryItems.length} product{inventoryItems.length !== 1 ? 's' : ''} priced by Management
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5">
                  {inventoryItems.map((item: any) => (
                    <ProductCatalogCard key={item.name} item={item} />
                  ))}
                </div>
              </div>
          )}
 
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
                  className="flex items-center gap-1 text-xs text-[var(--accent)] font-semibold hover:underline">
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

          {/* Inventory & Asset Oversight Panel */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--box-shadow)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Inventory & Asset Oversight</h3>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-mono">Real-time DB Sync</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Finished Goods */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2 hover:ring-1 hover:ring-[var(--accent)] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Finished Goods</span>
                  <span className="text-xs">📦</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-[var(--text-primary)] font-mono">{totalFinishedGoods.toLocaleString()} <span className="text-xs font-normal font-sans text-[var(--text-secondary)]">Units</span></h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">Value: GHS {finishedGoodsVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Raw Materials */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2 hover:ring-1 hover:ring-[var(--accent)] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Raw Materials (WIP)</span>
                  <span className="text-xs">🧱</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-[var(--text-primary)] font-mono">{totalRawMaterials.toLocaleString()} <span className="text-xs font-normal font-sans text-[var(--text-secondary)]">Units</span></h4>
                  <p className="text-[10px] text-[var(--text-muted)]">Currently in production queue stage</p>
                </div>
              </div>

              {/* General Purchases */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2 hover:ring-1 hover:ring-[var(--accent)] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">General Purchased Items</span>
                  <span className="text-xs">💰</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-[var(--text-primary)] font-mono">{totalGeneralPurchases.toLocaleString()} <span className="text-xs font-normal font-sans text-[var(--text-secondary)]">Items</span></h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">Spent: GHS {generalPurchasesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Map and Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Fleet Tracking Map */}
            <div className="lg:col-span-2 p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Live Fleet Tracking Map</h3>
                <p className="text-xs text-[var(--text-muted)]">Real-time vehicle GPS coordinate logging from active routes.</p>
              </div>
              
              <DispatchMap
                deliveries={transitVehicles.map(v => ({ id: v.id, driverId: v.driver_id, driverName: v.driver_name, vehicleId: v.vehicle_id, status: v.status, active_coordinates: v.active_coordinates }))}
                height={256}
                pollIntervalSeconds={gpsInterval}
              />
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Map Provider: OpenStreetMap</span>
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

        {/* Cargo Discrepancy Statement Desktop */}
        <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500 animate-pulse" /> Cargo Discrepancy Statement
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Logs of confirmed inventory damages, write-offs, and resulting financial losses at cost</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold">
              Total Damages: {cargoDiscrepancies.reduce((s, d) => s + d.damagedCount, 0)} units
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Cargo ID</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Product Name</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Supplier</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-center">Original Qty</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-center">Damaged Qty</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-right">Unit Cost (GHS)</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold text-right">Financial Loss (GHS)</th>
                  <th className="py-2 px-3 text-[var(--text-muted)] font-semibold">Description / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cargoDiscrepancies.map(d => (
                  <tr key={d.id} className="hover:bg-red-500/5">
                    <td className="py-3 px-3 font-mono text-[10px] text-[var(--text-secondary)]">{d.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">{d.productName}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">{d.company}</td>
                    <td className="py-3 px-3 text-center text-[var(--text-secondary)]">{d.originalQty}</td>
                    <td className="py-3 px-3 text-center text-red-500 font-bold">{d.damagedCount}</td>
                    <td className="py-3 px-3 text-right text-[var(--text-secondary)]">{d.unitCost.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-red-650 font-extrabold">GHS {d.costLoss.toLocaleString()}</td>
                    <td className="py-3 px-3 text-[var(--text-muted)] max-w-xs truncate" title={d.notes}>{d.notes}</td>
                  </tr>
                ))}
                {cargoDiscrepancies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                      No approved cargo discrepancies or damages logged.
                    </td>
                  </tr>
                )}
              </tbody>
              {cargoDiscrepancies.length > 0 && (
                <tfoot>
                  <tr className="bg-red-500/10 border-t border-[var(--border)] font-bold">
                    <td colSpan={6} className="py-2.5 px-3 text-[var(--text-primary)]">Total Loss (At Cost)</td>
                    <td className="py-2.5 px-3 text-right text-red-600">
                      GHS {cargoDiscrepancies.reduce((s, d) => s + d.costLoss, 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Full organisation activity — CEO sees everything */}
        <div className="mt-6">
          <ActivityFeed
            title="Live Organisation Activity"
            limit={30}
          />
        </div>

      </div>
    </>
  );
}
