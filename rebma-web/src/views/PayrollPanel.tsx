// src/views/PayrollPanel.tsx
// HR: full CRUD, creates batches + items; Finance: totals only (no individual amounts); Staff: own items only
import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, X, ChevronDown, ChevronUp, Download, Banknote, Users, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { CurrentUser } from '../types/erp';
import { exportToCSV } from '../utils/export';

interface PayrollBatch {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'approved' | 'paid';
  total_amount: number;
  item_count: number;
  created_by: string;
  created_at: string;
}

interface PayrollItem {
  id: string;
  batch_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  notes: string;
}

interface PayrollPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const blankBatch = { name: '', period_start: '', period_end: '' };

export default function PayrollPanel({ currentUser, addNotification }: PayrollPanelProps) {
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchModal, setBatchModal] = useState<{ open: boolean } & typeof blankBatch>({ open: false, ...blankBatch });
  const [itemModal, setItemModal] = useState({ open: false, batch_id: '', employee_name: '', department: '', gross_amount: '', deductions: '', notes: '' });

  const isHR = currentUser?.department === 'HR' || currentUser?.department === 'HUMAN RESOURCES';
  const isFinance = currentUser?.department === 'FINANCE';
  const isCeo = currentUser?.isCeo || currentUser?.department === 'CEO' || currentUser?.department === 'MANAGEMENT';

  const canManage = isHR;
  const canViewTotals = isFinance || isCeo;

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data: batchData } = await supabase
        .from('payroll_batches')
        .select('*')
        .order('created_at', { ascending: false });
      if (batchData) setBatches(batchData);

      // Staff see own items; HR sees all; Finance sees none (totals from batch)
      if (canManage) {
        const { data: itemData } = await supabase.from('payroll_items').select('*').order('employee_name');
        if (itemData) setItems(itemData);
      } else if (!canViewTotals) {
        // Staff: own items only
        const { data: itemData } = await supabase.from('payroll_items').select('*').eq('employee_id', currentUser.id).order('created_at', { ascending: false });
        if (itemData) setItems(itemData);
      }
    } catch { /* tables may not exist */ }
    setLoading(false);
  }, [currentUser, canManage, canViewTotals]);

  useEffect(() => { load(); }, [load]);

  const saveBatch = async () => {
    if (!batchModal.name.trim() || !batchModal.period_start || !batchModal.period_end) return;
    setSaving(true);
    try {
      await supabase.from('payroll_batches').insert({
        name: batchModal.name,
        period_start: batchModal.period_start,
        period_end: batchModal.period_end,
        status: 'draft',
        total_amount: 0,
        item_count: 0,
        created_by: currentUser?.id,
      });
      addNotification(`Payroll batch "${batchModal.name}" created.`);
      setBatchModal({ open: false, ...blankBatch });
      load();
    } catch { addNotification('Could not create batch. Ensure payroll_batches table exists with RLS.'); }
    setSaving(false);
  };

  const saveItem = async () => {
    if (!itemModal.employee_name.trim() || !itemModal.gross_amount) return;
    setSaving(true);
    try {
      const gross = parseFloat(itemModal.gross_amount) || 0;
      const deductions = parseFloat(itemModal.deductions) || 0;
      await supabase.from('payroll_items').insert({
        batch_id: itemModal.batch_id,
        employee_id: null,
        employee_name: itemModal.employee_name,
        department: itemModal.department,
        gross_amount: gross,
        deductions,
        net_amount: gross - deductions,
        notes: itemModal.notes,
      });
      // Update batch totals
      const batchItems = items.filter(i => i.batch_id === itemModal.batch_id);
      const newTotal = batchItems.reduce((s, i) => s + i.net_amount, 0) + (gross - deductions);
      await supabase.from('payroll_batches').update({
        total_amount: newTotal,
        item_count: batchItems.length + 1,
      }).eq('id', itemModal.batch_id);
      addNotification('Payroll item added.');
      setItemModal(m => ({ ...m, open: false }));
      load();
    } catch { addNotification('Could not add payroll item.'); }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: 'approved' | 'paid') => {
    await supabase.from('payroll_batches').update({ status }).eq('id', id);
    addNotification(`Batch marked as ${status}.`);
    load();
  };

  const exportBatch = (batch: PayrollBatch) => {
    const batchItems = items.filter(i => i.batch_id === batch.id);
    if (canManage) {
      const rows = batchItems.map(i => ({ Name: i.employee_name, Dept: i.department, Gross: i.gross_amount, Deductions: i.deductions, Net: i.net_amount }));
      exportToCSV(rows, ['Name','Dept','Gross','Deductions','Net'], `payroll_${batch.name}`);
    } else {
      const rows = [{ Batch: batch.name, Period: `${batch.period_start} — ${batch.period_end}`, Total: batch.total_amount, Status: batch.status }];
      exportToCSV(rows, ['Batch','Period','Total','Status'], `payroll_summary_${batch.name}`);
    }
    addNotification('Payroll exported.');
  };

  const statusBadge = (s: string) => {
    if (s === 'paid') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">PAID</span>;
    if (s === 'approved') return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">APPROVED</span>;
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">DRAFT</span>;
  };

  // Staff view — own payslips only
  if (!canManage && !canViewTotals) {
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">My Payslips</h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Banknote className="w-10 h-10 text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No payslips found for your account.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const batch = batches.find(b => b.id === item.batch_id);
              return (
                <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-[var(--box-shadow)]">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{batch?.name || 'Payroll Batch'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{batch?.period_start} — {batch?.period_end}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[var(--accent)]">GHS {item.net_amount.toLocaleString()}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Net pay</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {canManage ? 'Payroll Management' : 'Payroll Overview'}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {canManage ? 'Create batches, add staff, approve and pay' : 'Summary totals only — individual amounts are confidential'}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setBatchModal({ open: true, ...blankBatch })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Batch
          </button>
        )}
      </div>

      {/* Summary cards for Finance */}
      {canViewTotals && !canManage && (
        <div className="grid grid-cols-3 gap-4">
          {(['draft','approved','paid'] as const).map(s => {
            const total = batches.filter(b => b.status === s).reduce((sum, b) => sum + b.total_amount, 0);
            return (
              <div key={s} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1 capitalize">{s}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">GHS {total.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-secondary)]">{batches.filter(b => b.status === s).length} batch{batches.filter(b => b.status === s).length !== 1 ? 'es' : ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Banknote className="w-10 h-10 text-[var(--text-muted)] mb-3" />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No payroll batches yet</p>
          {canManage && <p className="text-xs text-[var(--text-muted)]">Create a new batch to get started.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map(batch => {
            const batchItems = items.filter(i => i.batch_id === batch.id);
            const isExpanded = expandId === batch.id;
            return (
              <div key={batch.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{batch.name}</p>
                      {statusBadge(batch.status)}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {batch.period_start} — {batch.period_end}
                      {canManage && ` · ${batch.item_count} staff`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-[var(--accent)]">GHS {batch.total_amount.toLocaleString()}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{canManage ? 'Total net' : 'Total'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => exportBatch(batch)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-secondary)]" title="Export">
                      <Download className="w-4 h-4" />
                    </button>
                    {canManage && (
                      <button onClick={() => setExpandId(isExpanded ? null : batch.id)} className="p-1.5 rounded-lg hover:bg-[var(--accent-light)] cursor-pointer text-[var(--text-secondary)]">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded items (HR only) */}
                {canManage && isExpanded && (
                  <div className="border-t border-[var(--border)]">
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-xs font-bold text-[var(--text-secondary)]">Staff in this batch</p>
                      <div className="flex items-center gap-2">
                        {batch.status === 'draft' && (
                          <button onClick={() => updateStatus(batch.id, 'approved')} className="px-3 py-1 text-xs font-semibold bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600">Approve</button>
                        )}
                        {batch.status === 'approved' && (
                          <button onClick={() => updateStatus(batch.id, 'paid')} className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-lg cursor-pointer hover:bg-emerald-600">Mark Paid</button>
                        )}
                        <button onClick={() => setItemModal({ open: true, batch_id: batch.id, employee_name: '', department: '', gross_amount: '', deductions: '', notes: '' })}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[var(--accent)] text-white rounded-lg cursor-pointer hover:opacity-90">
                          <Plus className="w-3.5 h-3.5" /> Add Staff
                        </button>
                      </div>
                    </div>
                    {batchItems.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] px-4 pb-3">No staff added yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="border-t border-[var(--border)] bg-[var(--bg-input)]">
                            <th className="px-4 py-2 text-left font-semibold text-[var(--text-muted)]">Name</th>
                            <th className="px-4 py-2 text-left font-semibold text-[var(--text-muted)]">Dept</th>
                            <th className="px-4 py-2 text-right font-semibold text-[var(--text-muted)]">Gross</th>
                            <th className="px-4 py-2 text-right font-semibold text-[var(--text-muted)]">Deductions</th>
                            <th className="px-4 py-2 text-right font-semibold text-[var(--text-muted)]">Net Pay</th>
                          </tr></thead>
                          <tbody>
                            {batchItems.map(item => (
                              <tr key={item.id} className="border-t border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                                <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{item.employee_name}</td>
                                <td className="px-4 py-2 text-[var(--text-secondary)]">{item.department}</td>
                                <td className="px-4 py-2 text-right text-[var(--text-secondary)]">GHS {item.gross_amount.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right text-rose-500">GHS {item.deductions.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right font-bold text-[var(--accent)]">GHS {item.net_amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Batch Modal */}
      {batchModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">New Payroll Batch</h3>
              <button onClick={() => setBatchModal({ open: false, ...blankBatch })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={batchModal.name} onChange={e => setBatchModal(m => ({ ...m, name: e.target.value }))} placeholder="Batch name (e.g. June 2026 Payroll)…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Period Start</label>
                <input type="date" value={batchModal.period_start} onChange={e => setBatchModal(m => ({ ...m, period_start: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Period End</label>
                <input type="date" value={batchModal.period_end} onChange={e => setBatchModal(m => ({ ...m, period_end: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBatchModal({ open: false, ...blankBatch })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveBatch} disabled={saving || !batchModal.name.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {itemModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Add Staff to Batch</h3>
              <button onClick={() => setItemModal(m => ({ ...m, open: false }))} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={itemModal.employee_name} onChange={e => setItemModal(m => ({ ...m, employee_name: e.target.value }))} placeholder="Employee name…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <input value={itemModal.department} onChange={e => setItemModal(m => ({ ...m, department: e.target.value }))} placeholder="Department…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Gross (GHS)</label>
                <input type="number" value={itemModal.gross_amount} onChange={e => setItemModal(m => ({ ...m, gross_amount: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Deductions (GHS)</label>
                <input type="number" value={itemModal.deductions} onChange={e => setItemModal(m => ({ ...m, deductions: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setItemModal(m => ({ ...m, open: false }))} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveItem} disabled={saving || !itemModal.employee_name.trim() || !itemModal.gross_amount}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
