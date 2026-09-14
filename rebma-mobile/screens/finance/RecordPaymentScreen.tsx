// rebma-mobile/screens/finance/RecordPaymentScreen.tsx
// Ports: rebma-web/src/views/FinanceDashboard.tsx's inline `RecordPayment`
// block (this sub-tab has no dedicated file on web — confirmed by
// checking App.tsx's router, it falls through to FinanceDashboard's
// default case) — `handleRecordPaymentSubmit`'s exact two branches
// (DIRECT payment vs CREDIT_SETTLEMENT) ported verbatim. Payment-mode
// options are now gated by the same cash/cheque/momo CEO settings web
// checks (getCeoSetting), not shown as a fixed list — a prior pass here
// always showed all 4 regardless of the CEO's toggles, which is a real
// functional gap (a disabled mode should be unselectable), not a
// harmless superset.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { approveAccountsReview } from '../../lib/financeActions';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

const ALL_PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash', settingKey: 'cash_payments_enabled' },
  { value: 'CHEQUE', label: 'Cheque', settingKey: 'cheque_payments_enabled' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', settingKey: 'momo_payments_enabled' },
  { value: 'CREDIT', label: 'Credit', settingKey: null },
];

interface CreditOrder {
  id: string;
  client_name: string;
  total_amount: number;
  ticket_number?: string;
  product_name?: string;
  metadata?: any;
}

export default function RecordPaymentScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [payType, setPayType] = useState<'DIRECT' | 'CREDIT'>('DIRECT');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [creditOrders, setCreditOrders] = useState<CreditOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [enabledSettings, setEnabledSettings] = useState<Record<string, boolean>>({ cash_payments_enabled: true, cheque_payments_enabled: true, momo_payments_enabled: true });

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('id, client_name, total_amount, ticket_number, product_name, metadata').eq('payment_mode', 'CREDIT').eq('status', 'PENDING_FINANCE');
    if (data) setCreditOrders(data as any);
  }, []);

  const paymentModes = useMemo(
    () => ALL_PAYMENT_MODES.filter((m) => !m.settingKey || enabledSettings[m.settingKey] !== false),
    [enabledSettings]
  );

  useEffect(() => {
    load();
    Promise.all([
      getCeoSetting('cash_payments_enabled', true),
      getCeoSetting('cheque_payments_enabled', true),
      getCeoSetting('momo_payments_enabled', true),
    ]).then(([cash, cheque, momo]) => setEnabledSettings({ cash_payments_enabled: cash, cheque_payments_enabled: cheque, momo_payments_enabled: momo }));
  }, [load]);

  const reset = () => {
    setClientName('');
    setAmount('');
    setSelectedOrderId('');
  };

  const submit = async () => {
    if (submitting) return;
    const now = new Date().toISOString();

    if (payType === 'DIRECT') {
      const amt = parseFloat(amount);
      if (!clientName.trim() || !amount || amt <= 0) {
        Alert.alert('Missing Info', 'Enter a valid client name and a positive amount.');
        return;
      }
      setSubmitting(true);
      const { error } = await supabase.from('finance_payments').insert({
        client_name: clientName.trim(), amount: amt, payment_mode: payMode, payment_type: 'DIRECT', created_at: now,
      });
      setSubmitting(false);
      if (error) {
        Alert.alert('Payment Save Failed', error.message);
        return;
      }
      Alert.alert('Payment Recorded', `Recorded direct payment of GHS ${amt.toLocaleString()} from ${clientName.trim()}.`);
      reset();
    } else {
      if (!selectedOrderId) {
        Alert.alert('Missing Info', 'Select a credit order to settle.');
        return;
      }
      const order = creditOrders.find((o) => o.id === selectedOrderId);
      if (!order) return;
      const paidAmount = amount && parseFloat(amount) > 0 ? parseFloat(amount) : order.total_amount;
      setSubmitting(true);
      const { error } = await supabase.from('finance_payments').insert({
        client_name: order.client_name, amount: paidAmount, payment_mode: payMode, payment_type: 'CREDIT_SETTLEMENT', order_id: selectedOrderId, created_at: now,
      });
      if (error) {
        setSubmitting(false);
        Alert.alert('Payment Save Failed', error.message);
        return;
      }
      // Routed through the same guarded path Orders Queue uses (stock
      // check, accounts_review_order RPC, stock deduction, Risk/Marketing
      // notifications, audit log) instead of a bare status write, so
      // settling a credit order from here can't silently skip any of that.
      const performedBy = profile?.fullName || 'Finance';
      const approved = await approveAccountsReview(order, performedBy);
      setSubmitting(false);
      if (!approved) return;
      Alert.alert('Settlement Recorded', `Credit settlement recorded for ${order.client_name}.`);
      reset();
      load();
    }
  };

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', backgroundColor: t.colors.bgCard, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, padding: 3 }}>
          {(['DIRECT', 'CREDIT'] as const).map((k) => (
            <Button
              key={k}
              variant={payType === k ? 'primary' : 'ghost'}
              size="sm"
              label={k === 'DIRECT' ? 'Record Inbound Payment' : 'Settle Credit'}
              onPress={() => setPayType(k)}
              style={{ flex: 1, borderWidth: 0 }}
            />
          ))}
        </View>

        <Card>
          {payType === 'DIRECT' ? (
            <Field label="Client Name *"><Input value={clientName} onChangeText={setClientName} placeholder="Client name" /></Field>
          ) : (
            <Field label="Credit Order *">
              <SearchablePicker
                value={selectedOrderId}
                onChange={setSelectedOrderId}
                placeholder="Select an order to settle"
                options={creditOrders.map((o) => ({ value: o.id, label: o.client_name, sublabel: `GHS ${o.total_amount.toLocaleString()}` }))}
              />
            </Field>
          )}
          <Field label="Amount (GHS)" hint={payType === 'CREDIT' ? 'Leave blank to settle the full order amount' : undefined}>
            <Input value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
          </Field>
          <Field label="Payment Mode">
            <SearchablePicker value={payMode} onChange={setPayMode} options={paymentModes} />
          </Field>
          <Button label={submitting ? 'Recording…' : 'Record Payment'} onPress={submit} loading={submitting} disabled={submitting} fullWidth />
        </Card>
      </View>
    </Screen>
  );
}
