// rebma-web/src/views/ceo/CeoControlCenter.tsx
import { useState, useEffect } from 'react';
import {
  Shield, ChevronDown, ChevronUp, Users, DollarSign, Activity, Truck,
  Database, MessageCircle, Settings, CheckSquare, AlertTriangle, Bell,
  UserPlus, Copy, Check, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff,
  Clock, Lock, Globe, Mail, Phone, Building2, RefreshCw, X, Plus, Search,
  FileSpreadsheet, Package, ShoppingCart, Camera, Ban, UserX, Key
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';

interface Props {
  currentUser: { id?: string; fullName: string; department: string; isCeo?: boolean } | null;
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
    if (warning && !next) { setPendingValue(next); setShowWarn(true); return; }
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
      {showWarn && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-amber-400 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">Warning</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{warning}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowWarn(false)} className="px-4 py-2 text-xs font-bold bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] hover:bg-[var(--accent-light)] cursor-pointer">Cancel</button>
              <button onClick={() => { setShowWarn(false); if (pendingValue !== null) { updateSetting(settingKey, pendingValue); setPendingValue(null); } }} className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 cursor-pointer">Confirm</button>
            </div>
          </div>
        </div>
      )}
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
              <select
                value={newAllowed ? 'allow' : 'block'}
                onChange={e => setNewAllowed(e.target.value === 'allow')}
                className="px-2 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer">
                <option value="block">Block this user</option>
                <option value="allow">Allow this user</option>
              </select>
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
        <input
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
      <select
        value={value}
        onChange={e => updateSetting(settingKey, e.target.value)}
        className="shrink-0 px-3 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
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
const DEPT_TABLES: Record<string, { label: string; tables: { name: string }[] }> = {
  MARKETING:   { label: 'Marketing',   tables: [{ name: 'orders' }, { name: 'customers' }] },
  FINANCE:     { label: 'Finance',     tables: [{ name: 'finance_payments' }, { name: 'finance_expenses' }, { name: 'finance_cheques' }, { name: 'finance_petty_cash' }, { name: 'recurring_payments' }] },
  OPERATIONS:  { label: 'Operations',  tables: [{ name: 'cargo_intake' }, { name: 'stock_ledger' }, { name: 'general_purchases' }, { name: 'stock' }, { name: 'wip_stock' }] },
  PRODUCTION:  { label: 'Production',  tables: [{ name: 'production_logs' }, { name: 'production_requests' }] },
  MANAGEMENT:  { label: 'Management',  tables: [{ name: 'goods_prices' }, { name: 'supplier_orders' }, { name: 'suppliers' }, { name: 'global_audit_history' }] },
  HR:          { label: 'HR',          tables: [{ name: 'payroll_batches' }, { name: 'payroll_entries' }, { name: 'payroll_items' }, { name: 'leave_requests' }, { name: 'attendance' }] },
  DISPATCH:    { label: 'Dispatch',    tables: [{ name: 'delivery_logs' }, { name: 'drivers' }] },
  RECEPTION:   { label: 'Reception',   tables: [{ name: 'visitors' }] },
  LOGISTICS:   { label: 'Logistics',   tables: [] },
  ALL:         { label: 'ALL Departments', tables: [
    { name: 'orders' }, { name: 'customers' },
    { name: 'finance_payments' }, { name: 'finance_expenses' }, { name: 'finance_cheques' }, { name: 'finance_petty_cash' }, { name: 'recurring_payments' },
    { name: 'cargo_intake' }, { name: 'stock_ledger' }, { name: 'general_purchases' }, { name: 'stock' }, { name: 'wip_stock' },
    { name: 'production_logs' }, { name: 'production_requests' },
    { name: 'goods_prices' }, { name: 'supplier_orders' }, { name: 'suppliers' },
    { name: 'payroll_batches' }, { name: 'payroll_entries' }, { name: 'payroll_items' }, { name: 'leave_requests' }, { name: 'attendance' },
    { name: 'delivery_logs' }, { name: 'drivers' },
    { name: 'visitors' },
    { name: 'global_audit_history' }, { name: 'supplier_order_notifications' },
  ]},
};

