// rebma-mobile/screens/settings/ControlCenterScreen.tsx
// Ports: rebma-web/src/views/ceo/CeoControlCenter.tsx (1463 lines) +
// contexts/CeoSettingsContext.tsx — D91, the heaviest screen this phase.
// Ports the real ~50-key ceo_settings toggle/threshold surface (9
// sections, all mechanical Switch/Input rows against one key-value
// table) plus User Management (Suspend/Reactivate/Reset Password/
// Terminate — the last two reuse lib/apiBase.ts's callPrivilegedApi,
// the exact pattern HR's Phase 7.7 screens already established) and the
// Department approval queue. Gated the same double-checked way web
// itself does: hidden from ModuleLauncher for non-admins (see
// AppearanceScreen) AND re-checked here before rendering real content.
//
// Scope Correction (post-7.11): the four items below were originally
// deferred as a "bounded gap" (D28 precedent). The user explicitly
// overturned that — REBMA Mobile must match REBMA Web's real ERP
// capability, not a lightweight subset, and administrative/complex/
// destructive is not a valid reason to omit web functionality. A full
// security/authorization audit (reading CeoControlCenter.tsx in full +
// the live RLS in supabase_control_center.sql/supabase_rls_overhaul.sql/
// supabase_document_templates_ceo_only_write.sql) found real, well-
// designed server-side enforcement for all four (ceo_settings' section-
// scoped delegation model, ceo_delegations' admin-only self-escalation
// guard, staff_invites' hr-or-admin write policy, document_templates'
// admin-only write policy) — no genuine new issue, safe to port
// faithfully. See D94-D98 in the plan file.
//
// Still deliberately deferred: the per-user Spreadsheets exception
// override (SettingToggleWithException on web — spreadsheets_enabled
// itself is still ported as a plain toggle) — a narrow, rarely-used
// per-email allow/block list layered on top of one already-ported
// toggle, genuinely out of scope for this correction pass.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { ShieldAlert, Copy, Check, X, Key, Plus } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabaseClient';
import { getCeoSetting, setCeoSetting } from '../../lib/ceoSetting';
import { callPrivilegedApi, ApiNotConfiguredError, isPrivilegedApiConfigured } from '../../lib/apiBase';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import SearchablePicker from '../../components/ui/SearchablePicker';
import EmptyState from '../../components/ui/EmptyState';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import DocumentTemplatesEditor from '../../components/shared/DocumentTemplatesEditor';
import ExportSheet from '../../components/shared/ExportSheet';

type SettingField =
  | { key: string; label: string; description?: string; kind: 'bool' }
  | { key: string; label: string; description?: string; kind: 'number' }
  | { key: string; label: string; description?: string; kind: 'select'; options: { value: string; label: string }[] };

interface Section { id: string; title: string; fields: SettingField[] }

