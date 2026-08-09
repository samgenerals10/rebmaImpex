-- ============================================================
-- Lets Management pin the company's exact depot location on a map
-- (Document Templates > Dispatch Ticket tab) instead of relying on
-- auto-geocoding the free-text company address, which can land on the
-- wrong building for a vague address. DispatchMap.tsx's depot-anchoring
-- fallback (for drivers who are ASSIGNED but haven't started their trip
-- yet) uses these coordinates directly when set, falling back to
-- geocoding company_address only if no pin has been saved yet.
-- ============================================================
alter table public.document_templates
  add column if not exists company_lat numeric,
  add column if not exists company_lng numeric;
