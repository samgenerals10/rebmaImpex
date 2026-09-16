# Supabase Deployment Checklist — Enhancement Blueprint Rollout

Everything below is **written but not yet confirmed run** against the live database. Supabase access has been billing-blocked since ~2026-09-01 per standing project notes — this checklist is what to work through once that's resolved.

⚠️ **Read this before anything else — a real, unresolved question about live DB state, not a hypothetical.** `supabase_order_risk_workflow_ROLLBACK.sql` (new, added alongside items #9-10 below) exists *only* because, at some point, `supabase_order_risk_workflow_rls.sql`'s trigger/RLS cutover (Part 2) was **actually applied to the live database** before the matching Web/Mobile code was deployed — which would have blocked every non-admin account from approving, rejecting, or reviewing any order at all. The rollback file's own header says this explicitly. Before running *anything* in this checklist:
- [ ] Confirm with whoever last had Supabase access: is the live DB in (a) the original pre-rollout state, (b) the broken mid-cutover state described above, or (c) already fixed (rollback applied, or the real cutover re-applied after code caught up)?
- [ ] If you can reach the SQL editor yourself, a safe **read-only** check: `select tgname from pg_trigger where tgname in ('orders_status_transition_guard','delivery_logs_status_transition_guard');` — if either row comes back, the triggers are live; check them against whether `risk_final_release`/`accounts_review_order`/etc. also exist (`select proname from pg_proc where proname like '%_review%' or proname like 'risk_%';`) to judge whether the app code that calls them is actually the version currently deployed.
- [ ] Only after that's answered, proceed with #1-11 below in order.

Run items in order. Later migrations generally assume earlier ones already happened. Check items off as you go.

---

## 0. Before you start

- [ ] Confirm Supabase billing/access is actually restored (try opening the project dashboard).
- [ ] Take a manual backup/snapshot of the database first, if your plan supports it — most of these migrations are individually low-risk (additive columns/tables, `IF NOT EXISTS` guards, `CREATE OR REPLACE`), but #5, #6, and #10-11 below widen, narrow, or gate existing RLS/behavior, which is worth having a rollback point for.
- [ ] Have the Supabase SQL editor open, and this repo checked out locally so you can copy each file's contents.

**Note on older `.sql` files**: this repo also has an earlier set of migration files (`supabase_schema.sql`, `supabase_rls_overhaul.sql`, `supabase_control_center*.sql`, `supabase_atomic_functions.sql`, and a few others) dated well before this rollout started. Those are the foundational schema from when the app was already live, and were almost certainly applied back when Supabase was last reachable — they are **not** part of this checklist. This checklist covers the 11 migrations written during the Enhancement Blueprint rollout and the later registration/recruitment + order-risk-workflow redesign (Risk department → mobile platform hardening → Phase 8/9), which are confirmed to have never touched the live database — with the one exception flagged above, whose actual current state needs a direct answer, not an assumption.

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

## 9. `supabase_recruitment_invites.sql`

**What it does:** Phase 8 (invite-only registration). Backfills `staff_invites`'s real schema (candidate's full record: phone, photo, résumé URL, address, guarantor fields, staff category, which contact channels the invite was sent via) since no `CREATE TABLE` for it was ever tracked; adds a Risk-only read policy so Risk can see full pending-candidate detail, not just a notification; creates a new `department_roles` table (a per-department dropdown of job-role names, replacing free-text Role entry) seeded with `risk` → `Driver`.

- [ ] Run `supabase_recruitment_invites.sql`.
- [ ] Confirm `staff-resumes` bucket already exists (created in item #3) — the same bucket backs invite résumé uploads too.

---

## 10. `supabase_order_risk_workflow_rpcs.sql`

**What it does:** Adds five new functions implementing the approved order lifecycle — `risk_initial_review` → `management_review_order` → `accounts_review_order` → `risk_final_release` → `risk_review_pod` — each gated to its own role and only firing on the correct current status. Purely additive: creates functions only, touches no table/column/policy/trigger. Confirmed safe to run any time, independent of whether the matching Web/Mobile code is deployed yet (nothing calls these until item #11 makes them the only legal path).

- [ ] Run `supabase_order_risk_workflow_rpcs.sql`.

---

## 11. `supabase_order_risk_workflow_rls.sql` — the actual cutover, do not run casually

**What it does:** Installs the two `BEFORE UPDATE` triggers that make the four review-gate transitions and the POD→DELIVERED transition reachable *only* through the five functions from item #10, plus RLS tightening that closes a prior "driver can write DELIVERED directly" bypass.

⚠️ **This is the file behind the top-of-document warning.** Its own header is explicit: do not run until (a) the Web *and* Mobile code that calls the five new RPCs is actually deployed — confirmed present in current source (`RiskApprovalsView.tsx`/`MgmtApprovalsView.tsx`/`OrdersQueueView.tsx` on web; `RiskApprovalsScreen.tsx`/`MgmtApprovalsScreen.tsx`/`OrdersQueueScreen.tsx` on mobile — but "in source" is not the same as "live in production," confirm the deployed build actually matches), and (b) you've run the file's own verification queries (at its bottom) against live data first and confirmed nothing is stranded mid-transition.

- [ ] Confirm current deployed Web build and current installed Mobile build both call the 5 RPCs (not raw `.update()` calls) — check the actual running app, not just this repo.
- [ ] Run the verification `select` queries at the bottom of `supabase_order_risk_workflow_rls.sql` first; resolve anything they surface before proceeding.
- [ ] Run `supabase_order_risk_workflow_rls.sql`.
- [ ] Immediately verify: as Risk, Management, and Finance (real non-admin accounts, not the CEO/admin bypass), walk one order through Initial Review → Management → Accounts → Final Release → dispatch (Admin & Warehouse's `APPROVED`→`PROCESSING`→`OUT_FOR_DELIVERY`, now reached via Risk's own `Deliveries`/`ActiveDeliveries` screens per Phase 9) → POD Review → Delivered, end to end, with no illegal-transition error at any step.
- [ ] If anything is wrong mid-rollout, `supabase_order_risk_workflow_ROLLBACK.sql` restores the exact pre-cutover triggers/policies without touching the 5 functions from item #10 — safe to run as an emergency undo, not a normal step in this checklist.

---

## 12. Spot-check bucket that predates this rollout

- [ ] Confirm the `document-logos` Storage bucket still exists (used by Document Templates' logo upload on both web and mobile — it predates this rollout, so this is a confirm-not-create step).

---

## 13. After everything above runs

This checklist only covers getting the database and its supporting infrastructure into the state the code already assumes. Each phase of this rollout has its own detailed manual verification checklist (login as each role, exercise the actual flows, confirm data round-trips) written into the plan file at `/Users/codetrain/.claude/plans/snappy-giggling-toast.md` — worth working through those once the database is live, rather than assuming "it compiled and the migration ran" means every flow actually works end to end.
