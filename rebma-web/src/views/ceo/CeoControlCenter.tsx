// rebma-web/src/views/ceo/CeoControlCenter.tsx
import { openExportPreview } from '../../utils/exportPreview';
import { useState, useEffect } from 'react';
import {
  Shield, ChevronDown, ChevronUp, Users, DollarSign, Activity, Truck,
  Database, MessageCircle, Settings, CheckSquare, AlertTriangle, Bell,
  UserPlus, Copy, Check, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff,
  Clock, Lock, Globe, Mail, Phone, Building2, RefreshCw, X, Plus, Search,
  FileSpreadsheet, Package, ShoppingCart, Camera, Ban, UserX, Key, FileEdit, Cake, Crown,
  LogOut, ShieldCheck
} from 'lucide-react';
import PasswordConfirmModal from '../../components/ui/PasswordConfirmModal';
import { callPrivilegedApi } from '../../utils/privilegedApi';
import { kickUserOffline } from '../../lib/presence';
import { API_KEY_DEFS } from '../../utils/apiKeyDefs';
import { supabase } from '../../lib/supabaseClient';
import { newSecureToken } from '../../utils/secureToken';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';
import DocumentTemplatesView from '../management/DocumentTemplatesView';
import SidePanel from '../../components/ui/SidePanel';
import SearchableDropdown from '../../components/ui/SearchableDropdown';
import ResponsiveDataView, { type DataColumn } from '../../components/mobile/ResponsiveDataView';
import { exportToCSV } from '../../utils/export';
import { CEO_SETTINGS_SCHEMA, getSchemaSection, type SettingFieldSpec } from '../../utils/ceoSettingsSchema';

interface Props {
  currentUser: { id?: string; fullName: string; email?: string; department: string; isAdmin?: boolean } | null;
  addNotification: (msg: string) => void;
}

