-- supabase_ceo_hr_management_security_hardening.sql
--
-- Closes the CEO/Settings/Boardroom/Reception and HR/Production/
-- Management gaps found by this session's department audits that share
-- one root cause each. Run after every other migration already applied.

begin;

-- ============================================================
-- 1. global_audit_history — was in supabase_rls_overhaul.sql's "left
--    alone, low-stakes" bucket (USING(true)/CHECK(true) for every
--    command), but this table is the system-of-record for every
--    approval/rejection/deletion across every department — any
--    authenticated user could read, forge, or delete any entry in it,
--    including erasing the record of their own rejected request. Made
--    effectively append-only: any authenticated user may still INSERT
--    (every department's own approval/rejection flow writes here, with
--    no single shared role list to gate on) and SELECT (the CEO's
--    per-department "Audit Log Access" setting is a UI-level filter on
--    top of this, unchanged); only admin may UPDATE/DELETE, closing the
--    "any employee can wipe the audit trail" hole.
-- ============================================================

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'global_audit_history'
  loop
    execute format('drop policy if exists %I on public.global_audit_history', pol.policyname);
  end loop;
end $$;

alter table public.global_audit_history enable row level security;

create policy "global_audit_history_select" on public.global_audit_history
  for select to authenticated
  using (true);

create policy "global_audit_history_insert" on public.global_audit_history
  for insert to authenticated
  with check (true);

create policy "global_audit_history_update_admin" on public.global_audit_history
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "global_audit_history_delete_admin" on public.global_audit_history
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- 2. profiles self-update — extends profiles_self_update_contact_only
--    (supabase_rls_overhaul.sql) to also pin the performance/guarantor/
--    HR-remarks columns supabase_hr_additions.sql added afterward, which
--    were never added to this policy's WITH CHECK. Without this, any
--    employee could call
--      supabase.from('profiles').update({performance_task_score: 100,
--        performance_reviewed_by: 'CEO', hr_remarks: null}).eq('id', auth.uid())
--    directly and it would pass RLS — self-escalating their own review
--    scores or erasing HR's notes about them.
-- ============================================================

drop policy if exists "profiles_self_update_contact_only" on public.profiles;
create policy "profiles_self_update_contact_only" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and lower(role) = public.current_role()
    and is_admin = public.is_admin()
    and status = public.current_status()
    and basic_salary is not distinct from (public.current_profile()).basic_salary
    and department is not distinct from (public.current_profile()).department
    and position is not distinct from (public.current_profile()).position
    and employment_type is not distinct from (public.current_profile()).employment_type
    and start_date is not distinct from (public.current_profile()).start_date
    and performance_task_score is not distinct from (public.current_profile()).performance_task_score
    and performance_team_score is not distinct from (public.current_profile()).performance_team_score
    and performance_quality_score is not distinct from (public.current_profile()).performance_quality_score
    and performance_notes is not distinct from (public.current_profile()).performance_notes
    and performance_reviewed_by is not distinct from (public.current_profile()).performance_reviewed_by
    and performance_reviewed_at is not distinct from (public.current_profile()).performance_reviewed_at
    and guarantor_name is not distinct from (public.current_profile()).guarantor_name
    and guarantor_phone is not distinct from (public.current_profile()).guarantor_phone
    and guarantor_relationship is not distinct from (public.current_profile()).guarantor_relationship
    and guarantor_id_number is not distinct from (public.current_profile()).guarantor_id_number
    and guarantor_address is not distinct from (public.current_profile()).guarantor_address
    and hr_remarks is not distinct from (public.current_profile()).hr_remarks
    and staff_category is not distinct from (public.current_profile()).staff_category
    and employee_number is not distinct from (public.current_profile()).employee_number
  );

commit;

-- ============================================================
-- Deliberately NOT changed by this migration — flagged for the user,
-- not silently skipped:
--
--   - "Kick Offline" (any authenticated user can force-sign-out anyone
--     via an unauthorized Realtime broadcast) is fixed in application
--     code in this same commit via a new privileged endpoint
--     (api/kick-user.ts, using the Supabase Admin API's real
--     auth.admin.signOut() — an actual server-side session invalidation,
--     not just a client-side "please sign yourself out" broadcast a
--     modified client could ignore), not SQL.
--
--   - The public, unauthenticated Jitsi boardroom room
--     (meet.jit.si/RembaImpexGhanaExecutiveBoardroom_101, reachable by
--     anyone on the internet who learns the name — now also written down
--     in this migration's own commit history) needs a real infrastructure
--     decision (self-hosting Jitsi, or a provider supporting server-
--     issued per-session JWTs) that's out of scope for a migration file.
--     Flagged as the single most severe open item from this round of
--     audits — recommend prioritizing this conversation with the user
--     before the next Boardroom-adjacent change.
--
--   - Mobile never enforcing maintenance_mode / app_master_switch /
--     force_2fa_management / force_2fa_finance / session_timeout_minutes
--     (web gates the whole app behind these in App.tsx; mobile has no
--     equivalent root gate at all) is a real, large parity gap — a CEO
--     flipping Maintenance Mode or forcing 2FA for Finance from either
--     platform has zero effect on mobile users. Needs a new mobile-side
--     root gate file (e.g. wrapping RootNavigator.tsx), which is a
--     meaningfully sized net-new feature, not a quick fix — flagged for
--     prioritization rather than attempted in this pass.
--
--   - "My Payroll" self-service being permanently empty on web (payroll
--     items are never actually linked to an employee_id/staff_id at
--     creation) is the exact same schema-drift question already
--     documented as a deliberately deferred, unresolved gap earlier in
--     this project's own history (Gap-Closure Backlog, Item 4) — not
--     re-litigated here.
--
--   - The `profiles_directory` privacy-narrowing migration
--     (supabase_privacy_followup.sql) appears only partially adopted in
--     application code (~14 call sites still query `profiles` directly
--     for name lookups instead of the safe view) — whether this is a
--     live problem depends on whether that migration has actually been
--     run against the database yet, which needs the user to check
--     directly; not guessed at here.
-- ============================================================
