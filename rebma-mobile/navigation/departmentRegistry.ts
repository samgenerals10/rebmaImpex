// rebma-mobile/navigation/departmentRegistry.ts
//
// The key extensibility point for Phases 7.1+. One file mapping each
// department code to its label/icon/sub-tabs/quick-actions, transcribed
// from rebma-web's Sidebar.tsx (departmentTabs, allDepts, getIconForDept),
// utils/departments.ts (DEFAULT_SUBTAB), and QuickActions.tsx (per-dept
// action grids). In Phase 7.0 every entry has a full subTabs list but an
// empty/partial `screens` map; each department sub-phase fills in its own
// `screens` and nothing else in the navigator changes.
import type { ComponentType } from 'react';
import {
  ShieldCheck, ShieldAlert, Layers, Users, TrendingUp, Warehouse, DollarSign, Activity,
  LayoutDashboard, Package, PackageCheck, TriangleAlert, Truck, UserCheck, MapPin, Camera,
  QrCode, Gauge, Wrench, ChartBarIncreasing, ChartColumn, FileSpreadsheet, ShoppingCart, FileText, Tag,
  CreditCard, ClipboardCheck, ArrowLeftRight, History, Banknote, RefreshCw, Receipt, Calculator,
  Smartphone, PiggyBank, ClipboardList, UserPlus, Calendar, FileChartColumn, Factory, Video,
  MessagesSquare, Clipboard, Building2, Wallet, Ship, Ticket, Flag, PackagePlus, CircleCheckBig,
  GitMerge, SquareCheckBig, Send, Palette, Settings, Radio,
} from 'lucide-react-native';
import VisitorLogScreen from '../screens/reception/VisitorLogScreen';
import VisitorsScreen from '../screens/reception/VisitorsScreen';
import AttendanceScreen from '../screens/reception/AttendanceScreen';
import DailyReportsScreen from '../screens/reception/DailyReportsScreen';
import ReceptionAnalyticsScreen from '../screens/reception/AnalyticsScreen';
import ReceptionSpreadsheetsScreen from '../screens/reception/SpreadsheetsScreen';
import OverviewScreen from '../screens/adminWarehouse/OverviewScreen';
import PortIngestionScreen from '../screens/adminWarehouse/PortIngestionScreen';
import ApprovedGoodsScreen from '../screens/adminWarehouse/ApprovedGoodsScreen';
import StockScreen from '../screens/adminWarehouse/StockScreen';
import ReleasesScreen from '../screens/adminWarehouse/ReleasesScreen';
import OpsHistoryScreen from '../screens/adminWarehouse/OpsHistoryScreen';
import DeliveriesScreen from '../screens/adminWarehouse/DeliveriesScreen';
import ActiveDeliveriesScreen from '../screens/adminWarehouse/ActiveDeliveriesScreen';
import DriversScreen from '../screens/adminWarehouse/DriversScreen';
import TrackingScreen from '../screens/adminWarehouse/TrackingScreen';
import ProofOfDeliveryScreen from '../screens/adminWarehouse/ProofOfDeliveryScreen';
import ScannerScreen from '../screens/adminWarehouse/ScannerScreen';
import FleetOverviewScreen from '../screens/adminWarehouse/FleetOverviewScreen';
import FuelManagementScreen from '../screens/adminWarehouse/FuelManagementScreen';
import MaintenanceScreen from '../screens/adminWarehouse/MaintenanceScreen';
import FleetAnalyticsScreen from '../screens/adminWarehouse/FleetAnalyticsScreen';
import OpsAnalyticsScreen from '../screens/adminWarehouse/OpsAnalyticsScreen';
import SpreadsheetsScreen from '../screens/adminWarehouse/SpreadsheetsScreen';
import MarketingOverviewScreen from '../screens/marketing/OverviewScreen';
import CreateOrderScreen from '../screens/marketing/CreateOrderScreen';
import CustomersScreen from '../screens/marketing/CustomersScreen';
import MarketingPriceCatalogScreen from '../screens/marketing/PriceCatalogScreen';
import FinanceSalesHistoryScreen from '../screens/finance/SalesHistoryScreen';
import CreditRequestsScreen from '../screens/marketing/CreditRequestsScreen';
import MarketingAnalyticsScreen from '../screens/marketing/AnalyticsScreen';
import MarketingSpreadsheetsScreen from '../screens/marketing/SpreadsheetsScreen';
import FinanceOverviewScreen from '../screens/finance/OverviewScreen';
import OrdersQueueScreen from '../screens/finance/OrdersQueueScreen';
import RecordPaymentScreen from '../screens/finance/RecordPaymentScreen';
import ReceiptsScreen from '../screens/finance/ReceiptsScreen';
import FinanceInvoicesScreen from '../screens/finance/InvoicesScreen';
import WalletsScreen from '../screens/finance/WalletsScreen';
import TransactionsScreen from '../screens/finance/TransactionsScreen';
import CreditMgmtScreen from '../screens/finance/CreditMgmtScreen';
import ChequesScreen from '../screens/finance/ChequesScreen';
import MobileMoneyScreen from '../screens/finance/MobileMoneyScreen';
import PettyCashScreen from '../screens/finance/PettyCashScreen';
import ExpensesScreen from '../screens/finance/ExpensesScreen';
import PayrollScreen from '../screens/finance/PayrollScreen';
import RecurringPaymentsScreen from '../screens/finance/RecurringPaymentsScreen';
import StatementScreen from '../screens/finance/StatementScreen';
import TaxVATScreen from '../screens/finance/TaxVATScreen';
import FinReportsScreen from '../screens/finance/FinReportsScreen';
import FinancePriceCatalogScreen from '../screens/finance/PriceCatalogScreen';
import FinanceSpreadsheetsScreen from '../screens/finance/SpreadsheetsScreen';
import RiskOverviewScreen from '../screens/risk/RiskOverviewScreen';
import RiskApprovalsScreen from '../screens/risk/RiskApprovalsScreen';
import CustomerCreditScreen from '../screens/risk/CustomerCreditScreen';
import RiskDeptActivityScreen from '../screens/risk/DeptActivityScreen';
import RiskSpreadsheetsScreen from '../screens/risk/SpreadsheetsScreen';
import RiskRecruitmentScreen from '../screens/risk/RecruitmentScreen';
import MgmtOverviewScreen from '../screens/management/MgmtOverviewScreen';
import MgmtApprovalsScreen from '../screens/management/MgmtApprovalsScreen';
import MgmtTransactionsScreen from '../screens/management/TransactionsScreen';
import SetPricesScreen from '../screens/management/SetPricesScreen';
import MgmtInvoicesScreen from '../screens/management/InvoicesScreen';
import MgmtReceiptsScreen from '../screens/management/ReceiptsScreen';
import LedgerScreen from '../screens/management/LedgerScreen';
import MgmtPayrollScreen from '../screens/management/PayrollScreen';
import MgmtAnalyticsScreen from '../screens/management/MgmtAnalyticsScreen';
import StockManagementScreen from '../screens/management/StockManagementScreen';
import MgmtDeptActivityScreen from '../screens/management/DeptActivityScreen';
import MgmtPerformanceAlertsScreen from '../screens/management/PerformanceAlertsScreen';
import MgmtSpreadsheetsScreen from '../screens/management/SpreadsheetsScreen';
import HrOverviewScreen from '../screens/hr/OverviewScreen';
import HrStaffScreen from '../screens/hr/StaffScreen';
import HrAttendanceScreen from '../screens/hr/AttendanceScreen';
import HrRegistrationsScreen from '../screens/hr/RegistrationsScreen';
import HrLeaveManagementScreen from '../screens/hr/LeaveManagementScreen';
import HrPayrollScreen from '../screens/hr/PayrollScreen';
import HrDepartmentManagerScreen from '../screens/hr/DepartmentManagerScreen';
import HrPerformanceAlertsScreen from '../screens/hr/PerformanceAlertsScreen';
import HrQueriesScreen from '../screens/hr/HrQueriesScreen';
import HrSpreadsheetsScreen from '../screens/hr/SpreadsheetsScreen';
import ProductionOverviewScreen from '../screens/production/OverviewScreen';
import InternalOrdersScreen from '../screens/production/InternalOrdersScreen';
import WipStockScreen from '../screens/production/WipStockScreen';
import OutputRecordingScreen from '../screens/production/OutputRecordingScreen';
import ProdAnalyticsScreen from '../screens/production/AnalyticsScreen';
import ProductionSpreadsheetsScreen from '../screens/production/SpreadsheetsScreen';
import CeoOverviewScreen from '../screens/ceo/OverviewScreen';
import CeoSupplierOrdersScreen from '../screens/ceo/SupplierOrdersScreen';
import CeoTransactionsScreen from '../screens/ceo/TransactionsScreen';
import CeoInvoicesScreen from '../screens/ceo/InvoicesScreen';
import CeoReceiptsScreen from '../screens/ceo/ReceiptsScreen';
import CeoPriceCatalogScreen from '../screens/ceo/PriceCatalogScreen';
import CeoWalletsScreen from '../screens/ceo/WalletsScreen';
import CeoAccountsScreen from '../screens/ceo/AccountsScreen';
import CeoApprovalsScreen from '../screens/ceo/ApprovalsScreen';
import CeoPriceApprovalsScreen from '../screens/ceo/PriceApprovalsScreen';
import CeoTrackingScreen from '../screens/ceo/TrackingScreen';
import CeoDeptActivityScreen from '../screens/ceo/DeptActivityScreen';
import LiveUsersScreen from '../screens/ceo/LiveUsersScreen';
import CeoSpreadsheetsScreen from '../screens/ceo/SpreadsheetsScreen';
import VideoConfScreen from '../screens/boardroom/VideoConfScreen';
import AnnouncementsScreen from '../screens/boardroom/AnnouncementsScreen';
import DirectMessagesScreen from '../screens/boardroom/DirectMessagesScreen';
import MeetingsScreen from '../screens/boardroom/MeetingsScreen';
import AppearanceScreen from '../screens/settings/AppearanceScreen';
import ProfileAccountScreen from '../screens/settings/ProfileAccountScreen';
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import TwoFactorScreen from '../screens/settings/TwoFactorScreen';
import ControlCenterScreen from '../screens/settings/ControlCenterScreen';
import DeleteAccountScreen from '../screens/settings/DeleteAccountScreen';

