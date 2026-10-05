// rebma-mobile/components/shared/PriceCatalogGrid.tsx
//
// Phase 7.3, D22. Ports rebma-web/src/views/shared/GoodsPriceCatalogView.tsx
// — shared across Marketing/Finance/Management/CEO via a `department`
// prop, same "build once, parameterize by department" investment as
// Phase 7.1's SpreadsheetGrid. Marketing's own PriceCatalogScreen is a
// thin wrapper passing department="MARKETING" (never in CAN_SEE_COST, so
// always reads the masked `goods_prices_catalog` view — cost_price never
// reaches this device at all, not just hidden in the UI). Finance/
// Management/CEO's own department phases will reuse this component
// unmodified once built.
//
// Export (Gap-Closure Backlog, Item 1): CSV only, matching
// GoodsPriceCatalogView.tsx:110-127 exactly — cost/margin columns
// conditionally included based on the same `canSeeCost` gate this
// component already enforces on the on-screen columns, so the export
// never leaks cost data the screen itself hides.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Download } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Input from '../ui/Input';
import MetricCard from '../ui/MetricCard';
import Button from '../ui/Button';
import DataList, { type DataColumn } from '../ui/DataList';
import ProductImage from '../ui/ProductImage';
import ExportSheet from './ExportSheet';
import type { ExportColumn } from '../../lib/exportEngine';

// Per direct correction: the photo captured at intake is often
// impromptu, "just for the delivery sake" — Management is the one role
// allowed to replace it with a more professional shot once it's here in
// the price catalog, and that edit is what every order created after it
// picks up automatically (CreateOrderScreen copies product_image from
// this exact table at order-creation time).
const CAN_EDIT_PHOTO = ['MANAGEMENT'];

const CAN_SEE_COST = ['MANAGEMENT', 'FINANCE', 'CEO'];

interface PriceRow {
  id: string;
  productName: string;
  category: string;
  unitPrice: number;
  costPrice: number | null;
  margin: number | null;
  currency: string;
  lastUpdated: string;
  updatedBy: string;
  productImage: string | null;
}

interface Props {
  department: string;
}

