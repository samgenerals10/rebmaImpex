import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, X, Package, TrendingDown, TrendingUp,
  History, Download, Lock, ChevronUp, ChevronDown, ArrowUpRight,
  ArrowDownLeft, Layers, Truck, User, FileText,
} from 'lucide-react';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';
import { stockApi, operations } from '../../services/apiClient';
import { exportToCSV } from '../../utils/export';
import { supabase } from '../../lib/supabaseClient';
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('APPROVED_CARGO');
  const [approvedCargo, setApprovedCargo] = useState<ApprovedCargo[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [generalPurchases, setGeneralPurchases] = useState<GeneralPurchase[]>([]);
  const [ledgerMap, setLedgerMap] = useState<LedgerMap>({});
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
      for (const r of (ledgerData || [])) {
        const rawName: string = r.product_name || '';
        if (!rawName) continue;
        const key = rawName.toLowerCase().trim();
        if (!rawMap[key]) rawMap[key] = { totalIn: 0, totalOut: 0, entries: [], canonical: rawName };
        const qty = Number(r.quantity ?? 0);
        const entry: LedgerEntry = {
          id: String(r.id),
          productName: rawName,
          movementType: r.movement_type as 'ADD' | 'REMOVE',
          quantity: qty,
          reference: r.reference || '',
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
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── derived totals ───────────────────────────────────────────────────────
  const cargoTotalIn = approvedCargo.reduce((s, c) => s + c.quantity, 0);
  // Try both original and lowercase key for case-insensitive lookup
  const getLedger = (name: string) => ledgerMap[name] ?? ledgerMap[name.toLowerCase().trim()] ?? { totalIn: 0, totalOut: 0, entries: [] };
  const cargoTotalOut = approvedCargo.reduce((s, c) => s + (getLedger(c.productName).totalOut), 0);

  const productsTotalIn = stock.reduce((s, p) => s + (getLedger(p.name).totalIn), 0);
  const productsTotalOut = stock.reduce((s, p) => s + (getLedger(p.name).totalOut), 0);
  const productsRemaining = stock.reduce((s, p) => s + p.current, 0);

  const gpTotalIn = generalPurchases.reduce((s, gp) => s + Number(gp.quantity ?? 0), 0);
  const gpTotalOut = generalPurchases.reduce((s, gp) => s + (getLedger(gp.itemName).totalOut), 0);

  // ── filter / sort ────────────────────────────────────────────────────────
  const toggleCargoSort = (field: keyof ApprovedCargo) =>
    setCargoSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });

  const SortIcon = ({ field }: { field: keyof ApprovedCargo }) => {
    if (cargoSort.field !== field) return <span style={{ color: 'var(--text-muted)', opacity: 0.4, fontSize: 10 }}>↕</span>;
    return cargoSort.dir === 'asc' ? <ChevronUp size={11} style={{ color: 'var(--accent)' }} /> : <ChevronDown size={11} style={{ color: 'var(--accent)' }} />;
  };

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
    if (!adjustTarget || !adjustForm.quantity) return;
    const delta = adjustForm.type === 'Add' ? parseInt(adjustForm.quantity) : -parseInt(adjustForm.quantity);
    const newQty = Math.max(0, Number(adjustTarget.quantity) + delta);
    try {
      await supabase.from('general_purchases').update({ quantity: newQty }).eq('id', adjustTarget.id).then(() => {}, () => {});
      await supabase.from('stock_ledger').insert({
        product_name: adjustTarget.itemName,
        movement_type: adjustForm.type === 'Add' ? 'ADD' : 'REMOVE',
        quantity: Math.abs(delta),
        reference: adjustForm.reason || 'Manual Adjustment',
        notes: adjustForm.notes || '',
        created_at: new Date().toISOString(),
      }).then(() => {}, () => {});
      addNotification(`${adjustTarget.itemName} adjusted by ${delta > 0 ? '+' : ''}${delta}.`);
      loadData();
    } catch (err: any) { alert(err.message || 'Failed to adjust.'); }
    setShowAdjust(false); setAdjustTarget(null);
    setAdjustForm({ type: 'Add', quantity: '', reason: '', notes: '' });
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

  const th = (label: string, field?: keyof ApprovedCargo) => (
    <th key={label}
      onClick={field ? () => toggleCargoSort(field) : undefined}
      style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.04em', whiteSpace: 'nowrap' as const, cursor: field ? 'pointer' : 'default', userSelect: 'none' as const }}>
      {field ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label} <SortIcon field={field} /></span> : label}
    </th>
  );

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
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ flex: '0 0 150px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }}>
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        )}
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
        <button onClick={() => {
          const data = activeTab === 'APPROVED_CARGO'
            ? filteredCargo.map(c => ({ Product: c.productName, Code: c.goodsCode, IN: c.quantity, OUT: getLedger(c.productName).totalOut, Remaining: c.quantity - (getLedger(c.productName).totalOut), Unit: c.unit, Supplier: c.supplier, Origin: c.portOfOrigin, Destination: c.destination, 'Approved On': fmtDate(c.approvedAt) }))
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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {th('Product', 'productName')}
                    {th('Code', 'goodsCode')}
                    {th('IN (Approved Qty)', 'quantity')}
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>OUT (Dispatched)</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>REMAINING</th>
                    {th('Supplier', 'supplier')}
                    {th('Origin', 'portOfOrigin')}
                    {th('Destination', 'destination')}
                    {th('Approved On', 'approvedAt')}
                  </tr>
                </thead>
                <tbody>
                  {filteredCargo.map(c => {
                    const out = getLedger(c.productName).totalOut;
                    const remaining = Math.max(0, c.quantity - out);
                    return (
                      <tr key={c.id} onClick={() => setSelectedCargo(c)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--accent-light)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.productName}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{c.goodsCode}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#3b82f6' }}>{c.quantity.toLocaleString()} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{c.unit}</span></td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ef4444' }}>{out > 0 ? out.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: remaining === 0 ? '#ef4444' : '#10b981' }}>{remaining.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{c.supplier}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{c.portOfOrigin}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{c.destination}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(c.approvedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCargo.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No approved port goods</p>
                </div>
              )}
            </div>
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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Product', 'SKU', 'Category'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>IN (Produced)</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>OUT (Sold)</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>REMAINING</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Capacity</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map(s => {
                    const st = stockStatus(s.current, s.capacity);
                    const totalIn = getLedger(s.name).totalIn;
                    const totalOut = getLedger(s.name).totalOut;
                    return (
                      <tr key={s.id} onClick={() => setSelectedStock(s)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--accent-light)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>{s.sku}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{s.category}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#3b82f6' }}>{totalIn > 0 ? totalIn.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ef4444' }}>{totalOut > 0 ? totalOut.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: s.current === 0 ? '#ef4444' : '#10b981' }}>{s.current.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.capacity.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredStock.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No company products in stock</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>General Purchased Items</h2>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>Raw materials, consumables and misc. purchases. Click a row to trace usage history.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Item Name', 'Code', 'Category'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>IN (Received)</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>OUT (Used)</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>REMAINING</th>
                    {['Date Received', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGP.map(gp => {
                    const gpIn = Number(gp.quantity ?? 0);
                    const gpOut = getLedger(gp.itemName).totalOut;
                    const gpRemaining = Math.max(0, gpIn - gpOut);
                    return (
                      <tr key={gp.id} onClick={() => setSelectedGP(gp)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--accent-light)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{gp.itemName}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{gp.itemCode}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{gp.category}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#3b82f6' }}>{gpIn.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#ef4444' }}>{gpOut > 0 ? gpOut.toLocaleString() : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: gpRemaining === 0 ? '#ef4444' : '#10b981' }}>{gpRemaining.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{gp.dateReceived}</td>
                        <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={e => { e.stopPropagation(); setAdjustTarget(gp); setShowAdjust(true); }}
                            style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredGP.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No general purchases yet</p>
                </div>
              )}
            </div>
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
          entries={Object.values(ledgerMap).flatMap(v => v.entries)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)}
        />
      </div>

      {/* ── DETAIL PANELS ── */}
      {selectedCargo && (() => {
        const out = getLedger(selectedCargo.productName).totalOut;
        const remaining = Math.max(0, selectedCargo.quantity - out);
        const entries = getLedger(selectedCargo.productName).entries;
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
      {showAdjust && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Adjust Stock Quantity</h2>
              <button onClick={() => { setShowAdjust(false); setAdjustTarget(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            {!adjustTarget && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Select Item</label>
                <select onChange={e => { const gp = generalPurchases.find(x => x.id === e.target.value); setAdjustTarget(gp || null); }}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
                  <option value="">Select item…</option>
                  {generalPurchases.map(gp => <option key={gp.id} value={gp.id}>{gp.itemName} (current: {gp.quantity})</option>)}
                </select>
              </div>
            )}
            {adjustTarget && (
              <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{adjustTarget.itemName}</strong> — Current qty: <strong>{adjustTarget.quantity}</strong>
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
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => { setShowAdjust(false); setAdjustTarget(null); setAdjustForm({ type: 'Add', quantity: '', reason: '', notes: '' }); }}
                style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={doAdjustGP} disabled={!adjustTarget || !adjustForm.quantity}
                style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14, opacity: (!adjustTarget || !adjustForm.quantity) ? 0.5 : 1 }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      <StockIntakeForm
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        addNotification={addNotification}
        onSuccess={loadData}
      />
    </div>
  );
}
