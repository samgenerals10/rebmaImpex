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
// Mobile Parity Audit follow-up: hr_can_invite_staff,
// mobile_app_access_allowed, and messaging_access_allowed were confirmed
// missing from this screen even though mobile itself enforces the latter
// two elsewhere (authStore.ts login gate, lib/messenger.ts send gate) —
// added below as plain toggles.
//
// Per-person exceptions (spreadsheets_enabled, mobile_app_access_allowed,
// messaging_access_allowed) are managed here too, via FeatureExceptions,
// same table and rules as web's SettingToggleWithException.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Linking, Image } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { ShieldAlert, Copy, Check, X, Key, Plus, Pause, Play, KeyRound, UserX, Eye, EyeOff, Crown, Mail, Ban, ShieldCheck, LogOut, Lock } from 'lucide-react-native';
import { verifyMyPassword } from '../../lib/verifyPassword';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabaseClient';
import { newSecureToken } from '../../lib/secureToken';
import { getCeoSetting, setCeoSetting } from '../../lib/ceoSetting';
import { callPrivilegedApi, ApiNotConfiguredError, isPrivilegedApiConfigured } from '../../lib/apiBase';
import { kickUserOffline } from '../../lib/presence';
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
import Toggle from '../../components/ui/Toggle';
import IconActionButton from '../../components/ui/IconActionButton';
import DocumentTemplatesEditor from '../../components/shared/DocumentTemplatesEditor';
import ExportSheet from '../../components/shared/ExportSheet';
import PasswordConfirmSheet from '../../components/shared/PasswordConfirmSheet';

export type SettingField =
  | { key: string; label: string; description?: string; kind: 'bool'; defaultOn?: boolean; withExceptions?: boolean }
  | { key: string; label: string; description?: string; kind: 'text'; placeholder?: string }
  | { key: string; label: string; description?: string; kind: 'number' }
  | { key: string; label: string; description?: string; kind: 'select'; options: { value: string; label: string }[] };

export interface Section { id: string; title: string; fields: SettingField[] }

// Exported so the CEO-only Help Assistant (lib/helpKnowledgeBase.ts) can
// build its Control Center answers directly from this real list — one
// source of truth, no hand-copied duplicate that could drift out of sync
// with the actual settings as they change.
export const SECTIONS: Section[] = [
  {
    id: 'access', title: 'Access Control', fields: [
      { key: 'app_master_switch', label: 'App Master Switch', kind: 'bool' },
      { key: 'registrations_allowed', label: 'Registrations Allowed', kind: 'bool' },
      { key: 'invitation_only', label: 'Invitation Only', kind: 'bool' },
      { key: 'hr_can_invite_staff', label: 'HR Can Invite Staff', kind: 'bool' },
      { key: 'mobile_app_access_allowed', label: 'Mobile App Access Allowed', description: 'Master switch for who can sign in on the phone app. Exceptions below override it for named people.', kind: 'bool', withExceptions: true },
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
      { key: 'finance_needs_ceo_cosign', label: 'Account Department Needs CEO Co-Sign', kind: 'bool' },
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
      { key: 'messaging_access_allowed', label: 'Messaging Access Allowed', description: 'Master switch for Messages. Exceptions below override it for named people.', kind: 'bool', withExceptions: true },
      { key: 'messenger_calls_enabled', label: 'Voice/Video Calls Enabled', kind: 'bool' },
      { key: 'messenger_attachments_enabled', label: 'Attachments Enabled', kind: 'bool' },
      { key: 'meeting_recording_allowed', label: 'Meeting Recording Allowed', description: 'When off, hosts cannot start a local recording in Boardroom or Meetings.', kind: 'bool' },
      { key: 'chat_suspension_allowed', label: 'Chat Suspension Allowed', description: 'When off, no one (including yourself) can suspend an open DM.', kind: 'bool' },
      { key: 'message_retention_days', label: 'Message Retention (days, 0 = off)', kind: 'number' },
      { key: 'external_email_enabled', label: 'External Email Enabled', kind: 'bool' },
      { key: 'whatsapp_enabled', label: 'WhatsApp Enabled', kind: 'bool' },
      { key: 'payment_reminders_enabled', label: 'Payment Reminders Enabled', kind: 'bool' },
      { key: 'announcements_ceo_only', label: 'Announcements CEO-Only', kind: 'bool' },
    ],
  },
  {
    id: 'system', title: 'System Controls', fields: [
      { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Confirm before enabling. It blocks normal app use.', kind: 'bool' },
      { key: 'session_timeout_minutes', label: 'Session Timeout (minutes)', kind: 'number' },
      { key: 'force_2fa_management', label: 'Force 2FA for Management', kind: 'bool' },
      { key: 'force_2fa_finance', label: 'Force 2FA for Account Department', kind: 'bool' },
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
  // Ported from rebma-web's CeoControlCenter.tsx "Section 10 — Risk
  // Controls" — was missing from this array entirely (confirmed by
  // grep before writing the plan for this fix). Both fields transcribed
  // verbatim from web's own <SettingToggle> descriptions.
  {
    id: 'birthdays', title: 'Birthday Wishes', fields: [
      { key: 'birthday_wishes_enabled', label: 'Birthday Wishes Allowed', description: 'Master switch. When off, no birthday wishes go out at all, automatic or by hand. HR writes the messages and runs the sending under HR, then Birthdays.', kind: 'bool', defaultOn: true },
    ],
  },
  {
    id: 'risk', title: 'Risk Controls', fields: [
      { key: 'risk_customer_verification_required', label: 'Customer Verification Required', description: 'Customer verification is non-blocking by design, so a pending customer can still be ordered for. This only controls whether Risk treats verification as mandatory, not any order transition.', kind: 'bool' },
      { key: 'risk_credit_hold_notify_marketing', label: 'Notify Marketing on Credit Hold', description: 'When ON, Marketing is notified whenever Risk puts a customer on credit hold.', kind: 'bool' },
    ],
  },
  {
    id: 'spreadsheets', title: 'Spreadsheets Control', fields: [
      { key: 'spreadsheets_enabled', label: 'Spreadsheets Enabled', description: 'Master switch for Spreadsheets. Exceptions below override it for named people.', kind: 'bool', withExceptions: true },
    ],
  },
];

const ALL_KEYS = Array.from(new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key))));

