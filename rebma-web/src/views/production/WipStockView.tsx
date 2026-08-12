import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Layers, Download, Printer, Edit2, TrendingUp } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../utils/export';
import { wipApi } from '../../services/apiClient';
import CountUp from '../../components/CountUp';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';

const UNITS = ['kg', 'L', 'pcs', 'boxes', 'sachets', 'blocks', 'bags'];

interface WipItem {
  id: string;
  productName: string;
  stage: string;
  qty: number;
  unit: string;
  updatedAt: string;
  batchRef?: string;
  notes?: string;
}

const STAGES = ['Raw Materials', 'Processing', 'Quality Check', 'Packaging', 'Awaiting Dispatch', 'Completed'];

const stageBadgeStyle = (stage: string) => {
  const m: Record<string, string> = {
    'Raw Materials': 'bg-slate-500/10 text-slate-600',
    'Processing': 'bg-blue-500/10 text-blue-600',
    'Quality Check': 'bg-amber-500/10 text-amber-600',
    'Packaging': 'bg-orange-500/10 text-orange-600',
    'Awaiting Dispatch': 'bg-emerald-500/10 text-emerald-600',
    'Completed': 'bg-purple-500/10 text-purple-600',
  };
  return m[stage] || 'bg-slate-500/10 text-slate-500';
};

const stageIdx = (stage: string) => STAGES.indexOf(stage);

interface Props {
  addNotification: (msg: string) => void;
}

