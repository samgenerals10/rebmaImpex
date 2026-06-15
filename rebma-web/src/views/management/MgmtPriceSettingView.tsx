import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  Tag, TrendingUp, TrendingDown, Search, Plus, MoreVertical,
  Download, RefreshCw, CheckCircle, History, Save,
  ArrowLeft, Edit2, Trash2, Bell
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

const MOCK_PRICES: PriceEntry[] = [
  { id: '1', productName: 'Hydraulic Hose Fittings', category: 'INCOMING_GOODS', unitPrice: 95, costPrice: 62, margin: 53.2, currency: 'GHS', lastUpdated: '2024-12-08', updatedBy: 'Management', changeDir: 'up' },
  { id: '2', productName: 'PVC Pipe Fittings', category: 'INCOMING_GOODS', unitPrice: 34, costPrice: 22, margin: 54.5, currency: 'GHS', lastUpdated: '2024-12-07', updatedBy: 'Management', changeDir: 'down' },
  { id: '3', productName: 'Steel Pipe 3/4"', category: 'INCOMING_GOODS', unitPrice: 120, costPrice: 78, margin: 53.8, currency: 'GHS', lastUpdated: '2024-12-06', updatedBy: 'Management', changeDir: 'same' },
  { id: '4', productName: 'Copper Wire 2.5mm', category: 'INCOMING_GOODS', unitPrice: 52, costPrice: 35, margin: 48.6, currency: 'GHS', lastUpdated: '2024-12-05', updatedBy: 'Management', changeDir: 'up' },
  { id: '5', productName: 'Rubber Gaskets Set', category: 'INCOMING_GOODS', unitPrice: 28, costPrice: 18, margin: 55.6, currency: 'GHS', lastUpdated: '2024-12-04', updatedBy: 'Management', changeDir: 'same' },
  { id: '6', productName: 'Valve Gate 2"', category: 'INCOMING_GOODS', unitPrice: 210, costPrice: 145, margin: 44.8, currency: 'GHS', lastUpdated: '2024-12-03', updatedBy: 'CEO', changeDir: 'up' },
  { id: '7', productName: 'Elbow Fitting 90°', category: 'INCOMING_GOODS', unitPrice: 18, costPrice: 11, margin: 63.6, currency: 'GHS', lastUpdated: '2024-12-02', updatedBy: 'Management', changeDir: 'down' },
  { id: '8', productName: 'Thread Seal Tape', category: 'INCOMING_GOODS', unitPrice: 8, costPrice: 4.5, margin: 77.8, currency: 'GHS', lastUpdated: '2024-12-01', updatedBy: 'Management', changeDir: 'same' },
];

const MOCK_HISTORY: PriceHistoryEntry[] = [
  { date: '2024-12-08', price: 95, updatedBy: 'Management', note: 'Import cost increase' },
  { date: '2024-11-15', price: 85, updatedBy: 'CEO', note: 'Quarterly review' },
  { date: '2024-10-01', price: 80, updatedBy: 'Management', note: 'Initial pricing' },
];

export default function MgmtPriceSettingView({ addNotification, currentUser }: Props) {
  const [prices, setPrices] = useState<PriceEntry[]>(MOCK_PRICES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<PriceEntry | null>(null);
  const [showHistory, setShowHistory] = useState<PriceEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productName: '', category: 'INCOMING_GOODS', unitPrice: '', costPrice: '', currency: 'GHS' as 'GHS' | 'USD', effectiveDate: '', note: '' });
  const [broadcastFinance, setBroadcastFinance] = useState(true);
  const [broadcastMarketing, setBroadcastMarketing] = useState(true);
  const [broadcastCeo, setBroadcastCeo] = useState(false);

  useEffect(() => { loadPrices(); }, []);

  async function loadPrices() {
    setLoading(true);
    try {
      const { data } = await supabase.from('goods_prices').select('*').order('updated_at', { ascending: false });
      if (data && data.length > 0) {
        const mapped: PriceEntry[] = data.map((row: Record<string, unknown>) => {
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
      }
    } catch (_) {}
    setLoading(false);
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

    const newEntry: PriceEntry = {
      id: editing?.id || Date.now().toString(),
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

    supabase.from('goods_prices').upsert([{
      id: editing?.id || undefined,
      product_name: form.productName,
      category: form.category,
      unit_price: unitPrice,
      cost_price: costPrice,
      currency: form.currency,
      updated_by: currentUser?.fullName || 'Management',
      updated_at: new Date().toISOString(),
    }]).then(() => {}, () => {});

    if (broadcastFinance) {
      supabase.from('supplier_order_notifications').insert([{ order_id: newEntry.id, message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'FINANCE', read: false }]).then(() => {}, () => {});
    }
    if (broadcastMarketing) {
      supabase.from('supplier_order_notifications').insert([{ order_id: newEntry.id, message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'MARKETING', read: false }]).then(() => {}, () => {});
    }
    if (broadcastCeo) {
      supabase.from('supplier_order_notifications').insert([{ order_id: newEntry.id, message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'CEO', read: false }]).then(() => {}, () => {});
    }

    supabase.from('global_audit_history').insert([{
      department: 'MANAGEMENT',
      action: `Price ${editing ? 'updated' : 'set'}: ${form.productName} → ${form.currency} ${unitPrice}/unit`,
      performed_by: currentUser?.fullName || 'Management',
      created_at: new Date().toISOString(),
    }]).then(() => {}, () => {});

    if (editing) {
      setPrices(prev => prev.map(p => p.id === editing.id ? newEntry : p));
    } else {
      setPrices(prev => [newEntry, ...prev]);
    }

    addNotification?.(`Price ${editing ? 'updated' : 'set'}: ${form.productName} → ${form.currency} ${unitPrice}`);
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

  function handleDelete(id: string) {
    supabase.from('goods_prices').delete().eq('id', id).then(() => {}, () => {});
    setPrices(prev => prev.filter(p => p.id !== id));
    setMenuOpen(null);
    addNotification?.('Price entry removed');
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
            {MOCK_HISTORY.map((h, i) => (
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
            ))}
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
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">Loading prices...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Product', 'Category', 'Cost Price', 'Selling Price', 'Margin', 'Currency', 'Last Updated', 'By', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-[var(--bg-input)] transition-colors group">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {item.changeDir === 'up' && <TrendingUp size={12} className="text-green-500 flex-shrink-0" />}
                        {item.changeDir === 'down' && <TrendingDown size={12} className="text-red-500 flex-shrink-0" />}
                        {item.productName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-medium">{item.category}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">{item.currency} {item.costPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">{item.currency} {item.unitPrice.toFixed(2)}</td>
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
        )}
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
                <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="Enter product name" className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
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
                  {[{ label: 'Finance', state: broadcastFinance, set: setBroadcastFinance }, { label: 'Marketing', state: broadcastMarketing, set: setBroadcastMarketing }, { label: 'CEO', state: broadcastCeo, set: setBroadcastCeo }].map(({ label, state, set }) => (
                    <label key={label} className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                      <input type="checkbox" checked={state} onChange={e => set(e.target.checked)} className="rounded" /> {label}
                    </label>
                  ))}
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
                <Save size={14} /> {editing ? 'Update Price' : 'Save & Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
