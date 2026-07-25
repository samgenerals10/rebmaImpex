// src/components/RatingBadge.tsx
import type { CustomerRating } from '../utils/customerRating';

export default function RatingBadge({ rating, size = 'sm' }: { rating: CustomerRating; size?: 'xs' | 'sm' }) {
  return (
    <span
      title={`Rating ${rating.score}/100 (${rating.grade}) — ${rating.orderCount} order${rating.orderCount === 1 ? '' : 's'}, GHS ${rating.totalPurchased.toLocaleString()} purchased`}
      className={`inline-flex items-center justify-center font-bold rounded-full flex-shrink-0 ${size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}
      style={{ background: `${rating.color}26`, color: rating.color }}
    >
      {rating.grade}
    </span>
  );
}
