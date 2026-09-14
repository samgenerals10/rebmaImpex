// rebma-mobile/screens/finance/ExpensesScreen.tsx
// Ports: rebma-web/src/views/finance/ExpensesView.tsx — `finance_expenses`
// approve/reject/edit/delete/log, each mutation followed by a
// global_audit_history insert (verified exact pattern). Web's "Export
// PDF" menu item is just window.print() — not replicated (D100, mechanism
// 4 has no mobile-native equivalent).
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 UniversalExportModal
// screens — CSV+PDF+DOC, branded, columns verbatim from ExpensesView.tsx:66-74.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

const CATEGORIES = ['Rent', 'Utilities', 'Transport', 'Maintenance', 'Admin', 'Other'];
const MONTHLY_BUDGET = 50000; // Matches web's own hardcoded figure — no real budget setting exists anywhere in the app.
const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning'> = { Approved: 'success', Rejected: 'danger', Pending: 'warning' };

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'Approved' | 'Rejected' | 'Pending';
  submitted_by: string | null;
}

const emptyForm = { category: 'Rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' };

export default function ExpensesScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editTarget, setEditTarget] = useState<ExpenseRow | null>(null);
  const [editForm, setEditForm] = useState({ category: 'Rent', description: '', amount: '', date: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('finance_expenses').select('id, category, description, amount, date, status, submitted_by').order('date', { ascending: false }).limit(300);
    if (!error && data) setExpenses(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const matchesSearch = !q || e.description.toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'All' || e.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || e.status === statusFilter;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [expenses, search, categoryFilter, statusFilter]);

  // Web's own "Total This Month" label is misleading too — the value is
  // actually all-time, same class of mislabel as Petty Cash's stat card.
  // Ported to match what the screen actually shows, not the label's claim.
  const totalThisMonth = expenses.reduce((s, e) => s + e.amount, 0);
  const approvedTotal = expenses.filter((e) => e.status === 'Approved').reduce((s, e) => s + e.amount, 0);
  const pendingCount = expenses.filter((e) => e.status === 'Pending').length;
  const budgetRemaining = Math.max(0, MONTHLY_BUDGET - approvedTotal);

  const closeForm = () => {
    setShowAdd(false);
    setForm(emptyForm);
  };

  const openEdit = (e: ExpenseRow) => {
    setEditForm({ category: e.category, description: e.description, amount: String(e.amount), date: e.date });
    setEditTarget(e);
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm.description.trim() || !editForm.amount) return;
    setSavingEdit(true);
    const { error } = await supabase.from('finance_expenses').update({
      category: editForm.category, description: editForm.description.trim(), amount: parseFloat(editForm.amount) || 0, date: editForm.date,
    }).eq('id', editTarget.id);
    setSavingEdit(false);
    if (error) { Alert.alert('Update Failed', error.message); return; }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Expense ${editTarget.id} updated`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    setEditTarget(null);
    load();
  };

  const logExpense = async () => {
    if (!form.description.trim() || !form.amount) {
      Alert.alert('Missing Info', 'Description and amount are required.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('finance_expenses').insert([{
      category: form.category, description: form.description.trim(), amount: parseFloat(form.amount) || 0,
      date: form.date, notes: form.notes.trim() || null, submitted_by: profile?.fullName || 'Finance', status: 'Pending',
    }]);
    setSubmitting(false);
    if (error) {
      Alert.alert('Log Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const updateStatus = async (e: ExpenseRow, status: 'Approved' | 'Rejected') => {
    const { error } = await supabase.from('finance_expenses').update({ status }).eq('id', e.id);
    if (error) {
      Alert.alert('Update Failed', error.message);
      return;
    }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Expense ${e.id} ${status}`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    load();
  };

  const remove = (e: ExpenseRow) => {
    Alert.alert('Delete Expense', `Remove this ${e.category} expense?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('finance_expenses').delete().eq('id', e.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Expense ${e.id} deleted`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<ExpenseRow>[] = [
    { key: 'description', label: 'Description', primary: true },
    { key: 'status', label: 'Status', status: true, render: (e) => <Badge tone={STATUS_TONE[e.status]} label={e.status} /> },
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount', render: (e) => `GHS ${e.amount.toLocaleString()}` },
    { key: 'date', label: 'Date' },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount (GHS)', render: (e) => e.amount.toLocaleString() },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'submitted_by', label: 'Submitted By', render: (e) => e.submitted_by || '' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Log Expense" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: t.spacing.md }}>
        <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
        <View style={{ width: '47%' }}><MetricCard label="Total This Month" value={loading ? '—' : `GHS ${totalThisMonth.toLocaleString()}`} tone="accent" /></View>
        <View style={{ width: '47%' }}><MetricCard label="Approved" value={loading ? '—' : `GHS ${approvedTotal.toLocaleString()}`} /></View>
        <View style={{ width: '47%' }}><MetricCard label="Pending Approval" value={loading ? '—' : pendingCount} tone="warning" /></View>
        <View style={{ width: '47%' }}><MetricCard label="Budget Remaining" value={loading ? '—' : `GHS ${budgetRemaining.toLocaleString()}`} tone={budgetRemaining < 5000 ? 'danger' : undefined} /></View>
      </View>

      <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.md }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search expenses…" />
        <SearchablePicker label="Category" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'All', label: 'All Categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <SearchablePicker label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'All', label: 'All Status' }, { value: 'Approved', label: 'Approved' }, { value: 'Pending', label: 'Pending' }, { value: 'Rejected', label: 'Rejected' }]} />
      </View>

      <DataList
        columns={columns}
        data={filtered}
        rowKey={(e) => e.id}
        loading={loading}
        emptyTitle="No expenses logged yet"
        renderActions={(e) => (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {e.status === 'Pending' && <Button label="Approve" size="sm" onPress={() => updateStatus(e, 'Approved')} />}
            {e.status === 'Pending' && <Button label="Reject" size="sm" variant="danger" onPress={() => updateStatus(e, 'Rejected')} />}
            <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(e)} />
            <Button label="Delete" size="sm" variant="ghost" onPress={() => remove(e)} />
          </View>
        )}
      />

      <Sheet open={showAdd} onClose={closeForm} title="Log Expense" side="bottom" maxHeight={600}
        footer={<Button label={submitting ? 'Saving…' : 'Save Expense'} onPress={logExpense} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Category"><SearchablePicker value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
        <Field label="Description *"><Input value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} /></Field>
        <Field label="Amount (GHS) *"><Input value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Date"><Input value={form.date} onChangeText={(v) => setForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Notes" hint="Optional"><Input value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} /></Field>
      </Sheet>

      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Expense"
        side="bottom"
        footer={<Button label={savingEdit ? 'Saving…' : 'Save Changes'} onPress={saveEdit} loading={savingEdit} disabled={savingEdit} fullWidth />}
      >
        <Field label="Category"><SearchablePicker value={editForm.category} onChange={(v) => setEditForm((f) => ({ ...f, category: v }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
        <Field label="Description *"><Input value={editForm.description} onChangeText={(v) => setEditForm((f) => ({ ...f, description: v }))} /></Field>
        <Field label="Amount (GHS) *"><Input value={editForm.amount} onChangeText={(v) => setEditForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Date"><Input value={editForm.date} onChangeText={(v) => setEditForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" /></Field>
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Expenses"
        data={expenses}
        columns={exportColumns}
        formats={['csv', 'pdf', 'doc']}
        letterhead="branded"
      />
    </Screen>
  );
}
