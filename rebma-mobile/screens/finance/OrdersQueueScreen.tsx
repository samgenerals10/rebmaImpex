// rebma-mobile/screens/finance/OrdersQueueScreen.tsx
// Ports: rebma-web/src/views/finance/OrdersQueueView.tsx — the centerpiece
// of Phase 7.4 (see the plan's §1). Approve/reject/payment-recording write
// logic verified line-for-line against source. For PENDING_FINANCE orders
// there is no plain "Approve" separate from "Save Payment & Approve" —
// confirmed by reading the source, that's the only path. Amount-vs-total
// validation (blocks submit unless the amount matches the total or "Part
// Payment" is explicitly checked) is reproduced exactly. Dead
// camera/upload stub buttons (MoMo screenshot, Ghana Card front/back/
// customer photo) are not replicated (D26) — nothing real was behind them
// on web either.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { XCircle, RotateCcw } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { approveAccountsReview } from '../../lib/financeActions';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import MetricCard from '../../components/ui/MetricCard';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge, { statusTone } from '../../components/ui/Badge';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

interface OrderRow {
  id: string;
  ticket_number: string | null;
  client_name: string;
  product_name: string | null;
  total_amount: number;
  status: string;
  payment_mode: string;
  destination: string | null;
  metadata: any;
}

