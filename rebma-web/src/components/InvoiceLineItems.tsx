// src/components/InvoiceLineItems.tsx
// Shared component — renders invoice line items from metadata.items.
// Falls back gracefully to productName string for legacy orders.

import type { Order, OrderLineItem } from '../types/erp';

interface Props {
  order: Order;
  /** compact=true → inline chips for table cells; compact=false → full breakdown table */
  compact?: boolean;
}

/**
 * Given an order, extracts the line-items array from metadata.items (new orders)
 * or falls back to the productName string (legacy orders without metadata).
 */
export function getLineItems(order: Order): OrderLineItem[] | null {
  const items = order.metadata?.items;
  if (Array.isArray(items) && items.length > 0) return items;
  return null;
}

/**
 * Returns a short display label for the product column in list views.
 * Multi-item: "FLOUR +1 more"   Single: "FLOUR"   Legacy: productName string
 */
export function getProductSummary(order: Order): string {
  const items = getLineItems(order);
  if (!items) return order.productName || '—';
  return items.map(item => item.productName).join(', ');
}

/**
 * Returns a display label showing product name and quantities.
 * Multi-item: "FLOUR (x10), SMILE (x20)"   Single/Legacy: "FLOUR (x10)"
 */
export function getProductSummaryWithQty(order: Order): string {
  const items = getLineItems(order);
  if (!items) {
    const qty = order.quantity;
    const name = order.productName || '—';
    return qty ? `${name} (x${qty})` : name;
  }
  return items.map(item => `${item.productName} (x${item.quantity})`).join(', ');
}

export default function InvoiceLineItems({ order, compact = false }: Props) {
  const items = getLineItems(order);

  /* ── Compact mode — inline chips for table cells ── */
  if (compact) {
    if (!items) {
      return (
        <span className="text-[var(--text-secondary)] truncate">
          {order.productName || '—'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        {items.map((item, idx) => (
          <span key={idx} className="px-1.5 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-medium truncate max-w-[100px]" title={item.productName}>
            {item.productName}
          </span>
        ))}
      </span>
    );
  }

  /* ── Full mode — breakdown table ── */
  if (!items) {
    /* Legacy order — no line items in metadata */
    return (
      <div className="rounded-xl border border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <span className="font-medium text-[var(--text-primary)]">
          {order.productName || '—'}
        </span>
        <span className="font-bold text-emerald-600">
          GHS {Number(order.totalAmount ?? 0).toLocaleString()}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--bg-input)] border-b border-[var(--border)]">
            <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">Product</th>
            <th className="text-center py-2 px-3 font-semibold text-[var(--text-muted)]">Qty</th>
            <th className="text-right py-2 px-3 font-semibold text-[var(--text-muted)]">Unit Price</th>
            <th className="text-right py-2 px-3 font-semibold text-[var(--text-muted)]">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-[var(--border)] last:border-0">
              <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                {item.productName}
              </td>
              <td className="py-2.5 px-3 text-center text-[var(--text-secondary)]">
                {item.quantity}
              </td>
              <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                {item.unitPrice > 0
                  ? `GHS ${item.unitPrice.toLocaleString()}`
                  : <span className="text-amber-500 text-[10px]">No price set</span>
                }
              </td>
              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                {item.lineTotal > 0 ? `GHS ${item.lineTotal.toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--accent-light)] border-t border-[var(--border)]">
            <td colSpan={3} className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
              Order Total
            </td>
            <td className="py-2.5 px-3 text-right font-bold text-[var(--accent)]">
              GHS {Number(order.totalAmount ?? 0).toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