// ── Toggle Component ──────────────────────────────────────────────────────────
function SettingToggle({
  label, description, settingKey, warning,
}: { label: string; description: string; settingKey: string; warning?: string }) {
  const { getSetting, updateSetting } = useCeoSettings();
  const value = getSetting(settingKey, true);
  const [showWarn, setShowWarn] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const toggle = (next: boolean) => {
    const dangerousState = settingKey === 'maintenance_mode' ? true : false;
    if (warning && next === dangerousState) { setPendingValue(next); setShowWarn(true); return; }
    updateSetting(settingKey, next);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
        </div>
        <button
          onClick={() => toggle(!value)}
          className="shrink-0 mt-0.5 cursor-pointer"
          title={value ? 'Turn OFF' : 'Turn ON'}
        >
          {value
            ? <ToggleRight className="w-8 h-8 text-[var(--accent)]" />
            : <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />}
        </button>
      </div>
      <SidePanel
        open={showWarn}
        onClose={() => setShowWarn(false)}
        title="Warning"
        badge={<AlertTriangle className="w-4 h-4 text-amber-500" />}
        footer={
          <>
            <button onClick={() => setShowWarn(false)} className="erp-btn erp-btn-ghost">Cancel</button>
            <button onClick={() => { setShowWarn(false); if (pendingValue !== null) { updateSetting(settingKey, pendingValue); setPendingValue(null); } }} className="erp-btn erp-btn-danger">Confirm</button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{warning}</p>
      </SidePanel>
    </>
  );
}

// ── Toggle With Per-User Email Exception Component ────────────────────────────
function SettingToggleWithException({
  label, description, settingKey,
}: { label: string; description: string; settingKey: string }) {
  const { getSetting, updateSetting } = useCeoSettings();
  const value = getSetting(settingKey, true);
  const [exceptions, setExceptions] = useState<Array<{ user_email: string; allowed: boolean }>>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newAllowed, setNewAllowed] = useState(false); // default: block that user
  const [showExc, setShowExc] = useState(false);
  const [loadingExc, setLoadingExc] = useState(false);

  useEffect(() => {
    if (!showExc) return;
    setLoadingExc(true);
    supabase
      .from('ceo_feature_exceptions')
      .select('user_email, allowed')
      .eq('feature_key', settingKey)
      .then(({ data }) => { setExceptions(data || []); setLoadingExc(false); }, () => setLoadingExc(false));
  }, [showExc, settingKey]);

  const addException = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    supabase
      .from('ceo_feature_exceptions')
      .upsert([{ feature_key: settingKey, user_email: email, allowed: newAllowed }], { onConflict: 'feature_key,user_email' })
      .then(() => {
        setExceptions(prev => [...prev.filter(e => e.user_email !== email), { user_email: email, allowed: newAllowed }]);
        setNewEmail('');
      }, () => {});
  };

  const removeException = (email: string) => {
    supabase
      .from('ceo_feature_exceptions')
      .delete()
      .eq('feature_key', settingKey)
      .eq('user_email', email)
      .then(() => { setExceptions(prev => prev.filter(e => e.user_email !== email)); }, () => {});
  };

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <div className="flex items-start justify-between gap-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
        </div>
        <button onClick={() => updateSetting(settingKey, !value)} className="shrink-0 mt-0.5 cursor-pointer" title={value ? 'Turn OFF' : 'Turn ON'}>
          {value ? <ToggleRight className="w-8 h-8 text-[var(--accent)]" /> : <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />}
        </button>
      </div>
      <div className="pb-3">
        <button
          onClick={() => setShowExc(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[var(--accent)] font-semibold hover:opacity-80 cursor-pointer">
          <Key className="w-3 h-3" />
          {showExc ? 'Hide' : 'Manage'} User Email Exceptions
          {exceptions.length > 0 && !showExc && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px]">{exceptions.length}</span>}
        </button>
        {showExc && (
          <div className="mt-3 space-y-3 pl-2 border-l-2 border-[var(--accent-light)]">
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Each email exception overrides the master toggle above for that specific user only.
              An <strong>Allow</strong> exception grants access even when the master toggle is OFF.
              A <strong>Block</strong> exception denies access even when the master toggle is ON.
            </p>
            {/* Add exception form */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addException()}
                placeholder="user@example.com"
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <SearchableDropdown
                value={newAllowed ? 'allow' : 'block'}
                onChange={v => setNewAllowed(v === 'allow')}
                options={[{ value: 'block', label: 'Block this user' }, { value: 'allow', label: 'Allow this user' }]}
                className="min-w-[160px]"
              />
              <button
                onClick={addException}
                disabled={!newEmail.trim()}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                style={{ background: 'var(--accent)' }}>
                Add
              </button>
            </div>
            {/* Exception list */}
            {loadingExc ? (
              <p className="text-xs text-[var(--text-muted)]">Loading…</p>
            ) : exceptions.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No exceptions yet. All users follow the master toggle.</p>
            ) : (
              <div className="space-y-1.5">
                {exceptions.map(ex => (
                  <div key={ex.user_email} className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-input)] rounded-xl">
                    <span className="text-xs font-mono text-[var(--text-primary)] truncate flex-1">{ex.user_email}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ex.allowed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {ex.allowed ? 'ALLOWED' : 'BLOCKED'}
                    </span>
                    <button
                      onClick={() => removeException(ex.user_email)}
                      className="p-1 hover:bg-rose-500/10 rounded text-[var(--text-muted)] hover:text-rose-500 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Number Input Component ────────────────────────────────────────────────────
function SettingNumber({ label, description, settingKey, min = 0, max = 999999, unit = '' }: {
  label: string; description: string; settingKey: string; min?: number; max?: number; unit?: string;
}) {
  const { getSetting, updateSetting } = useCeoSettings();
  const stored = getSetting(settingKey, 0);
  const [local, setLocal] = useState<string>(String(stored));

  useEffect(() => { setLocal(String(getSetting(settingKey, 0))); }, [settingKey, stored]);

  const save = () => {
    const n = parseFloat(local);
    if (!isNaN(n) && n >= min && n <= max) updateSetting(settingKey, n);
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {unit && <span className="text-xs text-[var(--text-muted)] font-mono">{unit}</span>}
        <input placeholder="0"
          type="number"
          value={local}
          min={min} max={max}
          onChange={e => setLocal(e.target.value)}
          onBlur={save}
          className="w-24 px-2 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] text-right"
        />
      </div>
    </div>
  );
}

// ── Select Component ──────────────────────────────────────────────────────────
function SettingSelect({ label, description, settingKey, options }: {
  label: string; description: string; settingKey: string;
  options: Array<{ value: string; label: string }>;
}) {
  const { getSetting, updateSetting } = useCeoSettings();
  const value = getSetting(settingKey, options[0]?.value);

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <SearchableDropdown
        value={value}
        onChange={v => updateSetting(settingKey, v)}
        options={options}
        className="shrink-0 min-w-[160px]"
      />
    </div>
  );
}

// ── Text Component (saves when the box loses focus) ──────────────────────────
function SettingText({ label, description, settingKey, placeholder }: {
  label: string; description: string; settingKey: string; placeholder?: string;
}) {
  const { settings, updateSetting } = useCeoSettings();
  const stored = typeof settings[settingKey] === 'string' ? settings[settingKey] : '';
  const [local, setLocal] = useState<string>(stored);
  useEffect(() => { setLocal(stored); }, [stored]);
  return (
    <div className="py-3 border-b border-[var(--border)] last:border-0">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
      <textarea
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== stored) updateSetting(settingKey, local); }}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );
}

// ── API Keys (direct instruction: every key is entered here) ─────────────────
// Read and written straight to ceo_settings rather than through the shared
// settings context, so a secret is only ever loaded on this screen. The
// server-only secrets are CEO-only under RLS (supabase_secret_settings.sql).
function ApiKeysSection({ addNotification }: { addNotification: (msg: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('ceo_settings').select('setting_key, setting_value').in('setting_key', API_KEY_DEFS.map(d => d.key))
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const row of data || []) {
          const v = row.setting_value;
          map[row.setting_key] = typeof v === 'string' ? v : v == null ? '' : String(v);
        }
        setValues(map);
      });
  }, []);

  const save = async (key: string, value: string) => {
    setSaving(key);
    const { error } = await supabase.from('ceo_settings').upsert(
      { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
      { onConflict: 'setting_key' },
    );
    setSaving(null);
    if (error) { addNotification(`Could not save: ${error.message}`); return; }
    setValues(prev => ({ ...prev, [key]: value }));
    setDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    addNotification(value ? 'Saved.' : 'Removed.');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        Every key the app uses lives here. Only the database connection stays in Vercel. Changes take effect on the next message or request, with no redeploy.
      </p>
      {API_KEY_DEFS.map(def => {
        const current = values[def.key] || '';
        const draft = drafts[def.key];
        const shown = draft ?? current;
        const dirty = draft !== undefined && draft !== current;
        return (
          <div key={def.key} className="py-3 border-b border-[var(--border)] last:border-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)] flex-1">{def.label}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${current ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}>
                {current ? 'SET' : 'NOT SET'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{def.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type={def.plain || revealed[def.key] ? 'text' : 'password'}
                value={shown}
                onChange={e => setDrafts(prev => ({ ...prev, [def.key]: e.target.value }))}
                placeholder={def.placeholder}
                autoComplete="off"
                className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              {!def.plain && (
                <button type="button" onClick={() => setRevealed(prev => ({ ...prev, [def.key]: !prev[def.key] }))}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" aria-label={revealed[def.key] ? 'Hide key' : 'Show key'}>
                  {revealed[def.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
              <button type="button" disabled={!dirty || saving === def.key} onClick={() => save(def.key, (draft || '').trim())}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer" style={{ background: 'var(--accent)' }}>
                {saving === def.key ? 'Saving…' : 'Save'}
              </button>
              {current && (
                <button type="button" onClick={() => { if (window.confirm(`Remove ${def.label}?`)) save(def.key, ''); }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 border border-[var(--border)] hover:bg-rose-500/10 cursor-pointer">
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Generic field renderer, driven by utils/ceoSettingsSchema.ts ──────────────
// The 4 components above (SettingToggle/SettingToggleWithException/
// SettingNumber/SettingSelect) are completely untouched — this only
// dispatches to whichever one a schema entry's `kind` calls for, so the
// 9 plain sections below can be rendered from data instead of one
// hand-written JSX element per setting. Same schema is imported by
// utils/helpKnowledgeBase.ts for the Help Assistant's search — one
// source of truth, edit a field here and it's simultaneously live in
// both places.
function SettingField({ field }: { field: SettingFieldSpec }) {
  switch (field.kind) {
    case 'toggle':
      return <SettingToggle settingKey={field.key} label={field.label} description={field.description} warning={field.warning} />;
    case 'toggleWithException':
      return <SettingToggleWithException settingKey={field.key} label={field.label} description={field.description} />;
    case 'number':
      return <SettingNumber settingKey={field.key} label={field.label} description={field.description} min={field.min} max={field.max} unit={field.unit} />;
    case 'select':
      return <SettingSelect settingKey={field.key} label={field.label} description={field.description} options={field.options} />;
    case 'text':
      return <SettingText settingKey={field.key} label={field.label} description={field.description} placeholder={field.placeholder} />;
  }
}

// ── Section Wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--box-shadow)] overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[var(--accent)]" />
          <span className="font-bold text-[var(--text-primary)] text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && <div className="px-6 pb-4">{children}</div>}
    </div>
  );
}

// ── Data Reset Center ─────────────────────────────────────────────────────────
// Every non-ALL department gets its own audit-trail entry, scoped to just
// its own rows (see the department filter applied in run()) rather than
// wiping the shared table outright — so e.g. clearing Marketing's data
// doesn't also erase Finance's or Operations' audit history.
const AUDIT_ENTRY = { name: 'global_audit_history', label: 'Department Audit Trail' };

const DEPT_TABLES: Record<string, { label: string; tables: { name: string; label: string }[] }> = {
  MARKETING:   { label: 'Marketing',   tables: [{ name: 'orders', label: 'Sales Orders' }, { name: 'customers', label: 'Customer Directory' }, AUDIT_ENTRY] },
  FINANCE:     { label: 'Account Department',     tables: [
    { name: 'finance_payments', label: 'Account Department Payments (Receipts)' },
    { name: 'finance_expenses', label: 'Account Department Expenses' },
    { name: 'finance_cheques', label: 'Account Department Cheques' },
    { name: 'finance_petty_cash', label: 'Account Department Petty Cash' },
    { name: 'recurring_payments', label: 'Recurring Payments' },
    { name: 'finance_report_history', label: 'Financial Statements & Reports History' },
    AUDIT_ENTRY
  ] },
  OPERATIONS:  { label: 'Operations',  tables: [
    { name: 'cargo_intake', label: 'Cargo Intake Log' },
    { name: 'stock_ledger', label: 'Recent Stock Movements' },
    { name: 'general_purchases', label: 'General Purchases' },
    { name: 'stock', label: 'Stock Levels' },
    { name: 'wip_stock', label: 'WIP Stock' },
    AUDIT_ENTRY
  ] },
  PRODUCTION:  { label: 'Production',  tables: [{ name: 'production_logs', label: 'Production Logs' }, { name: 'production_requests', label: 'Production Requests' }, AUDIT_ENTRY] },
  MANAGEMENT:  { label: 'Management',  tables: [
    { name: 'goods_prices', label: 'Goods Prices Catalog' },
    { name: 'supplier_orders', label: 'Supplier Orders' },
    { name: 'suppliers', label: 'Suppliers Directory' },
    { name: 'departments', label: 'Departments Directory' },
    AUDIT_ENTRY
  ] },
  HR:          { label: 'HR',          tables: [
    { name: 'payroll_batches', label: 'Payroll Batches' },
    { name: 'payroll_entries', label: 'Payroll Entries' },
    { name: 'payroll_items', label: 'Payroll Items' },
    { name: 'leave_requests', label: 'Leave Requests' },
    { name: 'attendance', label: 'Attendance Logs' },
    AUDIT_ENTRY
  ] },
  DISPATCH:    { label: 'Dispatch',    tables: [{ name: 'delivery_logs', label: 'Delivery Logs' }, { name: 'drivers', label: 'Drivers Directory' }, AUDIT_ENTRY] },
  RECEPTION:   { label: 'Reception',   tables: [{ name: 'visitors', label: 'Visitors Logs' }, AUDIT_ENTRY] },
  LOGISTICS:   { label: 'Logistics',   tables: [AUDIT_ENTRY] },
  ALL:         { label: 'ALL Departments', tables: [
    { name: 'orders', label: 'Sales Orders' }, { name: 'customers', label: 'Customer Directory' },
    { name: 'finance_payments', label: 'Account Department Payments (Receipts)' }, { name: 'finance_expenses', label: 'Account Department Expenses' }, { name: 'finance_cheques', label: 'Account Department Cheques' }, { name: 'finance_petty_cash', label: 'Account Department Petty Cash' }, { name: 'recurring_payments', label: 'Recurring Payments' }, { name: 'finance_report_history', label: 'Financial Statements & Reports History' },
    { name: 'cargo_intake', label: 'Cargo Intake Log' }, { name: 'stock_ledger', label: 'Recent Stock Movements' }, { name: 'general_purchases', label: 'General Purchases' }, { name: 'stock', label: 'Stock Levels' }, { name: 'wip_stock', label: 'WIP Stock' },
    { name: 'production_logs', label: 'Production Logs' }, { name: 'production_requests', label: 'Production Requests' },
    { name: 'goods_prices', label: 'Goods Prices Catalog' }, { name: 'supplier_orders', label: 'Supplier Orders' }, { name: 'suppliers', label: 'Suppliers Directory' }, { name: 'departments', label: 'Departments Directory' },
    { name: 'payroll_batches', label: 'Payroll Batches' }, { name: 'payroll_entries', label: 'Payroll Entries' }, { name: 'payroll_items', label: 'Payroll Items' }, { name: 'leave_requests', label: 'Leave Requests' }, { name: 'attendance', label: 'Attendance Logs' },
    { name: 'delivery_logs', label: 'Delivery Logs' }, { name: 'drivers', label: 'Drivers Directory' },
    { name: 'visitors', label: 'Visitors Logs' },
    { name: 'global_audit_history', label: 'Global Audit History' }, { name: 'supplier_order_notifications', label: 'Supplier Order Notifications' },
  ]},
};

// Phase 11.6 — message export + audit trail. Reads channels/chat_messages
// directly, scoped by is_admin() in RLS (see
// supabase_messenger_security_hardening.sql's chat_messages_select/
// channels_select policies) — so this is a real, full audit tool for the
// CEO specifically, not just the same wide-open table read every other
// account already had before that migration. Logs its own use to
// global_audit_history, matching this app's standing convention for
// sensitive admin actions.
function MessageExportSection({ currentUser, addNotification }: { currentUser: Props['currentUser']; addNotification: (m: string) => void }) {
  const [channels, setChannels] = useState<{ id: string; name: string | null; type: string }[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase.from('channels').select('id, name, type').then(({ data }) => setChannels(data || []));
  }, []);

  const channelLabel = (c: { id: string; name: string | null; type: string }) =>
    c.type === 'everyone' ? 'Everyone' : c.type === 'group' ? (c.name || 'Group') : `DM ${c.id.slice(-6)}`;

  const runExport = async () => {
    setExporting(true);
    try {
      let query = supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
      if (selectedChannel) query = query.eq('channel_id', selectedChannel);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data || []).map((m: any) => ({
        channel_id: m.channel_id, sender: m.sender, content: m.deleted_at ? '(deleted)' : m.content,
        time: m.time, created_at: m.created_at, attachment_type: m.attachment_type || '',
      }));
      exportToCSV(rows, ['channel_id', 'sender', 'content', 'time', 'created_at', 'attachment_type'], `messenger-export-${selectedChannel || 'all'}-${Date.now()}`);
      await supabase.from('global_audit_history').insert({
        department: 'CEO',
        action: `EXPORT: Messenger history, ${selectedChannel ? channelLabel(channels.find(c => c.id === selectedChannel)!) : 'All conversations'} (${rows.length} messages)`,
        performed_by: currentUser?.fullName || 'CEO',
        reference_id: selectedChannel || null,
        timestamp: new Date().toISOString(),
      });
      addNotification(`Exported ${rows.length} messages.`);
    } catch (e: any) {
      addNotification(`Export failed: ${e.message}`);
    }
    setExporting(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Message Export & Audit Trail</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">Export a conversation's full message history as CSV. Leave the picker blank to export every conversation. Every export is itself logged to the audit trail below.</p>
        <div className="mt-2 flex items-center gap-2">
          <SearchableDropdown
            value={selectedChannel}
            onChange={setSelectedChannel}
            options={[{ value: '', label: 'All conversations' }, ...channels.map(c => ({ value: c.id, label: channelLabel(c) }))]}
            className="min-w-[220px]"
          />
          <button onClick={runExport} disabled={exporting} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer" style={{ background: 'var(--accent)' }}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DataResetSection({ addNotification }: { addNotification: (m: string) => void }) {
  const [selectedDept, setSelectedDept] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [confirmText, setConfirmText]   = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState('');
  const [running, setRunning]           = useState(false);
  const [results, setResults]           = useState<{ table: string; deleted: number; error?: string }[]>([]);
  const [done, setDone]                 = useState(false);

  const open = (dept: string) => {
    setSelectedDept(dept);
    setConfirmText('');
    setPassword('');
    setError('');
    setResults([]);
    setDone(false);
    setShowModal(true);
  };

  const close = () => { if (running) return; setShowModal(false); setPassword(''); };

  // Runs on the server now (api/data-reset.ts): CEO only, the password is
  // checked there, the table list there is the one that counts, and the
  // stock safeguard (sold quantities put back into stock before the sale
  // records are deleted) runs there too. The counts shown are real.
  const run = async () => {
    if (confirmText !== 'CONFIRM DELETE') return;
    if (!password) { setError('Enter your password.'); return; }
    const cfg = DEPT_TABLES[selectedDept];
    if (!cfg) return;
    setRunning(true);
    setError('');
    try {
      const res = await callPrivilegedApi<{ results: { table: string; deleted: number; error?: string }[] }>('/api/data-reset', { department: selectedDept, confirmText, password });
      setResults(res.results || []);
      setDone(true);
      setPassword('');
      addNotification(`Data reset complete for ${cfg.label}.`);
    } catch (e: any) {
      setError(e?.message || 'The reset did not run.');
    } finally {
      setRunning(false);
    }
  };

  const depts = Object.keys(DEPT_TABLES);

  return (
    <>
      <div className="space-y-4 pt-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Permanently delete operational data to start a fresh workflow cycle.
          Staff accounts and system settings are <strong>not</strong> affected.
          This action cannot be undone.
        </p>

        {/* Department grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {depts.filter(d => d !== 'ALL').map(d => {
            const cfg = DEPT_TABLES[d];
            return (
              <button key={d} onClick={() => open(d)}
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg)] hover:border-rose-400 hover:bg-rose-50 transition-all cursor-pointer text-left group">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-rose-600">{cfg.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{cfg.tables.map(t => t.label || t.name).join(', ')}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Clear all button */}
        <button onClick={() => open('ALL')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-rose-400 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm cursor-pointer transition-all">
          <Trash2 className="w-4 h-4" />
          Clear All Data (Full Reset)
        </button>
      </div>

      {/* Confirmation Modal */}
      {showModal && (() => {
        const cfg = DEPT_TABLES[selectedDept];
        const ready = confirmText === 'CONFIRM DELETE' && !!password;
        return (
          <SidePanel
            open
            onClose={close}
            title={done ? 'Reset Complete' : `Clear ${cfg.label} Data`}
            subtitle={done ? 'Review results below.' : 'This action is irreversible.'}
            badge={<AlertTriangle className="w-4 h-4 text-rose-500" />}
            footer={
              !done ? (
                <>
                  <button onClick={close} disabled={running} className="erp-btn erp-btn-ghost disabled:opacity-40">Cancel</button>
                  <button onClick={run} disabled={!ready || running}
                    className="erp-btn text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: ready ? '#ef4444' : '#fca5a5' }}>
                    {running ? 'Deleting…' : `Delete ${cfg.label} Data`}
                  </button>
                </>
              ) : (
                <button onClick={close} className="erp-btn erp-btn-primary w-full">Done. Start Fresh Workflow</button>
              )
            }
          >
              <div className="space-y-4">
                {!done ? (
                  <>
                    {/* What will be deleted */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Tables that will be cleared:</p>
                      {cfg.tables.map(t => (
                        <div key={t.name} className="flex items-center gap-2 text-xs text-rose-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          <span className="font-mono">{t.label || t.name} ({t.name})</span>
                        </div>
                      ))}
                    </div>

                    {/* Type to confirm */}
                    <div className="space-y-2">
                      <p className="text-xs text-[var(--text-secondary)]">
                        Type <strong className="text-rose-600 font-mono">CONFIRM DELETE</strong> to unlock the reset button:
                      </p>
                      <input
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        placeholder="CONFIRM DELETE"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-rose-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-[var(--text-secondary)]">Your password, checked on the server to confirm it is you:</p>
                      <input
                        type="password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        autoComplete="current-password"
                        placeholder="Type your sign-in password"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-rose-400"
                      />
                      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    {results.map(r => {
                      const matched = cfg.tables.find(t => t.name === r.table);
                      const displayLabel = matched ? `${matched.label} (${r.table})` : r.table;
                      return (
                        <div key={r.table} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold ${r.error ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                          <span className={`font-mono ${r.error ? 'text-rose-600' : 'text-emerald-700'}`}>{displayLabel}</span>
                          <span className={r.error ? 'text-rose-500' : 'text-emerald-600'}>
                            {r.error ? `Error: ${r.error}` : `${r.deleted} deleted`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          </SidePanel>
        );
      })()}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CeoControlCenter({ currentUser, addNotification }: Props) {
  const { getSetting, updateSetting } = useCeoSettings();

  // Pending approvals
  const [pendingCounts, setPendingCounts] = useState({
    registrations: 0, departments: 0, payroll: 0, cosigns: 0,
  });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [invites, setInvites] = useState<any[]>([]);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [settingChangesLog, setSecurityLog] = useState<any[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    fullName: '', email: '', phone: '', department: 'MARKETING', role: 'staff',
    expiry: '24h', autoApprove: false,
  });
  const [generatedLink, setGeneratedLink] = useState('');
  // What happened when the link was sent by email / SMS, so the CEO is
  // never told it went out when it didn't.
  const [inviteDelivery, setInviteDelivery] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [delegateForm, setDelegateForm] = useState({
    searchEmail: '', name: '', permissions: [] as string[], expiresAt: '',
  });

  const [dbDepartments, setDbDepartments] = useState<any[]>([]);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decidingDeptId, setDecidingDeptId] = useState<string | null>(null);

  const handleRenameDept = async (id: string, oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingDeptId(null);
      return;
    }
    const { error } = await supabase.from('departments').update({ name: newName.trim() }).eq('id', id);
    if (error) {
      addNotification(`Failed to rename department: ${error.message}`);
    } else {
      setDbDepartments(prev => prev.map(d => d.id === id ? { ...d, name: newName.trim() } : d));
      addNotification(`Department renamed to "${newName.trim()}" successfully.`);
      supabase.from('profiles').update({ department: newName.trim() }).eq('department', oldName).then(() => {});
    }
    setEditingDeptId(null);
  };

  const invitationOnly = getSetting('invitation_only', false);
  const systemOnline = getSetting('app_master_switch', true) && !getSetting('maintenance_mode', false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Pending registrations
    supabase.from('profiles').select('id').eq('status', 'PENDING_APPROVAL')
      .then(({ data }) => setPendingCounts(p => ({ ...p, registrations: data?.length ?? 0 })), () => {});

    // Pending invites
    supabase.from('staff_invites').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setInvites(data); }, () => {});

    // Delegates
    supabase.from('ceo_delegations').select('*').eq('active', true).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setDelegates(data); }, () => {});

    // Staff
    supabase.from('profiles').select('id, full_name, email, role, status, department, created_at, is_admin').neq('status', 'TERMINATED').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setStaffList(data); }, () => {});

    // Security log (last 10 ceo_settings changes)
    supabase.from('ceo_settings').select('setting_key, description, updated_at').order('updated_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setSecurityLog(data); }, () => {});

    // Departments
    supabase.from('departments').select('*').order('name')
      .then(({ data }) => {
        if (data) {
          setDbDepartments(data);
          setPendingCounts(p => ({ ...p, departments: data.filter((d: any) => d.status === 'pending').length }));
        }
      }, () => {});

  };

  const decideDepartment = async (id: string, approve: boolean) => {
    setDecidingDeptId(id);
    const dept = dbDepartments.find(d => d.id === id);
    try {
      if (approve) {
        const { error } = await supabase.from('departments').update({ status: 'active' }).eq('id', id);
        if (error) throw error;
        setDbDepartments(prev => prev.map(d => d.id === id ? { ...d, status: 'active' } : d));
      } else {
        const { error } = await supabase.from('departments').delete().eq('id', id);
        if (error) throw error;
        setDbDepartments(prev => prev.filter(d => d.id !== id));
      }
      setPendingCounts(p => ({ ...p, departments: Math.max(0, p.departments - 1) }));
      addNotification(approve ? `Department "${dept?.name}" approved.` : `Department "${dept?.name}" rejected and removed.`);
    } catch (e: any) {
      addNotification(`Failed to record decision: ${e.message}`);
    } finally {
      setDecidingDeptId(null);
    }
  };

  const generateInviteLink = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const token = await newSecureToken();
      const expiryHours: Record<string, number> = { '24h': 24, '48h': 48, '7d': 168 };
      const hours = expiryHours[inviteForm.expiry] ?? 24;
      const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();

      const email = inviteForm.email.trim();
      const phone = inviteForm.phone.trim();
      const { data: created, error } = await supabase.from('staff_invites').insert([{
        token,
        email: email || null,
        phone: phone || null,
        full_name: inviteForm.fullName.trim() || null,
        department: inviteForm.department,
        role: inviteForm.role,
        auto_approve: inviteForm.autoApprove,
        expires_at: expiresAt,
        status: 'pending',
      }]).select('id').single();
      if (error || !created) throw new Error(error?.message || 'The invite was not saved.');
      const link = `${window.location.origin}/register?token=${token}`;
      setGeneratedLink(link);
      setInviteDelivery('');

      // Send the link to the person by email and SMS, whichever details
      // were given. The link stays on screen to copy either way.
      const channels = [email ? 'email' : null, phone ? 'sms' : null].filter(Boolean) as string[];
      if (channels.length) {
        try {
          const res = await callPrivilegedApi<{ message: string }>('/api/send-staff-invite-email', { inviteId: created.id, channels });
          setInviteDelivery(res.message);
          addNotification(`Invite for ${inviteForm.department}: ${res.message}`);
        } catch (sendErr: any) {
          setInviteDelivery(`The link was created but not sent: ${sendErr.message}`);
          addNotification(`Invite created, but sending failed: ${sendErr.message}`);
        }
      } else {
        setInviteDelivery('No email or phone was given, so nothing was sent. Copy the link below and share it yourself.');
        addNotification(`Invite link generated for ${inviteForm.department}.`);
      }
      loadData();
    } catch (err: any) {
      addNotification(`Failed to generate invite: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('staff_invites').update({ status: 'revoked' }).eq('id', id);
      setInvites(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      addNotification(`Failed to revoke invite: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const revokeDelegate = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('ceo_delegations').update({ active: false }).eq('id', id);
      setDelegates(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      addNotification(`Failed to revoke delegation: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const grantDelegate = async () => {
    if (!delegateForm.searchEmail || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('ceo_delegations').insert([{
        delegated_to_email: delegateForm.searchEmail,
        delegated_to_name: delegateForm.name || delegateForm.searchEmail,
        permissions: delegateForm.permissions,
        expires_at: delegateForm.expiresAt || null,
        active: true,
      }]);
      addNotification(`Control access granted to ${delegateForm.searchEmail}.`);
      setShowDelegateForm(false);
      setDelegateForm({ searchEmail: '', name: '', permissions: [], expiresAt: '' });
      loadData();
    } catch (err: any) {
      addNotification(`Failed to grant access: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Suspend / Reactivate / Block / Unblock go through the server
  // (api/set-user-status.ts), which checks the password, locks or unlocks
  // sign-in, ends open sessions and logs it. The database itself now
  // refuses a status change made straight from the browser.
  const changeStatus = (userId: string, name: string, action: StatusAction) => {
    if (submitting) return;
    setPasswordAction({ kind: 'status', userId, name, action });
  };

  const kickUser = async (userId: string, name: string) => {
    if (submitting) return;
    if (!await window.confirm(`Sign ${name} out of every device now? They can sign in again unless you also suspend or block them.`)) return;
    setSubmitting(true);
    try {
      const res = await callPrivilegedApi('/api/kick-user', { userId });
      kickUserOffline(userId);
      addNotification(res.message || `${name} has been signed out.`);
    } catch (err: any) {
      addNotification(`Could not sign ${name} out: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // High-risk actions (approved rule): the CEO types his password, checked
  // on the server. Errors are thrown back to PasswordConfirmModal, which
  // shows them and stays open so a wrong password can be retried.
  type StatusAction = 'suspend' | 'reactivate' | 'block' | 'unblock';
  type RemovalRequest = { id: string; target_id: string; target_name: string | null; requested_by: string; requested_by_name: string | null; reason: string | null; created_at: string };
  type PasswordAction =
    | { kind: 'terminate'; userId: string; name: string }
    | { kind: 'changeEmail'; newEmail: string }
    | { kind: 'coCeo'; fullName: string; email: string; phone: string }
    | { kind: 'status'; userId: string; name: string; action: StatusAction }
    | { kind: 'removeRequest'; targetId: string; name: string; reason: string }
    | { kind: 'removalDecision'; request: RemovalRequest; decision: 'approve' | 'reject' };
  const [passwordAction, setPasswordAction] = useState<PasswordAction | null>(null);

  // Removing a CEO needs two CEOs: one asks, a different one decides.
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const loadRemovalRequests = async () => {
    const { data } = await (supabase.from('ceo_removal_requests' as any) as any)
      .select('id, target_id, target_name, requested_by, requested_by_name, reason, created_at')
      .eq('status', 'pending').order('created_at', { ascending: false });
    setRemovalRequests((data as any) || []);
  };
  useEffect(() => { loadRemovalRequests(); }, []);

  const cancelRemoval = async (request: RemovalRequest) => {
    if (!await window.confirm(`Withdraw your request to remove ${request.target_name || 'this CEO'}?`)) return;
    try {
      const res = await callPrivilegedApi('/api/ceo-removal', { action: 'cancel', requestId: request.id });
      addNotification(res.message || 'Request cancelled.');
      loadRemovalRequests();
    } catch (err: any) {
      addNotification(`Could not cancel it: ${err.message}`);
    }
  };

  const STATUS_WORDING: Record<StatusAction, { title: string; verb: string; effect: string }> = {
    suspend: { title: 'Confirm Suspension', verb: 'Suspend', effect: 'They are signed out everywhere and cannot sign in until reactivated.' },
    reactivate: { title: 'Confirm Reactivation', verb: 'Reactivate', effect: 'They can sign in again.' },
    block: { title: 'Confirm Block', verb: 'Block', effect: 'They are signed out everywhere and cannot sign in until unblocked.' },
    unblock: { title: 'Confirm Unblock', verb: 'Unblock', effect: 'They can sign in again.' },
  };
  const passwordTitle = (a: PasswordAction | null): string => {
    if (!a) return '';
    switch (a.kind) {
      case 'terminate': return 'Confirm Termination';
      case 'changeEmail': return 'Confirm Email Change';
      case 'coCeo': return 'Confirm Co-CEO Invite';
      case 'status': return STATUS_WORDING[a.action].title;
      case 'removeRequest': return 'Confirm Removal Request';
      case 'removalDecision': return a.decision === 'approve' ? 'Confirm CEO Removal' : 'Confirm Rejection';
    }
  };
  const passwordDescription = (a: PasswordAction | null): string => {
    if (!a) return '';
    const tail = ' Type your password to confirm it is you.';
    switch (a.kind) {
      case 'terminate': return `Terminate ${a.name}? They can no longer sign in. Nothing is deleted: all their work stays in the system.${tail}`;
      case 'changeEmail': return `Change your sign-in email to ${a.newEmail}?${tail}`;
      case 'coCeo': return `Invite ${a.fullName} (${a.email}) as a co-CEO?${tail}`;
      case 'status': return `${STATUS_WORDING[a.action].verb} ${a.name}? ${STATUS_WORDING[a.action].effect}${tail}`;
      case 'removeRequest': return `Ask to remove ${a.name} as CEO? A different CEO must approve it.${tail}`;
      case 'removalDecision': return a.decision === 'approve'
        ? `Remove ${a.request.target_name || 'this CEO'} as CEO? Their sign-in is deleted and they lose all access.${tail}`
        : `Reject the request to remove ${a.request.target_name || 'this CEO'}? They stay CEO.${tail}`;
    }
  };
  const passwordConfirmLabel = (a: PasswordAction | null): string => {
    if (!a) return 'Confirm';
    switch (a.kind) {
      case 'terminate': return 'Terminate';
      case 'changeEmail': return 'Send confirmation link';
      case 'coCeo': return 'Send invite';
      case 'status': return STATUS_WORDING[a.action].verb;
      case 'removeRequest': return 'Send request';
      case 'removalDecision': return a.decision === 'approve' ? 'Remove CEO' : 'Reject';
    }
  };
  const isDangerAction = (a: PasswordAction | null): boolean => !!a && (
    a.kind === 'terminate'
    || a.kind === 'removeRequest'
    || (a.kind === 'removalDecision' && a.decision === 'approve')
    || (a.kind === 'status' && (a.action === 'suspend' || a.action === 'block'))
  );
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newCeoEmail, setNewCeoEmail] = useState('');
  const [coCeoOpen, setCoCeoOpen] = useState(false);
  const [coCeoForm, setCoCeoForm] = useState({ fullName: '', email: '', phone: '' });
  const [coCeoResult, setCoCeoResult] = useState<{ message: string; link: string } | null>(null);
  const [ceoInvites, setCeoInvites] = useState<{ id: string; full_name: string | null; email: string | null; expires_at: string }[]>([]);

  const loadCeoInvites = async () => {
    const { data } = await supabase.from('staff_invites').select('id, full_name, email, expires_at').eq('department', 'CEO').eq('status', 'pending').order('created_at', { ascending: false });
    setCeoInvites((data as any) || []);
  };
  useEffect(() => { loadCeoInvites(); }, []);

  const callApi = callPrivilegedApi;

  const runPasswordAction = async (password: string) => {
    const action = passwordAction;
    if (!action) return;
    if (action.kind === 'terminate') {
      const res = await callApi('/api/terminate-user', { userId: action.userId, password });
      setPasswordAction(null);
      addNotification(res.message || `User ${action.name} terminated.`);
      loadData();
    } else if (action.kind === 'changeEmail') {
      const res = await callApi('/api/ceo-change-email', { newEmail: action.newEmail, password });
      setPasswordAction(null);
      setChangeEmailOpen(false);
      setNewCeoEmail('');
      addNotification(res.message || 'A confirmation link was sent to the new address.');
    } else if (action.kind === 'coCeo') {
      const res = await callApi('/api/ceo-invite-co-ceo', { fullName: action.fullName, email: action.email, phone: action.phone, password });
      setPasswordAction(null);
      setCoCeoOpen(false);
      setCoCeoForm({ fullName: '', email: '', phone: '' });
      setCoCeoResult({ message: res.message || 'Invite sent.', link: res.link || '' });
      loadCeoInvites();
    } else if (action.kind === 'status') {
      const res = await callApi('/api/set-user-status', { userId: action.userId, action: action.action, password });
      setPasswordAction(null);
      // Suspend and Block also close any screen they still have open.
      if (action.action === 'suspend' || action.action === 'block') kickUserOffline(action.userId);
      addNotification(res.message || 'Status updated.');
      loadData();
    } else if (action.kind === 'removeRequest') {
      const res = await callApi('/api/ceo-removal', { action: 'request', targetId: action.targetId, reason: action.reason, password });
      setPasswordAction(null);
      setRemoveReason('');
      addNotification(res.message || 'Removal request sent. Another CEO must approve it.');
      loadRemovalRequests();
    } else {
      const res = await callApi('/api/ceo-removal', { action: action.decision, requestId: action.request.id, password });
      setPasswordAction(null);
      addNotification(res.message || 'Done.');
      loadRemovalRequests();
      loadData();
    }
  };

  // Terminate takes effect at once and deletes nothing: all their work
  // stays in the system (api/terminate-user.ts).
  const terminateUser = (userId: string, name: string) => {
    if (submitting) return;
    setPasswordAction({ kind: 'terminate', userId, name });
  };

  const resetUserPassword = async (userId: string, name: string) => {
    if (submitting) return;
    if (!await window.confirm(`Send a password reset email to ${name}?`)) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated.');
      const res = await fetch('/api/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to send reset email.');
      addNotification(body.message || `Password reset email sent to ${name}.`);
    } catch (err: any) {
      addNotification(`Failed to reset password: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {});
  };

  // Stable keys stored in ceo_delegations.permissions and checked by the
  // has_delegated_permission() SQL function — the display label can be
  // reworded freely without breaking existing grants, unlike storing the
  // label string itself.
  const PERMISSION_SECTIONS: { key: string; label: string }[] = [
    { key: 'access_control', label: 'Access Control' },
    { key: 'financial_controls', label: 'Financial Controls' },
    { key: 'operations_controls', label: 'Operations Controls' },
    { key: 'dispatch_controls', label: 'Dispatch Controls' },
    { key: 'data_controls', label: 'Data Controls' },
    { key: 'communication_controls', label: 'Communication Controls' },
    { key: 'system_controls', label: 'System Controls' },
    { key: 'approval_controls', label: 'Approval Controls' },
  ];
  const permissionLabel = (key: string) => PERMISSION_SECTIONS.find(s => s.key === key)?.label || key;

  // CEO accounts are never acted on from the staff list (no CEO acts on
  // himself or another CEO); they're shown under CEO Account instead.
  const ceoAccounts = staffList.filter((s: any) => s.is_admin);
  const filteredStaff = staffList.filter((s: any) => !s.is_admin).filter(s =>
    !staffSearch || s.full_name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      <style>{`
        @keyframes gradient-move {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-control-center {
          background: linear-gradient(270deg, var(--accent), #ef4444, #3b82f6, var(--accent));
          background-size: 400% 400%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient-move 6s ease infinite;
          display: inline-block;
          font-weight: 800;
        }
      `}</style>
      {/* Breadcrumb */}
      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
        <span>CEO Command</span>
        <span>/</span>
        <span className="animate-control-center">Control Center</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">CEO <span className="animate-control-center">Control Center</span></h2>
            <p className="text-xs text-[var(--text-muted)]">System-wide security and access management</p>
          </div>
        </div>
      </div>

      {/* ── DASHBOARD ───────────────────────────────────────────────────── */}

      {/* System Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl border shadow-[var(--box-shadow)] ${systemOnline ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">App Status</p>
          <p className={`text-lg font-extrabold mt-1 ${systemOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
            {systemOnline ? '● Online' : '● Offline'}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--box-shadow)]">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Staff</p>
          <p className="text-lg font-extrabold mt-1 text-[var(--text-primary)]">{staffList.length}</p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--box-shadow)]">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Active Delegates</p>
          <p className="text-lg font-extrabold mt-1 text-[var(--text-primary)]">{delegates.length}</p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--box-shadow)]">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Pending Invites</p>
          <p className="text-lg font-extrabold mt-1 text-[var(--text-primary)]">{invites.length}</p>
        </div>
      </div>

      {/* Alert Cards */}
      {pendingCounts.registrations > 0 && (
        <div className="flex items-center justify-between px-5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {pendingCounts.registrations} Pending Registration{pendingCounts.registrations !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">Awaiting CEO approval</span>
        </div>
      )}

      {/* Pending price change approvals live on the CEO's Approvals page
          (ApprovalsView.tsx, "price" tab) alongside every other approval
          type, not here, Control Center is settings/configuration, not an
          approvals inbox. */}

      {/* Recent Setting Changes — this is exactly what it shows: the last 10
          ceo_settings rows by updated_at. Not a security/auth event log
          (no login attempts, no session/IP data), so it isn't labeled as
          one. */}
      {settingChangesLog.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--box-shadow)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" /> Recent Setting Changes
            </h3>
            <button onClick={() => openExportPreview({
              title: 'Recent Setting Changes',
              data: settingChangesLog.map(r => ({ setting: r.setting_key, updated: r.updated_at ? new Date(r.updated_at).toLocaleString() : 'Not set' })),
              columns: [{ key: 'setting', label: 'Setting' }, { key: 'updated', label: 'Updated At' }],
            })} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="space-y-1.5">
            {settingChangesLog.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                <span className="font-mono text-[var(--accent)] font-semibold">{r.setting_key}</span>
                <span className="text-[var(--text-muted)]">{r.updated_at ? new Date(r.updated_at).toLocaleString() : 'Not set'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DOCUMENT TEMPLATES ──────────────────────────────────────────── */}
      {/* Company-wide branding on every receipt, dispatch ticket, and
          proforma invoice, a CEO-level setting, so it lives here rather
          than as its own top-level nav item. Collapsed by default since
          it's a full editor (form + live preview + map picker), not a
          quick toggle like the sections below. */}
      <Section title="Document Templates" icon={FileEdit} defaultOpen={false}>
        <DocumentTemplatesView addNotification={addNotification} currentUser={currentUser} hideHeader />
      </Section>

      {/* ── SECTION 1: ACCESS CONTROL ──────────────────────────────────── */}
      <Section title="CEO Account" icon={Crown}>
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Your sign-in email (the CEO email)</p>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5 select-all">{currentUser?.email || ''}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">To change it you type your password, then confirm from a link sent to the new address.</p>
            <button onClick={() => { setNewCeoEmail(''); setChangeEmailOpen(true); }}
              className="mt-2 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer">
              Change email
            </button>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-[var(--text-primary)]">CEOs</p>
              <button onClick={() => { setCoCeoForm({ fullName: '', email: '', phone: '' }); setCoCeoOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer" style={{ background: 'var(--accent)' }}>
                <Plus className="w-3.5 h-3.5" /> Add Co-CEO
              </button>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {ceoAccounts.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{c.full_name}{c.id === currentUser?.id ? ' (you)' : ''}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{c.email}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">{c.status}</span>
                  {c.id !== currentUser?.id && c.status === 'ACTIVE' && !removalRequests.some(r => r.target_id === c.id) && (
                    <button onClick={() => { setRemoveReason(''); setRemoveTarget({ id: c.id, name: c.full_name }); }} title="Request removal"
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500 cursor-pointer">
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {ceoInvites.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{inv.full_name || inv.email}</p>
                    <p className="text-xs text-[var(--text-muted)]">Invited, not registered yet. Link expires {new Date(inv.expires_at).toLocaleDateString()}.</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">INVITED</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">A co-CEO registers in the app with the link they receive, then you approve them in Approvals (with your password). Until then they have no access.</p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border)]">
            <p className="text-sm font-bold text-[var(--text-primary)]">CEO removal requests</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-2">Removing a CEO needs two CEOs. One asks, and a different CEO approves or rejects it. Every step is logged by name.</p>
            {removalRequests.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No requests waiting.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {removalRequests.map(r => {
                  const mine = r.requested_by === currentUser?.id;
                  return (
                    <div key={r.id} className="py-2 space-y-1.5">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Remove {r.target_name || 'a CEO'}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Asked by {mine ? 'you' : (r.requested_by_name || 'another CEO')} on {new Date(r.created_at).toLocaleDateString()}.{r.reason ? ` Reason: ${r.reason}` : ''}
                      </p>
                      <div className="flex gap-2">
                        {mine ? (
                          <button onClick={() => cancelRemoval(r)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer">Withdraw</button>
                        ) : (
                          <>
                            <button onClick={() => setPasswordAction({ kind: 'removalDecision', request: r, decision: 'approve' })} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 cursor-pointer">Approve</button>
                            <button onClick={() => setPasswordAction({ kind: 'removalDecision', request: r, decision: 'reject' })} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer">Reject</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Section>

      <SidePanel open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Request CEO Removal"
        footer={<button onClick={() => {
          const target = removeTarget;
          if (!target) return;
          setRemoveTarget(null);
          setPasswordAction({ kind: 'removeRequest', targetId: target.id, name: target.name, reason: removeReason.trim() });
        }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 cursor-pointer">Continue</button>}>
        <p className="text-sm text-[var(--text-secondary)] mb-3">{removeTarget?.name} stays CEO until a different CEO approves this request.</p>
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Reason (optional)</label>
        <textarea value={removeReason} onChange={e => setRemoveReason(e.target.value)} rows={3} placeholder="e.g. Left the company"
          className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
        <p className="text-xs text-[var(--text-muted)] mt-2">Shown to the CEO who decides, and kept in the log.</p>
      </SidePanel>

      <SidePanel open={changeEmailOpen} onClose={() => setChangeEmailOpen(false)} title="Change CEO Email"
        footer={<button onClick={() => {
          const v = newCeoEmail.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { addNotification('Enter a valid new email address.'); return; }
          setChangeEmailOpen(false);
          setPasswordAction({ kind: 'changeEmail', newEmail: v });
        }} className="erp-btn erp-btn-primary w-full">Continue</button>}>
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">New email</label>
        <input type="email" value={newCeoEmail} onChange={e => setNewCeoEmail(e.target.value)} placeholder="e.g. ceo@yourcompany.com"
          className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
        <p className="text-xs text-[var(--text-muted)] mt-2">A confirmation link goes to this address. Nothing changes until it is opened.</p>
      </SidePanel>

      <SidePanel open={coCeoOpen} onClose={() => setCoCeoOpen(false)} title="Add Co-CEO"
        footer={<button onClick={() => {
          const email = coCeoForm.email.trim().toLowerCase();
          if (!coCeoForm.fullName.trim()) { addNotification('Enter their full name.'); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { addNotification('Enter a valid email address.'); return; }
          setCoCeoOpen(false);
          setPasswordAction({ kind: 'coCeo', fullName: coCeoForm.fullName.trim(), email, phone: coCeoForm.phone.trim() });
        }} className="erp-btn erp-btn-primary w-full">Continue</button>}>
        <div className="space-y-3">
          {[
            { key: 'fullName', label: 'Full name', type: 'text', placeholder: 'e.g. Ama Mensah' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'e.g. ama@yourcompany.com' },
            { key: 'phone', label: 'Phone (optional, the invite also goes by SMS)', type: 'tel', placeholder: 'e.g. 0244123456' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">{f.label}</label>
              <input type={f.type} value={(coCeoForm as any)[f.key]} onChange={e => setCoCeoForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
            </div>
          ))}
        </div>
      </SidePanel>

      <SidePanel open={!!coCeoResult} onClose={() => setCoCeoResult(null)} title="Co-CEO Invited"
        footer={<button onClick={() => setCoCeoResult(null)} className="erp-btn erp-btn-ghost w-full">Done</button>}>
        {coCeoResult && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">{coCeoResult.message}</p>
            {coCeoResult.link && (
              <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-primary)] break-all select-all">{coCeoResult.link}</p>
                <button onClick={() => { navigator.clipboard.writeText(coCeoResult.link); addNotification('Link copied'); }}
                  className="shrink-0 px-2.5 py-1.5 text-[10px] font-semibold bg-[var(--accent-light)] text-[var(--accent)] rounded-lg cursor-pointer hover:opacity-90">Copy</button>
              </div>
            )}
          </div>
        )}
      </SidePanel>


      <Section title="Section 1, Access Control" icon={Shield}>
        {getSchemaSection('access')!.fields.slice(0, 5).map(f => <SettingField key={f.key} field={f} />)}

        {/* Invite Staff (visible when invitation_only = true) */}
        {invitationOnly && (
          <div className="mt-4 p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[var(--accent)]" /> Invite Staff
              </h4>
              <button onClick={() => setShowInviteForm(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Generate Invite
              </button>
            </div>

            {showInviteForm && (
              <div className="space-y-3 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Staff Name</label>
                    <input value={inviteForm.fullName} onChange={e => setInviteForm(p => ({ ...p, fullName: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Email (the link is sent here)</label>
                    <input type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Phone (the link is texted here)</label>
                    <input type="tel" value={inviteForm.phone} onChange={e => setInviteForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      placeholder="e.g. 024 123 4567" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Department</label>
                    <SearchableDropdown
                      value={inviteForm.department}
                      onChange={v => setInviteForm(p => ({ ...p, department: v }))}
                      options={[...['MARKETING','FINANCE','HR','PRODUCTION','RECEPTION','MANAGEMENT','RISK'].map(d => ({ value: d, label: d })), { value: 'admin_warehouse', label: 'ADMIN & WAREHOUSE' }]}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Role</label>
                    <SearchableDropdown
                      value={inviteForm.role}
                      onChange={v => setInviteForm(p => ({ ...p, role: v }))}
                      options={['staff','supervisor','manager'].map(r => ({ value: r, label: r }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Link Expiry</label>
                    <SearchableDropdown
                      value={inviteForm.expiry}
                      onChange={v => setInviteForm(p => ({ ...p, expiry: v }))}
                      options={[{ value: '24h', label: '24 hours' }, { value: '48h', label: '48 hours' }, { value: '7d', label: '7 days' }]}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Auto-approve on register</span>
                    <button onClick={() => setInviteForm(p => ({ ...p, autoApprove: !p.autoApprove }))} className="cursor-pointer">
                      {inviteForm.autoApprove
                        ? <ToggleRight className="w-7 h-7 text-[var(--accent)]" />
                        : <ToggleLeft className="w-7 h-7 text-[var(--text-muted)]" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {inviteForm.autoApprove
                    ? 'Staff will be automatically approved on registration without HR review.'
                    : 'Staff will require HR review after registering.'}
                </p>
                <button onClick={generateInviteLink} disabled={submitting} className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer disabled:opacity-50">{submitting ? 'Sending…' : 'Generate and Send Link'}</button>

                {generatedLink && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">Invite Link Generated:</p>
                    {inviteDelivery && <p className="text-[11px] text-[var(--text-secondary)]">{inviteDelivery}</p>}
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono text-[var(--text-muted)] break-all flex-1">{generatedLink}</code>
                      <button onClick={copyLink} className="shrink-0 p-1.5 bg-[var(--accent)] text-white rounded-lg cursor-pointer hover:opacity-90">
                        {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pending Invites Table */}
            {invites.length > 0 && (
              <ResponsiveDataView<typeof invites[number]>
                columns={[
                  { key: 'full_name', label: 'Name', primary: true, render: inv => inv.full_name || 'Not set' },
                  { key: 'email', label: 'Email', render: inv => inv.email || 'Not set' },
                  { key: 'department', label: 'Dept' },
                  { key: 'expires_at', label: 'Expiry', render: inv => <span className="font-mono">{new Date(inv.expires_at).toLocaleDateString()}</span> },
                  {
                    key: 'status', label: 'Status', status: true, render: inv => (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {inv.status.toUpperCase()}
                      </span>
                    )
                  },
                ]}
                data={invites}
                rowKey={inv => inv.id}
                renderActions={inv => (
                  <button onClick={() => revokeInvite(inv.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              />
            )}
          </div>
        )}

        {getSchemaSection('access')!.fields.slice(5).map(f => <SettingField key={f.key} field={f} />)}

        {/* User Management */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent)]" /> User Management
            </h4>
            <button onClick={() => setShowUserModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer border border-[var(--border)]">
              <Eye className="w-3.5 h-3.5" /> Manage Users
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">View all users across all departments. Suspend, block, reactivate or sign someone out. Each change asks for your password.</p>
        </div>

        {/* Delegate Control */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Key className="w-4 h-4 text-[var(--accent)]" /> Delegate Control Access
            </h4>
            <button onClick={() => setShowDelegateForm(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] text-[var(--accent)] text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer border border-[var(--border)]">
              <Plus className="w-3.5 h-3.5" /> Add Delegate
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Grant specific users access to manage settings on your behalf. You can revoke at any time.</p>

          {showDelegateForm && (
            <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={delegateForm.searchEmail} onChange={e => setDelegateForm(p => ({ ...p, searchEmail: e.target.value }))}
                  placeholder="User email" className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                <input value={delegateForm.name} onChange={e => setDelegateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Display name" className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                <input type="date" value={delegateForm.expiresAt} onChange={e => setDelegateForm(p => ({ ...p, expiresAt: e.target.value }))}
                  className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Permissions to Grant</p>
                <div className="grid grid-cols-2 gap-1">
                  {PERMISSION_SECTIONS.map(sec => (
                    <label key={sec.key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={delegateForm.permissions.includes(sec.key)}
                        onChange={e => setDelegateForm(p => ({
                          ...p,
                          permissions: e.target.checked ? [...p.permissions, sec.key] : p.permissions.filter(x => x !== sec.key)
                        }))}
                        className="accent-[var(--accent)] w-3.5 h-3.5" />
                      <span className="text-xs text-[var(--text-primary)]">{sec.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={grantDelegate} className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer">Grant Access</button>
            </div>
          )}

          {delegates.length > 0 && (
            <ResponsiveDataView<typeof delegates[number]>
              columns={[
                { key: 'delegated_to_name', label: 'Name', primary: true },
                { key: 'delegated_to_email', label: 'Email' },
                { key: 'permissions', label: 'Permissions', render: d => `${(d.permissions || []).slice(0, 2).map(permissionLabel).join(', ')}${d.permissions?.length > 2 ? '…' : ''}` },
                { key: 'expires_at', label: 'Expires', render: d => <span className="font-mono">{d.expires_at ? new Date(d.expires_at).toLocaleDateString() : 'No expiry'}</span> },
              ]}
              data={delegates}
              rowKey={d => d.id}
              renderActions={d => (
                <button onClick={() => revokeDelegate(d.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            />
          )}
        </div>
      </Section>

      {/* ── SECTION 2: FINANCIAL CONTROLS ─────────────────────────────── */}
      <Section title="Section 2, Financial Controls" icon={DollarSign}>
        {getSchemaSection('financial')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 3: OPERATIONS CONTROLS ───────────────────────────── */}
      <Section title="Section 3, Operations Controls" icon={Package}>
        {getSchemaSection('operations')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 4: DISPATCH CONTROLS ──────────────────────────────── */}
      <Section title="Section 4, Dispatch Controls" icon={Truck}>
        {getSchemaSection('dispatch')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 5: DATA CONTROLS ──────────────────────────────────── */}
      <Section title="Section 5, Data Controls" icon={Database}>
        {getSchemaSection('data')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 6: COMMUNICATION CONTROLS ────────────────────────── */}
      <Section title="Section 6, Communication Controls" icon={MessageCircle}>
        {getSchemaSection('communication')!.fields.slice(0, 7).map(f => <SettingField key={f.key} field={f} />)}
        <MessageExportSection currentUser={currentUser} addNotification={addNotification} />
        {getSchemaSection('communication')!.fields.slice(7).map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 7: SYSTEM CONTROLS ───────────────────────────────── */}
      <Section title="Section 7, System Controls" icon={Settings}>
        {getSchemaSection('system')!.fields.map(f => <SettingField key={f.key} field={f} />)}

        {/* Pending department approvals */}
        {dbDepartments.some(d => d.status === 'pending') && (
          <div className="mt-6 border-t border-[var(--border)] pt-6">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Pending Department Approvals</h4>
            <div className="space-y-2">
              {dbDepartments.filter(d => d.status === 'pending').map(dept => (
                <div key={dept.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{dept.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decideDepartment(dept.id, true)}
                      disabled={decidingDeptId === dept.id}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decideDepartment(dept.id, false)}
                      disabled={decidingDeptId === dept.id}
                      className="px-2.5 py-1.5 bg-[var(--bg-input)] hover:bg-rose-100 text-rose-500 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Department Name Management */}
        <div className="mt-6 border-t border-[var(--border)] pt-6">
          <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Department Settings</h4>
          <p className="text-xs text-[var(--text-muted)] mb-4">Rename configured system departments. This updates dashboard headers and rosters.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dbDepartments.filter(d => d.status !== 'pending').map(dept => (
              <div key={dept.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                {editingDeptId === dept.id ? (
                  <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                    <input placeholder="Department name"
                      type="text"
                      value={editingDeptName}
                      onChange={e => setEditingDeptName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameDept(dept.id, dept.name, editingDeptName)}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDeptId(null)}
                      className="px-2.5 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{dept.name}</span>
                    <button
                      onClick={() => { setEditingDeptId(dept.id); setEditingDeptName(dept.name); }}
                      className="text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer"
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── SECTION 8: APPROVAL CONTROLS ─────────────────────────────── */}
      <Section title="Section 8, Approval Controls" icon={CheckSquare}>
        {getSchemaSection('approval')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 9: SPREADSHEETS CONTROL ──────────────────────────── */}
      <Section title="Section 9, Spreadsheets Control" icon={FileSpreadsheet}>
        {getSchemaSection('spreadsheets')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      {/* ── SECTION 10: RISK CONTROLS ────────────────────────────────────
          Risk had no toggles of its own at all before this, every other
          department does. What's genuinely safe to offer here, and what
          isn't: Risk's core approval gates (Cargo Intake, Sales Order,
          Proof of Delivery review) are enforced by a database trigger,
          not the UI, a toggle claiming to turn those off would either do
          nothing or need the trigger itself rewritten, so they are
          deliberately NOT here. ceo_cosign_credit_threshold,
          ceo_cosign_order_threshold (Section 8), and
          discrepancy_auto_alert_ceo (Section 3) already give CEO control
          over Risk-adjacent behavior and are not duplicated here. */}
      <Section title="Section 10, Risk Controls" icon={AlertTriangle}>
        {getSchemaSection('risk')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      <Section title="Section 11, Birthday Wishes" icon={Cake} defaultOpen={false}>
        {getSchemaSection('birthdays')!.fields.map(f => <SettingField key={f.key} field={f} />)}
      </Section>

      <Section title="API Keys" icon={Key} defaultOpen={false}>
        <ApiKeysSection addNotification={addNotification} />
      </Section>

      {/* ── SECTION 11: DATA RESET CENTER ────────────────────────────── */}
      <Section title="Section 10, Data Reset Center" icon={Trash2} defaultOpen={false}>
        <DataResetSection addNotification={addNotification} />
      </Section>

      {/* ── USER MANAGEMENT MODAL ───────────────────────────────────────── */}
      <SidePanel
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="User Management"
        subtitle="All staff directory"
        width="lg"
      >
        <div className="flex flex-col h-full -mx-5 -my-4">
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                <Search className="w-4 h-4 text-[var(--text-muted)]" />
                <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-muted)]" />
              </div>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <ResponsiveDataView<typeof filteredStaff[number]>
                columns={[
                  { key: 'full_name', label: 'Name', primary: true, render: s => s.full_name || 'Not set' },
                  { key: 'email', label: 'Email', render: s => s.email || 'Not set' },
                  { key: 'department', label: 'Department', render: s => s.department || s.role || 'Not set' },
                  { key: 'role', label: 'Role', render: s => s.role || 'Not set' },
                  {
                    key: 'status', label: 'Status', status: true, render: s => (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' :
                        s.status === 'SUSPENDED' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-rose-500/10 text-rose-500'
                      }`}>{s.status || 'ACTIVE'}</span>
                    )
                  },
                ]}
                data={filteredStaff}
                rowKey={s => s.id}
                emptyTitle="No staff found"
                renderActions={s => (
                  <>
                    {s.status === 'ACTIVE' && (
                      <button onClick={() => changeStatus(s.id, s.full_name, 'suspend')} title="Suspend" className="p-1.5 hover:bg-amber-500/10 rounded-lg text-amber-500 cursor-pointer">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {s.status === 'SUSPENDED' && (
                      <button onClick={() => changeStatus(s.id, s.full_name, 'reactivate')} title="Reactivate" className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500 cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(s.status === 'ACTIVE' || s.status === 'SUSPENDED') && (
                      <button onClick={() => changeStatus(s.id, s.full_name, 'block')} title="Block" className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500 cursor-pointer">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {s.status === 'BLOCKED' && (
                      <button onClick={() => changeStatus(s.id, s.full_name, 'unblock')} title="Unblock" className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500 cursor-pointer">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {s.status === 'ACTIVE' && (
                      <button onClick={() => kickUser(s.id, s.full_name)} title="Kick offline" className="p-1.5 hover:bg-[var(--bg)] rounded-lg text-[var(--text-muted)] cursor-pointer">
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {s.status !== 'TERMINATED' && (
                      <>
                        <button onClick={() => resetUserPassword(s.id, s.full_name)} title="Reset Password" className="p-1.5 hover:bg-[var(--accent-light)] rounded-lg text-[var(--accent)] cursor-pointer">
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => terminateUser(s.id, s.full_name)} title="Terminate" className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500 cursor-pointer">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
              />
            </div>
        </div>
      </SidePanel>

      {/* Last in the page so it opens on top of User Management and every
          other panel (they all share one layer, so page order decides). */}
      <PasswordConfirmModal
        open={!!passwordAction}
        onClose={() => setPasswordAction(null)}
        title={passwordTitle(passwordAction)}
        description={passwordDescription(passwordAction)}
        confirmLabel={passwordConfirmLabel(passwordAction)}
        danger={isDangerAction(passwordAction)}
        onConfirm={runPasswordAction}
      />
    </div>
  );
}
