// rebma-web/src/utils/ceoSettingsSchema.ts
//
// The single source of truth for every plain Control Center setting —
// CeoControlCenter.tsx renders its 9 plain sections FROM this array
// (via a generic <SettingField> renderer), and utils/helpKnowledgeBase.ts
// imports it directly for the CEO-only Help Assistant's search. One
// place to edit, both consumers stay in sync automatically — this is
// what "the Assistant should learn new updates automatically" means in
// practice: add a field here, it's simultaneously rendered in Control
// Center and searchable in the Assistant, no second file to remember.
//
// Transcribed verbatim from CeoControlCenter.tsx's own JSX (read
// directly, not guessed) before this file existed. `icon` is a string
// key (not a lucide component) so this file stays free of a UI-library
// import — only CeoControlCenter.tsx, which actually renders icons,
// needs to resolve the string back to a component.
//
// Two sections are deliberately NOT here at all: "Document Templates"
// (embeds a whole editor view) and "Section 10 — Data Reset Center"
// (embeds a whole destructive-action component) — neither is a plain
// field list, both stay as their own hand-written JSX in
// CeoControlCenter.tsx, untouched by this schema.
//
// Communication and System also don't map to a single plain `.map()` —
// each embeds extra non-field UI (MessageExportSection interleaved
// mid-list in Communication; pending-department-approvals + department-
// rename blocks appended after System's own fields). Their `fields`
// arrays here are still complete and ordered correctly; it's only
// CeoControlCenter.tsx's render call that splits them around the extra
// UI, to preserve today's exact visual position of each.

export type SettingFieldSpec =
  | { kind: 'toggle'; key: string; label: string; description: string; warning?: string }
  | { kind: 'toggleWithException'; key: string; label: string; description: string }
  | { kind: 'number'; key: string; label: string; description: string; min?: number; max?: number; unit?: string }
  | { kind: 'select'; key: string; label: string; description: string; options: { value: string; label: string }[] }
  | { kind: 'text'; key: string; label: string; description: string; placeholder?: string };

export interface SettingSection {
  id: string;
  title: string;
  icon: string;
  fields: SettingFieldSpec[];
}

