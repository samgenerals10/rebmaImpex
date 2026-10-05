-- ============================================================
-- Finance approving a sale is supposed to deduct the sold stock right
-- then (see deductStockForOrder in apiClient.ts, called from
-- finance.evaluateOrder and management.approveCreditOrder) — but the
-- 'finance' role was never added to stock/stock_ledger's write
-- policies, only 'operations','production','management'. Every
-- deduction attempt by Finance was silently rejected by RLS:
--   "new row violates row-level security policy for table stock_ledger"
-- (confirmed live). Management could already write here; this just
-- adds the one missing role rather than loosening anything further.
-- ============================================================
drop policy if exists "stock_write" on public.stock;
create policy "stock_write" on public.stock
  for all to authenticated
  using (public.current_role() in ('operations','production','management','finance') or public.is_admin())
  with check (public.current_role() in ('operations','production','management','finance') or public.is_admin());

drop policy if exists "stock_ledger_write" on public.stock_ledger;
create policy "stock_ledger_write" on public.stock_ledger
  for all to authenticated
  using (public.current_role() in ('operations','production','management','finance') or public.is_admin())
  with check (public.current_role() in ('operations','production','management','finance') or public.is_admin());
