// rebma-mobile/screens/finance/CreditMgmtScreen.tsx
// Ports: rebma-web/src/views/finance/CreditMgmtView.tsx — an order-level
// AR/collections aging report over `orders` where payment_mode='CREDIT'.
// Genuinely separate from Marketing/Risk's customer-level credit-limit
// workflow (confirmed by reading the source — this never touches
// customers.credit_limit/credit_status). Aging computation
// (Current/Due Soon/Overdue/Paid from due_date vs today) ported exactly.
// Payment recording goes through the record_credit_payment RPC (locks the
// order row, atomically bumps amount_paid, finance/admin role-guarded).
// "Send Reminder" only ever wrote an audit-history row on web (no real
// WhatsApp/email dispatch) — same omission.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import MetricCard from '../../components/ui/MetricCard';
import ExportSheet from '../../components/shared/ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

interface CreditEntry {
  id: string;
  customerName: string;
  orderRef: string;
  creditAmount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string;
  status: 'Current' | 'Due Soon' | 'Overdue' | 'Paid';
  phone: string;
  daysOverdue: number;
}

const STATUS_TONE: Record<CreditEntry['status'], 'success' | 'warning' | 'danger' | 'muted'> = {
  Current: 'success', 'Due Soon': 'warning', Overdue: 'danger', Paid: 'muted',
};

function mapCreditEntry(o: any): CreditEntry {
  const today = new Date();
  const due = new Date(o.due_date || o.created_at);
  const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
  const outstanding = (o.total_amount || 0) - (o.amount_paid || 0);
  let status: CreditEntry['status'] = 'Current';
  if (o.amount_paid >= o.total_amount) status = 'Paid';
  else if (diffDays > 0) status = 'Overdue';
  else if (diffDays > -7) status = 'Due Soon';
  return {
    id: o.id,
    customerName: o.client_name || '',
    orderRef: o.ticket_number || o.id,
    creditAmount: o.total_amount || 0,
    amountPaid: o.amount_paid || 0,
    outstanding,
    dueDate: o.due_date || (o.created_at || '').split('T')[0] || '',
    status,
    phone: o.phone || '',
    daysOverdue: diffDays > 0 ? diffDays : 0,
  };
}