export interface SubTab {
  id: string;
  label: string;
  icon: ComponentType<any>;
}

export interface QuickAction {
  label: string;
  actionColor: string; // theme.colors.action key, resolved by the caller
  icon: ComponentType<any>;
  subTab: string;
}

export interface DepartmentEntry {
  code: string;
  label: string;
  icon: ComponentType<any>;
  defaultSubTab: string;
  subTabs: SubTab[];
  /** ADMIN_WAREHOUSE/FINANCE render their launcher grouped into named sections; everyone else gets one flat grid. */
  sections?: { title: string; tabIds: string[] }[];
  quickActions: QuickAction[];
  /** Filled in by each department's own sub-phase (7.1+). Empty here = DepartmentPlaceholderScreen. */
  screens: Record<string, ComponentType<any>>;
}

export const DEPARTMENT_REGISTRY: Record<string, DepartmentEntry> = {
  ADMIN_WAREHOUSE: {
    code: 'ADMIN_WAREHOUSE',
    label: 'Admin & Warehouse',
    icon: Warehouse,
    defaultSubTab: 'Overview',
    subTabs: [
      { id: 'Overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'PortIngestion', label: 'Stock Intake', icon: Package },
      { id: 'ApprovedGoods', label: 'Approved Goods', icon: PackageCheck },
      { id: 'Stock', label: 'Stock', icon: Layers },
      { id: 'Releases', label: 'Fulfillment', icon: PackageCheck },
      { id: 'OpsHistory', label: 'Discrepancy Reports', icon: TriangleAlert },
      { id: 'FleetOverview', label: 'Fleet Overview', icon: Truck },
      { id: 'FuelManagement', label: 'Fuel Management', icon: Gauge },
      { id: 'Maintenance', label: 'Maintenance Schedule', icon: Wrench },
      { id: 'FleetAnalytics', label: 'Fleet Analytics', icon: ChartBarIncreasing },
      { id: 'OpsAnalytics', label: 'Warehouse Analytics', icon: ChartColumn },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    // Dispatch's delivery-facing screens moved into Risk (Phase 9) — see
    // the RISK entry below. Same screen components; just reached from a
    // different department now.
    sections: [
      { title: 'Warehouse & Stock', tabIds: ['Overview', 'PortIngestion', 'ApprovedGoods', 'Stock', 'Releases', 'OpsHistory'] },
      { title: 'Fleet & Maintenance', tabIds: ['FleetOverview', 'FuelManagement', 'Maintenance', 'FleetAnalytics'] },
      { title: 'Reports & Data', tabIds: ['OpsAnalytics', 'Spreadsheets'] },
    ],
    quickActions: [
      { label: 'Log Cargo Intake', actionColor: 'sky', icon: Ship, subTab: 'PortIngestion' },
      { label: 'Fulfillment Ticket', actionColor: 'teal', icon: Ticket, subTab: 'Releases' },
      { label: 'Flag Discrepancy', actionColor: 'rose', icon: Flag, subTab: 'OpsHistory' },
      { label: 'Fleet & Fuel', actionColor: 'amber', icon: GitMerge, subTab: 'FleetOverview' },
    ],
    screens: {
      home: OverviewScreen,
      PortIngestion: PortIngestionScreen,
      ApprovedGoods: ApprovedGoodsScreen,
      Stock: StockScreen,
      Releases: ReleasesScreen,
      OpsHistory: OpsHistoryScreen,
      FleetOverview: FleetOverviewScreen,
      FuelManagement: FuelManagementScreen,
      Maintenance: MaintenanceScreen,
      FleetAnalytics: FleetAnalyticsScreen,
      OpsAnalytics: OpsAnalyticsScreen,
      Spreadsheets: SpreadsheetsScreen,
    },
  },

  RECEPTION: {
    code: 'RECEPTION',
    label: 'Reception',
    icon: Users,
    defaultSubTab: 'VisitorLog',
    subTabs: [
      { id: 'VisitorLog', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'Visitors', label: 'Visitors', icon: UserPlus },
      { id: 'EmployeeCheckin', label: 'Attendance', icon: UserCheck },
      { id: 'DailyReports', label: 'Daily Reports', icon: FileChartColumn },
      { id: 'Analytics', label: 'Analytics', icon: ChartColumn },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'Check In Visitor', actionColor: 'emerald', icon: UserPlus, subTab: 'VisitorLog' },
      { label: 'Check Out Visitor', actionColor: 'rose', icon: UserPlus, subTab: 'VisitorLog' },
      { label: 'Staff Attendance', actionColor: 'blue', icon: ClipboardList, subTab: 'EmployeeCheckin' },
    ],
    screens: {
      home: VisitorLogScreen,
      Visitors: VisitorsScreen,
      EmployeeCheckin: AttendanceScreen,
      DailyReports: DailyReportsScreen,
      Analytics: ReceptionAnalyticsScreen,
      Spreadsheets: ReceptionSpreadsheetsScreen,
    },
  },

  // Sales History and Invoices (invoice generation) moved to Finance —
  // both now live under the FINANCE entry below, reusing the exact same
  // screen components (screens/finance/SalesHistoryScreen.tsx and
  // screens/finance/InvoicesScreen.tsx both just re-export Marketing's
  // originals). Marketing keeps everything else.
  MARKETING: {
    code: 'MARKETING',
    label: 'Marketing',
    icon: TrendingUp,
    defaultSubTab: 'CreateOrder',
    subTabs: [
      { id: 'Overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'CreateOrder', label: 'Orders', icon: ShoppingCart },
      { id: 'RegisterCustomer', label: 'Customers', icon: Users },
      { id: 'PriceCatalog', label: 'Price Catalog', icon: Tag },
      { id: 'CreditRequests', label: 'Credit Requests', icon: CreditCard },
      { id: 'MktAnalytics', label: 'Analytics', icon: ChartColumn },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'Create Order', actionColor: 'emerald', icon: ShoppingCart, subTab: 'CreateOrder' },
      { label: 'Register Customer', actionColor: 'blue', icon: UserPlus, subTab: 'RegisterCustomer' },
      // Sales History (where this used to land) moved to Finance —
      // Marketing's closest remaining equivalent is its own Analytics tab.
      { label: 'View Analytics', actionColor: 'indigo', icon: TrendingUp, subTab: 'MktAnalytics' },
    ],
    screens: {
      home: MarketingOverviewScreen,
      CreateOrder: CreateOrderScreen,
      RegisterCustomer: CustomersScreen,
      PriceCatalog: MarketingPriceCatalogScreen,
      CreditRequests: CreditRequestsScreen,
      MktAnalytics: MarketingAnalyticsScreen,
      Spreadsheets: MarketingSpreadsheetsScreen,
    },
  },

  FINANCE: {
    code: 'FINANCE',
    label: 'Finance',
    icon: DollarSign,
    defaultSubTab: 'Evaluation',
    subTabs: [
      { id: 'Evaluation', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'OrdersQueue', label: 'Sales Orders', icon: ClipboardList },
      { id: 'RecordPayment', label: 'Payments', icon: DollarSign },
      { id: 'Receipts', label: 'Receipts', icon: Receipt },
      { id: 'Invoices', label: 'Invoices', icon: FileText },
      { id: 'SalesHistory', label: 'Sales History', icon: TrendingUp },
      { id: 'PriceCatalog', label: 'Price Catalog', icon: Tag },
      { id: 'Wallets', label: 'Wallets & Bank', icon: Wallet },
      { id: 'Transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'CreditMgmt', label: 'Credit & Receivables', icon: CreditCard },
      { id: 'Cheques', label: 'Cheques', icon: FileText },
      { id: 'MobileMoney', label: 'Mobile Money', icon: Smartphone },
      { id: 'PettyCash', label: 'Petty Cash', icon: PiggyBank },
      { id: 'Expenses', label: 'Merchant Expenses', icon: Receipt },
      { id: 'Payroll', label: 'Payroll', icon: Banknote },
      { id: 'RecurringPayments', label: 'Recurring Bills', icon: RefreshCw },
      { id: 'Statement', label: 'Statement', icon: History },
      { id: 'TaxVAT', label: 'Tax & VAT', icon: Calculator },
      { id: 'FinReports', label: 'Financial Reports', icon: ChartColumn },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    sections: [
      { title: 'E-Commerce Core', tabIds: ['Evaluation', 'OrdersQueue', 'RecordPayment', 'Receipts', 'Invoices', 'SalesHistory', 'PriceCatalog'] },
      { title: 'Treasury & Accounts', tabIds: ['Wallets', 'Transactions', 'CreditMgmt', 'Cheques', 'MobileMoney', 'PettyCash'] },
      { title: 'Expenses & Liabilities', tabIds: ['Expenses', 'Payroll', 'RecurringPayments'] },
      { title: 'Reports & Auditing', tabIds: ['Statement', 'TaxVAT', 'FinReports', 'Spreadsheets'] },
    ],
    quickActions: [
      { label: 'Record Payment', actionColor: 'emerald', icon: DollarSign, subTab: 'RecordPayment' },
      { label: 'Create Invoice', actionColor: 'blue', icon: FileText, subTab: 'Invoices' },
      { label: 'Approve Credit', actionColor: 'teal', icon: SquareCheckBig, subTab: 'Evaluation' },
      { label: 'View Ledger', actionColor: 'indigo', icon: History, subTab: 'Transactions' },
    ],
    screens: {
      home: FinanceOverviewScreen,
      OrdersQueue: OrdersQueueScreen,
      RecordPayment: RecordPaymentScreen,
      Receipts: ReceiptsScreen,
      Invoices: FinanceInvoicesScreen,
      SalesHistory: FinanceSalesHistoryScreen,
      PriceCatalog: FinancePriceCatalogScreen,
      Wallets: WalletsScreen,
      Transactions: TransactionsScreen,
      CreditMgmt: CreditMgmtScreen,
      Cheques: ChequesScreen,
      MobileMoney: MobileMoneyScreen,
      PettyCash: PettyCashScreen,
      Expenses: ExpensesScreen,
      Payroll: PayrollScreen,
      RecurringPayments: RecurringPaymentsScreen,
      Statement: StatementScreen,
      TaxVAT: TaxVATScreen,
      FinReports: FinReportsScreen,
      Spreadsheets: FinanceSpreadsheetsScreen,
    },
  },

  RISK: {
    code: 'RISK',
    label: 'Risk & Compliance',
    icon: ShieldAlert,
    defaultSubTab: 'RiskOverview',
    subTabs: [
      { id: 'RiskOverview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'RiskApprovals', label: 'Approvals', icon: ClipboardCheck },
      { id: 'CustomerCredit', label: 'Customer Credit', icon: CreditCard },
      { id: 'Recruitment', label: 'Recruitment', icon: UserPlus },
      // Dispatch's delivery-facing screens (Phase 9) — moved here from
      // Admin & Warehouse. Same components; Risk now assigns the vehicle
      // and driver and owns the delivery lifecycle through to POD review.
      { id: 'Deliveries', label: 'Dispatch Board', icon: Truck },
      { id: 'ActiveDeliveries', label: 'Deliveries', icon: Truck },
      { id: 'Drivers', label: 'Drivers', icon: UserCheck },
      { id: 'Tracking', label: 'GPS Tracking', icon: MapPin },
      { id: 'ProofOfDelivery', label: 'Proof of Delivery', icon: Camera },
      { id: 'Scanner', label: 'Scanner', icon: QrCode },
      { id: 'DeptActivity', label: 'Dept Activity', icon: Activity },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'Review Cargo', actionColor: 'sky', icon: Ship, subTab: 'RiskApprovals' },
      { label: 'Review Orders', actionColor: 'indigo', icon: CreditCard, subTab: 'RiskApprovals' },
      { label: 'Review POD', actionColor: 'emerald', icon: SquareCheckBig, subTab: 'RiskApprovals' },
      { label: 'Customer Credit', actionColor: 'rose', icon: ShieldAlert, subTab: 'CustomerCredit' },
      { label: 'Assign Delivery', actionColor: 'blue', icon: PackagePlus, subTab: 'ActiveDeliveries' },
      { label: 'Mark Delivered', actionColor: 'emerald', icon: CircleCheckBig, subTab: 'ActiveDeliveries' },
      { label: 'Update GPS', actionColor: 'rose', icon: MapPin, subTab: 'Tracking' },
      { label: 'Scan Waybill', actionColor: 'indigo', icon: QrCode, subTab: 'Scanner' },
      { label: 'Drivers', actionColor: 'sky', icon: UserCheck, subTab: 'Drivers' },
    ],
    screens: {
      home: RiskOverviewScreen,
      RiskApprovals: RiskApprovalsScreen,
      CustomerCredit: CustomerCreditScreen,
      Recruitment: RiskRecruitmentScreen,
      Deliveries: DeliveriesScreen,
      ActiveDeliveries: ActiveDeliveriesScreen,
      Drivers: DriversScreen,
      Tracking: TrackingScreen,
      ProofOfDelivery: ProofOfDeliveryScreen,
      Scanner: ScannerScreen,
      DeptActivity: RiskDeptActivityScreen,
      Spreadsheets: RiskSpreadsheetsScreen,
    },
  },

  MANAGEMENT: {
    code: 'MANAGEMENT',
    label: 'Management',
    icon: Layers,
    defaultSubTab: 'CargoApproval',
    subTabs: [
      { id: 'CargoApproval', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'CreditApproval', label: 'Approvals', icon: ClipboardCheck },
      { id: 'Transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'SetPrices', label: 'Price Setting', icon: Tag },
      { id: 'Invoices', label: 'Invoices', icon: FileText },
      { id: 'Receipts', label: 'Receipts', icon: Receipt },
      { id: 'Ledger', label: 'Audit Log', icon: History },
      { id: 'Payroll', label: 'Payroll Overview', icon: Banknote },
      { id: 'MgmtAnalytics', label: 'Analytics', icon: ChartColumn },
      { id: 'StockManagement', label: 'Stock Management', icon: Layers },
      { id: 'DeptActivity', label: 'Dept Activity', icon: Activity },
      { id: 'PerformanceAlerts', label: 'Performance Alerts', icon: TriangleAlert },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'Approve Intake', actionColor: 'emerald', icon: CircleCheckBig, subTab: 'CargoApproval' },
      { label: 'Set Price', actionColor: 'amber', icon: Tag, subTab: 'SetPrices' },
      { label: 'Approve Credit', actionColor: 'indigo', icon: CreditCard, subTab: 'CreditApproval' },
      { label: 'View Audit Log', actionColor: 'rose', icon: ShieldAlert, subTab: 'Ledger' },
    ],
    screens: {
      home: MgmtOverviewScreen,
      CreditApproval: MgmtApprovalsScreen,
      Transactions: MgmtTransactionsScreen,
      SetPrices: SetPricesScreen,
      Invoices: MgmtInvoicesScreen,
      Receipts: MgmtReceiptsScreen,
      Ledger: LedgerScreen,
      Payroll: MgmtPayrollScreen,
      MgmtAnalytics: MgmtAnalyticsScreen,
      StockManagement: StockManagementScreen,
      DeptActivity: MgmtDeptActivityScreen,
      PerformanceAlerts: MgmtPerformanceAlertsScreen,
      Spreadsheets: MgmtSpreadsheetsScreen,
    },
  },

  HR: {
    code: 'HR',
    label: 'Human Resources',
    icon: Users,
    defaultSubTab: 'Employees',
    subTabs: [
      { id: 'Employees', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'Staff', label: 'Staff', icon: Users },
      { id: 'Attendance', label: 'Attendance', icon: UserCheck },
      { id: 'Registrations', label: 'Registrations', icon: UserPlus },
      { id: 'LeaveManagement', label: 'Leave Management', icon: Calendar },
      { id: 'Payroll', label: 'Payroll', icon: Banknote },
      { id: 'DepartmentManager', label: 'Department Manager', icon: Building2 },
      { id: 'PerformanceAlerts', label: 'Performance Alerts', icon: TriangleAlert },
      { id: 'HrQueries', label: 'HR Queries', icon: MessagesSquare },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'Add New Staff', actionColor: 'emerald', icon: UserPlus, subTab: 'Staff' },
      { label: 'Log Attendance', actionColor: 'blue', icon: ClipboardList, subTab: 'Attendance' },
      { label: 'Schedule Meeting', actionColor: 'indigo', icon: Calendar, subTab: 'Registrations' },
      { label: 'Send Announcement', actionColor: 'amber', icon: Send, subTab: 'Registrations' },
      { label: 'Approve Pending', actionColor: 'teal', icon: UserCheck, subTab: 'Registrations' },
    ],
    screens: {
      home: HrOverviewScreen,
      Staff: HrStaffScreen,
      Attendance: HrAttendanceScreen,
      Registrations: HrRegistrationsScreen,
      LeaveManagement: HrLeaveManagementScreen,
      Payroll: HrPayrollScreen,
      DepartmentManager: HrDepartmentManagerScreen,
      PerformanceAlerts: HrPerformanceAlertsScreen,
      HrQueries: HrQueriesScreen,
      Spreadsheets: HrSpreadsheetsScreen,
    },
  },

  PRODUCTION: {
    code: 'PRODUCTION',
    label: 'Production',
    icon: Activity,
    defaultSubTab: 'Requisition',
    subTabs: [
      { id: 'Requisition', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'InternalOrders', label: 'Internal Orders', icon: ClipboardList },
      { id: 'WIPStock', label: 'WIP Stock', icon: Layers },
      { id: 'OutputRecording', label: 'Output Recording', icon: Factory },
      { id: 'ProdAnalytics', label: 'Analytics', icon: ChartColumn },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'Request Materials', actionColor: 'indigo', icon: Layers, subTab: 'Requisition' },
      { label: 'Update WIP Status', actionColor: 'amber', icon: Factory, subTab: 'WIPStock' },
      { label: 'Log Output', actionColor: 'teal', icon: ChartColumn, subTab: 'OutputRecording' },
      { label: 'View Requisitions', actionColor: 'blue', icon: ClipboardList, subTab: 'InternalOrders' },
    ],
    screens: {
      home: ProductionOverviewScreen,
      InternalOrders: InternalOrdersScreen,
      WIPStock: WipStockScreen,
      OutputRecording: OutputRecordingScreen,
      ProdAnalytics: ProdAnalyticsScreen,
      Spreadsheets: ProductionSpreadsheetsScreen,
    },
  },

  CEO: {
    code: 'CEO',
    label: 'CEO Command',
    icon: ShieldCheck,
    defaultSubTab: 'Overview',
    subTabs: [
      { id: 'Overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'SupplierOrders', label: 'Supplier Orders', icon: Ship },
      { id: 'Transactions', label: 'Transactions', icon: ArrowLeftRight },
      { id: 'Invoices', label: 'Invoices', icon: FileText },
      { id: 'Receipts', label: 'Receipts', icon: Receipt },
      { id: 'PriceCatalog', label: 'Price Catalog', icon: Tag },
      { id: 'Wallets', label: 'Wallets', icon: Wallet },
      { id: 'Accounts', label: 'Accounts', icon: CreditCard },
      { id: 'Approvals', label: 'Approvals', icon: ClipboardCheck },
      { id: 'PriceApprovals', label: 'Price Approvals', icon: Tag },
      { id: 'Tracking', label: 'GPS Tracking', icon: MapPin },
      { id: 'LiveUsers', label: 'Live Users', icon: Radio },
      { id: 'DeptActivity', label: 'Dept Activity', icon: Activity },
      { id: 'Spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    ],
    quickActions: [
      { label: 'View Reports', actionColor: 'indigo', icon: ChartColumn, subTab: 'Overview' },
      { label: 'Schedule Boardroom', actionColor: 'violet', icon: Video, subTab: 'Overview' },
      { label: 'Send Alert', actionColor: 'rose', icon: TriangleAlert, subTab: 'Overview' },
      { label: 'View All Depts', actionColor: 'sky', icon: Building2, subTab: 'Overview' },
    ],
    screens: {
      home: CeoOverviewScreen,
      SupplierOrders: CeoSupplierOrdersScreen,
      Transactions: CeoTransactionsScreen,
      Invoices: CeoInvoicesScreen,
      Receipts: CeoReceiptsScreen,
      PriceCatalog: CeoPriceCatalogScreen,
      Wallets: CeoWalletsScreen,
      Accounts: CeoAccountsScreen,
      Approvals: CeoApprovalsScreen,
      PriceApprovals: CeoPriceApprovalsScreen,
      Tracking: CeoTrackingScreen,
      LiveUsers: LiveUsersScreen,
      DeptActivity: CeoDeptActivityScreen,
      Spreadsheets: CeoSpreadsheetsScreen,
    },
  },

  BOARDROOM: {
    code: 'BOARDROOM',
    label: 'Boardroom',
    icon: Video,
    defaultSubTab: 'VideoConf',
    subTabs: [
      { id: 'VideoConf', label: 'Live Video Minutes', icon: Video },
      { id: 'Announcements', label: 'Announcements', icon: Users },
      { id: 'DirectMessages', label: 'Direct Messages', icon: MessagesSquare },
      { id: 'Meetings', label: 'Meetings Organizer', icon: Clipboard },
    ],
    quickActions: [
      { label: 'Start Video Call', actionColor: 'indigo', icon: Video, subTab: 'VideoConf' },
      { label: 'Post Announcement', actionColor: 'blue', icon: Send, subTab: 'Announcements' },
      { label: 'Send Direct Message', actionColor: 'teal', icon: MessagesSquare, subTab: 'DirectMessages' },
      { label: 'Schedule Meeting', actionColor: 'amber', icon: Calendar, subTab: 'Meetings' },
    ],
    screens: {
      home: VideoConfScreen,
      Announcements: AnnouncementsScreen,
      DirectMessages: DirectMessagesScreen,
      Meetings: MeetingsScreen,
    },
  },

  SETTINGS: {
    code: 'SETTINGS',
    label: 'Settings',
    icon: ShieldCheck,
    defaultSubTab: 'Appearance',
    subTabs: [
      { id: 'Appearance', label: 'Display & Appearance', icon: Palette },
      { id: 'Profile', label: 'Profile & Account', icon: Users },
      { id: 'ChangePassword', label: 'Change Password', icon: ShieldCheck },
      { id: 'TwoFactor', label: 'Two-Factor Authentication', icon: ShieldCheck },
      { id: 'ControlCenter', label: 'Control Center', icon: Settings },
      { id: 'DeleteAccount', label: 'Delete Account', icon: UserCheck },
    ],
    quickActions: [],
    screens: {
      home: AppearanceScreen,
      Profile: ProfileAccountScreen,
      ChangePassword: ChangePasswordScreen,
      TwoFactor: TwoFactorScreen,
      ControlCenter: ControlCenterScreen,
      DeleteAccount: DeleteAccountScreen,
    },
  },
};

export function getDepartmentEntry(code: string): DepartmentEntry {
  return DEPARTMENT_REGISTRY[code] || {
    code,
    label: code,
    icon: Building2,
    defaultSubTab: '',
    subTabs: [],
    quickActions: [],
    screens: {},
  };
}

/** Departments a given user can switch into — CEO/admin see all; everyone else sees only their own. Mirrors Sidebar.tsx's availableDepts filter. */
export function availableDepartments(userDepartment: string, isAdmin: boolean): DepartmentEntry[] {
  const all = Object.values(DEPARTMENT_REGISTRY).filter(d => d.code !== 'SETTINGS');
  if (isAdmin) return all;
  return all.filter(d => d.code === userDepartment);
}
