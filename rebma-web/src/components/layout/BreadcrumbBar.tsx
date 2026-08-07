// src/components/layout/BreadcrumbBar.tsx
import { ChevronRight } from 'lucide-react';

const DEPT_LABELS: Record<string, string> = {
  CEO: 'CEO Command', MANAGEMENT: 'Management Office', HR: 'Human Resources',
  MARKETING: 'Marketing', OPERATIONS: 'Operations', FINANCE: 'Finance',
  PRODUCTION: 'Production', RECEPTION: 'Reception', DISPATCH: 'Dispatch',
  LOGISTICS: 'Logistics', BOARDROOM: 'Boardroom', SETTINGS: 'Settings',
};

const SUBTAB_LABELS: Record<string, string> = {
  Overview: 'Dashboard', Analytics: 'Analytics', Transactions: 'Transactions',
  Invoices: 'Invoices', Wallets: 'Wallets', Accounts: 'Accounts',
  Approvals: 'Approvals', Tracking: 'GPS Tracking', Messages: 'Messages & Boardroom',
  Evaluation: 'Dashboard', RecurringPayments: 'Recurring', RecordPayment: 'Payments', Receipts: 'Receipts',
  OrdersQueue: 'Orders Queue', Payroll: 'Payroll', CargoApproval: 'Dashboard',
  CreditApproval: 'Approvals', SetPrices: 'Price Setting', Ledger: 'Audit Log',
  Employees: 'Dashboard', Staff: 'Staff', Attendance: 'Attendance',
  Registrations: 'Registrations', LeaveManagement: 'Leave Management',
  DepartmentManager: 'Department Manager', PerformanceAlerts: 'Performance Alerts',
  CreateOrder: 'Orders', RegisterCustomer: 'Customers', SalesHistory: 'Sales History',
  PortIngestion: 'Stock Intake', Stock: 'Stock', OpsHistory: 'Discrepancy Reports',
  Releases: 'Fulfillment', Deliveries: 'Dashboard', ActiveDeliveries: 'Deliveries',
  Drivers: 'Drivers', ProofOfDelivery: 'Proof of Delivery', FleetOverview: 'Fleet Overview',
  FuelManagement: 'Fuel Management', Maintenance: 'Maintenance Schedule',
  FleetAnalytics: 'Fleet Analytics', VisitorLog: 'Dashboard', Visitors: 'Visitors',
  EmployeeCheckin: 'Attendance', DailyReports: 'Daily Reports', Requisition: 'Dashboard',
  InternalOrders: 'Internal Orders', WIPStock: 'WIP Stock', OutputRecording: 'Output Recording',
  VideoConf: 'Live Video Minutes', Announcements: 'Announcements',
  DirectMessages: 'Direct Messages', Meetings: 'Meetings',
  Appearance: 'Display & Appearance', Profile: 'Profile & Account',
  ChangePassword: 'Change Password', TwoFactor: 'Two-Factor Authentication', DeleteAccount: 'Delete Account',
  Notes: 'Notes', Tasks: 'Tasks', Emails: 'Emails', Notifications: 'Notifications',
  HelpDesk: 'Help & News', Feedback: 'Feedback',
};

// Tabs that are the "dashboard" (top-level) for their dept — no sub-label shown
const DASHBOARD_TABS = new Set([
  'Overview','Evaluation','CargoApproval','Employees','Deliveries',
  'VisitorLog','Requisition',
]);

interface BreadcrumbBarProps {
  activeDepartment: string;
  activeSubTab: string;
  detailLabel?: string;
  onDeptClick?: () => void;
  onSubTabClick?: () => void;
}

export default function BreadcrumbBar({
  activeDepartment,
  activeSubTab,
  detailLabel,
  onDeptClick,
  onSubTabClick,
}: BreadcrumbBarProps) {
  const deptLabel = DEPT_LABELS[activeDepartment] || activeDepartment;
  const subLabel  = SUBTAB_LABELS[activeSubTab]   || activeSubTab;
  const isDashboardTab = DASHBOARD_TABS.has(activeSubTab);

  // Build crumbs
  const crumbs: { label: string; onClick?: () => void; active: boolean }[] = [
    { label: deptLabel, onClick: onDeptClick, active: !activeSubTab || isDashboardTab },
  ];

  if (!isDashboardTab && activeSubTab) {
    crumbs.push({ label: subLabel, onClick: detailLabel ? onSubTabClick : undefined, active: !detailLabel });
  }

  if (detailLabel) {
    crumbs.push({ label: detailLabel, active: true });
  }

  return (
    <div className="flex items-center gap-1 h-9 px-4 lg:px-6 shrink-0 overflow-hidden">
      {crumbs.map((crumb, i) => (
        <div key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0 flex-none" />}
          {crumb.active || !crumb.onClick ? (
            <span
              className={`text-sm truncate ${crumb.active ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
            >
              {/* Mobile: only show last 2 crumbs */}
              {i < crumbs.length - 2 ? (
                <span className="hidden sm:inline">{crumb.label}</span>
              ) : crumb.label}
            </span>
          ) : (
            <button
              onClick={crumb.onClick}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] hover:underline truncate cursor-pointer transition-colors"
            >
              <span className={i < crumbs.length - 2 ? 'hidden sm:inline' : ''}>{crumb.label}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
