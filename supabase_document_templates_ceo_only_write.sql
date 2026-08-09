-- ============================================================
-- document_templates was left on the blanket "any authenticated user can
-- read/write" policy from the original RLS overhaul, categorized then as
-- low-risk shared config (just branding text). It now also holds
-- company_lat/company_lng — the exact coordinates the dispatch map anchors
-- routes to for any driver who's ASSIGNED but hasn't started sharing live
-- GPS yet. The UI already restricts editing to CEO (Settings > Control
-- Center > Document Templates), but that's UI-only: any authenticated
-- account could still overwrite the pin or letterhead directly via the
-- API. This closes that gap the same way ceo_settings/ceo_feature_exceptions
-- already work — broad read (every department's print flow calls
-- documentTemplates.get() from its own session), CEO-only write.
-- ============================================================
-- The live policy is "document_templates_broad" (added by the RLS overhaul's
-- self-cleaning pass, which drops whatever's there first) — dropping the
-- original schema-file name too, defensively, in case of any drift.
drop policy if exists "document_templates_broad" on public.document_templates;
drop policy if exists "Allow authenticated users full access to document_templates" on public.document_templates;

create policy "document_templates_select_broad" on public.document_templates
  for select to authenticated using (true);

create policy "document_templates_write_admin_only" on public.document_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
