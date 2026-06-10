// rebma-web/src/components/layout/Sidebar.tsx

import { useState } from 'react';
import { 
  ShieldCheck, 
  Layers, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Clipboard, 
  Truck, 
  Video,
  Settings, 
  Plus, 
  LogOut,
  MessagesSquare,
  Tag,
  History,
  Warehouse,
  PackageCheck,
  FileText,
  TicketCheck,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { CurrentUser } from '../../types/erp';

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
}

const getChannelName = (val: string) => {
  if (val === 'CEO') return 'ceo-command';
  if (val === 'MANAGEMENT') return 'management-office';
  if (val === 'HR') return 'human-resources';
  if (val === 'MARKETING') return 'marketing-pipeline';
  if (val === 'OPERATIONS') return 'operations-warehouse';
  if (val === 'FINANCE') return 'finance-ledgers';
  if (val === 'PRODUCTION') return 'production-line';
  if (val === 'RECEPTION') return 'reception-desk';
  if (val === 'DISPATCH') return 'dispatch-fleet';
  if (val === 'LOGISTICS') return 'logistics-fleet';
  if (val === 'BOARDROOM') return 'executive-boardroom';
  if (val === 'SETTINGS') return 'erp-settings';
  return val.toLowerCase().replace(/[^a-z0-9]+/g, '-');
};

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
  setSidebarCollapsed
}: SidebarProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isActualCollapsed = !!sidebarCollapsed && !isHovered;
  
  // CEO and Management can view any department (CEO can view all, Management can view all except CEO)
  const isCeo = currentUser?.isCeo || currentUser?.department === 'CEO';
  const isManagement = currentUser?.department === 'MANAGEMENT';
  const userDept = currentUser?.department || 'CEO';

  const departmentTabs: Record<string, Array<{ id: string; label: string; icon: any }>> = {
    CEO: [
      { id: 'Overview', label: 'Executive Overview', icon: ShieldCheck },
      { id: 'Tracking', label: 'Accra GPS Tracking', icon: Truck },
      { id: 'Boardroom', label: 'Boardroom Hub', icon: Video },
      { id: 'ERPSettings', label: 'ERP Settings', icon: Settings },
    ],
    MANAGEMENT: [
      { id: 'CargoApproval', label: 'Port Cargo Approval', icon: Layers },
      { id: 'CreditApproval', label: 'Credit Approvals', icon: ShieldCheck },
      { id: 'Ledger', label: 'Global Audit Ledger', icon: Clipboard },
      { id: 'SetPrices', label: 'Set Prices', icon: Tag },
      { id: 'MgmtHistory', label: 'Decision History', icon: History },
    ],
    HR: [
      { id: 'Employees', label: 'Employee Database', icon: Users },
      { id: 'Attendance', label: 'Attendance Records', icon: Clipboard },
      { id: 'Performance', label: 'Staff Performance', icon: TrendingUp },
    ],
    MARKETING: [
      { id: 'CreateOrder', label: 'Create Sales Order', icon: Plus },
      { id: 'RegisterCustomer', label: 'Register Customer', icon: Users },
      { id: 'SalesHistory', label: 'Sales & Customers', icon: Clipboard },
    ],
    OPERATIONS: [
      { id: 'PortIngestion', label: 'Log Port Cargo', icon: Plus },
      { id: 'Releases', label: 'Fulfillment Releases', icon: TicketCheck },
      { id: 'LoggedCargo', label: 'Intake Records Log', icon: Clipboard },
      { id: 'OpsHistory', label: 'Operations History', icon: History },
    ],
    FINANCE: [
      { id: 'Evaluation', label: 'Payment Terms Queue', icon: DollarSign },
      { id: 'Invoices', label: 'Invoice Portal', icon: FileText },
      { id: 'RecordPayment', label: 'Record Inbound Payment', icon: Plus },
      { id: 'Tickets', label: 'Receipts & Tickets', icon: TicketCheck },
      { id: 'WarehouseHistory', label: 'Warehouse History', icon: Warehouse },
      { id: 'IntakeForm', label: 'Finance Intake Form', icon: Clipboard },
    ],
    PRODUCTION: [
      { id: 'Requisition', label: 'Raw Materials Request', icon: Activity },
      { id: 'RawMaterials', label: 'Materials History', icon: PackageCheck },
      { id: 'WIPStock', label: 'WIP & Stock Inventory', icon: Layers },
      { id: 'OrdersHistory', label: 'Production History', icon: History },
    ],
    RECEPTION: [
      { id: 'VisitorLog', label: 'Visitor Badges Log', icon: Users },
      { id: 'EmployeeCheckin', label: 'Employee Check-in', icon: ShieldCheck },
      { id: 'Kiosk', label: 'Self-Service Kiosk', icon: Clipboard },
    ],
    DISPATCH: [
      { id: 'Deliveries', label: 'Active Deliveries Map', icon: Truck },
      { id: 'DispatchHistory', label: 'Delivery History', icon: History },
      { id: 'DriverLogs', label: 'Driver Activities', icon: Users },
    ],
    LOGISTICS: [
      { id: 'Maintenance', label: 'Fleet Maintenance', icon: Settings },
      { id: 'Fuel', label: 'Fuel Usage & Metrics', icon: TrendingUp },
      { id: 'Dispatch', label: 'Active Dispatch Queue', icon: Truck },
    ],
    BOARDROOM: [
      { id: 'VideoConf', label: 'Live Video Minutes', icon: Video },
      { id: 'Announcements', label: 'Announcements', icon: Users },
      { id: 'DirectMessages', label: 'Direct Messages', icon: MessagesSquare },
      { id: 'Meetings', label: 'Meetings Organizer', icon: Clipboard },
    ],
    SETTINGS: [
      { id: 'Themes', label: 'Custom ERP Themes', icon: Settings },
      { id: 'Appearance', label: 'Display & Appearance', icon: Activity },
      { id: 'Profile', label: 'Profile & Account', icon: Users },
      { id: 'ChangePassword', label: 'Change Password', icon: ShieldCheck },
      { id: 'DeleteAccount', label: 'Delete Account', icon: LogOut },
    ]
  };

  // Build allowed departments list for the dropdown
  const allDepts = [
    { value: 'CEO', label: 'CEO Command' },
    { value: 'MANAGEMENT', label: 'Management Office' },
    { value: 'HR', label: 'Human Resources' },
    { value: 'MARKETING', label: 'Marketing Pipeline' },
    { value: 'OPERATIONS', label: 'Operations & Stock' },
    { value: 'FINANCE', label: 'Finance Ledgers' },
    { value: 'PRODUCTION', label: 'Production Line' },
    { value: 'RECEPTION', label: 'Reception Terminal' },
    { value: 'DISPATCH', label: 'Dispatch Fleet' },
    { value: 'LOGISTICS', label: 'Logistics Fleet' },
    { value: 'BOARDROOM', label: 'Executive Boardroom' },
    { value: 'SETTINGS', label: 'ERP Settings' },
  ];

  // Access control filter
  const availableDepts = allDepts.filter(d => {
    const isUserCeo = currentUser?.isCeo || currentUser?.department?.toUpperCase() === 'CEO';
    if (isUserCeo) return true; // CEO sees all departments
    
    // Normalize user department to match dropdown values
    const rawDept = currentUser?.department || '';
    const normalizedUserDept = rawDept.toUpperCase() === 'HUMAN RESOURCES' ? 'HR' : rawDept.toUpperCase();
    
    if (d.value === 'BOARDROOM' || d.value === 'SETTINGS') return true;
    
    if (normalizedUserDept === 'HR') {
      return d.value === 'HR';
    }
    
    return d.value === normalizedUserDept;
  });

  const handleBoardroomClick = () => {
    if (openBoardroom) {
      openBoardroom();
    } else {
      setActiveDepartment('BOARDROOM');
      setActiveSubTab('VideoConf');
    }
    addNotification('Opening Executive Boardroom hub.');
  };

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[320px] bg-[var(--bg-card)] text-[var(--text-primary)] rounded-r-3xl flex flex-col justify-between shadow-2xl select-none transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:rounded-none lg:bg-[var(--bg-card)] lg:text-[var(--text-primary)] lg:border-r lg:border-[var(--border)] lg:static lg:translate-x-0 lg:shadow-none transition-all duration-300 ${isActualCollapsed ? 'lg:w-[60px]' : 'lg:w-[260px]'}`}
    >
      {/* 1. MOBILE STYLE VIEW */}
      <div className="lg:hidden flex flex-col h-full justify-between py-6 px-4 bg-[var(--bg-card)] text-[var(--text-primary)]">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Top Header Section */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                className="w-8 h-8 object-contain rounded bg-white/20 p-0.5" 
                alt="REBMA GHANA Logo" 
              />
              <div>
                <h2 className="font-extrabold text-xs tracking-wider leading-tight text-[var(--text-primary)]">REBMA IMPEX</h2>
                <span className="text-[9px] uppercase text-[var(--accent,#068d5c)] font-mono tracking-widest leading-none">GHANA</span>
              </div>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* User Profile Section */}
          <div className="py-4 flex items-center gap-2.5 border-b border-[var(--border)] shrink-0">
            <div className="w-10 h-10 rounded-full bg-[var(--accent,#068d5c)] text-white flex items-center justify-center font-bold text-sm shrink-0 relative">
              {currentUser?.fullName?.[0] || 'U'}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold leading-none truncate text-[var(--text-primary)]">{currentUser?.fullName}</p>
              <p className="text-[10px] text-slate-500 leading-none mt-1 truncate">{currentUser?.department}</p>
            </div>
          </div>

          {/* Middle Channels Section */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1.5">Channels</p>
              <div className="space-y-1">
                {availableDepts.map(dept => {
                  const isSelected = dept.value === activeDepartment;
                  const channelName = getChannelName(dept.value);
                  return (
                    <button
                      key={dept.value}
                      type="button"
                      onClick={() => {
                        setActiveDepartment(dept.value);
                        // Reset sub-tab based on department defaults
                        const defaultSubTabs: Record<string, string> = {
                          CEO: 'Overview', MANAGEMENT: 'CargoApproval', HR: 'Employees',
                          MARKETING: 'CreateOrder', OPERATIONS: 'PortIngestion', FINANCE: 'Evaluation',
                          PRODUCTION: 'Requisition', RECEPTION: 'VisitorLog', DISPATCH: 'Deliveries',
                          LOGISTICS: 'Maintenance', BOARDROOM: 'VideoConf', SETTINGS: 'Appearance'
                        };
                        setActiveSubTab(defaultSubTabs[dept.value] || 'Overview');
                        onClose?.();
                      }}
                      className={`w-full flex items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left truncate ${
                        isSelected 
                          ? 'bg-[var(--accent,#068d5c)] text-white font-extrabold shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="opacity-50 mr-1.5">#</span>
                      <span className="truncate">{channelName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => { setActiveDepartment('SETTINGS'); setActiveSubTab('Appearance'); onClose?.(); }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeDepartment === 'SETTINGS' ? 'bg-slate-100 dark:bg-slate-800 text-[var(--accent,#068d5c)] font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Settings</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 2. DESKTOP VIEW */}
      <div className={`hidden lg:flex flex-col h-full justify-between py-6 ${isActualCollapsed ? 'px-1' : 'px-4'} transition-all duration-300`}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Header */}
          <div className={`flex items-center justify-between ${isActualCollapsed ? 'px-1' : 'px-3'} mb-6 transition-all duration-300`}>
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                className="w-9 h-9 object-contain rounded-lg bg-white p-0.5 shrink-0 select-none pointer-events-none shadow-sm" 
                alt="REBMA GHANA Logo" 
              />
              <div className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <h2 className="font-bold text-sm tracking-wide leading-none text-[var(--text-primary)]">REBMA IMPEX</h2>
                <span className="text-[10px] uppercase text-[var(--accent)] tracking-widest font-bold font-mono">GHANA</span>
              </div>
            </div>
          </div>

          {/* User Profile Section */}
          <div className={`mb-5 ${isActualCollapsed ? 'px-1 py-1 justify-center' : 'px-3 py-3'} bg-[var(--accent-light)] rounded-2xl flex items-center gap-3 border border-[var(--border)] relative transition-all duration-300`}>
            <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm shrink-0 relative shadow-sm">
              {currentUser?.fullName?.[0] || 'U'}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className={`truncate flex-1 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              <p className="text-xs font-semibold leading-none truncate text-[var(--text-primary)]">{currentUser?.fullName}</p>
              <p className="text-[10px] text-[var(--text-secondary)] leading-none mt-1 truncate">{currentUser?.department}</p>
            </div>
          </div>

          {/* Boardroom Quick Launch Button */}
          <div className="mb-4 px-1">
            <button 
              onClick={handleBoardroomClick}
              className={`w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent-light)] text-[var(--accent)] rounded-full font-semibold shadow-sm border border-[var(--border)] hover:scale-[1.02] transition-all duration-200 cursor-pointer text-xs ${isActualCollapsed ? 'px-0' : ''}`}
              title="Executive Boardroom"
            >
              <MessagesSquare className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Executive Boardroom</span>
            </button>
          </div>

          {/* Department Switcher Dropdown */}
          <div className="mb-5 px-1 relative">
            <label className={`block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 overflow-hidden' : ''}`}>Switch Department</label>
            <button
              type="button"
              onClick={() => setIsSwitcherOpen(prev => !prev)}
              className={`w-full flex items-center ${isActualCollapsed ? 'justify-center py-2.5 px-0' : 'justify-between py-2.5 px-3'} bg-[var(--bg)] hover:bg-[var(--accent-light)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs focus:outline-none transition-all cursor-pointer font-semibold shadow-sm`}
              title="Switch Department"
            >
              <div className="flex items-center gap-2 justify-center">
                {(() => {
                  const getIconComponent = (val: string) => {
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
                    if (val === 'BOARDROOM') return Video;
                    return Settings;
                  };
                  const SelectedIcon = getIconComponent(activeDepartment);
                  return <SelectedIcon className="w-4 h-4 text-[var(--accent)] shrink-0" />;
                })()}
                <span className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                  {allDepts.find(d => d.value === activeDepartment)?.label || activeDepartment}
                </span>
              </div>
              <span className={`text-[9px] text-[var(--text-secondary)] opacity-75 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>▼</span>
            </button>
            
            {/* Switcher Popover / Sheet */}
            {isSwitcherOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/60 z-[250] lg:hidden"
                  onClick={() => setIsSwitcherOpen(false)}
                />
                <div 
                  className="fixed inset-0 z-[250] hidden lg:block"
                  onClick={() => setIsSwitcherOpen(false)}
                />
                
                <div className={`fixed inset-x-0 bottom-0 lg:absolute lg:top-full lg:bottom-auto max-h-[80vh] lg:max-h-80 bg-[var(--bg-card)] border-t lg:border border-[var(--border)] rounded-t-3xl lg:rounded-xl p-5 lg:p-1.5 z-[260] overflow-y-auto shadow-xl flex flex-col gap-1 animate-fade-in-up transition-all duration-300 ${isActualCollapsed ? 'lg:w-[200px] lg:left-0' : 'lg:inset-x-0'}`}>
                  {/* Mobile Grab Handle */}
                  <div className="lg:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-1 shrink-0" />
                  
                  <div className="flex justify-between items-center lg:hidden mb-1">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Switch Department</h3>
                    <button onClick={() => setIsSwitcherOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs">Close</button>
                  </div>

                  <div className="space-y-0.5">
                    {availableDepts.map(dept => {
                      const isSelected = dept.value === activeDepartment;
                      const getIconComponent = (val: string) => {
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
                        if (val === 'BOARDROOM') return Video;
                        return Settings;
                      };
                      const DeptIcon = getIconComponent(dept.value);
                      return (
                        <button
                          key={dept.value}
                          type="button"
                          onClick={() => {
                            setActiveDepartment(dept.value);
                            // Reset sub-tab based on department defaults
                            const defaultSubTabs: Record<string, string> = {
                              CEO: 'Overview', MANAGEMENT: 'CargoApproval', HR: 'Employees',
                              MARKETING: 'CreateOrder', OPERATIONS: 'PortIngestion', FINANCE: 'Evaluation',
                              PRODUCTION: 'Requisition', RECEPTION: 'VisitorLog', DISPATCH: 'Deliveries',
                              LOGISTICS: 'Maintenance', BOARDROOM: 'VideoConf', SETTINGS: 'Themes'
                            };
                            setActiveSubTab(defaultSubTabs[dept.value] || 'Overview');
                            setIsSwitcherOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-[var(--accent)] text-white shadow-sm font-bold' 
                              : 'text-[var(--text-primary)] hover:bg-[var(--accent-light)]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <DeptIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[var(--accent)]'} shrink-0`} />
                            <span>{dept.label}</span>
                          </div>
                          {isSelected && <span className="text-white font-extrabold text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* View-only badge for CEO/Management viewing other depts */}
            {(isCeo || isManagement) && activeDepartment !== userDept && activeDepartment !== 'BOARDROOM' && activeDepartment !== 'SETTINGS' && (
              <div className={`mt-1.5 px-2 py-1 bg-amber-500/15 border border-amber-500/35 rounded-lg text-[9px] text-amber-700 dark:text-amber-300 font-semibold text-center transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 py-0 border-none overflow-hidden' : ''}`}>
                👁 VIEW ONLY — {isCeo ? 'CEO' : 'MANAGEMENT'} ACCESS
              </div>
            )}
          </div>

          {/* Department Sub-Menu */}
          <nav className="space-y-1 flex-1 overflow-y-auto pr-0.5">
            <div className={`text-[9px] uppercase text-[var(--text-secondary)] tracking-widest font-bold px-4 mb-2 transition-all duration-300 ${isActualCollapsed ? 'opacity-0 h-0 overflow-hidden' : ''}`}>
              {activeDepartment} Controls
            </div>
            {departmentTabs[activeDepartment]?.map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`w-full flex items-center ${isActualCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-[var(--accent-light)] text-[var(--accent)] font-bold shadow-sm' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]'
                  }`}
                  title={tab.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
                  <span className={`truncate transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom section: Settings + User Card + Logout + Collapse Toggle */}
        <div className="space-y-3 pt-4 border-t border-[var(--border)] pb-6">
          {/* Settings shortcut */}
          <button
            onClick={() => { setActiveDepartment('SETTINGS'); setActiveSubTab('Appearance'); }}
            className={`w-full flex items-center ${isActualCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
              activeDepartment === 'SETTINGS'
                ? 'bg-[var(--accent-light)] text-[var(--accent)] font-bold shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]'
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
            <span className={`transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Settings</span>
          </button>

          {/* User profile + logout */}
          <div className={`px-2 flex items-center ${isActualCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
            <div className={`flex items-center ${isActualCollapsed ? 'justify-center' : 'gap-2'} truncate`}>
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                {currentUser?.fullName?.[0] || 'U'}
              </div>
              <div className={`truncate transition-all duration-300 ${isActualCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <p className="text-xs font-semibold text-[var(--text-primary)] leading-none truncate">{currentUser?.fullName}</p>
                <p className="text-[10px] text-[var(--text-secondary)] leading-none mt-1 truncate">{currentUser?.department}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-1.5 hover:bg-[var(--accent-light)] rounded-lg text-rose-500 hover:text-rose-750 cursor-pointer shrink-0 transition-colors"
              title="Log out of Terminal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Collapse Toggle */}
          {setSidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`hidden lg:flex items-center justify-center w-full py-2.5 border-t border-[var(--border)] hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200 cursor-pointer rounded-xl ${isActualCollapsed ? 'px-0' : 'gap-2 px-4'}`}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isActualCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <div className="flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4 text-[var(--accent)] animate-pulse" />
                  <span className="text-xs font-semibold">Collapse Sidebar</span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
