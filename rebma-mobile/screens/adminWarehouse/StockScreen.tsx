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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Badge from '../../components/ui/Badge';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';

type Tab = 'CARGO' | 'PRODUCTS' | 'GP';

interface CargoRow { id: string; product_name: string | null; goods_code: string | null; quantity: number; weight: number; unit: string | null; company: string | null; }
interface StockRow { id: string; product_name: string; product_code: string | null; category: string | null; quantity: number; unit: string | null; maximum_level: number | null; }
interface GpRow { id: string; item_name: string; item_code: string | null; category: string | null; quantity: number; cost: number; }
interface LedgerRow { id: string; product_name: string; movement_type: string; quantity: number; reference: string | null; created_at: string; }

// Verbatim from StockView.tsx's stockStatus() — current===0 is Out of Stock,
// under 20% of maximum_level is Low Stock, otherwise In Stock.
function stockStatus(current: number, capacity: number): { label: string; tone: 'danger' | 'warning' | 'success' } {
  if (current === 0) return { label: 'Out of Stock', tone: 'danger' };
  if (capacity > 0 && current / capacity < 0.2) return { label: 'Low Stock', tone: 'warning' };
  return { label: 'In Stock', tone: 'success' };
}

const PRODUCT_STATUS_OPTIONS = [
  { value: 'All', label: 'All Status' },
  { value: 'In Stock', label: 'In Stock' },
  { value: 'Low Stock', label: 'Low Stock' },
  { value: 'Out of Stock', label: 'Out of Stock' },
];

