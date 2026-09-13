// rebma-mobile/screens/finance/ExpensesScreen.tsx
// Ports: rebma-web/src/views/finance/ExpensesView.tsx — `finance_expenses`
// approve/reject/edit/delete/log, each mutation followed by a
// global_audit_history insert (verified exact pattern). Web's "Export
// PDF" menu item is just window.print() — not replicated (D100, mechanism
// 4 has no mobile-native equivalent).
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 UniversalExportModal
// screens — CSV+PDF+DOC, branded, columns verbatim from ExpensesView.tsx:66-74.
import { useCallback, useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

const CATEGORIES = ['Rent', 'Utilities', 'Transport', 'Maintenance', 'Admin', 'Other'];
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

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('finance_expenses').select('id, category, description, amount, date, status, submitted_by').order('date', { ascending: false }).limit(300);
    if (!error && data) setExpenses(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowAdd(false);
    setForm(emptyForm);
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
      <DataList
        columns={columns}
        data={expenses}
        rowKey={(e) => e.id}
        loading={loading}
        emptyTitle="No expenses logged yet"
        renderActions={(e) => e.status === 'Pending' ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Approve" size="sm" onPress={() => updateStatus(e, 'Approved')} />
            <Button label="Reject" size="sm" variant="danger" onPress={() => updateStatus(e, 'Rejected')} />
            <Button label="Delete" size="sm" variant="ghost" onPress={() => remove(e)} />
          </View>
        ) : (
          <Button label="Delete" size="sm" variant="ghost" onPress={() => remove(e)} />
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
