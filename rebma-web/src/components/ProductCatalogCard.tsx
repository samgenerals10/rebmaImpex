import { Package, ShoppingCart } from 'lucide-react';

export interface ProductCatalogItem {
  name: string;
  category?: string;
  unitPrice: number;
  currency: string;
  qty: number;
  soldQty: number;
}

interface Props {
  item: ProductCatalogItem;
  onSelect?: () => void;
}

export default function ProductCatalogCard({ item, onSelect }: Props) {
  const inStock = item.qty > 0;

  return (
    <div
      className="bg-[var(--bg-card)] shadow-card rounded-3xl overflow-hidden cursor-pointer group transition-transform hover:-translate-y-0.5"
      onClick={onSelect}
    >
      <div className="relative p-4 pb-0">
        <div className="rounded-2xl aspect-square flex items-center justify-center bg-[var(--accent-light)]">
          <Package size={40} className="text-[var(--accent)] opacity-70" />
        </div>
        <span
          className={`absolute top-6 right-6 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            inStock ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-[var(--text-muted)]'
          }`}
        >
          {inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>

      <div className="p-4 pt-3">
        <p className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">{item.name}</p>
        {item.category && <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.category}</p>}

        <div className="flex items-end justify-between mt-3">
          <p className="text-xl font-extrabold text-[var(--text-primary)]">
            {item.currency} {item.unitPrice.toLocaleString()}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent)] text-white shrink-0 transition-transform group-hover:scale-105"
            aria-label="Add to order"
          >
            <ShoppingCart size={15} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Qty Sold</p>
            <p className="text-sm font-bold text-blue-500">{item.soldQty.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Qty Remaining</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{item.qty.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
