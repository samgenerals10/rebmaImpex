// Operations view: approved cargo intake — shows goods details but NO prices
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Search, Download, Package } from 'lucide-react';
import { exportToCSV } from '../../utils/export';

interface ApprovedGood {
  id: string;
  goodsCode: string;
  productName: string;
  quantity: number;
  unit: string;
  supplier: string;
  portOfOrigin: string;
  approvedAt: string;
  department: string;
}

interface Props {
  addNotification?: (msg: string) => void;
}

export default function ApprovedGoodsView({ addNotification }: Props) {
  const [goods, setGoods] = useState<ApprovedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cargo_intake')
          .select('*')
          .eq('status', 'APPROVED')
          .order('updated_at', { ascending: false })
          .limit(200);
        if (error) console.error('Error loading approved goods:', error);
        setGoods((data || []).map((row: any) => ({
          id: String(row.id),
          goodsCode: String(row.goods_code || 'N/A'),
          productName: String(row.product_name || 'Unknown Product'),
          quantity: typeof row.quantity === 'number' ? row.quantity : 0,
          unit: String(row.unit || 'units'),
          supplier: String(row.company || row.supplier_name || row.supplier || '—'),
          portOfOrigin: String(row.country || row.port_of_origin || row.port || '—'),
          approvedAt: String(row.updated_at || row.created_at || '').slice(0, 10),
          department: String(row.department || '—'),
        })));
      } catch (e) {
        console.error(e);
        setGoods([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = goods.filter(g =>
    !search ||
    g.productName.toLowerCase().includes(search.toLowerCase()) ||
    g.goodsCode.toLowerCase().includes(search.toLowerCase()) ||
    g.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const totalQty = goods.reduce((s, g) => s + g.quantity, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Approved Goods</h2>
          <p className="text-xs text-[var(--text-muted)]">All port intake records approved by Management</p>
        </div>
        <button
          onClick={() => { exportToCSV(filtered.map(g => ({ 'Goods Code': g.goodsCode, Product: g.productName, Quantity: g.quantity, Unit: g.unit, Supplier: g.supplier, 'Port of Origin': g.portOfOrigin, 'Approved On': g.approvedAt })), ['Goods Code', 'Product', 'Quantity', 'Unit', 'Supplier', 'Port of Origin', 'Approved On'], 'approved_goods'); addNotification?.('Exported approved goods.'); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] cursor-pointer"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Approved Batches</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{goods.length}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--box-shadow)]">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">Total Units</p>
          <p className="text-xl font-bold text-emerald-600">{totalQty.toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product, code, or supplier..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-[var(--box-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
                {['Goods Code', 'Product', 'Quantity', 'Supplier', 'Port of Origin', 'Approved On'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-[var(--bg-input)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    No approved goods yet. Management must approve cargo intake records first.
                  </td>
                </tr>
              ) : filtered.map(g => (
                <tr key={g.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-semibold text-[var(--accent)]">{g.goodsCode}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--text-primary)] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Package size={11} className="text-[var(--text-muted)] flex-shrink-0" />
                      {g.productName}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">
                    {g.quantity.toLocaleString()} <span className="font-normal text-[var(--text-muted)]">{g.unit}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{g.supplier}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{g.portOfOrigin}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap">{g.approvedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
