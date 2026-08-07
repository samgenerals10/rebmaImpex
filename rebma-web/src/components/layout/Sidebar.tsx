// rebma-web/src/components/layout/Sidebar.tsx

import { useState } from 'react';
import {
  ShieldCheck, Layers, Users, TrendingUp, DollarSign, Activity, Clipboard, Truck, Video,
  Settings, LogOut, MessagesSquare, Tag, History, Warehouse, PackageCheck, FileText,
  TicketCheck, X, ChevronLeft, ChevronRight, StickyNote, CheckSquare, Mail, Bell,
  HelpCircle, MessageSquarePlus, LayoutDashboard, BarChart2, ArrowLeftRight, Wallet,
  CreditCard, ClipboardCheck, MapPin, MessageCircle, RefreshCw, Banknote, ShoppingCart,
  Package, AlertTriangle, UserCheck, Camera, UserPlus, Calendar, Building2, AlertCircle,
  FileBarChart, ClipboardList, Factory, Wrench, BarChart3, Gauge, Plus, ShoppingBag,
  Smartphone, Receipt, Calculator, PiggyBank, Shield, FileSpreadsheet, FileEdit
} from 'lucide-react';
import type { CurrentUser } from '../../types/erp';
import MiniCalendar from './MiniCalendar';
import { motion } from 'framer-motion';

interface SidebarProps {
  activeDepartment: string;
  setActiveDepartment: (dept: string) => void;
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  theme: string;
  currentUser: CurrentUser | null;
  onLogout: () => void;
  addNotification: (msg: string) => void;
  openBoardroom?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (val: boolean) => void;
  unreadEmailCount?: number;
  navBadges?: Record<string, number>;
  tabAlerts?: Record<string, number>;
  /** Real "N pending right now" totals per department, for the department
   * switcher list — only populated for viewers who can see more than their
   * own department (CEO/Super Admin today). */
  deptBadges?: Record<string, number>;
}

