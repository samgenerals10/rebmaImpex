// src/views/management/MgmtStockManagementView.tsx
import { useState, useEffect } from 'react';
import { Edit3, Trash2, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel';

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

const OPEN_ORDER_STATUSES_EXCLUDED = ['DELIVERED', 'REJECTED', 'CANCELLED', 'COMPLETED'];

export default function MgmtStockManagementView({ addNotification, currentUser }: Props) {
  const { getSetting } = useCeoSettings();
  const [loading, setLoading] = useState(true);
  const [approvedCargoAll, setApprovedCargoAll] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);

  const [cargoSearch, setCargoSearch] = useState('');
  const [correctionTarget, setCorrectionTarget] = useState<any | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    country: '', company: '', quantity: '', weight: '', destination: '', discrepancies: '', unitPrice: '', note: '',
  });
  const [savingCorrection, setSavingCorrection] = useState(false);

  const [stockSearch, setStockSearch] = useState('');
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<any[] | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingStock, setDeletingStock] = useState(false);
  const [loadingDeleteContext, setLoadingDeleteContext] = useState(false);
  const [openOrdersWarning, setOpenOrdersWarning] = useState<{ product: string; count: number }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: cargo }, { data: stocks }] = await Promise.all([
        supabase.from('cargo_intake').select('*').eq('status', 'APPROVED'),
        supabase.from('stock').select('*'),
      ]);
      setApprovedCargoAll(cargo || []);
      setStockList(stocks || []);
    } catch (e) {
      console.error('Error loading stock management data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useRealtimeChannel(
    'mgmt-stock-management-realtime',
    ['stock', 'cargo_intake'],
    () => fetchData()
  );

  const approvedCargo = approvedCargoAll.filter(c =>
    !cargoSearch ||
    String(c.product_name || '').toLowerCase().includes(cargoSearch.toLowerCase()) ||
    String(c.goods_code || '').toLowerCase().includes(cargoSearch.toLowerCase()) ||
    String(c.company || '').toLowerCase().includes(cargoSearch.toLowerCase())
  );

  function openCorrection(c: any) {
    setCorrectionTarget(c);
    setCorrectionForm({
      country: c.country || '',
      company: c.company || '',
      quantity: String(c.quantity ?? ''),
      weight: String(c.weight ?? ''),
      destination: c.destination || '',
      discrepancies: (c.discrepancies && c.discrepancies !== 'None') ? c.discrepancies : '',
      unitPrice: String(c.unit_price ?? ''),
      note: '',
    });
  }

  async function saveCorrection() {
    if (!correctionTarget) return;
    if (!getSetting('stock_adjustments_allowed', true)) { addNotification?.('Stock adjustments are currently disabled by the CEO.'); return; }
    if (!correctionForm.note.trim()) { addNotification?.('A reason for the correction is required.'); return; }
    const oldQty = Number(correctionTarget.quantity) || 0;
    const newQty = Number(correctionForm.quantity) || 0;
    const delta = newQty - oldQty;
    const performedBy = currentUser?.fullName || 'Management';
    // stock.updated_by / stock_ledger.performed_by are UUID columns on the live DB
    // (supabase_schema.sql says TEXT, but the live schema disagrees — same drift
    // documented elsewhere in this file) — they need the actual auth user id, not
    // a display name. The name still goes in notes/global_audit_history, which
    // are genuinely TEXT.
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    setSavingCorrection(true);
    try {
      const { error: cargoErr } = await supabase.from('cargo_intake').update({
        country: correctionForm.country || null,
        company: correctionForm.company || null,
        quantity: newQty,
        weight: Number(correctionForm.weight) || 0,
        destination: correctionForm.destination || null,
        discrepancies: correctionForm.discrepancies || 'None',
        unit_price: correctionForm.unitPrice ? Number(correctionForm.unitPrice) : null,
      }).eq('id', correctionTarget.id);
      if (cargoErr) throw cargoErr;

      if (delta !== 0) {
        const productName = correctionTarget.product_name;
        const { data: stockRow } = await supabase.from('stock').select('id, quantity').eq('product_name', productName).maybeSingle();
        if (stockRow) {
          const { error: stockErr } = await supabase.from('stock').update({ quantity: Math.max(0, Number(stockRow.quantity || 0) + delta), last_updated: new Date().toISOString(), updated_by: performerId }).eq('id', stockRow.id);
          if (stockErr) throw stockErr;
        }
        const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
          product_name: productName,
          movement_type: 'CORRECTION',
          quantity: delta,
          reference: correctionTarget.goods_code || correctionTarget.id,
          notes: `Correction by ${performedBy}: qty ${oldQty} → ${newQty}. Reason: ${correctionForm.note.trim()}`,
          performed_by: performerId,
          created_at: new Date().toISOString(),
        });
        if (ledgerErr) throw ledgerErr;
      }

      await supabase.from('global_audit_history').insert({
        action: `CORRECT_CARGO: ${correctionTarget.goods_code || correctionTarget.id} — ${correctionTarget.product_name}`,
        department: 'MANAGEMENT',
        performed_by: performedBy,
        details: `Corrected cargo entry. Qty ${oldQty} → ${newQty}${delta !== 0 ? ` (stock adjusted by ${delta > 0 ? '+' : ''}${delta})` : ''}. Reason: ${correctionForm.note.trim()}`,
        timestamp: new Date().toISOString(),
      });

      addNotification?.(`Cargo entry ${correctionTarget.goods_code || ''} corrected.`);
      setCorrectionTarget(null);
      fetchData();
    } catch (e: any) {
      console.error(e);
      addNotification?.(e.message || 'Failed to save correction.');
    } finally {
      setSavingCorrection(false);
    }
  }

  const filteredStock = stockList.filter(s =>
    !stockSearch ||
    String(s.product_name || '').toLowerCase().includes(stockSearch.toLowerCase()) ||
    String(s.product_code || '').toLowerCase().includes(stockSearch.toLowerCase()) ||
    String(s.category || '').toLowerCase().includes(stockSearch.toLowerCase())
  );

  function toggleStockSelect(id: string) {
    setSelectedStockIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Expected text a manager must type to unlock the Delete button — the exact
  // product name for a single item, or "DELETE" for a batch. Scales the
  // friction to the blast radius instead of one shared reason unlocking an
  // arbitrarily large "select all" batch.
  const deleteConfirmExpected = deleteTargets && deleteTargets.length === 1
    ? deleteTargets[0].product_name
    : 'DELETE';

  async function openDeleteStock(rows: any[]) {
    if (!getSetting('management_can_delete_stock', true)) {
      addNotification?.('Stock deletion is currently disabled by the CEO.');
      return;
    }
    setDeleteTargets(rows);
    setDeleteReason('');
    setDeleteConfirmText('');
    setOpenOrdersWarning([]);
    setLoadingDeleteContext(true);
    try {
      // Re-fetch current quantity right before showing the confirmation —
      // the list in memory can be stale by the time a manager gets here, and
      // the ledger should log what actually existed, not what was on screen
      // when the page loaded.
      const ids = rows.map(r => r.id);
      const { data: freshRows } = await supabase.from('stock').select('*').in('id', ids);
      if (freshRows && freshRows.length) {
        setDeleteTargets(prev => (prev || []).map(r => freshRows.find((f: any) => f.id === r.id) || r));
      }

      // Warn if any of these products still have unfulfilled orders against
      // them — deletion doesn't touch orders, so this is informational, not
      // a block, but a manager should see it before confirming.
      const productNames = Array.from(new Set(rows.map(r => r.product_name).filter(Boolean)));
      if (productNames.length) {
        const { data: openOrders } = await supabase
          .from('orders')
          .select('product_name, status')
          .in('product_name', productNames)
          .not('status', 'in', `(${OPEN_ORDER_STATUSES_EXCLUDED.join(',')})`);
        const counts: Record<string, number> = {};
        (openOrders || []).forEach((o: any) => { counts[o.product_name] = (counts[o.product_name] || 0) + 1; });
        setOpenOrdersWarning(Object.entries(counts).map(([product, count]) => ({ product, count })));
      }
    } catch (e) {
      console.error('Error loading delete context:', e);
    } finally {
      setLoadingDeleteContext(false);
    }
  }

  async function confirmDeleteStock() {
    if (!deleteTargets || deleteTargets.length === 0) return;
    if (!getSetting('management_can_delete_stock', true)) { addNotification?.('Stock deletion is currently disabled by the CEO.'); return; }
    if (!deleteReason.trim()) { addNotification?.('A reason for deletion is required.'); return; }
    if (deleteConfirmText.trim() !== deleteConfirmExpected) {
      addNotification?.(`Type "${deleteConfirmExpected}" to confirm.`);
      return;
    }
    const performedBy = currentUser?.fullName || 'Management';
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;

    setDeletingStock(true);
    try {
      for (const row of deleteTargets) {
        // Log the removal before deleting the row so the ledger keeps a
        // record of what quantity existed at time of deletion.
        const { error: ledgerErr } = await supabase.from('stock_ledger').insert({
          product_name: row.product_name,
          movement_type: 'DELETION',
          quantity: -(Number(row.quantity) || 0),
          reference: row.id,
          notes: `Deleted by ${performedBy}. Reason: ${deleteReason.trim()}`,
          performed_by: performerId,
          created_at: new Date().toISOString(),
        });
        if (ledgerErr) throw ledgerErr;

        const { error: delErr } = await supabase.from('stock').delete().eq('id', row.id);
        if (delErr) throw delErr;
      }

      // The ledger row above only ever preserves product_name + quantity —
      // stash a full snapshot of every deleted row in the audit trail so a
      // mistaken delete is actually reconstructable (category, min/max
      // levels, product_code, etc. would otherwise be gone for good).
      await supabase.from('global_audit_history').insert({
        action: deleteTargets.length === 1 ? `DELETE_STOCK: ${deleteTargets[0].product_name}` : `DELETE_STOCK: ${deleteTargets.length} items`,
        department: 'MANAGEMENT',
        performed_by: performedBy,
        details: `Deleted ${deleteTargets.map(r => `${r.product_name} (${r.quantity} ${r.unit || 'units'})`).join(', ')}. Reason: ${deleteReason.trim()}. Snapshot: ${JSON.stringify(deleteTargets)}`,
        timestamp: new Date().toISOString(),
      });

      addNotification?.(`${deleteTargets.length} stock item${deleteTargets.length !== 1 ? 's' : ''} deleted.`);
      setSelectedStockIds(new Set());
      setDeleteTargets(null);
      setDeleteReason('');
      setDeleteConfirmText('');
      setOpenOrdersWarning([]);
      fetchData();
    } catch (e: any) {
      console.error(e);
      addNotification?.(e.message || 'Failed to delete stock.');
    } finally {
      setDeletingStock(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Stock Management</h2>
        <p className="text-xs text-[var(--text-muted)]">Correct approved cargo entries or remove stock items entirely.</p>
      </div>

      {/* Correct a Cargo Entry */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3 flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Edit3 size={16} className="text-[var(--accent)]" /> Correct a Cargo Entry
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Fix a mistake in a previously-approved intake — corrections adjust current stock and are logged to the audit trail.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={cargoSearch}
              onChange={e => setCargoSearch(e.target.value)}
              placeholder="Search by product, goods code, supplier..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-[var(--bg-input)]">
              <tr className="border-b border-[var(--border)]">
                {['Goods Code', 'Product', 'Supplier', 'Qty', 'Weight (t)', ''].map(h => (
                  <th key={h} className="py-2 px-3 text-[var(--text-muted)] font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {approvedCargo.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">No approved cargo entries found.</td></tr>
              ) : approvedCargo.map(c => (
                <tr key={c.id} className="hover:bg-[var(--accent-light)]">
                  <td className="py-2.5 px-3 font-mono text-[10px] text-[var(--text-secondary)]">{c.goods_code || c.id.slice(0, 8)}</td>
                  <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">{c.product_name}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{c.company || '—'}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{c.quantity}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{c.weight}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => openCorrection(c)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--accent-light)] cursor-pointer">
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Stock — delete stock items */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--box-shadow)]">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3 flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
              <Trash2 size={16} className="text-[var(--accent)]" /> Manage Stock
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {getSetting('management_can_delete_stock', true)
                ? 'Remove a stock item entirely — this cannot be undone. A reason is logged to the audit trail.'
                : 'Stock deletion is currently disabled by the CEO.'}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {getSetting('management_can_delete_stock', true) && selectedStockIds.size > 0 && (
              <button onClick={() => openDeleteStock(filteredStock.filter(s => selectedStockIds.has(s.id)))}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 cursor-pointer whitespace-nowrap">
                <Trash2 size={12} /> Delete {selectedStockIds.size} Selected
              </button>
            )}
            <div className="relative flex-1 sm:w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                placeholder="Search by product, code, category..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-[var(--bg-input)]">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 px-3 w-8">
                  <input type="checkbox"
                    disabled={!getSetting('management_can_delete_stock', true)}
                    checked={filteredStock.length > 0 && filteredStock.every(s => selectedStockIds.has(s.id))}
                    onChange={e => {
                      setSelectedStockIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) filteredStock.forEach(s => next.add(s.id));
                        else filteredStock.forEach(s => next.delete(s.id));
                        return next;
                      });
                    }}
                    className="cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" />
                </th>
                {['Product', 'Category', 'Qty', 'Unit', ''].map(h => (
                  <th key={h} className="py-2 px-3 text-[var(--text-muted)] font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredStock.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">No stock items found.</td></tr>
              ) : filteredStock.map(s => (
                <tr key={s.id} className="hover:bg-[var(--accent-light)]">
                  <td className="py-2.5 px-3">
                    <input type="checkbox" disabled={!getSetting('management_can_delete_stock', true)}
                      checked={selectedStockIds.has(s.id)} onChange={() => toggleStockSelect(s.id)}
                      className="cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" />
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">{s.product_name}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{s.category || '—'}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{s.quantity}</td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">{s.unit || 'units'}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => openDeleteStock([s])} disabled={!getSetting('management_can_delete_stock', true)}
                      title={!getSetting('management_can_delete_stock', true) ? 'Stock deletion is currently disabled by the CEO' : undefined}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-rose-300 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete stock confirmation modal */}
      {deleteTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-500" /> Delete {deleteTargets.length === 1 ? 'Stock Item' : `${deleteTargets.length} Stock Items`}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {deleteTargets.length === 1
                  ? <>This permanently removes <strong className="text-[var(--text-primary)]">{deleteTargets[0].product_name}</strong> ({deleteTargets[0].quantity} {deleteTargets[0].unit || 'units'}) from inventory. This cannot be undone.</>
                  : `This permanently removes ${deleteTargets.length} stock items from inventory. This cannot be undone.`}
              </p>
            </div>
            {deleteTargets.length > 1 && (
              <div className="max-h-32 overflow-y-auto bg-[var(--bg-input)] rounded-xl p-2 space-y-1">
                {deleteTargets.map(t => (
                  <p key={t.id} className="text-[11px] text-[var(--text-secondary)]">• {t.product_name} — {t.quantity} {t.unit || 'units'}</p>
                ))}
              </div>
            )}
            {loadingDeleteContext ? (
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Checking current stock and open orders…</p>
            ) : openOrdersWarning.length > 0 && (
              <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 space-y-0.5">
                <p className="font-semibold">Heads up — these products still have unfulfilled orders:</p>
                {openOrdersWarning.map(w => (
                  <p key={w.product}>• {w.product}: {w.count} open order{w.count !== 1 ? 's' : ''}</p>
                ))}
                <p>Deleting stock won't cancel or change those orders.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reason for deletion <span className="text-rose-500">*</span></label>
              <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={2}
                placeholder="E.g. Discontinued product, duplicate entry, written off"
                className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Type <span className="font-mono font-bold text-[var(--text-primary)]">{deleteConfirmExpected}</span> to confirm <span className="text-rose-500">*</span>
              </label>
              <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={deleteConfirmExpected}
                className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setDeleteTargets(null); setDeleteReason(''); setDeleteConfirmText(''); setOpenOrdersWarning([]); }} disabled={deletingStock}
                className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={confirmDeleteStock} disabled={deletingStock || deleteConfirmText.trim() !== deleteConfirmExpected || !deleteReason.trim()}
                className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {deletingStock ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correct cargo entry modal */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">Correct Entry — {correctionTarget.product_name}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Goods Code: {correctionTarget.goods_code || correctionTarget.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Quantity</label>
                <input type="number" value={correctionForm.quantity} onChange={e => setCorrectionForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Weight (tons)</label>
                <input type="number" step="0.001" value={correctionForm.weight} onChange={e => setCorrectionForm(f => ({ ...f, weight: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Country</label>
                <input value={correctionForm.country} onChange={e => setCorrectionForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Company / Carrier</label>
                <input value={correctionForm.company} onChange={e => setCorrectionForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Destination</label>
                <input value={correctionForm.destination} onChange={e => setCorrectionForm(f => ({ ...f, destination: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Discrepancies</label>
                <input value={correctionForm.discrepancies} onChange={e => setCorrectionForm(f => ({ ...f, discrepancies: e.target.value }))}
                  placeholder="None"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Unit Cost (GHS)</label>
                <input type="number" step="0.01" value={correctionForm.unitPrice} onChange={e => setCorrectionForm(f => ({ ...f, unitPrice: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reason for correction <span className="text-rose-500">*</span></label>
              <textarea value={correctionForm.note} onChange={e => setCorrectionForm(f => ({ ...f, note: e.target.value }))} rows={2}
                placeholder="E.g. Recount found 10 fewer units than originally logged"
                className="w-full px-3 py-2 text-sm rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]" />
            </div>
            {Number(correctionForm.quantity) !== (Number(correctionTarget.quantity) || 0) && (
              <p className="text-[11px] text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                Stock will be adjusted by {Number(correctionForm.quantity) - (Number(correctionTarget.quantity) || 0) > 0 ? '+' : ''}{Number(correctionForm.quantity) - (Number(correctionTarget.quantity) || 0)} units — not overwritten, since some may already be sold or dispatched. Selling price and any related damaged-goods expense record are not auto-updated; review those separately if this correction is material.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCorrectionTarget(null)} disabled={savingCorrection} className="flex-1 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-input)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={saveCorrection} disabled={savingCorrection} className="flex-1 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50">
                {savingCorrection ? 'Saving…' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
