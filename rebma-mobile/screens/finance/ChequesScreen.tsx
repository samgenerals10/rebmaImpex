// rebma-mobile/screens/finance/ChequesScreen.tsx
// Ports: rebma-web/src/views/finance/ChequesView.tsx — full CRUD on
// `finance_cheques` (no RPC) + status transitions. Marking Bounced
// notifies MANAGEMENT + CEO (exact message text ported) — verified this
// is the one write path with a real side effect beyond the row update +
// audit log every mutation gets.
//
// Export (Gap-Closure Backlog, Item 1): one of the 6 screens that used
// UniversalExportModal on web (D102) — CSV+PDF+DOC, branded letterhead.
// Column set/order/labels verbatim from ChequesView.tsx:61-70's
// chequeExportCols, keys adapted to this screen's raw snake_case fields
// (mobile has no camelCase mapper layer) — the web `render` for `amount`
// and `orderRef`'s '—' fallback are both preserved.
import { useCallback, useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import MetricCard from '../../components/ui/MetricCard';
import Sheet from '../../components/ui/Sheet';
import Input, { Field } from '../../components/ui/Input';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface ChequeRow {
  id: string;
  cheque_number: string;
  bank_name: string;
  account_name: string;
  account_number: string | null;
  amount: number;
  cheque_date: string | null;
  expected_clearing: string | null;
  order_ref: string | null;
  status: 'Received' | 'Deposited' | 'Cleared' | 'Bounced';
}

const STATUS_TONE: Record<string, 'info' | 'success' | 'danger' | 'muted'> = {
  Received: 'muted', Deposited: 'info', Cleared: 'success', Bounced: 'danger',
};

const emptyForm = { chequeNumber: '', bankName: '', accountName: '', accountNumber: '', amount: '', chequeDate: '', expectedClearing: '', orderRef: '' };

export default function ChequesScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('finance_cheques').select('*').order('cheque_date', { ascending: false }).limit(300);
    if (!error && data) setCheques(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = {
    total: cheques.length,
    cleared: cheques.filter((c) => c.status === 'Cleared').length,
    pending: cheques.filter((c) => ['Received', 'Deposited'].includes(c.status)).length,
    bounced: cheques.filter((c) => c.status === 'Bounced').length,
  };

  const closeForm = () => {
    setShowAdd(false);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.chequeNumber.trim() || !form.amount) {
      Alert.alert('Missing Info', 'Cheque number and amount are required.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('finance_cheques').insert([{
      cheque_number: form.chequeNumber.trim(), bank_name: form.bankName.trim(), account_name: form.accountName.trim(),
      account_number: form.accountNumber.trim() || null, amount: parseFloat(form.amount) || 0,
      cheque_date: form.chequeDate || null, expected_clearing: form.expectedClearing || null,
      order_ref: form.orderRef.trim() || null, status: 'Received', recorded_by: profile?.fullName || 'Finance',
    }]);
    setSubmitting(false);
    if (error) {
      Alert.alert('Add Failed', error.message);
      return;
    }
    closeForm();
    load();
  };

  const updateStatus = async (c: ChequeRow, status: ChequeRow['status']) => {
    if (status === 'Bounced') {
      await supabase.from('supplier_order_notifications').insert([
        { message: `⚠️ CHEQUE BOUNCED: Cheque #${c.cheque_number} from ${c.account_name} for GHS ${c.amount.toLocaleString()} has bounced. Immediate action required.`, notified_department: 'MANAGEMENT', read: false },
        { message: `⚠️ CHEQUE BOUNCED: Cheque #${c.cheque_number} from ${c.account_name} for GHS ${c.amount.toLocaleString()} has bounced. Immediate action required.`, notified_department: 'CEO', read: false },
      ]);
    }
    const { error } = await supabase.from('finance_cheques').update({ status }).eq('id', c.id);
    if (error) {
      Alert.alert('Update Failed', error.message);
      return;
    }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Cheque ${c.id} status updated to ${status}`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    load();
  };

  const columns: DataColumn<ChequeRow>[] = [
    { key: 'account_name', label: 'Account', primary: true },
    { key: 'status', label: 'Status', status: true, render: (c) => <Badge tone={STATUS_TONE[c.status]} label={c.status} /> },
    { key: 'cheque_number', label: 'Cheque #' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'amount', label: 'Amount', render: (c) => `GHS ${c.amount.toLocaleString()}` },
  ];

  // Verbatim column set/order/labels from ChequesView.tsx:61-70.
  const exportColumns: ExportColumn[] = [
    { key: 'cheque_number', label: 'Cheque #' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'account_name', label: 'Account Name' },
    { key: 'amount', label: 'Amount (GHS)', render: (c) => Number(c.amount).toLocaleString() },
    { key: 'cheque_date', label: 'Cheque Date' },
    { key: 'expected_clearing', label: 'Expected Clearing' },
    { key: 'status', label: 'Status' },
    { key: 'order_ref', label: 'Order Ref', render: (c) => c.order_ref || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Add Cheque" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total" value={loading ? '—' : totals.total} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Cleared" value={loading ? '—' : totals.cleared} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Pending" value={loading ? '—' : totals.pending} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Bounced" value={loading ? '—' : totals.bounced} tone="danger" /></View>
        </View>

        <DataList
          columns={columns}
          data={cheques}
          rowKey={(c) => c.id}
          loading={loading}
          emptyTitle="No cheques on file"
          renderActions={(c) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {c.status !== 'Cleared' && <Button label="Mark Cleared" size="sm" onPress={() => updateStatus(c, 'Cleared')} />}
              {c.status !== 'Bounced' && <Button label="Mark Bounced" size="sm" variant="danger" onPress={() => updateStatus(c, 'Bounced')} />}
            </View>
          )}
        />
      </View>

      <Sheet open={showAdd} onClose={closeForm} title="Add Cheque" side="bottom" maxHeight={640}
        footer={<Button label={submitting ? 'Saving…' : 'Save Cheque'} onPress={save} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Cheque Number *"><Input value={form.chequeNumber} onChangeText={(v) => setForm((f) => ({ ...f, chequeNumber: v }))} /></Field>
        <Field label="Bank Name"><Input value={form.bankName} onChangeText={(v) => setForm((f) => ({ ...f, bankName: v }))} /></Field>
        <Field label="Account Name"><Input value={form.accountName} onChangeText={(v) => setForm((f) => ({ ...f, accountName: v }))} /></Field>
        <Field label="Account Number" hint="Optional"><Input value={form.accountNumber} onChangeText={(v) => setForm((f) => ({ ...f, accountNumber: v }))} /></Field>
        <Field label="Amount (GHS) *"><Input value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Cheque Date"><Input value={form.chequeDate} onChangeText={(v) => setForm((f) => ({ ...f, chequeDate: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Expected Clearing" hint="Optional"><Input value={form.expectedClearing} onChangeText={(v) => setForm((f) => ({ ...f, expectedClearing: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Order Reference" hint="Optional"><Input value={form.orderRef} onChangeText={(v) => setForm((f) => ({ ...f, orderRef: v }))} /></Field>
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Cheques"
        data={cheques}
        columns={exportColumns}
        formats={['csv', 'pdf', 'doc']}
        letterhead="branded"
      />
    </Screen>
  );
}
