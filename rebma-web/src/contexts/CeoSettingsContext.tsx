// rebma-web/src/contexts/CeoSettingsContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface CeoSettingsContextType {
  settings: Record<string, any>;
  getSetting: (key: string, defaultValue?: any) => any;
  updateSetting: (key: string, value: any) => Promise<void>;
  isLoading: boolean;
  reload: () => void;
}

const defaults: Record<string, any> = {
  app_master_switch: true,
  invitation_only: false,
  registrations_allowed: true,
  hr_can_approve_registrations: true,
  management_can_approve_registrations: true,
  credit_sales_enabled: true,
  max_credit_amount: 50000,
  cash_payments_enabled: true,
  cheque_payments_enabled: true,
  momo_payments_enabled: true,
  invoice_generation_enabled: true,
  finance_needs_ceo_cosign: false,
  payroll_processing_enabled: true,
  ceo_approval_threshold: 100000,
  management_price_setting: true,
  ceo_must_approve_prices: false,
  forms_control: true,
  orders_enabled: true,
  cargo_intake_enabled: true,
  stock_adjustments_allowed: true,
  quality_check_needs_cosign: false,
  discrepancy_auto_alert_ceo: true,
  deliveries_enabled: true,
  gps_tracking_enabled: true,
  gps_ping_interval: 10,
  proof_of_delivery_required: true,
  dispatch_needs_management: false,
  data_export_enabled: true,
  data_import_enabled: false,
  audit_log_access: 'management_and_above',
  print_enabled: true,
  report_generation_enabled: true,
  global_chat_enabled: true,
  department_chat_enabled: true,
  direct_messages_enabled: true,
  external_email_enabled: true,
  whatsapp_enabled: true,
  payment_reminders_enabled: true,
  announcements_ceo_only: false,
  maintenance_mode: false,
  session_timeout_minutes: 60,
  force_2fa_management: false,
  force_2fa_finance: false,
  password_reset_authority: 'hr_and_ceo',
  account_deletion_authority: 'ceo_only',
  ceo_cosign_credit_threshold: 10000,
  ceo_cosign_order_threshold: 50000,
  ceo_must_approve_payroll: false,
  ceo_must_approve_departments: false,
  ceo_must_approve_registrations: false,
};

const CeoSettingsContext = createContext<CeoSettingsContextType>({
  settings: defaults,
  getSetting: (key, defaultValue) => defaultValue ?? defaults[key] ?? true,
  updateSetting: async () => {},
  isLoading: false,
  reload: () => {},
});

export function CeoSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any>>(defaults);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from('ceo_settings').select('setting_key, setting_value');
      if (data && data.length > 0) {
        const map: Record<string, any> = { ...defaults };
        for (const row of data) {
          try {
            const v = row.setting_value;
            map[row.setting_key] = typeof v === 'string' ? JSON.parse(v) : v;
          } catch {
            map[row.setting_key] = row.setting_value;
          }
        }
        setSettings(map);
      }
    } catch {
      // Supabase table may not exist yet; use defaults
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  const getSetting = useCallback((key: string, defaultValue?: any): any => {
    if (key in settings) return settings[key];
    if (key in defaults) return defaults[key];
    return defaultValue ?? true;
  }, [settings]);

  const updateSetting = useCallback(async (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    supabase.from('ceo_settings')
      .upsert(
        { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
        { onConflict: 'setting_key' }
      )
      .then(() => {}, () => {});
  }, []);

  return (
    <CeoSettingsContext.Provider value={{ settings, getSetting, updateSetting, isLoading, reload: load }}>
      {children}
    </CeoSettingsContext.Provider>
  );
}

export const useCeoSettings = () => useContext(CeoSettingsContext);
