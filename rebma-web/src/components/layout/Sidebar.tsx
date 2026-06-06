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
  X
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
  onClose
}: SidebarProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  
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
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 app-sidebar flex flex-col justify-between py-6 px-4 shrink-0 shadow-lg select-none transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static`}>
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div className="flex items-center justify-between px-3 mb-8">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              className="w-9 h-9 object-contain rounded-lg bg-white/20 p-0.5 shrink-0 select-none pointer-events-none" 
              alt="REBMA GHANA Logo" 
            />
            <div>
              <h2 className="font-bold text-sm tracking-wide leading-none text-white">REBMA IMPEX GHANA</h2>
              <span className="text-[10px] uppercase text-white/60 tracking-widest font-semibold font-mono">Impex ERP</span>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Boardroom Quick Launch Button */}
        <div className="mb-4 px-1">
          <button 
            onClick={handleBoardroomClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-100 text-blue-600 rounded-full font-semibold shadow-md border border-slate-100 hover:scale-102 transition-all duration-200 cursor-pointer text-xs"
          >
            <MessagesSquare className="w-4 h-4 text-blue-600" />
            <span>Executive Boardroom</span>
          </button>
        </div>

        {/* Department Switcher Dropdown */}
        <div className="mb-5 px-1 relative">
          <label className="block text-[9px] font-bold text-white/50 uppercase tracking-wider mb-1.5">Switch Department</label>
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(prev => !prev)}
            className="w-full flex items-center justify-between bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl py-2.5 px-3 text-xs focus:outline-none transition-all cursor-pointer font-semibold"
          >
            <span>{allDepts.find(d => d.value === activeDepartment)?.label || activeDepartment}</span>
            <span className="text-[9px] opacity-75">▼</span>
          </button>
          
          {/* Switcher Popover / Sheet */}
          {isSwitcherOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black/60 z-[250] lg:hidden"
                onClick={() => setIsSwitcherOpen(false)}
              />
              
              <div className="fixed inset-x-0 bottom-0 lg:absolute lg:top-full lg:bottom-auto lg:inset-x-0 max-h-[80vh] lg:max-h-80 bg-slate-900 border-t lg:border border-white/15 rounded-t-3xl lg:rounded-xl p-5 lg:p-2 z-[260] overflow-y-auto shadow-2xl flex flex-col gap-2.5 animate-fade-in-up">
                {/* Mobile Grab Handle */}
                <div className="lg:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-1 shrink-0" />
                
                <div className="flex justify-between items-center lg:hidden mb-1">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Switch Department</h3>
                  <button onClick={() => setIsSwitcherOpen(false)} className="text-white/60 hover:text-white text-xs">Close</button>
                </div>

                <div className="space-y-1">
                  {availableDepts.map(dept => {
                    const isSelected = dept.value === activeDepartment;
                    return (
                      <button
                        key={dept.value}
                        type="button"
                        onClick={() => {
                          setActiveDepartment(dept.value);
                          setIsSwitcherOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-white text-slate-900 shadow-md font-bold' 
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{dept.label}</span>
                        {isSelected && <span className="text-emerald-500 font-extrabold text-sm">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* View-only badge for CEO/Management viewing other depts */}
          {(isCeo || isManagement) && activeDepartment !== userDept && activeDepartment !== 'BOARDROOM' && activeDepartment !== 'SETTINGS' && (
            <div className="mt-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg text-[9px] text-amber-300 font-semibold text-center">
              👁 VIEW ONLY — {isCeo ? 'CEO' : 'MANAGEMENT'} ACCESS
            </div>
          )}
        </div>

        {/* Department Sub-Menu */}
        <nav className="space-y-1 flex-1 overflow-y-auto pr-0.5">
          <div className="text-[9px] uppercase text-white/50 tracking-widest font-semibold px-4 mb-2">
            {activeDepartment} Controls
          </div>
          {departmentTabs[activeDepartment]?.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? 'bg-white text-slate-900 shadow-md font-semibold' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                style={isActive && theme !== 'breeze' ? {
                  backgroundColor: 'var(--sidebar-active-bg, white)',
                  color: 'var(--sidebar-active-text, #0f172a)'
                } : {}}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
                <span className="truncate text-xs">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: Settings + User Card + Logout */}
      <div className="space-y-3 pt-4 border-t border-white/20">
        {/* Settings shortcut */}
        <button
          onClick={() => { setActiveDepartment('SETTINGS'); setActiveSubTab('Themes'); }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
            activeDepartment === 'SETTINGS'
              ? 'bg-white text-slate-900 shadow-md'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings</span>
        </button>

        {/* User profile + logout */}
        <div className="px-2 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-bold text-white">
              {currentUser?.fullName?.[0] || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white leading-none truncate">{currentUser?.fullName}</p>
              <p className="text-[10px] text-white/70 leading-none mt-1 truncate">{currentUser?.department}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white cursor-pointer shrink-0"
            title="Log out of Terminal"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
