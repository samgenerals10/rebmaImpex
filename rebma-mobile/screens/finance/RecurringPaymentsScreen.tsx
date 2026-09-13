// rebma-mobile/screens/finance/RecurringPaymentsScreen.tsx
// Ports: rebma-web/src/views/finance/RecurringView.tsx — plain CRUD on
// `recurring_payments` + a pause/resume toggle.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
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

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

interface RecurringRow {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  next_date: string;
  account: string;
  category: string;
  status: string;
}

const emptyForm = { name: '', amount: '', frequency: 'monthly', nextDate: '', account: 'GHS Main', category: 'General' };

export default function RecurringPaymentsScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [rows, setRows] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<RecurringRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('recurring_payments').select('*').order('next_date');
    if (!error && data) setRows(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowAdd(false);
    setEditTarget(null);
    setForm(emptyForm);
  };

  const openEdit = (r: RecurringRow) => {
    setForm({ name: r.name, amount: String(r.amount), frequency: r.frequency, nextDate: r.next_date, account: r.account, category: r.category });
    setEditTarget(r);
  };

  const save = async () => {
    if (!form.name.trim() || !form.amount) {
      Alert.alert('Missing Info', 'Name and amount are required.');
      return;
    }
    setSubmitting(true);
    const payload = { name: form.name.trim(), amount: parseFloat(form.amount) || 0, frequency: form.frequency, next_date: form.nextDate || null, account: form.account, category: form.category };
    const { error } = editTarget
      ? await supabase.from('recurring_payments').update(payload).eq('id', editTarget.id)
      : await supabase.from('recurring_payments').insert({ ...payload, status: 'active', created_by: profile?.id || null });
    setSubmitting(false);
    if (error) {
      Alert.alert(editTarget ? 'Update Failed' : 'Add Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const togglePause = async (r: RecurringRow) => {
    const newStatus = r.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('recurring_payments').update({ status: newStatus }).eq('id', r.id);
    if (error) {
      Alert.alert('Failed', error.message);
      return;
    }
    load();
  };

  const remove = (r: RecurringRow) => {
    Alert.alert('Delete Recurring Bill', `Remove ${r.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('recurring_payments').delete().eq('id', r.id);
          if (error) {
            Alert.alert('Delete Failed', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const columns: DataColumn<RecurringRow>[] = [
    { key: 'name', label: 'Bill', primary: true },
    { key: 'status', label: 'Status', status: true, render: (r) => <Badge tone={r.status === 'active' ? 'success' : 'muted'} label={r.status} /> },
    { key: 'amount', label: 'Amount', render: (r) => `GHS ${Number(r.amount || 0).toLocaleString()}` },
    { key: 'frequency', label: 'Frequency' },
    { key: 'next_date', label: 'Next Due', render: (r) => r.next_date || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Recurring Bill" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <DataList
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="No recurring bills"
        renderActions={(r) => (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label={r.status === 'active' ? 'Pause' : 'Resume'} size="sm" variant="ghost" onPress={() => togglePause(r)} />
            <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(r)} />
            <Button label="Delete" size="sm" variant="danger" onPress={() => remove(r)} />
          </View>
        )}
      />

      <Sheet
        open={showAdd || !!editTarget}
        onClose={closeForm}
        title={editTarget ? 'Edit Recurring Bill' : 'Add Recurring Bill'}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : 'Save'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Name *"><Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} /></Field>
        <Field label="Amount (GHS) *"><Input value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Frequency"><SearchablePicker value={form.frequency} onChange={(v) => setForm((f) => ({ ...f, frequency: v }))} options={FREQ_OPTIONS} /></Field>
        <Field label="Next Due Date"><Input value={form.nextDate} onChangeText={(v) => setForm((f) => ({ ...f, nextDate: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Account"><Input value={form.account} onChangeText={(v) => setForm((f) => ({ ...f, account: v }))} /></Field>
        <Field label="Category"><Input value={form.category} onChangeText={(v) => setForm((f) => ({ ...f, category: v }))} /></Field>
      </Sheet>
    </Screen>
  );
}
