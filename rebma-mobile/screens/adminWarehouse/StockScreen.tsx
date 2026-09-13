// rebma-mobile/screens/adminWarehouse/StockScreen.tsx
// Ports: rebma-web/src/views/operations/StockView.tsx's three tabs —
// Port-Approved Goods (cargo_intake, read-only), Company Products (stock,
// read-only — confirmed by reading the file, only General Purchases has an
// adjust action there), General Purchases (adjust quantity, writes
// stock_ledger).
//
// Deliberately simplified: web computes a full historical IN/OUT/REMAINING
// ledger per product (dedup'd by day/reference/movement type against
// stock_ledger). That analytics layer is substantial and secondary to this
// screen's core job — viewing and adjusting stock — so this screen shows
// current quantities per row instead of derived IN/OUT figures. The
// adjust-and-record-a-ledger-entry capability itself is fully preserved.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

type Tab = 'CARGO' | 'PRODUCTS' | 'GP';

interface CargoRow { id: string; product_name: string | null; goods_code: string | null; quantity: number; weight: number; unit: string | null; company: string | null; }
interface StockRow { id: string; product_name: string; product_code: string | null; category: string | null; quantity: number; unit: string | null; }
interface GpRow { id: string; item_name: string; item_code: string | null; category: string | null; quantity: number; cost: number; }

export default function StockScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('CARGO');
  const [cargo, setCargo] = useState<CargoRow[]>([]);
  const [products, setProducts] = useState<StockRow[]>([]);
  const [purchases, setPurchases] = useState<GpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<GpRow | null>(null);
  const [adjustType, setAdjustType] = useState<'Add' | 'Remove'>('Add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [cargoRes, stockRes, gpRes] = await Promise.all([
      supabase.from('cargo_intake').select('id, product_name, goods_code, quantity, weight, unit, company').eq('status', 'APPROVED').order('updated_at', { ascending: false }).limit(300),
      supabase.from('stock').select('id, product_name, product_code, category, quantity, unit').neq('category', 'INCOMING_GOODS').order('last_updated', { ascending: false }),
      supabase.from('general_purchases').select('id, item_name, item_code, category, quantity, cost').eq('status', 'APPROVED').order('updated_at', { ascending: false }),
    ]);
    if (cargoRes.data) setCargo(cargoRes.data as any);
    if (stockRes.data) setProducts(stockRes.data as any);
    if (gpRes.data) setPurchases(gpRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitAdjust = async () => {
    if (!adjustTarget || !adjustQty) return;
    setSubmitting(true);
    const delta = adjustType === 'Add' ? parseInt(adjustQty, 10) : -parseInt(adjustQty, 10);
    const newQty = Math.max(0, Number(adjustTarget.quantity) + delta);
    const { error } = await supabase.from('general_purchases').update({ quantity: newQty }).eq('id', adjustTarget.id);
    if (error) {
      setSubmitting(false);
      Alert.alert('Adjustment Failed', error.message);
      return;
    }
    await supabase.from('stock_ledger').insert({
      product_name: adjustTarget.item_name,
      movement_type: adjustType === 'Add' ? 'ADD' : 'REMOVE',
      quantity: Math.abs(delta),
      reference: adjustReason.trim() || 'Manual Adjustment',
      created_at: new Date().toISOString(),
    });
    setSubmitting(false);
    setAdjustTarget(null);
    setAdjustQty('');
    setAdjustReason('');
    load();
  };

  const cargoCols: DataColumn<CargoRow>[] = [
    { key: 'product_name', label: 'Product', primary: true, render: (r) => r.product_name || 'Unnamed' },
    { key: 'quantity', label: 'Qty', status: true, render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.quantity} {r.unit || 'units'}</Text> },
    { key: 'goods_code', label: 'Code', render: (r) => r.goods_code || `CARGO-${r.id.slice(-6).toUpperCase()}` },
    { key: 'company', label: 'Supplier', render: (r) => r.company || '—' },
    { key: 'weight', label: 'Weight', render: (r) => `${Number(r.weight || 0).toFixed(1)}T` },
  ];

  const productCols: DataColumn<StockRow>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    { key: 'quantity', label: 'Qty', status: true, render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.quantity} {r.unit || 'units'}</Text> },
    { key: 'product_code', label: 'SKU', render: (r) => r.product_code || '—' },
    { key: 'category', label: 'Category', render: (r) => r.category || 'Uncategorized' },
  ];

  const gpCols: DataColumn<GpRow>[] = [
    { key: 'item_name', label: 'Item', primary: true },
    { key: 'quantity', label: 'Qty', status: true, render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.quantity} units</Text> },
    { key: 'item_code', label: 'Code', render: (r) => r.item_code || '—' },
    { key: 'category', label: 'Category', render: (r) => r.category || '—' },
    { key: 'cost', label: 'Cost', render: (r) => `GHS ${Number(r.cost || 0).toLocaleString()}` },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ flexDirection: 'row', backgroundColor: t.colors.bgCard, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, padding: 3, marginBottom: t.spacing.lg }}>
        {([
          ['CARGO', `Port Goods (${cargo.length})`],
          ['PRODUCTS', `Products (${products.length})`],
          ['GP', `Purchases (${purchases.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{ flex: 1, paddingVertical: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: tab === key ? t.colors.accent : 'transparent', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: tab === key ? t.colors.onAccent : t.colors.textSecondary }} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'CARGO' && <DataList columns={cargoCols} data={cargo} rowKey={(r) => r.id} loading={loading} emptyTitle="No approved port cargo" />}
      {tab === 'PRODUCTS' && <DataList columns={productCols} data={products} rowKey={(r) => r.id} loading={loading} emptyTitle="No finished goods on file" />}
      {tab === 'GP' && (
        <DataList
          columns={gpCols}
          data={purchases}
          rowKey={(r) => r.id}
          loading={loading}
          emptyTitle="No approved purchases"
          renderActions={(r) => <Button label="Adjust" size="sm" onPress={() => { setAdjustTarget(r); setAdjustType('Add'); setAdjustQty(''); setAdjustReason(''); }} />}
        />
      )}

      <Sheet
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title="Adjust Quantity"
        subtitle={adjustTarget?.item_name}
        side="bottom"
        footer={<Button label={submitting ? 'Saving…' : 'Save Adjustment'} onPress={submitAdjust} loading={submitting} disabled={submitting || !adjustQty} fullWidth />}
      >
        <Field label="Type">
          <SearchablePicker value={adjustType} onChange={(v) => setAdjustType(v as 'Add' | 'Remove')} options={[{ value: 'Add', label: 'Add' }, { value: 'Remove', label: 'Remove' }]} />
        </Field>
        <Field label="Quantity *"><Input value={adjustQty} onChangeText={setAdjustQty} placeholder="E.g., 20" keyboardType="numeric" /></Field>
        <Field label="Reason" hint="Optional"><Input value={adjustReason} onChangeText={setAdjustReason} placeholder="E.g., Damaged in transit" /></Field>
      </Sheet>
    </Screen>
  );
}
