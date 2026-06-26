import { useState, useEffect } from 'react';
import { Search, Plus, X, MoreVertical, Package, TrendingDown, TrendingUp, History, Download, Printer, Lock, ChevronUp, ChevronDown, ArrowUpRight } from 'lucide-react';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';
import { stockApi, operations } from '../../services/apiClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
import { supabase } from '../../lib/supabaseClient';
import type { IncomingGoods, GeneralPurchase } from '../../types/erp';
import StockIntakeForm from '../../components/StockIntakeForm';

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
  quantity: number;
  unit: string;
  weight: number;
  supplier: string;
  portOfOrigin: string;
  approvedAt: string;
}

interface StockMovement {
  id: string;
  productName: string;
  change: number;
  reason: string;
  updatedBy: string;
  date: string;
}

type ActiveTab = 'APPROVED_CARGO' | 'PRODUCTS' | 'GENERAL_PURCHASES';

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

const fmt = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface Props { incomingGoodsList: IncomingGoods[]; addNotification: (msg: string) => void }

export default function StockView({ incomingGoodsList: _incomingGoodsList, addNotification }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('APPROVED_CARGO');
  const [approvedCargo, setApprovedCargo] = useState<ApprovedCargo[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [generalPurchases, setGeneralPurchases] = useState<GeneralPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Adjust stock (General Purchases only)
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<GeneralPurchase | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'Add', quantity: '', reason: '', notes: '' });

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<ApprovedCargo | null>(null);
  const [cargoSort, setCargoSort] = useState<{ field: keyof ApprovedCargo; dir: 'asc' | 'desc' }>({ field: 'approvedAt', dir: 'desc' });

  const loadData = async () => {
    setLoading(true);
    try {
      // Tab 1: cargo_intake APPROVED
      const { data: cargoData } = await supabase
        .from('cargo_intake')
        .select('*')
        .eq('status', 'APPROVED')
        .order('updated_at', { ascending: false })
        .limit(200);
      setApprovedCargo((cargoData || []).map((r: any) => ({
        id: String(r.id),
        productName: r.description || r.product_name || r.productName || 'Unknown',
        goodsCode: r.request_id || r.id,
        quantity: Number(r.quantity ?? 0),
        unit: r.unit || 'units',
        weight: Number(r.weight_kg ?? r.weight ?? 0),
        supplier: r.supplier_name || r.company || '—',
        portOfOrigin: r.port_of_origin || r.country || '—',
        approvedAt: r.updated_at || r.created_at || '',
      })));

      // Tab 2: stock table (company products — exclude INCOMING_GOODS)
      const [stockData, movementsData] = await Promise.all([
        stockApi.getStock(),
        stockApi.getStockMovements(),
      ]);
      setStock(stockData.filter((s: StockItem) => s.category !== 'INCOMING_GOODS'));
      setMovements(movementsData);

      // Tab 3: general purchases APPROVED
      const gpData = await operations.getGeneralPurchases();
      setGeneralPurchases((gpData || []).filter((gp: any) => gp.status === 'APPROVED'));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // KPI values
  const totalApprovedQty = approvedCargo.reduce((sum, c) => sum + c.quantity, 0);
  const totalProducts = stock.length;
  const lowStock = stock.filter(s => s.current > 0 && s.capacity > 0 && s.current / s.capacity < 0.2).length;
  const inStock = stock.filter(s => s.current > 0).length;

  // Sorted cargo
  const sortedCargo = [...approvedCargo].sort((a, b) => {
    const va = a[cargoSort.field], vb = b[cargoSort.field];
    const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb));
    return cargoSort.dir === 'asc' ? cmp : -cmp;
  });

  const toggleCargoSort = (field: keyof ApprovedCargo) => {
    setCargoSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  };

  const SortIcon = ({ field }: { field: keyof ApprovedCargo }) => {
    if (cargoSort.field !== field) return <span style={{ color: 'var(--text-muted)', opacity: 0.4, fontSize: 10 }}>↕</span>;
    return cargoSort.dir === 'asc' ? <ChevronUp size={12} style={{ color: 'var(--accent)' }} /> : <ChevronDown size={12} style={{ color: 'var(--accent)' }} />;
  };

  // Filtered lists
  const filteredCargo = sortedCargo.filter(c => {
    const q = search.toLowerCase();
    return !search || c.productName.toLowerCase().includes(q) || c.goodsCode.toLowerCase().includes(q) || c.supplier.toLowerCase().includes(q);
  });

  const filteredStock = stock.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q);
    const st = stockStatus(s.current, s.capacity);
    const matchStatus = statusFilter === 'All' || st.label === statusFilter;
    let matchDate = true;
    if (startDate) matchDate = matchDate && new Date(s.updatedAt) >= new Date(startDate + 'T00:00:00');
    if (endDate) matchDate = matchDate && new Date(s.updatedAt) <= new Date(endDate + 'T23:59:59');
    return matchSearch && matchStatus && matchDate;
  });

  const filteredGP = generalPurchases.filter(gp => {
    const q = search.toLowerCase();
    const matchSearch = !search || gp.itemName.toLowerCase().includes(q) || gp.itemCode.toLowerCase().includes(q);
    let matchDate = true;
    if (startDate) matchDate = matchDate && new Date(gp.dateReceived) >= new Date(startDate);
    if (endDate) matchDate = matchDate && new Date(gp.dateReceived) <= new Date(endDate);
    return matchSearch && matchDate;
  });

  const filteredMovements = movements.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !search || m.productName.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q);
    let matchDate = true;
    if (startDate) matchDate = matchDate && new Date(m.date) >= new Date(startDate + 'T00:00:00');
    if (endDate) matchDate = matchDate && new Date(m.date) <= new Date(endDate + 'T23:59:59');
    return matchSearch && matchDate;
  });

  const doAdjustGP = async () => {
    if (!adjustTarget || !adjustForm.quantity) return;
    const delta = adjustForm.type === 'Add' ? parseInt(adjustForm.quantity) : -parseInt(adjustForm.quantity);
    const newQty = Math.max(0, Number(adjustTarget.quantity) + delta);
    try {
      await supabase.from('general_purchases').update({ quantity: newQty, notes: adjustForm.notes || adjustTarget.itemName }).eq('id', adjustTarget.id);
      await supabase.from('stock_ledger').insert({
        product_name: adjustTarget.itemName,
        movement_type: adjustForm.type === 'Add' ? 'ADD' : 'REMOVE',
        quantity: Math.abs(delta),
        reference: adjustForm.reason || 'Manual Adjustment',
        notes: adjustForm.notes || '',
        created_at: new Date().toISOString(),
      });
      addNotification(`${adjustTarget.itemName} quantity adjusted by ${delta > 0 ? '+' : ''}${delta}.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust.');
    }
    setShowAdjust(false);
    setAdjustTarget(null);
    setAdjustForm({ type: 'Add', quantity: '', reason: '', notes: '' });
  };

  const TABS: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'APPROVED_CARGO', label: 'Approved Port Stock', count: approvedCargo.length },
    { key: 'PRODUCTS', label: 'Company Products (Finished Goods)', count: totalProducts },
    { key: 'GENERAL_PURCHASES', label: 'General Purchased Items', count: filteredGP.length },
  ];

  const tabStyle = (key: ActiveTab) => ({
    background: 'none',
    border: 'none',
    borderBottom: activeTab === key ? '3px solid var(--accent)' : '3px solid transparent',
    color: activeTab === key ? 'var(--accent)' : 'var(--text-muted)',
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Stock Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Monitor and manage inventory levels</p>
        </div>
        {activeTab === 'GENERAL_PURCHASES' && (
          <button onClick={() => setShowAdjust(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            <Plus size={16} /> Adjust Stock
          </button>
        )}
        {activeTab === 'PRODUCTS' && (
          <button onClick={() => setShowAddProduct(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            <Plus size={16} /> Log Stock Intake
          </button>
        )}
      </div>

      {/* KPI Cards — all clickable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {([
          { label: 'Port Approved Goods', value: totalApprovedQty.toLocaleString(), sub: `${approvedCargo.length} product${approvedCargo.length !== 1 ? 's' : ''} approved`, color: '#3b82f6', icon: <Package size={18} />, tab: 'APPROVED_CARGO' as ActiveTab },
          { label: 'Company Product SKUs', value: totalProducts, sub: 'Finished goods in stock', color: 'var(--accent)', icon: <Package size={18} />, tab: 'PRODUCTS' as ActiveTab },
          { label: 'Low Stock Items', value: lowStock, sub: 'Below 20% capacity', color: '#f59e0b', icon: <TrendingDown size={18} />, tab: 'PRODUCTS' as ActiveTab, filter: 'Low Stock' },
          { label: 'In Stock (Products)', value: inStock, sub: 'Products with stock', color: '#10b981', icon: <TrendingUp size={18} />, tab: 'PRODUCTS' as ActiveTab, filter: 'In Stock' },
        ] as { label: string; value: string | number; sub: string; color: string; icon: React.ReactNode; tab: ActiveTab; filter?: string }[]).map(c => (
          <div key={c.label} onClick={() => { setActiveTab(c.tab); if (c.filter) setStatusFilter(c.filter); setSearch(''); }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--box-shadow)', cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c.color; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${c.color}22`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--box-shadow)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{c.label}</p>
              <div style={{ color: c.color, opacity: 0.7 }}>{c.icon}</div>
            </div>
            <p style={{ fontSize: 28, fontWeight: 700, color: c.color, margin: '0 0 4px' }}>{c.value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{c.sub}</p>
            <ArrowUpRight size={12} style={{ position: 'absolute', bottom: 12, right: 12, color: c.color, opacity: 0.5 }} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={tabStyle(t.key)}>
            {t.label}
            <span style={{ marginLeft: 6, background: activeTab === t.key ? 'var(--accent)' : 'var(--bg-input)', color: activeTab === t.key ? '#fff' : 'var(--text-muted)', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Read-only notice for port stock and company products */}
      {(activeTab === 'APPROVED_CARGO' || activeTab === 'PRODUCTS') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
          <Lock size={13} />
          {activeTab === 'APPROVED_CARGO'
            ? 'Port-approved stock is read-only. Quantities are set by Management approval and cannot be manually adjusted.'
            : 'Company product stock is read-only. Adjustments must go through production or management approval workflows.'}
        </div>
      )}

      {/* Search / Filter bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, boxShadow: 'var(--box-shadow)' }}>
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or SKU..." style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
        </div>
        {activeTab === 'PRODUCTS' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '0 0 150px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }}>
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        )}
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
        <button onClick={() => {
          const data = activeTab === 'APPROVED_CARGO' ? filteredCargo : activeTab === 'PRODUCTS' ? filteredStock : filteredGP;
          exportToCSV(data as any[], Object.keys(data[0] || {}), `stock_${activeTab.toLowerCase()}`);
        }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
          <Download size={14} /> CSV
        </button>
        <button onClick={() => {
          const data = activeTab === 'APPROVED_CARGO' ? filteredCargo : activeTab === 'PRODUCTS' ? filteredStock : filteredGP;
          exportToPDF(`Stock — ${activeTab}`, data as any[], Object.keys(data[0] || {}));
        }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
          <Printer size={14} /> PDF
        </button>
      </div>

      {/* Tab content */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 24px', marginBottom: 24, boxShadow: 'var(--box-shadow)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading stock…</div>
        ) : activeTab === 'APPROVED_CARGO' ? (
          <>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Port-Approved Goods ({filteredCargo.length})</h2>
            {/* Stock level bars */}
            {filteredCargo.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {filteredCargo.slice(0, 5).map(c => (
                  <div key={c.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{c.productName}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.quantity.toLocaleString()} {c.unit}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (c.quantity / Math.max(...filteredCargo.map(x => x.quantity), 1)) * 100)}%`, background: '#3b82f6', borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {([
                      { label: 'Product', field: 'productName' as keyof ApprovedCargo },
                      { label: 'Code', field: 'goodsCode' as keyof ApprovedCargo },
                      { label: 'Quantity', field: 'quantity' as keyof ApprovedCargo },
                      { label: 'Unit', field: 'unit' as keyof ApprovedCargo },
                      { label: 'Weight (kg)', field: 'weight' as keyof ApprovedCargo },
                      { label: 'Supplier', field: 'supplier' as keyof ApprovedCargo },
                      { label: 'Port of Origin', field: 'portOfOrigin' as keyof ApprovedCargo },
                      { label: 'Approved On', field: 'approvedAt' as keyof ApprovedCargo },
                    ]).map(h => (
                      <th key={h.label} onClick={() => toggleCargoSort(h.field)}
                        style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{h.label} <SortIcon field={h.field} /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCargo.map(c => (
                    <tr key={c.id} onClick={() => setSelectedCargo(c)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--accent-light)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                      <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.productName}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{c.goodsCode}</td>
                      <td style={{ padding: '11px 12px', fontWeight: 700, color: '#3b82f6' }}>{c.quantity.toLocaleString()}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{c.unit}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{Number(c.weight).toLocaleString()}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{c.supplier}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{c.portOfOrigin}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.approvedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCargo.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No approved port goods yet</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Goods approved by Management will appear here</p>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'PRODUCTS' ? (
          <>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Company Products — Finished Goods ({filteredStock.length})</h2>
            {filteredStock.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {filteredStock.map(s => {
                  const pct = s.capacity > 0 ? Math.round((s.current / s.capacity) * 100) : 0;
                  const st = stockStatus(s.current, s.capacity);
                  return (
                    <div key={s.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{s.name}</span>
                          <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(Number(s.current ?? 0)).toLocaleString()} / {(Number(s.capacity ?? 0)).toLocaleString()} units</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor(s.current, s.capacity), borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Product', 'SKU', 'Category', 'Current', 'Capacity', 'Last Updated', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map(s => {
                    const st = stockStatus(s.current, s.capacity);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelectedStockItem(s)}>
                        <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                        <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{s.sku}</td>
                        <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{s.category}</td>
                        <td style={{ padding: '11px 12px', fontWeight: 700, color: barColor(s.current, s.capacity) }}>{(Number(s.current ?? 0)).toLocaleString()}</td>
                        <td style={{ padding: '11px 12px', color: 'var(--text-muted)' }}>{(Number(s.capacity ?? 0)).toLocaleString()}</td>
                        <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(s.updatedAt)}</td>
                        <td style={{ padding: '11px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredStock.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No company products in stock</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Finished goods from production will appear here</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>General Purchased Items ({filteredGP.length})</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Item Name', 'Item Code', 'Category', 'Quantity', 'Cost (GHS)', 'Date Received', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGP.map(gp => (
                    <tr key={gp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{gp.itemName}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{gp.itemCode}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{gp.category}</td>
                      <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{(Number(gp.quantity ?? 0)).toLocaleString()}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>₵{Number(gp.cost ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{gp.dateReceived}</td>
                      <td style={{ padding: '11px 12px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenu(openMenu === gp.id ? null : gp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                          <MoreVertical size={16} />
                        </button>
                        {openMenu === gp.id && (
                          <div style={{ position: 'absolute', right: 0, top: 36, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 140 }}>
                            <button type="button" onClick={() => { setAdjustTarget(gp); setShowAdjust(true); setOpenMenu(null); }}
                              style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', fontWeight: 500 }}>
                              Adjust Quantity
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredGP.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>No general purchases yet</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Approved purchases from Management will appear here</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stock Movement History */}
      <div id="movement-history" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 24px', boxShadow: 'var(--box-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <History size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Stock Movement History</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Date', 'Product', 'Change', 'Reason', 'Updated By'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>No movement history yet</td></tr>
              ) : filteredMovements.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(m.date)}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.productName}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: m.change > 0 ? '#10b981' : '#f43f5e' }}>{m.change > 0 ? `+${m.change}` : m.change}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{m.reason}</td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{m.updatedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust General Purchase Modal */}
      {showAdjust && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Adjust Quantity</h2>
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
                  <button type="button" key={t} onClick={() => setAdjustForm(f => ({ ...f, type: t }))}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${adjustForm.type === t ? 'var(--accent)' : 'var(--border)'}`, background: adjustForm.type === t ? 'var(--accent-light)' : 'var(--bg-input)', color: adjustForm.type === t ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>{t}</button>
                ))}
              </div>
            </div>
            {[
              { label: 'Quantity', key: 'quantity', placeholder: 'e.g. 50', type: 'number' },
              { label: 'Reason', key: 'reason', placeholder: 'e.g. Received extra shipment' },
              { label: 'Notes (optional)', key: 'notes', placeholder: 'Any additional notes…' },
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

      {selectedCargo && (
        <EntityDetailPanel
          title={selectedCargo.productName}
          subtitle={selectedCargo.supplier}
          badgeText="APPROVED"
          badgeStyle={{ background: '#d1fae5', color: '#065f46' }}
          fields={[
            { label: 'Goods Code', value: selectedCargo.goodsCode, highlight: true },
            { label: 'Quantity', value: `${selectedCargo.quantity.toLocaleString()} ${selectedCargo.unit}`, highlight: true },
            { label: 'Weight', value: `${Number(selectedCargo.weight).toLocaleString()} kg` },
            { label: 'Supplier', value: selectedCargo.supplier },
            { label: 'Port of Origin', value: selectedCargo.portOfOrigin },
            { label: 'Approved On', value: fmtDate(selectedCargo.approvedAt) },
          ]}
          onClose={() => setSelectedCargo(null)}
          actions={
            <button onClick={() => setSelectedCargo(null)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>
          }
        />
      )}

      {selectedStockItem && (() => {
        const st = stockStatus(selectedStockItem.current, selectedStockItem.capacity);
        const pct = selectedStockItem.capacity > 0 ? Math.round((selectedStockItem.current / selectedStockItem.capacity) * 100) : 0;
        const itemMovements = movements.filter(m => m.productName === selectedStockItem.name).slice(0, 5);
        return (
          <EntityDetailPanel
            title={selectedStockItem.name}
            subtitle={selectedStockItem.category}
            badgeText={st.label}
            badgeStyle={{ background: st.bg, color: st.color }}
            fields={[
              { label: 'SKU', value: selectedStockItem.sku, highlight: true },
              { label: 'Current Stock', value: `${(Number(selectedStockItem.current ?? 0)).toLocaleString()} units`, highlight: true },
              { label: 'Category', value: selectedStockItem.category },
              { label: 'Capacity', value: `${(Number(selectedStockItem.capacity ?? 0)).toLocaleString()} units` },
              { label: 'Fill Level', value: `${pct}%` },
              { label: 'Last Updated', value: fmt(selectedStockItem.updatedAt) },
            ]}
            onClose={() => setSelectedStockItem(null)}
            actions={
              <button onClick={() => setSelectedStockItem(null)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>
            }
          >
            {itemMovements.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recent Movements</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {itemMovements.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.reason}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.change >= 0 ? '#10b981' : '#ef4444' }}>{m.change >= 0 ? '+' : ''}{m.change}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </EntityDetailPanel>
        );
      })()}
    </div>
  );
}
