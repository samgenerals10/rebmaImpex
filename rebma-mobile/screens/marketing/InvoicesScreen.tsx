// rebma-mobile/screens/marketing/InvoicesScreen.tsx
// Ports: rebma-web/src/views/ceo/InvoicesView.tsx (shared with CEO dept)
// — `proforma_invoices` CRUD (a distinct "quote" entity, not `orders`).
// Web's "Print/Share" builds a hand-rolled HTML string and opens it in a
// new browser tab relying on window.print() — no real PDF/share
// capability behind it (confirmed by reading the source), so it's
// dropped (D23); the real data capability (create/list/view proformas)
// is fully preserved. Insert shape matches apiClient.ts's
// createProforma() exactly, including its 15% default tax rate.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';

interface ProformaRow {
  id: string;
  client_name: string;
  line_items: { productName: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  status: string;
  created_at: string;
}

interface LineItem {
  productName: string;
  quantity: string;
  unitPrice: string;
}

const TAX_RATE = 0.15;
const STATUS_TONE: Record<string, 'muted' | 'info' | 'success'> = { DRAFT: 'muted', SENT: 'info', CONVERTED: 'success' };

export default function InvoicesScreen() {
  const t = useTheme();
  const [proformas, setProformas] = useState<ProformaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<ProformaRow | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ productName: '', quantity: '1', unitPrice: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('proforma_invoices').select('id, client_name, line_items, subtotal, tax_amount, grand_total, status, created_at').order('created_at', { ascending: false }).limit(200);
    if (!error && data) setProformas(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addLine = () => setLineItems((prev) => [...prev, { productName: '', quantity: '1', unitPrice: '' }]);
  const removeLine = (idx: number) => setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const updateLine = (idx: number, patch: Partial<LineItem>) => setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const validItems = lineItems.filter((i) => i.productName.trim() && i.unitPrice);
  const subtotal = validItems.reduce((s, i) => s + (parseInt(i.quantity, 10) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const taxAmount = subtotal * TAX_RATE;
  const grandTotal = subtotal + taxAmount;

  const closeForm = () => {
    setShowAdd(false);
    setClientName('');
    setClientPhone('');
    setLineItems([{ productName: '', quantity: '1', unitPrice: '' }]);
  };

  const submit = async () => {
    if (!clientName.trim()) {
      Alert.alert('Missing Info', 'Client name is required.');
      return;
    }
    if (validItems.length === 0) {
      Alert.alert('Missing Info', 'Add at least one line item with a price.');
      return;
    }
    setSubmitting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const record = {
      order_id: null,
      client_name: clientName.trim(),
      line_items: validItems.map((i) => ({ productName: i.productName.trim(), quantity: parseInt(i.quantity, 10) || 1, unitPrice: parseFloat(i.unitPrice) || 0 })),
      subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      currency: 'GHS',
      status: 'DRAFT',
      created_by: sessionData.session?.user?.id || null,
      notes: null,
      contact_info: { customerPhone: clientPhone.trim() || '', companyPhone: '', companyEmail: '', companyAddress: '' },
    };
    let { error } = await supabase.from('proforma_invoices').insert(record);
    if (error?.message?.includes('contact_info')) {
      const { contact_info, ...withoutContactInfo } = record;
      ({ error } = await supabase.from('proforma_invoices').insert(withoutContactInfo));
    }
    setSubmitting(false);
    if (error) {
      Alert.alert('Failed to Create Proforma', error.message);
      return;
    }
    closeForm();
    load();
  };

  const columns: DataColumn<ProformaRow>[] = [
    { key: 'client_name', label: 'Client', primary: true },
    { key: 'status', label: 'Status', status: true, render: (p) => <Badge tone={STATUS_TONE[p.status] || 'muted'} label={p.status} /> },
    { key: 'grand_total', label: 'Total', render: (p) => `GHS ${Number(p.grand_total || 0).toLocaleString()}` },
    { key: 'created_at', label: 'Date', render: (p) => new Date(p.created_at).toLocaleDateString() },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Generate Proforma Invoice" onPress={() => setShowAdd(true)} fullWidth /></View>}
    >
      <DataList columns={columns} data={proformas} rowKey={(p) => p.id} loading={loading} emptyTitle="No proforma invoices yet" onRowPress={setDetail} />

      <Sheet open={showAdd} onClose={closeForm} title="Generate Proforma Invoice" side="bottom" maxHeight={680}
        footer={<Button label={submitting ? 'Creating…' : 'Create Proforma'} onPress={submit} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Client Name *"><Input value={clientName} onChangeText={setClientName} placeholder="Client name" /></Field>
        <Field label="Client Phone" hint="Optional"><Input value={clientPhone} onChangeText={setClientPhone} placeholder="Phone number" keyboardType="phone-pad" /></Field>

        <SheetSection label="Line Items">
          {lineItems.map((item, idx) => (
            <View key={idx} style={{ gap: t.spacing.sm, marginBottom: t.spacing.md, paddingBottom: t.spacing.md, borderBottomWidth: idx < lineItems.length - 1 ? 1 : 0, borderBottomColor: t.colors.border }}>
              <Input value={item.productName} onChangeText={(v) => updateLine(idx, { productName: v })} placeholder="Product / service" />
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <View style={{ flex: 1 }}><Input value={item.quantity} onChangeText={(v) => updateLine(idx, { quantity: v })} placeholder="Qty" keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Input value={item.unitPrice} onChangeText={(v) => updateLine(idx, { unitPrice: v })} placeholder="Unit price" keyboardType="decimal-pad" /></View>
                {lineItems.length > 1 && (
                  <Button variant="ghost" size="sm" icon={<Trash2 size={13} color={t.colors.status.danger.text} />} label="" onPress={() => removeLine(idx)} style={{ paddingHorizontal: t.spacing.sm }} />
                )}
              </View>
            </View>
          ))}
          <Button variant="ghost" size="sm" icon={<Plus size={13} color={t.colors.textSecondary} />} label="Add Line Item" onPress={addLine} />
        </SheetSection>

        <View style={{ gap: 4, paddingTop: t.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Subtotal</Text>
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>GHS {subtotal.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Tax (15%)</Text>
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>GHS {taxAmount.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Grand Total</Text>
            <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.accent }}>GHS {grandTotal.toLocaleString()}</Text>
          </View>
        </View>
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.client_name} subtitle={detail?.status} side="bottom" maxHeight={560}>
        {detail && (
          <SheetSection label="Line Items">
            {(detail.line_items || []).map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{item.productName} × {item.quantity}</Text>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>GHS {(item.quantity * item.unitPrice).toLocaleString()}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing.md, paddingTop: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Grand Total</Text>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.accent }}>GHS {Number(detail.grand_total || 0).toLocaleString()}</Text>
            </View>
          </SheetSection>
        )}
      </Sheet>
    </Screen>
  );
}
