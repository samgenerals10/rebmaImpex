import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Package, TrendingDown, TrendingUp,
  History, Download, Lock, ChevronUp, ChevronDown, ArrowUpRight,
  ArrowDownLeft, Layers, Truck, User, FileText,
} from 'lucide-react';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';
import { stockApi, operations } from '../../services/apiClient';
import { exportToCSV } from '../../utils/export';
import { supabase } from '../../lib/supabaseClient';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import type { IncomingGoods, GeneralPurchase } from '../../types/erp';
import StockIntakeForm from '../../components/StockIntakeForm';

// ── types ──────────────────────────────────────────────────────────────────
interface StockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  current: number;
  capacity: number;
  updatedAt: string;
}

interface ApprovedCargo {
  id: string;
  productName: string;
  goodsCode: string;
  quantity: number;  // total IN from port
  unit: string;
  weight: number;
  supplier: string;
  portOfOrigin: string;
  destination: string;
  approvedBy: string;
  approvedAt: string;
}

interface LedgerEntry {
  id: string;
  productName: string;
  movementType: 'ADD' | 'REMOVE';
  quantity: number;
  reference: string;
  notes: string;
  performedBy: string;
  date: string;
}

// ledger totals per product name
type LedgerMap = Record<string, { totalIn: number; totalOut: number; entries: LedgerEntry[] }>;

type ActiveTab = 'APPROVED_CARGO' | 'PRODUCTS' | 'GENERAL_PURCHASES';

// ── helpers ────────────────────────────────────────────────────────────────
const stockStatus = (current: number, capacity: number) => {
  if (current === 0) return { label: 'Out of Stock', bg: '#ffe4e6', color: '#9f1239' };
  if (capacity > 0 && current / capacity < 0.2) return { label: 'Low Stock', bg: '#fef3c7', color: '#92400e' };
  return { label: 'In Stock', bg: '#d1fae5', color: '#065f46' };
};

const barColor = (current: number, capacity: number) => {
  if (current === 0) return '#f43f5e';
  if (capacity > 0 && current / capacity < 0.2) return '#f59e0b';
  return '#10b981';
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ── sub-components ─────────────────────────────────────────────────────────

// Stock flow banner: IN → OUT → REMAINING
function FlowBanner({ totalIn, totalOut, unit = 'units' }: { totalIn: number; totalOut: number; unit?: string }) {
  const remaining = Math.max(0, totalIn - totalOut);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center',
      gap: 0, marginBottom: 20, background: 'var(--bg)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {[
        { label: 'Total In', value: totalIn, color: '#3b82f6', icon: <ArrowDownLeft size={14} />, bg: '#eff6ff' },
        { sep: true },
        { label: 'Total Out', value: totalOut, color: '#ef4444', icon: <ArrowUpRight size={14} />, bg: '#fff1f2' },
        { sep: true },
        { label: 'Remaining', value: remaining, color: '#10b981', icon: <Layers size={14} />, bg: '#f0fdf4' },
      ].map((item, i) =>
        (item as any).sep
          ? <div key={i} style={{ width: 1, height: 40, background: 'var(--border)', margin: '0 auto' }} />
          : (
            <div key={i} style={{ padding: '14px 20px', textAlign: 'center', background: (item as any).bg }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: (item as any).color, marginBottom: 2 }}>
                {(item as any).icon}
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{(item as any).label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: (item as any).color, lineHeight: 1 }}>
                {Number((item as any).value).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{unit}</div>
            </div>
          )
      )}
    </div>
  );
}