export default function Sidebar({
  activeDepartment,
  setActiveDepartment,
  activeSubTab,
  setActiveSubTab,
  theme,
  currentUser,
  onLogout,
  addNotification,
  openBoardroom,
  isOpen = false,
  onClose,
  sidebarCollapsed = false,
  setSidebarCollapsed,
  unreadEmailCount = 0,
  navBadges = {},
  tabAlerts = {},
  deptBadges = {}
}: SidebarProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isLiamFinance = theme === 'liamfinance';

  const [lfCollapsed, setLfCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('erp-sidebar-collapsed');
      return saved !== null ? saved === 'true' : true;
    } catch { return true; }
  });

  const handleLfCollapseToggle = () => {
    const next = !lfCollapsed;
    setLfCollapsed(next);
    try { localStorage.setItem('erp-sidebar-collapsed', String(next)); } catch {}
  };

  const isActualCollapsed = isLiamFinance
    ? lfCollapsed
    : !!sidebarCollapsed && !isHovered;

  const isAdmin = currentUser?.isAdmin || currentUser?.department === 'CEO';
  const isManagement = currentUser?.department === 'MANAGEMENT';
  const isSuperAdmin = currentUser?.isSuperAdmin ?? false;
  const userDept = currentUser?.department || 'CEO';

  const departmentTabs: Record<string, Array<{ id: string; label: string; icon: any }>> = {
    CEO: [
      { id: 'Overview',        label: 'Dashboard',            icon: LayoutDashboard },
      { id: 'SupplierOrders',  label: 'Supplier Orders',       icon: ShoppingBag },
      { id: 'Transactions',    label: 'Transactions',          icon: ArrowLeftRight },
      { id: 'Invoices',        label: 'Invoices',              icon: FileText },
      { id: 'Receipts',        label: 'Receipts',              icon: Receipt },
      { id: 'PriceCatalog',    label: 'Price Catalog',         icon: Tag },
      { id: 'Wallets',         label: 'Wallets',               icon: Wallet },
      { id: 'Accounts',        label: 'Accounts',              icon: CreditCard },
      { id: 'Approvals',       label: 'Approvals',             icon: ClipboardCheck },
      { id: 'Tracking',        label: 'GPS Tracking',          icon: MapPin },
      { id: 'Messages',        label: 'Messages & Boardroom',  icon: MessageCircle },
      { id: 'DeptActivity',    label: 'Dept Activity',          icon: Activity },
      { id: 'ControlCenter',   label: 'Control Center',         icon: Shield },
      { id: 'Spreadsheets',    label: 'Spreadsheets',           icon: FileSpreadsheet },
    ],
    FINANCE: [
      { id: 'Evaluation',        label: 'Dashboard',              icon: LayoutDashboard },
      { id: 'OrdersQueue',       label: 'Orders Queue',           icon: ClipboardList },
      { id: 'RecordPayment',     label: 'Payments',               icon: DollarSign },
      { id: 'Receipts',          label: 'Receipts',               icon: Receipt },
      { id: 'Invoices',          label: 'Invoices',               icon: FileText },
      { id: 'PriceCatalog',      label: 'Price Catalog',          icon: Tag },
      { id: 'Wallets',           label: 'Wallets',                icon: Wallet },
      { id: 'Transactions',      label: 'Transactions',           icon: ArrowLeftRight },
      { id: 'RecurringPayments', label: 'Recurring',              icon: RefreshCw },
      { id: 'CreditMgmt',        label: 'Credit Management',      icon: CreditCard },
      { id: 'Expenses',          label: 'Expenses',               icon: Receipt },
      { id: 'TaxVAT',            label: 'Tax & VAT',              icon: Calculator },
      { id: 'Cheques',           label: 'Cheques',                icon: FileText },
      { id: 'MobileMoney',       label: 'Mobile Money',           icon: Smartphone },
      { id: 'PettyCash',         label: 'Petty Cash',             icon: PiggyBank },
      { id: 'FinReports',        label: 'Reports',                icon: BarChart2 },
      { id: 'Payroll',           label: 'Payroll',                icon: Banknote },
      { id: 'Spreadsheets',      label: 'Spreadsheets',           icon: FileSpreadsheet },
    ],
    MANAGEMENT: [
      { id: 'CargoApproval',   label: 'Dashboard',           icon: LayoutDashboard },
      { id: 'CreditApproval',  label: 'Approvals',            icon: ClipboardCheck },
      { id: 'Transactions',    label: 'Transactions',         icon: ArrowLeftRight },
      { id: 'SetPrices',       label: 'Price Setting',        icon: Tag },
      { id: 'Invoices',        label: 'Invoices',             icon: FileText },
      { id: 'Receipts',        label: 'Receipts',             icon: Receipt },
      { id: 'DocumentTemplates', label: 'Document Templates', icon: FileEdit },
      { id: 'Ledger',          label: 'Audit Log',            icon: History },
      { id: 'Payroll',         label: 'Payroll Overview',     icon: Banknote },
      { id: 'MgmtAnalytics',   label: 'Analytics',            icon: BarChart2 },
      { id: 'DeptActivity',    label: 'Dept Activity',        icon: Activity },
      { id: 'PerformanceAlerts', label: 'Performance Alerts', icon: AlertCircle },
      { id: 'Spreadsheets',      label: 'Spreadsheets',       icon: FileSpreadsheet },
    ],
    HR: [
      { id: 'Employees',          label: 'Dashboard',            icon: LayoutDashboard },
      { id: 'Staff',              label: 'Staff',                 icon: Users },
      { id: 'Attendance',         label: 'Attendance',            icon: UserCheck },
      { id: 'Registrations',      label: 'Registrations',         icon: UserPlus },
      { id: 'LeaveManagement',    label: 'Leave Management',      icon: Calendar },
      { id: 'Payroll',            label: 'Payroll',               icon: Banknote },
      { id: 'DepartmentManager',  label: 'Department Manager',    icon: Building2 },
      { id: 'PerformanceAlerts',  label: 'Performance Alerts',    icon: AlertCircle },
      { id: 'Spreadsheets',       label: 'Spreadsheets',          icon: FileSpreadsheet },
    ],
    MARKETING: [
      { id: 'Overview',          label: 'Dashboard',        icon: LayoutDashboard },
      { id: 'CreateOrder',       label: 'Orders',            icon: ShoppingCart },
      { id: 'RegisterCustomer',  label: 'Customers',         icon: Users },
      { id: 'Invoices',          label: 'Invoices',          icon: FileText },
      { id: 'Receipts',          label: 'Receipts',          icon: Receipt },
      { id: 'PriceCatalog',      label: 'Price Catalog',     icon: Tag },
      { id: 'SalesHistory',      label: 'Sales History',     icon: TrendingUp },
      { id: 'CreditRequests',    label: 'Credit Requests',   icon: CreditCard },
      { id: 'MktAnalytics',      label: 'Analytics',         icon: BarChart2 },
      { id: 'Spreadsheets',      label: 'Spreadsheets',      icon: FileSpreadsheet },
    ],
    OPERATIONS: [
      { id: 'Overview',        label: 'Dashboard',            icon: LayoutDashboard },
      { id: 'PortIngestion',   label: 'Stock Intake',          icon: Package },
      { id: 'ApprovedGoods',   label: 'Approved Goods',        icon: PackageCheck },
      { id: 'Stock',           label: 'Stock',                 icon: Layers },
      { id: 'OpsHistory',      label: 'Discrepancy Reports',   icon: AlertTriangle },
      { id: 'Releases',        label: 'Fulfillment',           icon: PackageCheck },
      { id: 'OpsAnalytics',    label: 'Analytics',             icon: BarChart2 },
      { id: 'Spreadsheets',    label: 'Spreadsheets',          icon: FileSpreadsheet },
    ],
    DISPATCH: [
      { id: 'Deliveries',       label: 'Dashboard',              icon: LayoutDashboard },
      { id: 'ActiveDeliveries', label: 'Deliveries',              icon: Truck },
      { id: 'Drivers',          label: 'Drivers',                 icon: UserCheck },
      { id: 'Tracking',         label: 'GPS Tracking',            icon: MapPin },
      { id: 'ProofOfDelivery',  label: 'Proof of Delivery',       icon: Camera },
      { id: 'Spreadsheets',     label: 'Spreadsheets',             icon: FileSpreadsheet },
    ],
    HR_LOGISTICS_VIEW: [
      { id: 'FleetOverview',    label: 'Fleet Overview',        icon: Truck },
      { id: 'FuelManagement',   label: 'Fuel Management',       icon: Gauge },
      { id: 'Maintenance',      label: 'Maintenance Schedule',  icon: Wrench },
      { id: 'FleetAnalytics',   label: 'Fleet Analytics',       icon: BarChart3 },
    ],
    RECEPTION: [
      { id: 'VisitorLog',       label: 'Dashboard',             icon: LayoutDashboard },
      { id: 'Visitors',         label: 'Visitors',               icon: UserPlus },
      { id: 'EmployeeCheckin',  label: 'Attendance',             icon: UserCheck },
      { id: 'DailyReports',     label: 'Daily Reports',          icon: FileBarChart },
      { id: 'Analytics',        label: 'Analytics',              icon: BarChart2 },
      { id: 'Spreadsheets',    label: 'Spreadsheets',           icon: FileSpreadsheet },
    ],
    PRODUCTION: [
      { id: 'Requisition',       label: 'Dashboard',             icon: LayoutDashboard },
      { id: 'InternalOrders',    label: 'Internal Orders',        icon: ClipboardList },
      { id: 'WIPStock',          label: 'WIP Stock',              icon: Layers },
      { id: 'OutputRecording',   label: 'Output Recording',       icon: Factory },
      { id: 'ProdAnalytics',     label: 'Analytics',              icon: BarChart2 },
      { id: 'Spreadsheets',      label: 'Spreadsheets',           icon: FileSpreadsheet },
    ],
    LOGISTICS: [
      { id: 'Overview',          label: 'Dashboard',              icon: LayoutDashboard },
      { id: 'FleetOverview',     label: 'Fleet Overview',          icon: Truck },
      { id: 'FuelManagement',    label: 'Fuel Management',         icon: Gauge },
      { id: 'Maintenance',       label: 'Maintenance Schedule',    icon: Wrench },
      { id: 'FleetAnalytics',    label: 'Fleet Analytics',         icon: BarChart3 },
      { id: 'Spreadsheets',      label: 'Spreadsheets',            icon: FileSpreadsheet },
    ],
    BOARDROOM: [
      { id: 'VideoConf',       label: 'Live Video Minutes',   icon: Video },
      { id: 'Announcements',   label: 'Announcements',         icon: Users },
      { id: 'DirectMessages',  label: 'Direct Messages',       icon: MessagesSquare },
      { id: 'Meetings',        label: 'Meetings Organizer',    icon: Clipboard },
    ],
    SETTINGS: [
      { id: 'Appearance',      label: 'Display & Appearance',  icon: Activity },
      { id: 'Profile',         label: 'Profile & Account',     icon: Users },
      { id: 'ChangePassword',  label: 'Change Password',       icon: ShieldCheck },
      { id: 'TwoFactor',       label: 'Two-Factor Authentication', icon: ShieldCheck },
      { id: 'DeleteAccount',   label: 'Delete Account',        icon: LogOut },
    ]
  };

  const allDepts = [
    { value: 'CEO',        label: 'CEO Command' },
    { value: 'MANAGEMENT', label: 'Management Office' },
    { value: 'HR',         label: 'Human Resources' },
    { value: 'MARKETING',  label: 'Marketing Pipeline' },
    { value: 'OPERATIONS', label: 'Operations & Stock' },
    { value: 'FINANCE',    label: 'Finance Ledgers' },
    { value: 'PRODUCTION', label: 'Production Line' },
    { value: 'RECEPTION',  label: 'Reception Terminal' },
    { value: 'DISPATCH',   label: 'Dispatch Fleet' },
    { value: 'LOGISTICS',  label: 'Logistics Fleet' },
    { value: 'SETTINGS',   label: 'ERP Settings' },
  ];

  const availableDepts = allDepts.filter(d => {
    if (isSuperAdmin) return true;
    const isUserCeo = currentUser?.isAdmin || currentUser?.department?.toUpperCase() === 'CEO';
    if (isUserCeo) return true;
    const rawDept = currentUser?.department || '';
    const normalizedUserDept = rawDept.toUpperCase() === 'HUMAN RESOURCES' ? 'HR' : rawDept.toUpperCase();
    if (d.value === 'SETTINGS') return true;
    if (normalizedUserDept === 'HR') return d.value === 'HR';
    return d.value === normalizedUserDept;
  });

  const getIconForDept = (val: string) => {
    if (val === 'CEO') return ShieldCheck;
    if (val === 'MANAGEMENT') return Layers;
    if (val === 'HR') return Users;
    if (val === 'MARKETING') return TrendingUp;
    if (val === 'OPERATIONS') return Warehouse;
    if (val === 'FINANCE') return DollarSign;
    if (val === 'PRODUCTION') return Activity;
    if (val === 'RECEPTION') return Users;
    if (val === 'DISPATCH') return Truck;
    if (val === 'LOGISTICS') return Truck;
    return Settings;
  };

  const handleBoardroomClick = () => {
    if (openBoardroom) openBoardroom();
    else { setActiveDepartment('BOARDROOM'); setActiveSubTab('VideoConf'); }
    addNotification('Opening Executive Boardroom hub.');
  };

  const showLogisticsSection = isAdmin || isManagement || currentUser?.department === 'HR';

  // Render nav button for a tab
  const renderNavBtn = (tab: { id: string; label: string; icon: any }, _badge = 0) => {
    const Icon = tab.icon;
    const isActive = activeSubTab === tab.id;
    const badge = (navBadges[tab.id] ?? 0) || _badge;

    if (isLiamFinance) {
      return (
        <button
          key={tab.id}
          onClick={() => setActiveSubTab(tab.id)}
          className={`lf-nav-item w-full flex items-center ${lfCollapsed ? 'justify-center' : 'gap-3 px-3'} py-1 transition-all duration-200 cursor-pointer rounded-xl hover:bg-[var(--accent-light)] hover:scale-[1.02]`}
          style={{ background: isActive ? 'var(--accent-light)' : 'transparent', border: 'none' }}
          title={tab.label}
        >
          <span className={`lf-nav-icon flex-shrink-0 relative ${tab.id === 'SetPrices' && badge > 0 ? 'red-pilot' : ''}`} style={{
            width: 40, height: 40, borderRadius: '50%',
            background: isActive ? 'var(--accent)' : 'var(--lf-icon-bg, #eef0f3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 18, height: 18, color: isActive ? '#fff' : 'var(--text-secondary)' }} />
            {badge > 0 && tab.id !== 'SetPrices' && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center animate-[badge-pulse_1.4s_ease-in-out_infinite]">{badge > 9 ? '9+' : badge}</span>}
          </span>
          {!lfCollapsed && (
            <span className="nav-label truncate text-xs font-semibold" style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {tab.label}
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        key={tab.id}
        onClick={() => setActiveSubTab(tab.id)}
        className={`nav-item ${isActive ? 'nav-item--active' : 'hover:bg-[var(--accent-light)] hover:text-[var(--accent)] hover:scale-[1.02]'} w-full flex items-center ${isActualCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer relative`}
        style={isActive ? { background: 'var(--accent)', color: '#ffffff' } : { color: 'var(--text-sidebar, var(--text-secondary))' }}
        title={tab.label}
      >
        <span className={`nav-icon flex-shrink-0 relative ${tab.id === 'SetPrices' && badge > 0 ? 'red-pilot' : ''}`}>
          <Icon className="w-4 h-4" style={{ color: isActive ? '#ffffff' : undefined }} />
          {badge > 0 && tab.id !== 'SetPrices' && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center animate-[badge-pulse_1.4s_ease-in-out_infinite]">{badge > 9 ? '9+' : badge}</span>}
        </span>
        <span className={`nav-label truncate transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>{tab.label}</span>
        {badge > 0 && !isActualCollapsed && !isActive && (
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white animate-[badge-pulse_1.4s_ease-in-out_infinite]">{badge > 9 ? '9+' : badge}</span>
        )}
      </button>
    );
  };

  const sectionLabel = (label: string) => (
    <div className={`text-[9px] uppercase text-[var(--text-muted)] tracking-widest font-bold px-4 mb-1.5 mt-3 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 overflow-hidden' : ''}`}>
      {label}
    </div>
  );

  const currentTabs = departmentTabs[activeDepartment] || [];

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`sidebar-shell fixed top-0 bottom-0 left-0 z-50 flex flex-col shadow-2xl select-none transform transition-all duration-300 ease-in-out
        w-[80vw] max-w-[320px] rounded-r-3xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:top-0 lg:bottom-0 lg:left-0 lg:rounded-none lg:border-r lg:border-[var(--border)] lg:translate-x-0 lg:shadow-[var(--box-shadow)]
        ${isActualCollapsed ? 'lg:w-[var(--sidebar-collapsed-width,68px)]' : 'lg:w-[var(--sidebar-width,260px)]'}
      `}
    >
      {/* ── MOBILE DRAWER VIEW ── */}
      <div className="lg:hidden flex flex-col h-full justify-between py-6 px-4" style={{ color: 'var(--text-sidebar, var(--text-primary))' }}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-8 h-8 object-contain rounded bg-bg-card/20 p-0.5" alt="REBMA IMPEX Logo" />
              <div>
                <h2 className="font-extrabold text-xs tracking-wider leading-tight text-[var(--text-primary)]">REBMA IMPEX</h2>
                <span className="text-[9px] uppercase text-[var(--accent,#068d5c)] font-mono tracking-widest leading-none">GHANA</span>
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--accent-light)] text-text-muted cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {/* User */}
          <div className="py-4 flex items-center gap-2.5 border-b border-[var(--border)] shrink-0">
            <div className="w-10 h-10 rounded-full bg-[var(--accent,#068d5c)] text-white flex items-center justify-center font-bold text-sm shrink-0 relative overflow-hidden">
              {currentUser?.photo ? (
                <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                currentUser?.fullName?.[0] || 'U'
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white z-10" />
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold leading-none truncate text-[var(--text-primary)]">{currentUser?.fullName}</p>
              <p className="text-[10px] text-text-secondary leading-none mt-1 truncate">{currentUser?.department}</p>
            </div>
          </div>
          {/* Channels */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            <div>
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest px-2 mb-1.5">Channels</p>
              <div className="space-y-1">
                {availableDepts.map(dept => {
                  const isSelected = dept.value === activeDepartment;
                  return (
                    <button key={dept.value} type="button" onClick={() => { setActiveDepartment(dept.value); onClose?.(); }}
                      className={`w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left truncate ${isSelected ? 'bg-[var(--accent,#068d5c)] text-white font-extrabold' : 'text-text-secondary hover:bg-[var(--accent-light)]'}`}>
                      <span className="opacity-50 mr-1.5">#</span>
                      <span className="truncate">{dept.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-1.5 shrink-0">
          <button onClick={() => { setActiveDepartment('SETTINGS'); setActiveSubTab('Appearance'); onClose?.(); }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-[var(--accent-light)] transition-colors">
            <Settings className="w-4 h-4" /><span>Settings</span>
          </button>
          <button onClick={onLogout} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
            <LogOut className="w-4 h-4" /><span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className={`hidden lg:flex flex-col h-full overflow-hidden justify-between py-4 ${isActualCollapsed ? 'px-1' : 'px-3'} transition-all duration-300`}>
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* Logo */}
          <div className={`flex items-center justify-between ${isActualCollapsed ? 'px-1' : 'px-2'} mb-4 shrink-0`}>
            <div className="flex items-center gap-3">
              <img src="/logo.png" className="w-9 h-9 object-contain rounded-lg bg-bg-card p-0.5 shrink-0 shadow-card" alt="REBMA IMPEX Logo" />
              <div className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <h2 className="font-bold text-sm tracking-wide leading-none text-[var(--text-primary)]">REBMA IMPEX</h2>
                <span className="text-[10px] uppercase text-[var(--accent)] tracking-widest font-bold font-mono">GHANA</span>
              </div>
            </div>
          </div>

          {/* Super Admin indicator */}
          {isSuperAdmin && (
            <div className={`mb-3 shrink-0 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
              <div className="mx-2 px-3 py-1 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Full Access Mode</span>
              </div>
            </div>
          )}

          {/* Department Switcher */}
          <div className="mb-3 px-1 relative shrink-0">
            <label className={`block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 overflow-hidden' : ''}`}>Switch Department</label>
            <button type="button" onClick={() => setIsSwitcherOpen(prev => !prev)}
              className={`w-full flex items-center ${isActualCollapsed ? 'justify-center py-2 px-0' : 'justify-between py-2 px-3'} bg-[var(--bg)] hover:bg-[var(--accent-light)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs focus:outline-none transition-all cursor-pointer font-semibold`}
              title="Switch Department">
              <div className="flex items-center gap-2">
                {(() => { const I = getIconForDept(activeDepartment); return <I className="w-4 h-4 text-[var(--accent)] shrink-0" />; })()}
                <span className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                  {allDepts.find(d => d.value === activeDepartment)?.label || activeDepartment}
                </span>
              </div>
              <span className={`text-[9px] text-[var(--text-secondary)] opacity-75 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>▼</span>
            </button>
            {isSwitcherOpen && (
              <>
                <div className="fixed inset-0 bg-black/60 z-[250] lg:hidden" onClick={() => setIsSwitcherOpen(false)} />
                <div className="fixed inset-0 z-[250] hidden lg:block" onClick={() => setIsSwitcherOpen(false)} />
                <div className={`fixed inset-x-0 bottom-0 lg:absolute lg:top-full lg:bottom-auto max-h-[80vh] lg:max-h-72 bg-[var(--bg-card)] border-t lg:border border-[var(--border)] rounded-t-3xl lg:rounded-xl p-4 lg:p-1.5 z-[260] overflow-y-auto shadow-xl flex flex-col gap-0.5 ${isActualCollapsed ? 'lg:w-[200px] lg:left-0' : 'lg:inset-x-0'}`}>
                  <div className="lg:hidden w-12 h-1 bg-bg-card/20 rounded-full mx-auto mb-2 shrink-0" />
                  {availableDepts.map(dept => {
                    const isSelected = dept.value === activeDepartment;
                    const DI = getIconForDept(dept.value);
                    const hasAlert = (tabAlerts[dept.value] || 0) > 0;
                    const pendingCount = deptBadges[dept.value] || 0;
                    return (
                      <button key={dept.value} type="button" onClick={() => { setActiveDepartment(dept.value); setIsSwitcherOpen(false); }}
                        className={`relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isSelected ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-primary)] hover:bg-[var(--accent-light)]'}`}>
                        <div className="flex items-center gap-2">
                          <DI className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[var(--accent)]'}`} />
                          <span>{dept.label}</span>
                          {hasAlert && !isSelected && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                          {pendingCount > 0 && (
                            <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center animate-[badge-pulse_1.4s_ease-in-out_infinite] ${isSelected ? 'bg-white text-[var(--accent)]' : 'bg-rose-500 text-white'}`}>
                              {pendingCount > 9 ? '9+' : pendingCount}
                            </span>
                          )}
                        </div>
                        {isSelected && <span className="text-white font-extrabold">✓</span>}
                        {isSelected && (
                          <motion.div
                            layoutId="dept-switcher-underline"
                            className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-white"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {!isSuperAdmin && (isAdmin || isManagement) && activeDepartment !== userDept && activeDepartment !== 'SETTINGS' && (
              <div className={`mt-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/35 rounded-lg text-[9px] text-amber-700 font-semibold text-center transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 py-0 border-none overflow-hidden' : ''}`}>
                👁 VIEW ONLY — {isAdmin ? 'CEO' : 'MANAGEMENT'} ACCESS
              </div>
            )}
          </div>

          {/* ── SCROLLABLE NAV AREA ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* FINANCE: Grouped E-Commerce Portal Navigation */}
            {activeDepartment === 'FINANCE' ? (
              <>
                {sectionLabel('E-Commerce Core')}
                <div className="space-y-0.5">
                  {[
                    { id: 'Evaluation',    label: 'Dashboard',       icon: LayoutDashboard },
                    { id: 'OrdersQueue',   label: 'Sales Orders',    icon: ClipboardList },
                    { id: 'RecordPayment', label: 'Payments',        icon: DollarSign },
                    { id: 'Receipts',      label: 'Receipts',        icon: Receipt },
                    { id: 'Invoices',      label: 'Invoices',        icon: FileText },
                    { id: 'PriceCatalog',  label: 'Price Catalog',   icon: Tag },
                  ].map(tab => renderNavBtn(tab))}
                </div>

                {sectionLabel('Treasury & Accounts')}
                <div className="space-y-0.5">
                  {[
                    { id: 'Wallets',           label: 'Wallets & Bank',     icon: Wallet },
                    { id: 'Transactions',      label: 'Transactions',        icon: ArrowLeftRight },
                    { id: 'CreditMgmt',        label: 'Credit & Receivables',icon: CreditCard },
                    { id: 'Cheques',           label: 'Cheques',             icon: FileText },
                    { id: 'MobileMoney',       label: 'Mobile Money',        icon: Smartphone },
                    { id: 'PettyCash',         label: 'Petty Cash',          icon: PiggyBank },
                  ].map(tab => renderNavBtn(tab))}
                </div>

                {sectionLabel('Expenses & Liabilities')}
                <div className="space-y-0.5">
                  {[
                    { id: 'Expenses',          label: 'Merchant Expenses',   icon: Receipt },
                    { id: 'Payroll',           label: 'Payroll',             icon: Banknote },
                    { id: 'RecurringPayments', label: 'Recurring Bills',     icon: RefreshCw },
                  ].map(tab => renderNavBtn(tab))}
                </div>

                {sectionLabel('Reports & Auditing')}
                <div className="space-y-0.5">
                  {[
                    { id: 'Statement',    label: 'Statement',          icon: History },
                    { id: 'TaxVAT',       label: 'Tax & VAT',         icon: Calculator },
                    { id: 'FinReports',   label: 'Financial Reports',  icon: BarChart2 },
                    { id: 'Spreadsheets', label: 'Spreadsheets',       icon: FileSpreadsheet },
                  ].map(tab => renderNavBtn(tab))}
                </div>
              </>
            ) : (
              <>
                {/* Default flat MENU for all other departments */}
                {sectionLabel('Menu')}
                <div className="space-y-0.5">
                  {currentTabs.map(tab => renderNavBtn(tab))}
                </div>

                {/* LOGISTICS section (CEO / Management / HR only) */}
                {showLogisticsSection && (
                  <>
                    {sectionLabel('Logistics & Fleet')}
                    <div className="space-y-0.5">
                      {departmentTabs['HR_LOGISTICS_VIEW'].map(tab => renderNavBtn(tab))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* PERSONAL section */}
            {sectionLabel('Personal')}
            <div className="space-y-0.5">
              {[
                { id: 'Notes',         label: 'Notes',    icon: StickyNote,   badge: 0 },
                { id: 'Tasks',         label: 'Tasks',    icon: CheckSquare,  badge: 0 },
                { id: 'Emails',        label: 'Emails',   icon: Mail,         badge: unreadEmailCount },
                { id: 'Notifications', label: 'Activity', icon: Bell,         badge: 0 },
              ].map(t => renderNavBtn(t, t.badge))}
            </div>

            {/* MINI CALENDAR */}
            <MiniCalendar isCollapsed={isActualCollapsed} />

            {/* SUPPORT section */}
            {sectionLabel('Support')}
            <div className="space-y-0.5">
              {[
                { id: 'HelpDesk', label: 'Help & News', icon: HelpCircle },
                { id: 'Feedback', label: 'Feedback',    icon: MessageSquarePlus },
              ].map(t => renderNavBtn(t))}
            </div>
          </div>
        </div>

        {/* ── PROMO CARDS (theme-specific) ── */}
        {theme === 'aczone' && !isActualCollapsed && (
          <div className="aczone-sidebar-promo mb-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            </div>
            <p className="text-[11px] font-extrabold text-white leading-snug">Good cargo<br />Great deals</p>
          </div>
        )}
        {theme === 'finova' && !isActualCollapsed && (
          <div className="finova-sidebar-promo mb-2 shrink-0">
            <p className="text-[10px] font-extrabold text-white leading-snug">Save more<br />Grow more</p>
            <button className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer mt-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
        {theme === 'foodie' && !isActualCollapsed && (
          <div className="foodie-upgrade-card mx-2 mb-2 shrink-0">
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest mb-1">Pro Plan</p>
            <p className="text-xs font-bold text-white leading-snug mb-2">Unlock advanced analytics & multi-port tracking</p>
            <button className="w-full bg-white text-[#7c3aed] text-[10px] font-bold py-1.5 rounded-lg hover:bg-white/90 transition-colors cursor-pointer">Upgrade to Pro</button>
          </div>
        )}

        {/* ── BOTTOM SECTION ── */}
        <div className="space-y-2 pt-3 border-t border-[var(--border)] shrink-0">
          <button onClick={() => { setActiveDepartment('SETTINGS'); setActiveSubTab('Appearance'); }}
            className={`w-full flex items-center ${isActualCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeDepartment === 'SETTINGS' ? 'bg-[var(--accent-light)] text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}
            title="Settings">
            <Settings className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            <span className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Settings</span>
          </button>

          <div className={`px-2 flex items-center ${isActualCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'}`}>
            <div className={`flex items-center ${isActualCollapsed ? 'justify-center' : 'gap-2'} truncate`}>
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-card overflow-hidden relative">
                {currentUser?.photo ? (
                  <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  currentUser?.fullName?.[0] || 'U'
                )}
              </div>
              <div className={`truncate transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <p className="text-xs font-semibold text-[var(--text-primary)] leading-none truncate">{currentUser?.fullName}</p>
                <p className="text-[10px] text-[var(--text-secondary)] leading-none mt-1 truncate">{currentUser?.department}</p>
              </div>
            </div>
            <button onClick={onLogout} className="p-1.5 hover:bg-[var(--accent-light)] rounded-lg text-rose-500 cursor-pointer shrink-0 transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Collapse Toggle */}
          {(isLiamFinance || setSidebarCollapsed) && (
            <button
              onClick={() => isLiamFinance ? handleLfCollapseToggle() : setSidebarCollapsed?.(!sidebarCollapsed)}
              className={`hidden lg:flex items-center justify-center w-full py-2 border-t border-[var(--border)] hover:bg-[var(--accent-light)] text-[var(--text-secondary)] transition-colors cursor-pointer rounded-xl ${isActualCollapsed ? 'px-0' : 'gap-2 px-4'}`}
              title={isActualCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}>
              {isActualCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-xs font-semibold">Collapse</span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