const SECTIONS: Section[] = [
  {
    id: 'access', title: 'Access Control', fields: [
      { key: 'app_master_switch', label: 'App Master Switch', kind: 'bool' },
      { key: 'registrations_allowed', label: 'Registrations Allowed', kind: 'bool' },
      { key: 'invitation_only', label: 'Invitation Only', kind: 'bool' },
      { key: 'hr_can_approve_registrations', label: 'HR Can Approve Registrations', kind: 'bool' },
      { key: 'management_can_approve_registrations', label: 'Management Can Approve Registrations', kind: 'bool' },
      { key: 'ceo_must_approve_registrations', label: 'CEO Must Approve Registrations', kind: 'bool' },
    ],
  },
  {
    id: 'financial', title: 'Financial Controls', fields: [
      { key: 'credit_sales_enabled', label: 'Credit Sales Enabled', kind: 'bool' },
      { key: 'max_credit_amount', label: 'Max Credit Amount (GHS)', kind: 'number' },
      { key: 'cash_payments_enabled', label: 'Cash Payments Enabled', kind: 'bool' },
      { key: 'cheque_payments_enabled', label: 'Cheque Payments Enabled', kind: 'bool' },
      { key: 'momo_payments_enabled', label: 'Mobile Money Payments Enabled', kind: 'bool' },
      { key: 'invoice_generation_enabled', label: 'Invoice Generation Enabled', kind: 'bool' },
      { key: 'finance_needs_ceo_cosign', label: 'Finance Needs CEO Co-Sign', kind: 'bool' },
      { key: 'payroll_processing_enabled', label: 'Payroll Processing Enabled', kind: 'bool' },
      { key: 'ceo_approval_threshold', label: 'CEO Approval Threshold (GHS)', kind: 'number' },
      { key: 'management_price_setting', label: 'Management Price Setting', kind: 'bool' },
      { key: 'ceo_must_approve_prices', label: 'CEO Must Approve Prices', kind: 'bool' },
      { key: 'forms_control', label: 'Forms Control (master)', kind: 'bool' },
      { key: 'orders_enabled', label: 'Orders Enabled', kind: 'bool' },
    ],
  },
  {
    id: 'operations', title: 'Operations Controls', fields: [
      { key: 'cargo_intake_enabled', label: 'Cargo Intake Enabled', kind: 'bool' },
      { key: 'stock_adjustments_allowed', label: 'Stock Adjustments Allowed', kind: 'bool' },
      { key: 'management_can_delete_stock', label: 'Management Can Delete Stock', kind: 'bool' },
      { key: 'quality_check_needs_cosign', label: 'Quality Check Needs Co-Sign', kind: 'bool' },
      { key: 'discrepancy_auto_alert_ceo', label: 'Discrepancy Auto-Alert CEO', kind: 'bool' },
    ],
  },
  {
    id: 'dispatch', title: 'Dispatch Controls', fields: [
      { key: 'deliveries_enabled', label: 'Deliveries Enabled', kind: 'bool' },
      { key: 'gps_tracking_enabled', label: 'GPS Tracking Enabled', kind: 'bool' },
      { key: 'gps_ping_interval', label: 'GPS Ping Interval', kind: 'select', options: [{ value: '10', label: '10 seconds' }, { value: '30', label: '30 seconds' }, { value: '60', label: '60 seconds' }] },
      { key: 'proof_of_delivery_required', label: 'Proof of Delivery Required', kind: 'bool' },
      { key: 'dispatch_needs_management', label: 'Dispatch Needs Management', kind: 'bool' },
    ],
  },
  {
    id: 'data', title: 'Data Controls', fields: [
      { key: 'data_export_enabled', label: 'Data Export Enabled', kind: 'bool' },
      { key: 'data_import_enabled', label: 'Data Import Enabled', kind: 'bool' },
      { key: 'audit_log_access', label: 'Audit Log Access', kind: 'select', options: [{ value: 'ceo_only', label: 'CEO Only' }, { value: 'management_and_above', label: 'Management and Above' }, { value: 'all_staff', label: 'All Staff' }] },
      { key: 'print_enabled', label: 'Printing Enabled', kind: 'bool' },
      { key: 'report_generation_enabled', label: 'Report Generation Enabled', kind: 'bool' },
      { key: 'ceo_activity_visible_to_others', label: 'CEO Activity Visible to Others', kind: 'bool' },
    ],
  },
  {
    id: 'communication', title: 'Communication Controls', fields: [
      { key: 'global_chat_enabled', label: 'Global Chat Enabled', kind: 'bool' },
      { key: 'department_chat_enabled', label: 'Department Chat Enabled', kind: 'bool' },
      { key: 'direct_messages_enabled', label: 'Direct Messages Enabled', kind: 'bool' },
      { key: 'messenger_calls_enabled', label: 'Voice/Video Calls Enabled', kind: 'bool' },
      { key: 'messenger_attachments_enabled', label: 'Attachments Enabled', kind: 'bool' },
      { key: 'message_retention_days', label: 'Message Retention (days, 0 = off)', kind: 'number' },
      { key: 'external_email_enabled', label: 'External Email Enabled', kind: 'bool' },
      { key: 'whatsapp_enabled', label: 'WhatsApp Enabled', kind: 'bool' },
      { key: 'payment_reminders_enabled', label: 'Payment Reminders Enabled', kind: 'bool' },
      { key: 'announcements_ceo_only', label: 'Announcements CEO-Only', kind: 'bool' },
    ],
  },
  {
    id: 'system', title: 'System Controls', fields: [
      { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Confirm before enabling — blocks normal app use.', kind: 'bool' },
      { key: 'session_timeout_minutes', label: 'Session Timeout (minutes)', kind: 'number' },
      { key: 'force_2fa_management', label: 'Force 2FA for Management', kind: 'bool' },
      { key: 'force_2fa_finance', label: 'Force 2FA for Finance', kind: 'bool' },
      { key: 'password_reset_authority', label: 'Password Reset Authority', kind: 'select', options: [{ value: 'ceo_only', label: 'CEO Only' }, { value: 'hr_and_ceo', label: 'HR and CEO' }, { value: 'specific_user', label: 'Specific User' }] },
      { key: 'account_deletion_authority', label: 'Account Deletion Authority', kind: 'select', options: [{ value: 'ceo_only', label: 'CEO Only' }, { value: 'specific_user', label: 'Specific User' }] },
    ],
  },
  {
    id: 'approval', title: 'Approval Controls', fields: [
      { key: 'ceo_cosign_credit_threshold', label: 'CEO Co-Sign Credit Threshold (GHS)', kind: 'number' },
      { key: 'ceo_cosign_order_threshold', label: 'CEO Co-Sign Order Threshold (GHS)', kind: 'number' },
      { key: 'ceo_must_approve_payroll', label: 'CEO Must Approve Payroll', kind: 'bool' },
      { key: 'ceo_must_approve_departments', label: 'CEO Must Approve Departments', kind: 'bool' },
    ],
  },
  {
    id: 'spreadsheets', title: 'Spreadsheets Control', fields: [
      { key: 'spreadsheets_enabled', label: 'Spreadsheets Enabled', kind: 'bool' },
    ],
  },
];

const ALL_KEYS = Array.from(new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key))));

interface StaffRow { id: string; full_name: string; email: string; role: string; status: string }
interface DeptRow { id: string; name: string; status: string }
interface InviteRow { id: string; token: string; email: string | null; full_name: string | null; department: string; role: string; auto_approve: boolean; expires_at: string; status: string }
interface DelegateRow { id: string; delegated_to_email: string; delegated_to_name: string; permissions: string[]; expires_at: string | null; active: boolean }

