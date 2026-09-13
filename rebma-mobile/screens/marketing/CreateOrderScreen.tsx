// rebma-mobile/screens/marketing/CreateOrderScreen.tsx
// Ports: rebma-web/src/views/marketing/OrdersView.tsx's order-creation
// form — the centerpiece of Phase 7.3. Verified in detail against source
// (see the plan's §1): line items priced off `goods_prices_catalog`
// (masked view — Marketing never sees cost), stock-shortage pre-check
// against `stock`, a client-name field that's a hybrid free-text +
// existing-customer-suggestion autocomplete (not SearchablePicker — see
// D24), a client-side credit pre-check mirroring the Phase 6
// create_order_with_stock_check() RPC's own server-side enforcement, and
// submission via that exact RPC (not a plain insert).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { outstandingCreditFor, type OrderLike } from '../../utils/customerRating';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import LocationPicker, { type LocationValue } from '../../components/shared/LocationPicker';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  discount_percent: number | null;
  credit_limit: number | null;
  credit_status: string | null;
}

interface LineItem {
  productName: string;
  quantity: string;
}

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CREDIT', label: 'Credit' },
];

function ticketNumber() {
  return `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
}

export default function CreateOrderScreen() {
  const t = useTheme();
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [maxCreditAmount, setMaxCreditAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [clientName, setClientName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [destination, setDestination] = useState<LocationValue | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ productName: '', quantity: '1' }]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pricesRes, stockRes, customersRes, ordersRes, settingRes] = await Promise.all([
      supabase.from('goods_prices_catalog').select('product_name, unit_price').order('product_name'),
      supabase.from('stock').select('product_name, quantity'),
      supabase.from('customers').select('id, name, phone, discount_percent, credit_limit, credit_status').order('name'),
      supabase.from('orders').select('id, customer_id, client_name, total_amount, amount_paid, payment_mode, status'),
      supabase.from('ceo_settings').select('setting_value').eq('setting_key', 'max_credit_amount').maybeSingle(),
    ]);
    const priceMap: Record<string, number> = {};
    for (const r of pricesRes.data || []) priceMap[r.product_name] = Number(r.unit_price) || 0;
    setProductPrices(priceMap);
    const stockMap: Record<string, number> = {};
    for (const r of stockRes.data || []) stockMap[r.product_name.trim().toLowerCase()] = Number(r.quantity) || 0;
    setStockLevels(stockMap);
    if (customersRes.data) setCustomers(customersRes.data as any);
    if (ordersRes.data) setOrders(ordersRes.data as any);
    setMaxCreditAmount(Number(settingRes.data?.setting_value) || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getStock = (productName: string) => stockLevels[productName.trim().toLowerCase()] ?? 0;

  const resolvedCustomer = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return null;
    return customers.find((c) => c.name.trim().toLowerCase() === q) || null;
  }, [clientName, customers]);

  const suggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q || resolvedCustomer) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [clientName, customers, resolvedCustomer]);

  const discountPct = resolvedCustomer?.discount_percent || 0;

  const itemsWithPricing = lineItems
    .filter((i) => i.productName.trim())
    .map((i) => {
      const base = productPrices[i.productName] ?? 0;
      const unitPrice = base * (1 - discountPct / 100);
      const qty = Math.max(1, parseInt(i.quantity, 10) || 1);
      return { productName: i.productName, quantity: qty, unitPrice, lineTotal: unitPrice * qty };
    });
  const orderTotal = itemsWithPricing.reduce((s, i) => s + i.lineTotal, 0);

  const outstanding = resolvedCustomer ? outstandingCreditFor(orders, resolvedCustomer) : 0;
  const wouldTotal = outstanding + orderTotal;
  const creditBlocked = paymentMode === 'CREDIT' && resolvedCustomer?.credit_status === 'ON_HOLD';
  const overLimit = paymentMode === 'CREDIT' && resolvedCustomer?.credit_limit != null && wouldTotal > resolvedCustomer.credit_limit;

  const addLine = () => setLineItems((prev) => [...prev, { productName: '', quantity: '1' }]);
  const removeLine = (idx: number) => setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const updateLine = (idx: number, patch: Partial<LineItem>) => setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const handleSubmit = async () => {
    if (submitting) return;
    if (!clientName.trim()) {
      Alert.alert('Missing Info', 'Customer name is required.');
      return;
    }
    const validItems = lineItems.filter((i) => i.productName.trim());
    if (validItems.length === 0) {
      Alert.alert('Missing Info', 'Add at least one product.');
      return;
    }
    const shortages = validItems.filter((i) => (parseInt(i.quantity, 10) || 0) > getStock(i.productName));
    if (shortages.length > 0) {
      Alert.alert('Insufficient Stock', shortages.map((i) => `${i.productName} (only ${getStock(i.productName).toLocaleString()} available)`).join(', '));
      return;
    }
    if (creditBlocked) {
      Alert.alert('Credit On Hold', `Credit is ON HOLD for ${resolvedCustomer!.name} — new credit orders are blocked. Contact Risk.`);
      return;
    }
    if (paymentMode === 'CREDIT' && resolvedCustomer?.credit_limit != null && overLimit) {
      Alert.alert('Credit Limit Exceeded', `Limit GHS ${resolvedCustomer.credit_limit.toLocaleString()}, currently outstanding GHS ${outstanding.toLocaleString()}, this order GHS ${orderTotal.toLocaleString()}.`);
      return;
    }
    if (paymentMode === 'CREDIT' && !resolvedCustomer?.credit_limit && maxCreditAmount > 0 && orderTotal > maxCreditAmount) {
      Alert.alert('Credit Cap Exceeded', `Credit orders are capped at GHS ${maxCreditAmount.toLocaleString()} by the CEO — this order is GHS ${orderTotal.toLocaleString()}.`);
      return;
    }

    setSubmitting(true);
    const productDisplay = itemsWithPricing.map((i) => i.productName).join(', ');
    const { data: inserted, error } = await supabase.rpc('create_order_with_stock_check', {
      p_ticket_number: ticketNumber(),
      p_client_name: clientName.trim(),
      p_product_name: productDisplay,
      p_destination: destination?.address || null,
      p_payment_mode: paymentMode,
      p_total_amount: orderTotal,
      p_status: 'PENDING_RISK',
      p_metadata: { items: itemsWithPricing, discountPercent: discountPct },
      p_customer_id: resolvedCustomer?.id || null,
      p_destination_lat: destination?.lat ?? null,
      p_destination_lng: destination?.lng ?? null,
      p_phone: phone.trim() || resolvedCustomer?.phone || null,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Order Failed', error.message);
      return;
    }
    try {
      await supabase.from('supplier_order_notifications').insert([{
        message: `New order from ${clientName.trim()} — GHS ${orderTotal.toLocaleString()}, awaiting Risk approval.`,
        notified_department: 'RISK',
        read: false,
        created_at: new Date().toISOString(),
      }]);
    } catch {}
    Alert.alert('Order Created', `Ticket ${inserted?.ticket_number || ''} sent to Risk for approval.`);
    setClientName('');
    setPhone('');
    setPaymentMode('CASH');
    setDestination(null);
    setLineItems([{ productName: '', quantity: '1' }]);
    load();
  };

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Customer</Text>
          <Field label="Client Name *">
            <Input
              value={clientName}
              onChangeText={(v) => { setClientName(v); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Type a name — existing customers will suggest"
            />
          </Field>
          {showSuggestions && suggestions.length > 0 && (
            <View style={{ marginTop: -t.spacing.md, marginBottom: t.spacing.md, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.sm, overflow: 'hidden' }}>
              {suggestions.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setClientName(c.name); setPhone(c.phone || ''); setShowSuggestions(false); }}
                  style={{ padding: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border, backgroundColor: t.colors.bgCard }}
                >
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Field label="Phone" hint="Optional"><Input value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" /></Field>
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Products</Text>
          <View style={{ gap: t.spacing.md }}>
            {lineItems.map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-end' }}>
                <View style={{ flex: 2 }}>
                  <SearchablePicker
                    label="Product"
                    value={item.productName}
                    onChange={(v) => updateLine(idx, { productName: v })}
                    placeholder="Select product"
                    options={Object.keys(productPrices).map((name) => ({ value: name, label: name, sublabel: `GHS ${productPrices[name].toLocaleString()}` }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input value={item.quantity} onChangeText={(v) => updateLine(idx, { quantity: v })} placeholder="Qty" keyboardType="numeric" />
                </View>
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeLine(idx)} style={{ padding: t.spacing.sm }}>
                    <Trash2 size={16} color={t.colors.status.danger.text} />
                  </Pressable>
                )}
              </View>
            ))}
            <Button variant="ghost" size="sm" icon={<Plus size={13} color={t.colors.textSecondary} />} label="Add Product" onPress={addLine} />
          </View>
          <View style={{ marginTop: t.spacing.lg, paddingTop: t.spacing.md, borderTopWidth: 1, borderTopColor: t.colors.border, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Order Total</Text>
            <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.accent }}>GHS {orderTotal.toLocaleString()}</Text>
          </View>
        </Card>

        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Payment & Delivery</Text>
          <Field label="Payment Mode">
            <SearchablePicker value={paymentMode} onChange={setPaymentMode} options={PAYMENT_MODES} />
          </Field>
          <Field label="Destination" hint="Optional"><LocationPicker value={destination} onChange={setDestination} /></Field>

          {paymentMode === 'CREDIT' && resolvedCustomer && (
            <View style={{ backgroundColor: creditBlocked || overLimit ? t.colors.status.danger.bg : t.colors.status.info.bg, borderRadius: t.radius.md, padding: t.spacing.md, marginTop: t.spacing.sm }}>
              {creditBlocked ? (
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>CREDIT ON HOLD for {resolvedCustomer.name} — contact Risk.</Text>
              ) : (
                <>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Credit Position</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginTop: 2 }}>
                    Limit: {resolvedCustomer.credit_limit != null ? `GHS ${resolvedCustomer.credit_limit.toLocaleString()}` : 'No per-customer limit — global cap applies'}
                  </Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textSecondary }}>Outstanding: GHS {outstanding.toLocaleString()}</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: overLimit ? t.colors.status.danger.text : t.colors.textPrimary }}>
                    Would total: GHS {wouldTotal.toLocaleString()}{overLimit ? ' — exceeds limit' : ''}
                  </Text>
                </>
              )}
            </View>
          )}
        </Card>

        <Button label={submitting ? 'Creating Order…' : 'Create Order'} onPress={handleSubmit} loading={submitting} disabled={submitting || loading} fullWidth />
      </View>
    </Screen>
  );
}
