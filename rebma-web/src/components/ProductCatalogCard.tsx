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
      className="bg-[var(--bg-card)] shadow-card rounded-xl overflow-hidden cursor-pointer group transition-transform hover:-translate-y-0.5"
      onClick={onSelect}
    >
      <div className="relative p-1.5 pb-0">
        <div className="rounded-lg aspect-square flex items-center justify-center bg-[var(--accent-light)]">
          <Package size={22} className="text-[var(--accent)] opacity-70" />
        </div>
        <span
          className={`absolute top-3 right-3 text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${
            inStock ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-[var(--text-muted)]'
          }`}
        >
          {inStock ? 'In Stock' : 'Out'}
        </span>
      </div>

      <div className="p-2">
        <p className="text-[11px] font-bold text-[var(--text-primary)] leading-tight truncate">{item.name}</p>
        {item.category && <p className="text-[9px] text-[var(--text-muted)] truncate">{item.category}</p>}

        <div className="flex items-end justify-between mt-1.5">
          <p className="text-xs font-extrabold text-[var(--text-primary)] truncate">
            {item.currency} {item.unitPrice.toLocaleString()}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--accent)] text-white shrink-0 transition-transform group-hover:scale-105"
            aria-label="Add to order"
          >
            <ShoppingCart size={11} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[var(--border)]">
          <div>
            <p className="text-[8px] text-[var(--text-muted)] leading-tight">Sold</p>
            <p className="text-[10px] font-bold text-blue-500 leading-tight">{item.soldQty.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-[var(--text-muted)] leading-tight">Left</p>
            <p className="text-[10px] font-bold text-[var(--text-primary)] leading-tight">{item.qty.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