// D98 — verbatim from CeoControlCenter.tsx's DEPT_TABLES. Every non-ALL
// department gets its own audit-trail entry scoped to just its own rows
// (see the department filter in runReset()), not the shared table
// outright, so clearing Marketing doesn't erase Finance's trail too.
const AUDIT_ENTRY = { name: 'global_audit_history', label: 'Department Audit Trail' };
const DEPT_TABLES: Record<string, { label: string; tables: { name: string; label: string }[] }> = {
  MARKETING: { label: 'Marketing', tables: [{ name: 'orders', label: 'Sales Orders' }, { name: 'customers', label: 'Customer Directory' }, AUDIT_ENTRY] },
  FINANCE: { label: 'Finance', tables: [
    { name: 'finance_payments', label: 'Finance Payments (Receipts)' },
    { name: 'finance_expenses', label: 'Finance Expenses' },
    { name: 'finance_cheques', label: 'Finance Cheques' },
    { name: 'finance_petty_cash', label: 'Finance Petty Cash' },
    { name: 'recurring_payments', label: 'Recurring Payments' },
    { name: 'finance_report_history', label: 'Financial Statements & Reports History' },
    AUDIT_ENTRY,
  ] },
  OPERATIONS: { label: 'Operations', tables: [
    { name: 'cargo_intake', label: 'Cargo Intake Log' },
    { name: 'stock_ledger', label: 'Recent Stock Movements' },
    { name: 'general_purchases', label: 'General Purchases' },
    { name: 'stock', label: 'Stock Levels' },
    { name: 'wip_stock', label: 'WIP Stock' },
    AUDIT_ENTRY,
  ] },
  PRODUCTION: { label: 'Production', tables: [{ name: 'production_logs', label: 'Production Logs' }, { name: 'production_requests', label: 'Production Requests' }, AUDIT_ENTRY] },
  MANAGEMENT: { label: 'Management', tables: [
    { name: 'goods_prices', label: 'Goods Prices Catalog' },
    { name: 'supplier_orders', label: 'Supplier Orders' },
    { name: 'suppliers', label: 'Suppliers Directory' },
    { name: 'departments', label: 'Departments Directory' },
    AUDIT_ENTRY,
  ] },
  HR: { label: 'HR', tables: [
    { name: 'payroll_batches', label: 'Payroll Batches' },
    { name: 'payroll_entries', label: 'Payroll Entries' },
    { name: 'payroll_items', label: 'Payroll Items' },
    { name: 'leave_requests', label: 'Leave Requests' },
    { name: 'attendance', label: 'Attendance Logs' },
    AUDIT_ENTRY,
  ] },
  DISPATCH: { label: 'Dispatch', tables: [{ name: 'delivery_logs', label: 'Delivery Logs' }, { name: 'drivers', label: 'Drivers Directory' }, AUDIT_ENTRY] },
  RECEPTION: { label: 'Reception', tables: [{ name: 'visitors', label: 'Visitors Logs' }, AUDIT_ENTRY] },
  LOGISTICS: { label: 'Logistics', tables: [AUDIT_ENTRY] },
  ALL: { label: 'ALL Departments', tables: [
    { name: 'orders', label: 'Sales Orders' }, { name: 'customers', label: 'Customer Directory' },
    { name: 'finance_payments', label: 'Finance Payments (Receipts)' }, { name: 'finance_expenses', label: 'Finance Expenses' }, { name: 'finance_cheques', label: 'Finance Cheques' }, { name: 'finance_petty_cash', label: 'Finance Petty Cash' }, { name: 'recurring_payments', label: 'Recurring Payments' }, { name: 'finance_report_history', label: 'Financial Statements & Reports History' },
    { name: 'cargo_intake', label: 'Cargo Intake Log' }, { name: 'stock_ledger', label: 'Recent Stock Movements' }, { name: 'general_purchases', label: 'General Purchases' }, { name: 'stock', label: 'Stock Levels' }, { name: 'wip_stock', label: 'WIP Stock' },
    { name: 'production_logs', label: 'Production Logs' }, { name: 'production_requests', label: 'Production Requests' },
    { name: 'goods_prices', label: 'Goods Prices Catalog' }, { name: 'supplier_orders', label: 'Supplier Orders' }, { name: 'suppliers', label: 'Suppliers Directory' }, { name: 'departments', label: 'Departments Directory' },
    { name: 'payroll_batches', label: 'Payroll Batches' }, { name: 'payroll_entries', label: 'Payroll Entries' }, { name: 'payroll_items', label: 'Payroll Items' }, { name: 'leave_requests', label: 'Leave Requests' }, { name: 'attendance', label: 'Attendance Logs' },
    { name: 'delivery_logs', label: 'Delivery Logs' }, { name: 'drivers', label: 'Drivers Directory' },
    { name: 'visitors', label: 'Visitors Logs' },
    { name: 'global_audit_history', label: 'Global Audit History' }, { name: 'supplier_order_notifications', label: 'Supplier Order Notifications' },
  ] },
};

// D97 — the exact 8 stable keys stored in ceo_delegations.permissions and
// checked by the live setting_section() SQL function (confirmed by direct
// read of supabase_control_center.sql, not guessed) — spreadsheets is NOT
// delegatable (setting_section()'s own `else null` fallthrough).
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

const INVITE_DEPT_OPTIONS = [...['MARKETING', 'FINANCE', 'HR', 'PRODUCTION', 'RECEPTION', 'MANAGEMENT'].map((d) => ({ value: d, label: d })), { value: 'admin_warehouse', label: 'ADMIN & WAREHOUSE' }];
const INVITE_ROLE_OPTIONS = ['staff', 'supervisor', 'manager'].map((r) => ({ value: r, label: r }));
const INVITE_EXPIRY_OPTIONS = [{ value: '24h', label: '24 hours' }, { value: '48h', label: '48 hours' }, { value: '7d', label: '7 days' }];

