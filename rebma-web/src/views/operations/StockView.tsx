import { useState, useEffect } from 'react';
import { Search, Plus, X, MoreVertical, Package, TrendingDown, TrendingUp, History, Download, Printer } from 'lucide-react';
import EntityDetailPanel from '../../components/global/EntityDetailPanel';
import { stockApi, operations } from '../../services/apiClient';
import { exportToCSV, exportToPDF } from '../../utils/export';
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

interface StockMovement {
  id: string;
  productName: string;
  change: number;
  reason: string;
  updatedBy: string;
  date: string;
}


const stockStatus = (current: number, capacity: number): { label: string; bg: string; color: string } => {
  if (current === 0) return { label: 'Out of Stock', bg: '#ffe4e6', color: '#9f1239' };
  if (current / capacity < 0.2) return { label: 'Low Stock', bg: '#fef3c7', color: '#92400e' };
  return { label: 'In Stock', bg: '#d1fae5', color: '#065f46' };
};

const barColor = (current: number, capacity: number) => {
  if (current === 0) return '#f43f5e';
  if (current / capacity < 0.2) return '#f59e0b';
  return '#10b981';
};

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Props { incomingGoodsList: IncomingGoods[]; addNotification: (msg: string) => void }

export default function StockView({ incomingGoodsList: _incomingGoodsList, addNotification }: Props) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [generalPurchases, setGeneralPurchases] = useState<GeneralPurchase[]>([]);
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'GENERAL_PURCHASES'>('PRODUCTS');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: '', type: 'Add', quantity: '', reason: '', notes: '' });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockData, movementsData, catsData, gpData] = await Promise.all([
        stockApi.getStock(),
        stockApi.getStockMovements(),
        stockApi.getCategories(),
        operations.getGeneralPurchases()
      ]);
      setStock(stockData);
      setMovements(movementsData);
      setCategories(['All', ...catsData.map(c => c.name)]);
      setGeneralPurchases((gpData || []).filter((gp: any) => gp.status === 'APPROVED'));
    } catch (err) {
      console.error(err);
      setStock([]);
      setMovements([]);
      setGeneralPurchases([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSKUs = stock.length;
  const lowStock = stock.filter(s => s.current > 0 && s.current / s.capacity < 0.2).length;
  const inStock = stock.filter(s => s.current > 0).length;
  const totalValue = stock.reduce((acc, s) => acc + s.current * 45.5, 0);

  const handleAddCategory = async () => {
    const name = prompt('Enter new stock category name:');
    if (!name) {
      setCategoryFilter('All');
      return;
    }
    try {
      await stockApi.addCategory(name);
      addNotification(`Category "${name}" added successfully.`);
      const cats = await stockApi.getCategories();
      setCategories(['All', ...cats.map(c => c.name)]);
      setCategoryFilter(name);
    } catch (err: any) {
      alert(err.message || 'Failed to add category.');
      setCategoryFilter('All');
    }
  };

  const filtered = stock.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !search || s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'All' || s.category === categoryFilter;
    const st = stockStatus(s.current, s.capacity);
    const matchStatus = statusFilter === 'All' || st.label === statusFilter;
    
    let matchDate = true;
    if (startDate) {
      matchDate = matchDate && new Date(s.updatedAt) >= new Date(startDate + 'T00:00:00');
    }
    if (endDate) {
      matchDate = matchDate && new Date(s.updatedAt) <= new Date(endDate + 'T23:59:59');
    }
    return matchSearch && matchCat && matchStatus && matchDate;
  });

  const filteredGeneralPurchases = generalPurchases.filter(gp => {
    const q = search.toLowerCase();
    const matchSearch = !search || gp.itemName.toLowerCase().includes(q) || gp.itemCode.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'All' || gp.category.toLowerCase().includes(categoryFilter.toLowerCase());
    
    let matchDate = true;
    if (startDate) {
      matchDate = matchDate && new Date(gp.dateReceived) >= new Date(startDate);
    }
    if (endDate) {
      matchDate = matchDate && new Date(gp.dateReceived) <= new Date(endDate);
    }
    return matchSearch && matchCat && matchDate;
  });

  const filteredMovements = movements.filter((m: StockMovement) => {
    const q = search.toLowerCase();
    const matchSearch = !search || m.productName.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q);
    
    let matchDate = true;
    if (startDate) {
      matchDate = matchDate && new Date(m.date) >= new Date(startDate + 'T00:00:00');
    }
    if (endDate) {
      matchDate = matchDate && new Date(m.date) <= new Date(endDate + 'T23:59:59');
    }
    return matchSearch && matchDate;
  });

  const doAdjust = async () => {
    const item = stock.find(s => s.id === adjustForm.productId);
    if (!item || !adjustForm.quantity) return;
    const delta = adjustForm.type === 'Add' ? parseInt(adjustForm.quantity) : -parseInt(adjustForm.quantity);
    const reasonVal = adjustForm.reason.trim() || 'Manual Adjustment';
    const notesVal = adjustForm.notes.trim() || 'Adjusted via Stock Management';
    
    try {
      await stockApi.adjustStock(item.id, item.name, item.current, delta, reasonVal, notesVal);
      addNotification(`Stock for ${item.name} adjusted by ${delta > 0 ? '+' : ''}${delta}.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock.');
    }
    setShowAdjust(false);
    setAdjustForm({ productId: '', type: 'Add', quantity: '', reason: '', notes: '' });
  };

  const exportStockCSV = () => {
    exportToCSV(
      filtered,
      ['id', 'name', 'sku', 'category', 'current', 'capacity', 'updatedAt'],
      'stock_levels'
    );
  };

  const exportStockPDF = () => {
    exportToPDF(
      'Stock Levels',
      filtered.map(s => ({
        id: s.id,
        name: s.name,
        sku: s.sku,
        category: s.category,
        current: s.current.toLocaleString(),
        capacity: s.capacity.toLocaleString(),
        updatedAt: fmt(s.updatedAt)
      })),
      ['id', 'name', 'sku', 'category', 'current', 'capacity', 'updatedAt']
    );
  };


  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Stock Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Monitor and manage inventory levels</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowAddProduct(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            <Plus size={16} /> Log Stock Intake
          </button>
          <button onClick={() => setShowAdjust(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            <Plus size={16} /> Adjust Stock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'PRODUCTS' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'PRODUCTS' ? 'var(--accent)' : 'var(--text-muted)',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Company Products (Finished Goods)
        </button>
        <button
          onClick={() => setActiveTab('GENERAL_PURCHASES')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'GENERAL_PURCHASES' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'GENERAL_PURCHASES' ? 'var(--accent)' : 'var(--text-muted)',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          General Purchased Items
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total SKUs', value: totalSKUs, color: 'var(--accent)', icon: <Package size={18} /> },
          { label: 'Low Stock', value: lowStock, color: '#f59e0b', icon: <TrendingDown size={18} /> },
          { label: 'In Stock', value: inStock, color: '#10b981', icon: <TrendingUp size={18} /> },
          { label: 'Total Value (GHS)', value: `₵${totalValue.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#8b5cf6', icon: <Package size={18} /> },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', boxShadow: 'var(--box-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{c.label}</p>
              <div style={{ color: c.color, opacity: 0.7 }}>{c.icon}</div>
            </div>
            <p style={{ fontSize: typeof c.value === 'string' ? 18 : 28, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>      {activeTab === 'PRODUCTS' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 24px', marginBottom: 24, boxShadow: 'var(--box-shadow)' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Stock Levels</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {stock.length > 0 ? (
              stock.map(s => {
                const pct = s.capacity > 0 ? Math.round((s.current / s.capacity) * 100) : 0;
                const st = stockStatus(s.current, s.capacity);
                return (
                  <div key={s.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{s.name}</span>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.current.toLocaleString()} / {s.capacity.toLocaleString()} units</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor(s.current, s.capacity), borderRadius: 99, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No stock levels recorded. Add a product to get started.
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 24px', marginBottom: 24, boxShadow: 'var(--box-shadow)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or SKU..." style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
          </div>
          <select value={categoryFilter} onChange={e => {
            if (e.target.value === 'ADD_NEW') {
              handleAddCategory();
            } else {
              setCategoryFilter(e.target.value);
            }
          }} style={{ flex: '0 0 160px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="ADD_NEW">+ Add Category...</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '0 0 150px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }}>
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: '0 0 140px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 14 }} />
          <button onClick={exportStockCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={exportStockPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            <Printer size={14} /> PDF
          </button>
        </div>        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading stock...</div>
        ) : activeTab === 'PRODUCTS' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Product', 'SKU', 'Category', 'Current', 'Capacity', 'Last Updated', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const st = stockStatus(s.current, s.capacity);
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelectedStockItem(s)}>
                      <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 13 }}>{s.sku}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>{s.category}</td>
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: barColor(s.current, s.capacity) }}>{s.current.toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-muted)' }}>{s.capacity.toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(s.updatedAt)}</td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '12px 12px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
                           <MoreVertical size={16} />
                        </button>
                        {openMenu === s.id && (
                          <div style={{ position: 'absolute', right: 0, top: 36, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 140 }}>
                            <button type="button" onClick={() => { setAdjustForm(f => ({ ...f, productId: s.id })); setShowAdjust(true); setOpenMenu(null); }} style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', fontWeight: 500 }}>Adjust Stock</button>
                            <button
                              type="button"
                              onClick={() => {
                                setSearch(s.name);
                                setOpenMenu(null);
                                document.getElementById('movement-history')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left', fontWeight: 500 }}
                            >
                              View History
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete ${s.name}?`)) {
                                  try {
                                    await stockApi.deleteStock(s.id);
                                    addNotification(`Stock item ${s.name} deleted.`);
                                    loadData();
                                  } catch (err: any) {
                                    alert(err.message || 'Failed to delete stock.');
                                  }
                                }
                                setOpenMenu(null);
                              }}
                              style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#f43f5e', textAlign: 'left', fontWeight: 500 }}
                            >
                              Delete Product
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>No stock items yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>They will appear here once added</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Item Name', 'Item Code', 'Category', 'Quantity', 'Cost (GHS)', 'Date Received', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGeneralPurchases.map(gp => {
                  return (
                    <tr key={gp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{gp.itemName}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 13 }}>{gp.itemCode}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>{gp.category}</td>
                      <td style={{ padding: '12px 12px', fontWeight: 750, color: 'var(--text-primary)' }}>{gp.quantity.toLocaleString()}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>₵{gp.cost.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{gp.dateReceived}</td>
                      <td style={{ padding: '12px 12px', position: 'relative' }}></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredGeneralPurchases.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>No general purchases yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>They will appear here once approved by Management</p>
              </div>
            )}
          </div>
        )}
      </div>

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
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(m.date)}</td>
                  <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.productName}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: m.change > 0 ? '#10b981' : '#f43f5e' }}>{m.change > 0 ? `+${m.change}` : m.change}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{m.reason}</td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: 13 }}>{m.updatedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdjust && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Adjust Stock</h2>
              <button onClick={() => setShowAdjust(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Product</label>
              <select value={adjustForm.productId} onChange={e => setAdjustForm(f => ({ ...f, productId: e.target.value }))} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14 }}>
                <option value="">Select product...</option>
                {stock.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Adjustment Type</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Add', 'Remove'].map(t => (
                  <button type="button" key={t} onClick={() => setAdjustForm(f => ({ ...f, type: t }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${adjustForm.type === t ? 'var(--accent)' : 'var(--border)'}`, background: adjustForm.type === t ? 'var(--accent-light)' : 'var(--bg-input)', color: adjustForm.type === t ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>{t}</button>
                ))}
              </div>
            </div>
            {[
              { label: 'Quantity', key: 'quantity', placeholder: 'e.g. 50', type: 'number' },
              { label: 'Reason', key: 'reason', placeholder: 'e.g. Received shipment' },
              { label: 'Notes (optional)', key: 'notes', placeholder: 'Any additional notes...' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>{f.label}</label>
                <input type={f.type ?? 'text'} value={(adjustForm as Record<string, string>)[f.key]} onChange={e => setAdjustForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setShowAdjust(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={doAdjust} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Apply</button>
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
              { label: 'Current Stock', value: `${selectedStockItem.current.toLocaleString()} units`, highlight: true },
              { label: 'Category', value: selectedStockItem.category },
              { label: 'Capacity', value: `${selectedStockItem.capacity.toLocaleString()} units` },
              { label: 'Fill Level', value: `${pct}%` },
              { label: 'Last Updated', value: fmt(selectedStockItem.updatedAt) },
            ]}
            onClose={() => setSelectedStockItem(null)}
            actions={
              <>
                <button onClick={() => { setAdjustForm(f => ({ ...f, productId: selectedStockItem.id })); setShowAdjust(true); setSelectedStockItem(null); }} style={{ padding: '8px 16px', background: 'var(--accent-light)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Adjust Stock</button>
                <button onClick={() => setSelectedStockItem(null)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Close</button>
              </>
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
