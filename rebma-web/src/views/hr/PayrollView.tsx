import React, { useState, useEffect } from 'react';
import {
  DollarSign, Download, Plus, Eye, EyeOff, CheckCircle, Clock,
  AlertCircle, X, FileText, Users, Search
} from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import { supabase } from '../../lib/supabaseClient';
import type { StaffMember, CurrentUser } from '../../types/erp';

interface PayrollBatch {
  id: string;
  period: string;
  status: 'DRAFT' | 'PROCESSING' | 'PAID';
  totalAmount: number;
  staffCount: number;
  processedAt?: string;
  createdAt: string;
}

interface PayrollEntry {
  staffId: string;
  staffName: string;
  department: string;
  role: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
}


interface Props {
  currentUser: CurrentUser | null;
  staffList: StaffMember[];
  addNotification: (msg: string) => void;
}

export default function PayrollView({ currentUser, staffList, addNotification }: Props) {
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState<PayrollBatch | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [newPeriod, setNewPeriod] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: bData }, { data: eData }] = await Promise.all([
          supabase.from('payroll_batches').select('*').order('created_at', { ascending: false }),
          supabase.from('payroll_entries').select('*').order('created_at', { ascending: false }),
        ]);
        if (bData) setBatches(bData as PayrollBatch[]);
        if (eData) setEntries(eData as PayrollEntry[]);
      } catch {
        // leave empty — show empty state
      }
      setLoading(false);
    };
    load();
  }, []);

  const isHR = currentUser?.department === 'HR' || currentUser?.isAdmin;
  const isFinance = currentUser?.department === 'Finance';

  const canSeeFullAmounts = isHR;
  const canSeeOwnSalary = !isHR && !isFinance;

  const formatAmount = (amount: number, forceHide?: boolean) => {
    if (forceHide) return '•••••';
    if (canSeeFullAmounts || (showAmounts && isHR)) return `GHS ${amount.toLocaleString()}`;
    if (isFinance) return `GHS ${amount.toLocaleString()}`;
    if (canSeeOwnSalary) return '•••••';
    return `GHS ${amount.toLocaleString()}`;
  };

  const depts = ['All', ...Array.from(new Set(entries.map(e => e.department)))];

  const filteredEntries = entries.filter(e => {
    const matchSearch = e.staffName.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || e.department === deptFilter;
    if (canSeeOwnSalary) return e.staffId === currentUser?.id && matchSearch;
    return matchSearch && matchDept;
  });

  // Dept totals for Finance view
  const deptTotals = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.department] = (acc[e.department] || 0) + e.netPay;
    return acc;
  }, {});

  const handleProcessBatch = async (batch: PayrollBatch) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = { ...batch, status: 'PAID' as const, processedAt: new Date().toISOString().split('T')[0] };
      await supabase.from('payroll_batches').update({ status: 'PAID' }).eq('id', batch.id);
      await supabase.from('global_audit_history').insert([{ department: 'HR', action: `Payroll processed: ${batch.period}`, performed_by: currentUser?.fullName || 'HR Admin', timestamp: new Date().toISOString() }]);
      setBatches(prev => prev.map(b => b.id === batch.id ? updated : b));
      if (activeBatch?.id === batch.id) setActiveBatch(updated);
      addNotification(`Payroll batch ${batch.period} processed`);
    } catch (err: any) {
      addNotification(`Error processing batch: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!newPeriod || submitting) return;
    setSubmitting(true);
    try {
      const batch: PayrollBatch = {
        id: `PAY-${Date.now()}`, period: newPeriod, status: 'DRAFT',
        totalAmount: entries.reduce((s, e) => s + e.netPay, 0),
        staffCount: entries.length, createdAt: new Date().toISOString().split('T')[0],
      };
      await supabase.from('payroll_batches').insert([batch]);
      setBatches(prev => [batch, ...prev]);
      addNotification(`Payroll batch created for ${newPeriod}`);
      setShowNewBatch(false);
      setNewPeriod('');
    } catch (err: any) {
      addNotification(`Error creating batch: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s: PayrollBatch['status']) => {
    if (s === 'PAID') return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Paid' };
    if (s === 'PROCESSING') return { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: 'Processing' };
    return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Draft' };
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--accent)]" />
            Payroll
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {isHR ? 'Manage payroll batches and salary details' : isFinance ? 'View department payroll totals' : 'View your salary information'}
          </p>
        </div>
        <div className="flex gap-2">
          {isHR && (
            <>
              <button onClick={() => setShowAmounts(p => !p)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--accent-light)] cursor-pointer">
                {showAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showAmounts ? 'Hide' : 'Show'} Amounts
              </button>
              <button onClick={() => setShowNewBatch(true)} disabled={submitting}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-[var(--accent)] text-white rounded-xl hover:opacity-90 cursor-pointer disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> New Batch
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {isHR && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Batches', value: batches.length, color: 'var(--accent)', icon: FileText },
            { label: 'Draft', value: batches.filter(b => b.status === 'DRAFT').length, color: '#f59e0b', icon: Clock },
            { label: 'Paid', value: batches.filter(b => b.status === 'PAID').length, color: '#10b981', icon: CheckCircle },
            { label: 'Staff on Payroll', value: entries.length, color: '#6366f1', icon: Users },
          ].map(card => (
            <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">{card.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}20`, color: card.color }}>
                  <card.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Finance: dept totals only */}
      {isFinance && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
          <h3 className="font-bold text-[var(--text-primary)] text-sm mb-3">Department Payroll Totals — June 2026</h3>
          <div className="space-y-2">
            {Object.entries(deptTotals).map(([dept, total]) => (
              <div key={dept} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--text-secondary)] font-medium">{dept}</span>
                <span className="text-sm font-bold text-[var(--text-primary)] font-mono">GHS {total.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 font-bold">
              <span className="text-sm text-[var(--text-primary)]">Grand Total</span>
              <span className="text-sm text-[var(--accent)] font-mono">GHS {Object.values(deptTotals).reduce((a, b) => a + b, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* HR: Batch list + entry table */}
      {isHR && !activeBatch && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--text-primary)] text-sm">Payroll Batches</h3>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No payroll batches yet</p>
              <p className="text-sm mt-1">They will appear here once added</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] font-semibold">
                  <th className="py-3 px-4 text-left">Period</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-right">Staff</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">Processed</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {batches.map(batch => {
                  const sb = statusBadge(batch.status);
                  return (
                    <tr key={batch.id} className="hover:bg-[var(--accent-light)] transition-colors cursor-pointer" onClick={() => setActiveBatch(batch)}>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{batch.period}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{batch.staffCount}</td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-[var(--text-primary)]">
                        {(showAmounts || canSeeFullAmounts) ? `GHS ${(Number(batch.totalAmount ?? 0)).toLocaleString()}` : '•••••'}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] hidden sm:table-cell">{batch.processedAt || '—'}</td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        {batch.status === 'DRAFT' && (
                          <button onClick={() => handleProcessBatch(batch)} disabled={submitting}
                            className="text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50">
                            {submitting ? 'Processing...' : 'Process'}
                          </button>
                        )}
                        {batch.status === 'PAID' && (
                          <button onClick={() => exportToCSV(entries, ['staffName', 'department', 'role', 'baseSalary', 'allowances', 'deductions', 'netPay'], `payroll_${batch.id}`)}
                            className="text-xs px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg font-semibold hover:opacity-80 cursor-pointer">
                            Export
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Batch detail: staff entries */}
      {isHR && activeBatch && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveBatch(null)}
              className="text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer">
              ← Back to Batches
            </button>
            <h3 className="font-bold text-[var(--text-primary)]">{activeBatch.period} — Payroll Entries</h3>
            <span className="ml-auto flex gap-2">
              {activeBatch.status === 'DRAFT' && (
                <button onClick={() => handleProcessBatch(activeBatch)}
                  className="text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg font-semibold cursor-pointer">
                  Process Batch
                </button>
              )}
              <button onClick={() => exportToCSV(entries, ['staffName', 'department', 'role', 'baseSalary', 'allowances', 'deductions', 'netPay'], `payroll_${activeBatch.id}`)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--border)] rounded-lg font-semibold cursor-pointer">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 flex-1 min-w-40">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..."
                className="bg-transparent border-none outline-none text-[var(--text-primary)] text-xs w-full" />
            </div>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-xs">
              {depts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] font-semibold">
                    <th className="py-3 px-4 text-left">Staff</th>
                    <th className="py-3 px-4 text-left hidden sm:table-cell">Department</th>
                    <th className="py-3 px-4 text-right">Base Salary</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell">Allowances</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell">Deductions</th>
                    <th className="py-3 px-4 text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredEntries.map(entry => (
                    <tr key={entry.staffId} className="hover:bg-[var(--accent-light)] transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[var(--text-primary)]">{entry.staffName}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{entry.role}</p>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] hidden sm:table-cell">{entry.department}</td>
                      <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">{formatAmount(entry.baseSalary)}</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-500 hidden md:table-cell">+{formatAmount(entry.allowances)}</td>
                      <td className="py-3 px-4 text-right font-mono text-rose-500 hidden md:table-cell">-{formatAmount(entry.deductions)}</td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-[var(--text-primary)]">{formatAmount(entry.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--bg)]">
                    <td colSpan={2} className="py-3 px-4 font-bold text-[var(--text-primary)]">Total</td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right font-bold font-mono text-[var(--accent)]">
                      {formatAmount(filteredEntries.reduce((s, e) => s + e.netPay, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Own salary view for regular staff */}
      {canSeeOwnSalary && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-bold text-[var(--text-primary)] mb-3">Your Salary — June 2026</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Base Salary', value: 6500, color: 'var(--accent)' },
              { label: 'Allowances', value: 800, color: '#10b981' },
              { label: 'Deductions', value: 650, color: '#ef4444' },
              { label: 'Net Pay', value: 6650, color: '#6366f1' },
            ].map(item => (
              <div key={item.label} className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
                <p className="text-lg font-bold font-mono" style={{ color: item.color }}>GHS {(Number(item.value ?? 0)).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Batch Modal */}
      {showNewBatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-primary)]">New Payroll Batch</h3>
              <button onClick={() => setShowNewBatch(false)} disabled={submitting} className="text-[var(--text-muted)] cursor-pointer disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Period (e.g. July 2026)</label>
              <input value={newPeriod} onChange={e => setNewPeriod(e.target.value)} placeholder="Month YYYY" disabled={submitting}
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text-primary)] text-sm outline-none disabled:opacity-50" />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowNewBatch(false)} disabled={submitting} className="px-4 py-2 text-xs border border-[var(--border)] rounded-xl text-[var(--text-secondary)] cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleCreateBatch} disabled={submitting} className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50">{submitting ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