export default function CreditMgmtScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [payTarget, setPayTarget] = useState<CreditEntry | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CreditEntry | null>(null);
  const [editForm, setEditForm] = useState({ clientName: '', totalAmount: '', amountPaid: '', dueDate: '', phone: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('orders').select('id, client_name, ticket_number, total_amount, amount_paid, due_date, created_at, phone').eq('payment_mode', 'CREDIT').order('created_at', { ascending: false }).limit(300);
    if (!error && data) setEntries(data.map(mapCreditEntry));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesSearch = !q || e.customerName.toLowerCase().includes(q) || e.orderRef.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  const totalOutstanding = entries.filter((e) => e.status !== 'Paid').reduce((s, e) => s + e.outstanding, 0);
  const overdueCount = entries.filter((e) => e.status === 'Overdue').length;
  const totalExtended = entries.reduce((s, e) => s + e.creditAmount, 0);
  const totalCollected = entries.reduce((s, e) => s + e.amountPaid, 0);

  const openEdit = (e: CreditEntry) => {
    setEditForm({ clientName: e.customerName, totalAmount: String(e.creditAmount), amountPaid: String(e.amountPaid), dueDate: e.dueDate, phone: e.phone });
    setEditTarget(e);
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm.clientName.trim() || !editForm.totalAmount) return;
    setSavingEdit(true);
    const { error } = await supabase.from('orders').update({
      client_name: editForm.clientName.trim(), total_amount: parseFloat(editForm.totalAmount) || 0,
      amount_paid: parseFloat(editForm.amountPaid) || 0, due_date: editForm.dueDate || null, phone: editForm.phone.trim() || null,
    }).eq('id', editTarget.id);
    setSavingEdit(false);
    if (error) { Alert.alert('Update Failed', error.message); return; }
    await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Credit order ${editTarget.id} updated`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
    setEditTarget(null);
    load();
  };

  const removeCredit = (e: CreditEntry) => {
    Alert.alert('Delete Credit Order', `Delete the credit order for ${e.customerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('orders').delete().eq('id', e.id);
          if (error) { Alert.alert('Delete Failed', error.message); return; }
          await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Credit order ${e.id} deleted`, performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString() }]);
          load();
        },
      },
    ]);
  };

  const openPay = (entry: CreditEntry) => {
    setPayTarget(entry);
    setPayAmount(String(entry.outstanding));
    setPayDate(new Date().toISOString().slice(0, 10));
  };

  const recordPayment = async () => {
    if (!payTarget) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Enter a positive payment amount.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('record_credit_payment', { p_order_id: payTarget.id, p_amount: amt, p_payment_date: payDate });
    setSubmitting(false);
    if (error) {
      Alert.alert('Payment Failed', error.message);
      return;
    }
    setPayTarget(null);
    load();
  };

  const sendReminder = async (entry: CreditEntry) => {
    try {
      await supabase.from('global_audit_history').insert({
        department: 'FINANCE', action: `Payment reminder sent to ${entry.customerName} for order ${entry.orderRef}, GHS ${entry.outstanding.toLocaleString()} outstanding.`,
        performed_by: profile?.fullName || 'Finance', timestamp: new Date().toISOString(),
      });
      Alert.alert('Reminder Logged', `Reminder recorded for ${entry.customerName}.`);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    }
  };

  const columns: DataColumn<CreditEntry>[] = [
    { key: 'customerName', label: 'Customer', primary: true },
    { key: 'status', label: 'Status', status: true, render: (e) => <Badge tone={STATUS_TONE[e.status]} label={e.status} /> },
    { key: 'orderRef', label: 'Order' },
    { key: 'outstanding', label: 'Outstanding', render: (e) => `GHS ${e.outstanding.toLocaleString()}` },
    { key: 'dueDate', label: 'Due', render: (e) => e.dueDate || '—' },
    { key: 'daysOverdue', label: 'Days Overdue', render: (e) => e.daysOverdue > 0 ? e.daysOverdue : '—' },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'customerName', label: 'Customer' },
    { key: 'orderRef', label: 'Order' },
    { key: 'creditAmount', label: 'Credit Amount (GHS)', render: (e) => e.creditAmount.toLocaleString() },
    { key: 'amountPaid', label: 'Amount Paid (GHS)', render: (e) => e.amountPaid.toLocaleString() },
    { key: 'outstanding', label: 'Outstanding (GHS)', render: (e) => e.outstanding.toLocaleString() },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'daysOverdue', label: 'Days Overdue', render: (e) => String(e.daysOverdue) },
    { key: 'status', label: 'Status' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Button label="Export CSV" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Extended" value={loading ? '—' : `GHS ${totalExtended.toLocaleString()}`} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Collected" value={loading ? '—' : `GHS ${totalCollected.toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Total Outstanding" value={loading ? '—' : `GHS ${totalOutstanding.toLocaleString()}`} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Overdue" value={loading ? '—' : overdueCount} tone="danger" /></View>
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Search customers…" />
        <SearchablePicker label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ALL', label: 'All' }, { value: 'Current', label: 'Current' }, { value: 'Due Soon', label: 'Due Soon' }, { value: 'Overdue', label: 'Overdue' }, { value: 'Paid', label: 'Paid' }]} />
        <DataList
          columns={columns}
          data={filtered}
          rowKey={(e) => e.id}
          loading={loading}
          emptyTitle="No credit orders found"
          renderActions={(e) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {e.status !== 'Paid' && <Button label="Remind" size="sm" variant="ghost" onPress={() => sendReminder(e)} />}
              {e.status !== 'Paid' && <Button label="Record Payment" size="sm" onPress={() => openPay(e)} />}
              <Button label="Edit" size="sm" variant="ghost" onPress={() => openEdit(e)} />
              <Button label="Delete" size="sm" variant="danger" onPress={() => removeCredit(e)} />
            </View>
          )}
        />
      </View>

      <Sheet open={!!payTarget} onClose={() => setPayTarget(null)} title="Record Credit Payment" subtitle={payTarget?.customerName} side="bottom"
        footer={<Button label={submitting ? 'Recording…' : 'Record Payment'} onPress={recordPayment} loading={submitting} disabled={submitting} fullWidth />}
      >
        <SheetSection label="Payment">
          <Field label="Amount (GHS) *"><Input value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" /></Field>
          <Field label="Payment Date"><Input value={payDate} onChangeText={setPayDate} placeholder="YYYY-MM-DD" /></Field>
        </SheetSection>
      </Sheet>

      <Sheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Credit Order"
        side="bottom"
        footer={<Button label={savingEdit ? 'Saving…' : 'Save Changes'} onPress={saveEdit} loading={savingEdit} disabled={savingEdit} fullWidth />}
      >
        <Field label="Client Name *"><Input value={editForm.clientName} onChangeText={(v) => setEditForm((f) => ({ ...f, clientName: v }))} /></Field>
        <Field label="Total Amount (GHS) *"><Input value={editForm.totalAmount} onChangeText={(v) => setEditForm((f) => ({ ...f, totalAmount: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Amount Paid (GHS)"><Input value={editForm.amountPaid} onChangeText={(v) => setEditForm((f) => ({ ...f, amountPaid: v }))} keyboardType="decimal-pad" /></Field>
        <Field label="Due Date"><Input value={editForm.dueDate} onChangeText={(v) => setEditForm((f) => ({ ...f, dueDate: v }))} placeholder="YYYY-MM-DD" /></Field>
        <Field label="Phone" hint="Optional"><Input value={editForm.phone} onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v }))} /></Field>
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Credit Management"
        data={filtered}
        columns={exportColumns}
        formats={['csv']}
      />
    </Screen>
  );
}
