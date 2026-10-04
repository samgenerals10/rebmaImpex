// api/data-reset.ts
// Vercel Serverless Function — Control Center → Data Reset Center (Step 2).
// It used to delete straight from the phone or browser. Now:
//   * CEO only, with his password checked on the server, and the exact
//     confirmation phrase "CONFIRM DELETE";
//   * this server list of tables is the one that counts (the screens only
//     show it);
//   * real deleted-row counts (the old screens never asked for a count, so
//     they always said 0);
//   * the stock safeguard is kept: wiping sales orders without wiping the
//     stock ledger first puts sold quantities back into stock, so stock is
//     never left understated;
//   * the reset is logged with the CEO's name.
//
// Body: { department, confirmText, password }
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited } from './_shared/rateLimit';
import { requireCeo, verifyPassword } from './_shared/reauth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const AUDIT = 'global_audit_history';
// Same lists the Control Center screens show (CeoControlCenter.tsx and
// ControlCenterScreen.tsx). Each department's audit trail is cleared only
// for its own rows.
export const DEPT_TABLES: Record<string, string[]> = {
  MARKETING: ['orders', 'customers', AUDIT],
  FINANCE: ['finance_payments', 'finance_expenses', 'finance_cheques', 'finance_petty_cash', 'recurring_payments', 'finance_report_history', AUDIT],
  OPERATIONS: ['cargo_intake', 'stock_ledger', 'general_purchases', 'stock', 'wip_stock', AUDIT],
  PRODUCTION: ['production_logs', 'production_requests', AUDIT],
  MANAGEMENT: ['goods_prices', 'supplier_orders', 'suppliers', 'departments', AUDIT],
  HR: ['payroll_batches', 'payroll_entries', 'payroll_items', 'leave_requests', 'attendance', AUDIT],
  DISPATCH: ['delivery_logs', 'drivers', AUDIT],
  RECEPTION: ['visitors', AUDIT],
  LOGISTICS: [AUDIT],
  ALL: [
    'orders', 'customers',
    'finance_payments', 'finance_expenses', 'finance_cheques', 'finance_petty_cash', 'recurring_payments', 'finance_report_history',
    'cargo_intake', 'stock_ledger', 'general_purchases', 'stock', 'wip_stock',
    'production_logs', 'production_requests',
    'goods_prices', 'supplier_orders', 'suppliers', 'departments',
    'payroll_batches', 'payroll_entries', 'payroll_items', 'leave_requests', 'attendance',
    'delivery_logs', 'drivers',
    'visitors',
    AUDIT, 'supplier_order_notifications',
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isRateLimited(supabaseAdmin, req, res, 'data-reset', 5, 60)) return;

  const caller = await requireCeo(supabaseAdmin, req, res);
  if (!caller) return;

  const { department, confirmText, password } = req.body || {};
  const tables = DEPT_TABLES[String(department || '')];
  if (!tables) return res.status(400).json({ error: 'Unknown department.' });
  if (confirmText !== 'CONFIRM DELETE') return res.status(400).json({ error: 'Type CONFIRM DELETE exactly to unlock the reset.' });
  if (!(await verifyPassword(supabaseAdmin, res, caller.user, password))) return;

  const results: { table: string; deleted: number; error?: string }[] = [];

  // Stock safeguard runs FIRST, while the order history still exists.
  if (tables.includes('orders') && !tables.includes('stock_ledger')) {
    try {
      const { data: orphaned, error: fetchErr } = await supabaseAdmin
        .from('stock_ledger').select('id, product_name, quantity').ilike('reference', '%Order Approved%');
      if (fetchErr) throw fetchErr;
      const byProduct = new Map<string, number>();
      for (const row of orphaned || []) {
        const key = String(row.product_name || '').trim().toLowerCase();
        if (key) byProduct.set(key, (byProduct.get(key) || 0) + (Number(row.quantity) || 0));
      }
      for (const [product, qty] of byProduct) {
        if (qty <= 0) continue;
        const { data: stockRow } = await supabaseAdmin.from('stock').select('id, quantity').ilike('product_name', product).limit(1);
        if (stockRow?.[0]) {
          await supabaseAdmin.from('stock').update({ quantity: (Number(stockRow[0].quantity) || 0) + qty, last_updated: new Date().toISOString() }).eq('id', stockRow[0].id);
        }
      }
      const { error, count } = await supabaseAdmin.from('stock_ledger').delete({ count: 'exact' }).ilike('reference', '%Order Approved%');
      results.push({ table: 'stock_ledger (sold quantities put back into stock)', deleted: count ?? 0, error: error?.message });
    } catch (e: any) {
      results.push({ table: 'stock_ledger (sold quantities)', deleted: 0, error: e?.message || 'Unknown error' });
    }
  }

  for (const table of tables) {
    try {
      const q = table === AUDIT && department !== 'ALL'
        ? supabaseAdmin.from(table).delete({ count: 'exact' }).eq('department', department)
        : supabaseAdmin.from(table).delete({ count: 'exact' }).not('id', 'is', null);
      const { error, count } = await q;
      results.push({ table, deleted: count ?? 0, error: error?.message });
    } catch (e: any) {
      results.push({ table, deleted: 0, error: e?.message || 'Unknown error' });
    }
  }

  await supabaseAdmin.from('global_audit_history').insert({
    action: 'DATA_RESET', department: department === 'ALL' ? 'CEO' : department,
    performed_by: caller.profile.full_name || 'CEO', user_id: caller.user.id,
    details: `Data reset: ${tables.join(', ')}. Rows deleted: ${results.reduce((s, r) => s + r.deleted, 0)}.`,
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json({ results });
}
