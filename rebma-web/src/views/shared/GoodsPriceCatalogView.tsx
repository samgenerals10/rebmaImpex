// Shared read-only goods price catalog for Finance, Marketing, CEO
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, Tag, TrendingUp, TrendingDown } from 'lucide-react';
import { exportToCSV } from '../../utils/export';
import CountUp from '../../components/CountUp';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';

interface PriceRow {
  id: string;
  productName: string;
  category: string;
  unitPrice: number;
  costPrice: number | null;
  margin: number | null;
  currency: 'GHS' | 'USD';
  lastUpdated: string;
  updatedBy: string;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { id: string } | null;
}

export default function GoodsPriceCatalogView({ addNotification, currentUser }: Props) {
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Clears the "newly priced items" sidebar badge — that badge counts
  // goods_prices rows updated since this timestamp (PendingApprovalsAlert.tsx),
  // so simply having opened this page is what's supposed to make it go away.
  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('metadata').eq('id', currentUser.id).limit(1).maybeSingle();
        const existingMetadata = (data as any)?.metadata || {};
        await supabase.from('profiles').update({
          metadata: { ...existingMetadata, price_catalog_last_viewed_at: new Date().toISOString() }
        }).eq('id', currentUser.id);
      } catch {}
    })();
  }, [currentUser?.id]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('goods_prices')
          .select('*')
          .order('updated_at', { ascending: false });
        if (error) console.error('Error loading price catalog:', error);
        setPrices((data || []).map((row: any) => {
          const unitPrice = typeof row.unit_price === 'number' ? row.unit_price : 0;
          // No fabricated cost price — a product with no cost entered has an
          // unknown margin, not an invented "65% of selling price" one.
          const costPrice = typeof row.cost_price === 'number' ? row.cost_price : null;
          return {
            id: String(row.product_name || row.id),
            productName: String(row.product_name || ''),
            category: String(row.category || 'INCOMING_GOODS'),
            unitPrice,
            costPrice,
            margin: costPrice !== null && costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : null,
            currency: (row.currency as 'GHS' | 'USD') || 'GHS',
            lastUpdated: String(row.updated_at || row.created_at || '').slice(0, 10),
            updatedBy: String(row.updated_by || 'Management'),
          };
        }));
      } catch (e) {
        console.error(e);
        setPrices([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = prices.filter(p =>
    !search || p.productName.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  // Products with no cost price have an unknown margin — excluded from
  // these stats rather than skewing them with a fabricated number.
  const pricedProducts = prices.filter((p): p is PriceRow & { margin: number } => p.margin !== null);
  const avgMargin = pricedProducts.length > 0 ? pricedProducts.reduce((s, p) => s + p.margin, 0) / pricedProducts.length : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Goods Price Catalog</h2>
          <p className="text-xs text-[var(--text-muted)]">Selling prices set by Management — read only</p>
        </div>
        <button
          onClick={() => { exportToCSV(filtered.map(p => ({ Product: p.productName, Category: p.category, 'Selling Price': p.unitPrice, 'Cost Price': p.costPrice ?? '', 'Margin %': p.margin !== null ? p.margin.toFixed(1) : '', Currency: p.currency, 'Last Updated': p.lastUpdated, 'Set By': p.updatedBy })), ['Product', 'Category', 'Selling Price', 'Cost Price', 'Margin %', 'Currency', 'Last Updated', 'Set By'], 'price_catalog'); addNotification?.('Exported price catalog.'); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: prices.length, decimals: 0, suffix: '', color: 'var(--accent)' },
          { label: 'Avg Margin', value: avgMargin, decimals: 1, suffix: '%', color: '#10b981' },
          { label: 'High Margin (≥50%)', value: pricedProducts.filter(p => p.margin >= 50).length, decimals: 0, suffix: '', color: '#6366f1' },
        ].map(({ label, value, decimals, suffix, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}><CountUp value={value} decimals={decimals} suffix={suffix} /></p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product or category..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="p-3">
          <ResponsiveDataView<typeof filtered[number]>
            columns={[
              {
                key: 'productName', label: 'Product', primary: true, render: item => (
                  <div className="flex items-center gap-2">
                    <Tag size={11} className="text-[var(--accent)] flex-shrink-0" />
                    {item.productName}
                  </div>
                )
              },
              { key: 'category', label: 'Category', render: item => <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-semibold">{item.category}</span> },
              { key: 'unitPrice', label: 'Selling Price', render: item => <span className="font-bold">{item.currency} {item.unitPrice.toFixed(2)}</span> },
              { key: 'costPrice', label: 'Cost Price', render: item => item.costPrice !== null ? `${item.currency} ${item.costPrice.toFixed(2)}` : <span className="text-[var(--text-muted)]">Not entered</span> },
              {
                key: 'margin', label: 'Margin', status: true, render: item => item.margin !== null ? (
                  <div className="flex items-center gap-1">
                    {item.margin >= 50 ? <TrendingUp size={11} className="text-green-500" /> : <TrendingDown size={11} className="text-red-500" />}
                    <span className={`font-semibold ${item.margin >= 50 ? 'text-green-500' : item.margin >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{item.margin.toFixed(1)}%</span>
                  </div>
                ) : <span className="text-[var(--text-muted)]">—</span>
              },
              { key: 'currency', label: 'Currency' },
              { key: 'lastUpdated', label: 'Last Updated' },
              { key: 'updatedBy', label: 'Set By' },
            ]}
            data={filtered}
            rowKey={item => item.id}
            loading={loading}
            emptyTitle="No prices set yet"
            emptyDescription="Management will set prices for approved goods."
          />
        </div>
      </div>
    </div>
  );
}