const STATUS_OPTIONS = ['ALL', 'PENDING_RISK', 'PENDING_MANAGEMENT', 'PENDING_FINANCE', 'PENDING_RISK_RELEASE', 'APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'RETURNED_FOR_CORRECTION'];

const EMPTY_FORM = {
  amountReceived: '', dateReceived: new Date().toISOString().slice(0, 10), notes: '',
  chequeNumber: '', bankName: '', accountName: '', accountNumber: '', branch: '', chequeDate: '', expectedClearing: '',
  network: 'MTN', momoNumber: '', momoAccountName: '', transactionId: '',
  ghanaCardNumber: '', dueDate: '', paymentTerms: 'Net 30', creditAmount: '',
};

function generateReceiptNumber() {
  return `RCT-${Date.now().toString().slice(-6)}`;
}

export default function OrdersQueueScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_FINANCE');
  const [modeFilter, setModeFilter] = useState('All');
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [payForm, setPayForm] = useState(EMPTY_FORM);
  const [isPartPayment, setIsPartPayment] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectMode, setRejectMode] = useState<'reject' | 'return'>('reject');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, ticket_number, client_name, product_name, total_amount, status, payment_mode, destination, metadata')
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setOrders(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch = !q || o.client_name.toLowerCase().includes(q) || (o.ticket_number || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const matchesMode = modeFilter === 'All' || o.payment_mode === modeFilter;
      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [orders, search, statusFilter, modeFilter]);

  const pendingOrders = orders.filter((o) => o.status === 'PENDING_FINANCE' || o.status === 'PENDING_MANAGEMENT');
  const approvedOrders = orders.filter((o) => ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status));
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');
  const rejectedOrders = orders.filter((o) => o.status === 'REJECTED');
  const pendingValue = pendingOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const approvedValue = approvedOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const deliveredValue = deliveredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);

  const openDetail = (o: OrderRow) => {
    setSelected(o);
    setPayForm({ ...EMPTY_FORM, creditAmount: String(o.total_amount) });
    setIsPartPayment(false);
    setRejectReason('');
    setShowReject(false);
  };

  const pMode = (selected?.payment_mode || 'CASH').toUpperCase().replace('MOBILE MONEY', 'MOBILE_MONEY');

  const enteredAmt = Number(payForm.amountReceived || 0);
  const isAboveTotal = !!selected && enteredAmt > selected.total_amount;
  const isBelowTotal = !!selected && enteredAmt < selected.total_amount;
  const isPartPaymentRequired = isBelowTotal && !isPartPayment;
  const isAmountInvalid = enteredAmt <= 0 || isAboveTotal || isPartPaymentRequired;
  const isCashOrMoMoOrCheque = ['CASH', 'MOBILE_MONEY', 'CHEQUE'].includes(pMode);
  const isSubmitDisabled = (isCashOrMoMoOrCheque && isAmountInvalid) || submitting;

  let amountFeedback = '';
  let amountTone: 'muted' | 'danger' | 'warning' | 'success' = 'muted';
  if (payForm.amountReceived !== '' && selected) {
    if (isAboveTotal) { amountFeedback = `Amount cannot exceed order total (GHS ${selected.total_amount.toLocaleString()})`; amountTone = 'danger'; }
    else if (isBelowTotal && !isPartPayment) { amountFeedback = 'Enable "Part Payment" to record a partial payment'; amountTone = 'danger'; }
    else if (isBelowTotal && isPartPayment) { amountFeedback = '✓ Part Payment enabled'; amountTone = 'warning'; }
    else if (enteredAmt === selected.total_amount) { amountFeedback = '✓ Matches total amount'; amountTone = 'success'; }
  }

  const rejectOrder = async (mode: 'reject' | 'return' = 'reject') => {
    if (!selected || submitting) return;
    setSubmitting(true);
    // DELIVERED/PENDING_RISK_RELEASE/etc. are now database-trigger-guarded —
    // this RPC is the only legal path PENDING_FINANCE ->
    // REJECTED/RETURNED_FOR_CORRECTION. Return-for-correction re-enters
    // the full chain at PENDING_RISK, per the approved decision.
    const { error } = await supabase.rpc('accounts_review_order', {
      p_order_id: selected.id, p_action: mode, p_note: rejectReason,
    });
    if (!error) {
      const verbLabel = mode === 'return' ? 'RETURNED FOR CORRECTION' : 'REJECTED';
      await supabase.from('supplier_order_notifications').insert([{ message: `Order ${selected.id} ${verbLabel} by Accounts. Reason: ${rejectReason}`, notified_department: 'MARKETING', read: false }]);
      await supabase.from('global_audit_history').insert([{ department: 'FINANCE', action: `Order ${selected.id} ${verbLabel}. Reason: ${rejectReason}`, performed_by: profile?.fullName || 'Finance', reference_id: selected.id, timestamp: new Date().toISOString() }]);
    }
    setSubmitting(false);
    if (error) {
      Alert.alert(mode === 'return' ? 'Return Failed' : 'Reject Failed', error.message);
      return;
    }
    setSelected(null);
    load();
  };

  const approveOrder = async (order: OrderRow) => {
    const performedBy = profile?.fullName || 'Finance';
    return approveAccountsReview(order, performedBy);
  };

  const savePaymentAndApprove = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const invoiceNumber = selected.ticket_number || `ORD-${String(selected.id).slice(0, 6).toUpperCase()}`;
    const amountPaid = Number(payForm.amountReceived || selected.total_amount);
    const paymentType = isPartPayment ? 'Part Payment' : 'Full Payment';
    const recordedBy = profile?.fullName || 'Finance';
    const createdAt = new Date().toISOString();
    const receiptNumber = generateReceiptNumber();

    const paymentRecord: Record<string, unknown> = {
      order_id: selected.id,
      client_name: selected.client_name,
      customer_name: selected.client_name,
      amount: amountPaid,
      payment_mode: selected.payment_mode,
      payment_type: paymentType,
      momo_number: payForm.momoNumber || null,
      transaction_id: payForm.transactionId || null,
      invoice_number: invoiceNumber,
      receipt_number: receiptNumber,
      recorded_by: recordedBy,
      created_at: createdAt,
      status: 'CONFIRMED',
      payment_details: {
        chequeNumber: payForm.chequeNumber || null,
        bankName: payForm.bankName || null,
        ghanaCardNumber: payForm.ghanaCardNumber || null,
        dueDate: payForm.dueDate || null,
        notes: payForm.notes || null,
      },
    };
    let { error: payErr } = await supabase.from('finance_payments').insert([paymentRecord]);
    if (payErr?.message?.includes('receipt_number')) {
      const { receipt_number, ...withoutReceiptNumber } = paymentRecord;
      ({ error: payErr } = await supabase.from('finance_payments').insert([withoutReceiptNumber]));
    }
    if (payErr) {
      setSubmitting(false);
      Alert.alert('Failed to Save Payment', payErr.message);
      return;
    }
    const approved = await approveOrder(selected);
    setSubmitting(false);
    if (!approved) return;
    setSelected(null);
    load();
  };

  const items = selected?.metadata?.items || [];

  const columns: DataColumn<OrderRow>[] = [
    { key: 'client_name', label: 'Client', primary: true },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone={statusTone(o.status)} label={o.status.replace(/_/g, ' ')} /> },
    { key: 'ticket_number', label: 'Ticket', render: (o) => o.ticket_number || '—' },
    { key: 'total_amount', label: 'Amount', render: (o) => `GHS ${Number(o.total_amount || 0).toLocaleString()}` },
    { key: 'payment_mode', label: 'Payment', render: (o) => o.payment_mode || '—' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          <View style={{ width: '47%' }}><MetricCard label="Pending Review" value={loading ? '—' : pendingOrders.length} sublabel={`GHS ${pendingValue.toLocaleString()}`} tone="warning" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Approved / Active" value={loading ? '—' : approvedOrders.length} sublabel={`GHS ${approvedValue.toLocaleString()}`} tone="accent" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Delivered" value={loading ? '—' : deliveredOrders.length} sublabel={`GHS ${deliveredValue.toLocaleString()}`} /></View>
          <View style={{ width: '47%' }}><MetricCard label="Rejected" value={loading ? '—' : rejectedOrders.length} sublabel="Orders declined" tone="danger" /></View>
        </View>
        <Input value={search} onChangeText={setSearch} placeholder="Search orders…" />
        <SearchablePicker label="Payment Mode" value={modeFilter} onChange={setModeFilter} options={['All', 'CASH', 'CHEQUE', 'MOBILE_MONEY', 'CREDIT'].map((m) => ({ value: m, label: m }))} />
        <SearchablePicker label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === 'ALL' ? 'All Status' : s.replace(/_/g, ' ') }))} />
        <DataList columns={columns} data={filtered} rowKey={(o) => o.id} loading={loading} emptyTitle="No orders found" onRowPress={openDetail} />
      </View>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.client_name} subtitle={selected?.ticket_number || undefined} side="bottom" maxHeight={720}>
        {selected && (
          <>
            <SheetSection label="Order Summary">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Product: {selected.product_name || '—'}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Destination: {selected.destination || '—'}</Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }}>Total: GHS {Number(selected.total_amount || 0).toLocaleString()}</Text>
            </SheetSection>

            {items.length > 0 && (
              <SheetSection label="Invoice Items">
                {items.map((item: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{item.productName} × {item.quantity}</Text>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {Number(item.lineTotal || 0).toLocaleString()}</Text>
                  </View>
                ))}
              </SheetSection>
            )}

            {selected.status === 'PENDING_FINANCE' && (
              <SheetSection label="Payment Details">
                {pMode === 'CASH' && (
                  <>
                    <Field label="Amount Received (GHS)"><Input value={payForm.amountReceived} onChangeText={(v) => setPayForm((f) => ({ ...f, amountReceived: v }))} keyboardType="decimal-pad" /></Field>
                    {amountFeedback ? <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status[amountTone].text, marginTop: -8, marginBottom: 8 }}>{amountFeedback}</Text> : null}
                    <PartPaymentToggle value={isPartPayment} onChange={setIsPartPayment} />
                    <Field label="Date Received"><Input value={payForm.dateReceived} onChangeText={(v) => setPayForm((f) => ({ ...f, dateReceived: v }))} /></Field>
                    <Field label="Notes" hint="Optional"><Input value={payForm.notes} onChangeText={(v) => setPayForm((f) => ({ ...f, notes: v }))} /></Field>
                  </>
                )}
                {pMode === 'CHEQUE' && (
                  <>
                    <Field label="Cheque Number *"><Input value={payForm.chequeNumber} onChangeText={(v) => setPayForm((f) => ({ ...f, chequeNumber: v }))} /></Field>
                    <Field label="Bank Name *"><Input value={payForm.bankName} onChangeText={(v) => setPayForm((f) => ({ ...f, bankName: v }))} /></Field>
                    <Field label="Account Name *"><Input value={payForm.accountName} onChangeText={(v) => setPayForm((f) => ({ ...f, accountName: v }))} /></Field>
                    <Field label="Account Number *"><Input value={payForm.accountNumber} onChangeText={(v) => setPayForm((f) => ({ ...f, accountNumber: v }))} /></Field>
                    <Field label="Branch" hint="Optional"><Input value={payForm.branch} onChangeText={(v) => setPayForm((f) => ({ ...f, branch: v }))} /></Field>
                    <Field label="Cheque Date *"><Input value={payForm.chequeDate} onChangeText={(v) => setPayForm((f) => ({ ...f, chequeDate: v }))} placeholder="YYYY-MM-DD" /></Field>
                    <Field label="Expected Clearing" hint="Optional"><Input value={payForm.expectedClearing} onChangeText={(v) => setPayForm((f) => ({ ...f, expectedClearing: v }))} placeholder="YYYY-MM-DD" /></Field>
                    <Field label="Amount"><Input value={payForm.amountReceived} onChangeText={(v) => setPayForm((f) => ({ ...f, amountReceived: v }))} keyboardType="decimal-pad" /></Field>
                    {amountFeedback ? <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status[amountTone].text, marginTop: -8, marginBottom: 8 }}>{amountFeedback}</Text> : null}
                    <PartPaymentToggle value={isPartPayment} onChange={setIsPartPayment} />
                  </>
                )}
                {pMode === 'MOBILE_MONEY' && (
                  <>
                    <Field label="Network"><SearchablePicker value={payForm.network} onChange={(v) => setPayForm((f) => ({ ...f, network: v }))} options={[{ value: 'MTN', label: 'MTN' }, { value: 'Vodafone', label: 'Vodafone' }, { value: 'AirtelTigo', label: 'AirtelTigo' }]} /></Field>
                    <Field label="Amount Received (GHS)"><Input value={payForm.amountReceived} onChangeText={(v) => setPayForm((f) => ({ ...f, amountReceived: v }))} keyboardType="decimal-pad" /></Field>
                    {amountFeedback ? <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.status[amountTone].text, marginTop: -8, marginBottom: 8 }}>{amountFeedback}</Text> : null}
                    <PartPaymentToggle value={isPartPayment} onChange={setIsPartPayment} />
                    <Field label="MoMo Number *"><Input value={payForm.momoNumber} onChangeText={(v) => setPayForm((f) => ({ ...f, momoNumber: v }))} keyboardType="phone-pad" /></Field>
                    <Field label="Account Name *"><Input value={payForm.momoAccountName} onChangeText={(v) => setPayForm((f) => ({ ...f, momoAccountName: v }))} /></Field>
                    <Field label="Transaction ID *"><Input value={payForm.transactionId} onChangeText={(v) => setPayForm((f) => ({ ...f, transactionId: v }))} /></Field>
                  </>
                )}
                {pMode === 'CREDIT' && (
                  <>
                    <View style={{ backgroundColor: t.colors.status.purple.bg, borderRadius: t.radius.md, padding: t.spacing.sm, marginBottom: t.spacing.md }}>
                      <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.status.purple.text }}>Credit orders require Management approval first. This form records the Ghana Card details for the customer.</Text>
                    </View>
                    <Field label="Ghana Card Number" hint="Optional"><Input value={payForm.ghanaCardNumber} onChangeText={(v) => setPayForm((f) => ({ ...f, ghanaCardNumber: v }))} placeholder="GHA-XXXXXXXXX-X" /></Field>
                    <Field label="Due Date *"><Input value={payForm.dueDate} onChangeText={(v) => setPayForm((f) => ({ ...f, dueDate: v }))} placeholder="YYYY-MM-DD" /></Field>
                    <Field label="Payment Terms"><Input value={payForm.paymentTerms} onChangeText={(v) => setPayForm((f) => ({ ...f, paymentTerms: v }))} /></Field>
                    <Field label="Credit Amount (GHS)"><Input value={payForm.creditAmount} onChangeText={(v) => setPayForm((f) => ({ ...f, creditAmount: v }))} keyboardType="decimal-pad" /></Field>
                  </>
                )}

                <View style={{ flexDirection: 'row', gap: t.spacing.md, marginTop: t.spacing.md }}>
                  <Button variant="danger" icon={<XCircle size={14} color="#fff" />} label="Reject" onPress={() => { setRejectMode('reject'); setShowReject(true); }} disabled={submitting} />
                  <Button variant="ghost" icon={<RotateCcw size={14} color={t.colors.textSecondary} />} label="Return" onPress={() => { setRejectMode('return'); setShowReject(true); }} disabled={submitting} />
                  <Button label={submitting ? 'Saving…' : 'Save Payment & Approve'} onPress={savePaymentAndApprove} loading={submitting} disabled={isSubmitDisabled} />
                </View>
              </SheetSection>
            )}
          </>
        )}
      </Sheet>

      <Sheet open={showReject} onClose={() => setShowReject(false)} title={rejectMode === 'return' ? 'Return Order for Correction' : 'Reject Order'} side="bottom"
        footer={<Button label={submitting ? 'Submitting…' : (rejectMode === 'return' ? 'Confirm Return' : 'Confirm Reject')} variant="danger" onPress={() => rejectOrder(rejectMode)} loading={submitting} disabled={submitting || !rejectReason.trim()} fullWidth />}
      >
        <Field label="Reason *"><Input value={rejectReason} onChangeText={setRejectReason} placeholder="Reason for rejection" /></Field>
      </Sheet>
    </Screen>
  );
}

function PartPaymentToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Button
      variant={value ? 'primary' : 'ghost'}
      size="sm"
      label={value ? 'Part Payment Enabled' : 'This is a Part Payment'}
      onPress={() => onChange(!value)}
      style={{ marginBottom: t.spacing.md }}
    />
  );
}
