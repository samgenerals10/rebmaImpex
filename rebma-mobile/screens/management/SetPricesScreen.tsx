// rebma-mobile/screens/management/SetPricesScreen.tsx
// Ports: rebma-web/src/views/management/MgmtPriceSettingView.tsx (856
// lines, read in full) — two halves (D40). Price catalog CRUD respects
// the CEO's real settings (management_price_setting, ceo_must_approve_prices
// — read via the new lib/ceoSetting.ts, not a full CeoSettingsContext
// port). Customer Discounts reuses utils/customerRating.ts exactly as
// CustomerCreditScreen (Phase 7.5) established the pattern for, via the
// new lib/managementActions.ts write helpers. Web's price-history regex
// parsing of global_audit_history rows is ported as-is (best-effort, same
// as web — not every historical row is guaranteed to parse cleanly).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Tag, History as HistoryIcon, Trash2, Edit2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { setCustomerDiscount, setCustomerSpecial } from '../../lib/managementActions';
import { pickOrCaptureImage } from '../../lib/media';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import MetricCard from '../../components/ui/MetricCard';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SearchablePicker from '../../components/ui/SearchablePicker';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import { computeCustomerRating, ordersForCustomer, SUGGESTED_DISCOUNT, type OrderLike } from '../../utils/customerRating';

interface PriceEntry {
  id: string;
  productName: string;
  category: string;
  unitPrice: number;
  costPrice: number | null;
  margin: number | null;
  currency: 'GHS' | 'USD';
  lastUpdated: string;
  updatedBy: string;
  image: string;
}
interface CustomerDiscountRow {
  id: string;
  name: string;
  companyName: string;
  isSpecialCustomer: boolean;
  discountPercent: number;
}
interface PriceHistoryEntry { date: string; price: number; updatedBy: string; note: string }

const CATEGORIES = ['INCOMING_GOODS', 'FINISHED_GOODS', 'RAW_MATERIAL', 'PACKAGING', 'OTHER'];

const emptyForm = { productName: '', category: 'INCOMING_GOODS', unitPrice: '', costPrice: '', currency: 'GHS' as 'GHS' | 'USD' };

