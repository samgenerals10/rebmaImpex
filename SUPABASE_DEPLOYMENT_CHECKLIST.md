# Supabase Deployment Checklist — Enhancement Blueprint Rollout

Everything below is **written but not yet run** against the live database. Supabase access has been billing-blocked since ~2026-09-01 — this checklist is what to work through once that's resolved.

Run items in order. Later migrations generally assume earlier ones already happened. Check items off as you go.

---

## 0. Before you start

- [ ] Confirm Supabase billing/access is actually restored (try opening the project dashboard).
- [ ] Take a manual backup/snapshot of the database first, if your plan supports it — none of these migrations are individually risky (mostly additive columns/tables, `IF NOT EXISTS` guards, `CREATE OR REPLACE`), but #5 and #6 below both widen or narrow RLS policies, which is worth having a rollback point for.
- [ ] Have the Supabase SQL editor open, and this repo checked out locally so you can copy each file's contents.

**Note on older `.sql` files**: this repo also has an earlier set of migration files (`supabase_schema.sql`, `supabase_rls_overhaul.sql`, `supabase_control_center*.sql`, `supabase_atomic_functions.sql`, and a few others) dated well before this rollout started. Those are the foundational schema from when the app was already live, and were almost certainly applied back when Supabase was last reachable — they are **not** part of this checklist. This checklist covers only the 8 migrations written during the Enhancement Blueprint rollout (Risk department → mobile platform hardening), which are confirmed to have never touched the live database.

---

## 1. `supabase_risk_department.sql`

**What it does:** Adds the `risk` role; updates RLS on `cargo_intake`, `orders`, `delivery_logs` so Risk becomes the approval gate Phase 1 introduced.

- [ ] Run `supabase_risk_department.sql` in the SQL editor.
- [ ] Spot-check: `select * from pg_policies where tablename in ('cargo_intake','orders','delivery_logs');` shows the new `risk`-inclusive policies.

---

## 2. `supabase_customer_verification.sql`

**What it does:** New `customers` columns (house/company address, GPS lat/lng, 2nd Ghana Card, partner name, business certificate URL, notes, verification status); widens `customers_update` RLS to include `risk`.

- [ ] Run `supabase_customer_verification.sql`.
- [ ] **Manual step — create a Storage bucket by hand:** Supabase dashboard → Storage → New bucket → name it `business-certificates`, make it **public** (same pattern as the existing `customer-photos`/`delivery-proofs` buckets). No SQL can create a bucket — this has to be done in the dashboard UI.

---

## 3. `supabase_hr_additions.sql`

**What it does:** Employee number, resume URL, address, HR remarks, guarantor fields, staff category, performance score columns on `profiles`; new `employee_queries` table + RLS.

- [ ] Run `supabase_hr_additions.sql`.
- [ ] **Manual step — create a Storage bucket by hand:** same as above, this time named `staff-resumes`, public. Used by HR's résumé/CV upload on both web and mobile.

---

## 4. `supabase_waybills.sql`

**What it does:** `container_number` column on `cargo_intake`; new `waybills` table with a DB-generated sequential waybill number.

- [ ] Run `supabase_waybills.sql`.

---

## 5. `supabase_admin_warehouse_merge.sql`

**What it does:** Widens 19 RLS policies to the merged Operations+Dispatch+Logistics → Admin & Warehouse union; adds the `admin_warehouse` role; fixes a pre-existing role-check gap in `create_order_with_stock_check()`.

⚠️ **Must run before the first "Admin & Warehouse" registration** — the `profiles_role_check` constraint this migration updates is what allows that role to exist at all. A registration attempted before this runs will fail at the database level.

- [ ] Run `supabase_admin_warehouse_merge.sql`.
- [ ] Confirm no pending Admin & Warehouse registrations were sitting in the queue before this ran (they'd have failed silently at the DB layer, not just the UI).

---

## 6. `supabase_marketing_credit_polish.sql`

**What it does:** Masks `cost_price` off `goods_prices` behind a new `goods_prices_catalog` view; narrows `goods_prices`/`finance_payments`/`goods_price_change_requests` RLS; adds an internal role guard to `get_finance_wallet_totals()`; adds `customers.credit_limit`/`credit_status`; adds `rejection_reason` columns across several tables; adds `global_audit_history.reference_id`; rewrites `create_order_with_stock_check()` to enforce per-customer credit limits server-side.

⚠️ **Deploy in the same window as its matching frontend code, not before.** The RLS narrowing in this migration removes read access that pre-Phase-6 frontend code still assumes — if this runs before the frontend is on the version that reads from `goods_prices_catalog`, every Marketing order will price at GHS 0 until the frontend catches up. Since the frontend is already built and deployed-ready from this rollout, this is really just "run it now, then redeploy the frontend immediately after" if they aren't already in sync.

- [ ] Confirm the deployed frontend already expects the masked `goods_prices_catalog` view (it does, per this rollout's own work) before running this.
- [ ] Run `supabase_marketing_credit_polish.sql`.
- [ ] Immediately verify: log in as a non-privileged Marketing account and confirm order pricing still works (not GHS 0).

---

## 7. `supabase_spreadsheets_table.sql`

**What it does:** Backfills the `spreadsheets` table's schema into tracked migration history — the table already existed live (created directly in the dashboard at some point pre-dating any tracked `.sql` file), so this is a safe `CREATE TABLE IF NOT EXISTS` rather than a genuinely new table.

- [ ] Run `supabase_spreadsheets_table.sql`.

---

## 8. `supabase_push_tokens.sql`

**What it does:** New `push_tokens` table (user_id, token, platform) + RLS scoping each user to their own rows. Backs mobile push notifications.

- [ ] Run `supabase_push_tokens.sql`.
- [ ] **Manual step — create a Database Webhook:** Supabase dashboard → Database → Webhooks → New webhook:
  - Table: `public.notifications`
  - Events: `Insert`
  - Type: HTTP Request, method `POST`
  - URL: `https://<your-deployed-rebma-web-domain>/api/send-push`
  - HTTP Headers: `x-webhook-secret: <a value you choose>`
- [ ] **Manual step — set the matching env var in Vercel:** in the `rebma-web` Vercel project's environment variables, add `SUPABASE_WEBHOOK_SECRET` set to the exact same value you put in the webhook header above.
- [ ] Push notifications will still not be end-to-end testable until two more things are true (outside this checklist's scope): (a) you're logged into an EAS account and have run `eas init` so the app has a real `projectId`, and (b) you're testing on a real device or a dev build — Expo Go cannot receive push on Android from SDK 53 onward.

---

## 9. Spot-check bucket that predates this rollout

- [ ] Confirm the `document-logos` Storage bucket still exists (used by Document Templates' logo upload on both web and mobile — it predates this rollout, so this is a confirm-not-create step).

---

## 10. After everything above runs

This checklist only covers getting the database and its supporting infrastructure into the state the code already assumes. Each phase of this rollout has its own detailed manual verification checklist (login as each role, exercise the actual flows, confirm data round-trips) written into the plan file at `/Users/codetrain/.claude/plans/snappy-giggling-toast.md` — worth working through those once the database is live, rather than assuming "it compiled and the migration ran" means every flow actually works end to end.
