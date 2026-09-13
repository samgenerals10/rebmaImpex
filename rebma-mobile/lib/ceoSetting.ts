// rebma-mobile/lib/ceoSetting.ts
//
// Phase 7.6, D48. A lightweight single-key ceo_settings reader — not a
// full CeoSettingsContext port. This phase is the first to need real
// CEO-configured gates (management_price_setting, ceo_must_approve_prices,
// stock_adjustments_allowed, management_can_delete_stock,
// discrepancy_auto_alert_ceo, audit_log_access — five+ separate keys
// across three screens), so a one-off per-screen default would silently
// diverge from what the CEO actually configured. Table shape confirmed
// against rebma-web/src/contexts/CeoSettingsContext.tsx: `ceo_settings`
// has `setting_key`/`setting_value` columns.
import { supabase } from './supabaseClient';

export async function getCeoSetting<T = any>(key: string, defaultValue: T): Promise<T> {
  try {
    const { data } = await supabase.from('ceo_settings').select('setting_value').eq('setting_key', key).maybeSingle();
    const v = data?.setting_value;
    if (v === undefined || v === null) return defaultValue;
    // setting_value can arrive as a JSON string or an already-parsed value
    // depending on the column's live type — mirrors CeoSettingsContext.tsx's
    // own parsing exactly.
    if (typeof v === 'string') {
      try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
    }
    return v as T;
  } catch {
    return defaultValue;
  }
}

// Phase 7.11, D91 — the write counterpart, added for ControlCenterScreen.
// Matches CeoSettingsContext.tsx's updateSetting exactly: upsert on the
// setting_key conflict target.
export async function setCeoSetting(key: string, value: any): Promise<void> {
  await supabase.from('ceo_settings').upsert(
    { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
    { onConflict: 'setting_key' }
  );
}