function AdminSetting({ field, value, onChange }: { field: SettingField; value: any; onChange: (v: any) => void }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{field.label}</Text>
          {field.description ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 2 }}>{field.description}</Text> : null}
        </View>
        {field.kind === 'bool' && (
          <Button label={value ? 'On' : 'Off'} size="sm" variant={value ? 'primary' : 'ghost'} onPress={() => onChange(!value)} />
        )}
      </View>
      {field.kind === 'number' && (
        <View style={{ marginTop: t.spacing.sm }}>
          <Input value={value != null ? String(value) : ''} onChangeText={(v) => onChange(v === '' ? null : Number(v))} keyboardType="numeric" placeholder="0" />
        </View>
      )}
      {field.kind === 'select' && (
        <View style={{ marginTop: t.spacing.sm }}>
          <SearchablePicker value={value || field.options[0].value} onChange={onChange} options={field.options} />
        </View>
      )}
    </View>
  );
}

export default function ControlCenterScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = !!profile?.isAdmin;

  const [activeSection, setActiveSection] = useState('access');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  // Phase 11.6 — message export + audit trail (mirrors web's
  // MessageExportSection exactly, reusing the Gap-Closure Backlog's
  // ExportSheet/lib/exportEngine.ts infra).
  const [exportChannels, setExportChannels] = useState<{ id: string; name: string | null; type: string }[]>([]);
  const [exportChannelId, setExportChannelId] = useState('');
  const [exportRows, setExportRows] = useState<any[]>([]);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [preparingExport, setPreparingExport] = useState(false);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Invite Links (D96)
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', department: 'MARKETING', role: 'staff', expiry: '24h', autoApprove: false });
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [invitesBusy, setInvitesBusy] = useState(false);

  // Delegated Access (D97)
  const [delegates, setDelegates] = useState<DelegateRow[]>([]);
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const [delegateForm, setDelegateForm] = useState({ email: '', name: '', permissions: [] as string[], expiresAt: '' });
  const [delegatesBusy, setDelegatesBusy] = useState(false);

  // Data Reset Center (D98)
  const [resetDept, setResetDept] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetRunning, setResetRunning] = useState(false);
  const [resetResults, setResetResults] = useState<{ table: string; deleted: number; error?: string }[]>([]);
  const [resetDone, setResetDone] = useState(false);

  const loadSettings = useCallback(async () => {
    const results = await Promise.all(ALL_KEYS.map((k) => getCeoSetting(k, null)));
    const map: Record<string, any> = {};
    ALL_KEYS.forEach((k, i) => { map[k] = results[i]; });
    setSettings(map);
    setLoading(false);
  }, []);

  const loadStaffAndDepts = useCallback(async () => {
    const [{ data: staffRows }, { data: deptRows }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, status').order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name, status').eq('status', 'pending').order('name'),
    ]);
    setStaff((staffRows as any) || []);
    setDepartments((deptRows as any) || []);
  }, []);

  const loadInvitesAndDelegates = useCallback(async () => {
    const [{ data: inviteRows }, { data: delegateRows }] = await Promise.all([
      supabase.from('staff_invites').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('ceo_delegations').select('*').eq('active', true).order('created_at', { ascending: false }),
    ]);
    setInvites((inviteRows as any) || []);
    setDelegates((delegateRows as any) || []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadSettings();
    loadStaffAndDepts();
    loadInvitesAndDelegates();
  }, [isAdmin, loadSettings, loadStaffAndDepts, loadInvitesAndDelegates]);

  useEffect(() => {
    if (!isAdmin || activeSection !== 'messages' || exportChannels.length > 0) return;
    supabase.from('channels').select('id, name, type').then(({ data }) => setExportChannels(data || []));
  }, [isAdmin, activeSection, exportChannels.length]);

  const channelExportLabel = (c: { id: string; name: string | null; type: string }) =>
    c.type === 'everyone' ? 'Everyone' : c.type === 'group' ? (c.name || 'Group') : `DM ${c.id.slice(-6)}`;

  const prepareMessageExport = async () => {
    setPreparingExport(true);
    try {
      let query = supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
      if (exportChannelId) query = query.eq('channel_id', exportChannelId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data || []).map((m: any) => ({
        channel_id: m.channel_id, sender: m.sender, content: m.deleted_at ? '(deleted)' : m.content,
        time: m.time, created_at: m.created_at, attachment_type: m.attachment_type || '',
      }));
      setExportRows(rows);
      setShowExportSheet(true);
      await supabase.from('global_audit_history').insert({
        department: 'CEO',
        action: `EXPORT: Messenger history — ${exportChannelId ? channelExportLabel(exportChannels.find((c) => c.id === exportChannelId)!) : 'All conversations'} (${rows.length} messages)`,
        performed_by: profile?.fullName || 'CEO',
        reference_id: exportChannelId || null,
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      Alert.alert('Export failed', e.message);
    }
    setPreparingExport(false);
  };

  const updateSetting = async (field: SettingField, value: any) => {
    if (field.key === 'maintenance_mode' && value === true) {
      Alert.alert('Enable Maintenance Mode?', 'This blocks normal app use for everyone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', style: 'destructive', onPress: () => commitSetting(field.key, value) },
      ]);
      return;
    }
    commitSetting(field.key, value);
  };

  const commitSetting = async (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await setCeoSetting(key, value);
  };

  const suspendUser = async (row: StaffRow) => {
    setBusyUserId(row.id);
    try {
      await supabase.from('profiles').update({ status: 'SUSPENDED' }).eq('id', row.id);
      await loadStaffAndDepts();
    } finally {
      setBusyUserId(null);
    }
  };

  const reactivateUser = async (row: StaffRow) => {
    setBusyUserId(row.id);
    try {
      await supabase.from('profiles').update({ status: 'ACTIVE' }).eq('id', row.id);
      await loadStaffAndDepts();
    } finally {
      setBusyUserId(null);
    }
  };

  const resetPassword = (row: StaffRow) => {
    Alert.alert('Reset Password', `Send a password reset email to ${row.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send', onPress: async () => {
          setBusyUserId(row.id);
          try {
            const res: any = await callPrivilegedApi('/api/reset-user-password', { userId: row.id });
            Alert.alert('Sent', res?.message || `Password reset email sent to ${row.full_name}.`);
          } catch (e: any) {
            if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
            else Alert.alert('Failed', e.message || 'Could not send reset email.');
          } finally {
            setBusyUserId(null);
          }
        },
      },
    ]);
  };

  const terminateUser = (row: StaffRow) => {
    Alert.alert('Terminate User', `Terminate ${row.full_name}? This revokes their login immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Terminate', style: 'destructive', onPress: async () => {
          setBusyUserId(row.id);
          try {
            const res: any = await callPrivilegedApi('/api/terminate-user', { userId: row.id });
            Alert.alert('Terminated', res?.message || `User ${row.full_name} terminated.`);
            await loadStaffAndDepts();
          } catch (e: any) {
            if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
            else Alert.alert('Failed', e.message || 'Could not terminate user.');
          } finally {
            setBusyUserId(null);
          }
        },
      },
    ]);
  };

  const decideDepartment = async (dept: DeptRow, approve: boolean) => {
    if (approve) await supabase.from('departments').update({ status: 'active' }).eq('id', dept.id);
    else await supabase.from('departments').delete().eq('id', dept.id);
    setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
  };

  // ── Invite Links (D96) ──────────────────────────────────────────────
  // Web builds the link from window.location.origin, which doesn't exist
  // on mobile — reuses the same confirmed web-app origin already gated
  // via isPrivilegedApiConfigured() since Phase 7.7 rather than guessing.
  const generateInviteLink = async () => {
    if (invitesBusy) return;
    setInvitesBusy(true);
    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expiryHours: Record<string, number> = { '24h': 24, '48h': 48, '7d': 168 };
      const hours = expiryHours[inviteForm.expiry] ?? 24;
      const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();

      const { error } = await supabase.from('staff_invites').insert([{
        token,
        email: inviteForm.email || null,
        full_name: inviteForm.fullName || null,
        department: inviteForm.department,
        role: inviteForm.role,
        auto_approve: inviteForm.autoApprove,
        expires_at: expiresAt,
        status: 'pending',
      }]);
      if (error) throw error;

      if (isPrivilegedApiConfigured()) {
        const base = process.env.EXPO_PUBLIC_API_BASE_URL || '';
        setGeneratedLink(`${base}/register?token=${token}`);
      } else {
        setGeneratedLink('');
        Alert.alert('Not Configured', "The registration link's base URL isn't set yet — ask an admin to set EXPO_PUBLIC_API_BASE_URL. The invite was still created and can be used once it is.");
      }
      setLinkCopied(false);
      await loadInvitesAndDelegates();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not generate invite link.');
    } finally {
      setInvitesBusy(false);
    }
  };

  const copyGeneratedLink = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink);
    setLinkCopied(true);
  };

  const revokeInvite = async (row: InviteRow) => {
    if (invitesBusy) return;
    setInvitesBusy(true);
    try {
      await supabase.from('staff_invites').update({ status: 'revoked' }).eq('id', row.id);
      setInvites((prev) => prev.filter((i) => i.id !== row.id));
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not revoke invite.');
    } finally {
      setInvitesBusy(false);
    }
  };

  // ── Delegated Access (D97) ──────────────────────────────────────────
  const grantDelegate = async () => {
    if (!delegateForm.email.trim() || delegatesBusy) return;
    setDelegatesBusy(true);
    try {
      const { error } = await supabase.from('ceo_delegations').insert([{
        delegated_to_email: delegateForm.email.trim(),
        delegated_to_name: delegateForm.name.trim() || delegateForm.email.trim(),
        permissions: delegateForm.permissions,
        expires_at: delegateForm.expiresAt || null,
        active: true,
      }]);
      if (error) throw error;
      setShowDelegateForm(false);
      setDelegateForm({ email: '', name: '', permissions: [], expiresAt: '' });
      await loadInvitesAndDelegates();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not grant access.');
    } finally {
      setDelegatesBusy(false);
    }
  };

  const revokeDelegate = async (row: DelegateRow) => {
    if (delegatesBusy) return;
    setDelegatesBusy(true);
    try {
      await supabase.from('ceo_delegations').update({ active: false }).eq('id', row.id);
      setDelegates((prev) => prev.filter((d) => d.id !== row.id));
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not revoke delegation.');
    } finally {
      setDelegatesBusy(false);
    }
  };

  const togglePermission = (key: string) => {
    setDelegateForm((p) => ({
      ...p,
      permissions: p.permissions.includes(key) ? p.permissions.filter((x) => x !== key) : [...p.permissions, key],
    }));
  };

  // ── Data Reset Center (D98) ─────────────────────────────────────────
  // Ported verbatim from CeoControlCenter.tsx's DataResetSection,
  // including the stock_ledger reversal safeguard — see the header
  // comment on DEPT_TABLES above for why it's needed.
  const openReset = (dept: string) => {
    setResetDept(dept);
    setResetConfirmText('');
    setResetResults([]);
    setResetDone(false);
  };

  const closeReset = () => { if (resetRunning) return; setResetDept(null); };

  const runReset = async () => {
    if (resetConfirmText !== 'CONFIRM DELETE' || !resetDept) return;
    const cfg = DEPT_TABLES[resetDept];
    if (!cfg) return;
    setResetRunning(true);
    setResetResults([]);
    const res: typeof resetResults = [];

    for (const tbl of cfg.tables) {
      try {
        const query = tbl.name === 'global_audit_history' && resetDept !== 'ALL'
          ? (supabase.from(tbl.name as any).delete() as any).eq('department', resetDept)
          : (supabase.from(tbl.name as any).delete() as any).not('id', 'is', null);
        const { error, count } = await query;
        res.push({ table: tbl.name, deleted: count ?? 0, error: error?.message });
      } catch (e: any) {
        res.push({ table: tbl.name, deleted: 0, error: e?.message || 'Unknown error' });
      }
    }

    // Stock-ledger reversal safeguard: wiping `orders` without also
    // wiping `stock_ledger`/`stock` directly would orphan the REMOVE
    // rows deductStockForOrder wrote when those orders were sold —
    // permanently understating real inventory. Add each orphaned row's
    // quantity back to `stock` before deleting it. Skipped when this
    // reset already wipes stock_ledger directly (OPERATIONS or ALL).
    if (cfg.tables.some((t) => t.name === 'orders') && !cfg.tables.some((t) => t.name === 'stock_ledger')) {
      try {
        const { data: orphaned, error: fetchErr } = await supabase
          .from('stock_ledger')
          .select('id, product_name, quantity')
          .ilike('reference', '%Order Approved%');
        if (fetchErr) throw fetchErr;

        const reversalByProduct = new Map<string, number>();
        for (const row of orphaned || []) {
          const key = String(row.product_name || '').trim().toLowerCase();
          if (!key) continue;
          reversalByProduct.set(key, (reversalByProduct.get(key) || 0) + (Number(row.quantity) || 0));
        }
        for (const [productKey, qty] of reversalByProduct) {
          if (qty <= 0) continue;
          const { data: stockRow } = await supabase.from('stock').select('id, quantity').ilike('product_name', productKey).limit(1);
          if (stockRow && stockRow[0]) {
            await supabase.from('stock').update({ quantity: (Number(stockRow[0].quantity) || 0) + qty, last_updated: new Date().toISOString() }).eq('id', stockRow[0].id);
          }
        }

        const { error, count } = await (supabase.from('stock_ledger').delete() as any).ilike('reference', '%Order Approved%');
        res.push({ table: 'stock_ledger (orphaned sale entries, reversed into stock)', deleted: count ?? 0, error: error?.message });
      } catch (e: any) {
        res.push({ table: 'stock_ledger (orphaned sale entries)', deleted: 0, error: e?.message || 'Unknown error' });
      }
    }

    supabase.from('global_audit_history').insert([{
      action: 'DATA_RESET',
      department: resetDept,
      performed_by: profile?.fullName || 'CEO',
      details: `Cleared: ${cfg.tables.map((t) => t.label || t.name).join(', ')}`,
      timestamp: new Date().toISOString(),
    }]).then(() => {}, () => {});

    setResetResults(res);
    setResetRunning(false);
    setResetDone(true);
  };

  // Double-gate matching web's own explicit "against stale tab state"
  // comment — this screen also filters itself out of AppearanceScreen's
  // ModuleLauncher for non-admins, but re-checks here too.
  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState icon={<ShieldAlert size={22} color={t.colors.status.danger.text} />} title="Admin access required" description="This section is only available to CEO/admin accounts." />
      </Screen>
    );
  }

  const filteredStaff = staff.filter((s) => !staffSearch || s.full_name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.email?.toLowerCase().includes(staffSearch.toLowerCase()));
  const activeSectionDef = SECTIONS.find((s) => s.id === activeSection);

  return (
    <Screen refreshing={false} onRefresh={() => { loadSettings(); loadStaffAndDepts(); }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
          {[
            ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
            { id: 'staff', title: 'Staff' },
            { id: 'departments', title: `Departments${departments.length ? ` (${departments.length})` : ''}` },
            { id: 'invites', title: `Invite Links${invites.length ? ` (${invites.length})` : ''}` },
            { id: 'delegates', title: `Delegated Access${delegates.length ? ` (${delegates.length})` : ''}` },
            { id: 'templates', title: 'Document Templates' },
            { id: 'messages', title: 'Message Export' },
            { id: 'reset', title: 'Data Reset Center' },
          ].map((s) => (
            <Button key={s.id} label={s.title} size="sm" variant={activeSection === s.id ? 'primary' : 'ghost'} onPress={() => setActiveSection(s.id)} />
          ))}
        </View>
      </ScrollView>

      {activeSection === 'staff' ? (
        <View style={{ gap: t.spacing.md }}>
          <Input value={staffSearch} onChangeText={setStaffSearch} placeholder="Search staff by name or email..." />
          {filteredStaff.map((row) => (
            <Card key={row.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{row.full_name}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{row.email} · {row.role}</Text>
                </View>
                <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'SUSPENDED' ? 'danger' : 'muted'} label={row.status} size="xs" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                {row.status === 'ACTIVE' ? (
                  <Button label="Suspend" size="sm" variant="ghost" onPress={() => suspendUser(row)} disabled={busyUserId === row.id} />
                ) : row.status === 'SUSPENDED' ? (
                  <Button label="Reactivate" size="sm" onPress={() => reactivateUser(row)} disabled={busyUserId === row.id} />
                ) : null}
                <Button label="Reset Password" size="sm" variant="ghost" onPress={() => resetPassword(row)} disabled={busyUserId === row.id} />
                <Button label="Terminate" size="sm" variant="danger" onPress={() => terminateUser(row)} disabled={busyUserId === row.id} />
              </View>
            </Card>
          ))}
        </View>
      ) : activeSection === 'departments' ? (
        departments.length === 0 ? (
          <EmptyState title="No pending departments" description="New department requests will show up here." />
        ) : (
          <View style={{ gap: t.spacing.sm }}>
            {departments.map((d) => (
              <Card key={d.id}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary, marginBottom: t.spacing.sm }}>{d.name}</Text>
                <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                  <Button label="Approve" size="sm" onPress={() => decideDepartment(d, true)} />
                  <Button label="Reject" size="sm" variant="danger" onPress={() => decideDepartment(d, false)} />
                </View>
              </Card>
            ))}
          </View>
        )
      ) : activeSection === 'invites' ? (
        <View style={{ gap: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
            Generate a registration link pre-filled with a department, role, and expiry — with an optional auto-approve to skip HR review.
          </Text>
          <Button label={showInviteForm ? 'Close' : 'Generate Invite Link'} size="sm" icon={<Plus size={13} color={showInviteForm ? t.colors.textSecondary : '#fff'} />} variant={showInviteForm ? 'ghost' : 'primary'} onPress={() => setShowInviteForm((p) => !p)} />

          {showInviteForm ? (
            <Card>
              <Field label="Full Name (optional)"><Input value={inviteForm.fullName} onChangeText={(v) => setInviteForm((p) => ({ ...p, fullName: v }))} placeholder="Full name" /></Field>
              <Field label="Email (optional)"><Input value={inviteForm.email} onChangeText={(v) => setInviteForm((p) => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
              <Field label="Department"><SearchablePicker value={inviteForm.department} onChange={(v) => setInviteForm((p) => ({ ...p, department: v }))} options={INVITE_DEPT_OPTIONS} /></Field>
              <Field label="Role"><SearchablePicker value={inviteForm.role} onChange={(v) => setInviteForm((p) => ({ ...p, role: v }))} options={INVITE_ROLE_OPTIONS} /></Field>
              <Field label="Link Expiry"><SearchablePicker value={inviteForm.expiry} onChange={(v) => setInviteForm((p) => ({ ...p, expiry: v }))} options={INVITE_EXPIRY_OPTIONS} /></Field>
              <View style={{ marginBottom: t.spacing.md }}>
                <Button label={inviteForm.autoApprove ? 'Auto-Approve On Register: ON' : 'Auto-Approve On Register: OFF'} size="sm" variant={inviteForm.autoApprove ? 'primary' : 'ghost'} onPress={() => setInviteForm((p) => ({ ...p, autoApprove: !p.autoApprove }))} />
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.xs }}>
                  {inviteForm.autoApprove ? 'Staff will be automatically approved on registration without HR review.' : 'Staff will require HR review after registering.'}
                </Text>
              </View>
              <Button label="Generate Link" onPress={generateInviteLink} loading={invitesBusy} disabled={invitesBusy} fullWidth />

              {generatedLink ? (
                <View style={{ marginTop: t.spacing.md, padding: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: t.colors.status.success.bg, borderWidth: 1, borderColor: t.colors.status.success.text }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textPrimary, marginBottom: 4 }}>Invite Link Generated:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    <Text style={{ flex: 1, fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }} numberOfLines={2}>{generatedLink}</Text>
                    <Button icon={linkCopied ? <Check size={13} color="#fff" /> : <Copy size={13} color="#fff" />} label="" onPress={copyGeneratedLink} size="sm" />
                  </View>
                </View>
              ) : null}
            </Card>
          ) : null}

          {invites.length === 0 ? (
            <EmptyState title="No pending invites" description="Generated invite links will show up here until used or revoked." />
          ) : (
            invites.map((inv) => (
              <Card key={inv.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{inv.full_name || '—'}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{inv.email || '—'} · {inv.department}</Text>
                  </View>
                  <Badge tone="warning" label={inv.status.toUpperCase()} size="xs" />
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>Expires {new Date(inv.expires_at).toLocaleDateString()}</Text>
                <Button label="Revoke" size="sm" variant="danger" icon={<X size={13} color="#fff" />} onPress={() => revokeInvite(inv)} disabled={invitesBusy} />
              </Card>
            ))
          )}
        </View>
      ) : activeSection === 'delegates' ? (
        <View style={{ gap: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
            Grant specific users access to manage settings on your behalf, scoped to only the sections you choose. Revoke at any time.
          </Text>
          <Button label={showDelegateForm ? 'Close' : 'Add Delegate'} size="sm" icon={<Key size={13} color={showDelegateForm ? t.colors.textSecondary : '#fff'} />} variant={showDelegateForm ? 'ghost' : 'primary'} onPress={() => setShowDelegateForm((p) => !p)} />

          {showDelegateForm ? (
            <Card>
              <Field label="User Email"><Input value={delegateForm.email} onChangeText={(v) => setDelegateForm((p) => ({ ...p, email: v }))} placeholder="user@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
              <Field label="Display Name"><Input value={delegateForm.name} onChangeText={(v) => setDelegateForm((p) => ({ ...p, name: v }))} placeholder="Display name" /></Field>
              <Field label="Expires (optional, YYYY-MM-DD)"><Input value={delegateForm.expiresAt} onChangeText={(v) => setDelegateForm((p) => ({ ...p, expiresAt: v }))} placeholder="2026-12-31" /></Field>
              <SheetSection label="Permissions to Grant">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                  {PERMISSION_SECTIONS.map((sec) => (
                    <Button key={sec.key} label={sec.label} size="sm" variant={delegateForm.permissions.includes(sec.key) ? 'primary' : 'ghost'} onPress={() => togglePermission(sec.key)} />
                  ))}
                </View>
              </SheetSection>
              <Button label="Grant Access" onPress={grantDelegate} loading={delegatesBusy} disabled={delegatesBusy || !delegateForm.email.trim()} fullWidth />
            </Card>
          ) : null}

          {delegates.length === 0 ? (
            <EmptyState title="No active delegates" description="Users granted control access will show up here." />
          ) : (
            delegates.map((d) => (
              <Card key={d.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{d.delegated_to_name}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{d.delegated_to_email}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textSecondary, marginBottom: t.spacing.xs }}>
                  {(d.permissions || []).map((k) => PERMISSION_SECTIONS.find((s) => s.key === k)?.label || k).join(', ') || 'No sections granted'}
                </Text>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
                  {d.expires_at ? `Expires ${new Date(d.expires_at).toLocaleDateString()}` : 'No expiry'}
                </Text>
                <Button label="Revoke" size="sm" variant="danger" icon={<X size={13} color="#fff" />} onPress={() => revokeDelegate(d)} disabled={delegatesBusy} />
              </Card>
            ))
          )}
        </View>
      ) : activeSection === 'templates' ? (
        <DocumentTemplatesEditor updatedBy={profile?.fullName || 'CEO'} />
      ) : activeSection === 'messages' ? (
        <View style={{ gap: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, lineHeight: 16 }}>
            Export a conversation's full message history as CSV. Leave the picker blank to export every conversation. Every export is itself logged to the audit trail.
          </Text>
          <SearchablePicker
            label="Conversation"
            value={exportChannelId}
            onChange={setExportChannelId}
            placeholder="All conversations"
            options={[{ value: '', label: 'All conversations' }, ...exportChannels.map((c) => ({ value: c.id, label: channelExportLabel(c) }))]}
          />
          <Button label="Export CSV" onPress={prepareMessageExport} loading={preparingExport} />
        </View>
      ) : activeSection === 'reset' ? (
        <View style={{ gap: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, lineHeight: 16 }}>
            Permanently delete operational data to start a fresh workflow cycle. Staff accounts and system settings are not affected. This action cannot be undone.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {Object.keys(DEPT_TABLES).filter((d) => d !== 'ALL').map((d) => {
              const cfg = DEPT_TABLES[d];
              return (
                <Button key={d} label={cfg.label} size="sm" variant="ghost" onPress={() => openReset(d)} />
              );
            })}
          </View>
          <Button label="Clear All Data (Full Reset)" variant="danger" fullWidth onPress={() => openReset('ALL')} />
        </View>
      ) : activeSectionDef ? (
        <Card>
          {loading ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Loading…</Text>
          ) : (
            activeSectionDef.fields.map((field) => (
              <AdminSetting key={field.key} field={field} value={settings[field.key]} onChange={(v) => updateSetting(field, v)} />
            ))
          )}
        </Card>
      ) : null}

      {resetDept ? (() => {
        const cfg = DEPT_TABLES[resetDept];
        const ready = resetConfirmText === 'CONFIRM DELETE';
        return (
          <Sheet
            open
            onClose={closeReset}
            title={resetDone ? 'Reset Complete' : `Clear ${cfg.label} Data`}
            subtitle={resetDone ? 'Review results below.' : 'This action is irreversible.'}
            footer={
              !resetDone ? (
                <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                  <Button label="Cancel" variant="ghost" onPress={closeReset} disabled={resetRunning} />
                  <Button label={resetRunning ? 'Deleting…' : `Delete ${cfg.label} Data`} variant="danger" onPress={runReset} disabled={!ready || resetRunning} loading={resetRunning} />
                </View>
              ) : (
                <Button label="Done. Start Fresh Workflow" onPress={closeReset} fullWidth />
              )
            }
          >
            {!resetDone ? (
              <View style={{ gap: t.spacing.md }}>
                <View style={{ backgroundColor: t.colors.status.danger.bg, borderWidth: 1, borderColor: t.colors.status.danger.text, borderRadius: t.radius.sm, padding: t.spacing.sm, gap: 6 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, color: t.colors.status.danger.text, textTransform: 'uppercase' }}>Tables that will be cleared:</Text>
                  {cfg.tables.map((tbl) => (
                    <Text key={tbl.name} style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.status.danger.text }}>• {tbl.label || tbl.name} ({tbl.name})</Text>
                  ))}
                </View>
                <Field label="Type CONFIRM DELETE to unlock the reset button" hint="Case-sensitive, exact match.">
                  <Input value={resetConfirmText} onChangeText={setResetConfirmText} placeholder="CONFIRM DELETE" autoCapitalize="characters" />
                </Field>
              </View>
            ) : (
              <View style={{ gap: t.spacing.sm }}>
                {resetResults.map((r) => {
                  const matched = cfg.tables.find((t2) => t2.name === r.table);
                  const displayLabel = matched ? `${matched.label} (${r.table})` : r.table;
                  return (
                    <View key={r.table} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: r.error ? t.colors.status.danger.bg : t.colors.status.success.bg }}>
                      <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: r.error ? t.colors.status.danger.text : t.colors.status.success.text }} numberOfLines={2}>{displayLabel}</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: r.error ? t.colors.status.danger.text : t.colors.status.success.text }}>{r.error ? `Error: ${r.error}` : '✓ Cleared'}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Sheet>
        );
      })() : null}

      <ExportSheet
        open={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        title="Messenger Export"
        data={exportRows}
        columns={[
          { key: 'channel_id', label: 'Channel' },
          { key: 'sender', label: 'Sender' },
          { key: 'content', label: 'Content' },
          { key: 'time', label: 'Time' },
          { key: 'created_at', label: 'Created At' },
          { key: 'attachment_type', label: 'Attachment Type' },
        ]}
      />
    </Screen>
  );
}