interface StaffRow { id: string; full_name: string; email: string; role: string; status: string; is_admin?: boolean }
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
  FINANCE: { label: 'Account Department', tables: [
    { name: 'finance_payments', label: 'Accounts Payments (Receipts)' },
    { name: 'finance_expenses', label: 'Accounts Expenses' },
    { name: 'finance_cheques', label: 'Accounts Cheques' },
    { name: 'finance_petty_cash', label: 'Accounts Petty Cash' },
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
    { name: 'finance_payments', label: 'Accounts Payments (Receipts)' }, { name: 'finance_expenses', label: 'Accounts Expenses' }, { name: 'finance_cheques', label: 'Accounts Cheques' }, { name: 'finance_petty_cash', label: 'Accounts Petty Cash' }, { name: 'recurring_payments', label: 'Recurring Payments' }, { name: 'finance_report_history', label: 'Financial Statements & Reports History' },
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

// Every third-party credential the app can use, in one place — the same
// idea as the "enter your API key" screen in any other software product.
// Stored in the same ceo_settings key/value table every other CEO
// setting already lives in (getCeoSetting/setCeoSetting), so nothing new
// to migrate. Each consumer (FleetMap's basemap, the attendance webhook,
// etc.) reads its own key directly via getCeoSetting and falls back to
// its existing free/manual behavior when the key is empty — entering one
// here takes effect on that consumer's very next read, no separate
// "wire it up" step.
// `plain: true` = not a secret (shown unmasked, no reveal toggle).
// Each company's real logo (copied from its own website), shown beside its
// key. rebma = our own logo-mark, for keys that belong to the app itself.
const API_KEY_LOGOS: Record<string, any> = {
  rebma: require('../../assets/logo-mark.png'),
  gmail: require('../../assets/brand-logos/gmail.png'),
  googleplay: require('../../assets/brand-logos/googleplay.png'),
  resend: require('../../assets/brand-logos/resend.png'),
  arkesel: require('../../assets/brand-logos/arkesel.png'),
  expo: require('../../assets/brand-logos/expo.png'),
  maptiler: require('../../assets/brand-logos/maptiler.png'),
  barcodelookup: require('../../assets/brand-logos/barcodelookup.png'),
  supabase: require('../../assets/brand-logos/supabase.png'),
};

const API_KEY_DEFS: { key: string; label: string; description: string; placeholder: string; plain?: boolean; provider?: string; providerUrl?: string; logo?: string }[] = [
  {
    key: 'app_web_address',
    logo: 'rebma',
    label: 'App Web Address',
    description: 'The address people open the web app at. Links in invite emails and texts point here.',
    placeholder: 'https://rebma-impex.vercel.app',
    plain: true,
  },
  {
    key: 'gmail_address',
    logo: 'gmail',
    provider: 'Google, create a Gmail account',
    providerUrl: 'https://accounts.google.com/signup',
    label: 'Email (Gmail): Address',
    description: 'The free way to send email with no domain to buy. The Gmail address emails come from, for example rebmaimpex@gmail.com. When this and the app password below are both filled in, all email goes through Gmail (about 500 a day) and the Resend fields are not used.',
    placeholder: 'yourcompany@gmail.com',
    plain: true,
  },
  {
    key: 'gmail_app_password',
    logo: 'gmail',
    provider: 'Google, app passwords',
    providerUrl: 'https://myaccount.google.com/apppasswords',
    label: 'Email (Gmail): App Password',
    description: 'Not your normal Gmail password. In that Google account, turn on 2-Step Verification, then open myaccount.google.com/apppasswords, create one named Rebma, and paste the 16 letters here.',
    placeholder: 'Paste the 16-letter app password',
  },
  {
    key: 'api_key_resend',
    logo: 'resend',
    provider: 'Resend',
    providerUrl: 'https://resend.com/api-keys',
    label: 'Email (Resend)',
    description: 'Only needed if you are not using Gmail above. Your Resend API key, from resend.com (free plan: 3,000 emails a month). Resend only delivers to other people once a company domain you own is verified in your Resend account.',
    placeholder: 'Paste your Resend API key (starts with re_)',
  },
  {
    key: 'email_from_address',
    logo: 'resend',
    provider: 'Resend, domains',
    providerUrl: 'https://resend.com/domains',
    label: 'Email "From" Address',
    description: 'Who emails come from. Resend only (Gmail always sends from the Gmail address). Must be on the domain you verified in Resend. Leave empty to use Resend\'s test sender, which only reaches your own address.',
    placeholder: 'Rebma Impex <hr@yourcompany.com>',
    plain: true,
  },
  {
    key: 'api_key_arkesel',
    logo: 'arkesel',
    provider: 'Arkesel',
    providerUrl: 'https://arkesel.com',
    label: 'SMS (Arkesel): API Key',
    description: 'Sends every text message: invites, approval notices and birthday wishes. No phone needed. Sign up free at arkesel.com, top up a little (about GHS 0.02 per text, so GHS 10 sends around 500), then copy the API key from your Arkesel dashboard and paste it here.',
    placeholder: 'Paste your Arkesel API key',
  },
  {
    key: 'sms_sender_id',
    logo: 'arkesel',
    provider: 'Arkesel, sender names',
    providerUrl: 'https://arkesel.com',
    label: 'SMS Sender Name',
    description: 'The name people see the text come from, up to 11 letters. Request it in your Arkesel account first (they approve it, usually within a day or two). Leave empty to use REBMA.',
    placeholder: 'REBMA',
    plain: true,
  },
  {
    key: 'app_download_url',
    logo: 'googleplay',
    provider: 'Google Play Console',
    providerUrl: 'https://play.google.com/console',
    label: 'Mobile App Download Link',
    description: 'Your private Google Play link for the Rebma app. Every staff invite email and WhatsApp message includes it as step 1, before the registration link. Leave empty and invites only carry the registration link.',
    placeholder: 'https://play.google.com/store/apps/details?id=...',
    plain: true,
  },
  {
    key: 'api_key_push_webhook_secret',
    logo: 'supabase',
    label: 'Push Notifications: Webhook Secret',
    description: 'A password you make up (long and random). Supabase sends it each time it asks the app to buzz a phone. Put the same value in your Supabase webhook (Database, then Webhooks) as the header x-webhook-secret. Leave empty to keep using the one set in Vercel.',
    placeholder: 'Make up a long random value and paste it here',
  },
  {
    key: 'api_key_expo_access_token',
    logo: 'expo',
    provider: 'Expo, access tokens',
    providerUrl: 'https://expo.dev/settings/access-tokens',
    label: 'Push Notifications (Expo): Access Token (optional)',
    description: 'Phone push notifications go through Expo for free and work without this. Only needed if you turn on Enhanced Security for Push Notifications in your Expo project. Create a token in your Expo account and paste it here.',
    placeholder: 'Paste your Expo access token',
  },
  {
    key: 'api_key_maptiler',
    logo: 'maptiler',
    provider: 'MapTiler',
    providerUrl: 'https://cloud.maptiler.com/account/keys/',
    label: 'Map Tiles (MapTiler)',
    description: 'Gives every live map (Fleet Tracking, driver screens) a modern, styled basemap instead of the plain default OpenStreetMap look. Leave empty and the map keeps working on free OpenStreetMap tiles.',
    placeholder: 'Paste your MapTiler API key',
  },
  {
    key: 'api_key_connector',
    logo: 'rebma',
    label: 'Attendance Connector Key',
    description: 'A password you make up for the connector program that runs on the office PC next to SDK and pull-mode attendance devices. Put the same value in its config.json as connectorKey. It lets the connector fetch the device list from the app, so devices you add under HR, then Attendance are picked up automatically.',
    placeholder: 'Make up a long random value and paste it here',
  },
  {
    key: 'api_key_attendance_webhook_secret',
    logo: 'rebma',
    label: 'Attendance Webhook Secret (fallback)',
    description: 'Only for a device that was never added under HR, then Attendance, then Add Device. Every added device gets its own secret there, which always takes priority. Most setups can leave this empty.',
    placeholder: 'Paste the webhook secret',
  },
  {
    key: 'api_key_scanner_lookup',
    logo: 'barcodelookup',
    provider: 'Barcode Lookup',
    providerUrl: 'https://www.barcodelookup.com/api',
    label: 'Barcode / Product Lookup (optional)',
    description: 'A Barcode Lookup (barcodelookup.com) API key. When set, scanning a real product barcode that is not a REBMA waybill shows its name, brand, and image. The built-in QR/waybill scanner already works fully without this.',
    placeholder: 'Paste your Barcode Lookup API key',
  },
];

const INVITE_DEPT_OPTIONS = [
  ...['MARKETING', 'HR', 'PRODUCTION', 'RECEPTION', 'MANAGEMENT', 'RISK'].map((d) => ({ value: d, label: d })),
  { value: 'FINANCE', label: 'ACCOUNTS DEPARTMENT' },
  { value: 'admin_warehouse', label: 'ADMIN & WAREHOUSE' },
];
const INVITE_ROLE_OPTIONS = ['staff', 'supervisor', 'manager'].map((r) => ({ value: r, label: r }));
const INVITE_EXPIRY_OPTIONS = [{ value: '24h', label: '24 hours' }, { value: '48h', label: '48 hours' }, { value: '7d', label: '7 days' }];

// Saves when the box loses focus rather than on every keystroke.
function TextSetting({ value, placeholder, onSave }: { value: any; placeholder?: string; onSave: (v: string) => void }) {
  const t = useTheme();
  const [draft, setDraft] = useState<string>(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  return (
    <View style={{ marginTop: t.spacing.sm }}>
      <Input
        value={draft}
        onChangeText={setDraft}
        onBlur={() => { if (draft !== (value ?? '')) onSave(draft); }}
        placeholder={placeholder}
        multiline
        numberOfLines={3}
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />
    </View>
  );
}

// Per-person overrides of a master switch, stored in ceo_feature_exceptions
// (same table and rules as the laptop's Control Center). Allow lets that
// person in even when the switch is off; Block keeps them out even when
// it is on.
function FeatureExceptions({ featureKey }: { featureKey: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ user_email: string; allowed: boolean }[]>([]);
  const [email, setEmail] = useState('');
  const [allow, setAllow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('ceo_feature_exceptions').select('user_email, allowed').eq('feature_key', featureKey)
      .then(({ data }) => setRows((data as any) || []), () => {});
  }, [open, featureKey]);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { Alert.alert('Exceptions', 'Enter a valid email address.'); return; }
    setBusy(true);
    const { error } = await supabase.from('ceo_feature_exceptions')
      .upsert([{ feature_key: featureKey, user_email: e, allowed: allow }], { onConflict: 'feature_key,user_email' });
    setBusy(false);
    if (error) { Alert.alert('Exceptions', error.message); return; }
    setRows((prev) => [...prev.filter((r) => r.user_email !== e), { user_email: e, allowed: allow }]);
    setEmail('');
  };

  const remove = async (e: string) => {
    const { error } = await supabase.from('ceo_feature_exceptions').delete().eq('feature_key', featureKey).eq('user_email', e);
    if (error) { Alert.alert('Exceptions', error.message); return; }
    setRows((prev) => prev.filter((r) => r.user_email !== e));
  };

  return (
    <View style={{ marginTop: t.spacing.sm }}>
      <Button variant="ghost" size="sm" icon={<Key size={13} color={t.colors.accent} />} label={open ? 'Hide people exceptions' : 'Manage people exceptions'} onPress={() => setOpen((v) => !v)} />
      {open && (
        <View style={{ marginTop: t.spacing.sm, gap: t.spacing.sm }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
            Allow lets that person in even when the switch is off. Block keeps them out even when it is on.
          </Text>
          <Input value={email} onChangeText={setEmail} placeholder="person@company.com" autoCapitalize="none" keyboardType="email-address" />
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}><Button size="sm" label="Block" variant={!allow ? 'primary' : 'ghost'} onPress={() => setAllow(false)} /></View>
            <View style={{ flex: 1 }}><Button size="sm" label="Allow" variant={allow ? 'primary' : 'ghost'} onPress={() => setAllow(true)} /></View>
          </View>
          <Button size="sm" icon={<Plus size={13} color={t.colors.onAccent} />} label="Add exception" onPress={add} loading={busy} disabled={busy || !email.trim()} />
          {rows.length === 0 ? (
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>No exceptions yet.</Text>
          ) : rows.map((r) => (
            <View key={r.user_email} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{r.user_email}</Text>
              <Badge tone={r.allowed ? 'success' : 'danger'} label={r.allowed ? 'Allow' : 'Block'} />
              <Button variant="ghost" size="sm" icon={<X size={13} color={t.colors.textSecondary} />} label="Remove" onPress={() => remove(r.user_email)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

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
          <Toggle value={!!(value ?? field.defaultOn)} onChange={onChange} />
        )}
      </View>
      {field.kind === 'bool' && field.withExceptions && <FeatureExceptions featureKey={field.key} />}
      {field.kind === 'text' && <TextSetting value={value} placeholder={field.placeholder} onSave={onChange} />}
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
  // API Keys — one flat store of key -> saved value, plus a separate
  // in-progress draft per row (so typing in one field doesn't touch the
  // saved value until Save is actually pressed) and per-row reveal/save
  // state, matching a normal "enter your API key" settings page.
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  // API keys stay locked until the CEO types their password again. Nothing
  // is read from the database until then, and they lock after 10 minutes.
  const [keysUnlocked, setKeysUnlocked] = useState(false);
  const [keysPw, setKeysPw] = useState('');
  const [keysPwError, setKeysPwError] = useState('');
  const [checkingKeysPw, setCheckingKeysPw] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null);
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

  // CEO Account (approved Part A). Every action here needs the CEO's
  // password, checked on the server (api/_shared/reauth.ts).
  type StatusAction = 'suspend' | 'reactivate' | 'block' | 'unblock';
  type PasswordAction =
    | { kind: 'changeEmail'; newEmail: string }
    | { kind: 'coCeo'; fullName: string; email: string; phone: string }
    | { kind: 'terminate'; row: StaffRow }
    | { kind: 'status'; row: StaffRow; action: StatusAction }
    | { kind: 'removeRequest'; target: StaffRow; reason: string }
    | { kind: 'removalDecision'; request: RemovalRequest; decision: 'approve' | 'reject' };
  const [passwordAction, setPasswordAction] = useState<PasswordAction | null>(null);

  // Removing a CEO needs two CEOs: one asks, a different one decides.
  type RemovalRequest = { id: string; target_id: string; target_name: string | null; requested_by: string; requested_by_name: string | null; reason: string | null; created_at: string };
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [removeTarget, setRemoveTarget] = useState<StaffRow | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const loadRemovalRequests = useCallback(async () => {
    const { data } = await (supabase.from('ceo_removal_requests' as any) as any).select('id, target_id, target_name, requested_by, requested_by_name, reason, created_at').eq('status', 'pending').order('created_at', { ascending: false });
    setRemovalRequests((data as any) || []);
  }, []);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [coCeoOpen, setCoCeoOpen] = useState(false);
  const [coCeoForm, setCoCeoForm] = useState({ fullName: '', email: '', phone: '' });
  const [coCeoResult, setCoCeoResult] = useState<{ message: string; link: string } | null>(null);
  const [ceoInvites, setCeoInvites] = useState<{ id: string; full_name: string | null; email: string | null; expires_at: string }[]>([]);

  const loadCeoInvites = useCallback(async () => {
    const { data } = await supabase.from('staff_invites').select('id, full_name, email, expires_at').eq('department', 'CEO').eq('status', 'pending').order('created_at', { ascending: false });
    setCeoInvites((data as any) || []);
  }, []);


  // Invite Links (D96)
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', phone: '', department: 'MARKETING', role: 'staff', expiry: '24h', autoApprove: false });
  const [generatedLink, setGeneratedLink] = useState('');
  // What happened when the link was sent by email / SMS, so the CEO is
  // never told it went out when it didn't.
  const [inviteDelivery, setInviteDelivery] = useState('');
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
  const [resetPw, setResetPw] = useState('');
  const [resetError, setResetError] = useState('');

  const loadSettings = useCallback(async () => {
    const results = await Promise.all(ALL_KEYS.map((k) => getCeoSetting(k, null)));
    const map: Record<string, any> = {};
    ALL_KEYS.forEach((k, i) => { map[k] = results[i]; });
    setSettings(map);
    setLoading(false);
  }, []);

  const loadApiKeys = useCallback(async () => {
    const results = await Promise.all(API_KEY_DEFS.map((d) => getCeoSetting<string>(d.key, '')));
    const map: Record<string, string> = {};
    API_KEY_DEFS.forEach((d, i) => { map[d.key] = results[i] || ''; });
    setApiKeys(map);
  }, []);

  const unlockKeys = async () => {
    setCheckingKeysPw(true);
    setKeysPwError('');
    const r = await verifyMyPassword(keysPw);
    setCheckingKeysPw(false);
    setKeysPw('');
    if (!r.ok) { setKeysPwError(r.error || 'That password is not right.'); return; }
    setKeysUnlocked(true);
    loadApiKeys();
  };
  const lockKeys = () => { setKeysUnlocked(false); setApiKeys({}); setApiKeyDrafts({}); setRevealedKeys({}); };
  useEffect(() => {
    if (!keysUnlocked) return;
    const timer = setTimeout(lockKeys, 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [keysUnlocked]);

  const loadStaffAndDepts = useCallback(async () => {
    const [{ data: staffRows }, { data: deptRows }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, status, is_admin').neq('status', 'TERMINATED').order('created_at', { ascending: false }),
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
    loadCeoInvites();
    loadRemovalRequests();
  }, [isAdmin, loadSettings, loadStaffAndDepts, loadInvitesAndDelegates, loadCeoInvites, loadRemovalRequests]);

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
        action: `EXPORT: Messenger history, ${exportChannelId ? channelExportLabel(exportChannels.find((c) => c.id === exportChannelId)!) : 'All conversations'} (${rows.length} messages)`,
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

  const saveApiKey = async (key: string) => {
    const draft = (apiKeyDrafts[key] ?? '').trim();
    setSavingApiKey(key);
    try {
      await setCeoSetting(key, draft);
      setApiKeys((prev) => ({ ...prev, [key]: draft }));
      setApiKeyDrafts((prev) => { const next = { ...prev }; delete next[key]; return next; });
      setRevealedKeys((prev) => ({ ...prev, [key]: false }));
    } catch (e: any) {
      Alert.alert('Could Not Save', e.message || 'Something went wrong saving that key.');
    } finally {
      setSavingApiKey(null);
    }
  };

  const clearApiKey = (def: { key: string; label: string }) => {
    Alert.alert('Remove This Key?', `${def.label} will fall back to its default free/manual behavior.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveApiKeyValue(def.key, '') },
    ]);
  };

  const saveApiKeyValue = async (key: string, value: string) => {
    setSavingApiKey(key);
    try {
      await setCeoSetting(key, value);
      setApiKeys((prev) => ({ ...prev, [key]: value }));
      setApiKeyDrafts((prev) => { const next = { ...prev }; delete next[key]; return next; });
    } finally {
      setSavingApiKey(null);
    }
  };

  // Suspend / Reactivate / Block / Unblock go through the server
  // (api/set-user-status.ts), which checks the password, locks or unlocks
  // sign-in, ends open sessions and logs it. The database itself now
  // refuses a status change made straight from the app.
  const changeStatus = (row: StaffRow, action: StatusAction) => setPasswordAction({ kind: 'status', row, action });

  const kickUser = (row: StaffRow) => {
    Alert.alert('Kick offline', `Sign ${row.full_name} out of every device now? They can sign in again unless you also suspend or block them.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick offline', style: 'destructive', onPress: async () => {
          setBusyUserId(row.id);
          try {
            const res: any = await callPrivilegedApi('/api/kick-user', { userId: row.id });
            kickUserOffline(row.id);
            Alert.alert('Signed out', res?.message || `${row.full_name} has been signed out.`);
          } catch (e: any) {
            Alert.alert('Failed', e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'Could not sign them out.'));
          } finally {
            setBusyUserId(null);
          }
        },
      },
    ]);
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

  // Terminate takes effect at once and deletes nothing: all their work
  // stays in the system (api/terminate-user.ts).
  const terminateUser = (row: StaffRow) => setPasswordAction({ kind: 'terminate', row });

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
      case 'terminate': return `Terminate ${a.row.full_name}? They can no longer sign in. Nothing is deleted: all their work stays in the system.${tail}`;
      case 'changeEmail': return `Change your sign-in email to ${a.newEmail}?${tail}`;
      case 'coCeo': return `Invite ${a.fullName} (${a.email}) as a co-CEO?${tail}`;
      case 'status': return `${STATUS_WORDING[a.action].verb} ${a.row.full_name}? ${STATUS_WORDING[a.action].effect}${tail}`;
      case 'removeRequest': return `Ask to remove ${a.target.full_name} as CEO? A different CEO must approve it.${tail}`;
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

  // Cancelling your own removal request needs no password: it only
  // withdraws something you asked for.
  const cancelRemoval = (request: RemovalRequest) => {
    Alert.alert('Cancel request', `Withdraw your request to remove ${request.target_name || 'this CEO'}?`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Withdraw', onPress: async () => {
          try {
            const res: any = await callPrivilegedApi('/api/ceo-removal', { action: 'cancel', requestId: request.id });
            Alert.alert('Withdrawn', res?.message || 'Request cancelled.');
            loadRemovalRequests();
          } catch (e: any) {
            Alert.alert('Failed', e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'Could not cancel it.'));
          }
        },
      },
    ]);
  };

  // Runs the pending high-risk action with the password the CEO typed.
  // Errors are thrown back to PasswordConfirmSheet, which shows them and
  // stays open so a wrong password can be retried.
  const runPasswordAction = async (password: string) => {
    const action = passwordAction;
    if (!action) return;
    try {
      if (action.kind === 'terminate') {
        const res: any = await callPrivilegedApi('/api/terminate-user', { userId: action.row.id, password });
        setPasswordAction(null);
        Alert.alert('Terminated', res?.message || `User ${action.row.full_name} terminated.`);
        await loadStaffAndDepts();
      } else if (action.kind === 'changeEmail') {
        const res: any = await callPrivilegedApi('/api/ceo-change-email', { newEmail: action.newEmail, password });
        setPasswordAction(null);
        setChangeEmailOpen(false);
        setNewEmail('');
        Alert.alert('Check the new email', res?.message || 'A confirmation link was sent to the new address.');
      } else if (action.kind === 'coCeo') {
        const res: any = await callPrivilegedApi('/api/ceo-invite-co-ceo', { fullName: action.fullName, email: action.email, phone: action.phone, password });
        setPasswordAction(null);
        setCoCeoOpen(false);
        setCoCeoForm({ fullName: '', email: '', phone: '' });
        setCoCeoResult({ message: res?.message || 'Invite sent.', link: res?.link || '' });
        loadCeoInvites();
      } else if (action.kind === 'status') {
        const res: any = await callPrivilegedApi('/api/set-user-status', { userId: action.row.id, action: action.action, password });
        setPasswordAction(null);
        // Suspend and Block also close any screen they still have open.
        if (action.action === 'suspend' || action.action === 'block') kickUserOffline(action.row.id);
        Alert.alert('Done', res?.message || 'Status updated.');
        await loadStaffAndDepts();
      } else if (action.kind === 'removeRequest') {
        const res: any = await callPrivilegedApi('/api/ceo-removal', { action: 'request', targetId: action.target.id, reason: action.reason, password });
        setPasswordAction(null);
        setRemoveReason('');
        Alert.alert('Request sent', res?.message || 'Another CEO must approve it.');
        loadRemovalRequests();
      } else {
        const res: any = await callPrivilegedApi('/api/ceo-removal', { action: action.decision, requestId: action.request.id, password });
        setPasswordAction(null);
        Alert.alert(action.decision === 'approve' ? 'CEO removed' : 'Request rejected', res?.message || 'Done.');
        loadRemovalRequests();
        loadStaffAndDepts();
      }
    } catch (e: any) {
      throw new Error(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));
    }
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

      setInviteDelivery('');
      if (isPrivilegedApiConfigured()) {
        const base = process.env.EXPO_PUBLIC_API_BASE_URL || '';
        setGeneratedLink(`${base}/register?token=${token}`);
        // Send the link to the person by email and SMS, whichever details
        // were given. The server builds the link itself, so the message
        // always carries the real web address.
        const channels = [email ? 'email' : null, phone ? 'sms' : null].filter(Boolean) as string[];
        if (channels.length) {
          try {
            const res: any = await callPrivilegedApi('/api/send-staff-invite-email', { inviteId: created.id, channels });
            if (res?.link) setGeneratedLink(res.link);
            setInviteDelivery(res?.message || 'Nothing was sent.');
          } catch (sendErr: any) {
            setInviteDelivery(`The link was created but not sent: ${sendErr?.message || 'unknown error'}`);
          }
        } else {
          setInviteDelivery('No email or phone was given, so nothing was sent. Copy the link below and share it yourself.');
        }
      } else {
        setGeneratedLink('');
        Alert.alert('Not Configured', "The registration link's base URL isn't set yet, so the link could not be shown or sent from the phone. Ask an admin to set EXPO_PUBLIC_API_BASE_URL. The invite was still created and can be sent from the web app.");
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
  // Runs on the server now (api/data-reset.ts): CEO only, the password is
  // checked there, the table list there is the one that counts, and the
  // stock safeguard (sold quantities put back before the sale records go)
  // runs there too. The counts shown are the server's real counts.
  const openReset = (dept: string) => {
    setResetDept(dept);
    setResetConfirmText('');
    setResetPw('');
    setResetError('');
    setResetResults([]);
    setResetDone(false);
  };

  const closeReset = () => { if (resetRunning) return; setResetDept(null); setResetPw(''); };

  const runReset = async () => {
    if (resetConfirmText !== 'CONFIRM DELETE' || !resetDept) return;
    if (!resetPw) { setResetError('Enter your password.'); return; }
    setResetRunning(true);
    setResetError('');
    try {
      const res: any = await callPrivilegedApi('/api/data-reset', { department: resetDept, confirmText: resetConfirmText, password: resetPw });
      setResetResults(res?.results || []);
      setResetDone(true);
      setResetPw('');
    } catch (e: any) {
      setResetError(e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'The reset did not run.'));
    } finally {
      setResetRunning(false);
    }
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

  // CEO accounts are never acted on from this list (no CEO acts on himself
  // or on another CEO); they're shown under CEO Account instead.
  const ceoAccounts = staff.filter((s) => s.is_admin);
  const filteredStaff = staff.filter((s) => !s.is_admin).filter((s) => !staffSearch || s.full_name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.email?.toLowerCase().includes(staffSearch.toLowerCase()));
  const activeSectionDef = SECTIONS.find((s) => s.id === activeSection);

  return (
    <Screen refreshing={false} onRefresh={() => { loadSettings(); loadStaffAndDepts(); }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
          {[
            { id: 'ceo', title: 'CEO Account' },
            ...SECTIONS.map((s) => ({ id: s.id, title: s.title })),
            { id: 'staff', title: 'Staff' },
            { id: 'departments', title: 'Departments' },
            { id: 'invites', title: 'Invite Links' },
            { id: 'delegates', title: 'Delegated Access' },
            { id: 'keys', title: 'API Keys' },
            { id: 'templates', title: 'Document Templates' },
            { id: 'messages', title: 'Message Export' },
            { id: 'reset', title: 'Data Reset Center' },
          ].map((s) => (
            <Button key={s.id} label={s.title} size="sm" variant={activeSection === s.id ? 'primary' : 'ghost'} onPress={() => setActiveSection(s.id)} />
          ))}
        </View>
      </ScrollView>

      {activeSection === 'ceo' ? (
        <View style={{ gap: t.spacing.md }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
              <Mail size={16} color={t.colors.accent} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Your sign-in email</Text>
            </View>
            <Text selectable style={{ fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{profile?.email || ''}</Text>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: 4, marginBottom: t.spacing.sm }}>
              This is the CEO email. To change it you type your password, then confirm from a link sent to the new address.
            </Text>
            <View style={{ alignItems: 'flex-start' }}>
              <Button label="Change email" size="sm" variant="ghost" onPress={() => { setNewEmail(''); setChangeEmailOpen(true); }} />
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
              <Crown size={16} color={t.colors.action.amber} />
              <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>CEOs</Text>
              <Button label="Add Co-CEO" size="sm" icon={<Plus size={12} color="#fff" />} onPress={() => { setCoCeoForm({ fullName: '', email: '', phone: '' }); setCoCeoOpen(true); }} />
            </View>
            {ceoAccounts.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{c.full_name}{c.id === profile?.id ? ' (you)' : ''}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{c.email}</Text>
                </View>
                <Badge tone={c.status === 'ACTIVE' ? 'success' : 'muted'} label={c.status} size="xs" />
                {c.id !== profile?.id && c.status === 'ACTIVE' && !removalRequests.some((r) => r.target_id === c.id) && (
                  <IconActionButton icon={UserX} tone="danger" accessibilityLabel={`Request removal of ${c.full_name}`} onPress={() => { setRemoveReason(''); setRemoveTarget(c); }} />
                )}
              </View>
            ))}
            {ceoInvites.map((inv) => (
              <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{inv.full_name || inv.email}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>Invited, not registered yet. Link expires {new Date(inv.expires_at).toLocaleDateString()}.</Text>
                </View>
                <Badge tone="warning" label="INVITED" size="xs" />
              </View>
            ))}
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>
              A co-CEO registers in the app with the link they receive, then you approve them in Approvals (with your password). Until then they have no access.
            </Text>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.xs }}>
              <ShieldAlert size={16} color={t.colors.status.danger.text} />
              <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>CEO removal requests</Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
              Removing a CEO needs two CEOs. One asks, and a different CEO approves or rejects it. Every step is logged by name.
            </Text>
            {removalRequests.length === 0 ? (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>No requests waiting.</Text>
            ) : removalRequests.map((r) => {
              const mine = r.requested_by === profile?.id;
              return (
                <View key={r.id} style={{ paddingVertical: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border, gap: 6 }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Remove {r.target_name || 'a CEO'}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                    Asked by {mine ? 'you' : (r.requested_by_name || 'another CEO')} on {new Date(r.created_at).toLocaleDateString()}.{r.reason ? ` Reason: ${r.reason}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                    {mine ? (
                      <Button label="Withdraw" size="sm" variant="ghost" onPress={() => cancelRemoval(r)} />
                    ) : (
                      <>
                        <Button label="Approve" size="sm" variant="danger" onPress={() => setPasswordAction({ kind: 'removalDecision', request: r, decision: 'approve' })} />
                        <Button label="Reject" size="sm" variant="ghost" onPress={() => setPasswordAction({ kind: 'removalDecision', request: r, decision: 'reject' })} />
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : activeSection === 'staff' ? (
        <View style={{ gap: t.spacing.md }}>
          <Input value={staffSearch} onChangeText={setStaffSearch} placeholder="Search staff by name or email..." />
          {filteredStaff.map((row) => (
            <Card key={row.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{row.full_name}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{row.email} · {row.role}</Text>
                </View>
                <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'SUSPENDED' || row.status === 'BLOCKED' ? 'danger' : 'muted'} label={row.status} size="xs" />
              </View>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
                {row.status === 'ACTIVE' && (
                  <IconActionButton icon={Pause} tone="warning" accessibilityLabel="Suspend" onPress={() => changeStatus(row, 'suspend')} disabled={busyUserId === row.id} />
                )}
                {row.status === 'SUSPENDED' && (
                  <IconActionButton icon={Play} tone="success" accessibilityLabel="Reactivate" onPress={() => changeStatus(row, 'reactivate')} disabled={busyUserId === row.id} />
                )}
                {(row.status === 'ACTIVE' || row.status === 'SUSPENDED') && (
                  <IconActionButton icon={Ban} tone="danger" accessibilityLabel="Block" onPress={() => changeStatus(row, 'block')} disabled={busyUserId === row.id} />
                )}
                {row.status === 'BLOCKED' && (
                  <IconActionButton icon={ShieldCheck} tone="success" accessibilityLabel="Unblock" onPress={() => changeStatus(row, 'unblock')} disabled={busyUserId === row.id} />
                )}
                {row.status === 'ACTIVE' && (
                  <IconActionButton icon={LogOut} tone="muted" accessibilityLabel="Kick offline" onPress={() => kickUser(row)} disabled={busyUserId === row.id} />
                )}
                {row.status !== 'TERMINATED' && (
                  <>
                    <IconActionButton icon={KeyRound} tone="info" accessibilityLabel="Reset Password" onPress={() => resetPassword(row)} disabled={busyUserId === row.id} />
                    <IconActionButton icon={UserX} tone="danger" accessibilityLabel="Terminate" onPress={() => terminateUser(row)} disabled={busyUserId === row.id} />
                  </>
                )}
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
            Generate a registration link pre-filled with a department, role, and expiry, with an optional auto-approve to skip HR review.
          </Text>
          <Button label={showInviteForm ? 'Close' : 'Generate Invite Link'} size="sm" icon={<Plus size={13} color={showInviteForm ? t.colors.textSecondary : '#fff'} />} variant={showInviteForm ? 'ghost' : 'primary'} onPress={() => setShowInviteForm((p) => !p)} />

          {showInviteForm ? (
            <Card>
              <Field label="Full Name (optional)"><Input value={inviteForm.fullName} onChangeText={(v) => setInviteForm((p) => ({ ...p, fullName: v }))} placeholder="Full name" /></Field>
              <Field label="Email (the link is sent here)"><Input value={inviteForm.email} onChangeText={(v) => setInviteForm((p) => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" /></Field>
              <Field label="Phone (the link is texted here)"><Input value={inviteForm.phone} onChangeText={(v) => setInviteForm((p) => ({ ...p, phone: v }))} placeholder="e.g. 024 123 4567" keyboardType="phone-pad" /></Field>
              <Field label="Department"><SearchablePicker value={inviteForm.department} onChange={(v) => setInviteForm((p) => ({ ...p, department: v }))} options={INVITE_DEPT_OPTIONS} /></Field>
              <Field label="Role"><SearchablePicker value={inviteForm.role} onChange={(v) => setInviteForm((p) => ({ ...p, role: v }))} options={INVITE_ROLE_OPTIONS} /></Field>
              <Field label="Link Expiry"><SearchablePicker value={inviteForm.expiry} onChange={(v) => setInviteForm((p) => ({ ...p, expiry: v }))} options={INVITE_EXPIRY_OPTIONS} /></Field>
              <View style={{ marginBottom: t.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Auto-Approve On Register</Text>
                  <Toggle value={inviteForm.autoApprove} onChange={(v) => setInviteForm((p) => ({ ...p, autoApprove: v }))} />
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.xs }}>
                  {inviteForm.autoApprove ? 'Staff will be automatically approved on registration without HR review.' : 'Staff will require HR review after registering.'}
                </Text>
              </View>
              <Button label={invitesBusy ? 'Sending…' : 'Generate and Send Link'} onPress={generateInviteLink} loading={invitesBusy} disabled={invitesBusy} fullWidth />

              {generatedLink ? (
                <View style={{ marginTop: t.spacing.md, padding: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: t.colors.status.success.bg, borderWidth: 1, borderColor: t.colors.status.success.text }}>
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: t.colors.textPrimary, marginBottom: 4 }}>Invite Link Generated:</Text>
                  {inviteDelivery ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textSecondary, marginBottom: 4 }}>{inviteDelivery}</Text> : null}
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
                    <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{inv.full_name || 'Not set'}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>{inv.email || 'Not set'} · {inv.department}</Text>
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
      ) : activeSection === 'keys' && !keysUnlocked ? (
        <Card>
          <View style={{ gap: t.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Lock size={16} color={t.colors.accent} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>API keys are locked</Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Type your password to see and change the keys. They lock again after 10 minutes.</Text>
            <Input value={keysPw} onChangeText={(v) => { setKeysPw(v); setKeysPwError(''); }} placeholder="Your password" secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={unlockKeys} />
            {!!keysPwError && <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text }}>{keysPwError}</Text>}
            <Button label={checkingKeysPw ? 'Checking...' : 'Unlock'} onPress={unlockKeys} loading={checkingKeysPw} disabled={checkingKeysPw || !keysPw} fullWidth />
          </View>
        </Card>
      ) : activeSection === 'keys' ? (
        <View style={{ gap: t.spacing.md }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Button label="Lock" size="sm" variant="ghost" icon={<Lock size={13} color={t.colors.textSecondary} />} onPress={lockKeys} />
          </View>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, lineHeight: 16 }}>
            Every external key or secret the app can use, in one place, the same kind of "enter your API key" screen you'd see on any other platform. Empty rows fall back to their existing free or manual behavior; a saved key takes effect immediately, the next time that feature is used.
          </Text>
          {API_KEY_DEFS.map((def) => {
            const saved = apiKeys[def.key] || '';
            const draft = apiKeyDrafts[def.key];
            const isDirty = draft != null && draft !== saved;
            const revealed = !!revealedKeys[def.key];
            const isSaving = savingApiKey === def.key;
            return (
              <Card key={def.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: 4 }}>
                  {!!def.logo && API_KEY_LOGOS[def.logo] && (
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#ffffff', borderWidth: 1, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <Image source={API_KEY_LOGOS[def.logo]} style={{ width: 22, height: 22 }} resizeMode="contain" />
                    </View>
                  )}
                  <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{def.label}</Text>
                  <Badge tone={saved ? 'success' : 'muted'} label={saved ? 'Configured' : 'Not Configured'} size="xs" />
                </View>
                {!!def.provider && (
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, marginBottom: 2 }}>
                    <Text style={{ fontFamily: t.font.semibold, color: t.colors.textSecondary }}>{`${def.provider} `}</Text>
                    {!!def.providerUrl && (
                      <Text style={{ color: t.colors.accent, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(def.providerUrl!).catch(() => {})}>
                        {def.providerUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </Text>
                    )}
                  </Text>
                )}
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>{def.description}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={draft != null ? draft : saved}
                      onChangeText={(v) => setApiKeyDrafts((prev) => ({ ...prev, [def.key]: v }))}
                      placeholder={def.placeholder}
                      secureTextEntry={!def.plain && !revealed}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {!def.plain && (
                    <Button
                      icon={revealed ? <EyeOff size={14} color={t.colors.textSecondary} /> : <Eye size={14} color={t.colors.textSecondary} />}
                      label=""
                      variant="ghost"
                      size="sm"
                      onPress={() => setRevealedKeys((prev) => ({ ...prev, [def.key]: !prev[def.key] }))}
                    />
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm }}>
                  <Button label={isSaving ? 'Saving…' : 'Save'} size="sm" onPress={() => saveApiKey(def.key)} disabled={!isDirty || isSaving} loading={isSaving} />
                  {!!saved && (
                    <Button label="Remove" size="sm" variant="danger" onPress={() => clearApiKey(def)} disabled={isSaving} />
                  )}
                </View>
              </Card>
            );
          })}
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
        const ready = resetConfirmText === 'CONFIRM DELETE' && !!resetPw;
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
                <Field label="Your password" hint="Checked on the server to confirm it is you.">
                  <Input value={resetPw} onChangeText={(v) => { setResetPw(v); setResetError(''); }} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" placeholder="Type your sign-in password" />
                </Field>
                {!!resetError && (
                  <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text }}>{resetError}</Text>
                )}
              </View>
            ) : (
              <View style={{ gap: t.spacing.sm }}>
                {resetResults.map((r) => {
                  const matched = cfg.tables.find((t2) => t2.name === r.table);
                  const displayLabel = matched ? `${matched.label} (${r.table})` : r.table;
                  return (
                    <View key={r.table} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm, borderRadius: t.radius.sm, backgroundColor: r.error ? t.colors.status.danger.bg : t.colors.status.success.bg }}>
                      <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: r.error ? t.colors.status.danger.text : t.colors.status.success.text }} numberOfLines={2}>{displayLabel}</Text>
                      <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: r.error ? t.colors.status.danger.text : t.colors.status.success.text }}>{r.error ? `Error: ${r.error}` : `${r.deleted} deleted`}</Text>
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
      {/* Each form closes before the password sheet opens (iOS can't show two
          sheets at once); what was typed is kept if they come back. */}
      <Sheet open={changeEmailOpen} onClose={() => setChangeEmailOpen(false)} title="Change CEO Email" side="bottom" maxHeight={360}
        footer={<Button label="Continue" onPress={() => {
          const v = newEmail.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { Alert.alert('Check the email', 'Enter a valid new email address.'); return; }
          setChangeEmailOpen(false);
          setTimeout(() => setPasswordAction({ kind: 'changeEmail', newEmail: v }), 350);
        }} fullWidth />}>
        <Field label="New email" hint="A confirmation link goes here. Nothing changes until it is opened.">
          <Input value={newEmail} onChangeText={setNewEmail} placeholder="e.g. ceo@yourcompany.com" autoCapitalize="none" keyboardType="email-address" />
        </Field>
      </Sheet>

      <Sheet open={coCeoOpen} onClose={() => setCoCeoOpen(false)} title="Add Co-CEO" side="bottom" maxHeight={520}
        footer={<Button label="Continue" onPress={() => {
          const email = coCeoForm.email.trim().toLowerCase();
          if (!coCeoForm.fullName.trim()) { Alert.alert('Missing Info', 'Enter their full name.'); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Alert.alert('Missing Info', 'Enter a valid email address.'); return; }
          setCoCeoOpen(false);
          setTimeout(() => setPasswordAction({ kind: 'coCeo', fullName: coCeoForm.fullName.trim(), email, phone: coCeoForm.phone.trim() }), 350);
        }} fullWidth />}>
        <Field label="Full name"><Input value={coCeoForm.fullName} onChangeText={(v) => setCoCeoForm((f) => ({ ...f, fullName: v }))} placeholder="e.g. Ama Mensah" /></Field>
        <Field label="Email"><Input value={coCeoForm.email} onChangeText={(v) => setCoCeoForm((f) => ({ ...f, email: v }))} placeholder="e.g. ama@yourcompany.com" autoCapitalize="none" keyboardType="email-address" /></Field>
        <Field label="Phone (optional)" hint="If given, the invite also goes by SMS."><Input value={coCeoForm.phone} onChangeText={(v) => setCoCeoForm((f) => ({ ...f, phone: v }))} placeholder="e.g. 0244123456" keyboardType="phone-pad" /></Field>
      </Sheet>

      <Sheet open={!!coCeoResult} onClose={() => setCoCeoResult(null)} title="Co-CEO Invited" side="bottom" maxHeight={380}
        footer={<Button label="Done" onPress={() => setCoCeoResult(null)} fullWidth />}>
        {coCeoResult && (
          <View style={{ gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>{coCeoResult.message}</Text>
            {!!coCeoResult.link && (
              <>
                <Text selectable style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textPrimary }}>{coCeoResult.link}</Text>
                <View style={{ alignItems: 'flex-start' }}>
                  <Button label="Copy link" size="sm" variant="ghost" icon={<Copy size={13} color={t.colors.textSecondary} />} onPress={async () => { await Clipboard.setStringAsync(coCeoResult.link); Alert.alert('Copied', 'Link copied.'); }} />
                </View>
              </>
            )}
          </View>
        )}
      </Sheet>

      <Sheet open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Request CEO Removal" side="bottom" maxHeight={420}
        footer={<Button label="Continue" variant="danger" onPress={() => {
          const target = removeTarget;
          if (!target) return;
          setRemoveTarget(null);
          setTimeout(() => setPasswordAction({ kind: 'removeRequest', target, reason: removeReason.trim() }), 350);
        }} fullWidth />}>
        <View style={{ gap: t.spacing.md }}>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>
            {removeTarget?.full_name} stays CEO until a different CEO approves this request.
          </Text>
          <Field label="Reason (optional)" hint="Shown to the CEO who decides, and kept in the log.">
            <Input value={removeReason} onChangeText={setRemoveReason} placeholder="e.g. Left the company" multiline />
          </Field>
        </View>
      </Sheet>

      <PasswordConfirmSheet
        open={!!passwordAction}
        onClose={() => setPasswordAction(null)}
        title={passwordTitle(passwordAction)}
        description={passwordDescription(passwordAction)}
        confirmLabel={passwordConfirmLabel(passwordAction)}
        danger={isDangerAction(passwordAction)}
        onConfirm={runPasswordAction}
      />
    </Screen>
  );
}