export default function SetPricesScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();

  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PriceEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState<PriceEntry | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [unpricedGoods, setUnpricedGoods] = useState<string[]>([]);
  const [approvedGoods, setApprovedGoods] = useState<string[]>([]);
  const [broadcastFinance, setBroadcastFinance] = useState(true);
  const [broadcastMarketing, setBroadcastMarketing] = useState(true);
  const [broadcastCeo, setBroadcastCeo] = useState(false);

  const [customers, setCustomers] = useState<CustomerDiscountRow[]>([]);
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [discountDraft, setDiscountDraft] = useState<Record<string, string>>({});
  const [savingCustomerId, setSavingCustomerId] = useState<string | null>(null);
  const [togglingSpecialId, setTogglingSpecialId] = useState<string | null>(null);

  const loadPrices = useCallback(async () => {
    const { data } = await supabase.from('goods_prices').select('*').order('updated_at', { ascending: false });
    setPrices((data || []).map((row: any) => {
      const unitPrice = typeof row.unit_price === 'number' ? row.unit_price : 0;
      const costPrice = typeof row.cost_price === 'number' ? row.cost_price : null;
      return {
        id: String(row.id), productName: String(row.product_name || ''), category: String(row.category || 'INCOMING_GOODS'),
        unitPrice, costPrice, margin: costPrice !== null && costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : null,
        currency: (row.currency as 'GHS' | 'USD') || 'GHS', lastUpdated: String(row.updated_at || row.created_at || '').slice(0, 10),
        updatedBy: String(row.updated_by || 'Management'), image: String(row.product_image || ''),
      };
    }));
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadCustomers = useCallback(async () => {
    const [{ data }, { data: orderRows }] = await Promise.all([
      supabase.from('customers').select('*').order('name', { ascending: true }),
      supabase.from('orders').select('id, client_name, total_amount, status, created_at').then((r) => r, () => ({ data: [] as any[] })),
    ]);
    setCustomers((data || []).map((r: any) => ({
      id: r.id, name: r.name || 'Unnamed customer', companyName: r.company_name || '',
      isSpecialCustomer: r.is_special_customer ?? false, discountPercent: Number(r.discount_percent) || 0,
    })).sort((a: CustomerDiscountRow, b: CustomerDiscountRow) => Number(b.isSpecialCustomer) - Number(a.isSpecialCustomer)));
    setOrders((orderRows || []).map((o: any) => ({ id: o.id, client_name: o.client_name || '', total_amount: Number(o.total_amount) || 0, status: o.status, created_at: o.created_at })));
  }, []);

  useEffect(() => { loadPrices(); loadCustomers(); }, [loadPrices, loadCustomers]);

  useEffect(() => {
    Promise.all([
      supabase.from('cargo_intake').select('product_name').eq('status', 'APPROVED'),
      supabase.from('production_requests').select('product_name').eq('status', 'TICKETS_ISSUED'),
      supabase.from('goods_prices').select('product_name'),
    ]).then(([{ data: cargoData }, { data: productionData }, { data: priceData }]) => {
      const approved = Array.from(new Set([...(cargoData || []), ...(productionData || [])].map((r: any) => String(r.product_name || '')).filter(Boolean)));
      const priced = new Set((priceData || []).map((r: any) => String(r.product_name || '')));
      setApprovedGoods(approved);
      setUnpricedGoods(approved.filter((name) => !priced.has(name)));
    }, () => {});
  }, [prices]);

  const openAdd = (productName?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, productName: productName || '' });
    setImagePreview('');
    setShowForm(true);
  };
  const openEdit = (p: PriceEntry) => {
    setEditing(p);
    setForm({ productName: p.productName, category: p.category, unitPrice: String(p.unitPrice), costPrice: p.costPrice != null ? String(p.costPrice) : '', currency: p.currency });
    setImagePreview(p.image || '');
    setShowForm(true);
  };

  const savePrice = async () => {
    if (!(await getCeoSetting('management_price_setting', true))) { Alert.alert('Disabled', 'Price setting is currently disabled by the CEO.'); return; }
    if (!form.productName || !form.unitPrice) return;
    setSaving(true);
    try {
      const unitPrice = parseFloat(form.unitPrice);
      const costPrice = form.costPrice ? parseFloat(form.costPrice) : null;

      if (await getCeoSetting('ceo_must_approve_prices', false)) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('goods_price_change_requests').insert({
          product_name: form.productName, category: form.category || null, unit_price: unitPrice, cost_price: costPrice,
          currency: form.currency, product_image: imagePreview || null, requested_by: user?.id || null,
          requested_by_name: profile?.fullName || 'Management', status: 'PENDING',
        });
        if (error) { Alert.alert('Failed', error.message); return; }
        Alert.alert('Sent for Approval', `Price change for ${form.productName} sent to the CEO for approval.`);
        setShowForm(false);
        setImagePreview('');
        return;
      }

      const upsertPayload: Record<string, unknown> = {
        product_name: form.productName, unit_price: unitPrice, updated_at: new Date().toISOString(),
        category: form.category, cost_price: costPrice, currency: form.currency,
        updated_by: profile?.fullName || 'Management', product_image: imagePreview || null,
      };
      if (editing?.id) upsertPayload.id = editing.id;
      const { error: upsertError } = await supabase.from('goods_prices').upsert([upsertPayload], { onConflict: 'product_name' });
      if (upsertError) { Alert.alert('Save Failed', upsertError.message); return; }

      if (broadcastFinance) await supabase.from('supplier_order_notifications').insert([{ message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'FINANCE', read: false }]);
      if (broadcastMarketing) await supabase.from('supplier_order_notifications').insert([{ message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'MARKETING', read: false }]);
      if (broadcastCeo) await supabase.from('supplier_order_notifications').insert([{ message: `Price update: ${form.productName} → ${form.currency} ${unitPrice}`, notified_department: 'CEO', read: false }]);

      await supabase.from('global_audit_history').insert([{
        department: 'MANAGEMENT', action: `Price ${editing ? 'updated' : 'set'}: ${form.productName} → ${form.currency} ${unitPrice}/unit`,
        performed_by: profile?.fullName || 'Management', timestamp: new Date().toISOString(),
      }]);

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setImagePreview('');
      loadPrices();
    } finally {
      setSaving(false);
    }
  };

  const captureImage = async () => {
    const b64 = await pickOrCaptureImage();
    if (b64) setImagePreview(b64);
  };

  const deletePrice = (p: PriceEntry) => {
    Alert.alert('Remove Price', `Remove "${p.productName}" from the price catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('goods_prices').delete().eq('id', p.id); setPrices((prev) => prev.filter((x) => x.id !== p.id)); } },
    ]);
  };

  const openHistory = async (p: PriceEntry) => {
    setShowHistory(p);
    setLoadingHistory(true);
    const { data } = await supabase.from('global_audit_history').select('*').or(`action.ilike.%${p.productName}%,details.ilike.%${p.productName}%`).order('timestamp', { ascending: false }).limit(20);
    setHistory((data || []).map((h: any) => {
      const priceRegex = /(?:GHS|USD)\s*(\d+(?:\.\d+)?)/i;
      const match = (h.action || '').match(priceRegex) || (h.details || '').match(priceRegex);
      return { date: h.timestamp ? h.timestamp.split('T')[0] : '', price: match ? parseFloat(match[1]) : p.unitPrice, updatedBy: h.performed_by || 'System', note: h.action || 'Price Update Logged' };
    }));
    setLoadingHistory(false);
  };

  const saveCustomerDiscount = async (c: CustomerDiscountRow) => {
    const raw = discountDraft[c.id];
    if (raw === undefined) return;
    const pct = Math.max(0, Math.min(100, Number(raw)));
    if (Number.isNaN(pct)) return;
    setSavingCustomerId(c.id);
    try {
      await setCustomerDiscount(c.id, pct);
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, discountPercent: pct } : x)));
      setDiscountDraft((prev) => { const next = { ...prev }; delete next[c.id]; return next; });
    } finally {
      setSavingCustomerId(null);
    }
  };

  const toggleSpecial = async (c: CustomerDiscountRow) => {
    setTogglingSpecialId(c.id);
    try {
      const next = !c.isSpecialCustomer;
      await setCustomerSpecial(c.id, next);
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, isSpecialCustomer: next } : x)).sort((a, b) => Number(b.isSpecialCustomer) - Number(a.isSpecialCustomer)));
    } finally {
      setTogglingSpecialId(null);
    }
  };

  const filteredPrices = prices.filter((p) => !search || p.productName.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));
  const pricedProducts = prices.filter((p): p is PriceEntry & { margin: number } => p.margin !== null);
  const avgMargin = pricedProducts.length > 0 ? pricedProducts.reduce((s, p) => s + p.margin, 0) / pricedProducts.length : 0;

  const filteredCustomers = customers.filter((c) => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.companyName.toLowerCase().includes(customerSearch.toLowerCase()));

  const priceColumns: DataColumn<PriceEntry>[] = [
    { key: 'productName', label: 'Product', primary: true },
    { key: 'unitPrice', label: 'Price', status: true, render: (p) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.accent }}>{p.currency} {p.unitPrice.toLocaleString()}</Text> },
    { key: 'category', label: 'Category' },
    { key: 'margin', label: 'Margin', render: (p) => (p.margin != null ? `${p.margin.toFixed(0)}%` : '—') },
  ];

  const customerColumns: DataColumn<CustomerDiscountRow>[] = [
    { key: 'name', label: 'Customer', primary: true },
    {
      key: 'rating', label: 'Rating', status: true,
      render: (c) => {
        const rating = computeCustomerRating(ordersForCustomer(orders, c.name));
        return <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: rating.color }}>{rating.grade}</Text>;
      },
    },
    {
      key: 'discount', label: 'Discount %',
      render: (c) => {
        const draft = discountDraft[c.id];
        const current = draft !== undefined ? draft : String(c.discountPercent);
        return <Input value={current} onChangeText={(v) => setDiscountDraft((prev) => ({ ...prev, [c.id]: v }))} keyboardType="numeric" style={{ width: 70 }} />;
      },
    },
    {
      key: 'special', label: 'Special',
      render: (c) => (
        <Text
          onPress={() => toggleSpecial(c)}
          style={{
            fontFamily: t.font.bold, fontSize: t.type.meta10.size, overflow: 'hidden', paddingVertical: 2, paddingHorizontal: 8, borderRadius: t.radius.pill,
            color: c.isSpecialCustomer ? t.colors.status.success.text : t.colors.textMuted,
            backgroundColor: c.isSpecialCustomer ? t.colors.status.success.bg : t.colors.bgInput,
            opacity: togglingSpecialId === c.id ? 0.5 : 1,
          }}
        >
          {togglingSpecialId === c.id ? '…' : c.isSpecialCustomer ? '★ Special' : 'Flag'}
        </Text>
      ),
    },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPrices(); loadCustomers(); }}>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
            <Tag size={16} color={t.colors.textPrimary} />
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Price Catalog</Text>
          </View>
          <Button label="Add Price" size="sm" onPress={() => openAdd()} />
        </View>

        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <View style={{ flex: 1 }}><MetricCard label="Total Products" value={prices.length} /></View>
          <View style={{ flex: 1 }}><MetricCard label="Avg Margin" value={`${avgMargin.toFixed(0)}%`} tone="accent" /></View>
        </View>

        {unpricedGoods.length > 0 && (
          <Card tone="inset">
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.status.warning.text }}>
              {unpricedGoods.length} approved {unpricedGoods.length === 1 ? 'product needs' : 'products need'} a price set
            </Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2, marginBottom: t.spacing.sm }} numberOfLines={2}>{unpricedGoods.join(' · ')}</Text>
            <Button label={`Set price for ${unpricedGoods[0]}`} size="sm" variant="ghost" onPress={() => openAdd(unpricedGoods[0])} />
          </Card>
        )}

        <Input value={search} onChangeText={setSearch} placeholder="Search products..." />
        <DataList
          columns={priceColumns}
          data={filteredPrices}
          rowKey={(p) => p.id}
          loading={loading}
          emptyTitle="No prices set yet"
          renderActions={(p) => (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="History" size="sm" variant="ghost" icon={<HistoryIcon size={12} color={t.colors.textSecondary} />} onPress={() => openHistory(p)} />
              <Button label="Edit" size="sm" variant="ghost" icon={<Edit2 size={12} color={t.colors.textSecondary} />} onPress={() => openEdit(p)} />
              <Button label="Delete" size="sm" variant="danger" icon={<Trash2 size={12} color="#fff" />} onPress={() => deletePrice(p)} />
            </View>
          )}
        />

        <View>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.xs }}>Customer Discounts</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>Based on performance, loyalty, and volume, not limited to customers Marketing flagged special.</Text>
          <Input value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customers..." />
        </View>
        <DataList
          columns={customerColumns}
          data={filteredCustomers}
          rowKey={(c) => c.id}
          emptyTitle="No customers found"
          renderActions={(c) => {
            const draft = discountDraft[c.id];
            const dirty = draft !== undefined && draft.trim() !== String(c.discountPercent);
            if (!dirty) return null;
            return <Button label={savingCustomerId === c.id ? 'Saving…' : `Save (suggested ${SUGGESTED_DISCOUNT[computeCustomerRating(ordersForCustomer(orders, c.name)).grade]}%)`} size="sm" onPress={() => saveCustomerDiscount(c)} loading={savingCustomerId === c.id} />;
          }}
        />
      </View>

      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Price' : 'Add Price'}
        side="bottom"
        maxHeight={680}
        footer={<Button label={saving ? 'Saving…' : 'Save Price'} onPress={savePrice} loading={saving} disabled={saving} fullWidth />}
      >
        <Field label="Product Name *">
          {approvedGoods.length > 0 ? (
            <SearchablePicker value={form.productName} onChange={(v) => setForm((f) => ({ ...f, productName: v }))} options={approvedGoods.map((n) => ({ value: n, label: n }))} placeholder="Select or type product name" />
          ) : (
            <Input value={form.productName} onChangeText={(v) => setForm((f) => ({ ...f, productName: v }))} />
          )}
        </Field>
        <Field label="Category"><SearchablePicker value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Unit Price *"><Input value={form.unitPrice} onChangeText={(v) => setForm((f) => ({ ...f, unitPrice: v }))} keyboardType="decimal-pad" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Cost Price"><Input value={form.costPrice} onChangeText={(v) => setForm((f) => ({ ...f, costPrice: v }))} keyboardType="decimal-pad" /></Field></View>
        </View>
        <Field label="Currency"><SearchablePicker value={form.currency} onChange={(v) => setForm((f) => ({ ...f, currency: v as 'GHS' | 'USD' }))} options={[{ value: 'GHS', label: 'GHS' }, { value: 'USD', label: 'USD' }]} /></Field>
        <Field label="Product Photo (optional)">
          <Button label={imagePreview ? 'Retake Photo' : 'Add Photo'} variant="ghost" onPress={captureImage} />
        </Field>
        <SheetSection label="Broadcast Notification">
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {[['Finance', broadcastFinance, setBroadcastFinance], ['Marketing', broadcastMarketing, setBroadcastMarketing], ['CEO', broadcastCeo, setBroadcastCeo]].map(([label, val, setter]: any) => (
              <Text
                key={label}
                onPress={() => setter((v: boolean) => !v)}
                style={{
                  fontFamily: t.font.semibold, fontSize: t.type.meta11.size, paddingVertical: 6, paddingHorizontal: 10, borderRadius: t.radius.pill,
                  borderWidth: 1, borderColor: val ? t.colors.accent : t.colors.border,
                  backgroundColor: val ? t.colors.accentSoft : t.colors.bgCard, color: val ? t.colors.accent : t.colors.textSecondary,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </SheetSection>
      </Sheet>

      <Sheet open={!!showHistory} onClose={() => setShowHistory(null)} title={showHistory?.productName} subtitle="Price History" side="bottom" maxHeight={520}>
        {loadingHistory ? (
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>Loading…</Text>
        ) : history.length === 0 ? (
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center', paddingVertical: t.spacing.lg }}>No price history logged for this product.</Text>
        ) : (
          <View style={{ gap: t.spacing.sm }}>
            {history.map((h, i) => (
              <View key={i} style={{ padding: t.spacing.sm, borderRadius: t.radius.md, backgroundColor: t.colors.bgInput }}>
                <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{showHistory?.currency} {h.price} / unit</Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{h.updatedBy} · {h.date}</Text>
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
