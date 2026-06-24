import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Tag, TrendingUp, TrendingDown, Search, Plus, MoreVertical,
  Download, RefreshCw, CheckCircle, History, Save,
  ArrowLeft, Edit2, Trash2, Bell, Camera, FileText, Image as ImageIcon, AlertTriangle
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';

interface PriceEntry {
  id: string;
  productName: string;
  category: string;
  unitPrice: number;
  costPrice: number;
  margin: number;
  currency: 'GHS' | 'USD';
  lastUpdated: string;
  updatedBy: string;
  changeDir: 'up' | 'down' | 'same';
}

interface PriceHistoryEntry {
  date: string;
  price: number;
  updatedBy: string;
  note: string;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function MgmtPriceSettingView({ addNotification, currentUser }: Props) {
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<PriceEntry | null>(null);
  const [showHistory, setShowHistory] = useState<PriceEntry | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productName: '', category: 'INCOMING_GOODS', unitPrice: '', costPrice: '', currency: 'GHS' as 'GHS' | 'USD', effectiveDate: '', note: '' });
  const [broadcastFinance, setRadioFinance] = useState(true);
  const [broadcastMarketing, setRadioMarketing] = useState(true);
  const [broadcastCeo, setRadioCeo] = useState(false);

  const [approvedGoods, setApprovedGoods] = useState<string[]>([]);
  const [unpricedGoods, setUnpricedGoods] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('cargo_intake').select('product_name').eq('status', 'APPROVED'),
      supabase.from('goods_prices').select('product_name'),
    ]).then(([{ data: cargoData }, { data: priceData }]) => {
      const approved = Array.from(new Set((cargoData || []).map((r: any) => String(r.product_name || '')).filter(Boolean)));
      const priced = new Set((priceData || []).map((r: any) => String(r.product_name || '')));
      setApprovedGoods(approved);
      setUnpricedGoods(approved.filter(name => !priced.has(name)));
    }, () => {});
  }, [prices]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [cameraPreview, setCameraPreview] = useState<string>('');
  const [docBase64, setDocBase64] = useState<string>('');
  const [docName, setDocName] = useState<string>('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCameraPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setDocBase64(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => { loadPrices(); }, []);

  useEffect(() => {
    if (showHistory) {
      loadPriceHistory(showHistory.productName);
    }
  }, [showHistory]);

  async function loadPrices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('goods_prices')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading goods prices:', error);
      }

      const mapped: PriceEntry[] = (data || []).map((row: any) => {
        const unitPrice = typeof row.unit_price === 'number' ? row.unit_price : 0;
        const costPrice = typeof row.cost_price === 'number' ? row.cost_price : unitPrice * 0.65;
        return {
          id: String(row.id),
          productName: String(row.product_name || ''),
          category: String(row.category || 'INCOMING_GOODS'),
          unitPrice,
          costPrice,
          margin: costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : 0,
          currency: (row.currency as 'GHS' | 'USD') || 'GHS',
          lastUpdated: String(row.updated_at || row.created_at || '').slice(0, 10),
          updatedBy: String(row.updated_by || 'Management'),
          changeDir: 'same' as const,
        };
      });
      setPrices(mapped);
    } catch (e) {
      console.error(e);
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPriceHistory(productName: string) {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('global_audit_history')
        .select('*')
        .or(`action.ilike.%${productName}%,details.ilike.%${productName}%`)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading price history:', error);
      }

      const mappedHistory: PriceHistoryEntry[] = (data || []).map((h: any) => {
        const priceRegex = /(?:GHS|USD)\s*(\d+(?:\.\d+)?)/i;
        const match = (h.action || '').match(priceRegex) || (h.details || '').match(priceRegex);
        const price = match ? parseFloat(match[1]) : 0;
        return {
          date: h.timestamp ? h.timestamp.split('T')[0] : '',
          price: price || showHistory?.unitPrice || 0,
          updatedBy: h.performed_by || 'System',
          note: h.action || 'Price Update Logged',
        };
      });
      setHistory(mappedHistory);
    } catch (e) {
      console.error(e);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  const filtered = prices.filter(p =>
    !search || p.productName.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  const avgMargin = prices.length > 0 ? prices.reduce((s, p) => s + p.margin, 0) / prices.length : 0;
  const totalProducts = prices.length;
  const highMargin = prices.filter(p => p.margin >= 50).length;
  const lowMargin = prices.filter(p => p.margin < 40).length;

  async function savePrice() {
    if (!form.productName || !form.unitPrice) return;
    const unitPrice = parseFloat(form.unitPrice);
    const costPrice = form.costPrice ? parseFloat(form.costPrice) : unitPrice * 0.65;
    const margin = costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : 0;

    const newId = editing?.id || 'PRC-' + Math.random().toString(36).substring(2, 9);
    const newEntry: PriceEntry = {
      id: newId,
      productName: form.productName,
      category: form.category,
      unitPrice,
      costPrice,
      margin,
      currency: form.currency,
      lastUpdated: form.effectiveDate || new Date().toISOString().slice(0, 10),
      updatedBy: currentUser?.fullName || 'Management',
      changeDir: editing ? (unitPrice > editing.unitPrice ? 'up' : unitPrice < editing.unitPrice ? 'down' : 'same') : 'same',
    };

    try {
      const upsertPayload: Record<string, unknown> = {
        product_name: form.productName,
        unit_price: unitPrice,
        updated_at: new Date().toISOString(),
      };
      if (editing?.id) upsertPayload.id = editing.id;
      // Write optional columns only — they exist if the table was migrated
      try { upsertPayload.category = form.category; } catch { /* noop */ }
      try { upsertPayload.cost_price = costPrice; } catch { /* noop */ }
      try { upsertPayload.currency = form.currency; } catch { /* noop */ }
      try { upsertPayload.updated_by = currentUser?.fullName || 'Management'; } catch { /* noop */ }

      const { error: upsertError } = await supabase.from('goods_prices').upsert([upsertPayload], { onConflict: 'product_name' });
      if (upsertError) {
        addNotification?.(`Price save failed: ${upsertError.message}. Run the SQL migration to add missing columns to goods_prices.`);
        return;
      }

      if (broadcastFinance) {
        await supabase.from('supplier_order_notifications').insert([{ message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'FINANCE', read: false }]);
      }
      if (broadcastMarketing) {
        await supabase.from('supplier_order_notifications').insert([{ message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'MARKETING', read: false }]);
      }
      if (broadcastCeo) {
        await supabase.from('supplier_order_notifications').insert([{ message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'CEO', read: false }]);
      }

      await supabase.from('global_audit_history').insert([{
        department: 'MANAGEMENT',
        action: `Price ${editing ? 'updated' : 'set'}: ${form.productName} → ${form.currency} ${unitPrice}/unit`,
        performed_by: currentUser?.fullName || 'Management',
        timestamp: new Date().toISOString(),
      }]);

      addNotification?.(`Price ${editing ? 'updated' : 'set'}: ${form.productName} → ${form.currency} ${unitPrice}`);
      loadPrices();
      setImagePreview('');
      setCameraPreview('');
      setDocBase64('');
      setDocName('');
    } catch (e) {
      console.error(e);
      addNotification?.('Failed to save price catalog updates.');
    }

    setShowForm(false);
    setEditing(null);
    setForm({ productName: '', category: 'INCOMING_GOODS', unitPrice: '', costPrice: '', currency: 'GHS', effectiveDate: '', note: '' });
  }

  function openEdit(item: PriceEntry) {
    setEditing(item);
    setForm({ productName: item.productName, category: item.category, unitPrice: String(item.unitPrice), costPrice: String(item.costPrice), currency: item.currency, effectiveDate: '', note: '' });
    setShowForm(true);
    setMenuOpen(null);
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('goods_prices').delete().eq('id', id);
      setPrices(prev => prev.filter(p => p.id !== id));
      addNotification?.('Price entry removed');
    } catch (e) {
      console.error(e);
      addNotification?.('Failed to delete price entry.');
    }
    setMenuOpen(null);
  }

  if (showHistory) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <button onClick={() => setShowHistory(null)} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium">
          <ArrowLeft size={16} /> Back to Price Catalog
        </button>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{showHistory.productName} — Price History</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5">Current price: {showHistory.currency} {showHistory.unitPrice}</p>
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">Loading price logs...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">No price history logged for this product.</div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-[var(--bg-input)] rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)' }}>
                    <Tag size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{showHistory.currency} {h.price} / unit</p>
                    <p className="text-xs text-[var(--text-muted)]">{h.note} · by {h.updatedBy}</p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{h.date}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Price Setting</h1>
          <p className="text-sm text-[var(--text-secondary)]">Manage selling prices and margins across products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadPrices} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => exportToCSV(filtered.map(p => ({ Product: p.productName, Category: p.category, 'Unit Price': p.unitPrice, 'Cost Price': p.costPrice, 'Margin %': p.margin.toFixed(1), Currency: p.currency, 'Last Updated': p.lastUpdated })), ['Product', 'Category', 'Unit Price', 'Cost Price', 'Margin %', 'Currency', 'Last Updated'], 'price_catalog')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">
            <Download size={14} /> Export
          </button>
          <button onClick={() => { setEditing(null); setForm({ productName: '', category: 'INCOMING_GOODS', unitPrice: '', costPrice: '', currency: 'GHS', effectiveDate: '', note: '' }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}>
            <Plus size={14} /> Set Price
          </button>
        </div>
      </div>

      {/* Unpriced goods alert */}
      {unpricedGoods.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
              {unpricedGoods.length} approved {unpricedGoods.length === 1 ? 'product needs' : 'products need'} a price set
            </p>
            <p className="text-xs mt-1" style={{ color: '#b45309' }}>
              {unpricedGoods.join(' · ')}
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setForm(f => ({ ...f, productName: unpricedGoods[0] })); setShowForm(true); }}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-white text-xs font-semibold cursor-pointer"
            style={{ background: '#f59e0b' }}
          >
            Set Price
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: totalProducts, sub: 'in catalog', color: 'var(--accent)' },
          { label: 'Avg Margin', value: `${avgMargin.toFixed(1)}%`, sub: 'across products', color: '#10b981' },
          { label: 'High Margin', value: highMargin, sub: '≥ 50% margin', color: '#6366f1' },
          { label: 'Low Margin', value: lowMargin, sub: '< 40% margin', color: '#f59e0b' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Price Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                {['Product', 'Category', 'Cost Price', 'Selling Price', 'Margin', 'Currency', 'Last Updated', 'By', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    No price settings found in catalog. Use "Set Price" to add one.
                  </td>
                </tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-[var(--accent-light)] transition-colors group">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {item.changeDir === 'up' && <TrendingUp size={12} className="text-green-500 flex-shrink-0" />}
                      {item.changeDir === 'down' && <TrendingDown size={12} className="text-red-500 flex-shrink-0" />}
                      {item.productName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-semibold">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{item.currency} {item.costPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 font-bold text-[var(--text-primary)] whitespace-nowrap">{item.currency} {item.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-semibold text-sm ${item.margin >= 50 ? 'text-green-500' : item.margin >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {item.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{item.currency}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{item.lastUpdated}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">{item.updatedBy}</td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)] opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical size={14} className="text-[var(--text-muted)]" />
                      </button>
                      {menuOpen === item.id && (
                        <div className="absolute right-0 top-8 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg py-1 min-w-[150px]">
                          <button onClick={() => openEdit(item)} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><Edit2 size={13} /> Edit Price</button>
                          <button onClick={() => { setShowHistory(item); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex items-center gap-2"><History size={13} /> Price History</button>
                          <button onClick={() => handleDelete(item.id)} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-[var(--bg-input)] flex items-center gap-2"><Trash2 size={13} /> Remove</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Price Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">{editing ? 'Update Price' : 'Set New Price'}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Product Name *</label>
                <input
                  list="approved-goods-list"
                  value={form.productName}
                  onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
                  placeholder={approvedGoods.length > 0 ? 'Select or type product name…' : 'Enter product name'}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <datalist id="approved-goods-list">
                  {approvedGoods.map(name => <option key={name} value={name} />)}
                </datalist>
                {approvedGoods.length > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{approvedGoods.length} approved goods available to price</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                    <option value="INCOMING_GOODS">Incoming Goods</option>
                    <option value="SERVICES">Services</option>
                    <option value="FINISHED_GOODS">Finished Goods</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as 'GHS' | 'USD' }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]">
                    <option value="GHS">GHS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Cost Price *</label>
                  <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} placeholder="e.g. 62.00" className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Selling Price *</label>
                  <input type="number" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="e.g. 95.00" className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              {form.costPrice && form.unitPrice && (
                <div className="bg-[var(--bg-input)] rounded-xl p-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-500" />
                  <span className="text-sm text-[var(--text-secondary)]">Margin: <strong className="text-green-500">{(((parseFloat(form.unitPrice) - parseFloat(form.costPrice)) / parseFloat(form.costPrice)) * 100).toFixed(1)}%</strong></span>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Effective Date</label>
                <input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block flex items-center gap-1"><Bell size={12} /> Notify Departments</label>
                <div className="flex items-center gap-4 flex-wrap">
                  {[{ label: 'Finance', state: broadcastFinance, set: setRadioFinance }, { label: 'Marketing', state: broadcastMarketing, set: setRadioMarketing }, { label: 'CEO', state: broadcastCeo, set: setRadioCeo }].map(({ label, state, set }) => (
                    <label key={label} className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                      <input type="checkbox" checked={state} onChange={e => set(e.target.checked)} className="rounded" /> {label}
                    </label>
                  ))}
                </div>
              </div>
              {/* Camera, Document, Image Uploads */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-secondary)] block">Attachments (Image, Camera Photo, Document)</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    <ImageIcon size={14} /> Upload Image
                  </button>
                  <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    <Camera size={14} /> Take Photo
                  </button>
                  <button type="button" onClick={() => docInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-secondary)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)]">
                    <FileText size={14} /> Attach Doc
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraChange} className="hidden" />
                  <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleDocChange} className="hidden" />
                </div>
                
                {/* Previews */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {imagePreview && (
                    <div className="relative">
                      <p className="text-[9px] text-[var(--text-muted)] mb-1">Image Preview</p>
                      <img src={imagePreview} alt="Image Upload" className="w-12 h-12 object-cover rounded-lg border border-[var(--border)]" />
                      <button type="button" onClick={() => setImagePreview('')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center">✕</button>
                    </div>
                  )}
                  {cameraPreview && (
                    <div className="relative">
                      <p className="text-[9px] text-[var(--text-muted)] mb-1">Camera Preview</p>
                      <img src={cameraPreview} alt="Camera Upload" className="w-12 h-12 object-cover rounded-lg border border-[var(--border)]" />
                      <button type="button" onClick={() => setCameraPreview('')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center">✕</button>
                    </div>
                  )}
                  {docName && (
                    <div className="relative p-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl flex items-center gap-2">
                      <FileText size={16} className="text-emerald-500" />
                      <div className="text-[10px]">
                        <p className="font-semibold truncate max-w-[100px]">{docName}</p>
                      </div>
                      <button type="button" onClick={() => { setDocName(''); setDocBase64(''); }} className="w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center">✕</button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Note (optional)</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Reason for price change..." className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">Cancel</button>
              <button onClick={savePrice} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}>
                <Save size={14} /> {editing ? 'Update Price' : 'Save & Radio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