export const CEO_SETTINGS_SCHEMA: SettingSection[] = [
  {
    // Real source has 8 fields in two groups either side of the Invite
    // Staff panel — confirmed by grepping every settingKey= in the file,
    // which also caught a real pre-existing gap: the first version of
    // this knowledge base (built from a partial read) had only 6 of
    // these 8, silently missing hr_can_approve_registrations and
    // management_can_approve_registrations entirely.
    id: 'access', title: 'Section 1, Access Control', icon: 'Shield',
    fields: [
      { kind: 'toggle', key: 'app_master_switch', label: 'App Access (Master Switch)', description: 'Master switch for entire app. When turned OFF all users except CEO will see a maintenance page and cannot access any features.', warning: '⚠️ This will immediately lock out all users and shut down app access. Only you can turn it back on. Are you sure?' },
      { kind: 'toggle', key: 'registrations_allowed', label: 'Allow New Registrations', description: "When OFF the registration page shows 'Registration is currently closed' and no new accounts can be created." },
      { kind: 'toggle', key: 'invitation_only', label: 'Show CEO Invite Panel', description: 'Registration is always invite-only for everyone except CEO. This toggle only shows or hides your own Invite Staff panel below, for quickly inviting someone yourself (e.g. a new HR hire).' },
      { kind: 'toggle', key: 'hr_can_invite_staff', label: 'HR Can Invite Staff', description: "When OFF, HR's Add Staff screen is disabled app-wide, and HR cannot generate or send new staff invites until this is turned back on." },
      { kind: 'toggleWithException', key: 'mobile_app_access_allowed', label: 'Mobile App Access', description: 'Master switch for who can sign in to the mobile app. Use the email exceptions below to allow or block specific people regardless of this switch.' },
      // Group 2 — renders after the Invite Staff panel in CeoControlCenter.tsx.
      { kind: 'toggle', key: 'hr_can_approve_registrations', label: 'HR Can Approve Registrations', description: 'When OFF HR cannot approve new staff registrations. All approvals require CEO sign-off.' },
      { kind: 'toggle', key: 'management_can_approve_registrations', label: 'Management Can Approve Registrations', description: 'Allow Management to approve staff registrations independently.' },
      // Same real key also appears in Approval Controls below — a
      // pre-existing duplication in web's own live source (confirmed by
      // grep, both instances real), transcribed faithfully, not fixed.
      { kind: 'toggle', key: 'ceo_must_approve_registrations', label: 'CEO Must Approve Registrations', description: 'All new staff registrations go directly to CEO first before HR review. Highest level of staff access control.' },
    ],
  },
  {
    id: 'financial', title: 'Section 2, Financial Controls', icon: 'DollarSign',
    fields: [
      { kind: 'toggle', key: 'credit_sales_enabled', label: 'Credit Sales Enabled', description: 'Allow credit payment type for customer orders. When OFF Marketing cannot select Credit as payment mode.' },
      { kind: 'number', key: 'max_credit_amount', label: 'Maximum Credit Amount', description: 'Maximum credit amount allowed per customer. Orders requesting credit above this amount are automatically blocked.', min: 0, max: 10000000, unit: 'GHS' },
      { kind: 'toggle', key: 'cash_payments_enabled', label: 'Cash Payments Enabled', description: 'Allow Cash as payment type in Account Department order processing.' },
      { kind: 'toggle', key: 'cheque_payments_enabled', label: 'Cheque Payments Enabled', description: 'Allow Cheque as payment type. When OFF Account Department cannot record cheque payments.' },
      { kind: 'toggle', key: 'momo_payments_enabled', label: 'Mobile Money Enabled', description: 'Allow Mobile Money (MTN, Vodafone, AirtelTigo) as payment type.' },
      { kind: 'toggle', key: 'invoice_generation_enabled', label: 'Auto Invoice Generation', description: 'Automatically generate invoice when Account Department approves an order. When OFF invoices must be created manually.' },
      { kind: 'toggle', key: 'finance_needs_ceo_cosign', label: 'Account Department Needs CEO Co-sign', description: 'When ON all Account Department payment approvals require CEO electronic co-signature before they are processed.' },
      { kind: 'toggle', key: 'payroll_processing_enabled', label: 'Payroll Processing Enabled', description: 'Allow Account Department to process payroll batches. When OFF payroll submissions from HR are frozen.' },
      { kind: 'number', key: 'ceo_approval_threshold', label: 'CEO Approval Threshold', description: 'Orders above this amount require CEO approval before Account Department can process payment.', min: 0, max: 100000000, unit: 'GHS' },
      { kind: 'toggle', key: 'management_price_setting', label: 'Management Can Set Prices', description: 'Allow Management to set product selling prices. When OFF only CEO can set and broadcast prices.' },
      { kind: 'toggle', key: 'ceo_must_approve_prices', label: 'CEO Must Approve Price Changes', description: 'When ON Management can draft prices but CEO must review and approve before they broadcast to Account Department and Marketing.' },
      { kind: 'toggle', key: 'forms_control', label: 'All Forms Enabled (Master)', description: 'Master switch for all forms across all departments. When OFF no user can submit any form in any department.' },
      { kind: 'toggle', key: 'orders_enabled', label: 'Orders Enabled', description: 'Allow new orders to be created. When OFF Marketing cannot submit new customer orders or internal production orders.' },
    ],
  },
  {
    id: 'operations', title: 'Section 3, Operations Controls', icon: 'Package',
    fields: [
      { kind: 'toggle', key: 'cargo_intake_enabled', label: 'Cargo Intake Enabled', description: 'Allow Operations to log new cargo receipts from the port. When OFF the Log Intake button is disabled.' },
      { kind: 'toggle', key: 'stock_adjustments_allowed', label: 'Stock Adjustments Allowed', description: 'Allow manual stock level adjustments in Operations. When OFF only system-generated stock movements are allowed.' },
      { kind: 'toggle', key: 'management_can_delete_stock', label: 'Management Can Delete Stock', description: 'Allow Management to permanently remove stock items from the Manage Stock section on their dashboard. When OFF the delete controls there are hidden.' },
      { kind: 'toggle', key: 'quality_check_needs_cosign', label: 'Require Co-sign on Quality Check', description: 'When ON quality check results require CEO or Management approval before stock is updated. Operations cannot pass goods independently.' },
      { kind: 'toggle', key: 'discrepancy_auto_alert_ceo', label: 'CEO Discrepancy Alerts', description: 'CEO receives instant notification for every discrepancy report filed by Operations.' },
    ],
  },
  {
    id: 'dispatch', title: 'Section 4, Dispatch Controls', icon: 'Truck',
    fields: [
      { kind: 'toggle', key: 'deliveries_enabled', label: 'Deliveries Enabled', description: 'Allow Dispatch to create and process deliveries. When OFF no deliveries can be assigned or dispatched.' },
      { kind: 'toggle', key: 'gps_tracking_enabled', label: 'GPS Tracking Enabled', description: 'Enable real-time GPS tracking for all delivery vehicles.' },
      { kind: 'select', key: 'gps_ping_interval', label: 'GPS Ping Interval', description: 'How frequently GPS location updates. Lower = more accurate but uses more data.', options: [{ value: '10', label: '10 seconds' }, { value: '30', label: '30 seconds' }, { value: '60', label: '60 seconds' }] },
      { kind: 'toggle', key: 'proof_of_delivery_required', label: 'Proof of Delivery Required', description: 'Dispatch cannot mark a delivery as complete without uploading a photo proof. Enforced on all deliveries.' },
      { kind: 'toggle', key: 'dispatch_needs_management', label: 'Management Must Approve Driver', description: 'When ON driver assignments require Management approval before dispatch.' },
    ],
  },
  {
    id: 'data', title: 'Section 5, Data Controls', icon: 'Database',
    fields: [
      { kind: 'toggle', key: 'data_export_enabled', label: 'Data Export Enabled', description: 'Allow CSV and PDF exports across all departments. When OFF all export buttons are hidden and disabled.' },
      { kind: 'toggle', key: 'data_import_enabled', label: 'Data Import Enabled', description: 'Master switch for all file imports. Management still controls which departments can import and what types.' },
      { kind: 'select', key: 'audit_log_access', label: 'Audit Log Access', description: 'Controls which roles can access the audit log viewer.', options: [{ value: 'ceo_only', label: 'CEO Only' }, { value: 'management_and_above', label: 'Management and Above' }, { value: 'all_staff', label: 'All Staff' }] },
      { kind: 'toggle', key: 'print_enabled', label: 'Printing Enabled', description: 'Allow printing across all departments. When OFF print buttons are hidden and disabled.' },
      { kind: 'toggle', key: 'report_generation_enabled', label: 'Reports Enabled', description: 'Allow financial report generation in Account Department.' },
      { kind: 'toggle', key: 'ceo_activity_visible_to_others', label: 'CEO Activity Visible to Others', description: 'When ON, other departments can see CEO-authored entries in the Department Activity feed and the CEO department card. When OFF (default), only the CEO can see their own activity entries.' },
    ],
  },
  {
    // Split around <MessageExportSection> in CeoControlCenter.tsx —
    // this array stays one complete, ordered list; only the render call
    // slices it (index 0-2, component, index 3-10) to keep Message
    // Export's current mid-list position.
    id: 'communication', title: 'Section 6, Communication Controls', icon: 'MessageCircle',
    fields: [
      { kind: 'toggle', key: 'global_chat_enabled', label: 'Global Chat Enabled', description: 'Enable company-wide chat in the Boardroom. When OFF the Global Chat tab is hidden for all users.' },
      { kind: 'toggle', key: 'department_chat_enabled', label: 'Department Chat Enabled', description: 'Enable department-specific chat channels.' },
      { kind: 'toggle', key: 'direct_messages_enabled', label: 'Direct Messages Enabled', description: 'Allow private messaging between individual staff members.' },
      { kind: 'toggleWithException', key: 'messaging_access_allowed', label: 'Messaging Access', description: 'Master switch for whether an account can use chat at all (web and mobile), on top of the three toggles above. Add an email exception below to block or allow one specific person regardless of the master switch.' },
      { kind: 'toggle', key: 'messenger_calls_enabled', label: 'Voice/Video Calls Enabled', description: 'Allow starting an ad-hoc voice or video call from any conversation in Messenger. When OFF the call buttons are hidden.' },
      { kind: 'toggle', key: 'messenger_attachments_enabled', label: 'Attachments Enabled', description: 'Allow sending photos, files, and voice notes in Messenger. When OFF only plain text messages can be sent.' },
      { kind: 'number', key: 'message_retention_days', label: 'Message Retention', description: 'Hide messages older than this many days from every conversation view. 0 disables retention (messages are kept indefinitely). This only hides old messages from view; it does not delete them from the database.', unit: 'days', min: 0, max: 3650 },
      { kind: 'toggle', key: 'external_email_enabled', label: 'External Email Enabled', description: 'Allow sending emails to suppliers and customers from within the app.' },
      { kind: 'toggle', key: 'whatsapp_enabled', label: 'WhatsApp Enabled', description: 'Allow sending WhatsApp messages to suppliers and customers.' },
      { kind: 'toggle', key: 'payment_reminders_enabled', label: 'Payment Reminders Enabled', description: 'Allow Account Department to send payment reminder messages to customers with outstanding credit.' },
      { kind: 'toggle', key: 'announcements_ceo_only', label: 'CEO Only Announcements', description: 'When ON only CEO can post company-wide announcements. When OFF Management can also post announcements.' },
      // These two were only on the phone's Control Center until now.
      { kind: 'toggle', key: 'meeting_recording_allowed', label: 'Meeting Recording Allowed', description: 'When OFF, hosts cannot start a recording in Boardroom, Meetings or chat calls, on web or the phone.' },
      { kind: 'toggle', key: 'chat_suspension_allowed', label: 'Chat Suspension Allowed', description: 'When OFF, nobody can suspend a direct chat, and existing suspensions stop having any effect.' },
    ],
  },
  {
    // Only these 6 fields are schema-driven; the pending-department-
    // approvals block and department-rename block stay appended after
    // them in CeoControlCenter.tsx, unchanged.
    id: 'system', title: 'Section 7, System Controls', icon: 'Settings',
    fields: [
      { kind: 'toggle', key: 'maintenance_mode', label: 'Maintenance Mode', description: 'When ON all users except CEO see a maintenance page and cannot access any features. Use when performing system updates or critical maintenance.', warning: '⚠️ All non-CEO users will immediately see the maintenance page and lose access. Are you sure?' },
      { kind: 'number', key: 'session_timeout_minutes', label: 'Session Timeout', description: 'Automatically log out inactive users after this many minutes. Minimum 5, maximum 480 (8 hours).', min: 5, max: 480, unit: 'min' },
      { kind: 'toggle', key: 'force_2fa_management', label: 'Force 2FA for Management', description: 'Require two-factor authentication for all Management users.' },
      { kind: 'toggle', key: 'force_2fa_finance', label: 'Force 2FA for Account Department', description: 'Require two-factor authentication for all Account Department users.' },
      { kind: 'select', key: 'password_reset_authority', label: 'Password Reset Authority', description: 'Control who has authority to reset staff passwords.', options: [{ value: 'ceo_only', label: 'CEO Only' }, { value: 'hr_and_ceo', label: 'HR and CEO' }, { value: 'specific_user', label: 'Specific User' }] },
      { kind: 'select', key: 'account_deletion_authority', label: 'Account Deletion Authority', description: 'Control who can permanently delete staff accounts. This action cannot be undone.', options: [{ value: 'ceo_only', label: 'CEO Only' }, { value: 'specific_user', label: 'Specific User' }] },
    ],
  },
  {
    id: 'approval', title: 'Section 8, Approval Controls', icon: 'CheckSquare',
    fields: [
      { kind: 'number', key: 'ceo_cosign_credit_threshold', label: 'Credit Co-sign Threshold', description: 'Credit orders above this amount require CEO electronic approval before Account Department can process.', min: 0, max: 10000000, unit: 'GHS' },
      { kind: 'number', key: 'ceo_cosign_order_threshold', label: 'Order Co-sign Threshold', description: 'Customer orders above this amount require CEO approval before Account Department can process payment.', min: 0, max: 10000000, unit: 'GHS' },
      // Same real setting also appears in Financial Controls above — a
      // pre-existing duplication in web's own live source, transcribed
      // faithfully, not something this schema introduces or should fix.
      { kind: 'toggle', key: 'ceo_must_approve_prices', label: 'CEO Price Approval Required', description: 'Management can draft and set prices but CEO must review and approve before they broadcast to Account Department and Marketing.' },
      { kind: 'toggle', key: 'ceo_must_approve_payroll', label: 'CEO Payroll Approval', description: 'Payroll flow becomes: HR submits, then Account Department processes, then CEO approves, then Payment made. Extra layer of financial security.' },
      { kind: 'toggle', key: 'ceo_must_approve_departments', label: 'CEO Department Approval', description: 'When ON HR cannot activate new departments without CEO approval. Department is created but stays inactive until CEO approves.' },
      { kind: 'toggle', key: 'ceo_must_approve_registrations', label: 'CEO Registration Approval', description: 'All new staff registrations go directly to CEO first before HR review. Highest level of staff access control.' },
    ],
  },
  {
    id: 'spreadsheets', title: 'Section 9, Spreadsheets Control', icon: 'FileSpreadsheet',
    fields: [
      { kind: 'toggleWithException', key: 'spreadsheets_enabled', label: 'Spreadsheets Enabled (Master)', description: 'Master switch for the Spreadsheets feature across all departments. When OFF no user can access Free Sheets or Data Sheets unless they have a specific email exception that overrides this toggle.' },
    ],
  },
  {
    id: 'risk', title: 'Section 10, Risk Controls', icon: 'AlertTriangle',
    fields: [
      { kind: 'toggle', key: 'risk_customer_verification_required', label: 'Customer Verification Required', description: 'Customer verification is non-blocking by design, so a pending customer can still be ordered for. This only controls whether Risk treats verification as mandatory, not any order transition.' },
      { kind: 'toggle', key: 'risk_credit_hold_notify_marketing', label: 'Notify Marketing on Credit Hold', description: 'When ON, Marketing is notified whenever Risk puts a customer on credit hold.' },
    ],
  },
  {
    id: 'birthdays', title: 'Section 11, Birthday Wishes', icon: 'Cake',
    fields: [
      { kind: 'toggle', key: 'birthday_wishes_enabled', label: 'Birthday Wishes Allowed', description: 'Master switch. When off, no birthday wishes go out at all, automatic or by hand. HR writes the messages and runs the sending under HR, then Birthdays.' },
    ],
  },
];

export function getSchemaSection(id: string): SettingSection | undefined {
  return CEO_SETTINGS_SCHEMA.find((s) => s.id === id);
}