// Movement history list used inside detail panels
function MovementHistory({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return (
    <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No movement history recorded.</div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.slice(0, 10).map(e => (
        <div key={e.id} style={{
          display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8, alignItems: 'start',
          padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: e.movementType === 'ADD' ? '#eff6ff' : '#fff1f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {e.movementType === 'ADD'
              ? <ArrowDownLeft size={12} color="#3b82f6" />
              : <ArrowUpRight size={12} color="#ef4444" />}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {e.reference || (e.movementType === 'ADD' ? 'Stock Added' : 'Stock Removed')}
            </div>
            {e.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{e.notes}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              {e.performedBy && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                  <User size={9} /> {e.performedBy}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDateTime(e.date)}</span>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: e.movementType === 'ADD' ? '#3b82f6' : '#ef4444', whiteSpace: 'nowrap' }}>
            {e.movementType === 'ADD' ? '+' : '−'}{Number(e.quantity).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────
interface Props { incomingGoodsList: IncomingGoods[]; addNotification: (msg: string) => void }

export default function StockView({ incomingGoodsList: _ig, addNotification }: Props) {
  const { getSetting } = useCeoSettings();
  const [activeTab, setActiveTab] = useState<ActiveTab>('APPROVED_CARGO');
  const [approvedCargo, setApprovedCargo] = useState<ApprovedCargo[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [generalPurchases, setGeneralPurchases] = useState<GeneralPurchase[]>([]);
  const [ledgerMap, setLedgerMap] = useState<LedgerMap>({});
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // search / filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // sort (cargo table)
  const [cargoSort, setCargoSort] = useState<{ field: keyof ApprovedCargo; dir: 'asc' | 'desc' }>({ field: 'approvedAt', dir: 'desc' });

  // detail panels
  const [selectedCargo, setSelectedCargo] = useState<ApprovedCargo | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [selectedGP, setSelectedGP] = useState<GeneralPurchase | null>(null);

  // adjust GP modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<GeneralPurchase | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'Add', quantity: '', reason: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const [showAddProduct, setShowAddProduct] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // --- cargo_intake APPROVED ---
      const { data: cargoData } = await supabase
        .from('cargo_intake')
        .select('*')
        .eq('status', 'APPROVED')
        .order('updated_at', { ascending: false })
        .limit(300);

      setApprovedCargo((cargoData || []).map((r: any) => ({
        id: String(r.id),
        productName: r.description || r.product_name || r.productName || 'Unknown',
        goodsCode: r.request_id || r.goods_code || String(r.id).slice(0, 8).toUpperCase(),
        quantity: Number(r.quantity ?? 0),
        unit: r.unit || 'units',
        weight: Number(r.weight_kg ?? r.weight ?? 0),
        supplier: r.supplier_name || r.company || '—',
        portOfOrigin: r.port_of_origin || r.country || '—',
        destination: r.destination || 'Accra Warehouse',
        approvedBy: r.approved_by || r.updated_by || '—',
        approvedAt: r.updated_at || r.created_at || '',
      })));

      // --- stock table (company finished goods) ---
      const stockData = await stockApi.getStock();
      setStock(stockData.filter((s: StockItem) => s.category !== 'INCOMING_GOODS'));

      // --- general purchases APPROVED ---
      const gpData = await operations.getGeneralPurchases();
      setGeneralPurchases((gpData || []).filter((gp: any) => gp.status === 'APPROVED'));

      // --- stock_ledger: full history, all products ---
      const { data: ledgerData } = await supabase
        .from('stock_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Build ledger map keyed by lowercase product name for case-insensitive matching
      const rawMap: Record<string, { totalIn: number; totalOut: number; entries: LedgerEntry[]; canonical: string }> = {};
      const seenRefs = new Set();
      const seenIds = new Set();
      const seenKeys = new Set();

      for (const r of (ledgerData || [])) {
        const rawName: string = r.product_name || '';
        if (!rawName) continue;

        const id = String(r.id);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const ref = r.reference || '';
        const isCargoApprove = ref.toLowerCase().includes('cargo approved') || ref.toLowerCase().includes('cargo intake id');
        const isOrderApprove = ref.toLowerCase().includes('order approved') || ref.toLowerCase().includes('order finalized') || ref.toLowerCase().includes('order dispatched') || ref.toLowerCase().includes('tkt-');

        if (isCargoApprove || isOrderApprove) {
          const normalizedRef = ref.toLowerCase().trim();
          if (seenRefs.has(normalizedRef)) continue;
          seenRefs.add(normalizedRef);
        }

        // Deduplicate by movement type, quantity, notes, and day of date to catch duplicate logs with different random IDs
        const dateVal = r.created_at || '';
        let dayKey = '';
        if (dateVal) {
          try {
            const d = new Date(dateVal);
            dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          } catch (err) {
            dayKey = dateVal.slice(0, 10);
          }
        }
        const notesText = (r.notes || '').toLowerCase().trim();
        const dupKey = `${r.movement_type || ''}_${r.quantity}_${notesText}_${dayKey}`;
        if (seenKeys.has(dupKey)) continue;
        seenKeys.add(dupKey);

        const key = rawName.toLowerCase().trim();
        if (!rawMap[key]) rawMap[key] = { totalIn: 0, totalOut: 0, entries: [], canonical: rawName };
        const qty = Number(r.quantity ?? 0);
        const entry: LedgerEntry = {
          id,
          productName: rawName,
          movementType: r.movement_type as 'ADD' | 'REMOVE',
          quantity: qty,
          reference: ref,
          notes: r.notes || '',
          performedBy: r.performed_by || '',
          date: r.created_at || '',
        };
        rawMap[key].entries.push(entry);
        if (r.movement_type === 'ADD') rawMap[key].totalIn += qty;
        else if (r.movement_type === 'REMOVE') rawMap[key].totalOut += qty;
      }
      // Re-index by canonical (original) name AND lowercase key for flexible lookup
      const map: LedgerMap = {};
      for (const [key, val] of Object.entries(rawMap)) {
        map[val.canonical] = { totalIn: val.totalIn, totalOut: val.totalOut, entries: val.entries };
        map[key] = { totalIn: val.totalIn, totalOut: val.totalOut, entries: val.entries };
      }
      setLedgerMap(map);
      // Global movement history must walk rawMap (one bucket per product),
      // not the re-indexed `map` above — that map holds each product's entry
      // list under two keys (canonical-case and lowercase), so summing its
      // values would silently double every row in "Recent Stock Movements".
      setLedgerEntries(Object.values(rawMap).flatMap(v => v.entries));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useRealtimeChannel('operations-stock-realtime', ['stock', 'stock_ledger', 'cargo_intake', 'general_purchases'], () => loadData());

  // ── derived totals ───────────────────────────────────────────────────────
  const cargoTotalIn = approvedCargo.reduce((s, c) => s + c.quantity, 0);
  // Try both original and lowercase key for case-insensitive lookup
  const getLedger = (name: string) => ledgerMap[name] ?? ledgerMap[name.toLowerCase().trim()] ?? { totalIn: 0, totalOut: 0, entries: [] };
  // A product's ledger holds every REMOVE it has ever had, including from
  // cargo batches that were approved (and fully consumed/deleted) long
  // before this one arrived — e.g. a production release from two weeks ago
  // shouldn't count as "dispatched" against a batch that only landed today.
  // Scoping to entries on/after the batch's own approval date keeps OUT
  // meaning "moved since THIS stock existed", not "ever moved, historically".
  const getLedgerSince = (name: string, sinceIso: string) => {
    const entries = getLedger(name).entries.filter(e => !sinceIso || e.date >= sinceIso);
    const totalOut = entries.filter(e => e.movementType === 'REMOVE').reduce((s, e) => s + e.quantity, 0);
    return { totalOut, entries };
  };
  // Sum OUT once per distinct product (using the earliest approval among its
  // currently-listed batches) rather than once per row — summing per row
  // would double/triple-count the same removals whenever more than one
  // batch of the same product is on the approved list at once.
  const earliestApprovalByProduct: Record<string, string> = {};
  for (const c of approvedCargo) {
    const key = c.productName;
    if (!earliestApprovalByProduct[key] || c.approvedAt < earliestApprovalByProduct[key]) {
      earliestApprovalByProduct[key] = c.approvedAt;
    }
  }
  const cargoTotalOut = Object.entries(earliestApprovalByProduct)
    .reduce((s, [name, since]) => s + getLedgerSince(name, since).totalOut, 0);

  const productsTotalIn = stock.reduce((s, p) => s + (getLedger(p.name).totalIn), 0);
  const productsTotalOut = stock.reduce((s, p) => s + (getLedger(p.name).totalOut), 0);
  const productsRemaining = stock.reduce((s, p) => s + p.current, 0);

  const gpTotalIn = generalPurchases.reduce((s, gp) => s + Number(gp.quantity ?? 0), 0);
  const gpTotalOut = generalPurchases.reduce((s, gp) => s + (getLedger(gp.itemName).totalOut), 0);

  // ── filter / sort ────────────────────────────────────────────────────────
  const filteredCargo = [...approvedCargo]
    .filter(c => {
      const q = search.toLowerCase();
      const ms = !search || c.productName.toLowerCase().includes(q) || c.goodsCode.toLowerCase().includes(q) || c.supplier.toLowerCase().includes(q);
      const md = (!startDate || c.approvedAt >= startDate) && (!endDate || c.approvedAt <= endDate + 'T23:59:59');
      return ms && md;
    })
    .sort((a, b) => {
      const va = a[cargoSort.field], vb = b[cargoSort.field];
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
      return cargoSort.dir === 'asc' ? cmp : -cmp;
    });

  const filteredStock = stock.filter(s => {
    const q = search.toLowerCase();
    const ms = !search || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q);
    const st = stockStatus(s.current, s.capacity);
    const mst = statusFilter === 'All' || st.label === statusFilter;
    const md = (!startDate || s.updatedAt >= startDate) && (!endDate || s.updatedAt <= endDate + 'T23:59:59');
    return ms && mst && md;
  });

  const filteredGP = generalPurchases.filter(gp => {
    const q = search.toLowerCase();
    const ms = !search || gp.itemName.toLowerCase().includes(q) || gp.itemCode.toLowerCase().includes(q);
    const md = (!startDate || gp.dateReceived >= startDate) && (!endDate || gp.dateReceived <= endDate);
    return ms && md;
  });

  // ── GP adjust ────────────────────────────────────────────────────────────
  const doAdjustGP = async () => {
    if (!adjustTarget || !adjustForm.quantity || submitting) return;
    if (!getSetting('stock_adjustments_allowed', true)) { addNotification('Stock adjustments are currently disabled by the CEO.'); return; }
    setSubmitting(true);
    const delta = adjustForm.type === 'Add' ? parseInt(adjustForm.quantity) : -parseInt(adjustForm.quantity);
    const newQty = Math.max(0, Number(adjustTarget.quantity) + delta);
    try {
      await supabase.from('general_purchases').update({ quantity: newQty }).eq('id', adjustTarget.id);
      await supabase.from('stock_ledger').insert({
        product_name: adjustTarget.itemName,
        movement_type: adjustForm.type === 'Add' ? 'ADD' : 'REMOVE',
        quantity: Math.abs(delta),
        reference: adjustForm.reason || 'Manual Adjustment',
        notes: adjustForm.notes || '',
        created_at: new Date().toISOString(),
      });
      addNotification(`${adjustTarget.itemName} adjusted by ${delta > 0 ? '+' : ''}${delta}.`);
      loadData();
    } catch (err: any) { alert(err.message || 'Failed to adjust.'); }
    finally {
      setSubmitting(false);
      setShowAdjust(false); setAdjustTarget(null);
      setAdjustForm({ type: 'Add', quantity: '', reason: '', notes: '' });
    }
  };

  // ── tab config ───────────────────────────────────────────────────────────
  const TABS = [
    { key: 'APPROVED_CARGO' as ActiveTab, label: 'Port-Approved Goods', badge: cargoTotalIn, badgeUnit: 'total units' },
    { key: 'PRODUCTS' as ActiveTab, label: 'Company Products', badge: productsRemaining, badgeUnit: 'in stock' },
    { key: 'GENERAL_PURCHASES' as ActiveTab, label: 'General Purchases', badge: gpTotalIn, badgeUnit: 'total units' },
  ];

  const tabStyle = (key: ActiveTab) => ({
    background: 'none', border: 'none',
    borderBottom: activeTab === key ? '3px solid var(--accent)' : '3px solid transparent',
    color: activeTab === key ? 'var(--accent)' : 'var(--text-muted)',
    padding: '10px 18px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
  });

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Stock Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Full IN / OUT / REMAINING tracking across all stock sources</p>
        </div>
        
        {/* Navigation buttons + Action buttons group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Navigation Pill Group */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 3, gap: 3, boxShadow: 'var(--box-shadow)' }}>
            {[
              { key: 'APPROVED_CARGO' as ActiveTab, label: 'Port-Approved Goods', count: cargoTotalIn },
              { key: 'PRODUCTS' as ActiveTab, label: 'Company Products — Finished Goods', count: productsRemaining },
              { key: 'GENERAL_PURCHASES' as ActiveTab, label: 'General Purchased Items', count: gpTotalIn },
            ].map(btn => {
              const isSelected = activeTab === btn.key;
              return (
                <button
                  key={btn.key}
                  onClick={() => setActiveTab(btn.key)}
                  style={{
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: 9,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {btn.label}
                  <span
                    style={{
                      background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-input)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      borderRadius: 99,
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: 800
                    }}
                  >
                    {Number(btn.count).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action trigger button */}
          <button onClick={() => { setAdjustTarget(null); setShowAdjust(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            <Plus size={16} /> Adjust Stock
          </button>
          {activeTab === 'PRODUCTS' && (
            <button onClick={() => setShowAddProduct(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              <Plus size={16} /> Log Stock Intake
            </button>
          )}
        </div>
      </div>

      {/* Top-level dynamic KPI summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        {(activeTab === 'APPROVED_CARGO' ? [
          { label: 'Port IN (Approved)', value: cargoTotalIn, color: '#3b82f6', icon: <ArrowDownLeft size={16} /> },
          { label: 'Port OUT (Dispatched)', value: cargoTotalOut, color: '#ef4444', icon: <ArrowUpRight size={16} /> },
          { label: 'Port Remaining', value: Math.max(0, cargoTotalIn - cargoTotalOut), color: '#10b981', icon: <Layers size={16} /> },
        ] : activeTab === 'PRODUCTS' ? [
          { label: 'Products Total In', value: productsTotalIn, color: '#3b82f6', icon: <ArrowDownLeft size={16} /> },
          { label: 'Products Total Out', value: productsTotalOut, color: '#ef4444', icon: <ArrowUpRight size={16} /> },
          { label: 'Products Remaining', value: productsRemaining, color: '#10b981', icon: <Layers size={16} /> },
          { label: 'Low Stock Items', value: stock.filter(s => s.current > 0 && s.capacity > 0 && s.current / s.capacity < 0.2).length, color: '#f59e0b', icon: <TrendingDown size={16} /> },
        ] : [
          { label: 'GP Total In', value: gpTotalIn, color: '#3b82f6', icon: <ArrowDownLeft size={16} /> },
          { label: 'GP Total Out', value: gpTotalOut, color: '#ef4444', icon: <ArrowUpRight size={16} /> },
          { label: 'GP Remaining', value: Math.max(0, gpTotalIn - gpTotalOut), color: '#10b981', icon: <Layers size={16} /> },
        ]).map(c => (
          <div key={c.label}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', boxShadow: 'var(--box-shadow)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.label}</p>
              <span style={{ color: c.color, opacity: 0.7 }}>{c.icon}</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: c.color, margin: 0 }}>{Number(c.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Read-only notice */}
      {(activeTab === 'APPROVED_CARGO' || activeTab === 'PRODUCTS') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
          <Lock size={13} />
          {activeTab === 'APPROVED_CARGO'
            ? 'Port-approved goods are read-only. Quantities reflect Management approval. OUT movements are tracked via the stock ledger.'
            : 'Company product stock is read-only. Adjust through production or management workflows.'}
        </div>
      )}

      {/* Search / filter bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 10, boxShadow: 'var(--box-shadow)' }}>
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, code, supplier…"
            style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
        </div>
        {activeTab === 'PRODUCTS' && (
          <SearchableDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: 'All', label: 'All Status' }, { value: 'In Stock', label: 'In Stock' }, { value: 'Low Stock', label: 'Low Stock' }, { value: 'Out of Stock', label: 'Out of Stock' }]}
            className="shrink-0 w-40"
          />
        )}
        {activeTab === 'APPROVED_CARGO' && (
          <>
            <SearchableDropdown
              value={cargoSort.field}
              onChange={v => setCargoSort(s => ({ ...s, field: v as keyof ApprovedCargo }))}
              options={[
                { value: 'productName', label: 'Sort: Product' },
                { value: 'goodsCode', label: 'Sort: Code' },
                { value: 'quantity', label: 'Sort: IN Qty' },
                { value: 'supplier', label: 'Sort: Supplier' },
                { value: 'portOfOrigin', label: 'Sort: Origin' },
                { value: 'destination', label: 'Sort: Destination' },
                { value: 'approvedAt', label: 'Sort: Approved On' },
              ]}
              className="shrink-0 w-40"
            />
            <button onClick={() => setCargoSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
              title="Toggle sort direction"
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              {cargoSort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </>
        )}
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
        <button onClick={() => {
          const data = activeTab === 'APPROVED_CARGO'
            ? filteredCargo.map(c => { const out = getLedgerSince(c.productName, c.approvedAt).totalOut; return { Product: c.productName, Code: c.goodsCode, IN: c.quantity, OUT: out, Remaining: Math.max(0, c.quantity - out), Unit: c.unit, Supplier: c.supplier, Origin: c.portOfOrigin, Destination: c.destination, 'Approved On': fmtDate(c.approvedAt) }; })
            : activeTab === 'PRODUCTS'
              ? filteredStock.map(s => ({ Product: s.name, SKU: s.sku, Category: s.category, IN: getLedger(s.name).totalIn, OUT: getLedger(s.name).totalOut, Remaining: s.current, Capacity: s.capacity }))
              : filteredGP.map(gp => ({ Item: gp.itemName, Code: gp.itemCode, Category: gp.category, IN: gp.quantity, OUT: getLedger(gp.itemName).totalOut, Remaining: Number(gp.quantity) - (getLedger(gp.itemName).totalOut), 'Date Received': gp.dateReceived }));
          exportToCSV(data as any[], Object.keys(data[0] || {}), `stock_${activeTab.toLowerCase()}`);
        }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Main table card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 24px', marginBottom: 24, boxShadow: 'var(--box-shadow)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading stock…</div>
        ) : activeTab === 'APPROVED_CARGO' ? (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Port-Approved Goods</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>Goods received from port and approved by Management. Click any row for history.</p>
            <ResponsiveDataView<ApprovedCargo>
              columns={[
                { key: 'productName', label: 'Product', primary: true },
                { key: 'goodsCode', label: 'Code', render: c => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.goodsCode}</span> },
                { key: 'quantity', label: 'IN (Approved Qty)', render: c => <span style={{ fontWeight: 700, color: '#3b82f6' }}>{c.quantity.toLocaleString()} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{c.unit}</span></span> },
                {
                  key: 'out', label: 'OUT (Dispatched)', render: c => {
                    const out = getLedgerSince(c.productName, c.approvedAt).totalOut;
                    return <span style={{ fontWeight: 700, color: '#ef4444' }}>{out > 0 ? out.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</span>;
                  }
                },
                {
                  key: 'remaining', label: 'Remaining', status: true, render: c => {
                    const out = getLedgerSince(c.productName, c.approvedAt).totalOut;
                    const remaining = Math.max(0, c.quantity - out);
                    return <span style={{ fontWeight: 700, color: remaining === 0 ? '#ef4444' : '#10b981' }}>{remaining.toLocaleString()}</span>;
                  }
                },
                { key: 'supplier', label: 'Supplier' },
                { key: 'portOfOrigin', label: 'Origin' },
                { key: 'destination', label: 'Destination' },
                { key: 'approvedAt', label: 'Approved On', render: c => fmtDate(c.approvedAt) },
              ]}
              data={filteredCargo}
              rowKey={c => c.id}
              onRowClick={c => setSelectedCargo(c)}
              emptyIcon={<Package size={32} />}
              emptyTitle="No approved port goods"
            />
          </>
        ) : activeTab === 'PRODUCTS' ? (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Company Products — Finished Goods</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>Goods produced by the company and added to stock. Click a row for full movement history.</p>
            {/* Stock level bars */}
            {filteredStock.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {filteredStock.slice(0, 6).map(s => {
                  const pct = s.capacity > 0 ? Math.round((s.current / s.capacity) * 100) : 0;
                  const st = stockStatus(s.current, s.capacity);
                  return (
                    <div key={s.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{s.name}</span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: '#3b82f6' }}>IN {(getLedger(s.name).totalIn).toLocaleString()}</span>
                          <span style={{ fontSize: 10, color: '#ef4444' }}>OUT {(getLedger(s.name).totalOut).toLocaleString()}</span>
                          <span style={{ fontSize: 10, background: st.bg, color: st.color, borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>{st.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.current.toLocaleString()} / {s.capacity.toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{ height: 7, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor(s.current, s.capacity), borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <ResponsiveDataView<typeof filteredStock[number]>
              columns={[
                { key: 'name', label: 'Product', primary: true },
                { key: 'sku', label: 'SKU', render: s => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.sku}</span> },
                { key: 'category', label: 'Category' },
                { key: 'in', label: 'IN (Produced)', render: s => { const totalIn = getLedger(s.name).totalIn; return <span style={{ fontWeight: 700, color: '#3b82f6' }}>{totalIn > 0 ? totalIn.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</span>; } },
                { key: 'out', label: 'OUT (Sold)', render: s => { const totalOut = getLedger(s.name).totalOut; return <span style={{ fontWeight: 700, color: '#ef4444' }}>{totalOut > 0 ? totalOut.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</span>; } },
                { key: 'current', label: 'Remaining', render: s => <span style={{ fontWeight: 700, color: s.current === 0 ? '#ef4444' : '#10b981' }}>{s.current.toLocaleString()}</span> },
                { key: 'capacity', label: 'Capacity', render: s => s.capacity.toLocaleString() },
                {
                  key: 'status', label: 'Status', status: true, render: s => {
                    const st = stockStatus(s.current, s.capacity);
                    return <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{st.label}</span>;
                  }
                },
              ]}
              data={filteredStock}
              rowKey={s => s.id}
              onRowClick={s => setSelectedStock(s)}
              emptyIcon={<Package size={32} />}
              emptyTitle="No company products in stock"
            />
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>General Purchased Items</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>Raw materials, consumables and misc. purchases. Click a row to trace usage history.</p>
            <ResponsiveDataView<GeneralPurchase>
              columns={[
                { key: 'itemName', label: 'Item Name', primary: true },
                { key: 'itemCode', label: 'Code', render: gp => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{gp.itemCode}</span> },
                { key: 'category', label: 'Category' },
                { key: 'in', label: 'IN (Received)', render: gp => <span style={{ fontWeight: 700, color: '#3b82f6' }}>{Number(gp.quantity ?? 0).toLocaleString()}</span> },
                {
                  key: 'out', label: 'OUT (Used)', render: gp => {
                    const gpOut = getLedger(gp.itemName).totalOut;
                    return <span style={{ fontWeight: 700, color: '#ef4444' }}>{gpOut > 0 ? gpOut.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</span>;
                  }
                },
                {
                  key: 'remaining', label: 'Remaining', status: true, render: gp => {
                    const gpIn = Number(gp.quantity ?? 0);
                    const gpOut = getLedger(gp.itemName).totalOut;
                    const gpRemaining = Math.max(0, gpIn - gpOut);
                    return <span style={{ fontWeight: 700, color: gpRemaining === 0 ? '#ef4444' : '#10b981' }}>{gpRemaining.toLocaleString()}</span>;
                  }
                },
                { key: 'dateReceived', label: 'Date Received' },
              ]}
              data={filteredGP}
              rowKey={gp => gp.id}
              onRowClick={gp => setSelectedGP(gp)}
              emptyIcon={<Package size={32} />}
              emptyTitle="No general purchases yet"
              renderActions={gp => (
                <button onClick={() => { setAdjustTarget(gp); setShowAdjust(true); }}
                  style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Adjust
                </button>
              )}
            />
          </>
        )}
      </div>

      {/* Global Movement History log */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 24px', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <History size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Stock Movements</h2>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>Latest 20 entries across all products</span>
        </div>
        <MovementHistory
          entries={[...ledgerEntries]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)}
        />
      </div>

      {/* ── DETAIL PANELS ── */}
      {selectedCargo && (() => {
        const { totalOut: out, entries } = getLedgerSince(selectedCargo.productName, selectedCargo.approvedAt);
        const remaining = Math.max(0, selectedCargo.quantity - out);
        return (
          <EntityDetailPanel
            title={selectedCargo.productName}
            subtitle={`${selectedCargo.portOfOrigin} → ${selectedCargo.destination}`}
            badgeText="PORT APPROVED"
            badgeStyle={{ background: '#dbeafe', color: '#1e40af' }}
            fields={[
              { label: 'Goods Code', value: selectedCargo.goodsCode, highlight: true },
              { label: 'IN (Approved Qty)', value: `${selectedCargo.quantity.toLocaleString()} ${selectedCargo.unit}`, highlight: true },
              { label: 'OUT (Dispatched)', value: out > 0 ? `${out.toLocaleString()} ${selectedCargo.unit}` : '—' },
              { label: 'REMAINING', value: `${remaining.toLocaleString()} ${selectedCargo.unit}` },
              { label: 'Supplier', value: selectedCargo.supplier },
              { label: 'Port of Origin', value: selectedCargo.portOfOrigin },
              { label: 'Destination', value: selectedCargo.destination },
              { label: 'Approved By', value: selectedCargo.approvedBy },
              { label: 'Approved On', value: fmtDate(selectedCargo.approvedAt) },
            ]}
            onClose={() => setSelectedCargo(null)}
            actions={<button onClick={() => setSelectedCargo(null)} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>}
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                <FileText size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Stock Movement History
              </p>
              <MovementHistory entries={entries} />
              {entries.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                  No ledger movements recorded for this item yet.
                </div>
              )}
            </div>
          </EntityDetailPanel>
        );
      })()}

      {selectedStock && (() => {
        const st = stockStatus(selectedStock.current, selectedStock.capacity);
        const pct = selectedStock.capacity > 0 ? Math.round((selectedStock.current / selectedStock.capacity) * 100) : 0;
        const totalIn = getLedger(selectedStock.name).totalIn;
        const totalOut = getLedger(selectedStock.name).totalOut;
        const entries = getLedger(selectedStock.name).entries;
        return (
          <EntityDetailPanel
            title={selectedStock.name}
            subtitle={selectedStock.category}
            badgeText={st.label}
            badgeStyle={{ background: st.bg, color: st.color }}
            fields={[
              { label: 'SKU', value: selectedStock.sku, highlight: true },
              { label: 'IN (Total Produced)', value: totalIn > 0 ? `${totalIn.toLocaleString()} units` : '—', highlight: true },
              { label: 'OUT (Total Sold)', value: totalOut > 0 ? `${totalOut.toLocaleString()} units` : '—' },
              { label: 'REMAINING (Current)', value: `${selectedStock.current.toLocaleString()} units` },
              { label: 'Capacity', value: `${selectedStock.capacity.toLocaleString()} units` },
              { label: 'Fill Level', value: `${pct}%` },
            ]}
            onClose={() => setSelectedStock(null)}
            actions={<button onClick={() => setSelectedStock(null)} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>}
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                <Truck size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Full Movement Trace
              </p>
              <MovementHistory entries={entries} />
            </div>
          </EntityDetailPanel>
        );
      })()}

      {selectedGP && (() => {
        const gpIn = Number(selectedGP.quantity ?? 0);
        const gpOut = getLedger(selectedGP.itemName).totalOut;
        const gpRemaining = Math.max(0, gpIn - gpOut);
        const entries = getLedger(selectedGP.itemName).entries;
        return (
          <EntityDetailPanel
            title={selectedGP.itemName}
            subtitle={selectedGP.category}
            badgeText="APPROVED"
            badgeStyle={{ background: '#d1fae5', color: '#065f46' }}
            fields={[
              { label: 'Item Code', value: selectedGP.itemCode, highlight: true },
              { label: 'IN (Received)', value: `${gpIn.toLocaleString()} units`, highlight: true },
              { label: 'OUT (Used)', value: gpOut > 0 ? `${gpOut.toLocaleString()} units` : '—' },
              { label: 'REMAINING', value: `${gpRemaining.toLocaleString()} units` },
              { label: 'Date Received', value: selectedGP.dateReceived },
            ]}
            onClose={() => setSelectedGP(null)}
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAdjustTarget(selectedGP); setShowAdjust(true); setSelectedGP(null); }}
                  style={{ padding: '8px 14px', background: 'var(--accent-light)', border: '1px solid var(--accent)', borderRadius: 10, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Adjust Qty</button>
                <button onClick={() => setSelectedGP(null)}
                  style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>
              </div>
            }
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                <History size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Usage & Adjustment History
              </p>
              <MovementHistory entries={entries} />
            </div>
          </EntityDetailPanel>
        );
      })()}

      {/* Adjust GP modal */}
      <SidePanel
        open={showAdjust}
        onClose={() => { setShowAdjust(false); setAdjustTarget(null); }}
        title="Adjust Stock Quantity"
        footer={
          <>
            <button onClick={() => { setShowAdjust(false); setAdjustTarget(null); setAdjustForm({ type: 'Add', quantity: '', reason: '', notes: '' }); }} disabled={submitting}
              style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, opacity: submitting ? 0.5 : 1 }}>Cancel</button>
            <button onClick={doAdjustGP} disabled={!adjustTarget || !adjustForm.quantity || submitting}
              style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14, opacity: (!adjustTarget || !adjustForm.quantity || submitting) ? 0.5 : 1 }}>{submitting ? 'Applying...' : 'Apply'}</button>
          </>
        }
      >
            {!adjustTarget && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Select Item</label>
                <SearchableDropdown
                  value=""
                  onChange={v => { const gp = generalPurchases.find(x => x.id === v); setAdjustTarget(gp || null); }}
                  placeholder="Select item…"
                  options={generalPurchases.map(gp => ({ value: gp.id, label: gp.itemName, sublabel: `current: ${gp.quantity}` }))}
                />
              </div>
            )}
            {adjustTarget && (
              <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{adjustTarget.itemName}</strong>. Current qty: <strong>{adjustTarget.quantity}</strong>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Adjustment Type</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Add', 'Remove'].map(t => (
                  <button key={t} onClick={() => setAdjustForm(f => ({ ...f, type: t }))}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${adjustForm.type === t ? 'var(--accent)' : 'var(--border)'}`, background: adjustForm.type === t ? 'var(--accent-light)' : 'var(--bg-input)', color: adjustForm.type === t ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>{t}</button>
                ))}
              </div>
            </div>
            {[
              { label: 'Quantity', key: 'quantity', placeholder: 'e.g. 50', type: 'number' },
              { label: 'Reason / Reference', key: 'reason', placeholder: 'e.g. Used in production, shipment, etc.' },
              { label: 'Notes (optional)', key: 'notes', placeholder: 'Who received it, where it went…' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{f.label}</label>
                <input type={f.type ?? 'text'} value={(adjustForm as Record<string, string>)[f.key]} onChange={e => setAdjustForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
      </SidePanel>

      <StockIntakeForm
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        addNotification={addNotification}
        onSuccess={loadData}
      />
    </div>
  );
}
