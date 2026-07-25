// src/utils/customerRating.ts
// A customer's rating is computed live from their real order history — no
// stored/manually-set field, so it's always current and needs no migration.
// Two ingredients, per the brief: consistency of purchasing + amount
// purchased. Orders that were REJECTED don't count toward either (no real
// purchase happened); everything else does, including orders still in the
// pipeline (APPROVED/PROCESSING/etc.) — an order not yet delivered still
// reflects real, committed purchasing behavior, just not the same thing as
// the "Total Spend (Delivered)" figure shown elsewhere on the customer page.
import type { Order } from '../types/erp';

// Orders link to a customer by free-typed name (client_name), not always a
// stable customer_id — and real records here have already drifted (e.g. a
// customer row stored as "KOFI " with a trailing space while their orders
// say "KOFI"). Exact-string matching elsewhere in the app already silently
// undercounts because of this; this normalizer keeps the rating from
// inheriting that same fragility.
export function sameCustomerName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function ordersForCustomer(orders: Order[], customerName: string): Order[] {
  return orders.filter(o => sameCustomerName(o.clientName, customerName));
}

export interface CustomerRating {
  score: number; // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  color: string;
  consistencyScore: number; // 0-50
  volumeScore: number; // 0-50
  orderCount: number;
  totalPurchased: number;
}

const GRADE_COLORS: Record<CustomerRating['grade'], string> = {
  'A+': '#16a34a',
  'A': '#22c55e',
  'B+': '#2563eb',
  'B': '#f59e0b',
  'C': '#94a3b8',
};

function gradeFor(score: number): CustomerRating['grade'] {
  if (score >= 80) return 'A+';
  if (score >= 60) return 'A';
  if (score >= 40) return 'B+';
  if (score >= 20) return 'B';
  return 'C';
}

export function computeCustomerRating(customerOrders: Pick<Order, 'totalAmount' | 'status' | 'createdAt'>[]): CustomerRating {
  const counted = customerOrders.filter(o => o.status !== 'REJECTED');
  const orderCount = counted.length;
  const totalPurchased = counted.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);

  // Volume: GHS 1,000 purchased = 1 point, capped at 50 (GHS 50k+ maxes out).
  const volumeScore = Math.min(50, totalPurchased / 1000);

  // Consistency: orders per month since their first order, capped at 50.
  // 2.5 orders/month (roughly one every ~12 days) reaches the cap; a single
  // order can't demonstrate consistency, so it scores 0 on this half.
  let consistencyScore = 0;
  if (orderCount >= 2) {
    const firstOrderMs = Math.min(...counted.map(o => new Date(o.createdAt).getTime()));
    const monthsActive = Math.max(1, (Date.now() - firstOrderMs) / (1000 * 60 * 60 * 24 * 30));
    const ordersPerMonth = orderCount / monthsActive;
    consistencyScore = Math.min(50, ordersPerMonth * 20);
  }

  const score = Math.round(volumeScore + consistencyScore);
  const grade = gradeFor(score);

  return {
    score,
    grade,
    color: GRADE_COLORS[grade],
    consistencyScore: Math.round(consistencyScore),
    volumeScore: Math.round(volumeScore),
    orderCount,
    totalPurchased,
  };
}

// A starting point for Management, not an auto-applied rule — the discount
// panel shows this as a one-click suggestion next to the real (editable)
// input, so a high score translates into a concrete number instead of Management
// having to guess what a given grade "should" be worth.
export const SUGGESTED_DISCOUNT: Record<CustomerRating['grade'], number> = {
  'A+': 15,
  'A': 10,
  'B+': 5,
  'B': 2,
  'C': 0,
};