export default function WipStockView({ addNotification }: Props) {
  const [items, setItems] = useState<WipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [updateModal, setUpdateModal] = useState<WipItem | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState<WipItem | null>(null);
  const [newStage, setNewStage] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newBatchRef, setNewBatchRef] = useState('');
  const [form, setForm] = useState({ productName: '', stage: 'Raw Materials', qty: '', unit: 'kg', batchRef: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const wipData = await wipApi.getWipStock();
      setItems(wipData);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = items.filter(item => {
    const matchStage = stageFilter === 'All' || item.stage === stageFilter;
    const matchSearch = item.productName.toLowerCase().includes(search.toLowerCase()) || (item.batchRef || '').toLowerCase().includes(search.toLowerCase());
    return matchStage && matchSearch;
  });

  const summary = [
    { label: 'Total Items', value: items.length, color: 'var(--accent)' },
    { label: 'Total Qty', value: items.reduce((s, i) => s + i.qty, 0), color: '#2563eb' },
    { label: 'In Processing', value: items.filter(i => i.stage === 'Processing').length, color: '#d97706' },
    { label: 'Ready to Dispatch', value: items.filter(i => i.stage === 'Awaiting Dispatch').length, color: '#059669' },
  ];

  const handleEditWipItem = async () => {
    if (!updateModal || submitting) return;
    setSubmitting(true);
    try {
      await wipApi.updateWipStock(
        updateModal.id,
        Number(newQty),
        newNotes,
        newStage,
        newProductName,
        newUnit,
        newBatchRef
      );
      addNotification(`WIP item "${newProductName}" updated successfully.`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update WIP item.');
    }
    setSubmitting(false);
    setUpdateModal(null);
    setNewProductName('');
    setNewStage('');
    setNewQty('');
    setNewUnit('');
    setNewBatchRef('');
    setNewNotes('');
  };

  const handleAddItem = async () => {
    if (!form.productName || !form.qty || submitting) return;
    setSubmitting(true);
    try {
      await wipApi.addWipStock({
        productName: form.productName,
        stage: form.stage,
        qty: Number(form.qty),
        unit: form.unit,
        batchRef: form.batchRef || `B-${Date.now()}`,
        notes: form.notes
      });
      addNotification(`WIP item ${form.productName} added`);
      loadData();
      setAddModal(false);
      setForm({ productName: '', stage: 'Raw Materials', qty: '', unit: 'kg', batchRef: '', notes: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to add WIP item.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await wipApi.deleteWipStock(id);
      addNotification('WIP item removed');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove WIP item.');
    }
    setSubmitting(false);
    setMenuOpen(null);
  };

  const handleDuplicate = async (item: WipItem) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await wipApi.addWipStock({
        productName: item.productName,
        stage: 'Raw Materials',
        qty: item.qty,
        unit: item.unit,
        batchRef: item.batchRef ? `${item.batchRef}-Copy` : `B-${Date.now()}`,
        notes: item.notes
      });
      addNotification(`Duplicated ${item.productName}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate WIP item.');
    }
    setSubmitting(false);
    setMenuOpen(null);
  };

  const printWipItem = (item: WipItem) => {
    const win = window.open('', '_blank', 'width=600,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>WIP Stock Record</title>
      <style>body{font-family:sans-serif;padding:32px;color:#111;} h1{font-size:22px;margin:0 0 4px;} .badge{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#d1fae5;color:#065f46;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:14px;} th{color:#6b7280;font-size:12px;font-weight:600;} .footer{margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;}</style>
      </head><body>
      <p style="font-size:11px;color:#888;margin:0 0 12px;">REBMA IMPEX — WIP Stock Record</p>
      <h1>${item.productName}</h1>
      <p style="margin:4px 0 12px;color:#6b7280;font-size:13px;">${item.batchRef || '—'} · Updated: ${item.updatedAt}</p>
      <span class="badge">${item.stage}</span>
      <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>
      <tr><td>Item ID</td><td>${item.id}</td></tr>
      <tr><td>Product</td><td>${item.productName}</td></tr>
      <tr><td>Batch Reference</td><td>${item.batchRef || '—'}</td></tr>
      <tr><td>Stage</td><td>${item.stage}</td></tr>
      <tr><td>Quantity</td><td>${item.qty.toLocaleString()} ${item.unit}</td></tr>
      <tr><td>Last Updated</td><td>${item.updatedAt}</td></tr>
      <tr><td>Notes</td><td>${item.notes || '—'}</td></tr>
      </tbody></table>
      <div class="footer">Printed from REBMA IMPEX ERP · ${new Date().toLocaleString()}</div>
      </body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">WIP Stock</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Track all work-in-progress inventory across production stages</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportToCSV(items, ['id','productName','stage','qty','unit','batchRef','updatedAt'], 'wip_stock')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => exportToPDF('WIP Stock Report', items.map(i => ({ id: i.id, product: i.productName, stage: i.stage, qty: `${i.qty} ${i.unit}`, updated: i.updatedAt })), ['id','product','stage','qty','updated'])}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer transition-colors">
            <Printer className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button onClick={() => setAddModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-[var(--accent)] text-white rounded-xl hover:opacity-90 cursor-pointer transition-opacity">
            <Plus className="w-3.5 h-3.5" /> Add WIP Item
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map(c => (
          <div key={c.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide">{c.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: c.color }}><CountUp value={c.value} /></p>
          </div>
        ))}
      </div>

      {/* Pipeline Visual */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 overflow-x-auto">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Production Pipeline</h3>
        <div className="flex items-center gap-0 min-w-max">
          {STAGES.map((stage, i) => {
            const count = items.filter(x => x.stage === stage).length;
            return (
              <React.Fragment key={stage}>
                <button onClick={() => setStageFilter(stageFilter === stage ? 'All' : stage)}
                  className={`flex flex-col items-center px-4 py-3 rounded-xl border cursor-pointer transition-all min-w-[110px] ${stageFilter === stage ? 'bg-[var(--accent)] border-[var(--accent)]' : 'bg-[var(--bg)] border-[var(--border)] hover:bg-[var(--accent-light)]'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${stageFilter === stage ? 'text-white' : 'text-[var(--text-muted)]'}`}>{stage}</span>
                  <span className={`text-2xl font-bold mt-1 ${stageFilter === stage ? 'text-white' : 'text-[var(--text-primary)]'}`}><CountUp value={count} /></span>
                </button>
                {i < STAGES.length - 1 && <div className="w-6 h-0.5 bg-[var(--border)] shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or batch ref..."
            className="bg-transparent border-none outline-none text-sm text-[var(--text-primary)] flex-1" />
        </div>
        <SearchableDropdown
          value={stageFilter}
          onChange={setStageFilter}
          className="min-w-[180px]"
          options={[{ value: 'All', label: 'All Stages' }, ...STAGES.map(s => ({ value: s, label: s }))]}
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['ID', 'Product', 'Batch Ref', 'Stage', 'Quantity', 'Last Updated', 'Notes', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] text-[var(--text-muted)] uppercase font-semibold tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-t-transparent border-[var(--accent)] rounded-full animate-spin" />
                      Loading WIP Stock...
                    </div>
                  </td>
                </tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer" onClick={() => setDetailModal(item)}>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{item.id}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{item.productName}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs font-mono">{item.batchRef || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${stageBadgeStyle(item.stage)}`}>{item.stage}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{item.qty.toLocaleString()} <span className="text-[var(--text-muted)] text-xs font-normal">{item.unit}</span></td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">{item.updatedAt}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] max-w-[140px] truncate">{item.notes || '—'}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                        className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg)] rounded-lg cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1">
                          <button onClick={() => { setDetailModal(item); setMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">View Details</button>
                          <button onClick={() => { setUpdateModal(item); setNewProductName(item.productName); setNewStage(item.stage); setNewQty(String(item.qty)); setNewUnit(item.unit); setNewBatchRef(item.batchRef || ''); setNewNotes(item.notes || ''); setMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer gap-2 items-center"><Edit2 className="w-3 h-3" /> Edit WIP Item</button>
                          <button onClick={() => { printWipItem(item); setMenuOpen(null); }} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer gap-2 items-center"><Printer className="w-3 h-3" /> Print Record</button>
                          <button onClick={() => handleDuplicate(item)} disabled={submitting} className="flex w-full px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg cursor-pointer disabled:opacity-50">Duplicate</button>
                          <button onClick={() => handleDelete(item.id)} disabled={submitting} className="flex w-full px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer disabled:opacity-50">Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
                    <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    No WIP items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Stage Modal */}
      <SidePanel
        open={!!updateModal}
        onClose={() => setUpdateModal(null)}
        title="Edit WIP Item"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setUpdateModal(null)} className="flex-1 py-2.5 text-sm font-semibold bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer">Cancel</button>
            <button onClick={handleEditWipItem} disabled={submitting} className="flex-1 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90 disabled:opacity-50">{submitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Product Name *</label>
            <input value={newProductName} onChange={e => setNewProductName(e.target.value)} className={inputCls} placeholder="Product Name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Quantity *</label>
              <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Unit</label>
              <SearchableDropdown value={newUnit} onChange={setNewUnit} options={UNITS.map(u => ({ value: u, label: u }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Batch Reference</label>
            <input value={newBatchRef} onChange={e => setNewBatchRef(e.target.value)} className={inputCls} placeholder="Batch Reference" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Stage</label>
            <SearchableDropdown value={newStage} onChange={setNewStage} options={STAGES.map(s => ({ value: s, label: s }))} />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Notes (optional)</label>
            <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
              className={inputCls} placeholder="Any notes..." />
          </div>
        </div>
      </SidePanel>

      {/* Add Item Modal */}
      <SidePanel
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add WIP Item"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setAddModal(false)} className="flex-1 py-2.5 text-sm font-semibold bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer">Cancel</button>
            <button onClick={handleAddItem} disabled={submitting} className="flex-1 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90 disabled:opacity-50">{submitting ? 'Adding...' : 'Add Item'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Product Name *</label>
            <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} className={inputCls} placeholder="e.g. Shea Butter Cream 200ml" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Quantity *</label>
              <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Unit</label>
              <SearchableDropdown value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} options={UNITS.map(u => ({ value: u, label: u }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Batch Reference</label>
            <input value={form.batchRef} onChange={e => setForm(f => ({ ...f, batchRef: e.target.value }))} className={inputCls} placeholder="e.g. B-2026-0507" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Stage</label>
            <SearchableDropdown value={form.stage} onChange={v => setForm(f => ({ ...f, stage: v }))} options={STAGES.map(s => ({ value: s, label: s }))} />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] font-semibold mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} placeholder="Any relevant notes..." />
          </div>
        </div>
      </SidePanel>

      {/* Detail Modal */}
      <SidePanel
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={detailModal?.id || ''}
        footer={
          detailModal && (
            <div className="flex gap-2">
              <button onClick={() => { printWipItem(detailModal); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl cursor-pointer">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button onClick={() => { setUpdateModal(detailModal); setNewProductName(detailModal.productName); setNewStage(detailModal.stage); setNewQty(String(detailModal.qty)); setNewUnit(detailModal.unit); setNewBatchRef(detailModal.batchRef || ''); setNewNotes(detailModal.notes || ''); setDetailModal(null); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90">
                <Edit2 className="w-3.5 h-3.5" /> Edit WIP Item
              </button>
            </div>
          )
        }
      >
        {detailModal && (
          <>
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">{detailModal.productName}</h3>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${stageBadgeStyle(detailModal.stage)}`}>{detailModal.stage}</span>
            <div className="mt-5 space-y-3">
              {[
                { label: 'Batch Reference', value: detailModal.batchRef || '—' },
                { label: 'Quantity', value: `${detailModal.qty.toLocaleString()} ${detailModal.unit}` },
                { label: 'Last Updated', value: detailModal.updatedAt },
                { label: 'Notes', value: detailModal.notes || '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span className="text-xs text-[var(--text-muted)] font-semibold">{r.label}</span>
                  <span className="text-xs text-[var(--text-primary)] font-semibold">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 mb-2">
              <p className="text-xs text-[var(--text-muted)] font-semibold mb-2">Pipeline Position</p>
              <div className="flex items-center gap-1">
                {STAGES.map((stage, i) => {
                  const current = stageIdx(detailModal.stage);
                  return (
                    <React.Fragment key={stage}>
                      <div className={`flex flex-col items-center`}>
                        <div className={`w-3 h-3 rounded-full ${i <= current ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
                        <span className={`text-[8px] mt-0.5 font-semibold ${i <= current ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{stage.split(' ')[0]}</span>
                      </div>
                      {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 mb-3 ${i < current ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </SidePanel>

      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}
    </div>
  );
}
