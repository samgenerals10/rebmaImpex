// rebma-mobile/screens/ceo/SupplierOrdersScreen.tsx
// Ports: rebma-web/src/views/ceo/SupplierOrdersView.tsx (1089 lines, read
// in full) — D75, the heaviest new screen this phase. Paginated list via
// usePaginatedQuery (Phase 7.7, D49 — table supplier_orders, pageSize 50,
// mobile-appropriate vs web's 100), summary tiles, search+status filter,
// detail sheet, status actions matching exact write shapes verified
// against source: Authorise Payment (status/payment_authorised/
// payment_authorised_at/payment_reference + a PAYMENT_AUTHORISED audit
// row), Mark Shipped/Arrived (plain status flips), Notify Management/
// Operations (supplier_order_notifications insert + the matching
// *_notified boolean flag), and order creation via the atomic
// create_supplier_order RPC (p_order: {...}, exact payload shape, incl.
// the inline "new supplier" suppliers insert). Kept: WhatsApp send, a
// real Linking.openURL(wa.me/...) deep link (same pattern as Admin &
// Warehouse's DeliveriesScreen). Dropped: Email send (no real backend
// behind it in source — the state field exists but nothing sends it).
//
// Export (Gap-Closure Backlog, Item 1): mobile's earlier D11/D23 comment
// claiming export was already a documented drop was WRONG — a direct
// re-read of SupplierOrdersView.tsx confirmed real CSV+PDF export exists
// (list-level, different column sets per format) PLUS a separate per-order
// PDF of that order's own line items. Both ported now, verbatim columns.
import { useMemo, useState } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { Plus, Trash2, MessageCircle, Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { StatusTone } from '../../theme/tokens';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import ExportSheet from '../../components/shared/ExportSheet';
import { exportTableDocument, type ExportColumn } from '../../lib/exportEngine';

interface ProductItem { product_name: string; quantity: number; unit: string; unit_price: number; currency: string; total_price: number }
interface SupplierOrder {
  id: string;
  order_number: string;
  supplier_name: string;
  supplier_country: string;
  supplier_email?: string;
  products: ProductItem[];
  total_amount: number;
  currency: string;
  exchange_rate: number;
  total_amount_ghs: number;
  expected_delivery_date: string;
  shipping_method: string;
  port_of_entry: string;
  status: 'pending' | 'payment_authorised' | 'shipped' | 'arrived' | 'received' | 'completed';
  payment_reference?: string;
  notes?: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', payment_authorised: 'Payment Authorised', shipped: 'Shipped',
  arrived: 'Arrived', received: 'Received', completed: 'Completed',
};
const STATUS_TONE: Record<string, StatusTone> = {
  pending: 'warning', payment_authorised: 'info', shipped: 'purple',
  arrived: 'warning', received: 'success', completed: 'success',
};
const COUNTRIES = ['Poland', 'Turkey', 'Germany', 'UK', 'USA', 'China', 'India', 'Other'];
const UNITS = ['Tons', 'Kg', 'Cartons', 'Units'];
const CURRENCIES = ['USD', 'EUR', 'GBP'];

const emptyLine = (): { product_name: string; quantity: string; unit: string; unit_price: string } => ({ product_name: '', quantity: '', unit: 'Tons', unit_price: '' });

export default function SupplierOrdersScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const { rows: orders, setRows: setOrders, loading, hasMore, total, reload, loadMore } = usePaginatedQuery<SupplierOrder>({ table: 'supplier_orders', pageSize: 50 });
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detail, setDetail] = useState<SupplierOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [lineExporting, setLineExporting] = useState(false);

  const [authTarget, setAuthTarget] = useState<SupplierOrder | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [notifyTarget, setNotifyTarget] = useState<SupplierOrder | null>(null);
  const [notifyDept, setNotifyDept] = useState<'MANAGEMENT' | 'OPERATIONS'>('MANAGEMENT');
  const [notifyMessage, setNotifyMessage] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('Poland');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [portOfEntry, setPortOfEntry] = useState('Tema Port');
  const [expectedDate, setExpectedDate] = useState('');
  const [shippingMethod, setShippingMethod] = useState('Sea Freight');
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('15.4');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(false);

  const knownSuppliers = useMemo(() => Array.from(new Set(orders.map((o) => o.supplier_name))), [orders]);
  const isNewSupplier = supplierName.length > 2 && !knownSuppliers.includes(supplierName);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || o.order_number.toLowerCase().includes(q) || o.supplier_name.toLowerCase().includes(q) || o.products.some((p) => p.product_name.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const totalOrders = orders.length;
  const pendingPayment = orders.filter((o) => o.status === 'pending').length;
  const inTransit = orders.filter((o) => o.status === 'shipped').length;
  const thisMonthGhs = orders.filter((o) => new Date(o.created_at).getMonth() === new Date().getMonth()).reduce((s, o) => s + (o.total_amount_ghs || 0), 0);

  const updateStatus = async (id: string, status: SupplierOrder['status']) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      const { error } = await supabase.from('supplier_orders').update({ status }).eq('id', id);
      if (error) throw error;
      setDetail((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not update status.');
    } finally {
      setSubmitting(false);
    }
  };

  const authorisePayment = async () => {
    if (!authTarget) return;
    if (!paymentRef.trim()) { Alert.alert('Payment reference is required.'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('supplier_orders').update({
        status: 'payment_authorised', payment_authorised: true, payment_authorised_at: nowIso, payment_reference: paymentRef.trim(),
      }).eq('id', authTarget.id);
      if (error) throw error;
      await supabase.from('global_audit_history').insert({
        action: 'PAYMENT_AUTHORISED',
        details: `Order ${authTarget.order_number} | ${authTarget.supplier_name} | ${authTarget.currency} ${authTarget.total_amount} | Ref: ${paymentRef.trim()}`,
        performed_by: profile?.fullName || 'CEO',
      });
      setOrders((prev) => prev.map((o) => (o.id === authTarget.id ? { ...o, status: 'payment_authorised', payment_reference: paymentRef.trim() } : o)));
      setAuthTarget(null);
      setPaymentRef('');
      setDetail(null);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not authorise payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendNotify = async () => {
    if (!notifyTarget) return;
    if (!notifyMessage.trim()) { Alert.alert('Enter a message to send.'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('supplier_order_notifications').insert({
        order_id: notifyTarget.id, notified_department: notifyDept, message: notifyMessage.trim(), read: false,
      });
      const flag = notifyDept === 'MANAGEMENT' ? { management_notified: true } : { operations_notified: true };
      await supabase.from('supplier_orders').update(flag).eq('id', notifyTarget.id);
      setNotifyTarget(null);
      setNotifyMessage('');
      setDetail(null);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not send notification.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateLine = (i: number, patch: Partial<ReturnType<typeof emptyLine>>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const validLines = lines.filter((l) => l.product_name.trim() && l.unit_price);
  const totalAmount = validLines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const totalGhs = totalAmount * (Number(exchangeRate) || 0);

  const resetForm = () => {
    setShowForm(false);
    setSupplierName(''); setSupplierEmail(''); setSupplierContact(''); setSupplierCountry('Poland');
    setPortOfEntry('Tema Port'); setExpectedDate(''); setShippingMethod('Sea Freight'); setCurrency('USD');
    setExchangeRate('15.4'); setNotes(''); setLines([emptyLine()]); setWhatsappNumber(''); setSendWhatsapp(false);
  };

  const createOrder = async () => {
    if (!supplierName.trim() || validLines.length === 0) {
      Alert.alert('Missing Info', 'Supplier name and at least one priced product line are required.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      if (isNewSupplier) {
        await supabase.from('suppliers').insert({ name: supplierName, country: supplierCountry, contact_name: supplierContact, contact_email: supplierEmail, currency });
      }
      const products: ProductItem[] = validLines.map((l) => ({
        product_name: l.product_name.trim(), quantity: Number(l.quantity) || 0, unit: l.unit,
        unit_price: Number(l.unit_price) || 0, currency, total_price: (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
      }));
      const { data: created, error } = await supabase.rpc('create_supplier_order', {
        p_order: {
          supplier_name: supplierName, supplier_country: supplierCountry, supplier_email: supplierEmail,
          products, total_amount: totalAmount, currency, exchange_rate: Number(exchangeRate) || 0,
          total_amount_ghs: totalGhs, expected_delivery_date: expectedDate || null, shipping_method: shippingMethod,
          port_of_entry: portOfEntry, status: 'pending', notes: notes || null,
        },
      });
      if (error) throw error;

      const newOrder: SupplierOrder = {
        id: created.id, order_number: created.order_number, supplier_name: supplierName, supplier_country: supplierCountry,
        supplier_email: supplierEmail, products, total_amount: totalAmount, currency, exchange_rate: Number(exchangeRate) || 0,
        total_amount_ghs: totalGhs, expected_delivery_date: expectedDate, shipping_method: shippingMethod,
        port_of_entry: portOfEntry, status: 'pending', notes, created_at: created.created_at,
      };
      setOrders((prev) => [newOrder, ...prev]);

      if (sendWhatsapp && whatsappNumber.trim()) {
        const lines2 = [
          `*New Purchase Order — REBMA IMPEX Ghana Limited*`, `Order #: ${newOrder.order_number}`, ``,
          `*Products:*`, ...products.map((p) => `• ${p.product_name} — ${p.quantity} ${p.unit} @ ${p.currency} ${p.unit_price}/unit = ${p.currency} ${p.total_price.toLocaleString()}`),
          ``, `Total: ${currency} ${totalAmount.toLocaleString()} (approx GHS ${totalGhs.toLocaleString()})`,
          `Port of Entry: ${portOfEntry}`, `Expected Delivery: ${expectedDate || 'TBD'}`, ``,
          `Please confirm receipt and proceed as agreed.`, `Regards, ${profile?.fullName || 'CEO'} | REBMA IMPEX`,
        ];
        const digits = whatsappNumber.replace(/\D/g, '');
        Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(lines2.join('\n'))}`).catch(() => {
          Alert.alert('Could Not Open WhatsApp', 'No WhatsApp app is available.');
        });
      }

      resetForm();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not create supplier order.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: DataColumn<SupplierOrder>[] = [
    { key: 'supplier_name', label: 'Supplier', primary: true },
    { key: 'status', label: 'Status', status: true, render: (o) => <Badge tone={STATUS_TONE[o.status] || 'muted'} label={STATUS_LABELS[o.status] || o.status} size="xs" /> },
    { key: 'order_number', label: 'Order #' },
    { key: 'total_amount_ghs', label: 'GHS Equiv.', render: (o) => `GHS ${(o.total_amount_ghs || 0).toLocaleString()}` },
  ];

  // Verbatim from SupplierOrdersView.tsx:191/:195 — CSV and PDF have
  // genuinely different column sets for the same order list.
  const csvColumns: ExportColumn[] = ['order_number', 'supplier_name', 'supplier_country', 'total_amount', 'currency', 'total_amount_ghs', 'status', 'expected_delivery_date'].map((key) => ({ key, label: key }));
  const pdfColumns: ExportColumn[] = ['order_number', 'supplier_name', 'total_amount', 'currency', 'status'].map((key) => ({ key, label: key }));

  const exportOrderLineItems = async (order: SupplierOrder) => {
    setLineExporting(true);
    try {
      await exportTableDocument(
        'pdf',
        `Supplier Order ${order.order_number}`,
        [
          { key: 'product_name', label: 'product_name' },
          { key: 'quantity', label: 'quantity' },
          { key: 'unit', label: 'unit' },
          { key: 'unit_price', label: 'unit_price' },
          { key: 'total_price', label: 'total_price' },
        ],
        order.products,
        'legacy'
      );
    } finally {
      setLineExporting(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload().finally(() => setRefreshing(false)); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Button label="New Order" icon={<Plus size={14} color="#fff" />} onPress={() => setShowForm(true)} style={{ flex: 1 }} />
          <Button label="Export" size="md" variant="ghost" icon={<Download size={14} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
          <View style={{ width: '47%' }}><MetricCard label="Total Orders" value={totalOrders} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="Pending Payment" value={pendingPayment} tone="warning" emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="In Transit" value={inTransit} emphasis="secondary" /></View>
          <View style={{ width: '47%' }}><MetricCard label="This Month (GHS)" value={thisMonthGhs.toLocaleString()} tone="accent" emphasis="secondary" /></View>
        </View>

        <Input value={search} onChangeText={setSearch} placeholder="Search by order #, supplier, product..." />
        <SearchablePicker
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ value: 'ALL', label: 'All Statuses' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
        />

        <DataList
          columns={columns}
          data={filtered}
          rowKey={(o) => o.id}
          loading={loading}
          onRowPress={setDetail}
          emptyTitle="No orders found"
        />

        {!loading && orders.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
              Showing {orders.length}{typeof total === 'number' ? ` of ${total.toLocaleString()}` : ''}
            </Text>
            {hasMore && <Button label="Load More" size="sm" variant="ghost" onPress={loadMore} />}
          </View>
        )}
      </View>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.supplier_name} subtitle={detail?.order_number} side="bottom" maxHeight={720}>
        {detail && (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Badge tone={STATUS_TONE[detail.status] || 'muted'} label={STATUS_LABELS[detail.status] || detail.status} />
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{detail.supplier_country}</Text>
            </View>

            <SheetSection label="Products">
              {detail.products.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{p.product_name} × {p.quantity} {p.unit}</Text>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{p.currency} {p.total_price.toLocaleString()}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing.sm, paddingTop: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Total</Text>
                <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.accent }}>{detail.currency} {detail.total_amount.toLocaleString()} · GHS {(detail.total_amount_ghs || 0).toLocaleString()}</Text>
              </View>
            </SheetSection>

            <SheetSection label="Shipping">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Port of Entry: {detail.port_of_entry}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Method: {detail.shipping_method}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Expected Delivery: {detail.expected_delivery_date || '—'}</Text>
              {detail.payment_reference && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Payment Ref: {detail.payment_reference}</Text>}
              {detail.notes && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Notes: {detail.notes}</Text>}
            </SheetSection>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {detail.status === 'pending' && <Button label="Authorise Payment" size="sm" onPress={() => { setAuthTarget(detail); setPaymentRef(''); }} />}
              {detail.status === 'payment_authorised' && <Button label="Mark Shipped" size="sm" onPress={() => updateStatus(detail.id, 'shipped')} disabled={submitting} />}
              {detail.status === 'shipped' && <Button label="Mark Arrived" size="sm" onPress={() => updateStatus(detail.id, 'arrived')} disabled={submitting} />}
              <Button label="Notify Management" size="sm" variant="ghost" onPress={() => { setNotifyTarget(detail); setNotifyDept('MANAGEMENT'); setNotifyMessage(''); }} />
              <Button label="Notify Operations" size="sm" variant="ghost" onPress={() => { setNotifyTarget(detail); setNotifyDept('OPERATIONS'); setNotifyMessage(''); }} />
              <Button label={lineExporting ? 'Preparing…' : 'Export Line Items PDF'} size="sm" variant="ghost" icon={<Download size={12} color={t.colors.textSecondary} />} onPress={() => exportOrderLineItems(detail)} loading={lineExporting} disabled={lineExporting} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet
        open={!!authTarget}
        onClose={() => setAuthTarget(null)}
        title="Authorise Payment"
        subtitle={authTarget?.order_number}
        side="bottom"
        maxHeight={320}
        footer={<Button label={submitting ? 'Authorising…' : 'Confirm Authorisation'} onPress={authorisePayment} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Payment Reference *"><Input value={paymentRef} onChangeText={setPaymentRef} placeholder="e.g. wire transfer ref" /></Field>
      </Sheet>

      <Sheet
        open={!!notifyTarget}
        onClose={() => setNotifyTarget(null)}
        title={`Notify ${notifyDept === 'MANAGEMENT' ? 'Management' : 'Operations'}`}
        subtitle={notifyTarget?.order_number}
        side="bottom"
        maxHeight={360}
        footer={<Button label={submitting ? 'Sending…' : 'Send'} onPress={sendNotify} loading={submitting} disabled={submitting} fullWidth />}
      >
        <Field label="Message"><Input value={notifyMessage} onChangeText={setNotifyMessage} multiline numberOfLines={4} placeholder="What should they know?" style={{ minHeight: 96, textAlignVertical: 'top' }} /></Field>
      </Sheet>

      <Sheet
        open={showForm}
        onClose={resetForm}
        title="New Supplier Order"
        subtitle="International procurement order"
        side="bottom"
        maxHeight={800}
        footer={<Button label={submitting ? 'Saving…' : 'Save as Draft'} onPress={createOrder} loading={submitting} disabled={submitting} fullWidth />}
      >
        <SheetSection label="Supplier Details">
          <Field label="Supplier Name *"><Input value={supplierName} onChangeText={setSupplierName} placeholder="Start typing supplier name..." /></Field>
          {isNewSupplier && (
            <>
              <Field label="Country *"><SearchablePicker value={supplierCountry} onChange={setSupplierCountry} options={COUNTRIES.map((c) => ({ value: c, label: c }))} /></Field>
              <Field label="Contact Name"><Input value={supplierContact} onChangeText={setSupplierContact} placeholder="Full name" /></Field>
              <Field label="Contact Email"><Input value={supplierEmail} onChangeText={setSupplierEmail} placeholder="supplier@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
            </>
          )}
        </SheetSection>

        <SheetSection label="Order Details">
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="Port of Entry"><SearchablePicker value={portOfEntry} onChange={setPortOfEntry} options={[{ value: 'Tema Port', label: 'Tema Port' }, { value: 'Takoradi Port', label: 'Takoradi Port' }]} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Expected Delivery"><Input value={expectedDate} onChangeText={setExpectedDate} placeholder="YYYY-MM-DD" /></Field></View>
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="Shipping Method"><SearchablePicker value={shippingMethod} onChange={setShippingMethod} options={['Sea Freight', 'Air Freight', 'Road Freight'].map((m) => ({ value: m, label: m }))} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Currency"><SearchablePicker value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field></View>
          </View>
        </SheetSection>

        <SheetSection label="Products Ordered">
          {lines.map((l, i) => (
            <View key={i} style={{ gap: t.spacing.sm, marginBottom: t.spacing.md, paddingBottom: t.spacing.md, borderBottomWidth: i < lines.length - 1 ? 1 : 0, borderBottomColor: t.colors.border }}>
              <Input value={l.product_name} onChangeText={(v) => updateLine(i, { product_name: v })} placeholder="Product name *" />
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <View style={{ flex: 1 }}><Input value={l.quantity} onChangeText={(v) => updateLine(i, { quantity: v })} placeholder="Qty" keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><SearchablePicker value={l.unit} onChange={(v) => updateLine(i, { unit: v })} options={UNITS.map((u) => ({ value: u, label: u }))} /></View>
                <View style={{ flex: 1 }}><Input value={l.unit_price} onChangeText={(v) => updateLine(i, { unit_price: v })} placeholder="Unit price" keyboardType="decimal-pad" /></View>
                {lines.length > 1 && <Button label="" size="sm" variant="ghost" icon={<Trash2 size={13} color={t.colors.status.danger.text} />} onPress={() => removeLine(i)} />}
              </View>
            </View>
          ))}
          <Button label="Add Product" size="sm" variant="ghost" icon={<Plus size={13} color={t.colors.textSecondary} />} onPress={addLine} />

          <View style={{ marginTop: t.spacing.md, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Subtotal</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{currency} {totalAmount.toLocaleString()}</Text>
            </View>
            <Field label="Exchange Rate (GHS)"><Input value={exchangeRate} onChangeText={setExchangeRate} keyboardType="decimal-pad" /></Field>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Total in GHS</Text>
              <Text style={{ fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.accent }}>GHS {totalGhs.toLocaleString()}</Text>
            </View>
          </View>
        </SheetSection>

        <SheetSection label="Notes">
          <Input value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="Additional notes..." style={{ minHeight: 72, textAlignVertical: 'top' }} />
        </SheetSection>

        <SheetSection label="Send Via WhatsApp (optional)">
          <Button
            label={sendWhatsapp ? 'WhatsApp Send: On' : 'WhatsApp Send: Off'}
            variant={sendWhatsapp ? 'primary' : 'ghost'}
            icon={<MessageCircle size={14} color={sendWhatsapp ? '#fff' : t.colors.textSecondary} />}
            onPress={() => setSendWhatsapp((v) => !v)}
          />
          {sendWhatsapp && <Field label="Supplier WhatsApp Number"><Input value={whatsappNumber} onChangeText={setWhatsappNumber} placeholder="+233…" keyboardType="phone-pad" /></Field>}
        </SheetSection>
      </Sheet>

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Supplier Orders Report"
        data={filtered}
        columns={csvColumns}
        pdfColumns={pdfColumns}
      />
    </Screen>
  );
}
