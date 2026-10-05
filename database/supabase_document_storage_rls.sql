-- ============================================================
-- Private storage for business certificates + staff résumés.
--
-- Confirmed decisions (this session):
--   business-certificates: Marketing uploads; Risk (real, live
--     verification workflow), Management, and CEO can view.
--   staff-resumes: HR uploads; Risk gets read access now (ahead of the
--     formal HR<->Risk vetting workflow, which is separate, larger work
--     tracked on its own — see the design proposal for that).
--
-- Both buckets are PRIVATE — created here via SQL (a documented, valid
-- way to create a Supabase Storage bucket; equivalent to the dashboard's
-- "New bucket" with Public toggled off). Confirmed via the exact
-- chat-attachments precedent already live in this schema
-- (supabase_schema.sql:932-936 + apiClient.ts's uploadChatAttachment/
-- getSignedAttachmentUrl): upload stores the raw object PATH (not a
-- public URL), and a signed URL is minted on demand at view time,
-- 7-day expiry — the same pattern, not a new one.
--
-- Zero real data currently exists in either bucket — you paused before
-- ever creating them, so there is no public-URL data to migrate or
-- reconcile. Safe to run as a clean start.
-- ============================================================

-- 1. Create both buckets as private.
insert into storage.buckets (id, name, public)
values ('business-certificates', 'business-certificates', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('staff-resumes', 'staff-resumes', false)
on conflict (id) do nothing;

-- 2. business-certificates: Marketing uploads; Marketing/Risk/Management
--    (+ admin, which already covers CEO via public.is_admin()) can view.
drop policy if exists "business_certificates_insert" on storage.objects;
create policy "business_certificates_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-certificates'
    and (public.current_role() = 'marketing' or public.is_admin())
  );

drop policy if exists "business_certificates_select" on storage.objects;
create policy "business_certificates_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-certificates'
    and (public.current_role() in ('marketing','risk','management') or public.is_admin())
  );

-- 3. staff-resumes: HR uploads; HR + Risk (+ admin) can view. Risk's
--    access here is granted AHEAD OF a formal vetting workflow existing
--    (confirmed: no such workflow exists in the app today) — a
--    deliberate, explicit decision, not an oversight. The workflow
--    itself (visibility/comment for Risk, HR retains sole approval
--    authority per the earlier gap-matrix finding) is separate, larger
--    work, proposed and tracked on its own before implementation.
drop policy if exists "staff_resumes_insert" on storage.objects;
create policy "staff_resumes_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'staff-resumes'
    and (public.current_role() = 'hr' or public.is_admin())
  );

drop policy if exists "staff_resumes_select" on storage.objects;
create policy "staff_resumes_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'staff-resumes'
    and (public.current_role() in ('hr','risk') or public.is_admin())
  );
