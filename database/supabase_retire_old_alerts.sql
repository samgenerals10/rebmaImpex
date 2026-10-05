-- supabase_retire_old_alerts.sql
--
-- Closes performance alerts written in the old format: the old dash
-- wording, or a department that no longer exists on its own
-- (Operations, Dispatch and Logistics were merged away). Pressing
-- "Run Check" afterwards creates fresh alerts in the current wording for
-- the current departments. Nothing is deleted: the old rows are marked
-- resolved, so their history stays. Safe to run more than once.

update public.performance_alerts
set status = 'resolved',
    resolved_at = now(),
    resolved_by = null  -- holds a person's id; nobody resolved these by hand
where status = 'open'
  and (
    description like '% — %'
    or upper(department) in ('OPERATIONS', 'DISPATCH', 'LOGISTICS')
  );