export default function StockScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('CARGO');
  const [cargo, setCargo] = useState<CargoRow[]>([]);
  const [products, setProducts] = useState<StockRow[]>([]);
  const [purchases, setPurchases] = useState<GpRow[]>([]);
  const [recentMovements, setRecentMovements] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('All');

  const [adjustTarget, setAdjustTarget] = useState<GpRow | null>(null);
  const [adjustType, setAdjustType] = useState<'Add' | 'Remove'>('Add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [cargoRes, stockRes, gpRes, ledgerRes] = await Promise.all([
      supabase.from('cargo_intake').select('id, product_name, goods_code, quantity, weight, unit, company').eq('status', 'APPROVED').order('updated_at', { ascending: false }).limit(300),
      supabase.from('stock').select('id, product_name, product_code, category, quantity, unit, maximum_level').neq('category', 'INCOMING_GOODS').order('last_updated', { ascending: false }),
      supabase.from('general_purchases').select('id, item_name, item_code, category, quantity, cost').eq('status', 'APPROVED').order('updated_at', { ascending: false }),
      supabase.from('stock_ledger').select('id, product_name, movement_type, quantity, reference, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    if (ledgerRes.data) setRecentMovements(ledgerRes.data as any);
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
    if (!(await getCeoSetting('stock_adjustments_allowed', true))) {
      Alert.alert('Disabled by CEO', 'Stock adjustments are currently disabled by the CEO.');
      return;
    }
    setSubmitting(true);
    const delta = adjustType === 'Add' ? parseInt(adjustQty, 10) : -parseInt(adjustQty, 10);
    const newQty = Math.max(0, Number(adjustTarget.quantity) + delta);
    // performed_by is the live session's own user id, matching every other
    // stock-ledger writer in the app — previously blank here, making a
    // manual correction unattributable.
    const { data: sessionData } = await supabase.auth.getSession();
    const performerId = sessionData.session?.user?.id || null;
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
      notes: adjustNotes.trim() || '',
      performed_by: performerId,
      created_at: new Date().toISOString(),
    });
    setSubmitting(false);
    setAdjustTarget(null);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustNotes('');
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
    {
      key: 'status', label: 'Status', status: true,
      render: (r) => { const st = stockStatus(r.quantity, r.maximum_level || 0); return <Badge tone={st.tone} label={st.label} />; },
    },
    { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} ${r.unit || 'units'}` },
    { key: 'product_code', label: 'SKU', render: (r) => r.product_code || '—' },
    { key: 'category', label: 'Category', render: (r) => r.category || 'Uncategorized' },
    { key: 'maximum_level', label: 'Capacity', render: (r) => (r.maximum_level || 0).toLocaleString() },
  ];

  const gpCols: DataColumn<GpRow>[] = [
    { key: 'item_name', label: 'Item', primary: true },
    { key: 'quantity', label: 'Qty', status: true, render: (r) => <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.quantity} units</Text> },
    { key: 'item_code', label: 'Code', render: (r) => r.item_code || '—' },
    { key: 'category', label: 'Category', render: (r) => r.category || '—' },
    { key: 'cost', label: 'Cost', render: (r) => `GHS ${Number(r.cost || 0).toLocaleString()}` },
  ];

  const movementCols: DataColumn<LedgerRow>[] = [
    { key: 'product_name', label: 'Product', primary: true },
    { key: 'movement_type', label: 'Type', status: true, render: (r) => <Badge tone={r.movement_type === 'ADD' ? 'success' : r.movement_type === 'REMOVE' ? 'danger' : 'muted'} label={r.movement_type} /> },
    { key: 'quantity', label: 'Qty' },
    { key: 'reference', label: 'Reference', render: (r) => r.reference || '—' },
    { key: 'created_at', label: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
  ];

  const q = search.trim().toLowerCase();
  const filteredCargo = useMemo(() => cargo.filter((r) => !q || (r.product_name || '').toLowerCase().includes(q) || (r.company || '').toLowerCase().includes(q)), [cargo, q]);
  const filteredProducts = useMemo(() => products.filter((r) => {
    const matchesSearch = !q || r.product_name.toLowerCase().includes(q) || (r.product_code || '').toLowerCase().includes(q);
    const matchesStatus = productStatusFilter === 'All' || stockStatus(r.quantity, r.maximum_level || 0).label === productStatusFilter;
    return matchesSearch && matchesStatus;
  }), [products, q, productStatusFilter]);
  const filteredPurchases = useMemo(() => purchases.filter((r) => !q || r.item_name.toLowerCase().includes(q) || (r.item_code || '').toLowerCase().includes(q)), [purchases, q]);

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

      <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.md }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search…" />
        {tab === 'PRODUCTS' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <SearchablePicker value={productStatusFilter} onChange={setProductStatusFilter} options={PRODUCT_STATUS_OPTIONS} />
            </View>
            <Button label="Log Stock Intake" size="sm" variant="ghost" onPress={() => navigation.navigate('PortIngestion')} />
          </View>
        )}
      </View>

      {tab === 'CARGO' && <DataList columns={cargoCols} data={filteredCargo} rowKey={(r) => r.id} loading={loading} emptyTitle="No approved port cargo" />}
      {tab === 'PRODUCTS' && <DataList columns={productCols} data={filteredProducts} rowKey={(r) => r.id} loading={loading} emptyTitle="No finished goods on file" />}
      {tab === 'GP' && (
        <DataList
          columns={gpCols}
          data={filteredPurchases}
          rowKey={(r) => r.id}
          loading={loading}
          emptyTitle="No approved purchases"
          renderActions={(r) => <Button label="Adjust" size="sm" onPress={() => { setAdjustTarget(r); setAdjustType('Add'); setAdjustQty(''); setAdjustReason(''); setAdjustNotes(''); }} />}
        />
      )}

      {recentMovements.length > 0 && (
        <Card style={{ marginTop: t.spacing.xl }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Recent Stock Movements</Text>
          <DataList columns={movementCols} data={recentMovements} rowKey={(r) => r.id} emptyTitle="No stock movements logged" />
        </Card>
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
        <Field label="Notes" hint="Optional"><Input value={adjustNotes} onChangeText={setAdjustNotes} placeholder="Any extra detail" /></Field>
      </Sheet>
    </Screen>
  );
}
