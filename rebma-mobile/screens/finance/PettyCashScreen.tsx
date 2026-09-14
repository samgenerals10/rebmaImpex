// rebma-mobile/screens/finance/PettyCashScreen.tsx
// Ports: rebma-web/src/views/finance/PettyCashView.tsx — current float =
// most recent entry's balance_after (INITIAL_FLOAT=0 fallback); disbursal
// goes through the role-guarded, advisory-locked `disburse_petty_cash` RPC
// (exact params verified); replenishment request inserts into
// `float_requests` (PENDING_MANAGEMENT) + notifies MANAGEMENT — no RPC.
// Web's Receipt upload field (Upload/Camera buttons) is dead UI with no
// onChange handler — not replicated (D26).
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 UniversalExportModal
// screens — CSV+PDF+DOC, branded, columns verbatim from PettyCashView.tsx:61-69.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

const LOW_THRESHOLD = 3000;

interface PettyCashRow {
  id: string;
  description: string;
  amount: number;
  disbursed_to: string | null;
  category: string | null;
  balance_after: number;
  type: string;
  created_at: string;
}

export default function PettyCashScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<PettyCashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showDisburse, setShowDisburse] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [disbursedTo, setDisbursedTo] = useState('');
  const [category, setCategory] = useState('Admin');
  const [notes, setNotes] = useState('');

  const [showReplenish, setShowReplenish] = useState(false);
  const [replenAmount, setReplenAmount] = useState('');
  const [replenReason, setReplenReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<PettyCashRow | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '', disbursedTo: '', category: 'Admin' });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('finance_petty_cash').select('id, description, amount, disbursed_to, category, balance_after, type, created_at').order('created_at', { ascending: false }).limit(200);
    if (!error && data) setEntries(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentFloat = entries.length > 0 ? entries[0].balance_after : 0;
  const isLow = currentFloat < LOW_THRESHOLD;
  // Web's own label says "This Month" but its derivation is actually
  // all-time — ported to match, not silently "corrected".
  const totalDisbursed = entries.filter((e) => e.type === 'disbursement').reduce((s, e) => s + e.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.description.toLowerCase().includes(q) || (e.disbursed_to || '').toLowerCase().includes(q));
  }, [entries, search]);

  const openEdit = (e: PettyCashRow) => {
    setEditForm({ amount: String(e.amount), description: e.description, disbursedTo: e.disbursed_to || '', category: e.category || 'Admin' });
    setEditTarget(e);
  };

  // Matches web's own updateEntry() exactly, including its known
  // simplification: only this row's own balance_after is recomputed by
  // the amount delta, not every later entry's balance in the chain.
  const saveEdit = async () => {
    if (!editTarget || !editForm.amount || !editForm.description.trim() || !editForm.disbursedTo.trim()) return;
    setSavingEdit(true);
    const updatedAmount = parseFloat(editForm.amount) || 0;
    const diff = updatedAmount - editTarget.amount;
    const updatedBalance = editTarget.balance_after - diff;
    const { error } = await supabase.from('finance_petty_cash').update({
      amount: updatedAmount, description: editForm.description.trim(), disbursed_to: editForm.disbursedTo.trim(),
      category: editForm.category, balance_after: updatedBalance, updated_at: new Date().toISOString(),
    }).eq('id', editTarget.id);
    setSavingEdit(false);
    if (error) { Alert.alert('Update Failed', error.message); return; }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Petty cash ${editTarget.id} updated`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    setEditTarget(null);
    load();
  };

  const removeEntry = (e: PettyCashRow) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('finance_petty_cash').delete().eq('id', e.id);
          if (error) { Alert.alert('Delete Failed', error.message); return; }
          await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Petty cash ${e.id} deleted`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
          load();
        },
      },
    ]);
  };

  const disburse = async () => {
    if (!amount || !description.trim() || !disbursedTo.trim()) {
      Alert.alert('Missing Info', 'Amount, description, and recipient are required.');
      return;
    }
    const amt = parseFloat(amount);
    if (amt > currentFloat) {
      Alert.alert('Insufficient Float', 'This amount exceeds the current float balance.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('disburse_petty_cash', {
      p_amount: amt, p_description: description.trim(), p_disbursed_to: disbursedTo.trim(), p_category: category, p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Disbursement Failed', error.message);
      return;
    }
    setShowDisburse(false);
    setAmount(''); setDescription(''); setDisbursedTo(''); setCategory('Admin'); setNotes('');
    load();
  };

  const requestReplenishment = async () => {
    if (!replenAmount || !replenReason.trim()) {
      Alert.alert('Missing Info', 'Amount and reason are required.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('float_requests').insert([{
      department: 'FINANCE', requested_by: profile?.fullName || 'Finance', amount: parseFloat(replenAmount), reason: replenReason.trim(), status: 'PENDING_MANAGEMENT',
    }]);
    if (!error) {
      await supabase.from('supplier_order_notifications').insert([{ message: `Petty cash replenishment request: GHS ${replenAmount} needed. Reason: ${replenReason.trim()}`, notified_department: 'MANAGEMENT', read: false }]);
    }
    setSubmitting(false);
    if (error) {
      Alert.alert('Request Failed', error.message);
      return;
    }
    setShowReplenish(false);
    setReplenAmount('');
    setReplenReason('');
  };

  const columns: DataColumn<PettyCashRow>[] = [
    { key: 'description', label: 'Description', primary: true },
    { key: 'type', label: 'Type', status: true, render: (e) => <Badge tone={e.type === 'disbursement' ? 'warning' : 'success'} label={e.type} /> },
    { key: 'amount', label: 'Amount', render: (e) => `GHS ${e.amount.toLocaleString()}` },
    { key: 'disbursed_to', label: 'To', render: (e) => e.disbursed_to || '—' },
    { key: 'category', label: 'Category', render: (e) => e.category || '—' },
    { key: 'balance_after', label: 'Balance After', render: (e) => `GHS ${e.balance_after.toLocaleString()}` },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'created_at', label: 'Date' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount (GHS)', render: (e) => e.amount.toLocaleString() },
    { key: 'disbursed_to', label: 'Disbursed To', render: (e) => e.disbursed_to || '' },
    { key: 'category', label: 'Category', render: (e) => e.category || '' },
    { key: 'balance_after', label: 'Balance After', render: (e) => e.balance_after.toLocaleString() },
    { key: 'type', label: 'Type' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>
        <MetricCard label="Current Float" value={loading ? '—' : `GHS ${currentFloat.toLocaleString()}`} emphasis="primary" tone={isLow ? 'danger' : 'accent'} sublabel={isLow ? 'Below threshold, consider requesting replenishment' : undefined} />
        <MetricCard label="Total Disbursed This Month" value={loading ? '—' : `GHS ${totalDisbursed.toLocaleString()}`} />

        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <View style={{ flex: 1 }}><Button label="Disburse" onPress={() => setShowDisburse(true)} fullWidth /></View>
          <View style={{ flex: 1 }}><Button label="Request Replenishment" variant="ghost" onPress={() => setShowReplenish(true)} fullWidth /></View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Search entries…" />
        <DataList
          columns={columns}
          data={filtered}
          rowKey={(e) => e.id}
          loading={loading}
          emptyTitle="No petty cash activity yet"
          renderActions={(e) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(e)} />
              <Button label="Delete" size="sm" variant="danger" onPress={() => removeEntry(e)} />
            </View>
          )}
        />
      </View>

      <Sheet open={showDisburse} onClose={() => setShowDisburse(false)} title="Disburse Petty Cash" side="bottom" maxHeight={640}
        footer={<Button label={submitting ? 'Disbursing…' : 'Disburse'} onPress={disburse} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Amount (GHS) *"><Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /></Field>
        <Field label="Description *"><Input value={description} onChangeText={setDescription} placeholder="What is this for?" /></Field>
        <Field label="Disbursed To *"><Input value={disbursedTo} onChangeText={setDisbursedTo} placeholder="Recipient name" /></Field>
        <Field label="Category"><Input value={category} onChangeText={setCategory} placeholder="E.g., Admin" /></Field>
        <Field label="Notes" hint="Optional"><Input value={notes} onChangeText={setNotes} /></Field>
      </Sheet>

      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Entry"
        side="bottom"
        footer={<Button label={savingEdit ? 'Saving…' : 'Save Changes'} onPress={saveEdit} loading={savingEdit} disabled={savingEdit} fullWidth />}
      >
        <Field label="Amount (GHS) *"><Input value={editForm.amount} onChangeText={(v) => setEditForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Description *"><Input value={editForm.description} onChangeText={(v) => setEditForm((f) => ({ ...f, description: v }))} /></Field>
        <Field label="Disbursed To *"><Input value={editForm.disbursedTo} onChangeText={(v) => setEditForm((f) => ({ ...f, disbursedTo: v }))} /></Field>
        <Field label="Category"><Input value={editForm.category} onChangeText={(v) => setEditForm((f) => ({ ...f, category: v }))} /></Field>
      </Sheet>

      <Sheet open={showReplenish} onClose={() => setShowReplenish(false)} title="Request Replenishment" side="bottom"
        footer={<Button label={submitting ? 'Requesting…' : 'Send Request'} onPress={requestReplenishment} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Amount (GHS) *"><Input value={replenAmount} onChangeText={setReplenAmount} keyboardType="decimal-pad" /></Field>
        <Field label="Reason *"><Input value={replenReason} onChangeText={setReplenReason} placeholder="Why is replenishment needed?" /></Field>
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Petty Cash"
        data={entries}
        columns={exportColumns}
        formats={['csv', 'pdf', 'doc']}
        letterhead="branded"
      />
    </Screen>
  );
}