function DataResetSection({ addNotification }: { addNotification: (m: string) => void }) {
  const [selectedDept, setSelectedDept] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [confirmText, setConfirmText]   = useState('');
  const [running, setRunning]           = useState(false);
  const [results, setResults]           = useState<{ table: string; deleted: number; error?: string }[]>([]);
  const [done, setDone]                 = useState(false);

  const open = (dept: string) => {
    setSelectedDept(dept);
    setConfirmText('');
    setResults([]);
    setDone(false);
    setShowModal(true);
  };

  const close = () => { if (running) return; setShowModal(false); };

  const run = async () => {
    if (confirmText !== 'CONFIRM DELETE') return;
    const cfg = DEPT_TABLES[selectedDept];
    if (!cfg) return;
    setRunning(true);
    setResults([]);
    const res: typeof results = [];
    for (const t of cfg.tables) {
      try {
        // .not('id','is',null) matches every row regardless of id column type (int or uuid)
        const { error, count } = await (supabase.from(t.name as any).delete() as any).not('id', 'is', null);
        res.push({ table: t.name, deleted: count ?? 0, error: error?.message });
      } catch (e: any) {
        res.push({ table: t.name, deleted: 0, error: e?.message || 'Unknown error' });
      }
    }
    // Log to audit history (best-effort)
    supabase.from('global_audit_history').insert([{
      action: 'DATA_RESET',
      department: selectedDept,
      performed_by: 'CEO',
      details: `Cleared: ${cfg.tables.map(t => t.name).join(', ')}`,
      timestamp: new Date().toISOString(),
    }]).then(() => {}, () => {});

    setResults(res);
    setRunning(false);
    setDone(true);
    addNotification(`Data reset complete for ${cfg.label}.`);
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
                  <p className="text-[10px] text-[var(--text-muted)]">{cfg.tables.map(t => t.name).join(', ')}</p>
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
        const ready = confirmText === 'CONFIRM DELETE';
        return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-[var(--bg-card)] rounded-2xl border border-rose-400 shadow-2xl max-w-lg w-full flex flex-col max-h-[85vh]">
              {/* Header — always visible */}
              <div className="flex items-center gap-3 p-6 pb-4 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[var(--text-primary)]">
                    {done ? 'Reset Complete' : `Clear ${cfg.label} Data`}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {done ? 'Review results below.' : 'This action is irreversible.'}
                  </p>
                </div>
                <button onClick={close} className="ml-auto p-1.5 hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 space-y-4">
                {!done ? (
                  <>
                    {/* What will be deleted */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Tables that will be cleared:</p>
                      {cfg.tables.map(t => (
                        <div key={t.name} className="flex items-center gap-2 text-xs text-rose-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          <span className="font-mono">{t.name}</span>
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
                  </>
                ) : (
                  <div className="space-y-2">
                    {results.map(r => (
                      <div key={r.table} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold ${r.error ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                        <span className={`font-mono ${r.error ? 'text-rose-600' : 'text-emerald-700'}`}>{r.table}</span>
                        <span className={r.error ? 'text-rose-500' : 'text-emerald-600'}>
                          {r.error ? `Error: ${r.error}` : `✓ Cleared`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer buttons — always visible at bottom */}
              <div className="p-6 pt-4 shrink-0">
                {!done ? (
                  <div className="flex gap-3">
                    <button onClick={close} disabled={running}
                      className="flex-1 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-light)] cursor-pointer disabled:opacity-40">
                      Cancel
                    </button>
                    <button onClick={run} disabled={!ready || running}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: ready ? '#ef4444' : '#fca5a5' }}>
                      {running ? 'Deleting…' : `Delete ${cfg.label} Data`}
                    </button>
                  </div>
                ) : (
                  <button onClick={close}
                    className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold cursor-pointer hover:opacity-90">
                    Done — Start Fresh Workflow
                  </button>
                )}
              </div>
            </div>
          </div>
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
    registrations: 0, prices: 0, departments: 0, payroll: 0, cosigns: 0,
  });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [invites, setInvites] = useState<any[]>([]);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [securityLog, setSecurityLog] = useState<any[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    fullName: '', email: '', department: 'MARKETING', role: 'staff',
    expiry: '24h', autoApprove: false,
  });
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [delegateForm, setDelegateForm] = useState({
    searchEmail: '', name: '', permissions: [] as string[], expiresAt: '',
  });

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
    supabase.from('profiles').select('id, full_name, email, role, status, department, created_at').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setStaffList(data); }, () => {});

    // Security log (last 10 ceo_settings changes)
    supabase.from('ceo_settings').select('setting_key, description, updated_at').order('updated_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setSecurityLog(data); }, () => {});
  };

  const generateInviteLink = async () => {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiryHours: Record<string, number> = { '24h': 24, '48h': 48, '7d': 168 };
    const hours = expiryHours[inviteForm.expiry] ?? 24;
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();

    supabase.from('staff_invites').insert([{
      token,
      email: inviteForm.email || null,
      full_name: inviteForm.fullName || null,
      department: inviteForm.department,
      role: inviteForm.role,
      auto_approve: inviteForm.autoApprove,
      expires_at: expiresAt,
      status: 'pending',
    }]).then(() => {
      const link = `${window.location.origin}/register?token=${token}`;
      setGeneratedLink(link);
      addNotification(`Invite link generated for ${inviteForm.department}.`);
      loadData();
    }, () => {});
  };

  const revokeInvite = (id: string) => {
    supabase.from('staff_invites').update({ status: 'revoked' }).eq('id', id).then(() => {
      setInvites(prev => prev.filter(i => i.id !== id));
    }, () => {});
  };

  const revokeDelegate = (id: string) => {
    supabase.from('ceo_delegations').update({ active: false }).eq('id', id).then(() => {
      setDelegates(prev => prev.filter(d => d.id !== id));
    }, () => {});
  };

  const grantDelegate = async () => {
    if (!delegateForm.searchEmail) return;
    supabase.from('ceo_delegations').insert([{
      delegated_to_email: delegateForm.searchEmail,
      delegated_to_name: delegateForm.name || delegateForm.searchEmail,
      permissions: delegateForm.permissions,
      expires_at: delegateForm.expiresAt || null,
      active: true,
    }]).then(() => {
      addNotification(`Control access granted to ${delegateForm.searchEmail}.`);
      setShowDelegateForm(false);
      setDelegateForm({ searchEmail: '', name: '', permissions: [], expiresAt: '' });
      loadData();
    }, () => {});
  };

  const suspendUser = (userId: string, name: string) => {
    supabase.from('profiles').update({ status: 'SUSPENDED' }).eq('id', userId).then(() => {
      addNotification(`User ${name} suspended.`);
      loadData();
    }, () => {});
  };

  const reactivateUser = (userId: string, name: string) => {
    supabase.from('profiles').update({ status: 'ACTIVE' }).eq('id', userId).then(() => {
      addNotification(`User ${name} reactivated.`);
      loadData();
    }, () => {});
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {});
  };

  const PERMISSION_SECTIONS = [
    'Access Control', 'Financial Controls', 'Operations Controls',
    'Dispatch Controls', 'Data Controls', 'Communication Controls',
    'System Controls', 'Approval Controls',
  ];

  const filteredStaff = staffList.filter(s =>
    !staffSearch || s.full_name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
        <span>CEO Command</span>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-semibold">Control Center</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">CEO Control Center</h2>
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

      {/* Recent Security Log */}
      {securityLog.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--box-shadow)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" /> Recent Security Log
            </h3>
            <button onClick={() => {
              const rows = securityLog.map(r => `${r.setting_key},${r.updated_at}`).join('\n');
              const blob = new Blob([`Setting,Updated At\n${rows}`], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'security_log.csv'; a.click();
            }} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="space-y-1.5">
            {securityLog.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                <span className="font-mono text-[var(--accent)] font-semibold">{r.setting_key}</span>
                <span className="text-[var(--text-muted)]">{r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 1: ACCESS CONTROL ──────────────────────────────────── */}
      <Section title="Section 1 — Access Control" icon={Shield}>
        <SettingToggle
          settingKey="app_master_switch"
          label="App Access (Master Switch)"
          description="Master switch for entire app. When turned OFF all users except CEO will see a maintenance page and cannot access any features."
          warning="⚠️ This will immediately lock out all users and shut down app access. Only you can turn it back on. Are you sure?"
        />
        <SettingToggle
          settingKey="registrations_allowed"
          label="Allow New Registrations"
          description="When OFF the registration page shows 'Registration is currently closed' and no new accounts can be created."
        />
        <SettingToggle
          settingKey="invitation_only"
          label="Invitation Only"
          description="When ON only staff who receive a CEO-generated invite link can register. The public registration form is disabled."
        />

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
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Email (optional)</label>
                    <input type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Department</label>
                    <select value={inviteForm.department} onChange={e => setInviteForm(p => ({ ...p, department: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                      {['MARKETING','FINANCE','OPERATIONS','DISPATCH','HR','PRODUCTION','RECEPTION','MANAGEMENT','LOGISTICS'].map(d =>
                        <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Role</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                      {['staff','supervisor','manager'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Link Expiry</label>
                    <select value={inviteForm.expiry} onChange={e => setInviteForm(p => ({ ...p, expiry: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer">
                      <option value="24h">24 hours</option>
                      <option value="48h">48 hours</option>
                      <option value="7d">7 days</option>
                    </select>
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
                <button onClick={generateInviteLink} className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer">Generate Link</button>

                {generatedLink && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">Invite Link Generated:</p>
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                      <th className="py-2 px-2 text-left font-semibold">Name</th>
                      <th className="py-2 px-2 text-left font-semibold">Email</th>
                      <th className="py-2 px-2 text-left font-semibold">Dept</th>
                      <th className="py-2 px-2 text-left font-semibold">Expiry</th>
                      <th className="py-2 px-2 text-left font-semibold">Status</th>
                      <th className="py-2 px-2 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map(inv => (
                      <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                        <td className="py-2 px-2 text-[var(--text-primary)] font-semibold">{inv.full_name || '—'}</td>
                        <td className="py-2 px-2 text-[var(--text-muted)]">{inv.email || '—'}</td>
                        <td className="py-2 px-2 text-[var(--text-muted)]">{inv.department}</td>
                        <td className="py-2 px-2 text-[var(--text-muted)] font-mono">{new Date(inv.expires_at).toLocaleDateString()}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${inv.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button onClick={() => revokeInvite(inv.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500 cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <SettingToggle
          settingKey="hr_can_approve_registrations"
          label="HR Can Approve Registrations"
          description="When OFF HR cannot approve new staff registrations. All approvals require CEO sign-off."
        />
        <SettingToggle
          settingKey="management_can_approve_registrations"
          label="Management Can Approve Registrations"
          description="Allow Management to approve staff registrations independently."
        />
        <SettingToggle
          settingKey="ceo_must_approve_registrations"
          label="CEO Must Approve Registrations"
          description="All new staff registrations go directly to CEO first before HR review. Highest level of staff access control."
        />

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
          <p className="text-xs text-[var(--text-muted)]">View all users across all departments. Suspend or reactivate access instantly.</p>
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
                    <label key={sec} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={delegateForm.permissions.includes(sec)}
                        onChange={e => setDelegateForm(p => ({
                          ...p,
                          permissions: e.target.checked ? [...p.permissions, sec] : p.permissions.filter(x => x !== sec)
                        }))}
                        className="accent-[var(--accent)] w-3.5 h-3.5" />
                      <span className="text-xs text-[var(--text-primary)]">{sec}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={grantDelegate} className="px-4 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-xl hover:opacity-90 cursor-pointer">Grant Access</button>
            </div>
          )}

          {delegates.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="py-2 px-2 text-left font-semibold">Name</th>
                    <th className="py-2 px-2 text-left font-semibold">Email</th>
                    <th className="py-2 px-2 text-left font-semibold">Permissions</th>
                    <th className="py-2 px-2 text-left font-semibold">Expires</th>
                    <th className="py-2 px-2 text-center font-semibold">Revoke</th>
                  </tr>
                </thead>
                <tbody>
                  {delegates.map(d => (
                    <tr key={d.id} className="border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors">
                      <td className="py-2 px-2 font-semibold text-[var(--text-primary)]">{d.delegated_to_name}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{d.delegated_to_email}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)]">{(d.permissions || []).slice(0, 2).join(', ')}{d.permissions?.length > 2 ? '…' : ''}</td>
                      <td className="py-2 px-2 text-[var(--text-muted)] font-mono">{d.expires_at ? new Date(d.expires_at).toLocaleDateString() : 'No expiry'}</td>
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => revokeDelegate(d.id)} className="p-1 hover:bg-rose-500/10 rounded text-rose-500 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* ── SECTION 2: FINANCIAL CONTROLS ─────────────────────────────── */}
      <Section title="Section 2 — Financial Controls" icon={DollarSign}>
        <SettingToggle settingKey="credit_sales_enabled" label="Credit Sales Enabled"
          description="Allow credit payment type for customer orders. When OFF Marketing cannot select Credit as payment mode." />
        <SettingNumber settingKey="max_credit_amount" label="Maximum Credit Amount" unit="GHS"
          description="Maximum credit amount allowed per customer. Orders requesting credit above this amount are automatically blocked." min={0} max={10000000} />
        <SettingToggle settingKey="cash_payments_enabled" label="Cash Payments Enabled"
          description="Allow Cash as payment type in Finance order processing." />
        <SettingToggle settingKey="cheque_payments_enabled" label="Cheque Payments Enabled"
          description="Allow Cheque as payment type. When OFF Finance cannot record cheque payments." />
        <SettingToggle settingKey="momo_payments_enabled" label="Mobile Money Enabled"
          description="Allow Mobile Money (MTN, Vodafone, AirtelTigo) as payment type." />
        <SettingToggle settingKey="invoice_generation_enabled" label="Auto Invoice Generation"
          description="Automatically generate invoice when Finance approves an order. When OFF invoices must be created manually." />
        <SettingToggle settingKey="finance_needs_ceo_cosign" label="Finance Needs CEO Co-sign"
          description="When ON all Finance payment approvals require CEO electronic co-signature before they are processed." />
        <SettingToggle settingKey="payroll_processing_enabled" label="Payroll Processing Enabled"
          description="Allow Finance to process payroll batches. When OFF payroll submissions from HR are frozen." />
        <SettingNumber settingKey="ceo_approval_threshold" label="CEO Approval Threshold" unit="GHS"
          description="Orders above this amount require CEO approval before Finance can process payment." min={0} max={100000000} />
        <SettingToggle settingKey="management_price_setting" label="Management Can Set Prices"
          description="Allow Management to set product selling prices. When OFF only CEO can set and broadcast prices." />
        <SettingToggle settingKey="ceo_must_approve_prices" label="CEO Must Approve Price Changes"
          description="When ON Management can draft prices but CEO must review and approve before they broadcast to Finance and Marketing." />
        <SettingToggle settingKey="forms_control" label="All Forms Enabled (Master)"
          description="Master switch for all forms across all departments. When OFF no user can submit any form in any department." />
        <SettingToggle settingKey="orders_enabled" label="Orders Enabled"
          description="Allow new orders to be created. When OFF Marketing cannot submit new customer orders or internal production orders." />
      </Section>

      {/* ── SECTION 3: OPERATIONS CONTROLS ───────────────────────────── */}
      <Section title="Section 3 — Operations Controls" icon={Package}>
        <SettingToggle settingKey="cargo_intake_enabled" label="Cargo Intake Enabled"
          description="Allow Operations to log new cargo receipts from the port. When OFF the Log Intake button is disabled." />
        <SettingToggle settingKey="stock_adjustments_allowed" label="Stock Adjustments Allowed"
          description="Allow manual stock level adjustments in Operations. When OFF only system-generated stock movements are allowed." />
        <SettingToggle settingKey="quality_check_needs_cosign" label="Require Co-sign on Quality Check"
          description="When ON quality check results require CEO or Management approval before stock is updated. Operations cannot pass goods independently." />
        <SettingToggle settingKey="discrepancy_auto_alert_ceo" label="CEO Discrepancy Alerts"
          description="CEO receives instant notification for every discrepancy report filed by Operations." />
      </Section>

      {/* ── SECTION 4: DISPATCH CONTROLS ──────────────────────────────── */}
      <Section title="Section 4 — Dispatch Controls" icon={Truck}>
        <SettingToggle settingKey="deliveries_enabled" label="Deliveries Enabled"
          description="Allow Dispatch to create and process deliveries. When OFF no deliveries can be assigned or dispatched." />
        <SettingToggle settingKey="gps_tracking_enabled" label="GPS Tracking Enabled"
          description="Enable real-time GPS tracking for all delivery vehicles." />
        <SettingSelect settingKey="gps_ping_interval" label="GPS Ping Interval"
          description="How frequently GPS location updates. Lower = more accurate but uses more data."
          options={[{ value: '10', label: '10 seconds' }, { value: '30', label: '30 seconds' }, { value: '60', label: '60 seconds' }]} />
        <SettingToggle settingKey="proof_of_delivery_required" label="Proof of Delivery Required"
          description="Dispatch cannot mark a delivery as complete without uploading a photo proof. Enforced on all deliveries." />
        <SettingToggle settingKey="dispatch_needs_management" label="Management Must Approve Driver"
          description="When ON driver assignments require Management approval before dispatch." />
      </Section>

      {/* ── SECTION 5: DATA CONTROLS ──────────────────────────────────── */}
      <Section title="Section 5 — Data Controls" icon={Database}>
        <SettingToggle settingKey="data_export_enabled" label="Data Export Enabled"
          description="Allow CSV and PDF exports across all departments. When OFF all export buttons are hidden and disabled." />
        <SettingToggle settingKey="data_import_enabled" label="Data Import Enabled"
          description="Master switch for all file imports. Management still controls which departments can import and what types." />
        <SettingSelect settingKey="audit_log_access" label="Audit Log Access"
          description="Controls which roles can access the audit log viewer."
          options={[{ value: 'ceo_only', label: 'CEO Only' }, { value: 'management_and_above', label: 'Management and Above' }, { value: 'all_staff', label: 'All Staff' }]} />
        <SettingToggle settingKey="print_enabled" label="Printing Enabled"
          description="Allow printing across all departments. When OFF print buttons are hidden and disabled." />
        <SettingToggle settingKey="report_generation_enabled" label="Reports Enabled"
          description="Allow financial report generation in Finance department." />
        <SettingToggle settingKey="ceo_activity_visible_to_others" label="CEO Activity Visible to Others"
          description="When ON, other departments can see CEO-authored entries in the Department Activity feed and the CEO department card. When OFF (default), only the CEO can see their own activity entries." />
      </Section>

      {/* ── SECTION 6: COMMUNICATION CONTROLS ────────────────────────── */}
      <Section title="Section 6 — Communication Controls" icon={MessageCircle}>
        <SettingToggle settingKey="global_chat_enabled" label="Global Chat Enabled"
          description="Enable company-wide chat in the Boardroom. When OFF the Global Chat tab is hidden for all users." />
        <SettingToggle settingKey="department_chat_enabled" label="Department Chat Enabled"
          description="Enable department-specific chat channels." />
        <SettingToggle settingKey="direct_messages_enabled" label="Direct Messages Enabled"
          description="Allow private messaging between individual staff members." />
        <SettingToggle settingKey="external_email_enabled" label="External Email Enabled"
          description="Allow sending emails to suppliers and customers from within the app." />
        <SettingToggle settingKey="whatsapp_enabled" label="WhatsApp Enabled"
          description="Allow sending WhatsApp messages to suppliers and customers." />
        <SettingToggle settingKey="payment_reminders_enabled" label="Payment Reminders Enabled"
          description="Allow Finance to send payment reminder messages to customers with outstanding credit." />
        <SettingToggle settingKey="announcements_ceo_only" label="CEO Only Announcements"
          description="When ON only CEO can post company-wide announcements. When OFF Management can also post announcements." />
      </Section>

      {/* ── SECTION 7: SYSTEM CONTROLS ───────────────────────────────── */}
      <Section title="Section 7 — System Controls" icon={Settings}>
        <SettingToggle
          settingKey="maintenance_mode"
          label="Maintenance Mode"
          description="When ON all users except CEO see a maintenance page and cannot access any features. Use when performing system updates or critical maintenance."
          warning="⚠️ All non-CEO users will immediately see the maintenance page and lose access. Are you sure?"
        />
        <SettingNumber settingKey="session_timeout_minutes" label="Session Timeout" unit="min"
          description="Automatically log out inactive users after this many minutes. Minimum 5, maximum 480 (8 hours)." min={5} max={480} />
        <SettingToggle settingKey="force_2fa_management" label="Force 2FA for Management"
          description="Require two-factor authentication for all Management users." />
        <SettingToggle settingKey="force_2fa_finance" label="Force 2FA for Finance"
          description="Require two-factor authentication for all Finance users." />
        <SettingSelect settingKey="password_reset_authority" label="Password Reset Authority"
          description="Control who has authority to reset staff passwords."
          options={[{ value: 'ceo_only', label: 'CEO Only' }, { value: 'hr_and_ceo', label: 'HR and CEO' }, { value: 'specific_user', label: 'Specific User' }]} />
        <SettingSelect settingKey="account_deletion_authority" label="Account Deletion Authority"
          description="Control who can permanently delete staff accounts. This action cannot be undone."
          options={[{ value: 'ceo_only', label: 'CEO Only' }, { value: 'specific_user', label: 'Specific User' }]} />
      </Section>

      {/* ── SECTION 8: APPROVAL CONTROLS ─────────────────────────────── */}
      <Section title="Section 8 — Approval Controls" icon={CheckSquare}>
        <SettingNumber settingKey="ceo_cosign_credit_threshold" label="Credit Co-sign Threshold" unit="GHS"
          description="Credit orders above this amount require CEO electronic approval before Finance can process." min={0} max={10000000} />
        <SettingNumber settingKey="ceo_cosign_order_threshold" label="Order Co-sign Threshold" unit="GHS"
          description="Customer orders above this amount require CEO approval before Finance can process payment." min={0} max={10000000} />
        <SettingToggle settingKey="ceo_must_approve_prices" label="CEO Price Approval Required"
          description="Management can draft and set prices but CEO must review and approve before they broadcast to Finance and Marketing." />
        <SettingToggle settingKey="ceo_must_approve_payroll" label="CEO Payroll Approval"
          description="Payroll flow becomes: HR submits → Finance processes → CEO approves → Payment made. Extra layer of financial security." />
        <SettingToggle settingKey="ceo_must_approve_departments" label="CEO Department Approval"
          description="When ON HR cannot activate new departments without CEO approval. Department is created but stays inactive until CEO approves." />
        <SettingToggle settingKey="ceo_must_approve_registrations" label="CEO Registration Approval"
          description="All new staff registrations go directly to CEO first before HR review. Highest level of staff access control." />
      </Section>

      {/* ── SECTION 9: SPREADSHEETS CONTROL ──────────────────────────── */}
      <Section title="Section 9 — Spreadsheets Control" icon={FileSpreadsheet}>
        <SettingToggleWithException
          settingKey="spreadsheets_enabled"
          label="Spreadsheets Enabled (Master)"
          description="Master switch for the Spreadsheets feature across all departments. When OFF no user can access Free Sheets or Data Sheets unless they have a specific email exception that overrides this toggle."
        />
      </Section>

      {/* ── SECTION 10: DATA RESET CENTER ────────────────────────────── */}
      <Section title="Section 10 — Data Reset Center" icon={Trash2} defaultOpen={false}>
        <DataResetSection addNotification={addNotification} />
      </Section>

      {/* ── USER MANAGEMENT MODAL ───────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent)]" /> All Staff — User Management
              </h3>
              <button onClick={() => setShowUserModal(false)} className="p-1.5 hover:bg-[var(--accent-light)] rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                <Search className="w-4 h-4 text-[var(--text-muted)]" />
                <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none placeholder-[var(--text-muted)]" />
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="py-3 px-4 text-left font-semibold">Name</th>
                    <th className="py-3 px-4 text-left font-semibold">Email</th>
                    <th className="py-3 px-4 text-left font-semibold">Department</th>
                    <th className="py-3 px-4 text-left font-semibold">Role</th>
                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                    <th className="py-3 px-4 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredStaff.map(s => (
                    <tr key={s.id} className="hover:bg-[var(--accent-light)] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{s.full_name || '—'}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">{s.email || '—'}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">{s.department || s.role || '—'}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">{s.role || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' :
                          s.status === 'SUSPENDED' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-rose-500/10 text-rose-500'
                        }`}>{s.status || 'ACTIVE'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {s.status === 'SUSPENDED' ? (
                            <button onClick={() => reactivateUser(s.id, s.full_name)} title="Reactivate" className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500 cursor-pointer">
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => suspendUser(s.id, s.full_name)} title="Suspend" className="p-1.5 hover:bg-amber-500/10 rounded-lg text-amber-500 cursor-pointer">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => {
                            supabase.auth.admin?.deleteUser(s.id).then(() => {
                              supabase.from('profiles').delete().eq('id', s.id).then(() => {}, () => {});
                              addNotification(`User ${s.full_name} terminated.`);
                              loadData();
                            }).catch(() => {
                              supabase.from('profiles').update({ status: 'TERMINATED' }).eq('id', s.id).then(() => {
                                addNotification(`User ${s.full_name} marked as terminated.`);
                                loadData();
                              }, () => {});
                            });
                          }} title="Terminate" className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500 cursor-pointer">
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-[var(--text-muted)] text-xs">No staff found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