export default function PriceCatalogGrid({ department }: Props) {
  const t = useTheme();
  const { profile } = useAuthStore();
  const canSeeCost = CAN_SEE_COST.includes((department || '').toUpperCase());
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  // Clears the "newly priced items" sidebar badge — mirrors web's own
  // side effect (that badge counts goods_prices rows updated since this
  // timestamp; simply having opened this screen clears it).
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('metadata').eq('id', profile.id).limit(1).maybeSingle();
        const existingMetadata = (data as any)?.metadata || {};
        await supabase.from('profiles').update({
          metadata: { ...existingMetadata, price_catalog_last_viewed_at: new Date().toISOString() },
        }).eq('id', profile.id);
      } catch {}
    })();
  }, [profile?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(canSeeCost ? 'goods_prices' : 'goods_prices_catalog')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) {
      setPrices(data.map((row: any) => {
        const unitPrice = typeof row.unit_price === 'number' ? row.unit_price : 0;
        const costPrice = canSeeCost && typeof row.cost_price === 'number' ? row.cost_price : null;
        return {
          id: String(row.product_name || row.id),
          productName: String(row.product_name || ''),
          category: String(row.category || 'INCOMING_GOODS'),
          unitPrice,
          costPrice,
          margin: costPrice !== null && costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : null,
          currency: row.currency || 'GHS',
          lastUpdated: row.updated_at || '',
          updatedBy: row.updated_by || '',
          productImage: row.product_image || null,
        };
      }));
    }
    setLoading(false);
  }, [canSeeCost]);

  useEffect(() => {
    load();
  }, [load]);

  const canEditPhoto = CAN_EDIT_PHOTO.includes((department || '').toUpperCase());

  const replacePhoto = async (productName: string, dataUri: string) => {
    // Writes to the real base table regardless of which one this screen
    // reads from — goods_prices_catalog (the masked view non-cost roles
    // read) has no product_image write path of its own, and Management
    // is always in CAN_SEE_COST so it's already reading from the base
    // table directly here anyway.
    await supabase.from('goods_prices').update({ product_image: dataUri, updated_at: new Date().toISOString() }).eq('product_name', productName);
    setPrices((prev) => prev.map((p) => (p.productName === productName ? { ...p, productImage: dataUri } : p)));
  };

  const filtered = prices.filter((p) => !search.trim() || p.productName.toLowerCase().includes(search.trim().toLowerCase()));

  const avgMargin = canSeeCost && prices.length > 0
    ? prices.filter((p) => p.margin !== null).reduce((s, p, _, arr) => s + (p.margin || 0) / arr.length, 0)
    : null;

  const columns: DataColumn<PriceRow>[] = [
    {
      // status: true, not a plain grid column — DataList wraps grid-
      // column values in <Text>, which breaks for a real component like
      // ProductImage (RN's <Text> can only contain text/<Text>). The
      // status slot is rendered inside a plain <View> instead, the same
      // reason every existing status-pill column already works.
      key: 'photo', label: 'Photo', status: true,
      render: (p) => (
        <ProductImage
          uri={p.productImage}
          label={p.productName}
          size={36}
          editable={canEditPhoto}
          onReplace={(dataUri) => replacePhoto(p.productName, dataUri)}
        />
      ),
    },
    { key: 'productName', label: 'Product', primary: true },
    // status: true moved to the new photo column above — only one status
    // slot exists per row, and photo needs it (a real component, not
    // text). Price now renders as a normal labeled grid value instead.
    { key: 'unitPrice', label: 'Price', render: (p) => `${p.currency} ${p.unitPrice.toLocaleString()}` },
    { key: 'category', label: 'Category' },
    ...(canSeeCost ? [
      { key: 'costPrice', label: 'Cost', render: (p: PriceRow) => (p.costPrice != null ? `${p.currency} ${p.costPrice.toLocaleString()}` : 'Not set') },
      { key: 'margin', label: 'Margin', render: (p: PriceRow) => (p.margin != null ? `${p.margin.toFixed(1)}%` : 'Not set') },
    ] as DataColumn<PriceRow>[] : []),
  ];

  // Verbatim from GoodsPriceCatalogView.tsx:112-120.
  const exportColumns: ExportColumn[] = [
    { key: 'Product', label: 'Product', render: (p: PriceRow) => p.productName },
    { key: 'Category', label: 'Category', render: (p: PriceRow) => p.category },
    { key: 'Selling Price', label: 'Selling Price', render: (p: PriceRow) => String(p.unitPrice) },
    ...(canSeeCost ? ([
      { key: 'Cost Price', label: 'Cost Price', render: (p: PriceRow) => (p.costPrice ?? '') as any },
      { key: 'Margin %', label: 'Margin %', render: (p: PriceRow) => (p.margin !== null ? p.margin.toFixed(1) : '') },
    ] as ExportColumn[]) : []),
    { key: 'Currency', label: 'Currency', render: (p: PriceRow) => p.currency },
    { key: 'Last Updated', label: 'Last Updated', render: (p: PriceRow) => p.lastUpdated },
    { key: 'Set By', label: 'Set By', render: (p: PriceRow) => p.updatedBy },
  ];

  return (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button label="Export CSV" size="sm" variant="ghost" icon={<Download size={13} color={t.colors.textSecondary} />} onPress={() => setExportOpen(true)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
        <View style={{ width: canSeeCost ? '30%' : '100%' }}><MetricCard label="Total Products" value={loading ? 'Not set' : prices.length} /></View>
        {canSeeCost && (
          <>
            <View style={{ width: '30%' }}><MetricCard label="Avg Margin" value={loading || avgMargin == null ? 'Not set' : `${avgMargin.toFixed(1)}%`} tone="accent" /></View>
            <View style={{ width: '30%' }}><MetricCard label="High Margin (≥50%)" value={loading ? 'Not set' : prices.filter((p) => (p.margin || 0) >= 50).length} tone="warning" /></View>
          </>
        )}
      </View>
      <Input value={search} onChangeText={setSearch} placeholder="Search products…" />
      <DataList columns={columns} data={filtered} rowKey={(p) => p.id} loading={loading} emptyTitle="No products priced yet" />

      <ExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Price Catalog"
        data={filtered}
        columns={exportColumns}
        formats={['csv']}
      />
    </View>
  );
}
