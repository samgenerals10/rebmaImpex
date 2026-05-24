// rebma-web/src/components/layout/Sidebar.tsx

import { 
  Building2, 
  ShieldCheck, 
  Layers, 
  Users, 
  TrendingUp, 
  Grid, 
  DollarSign, 
  Activity, 
  Clipboard, 
  Truck, 
  Settings, 
  Plus, 
  LogOut 
} from 'lucide-react';
import type { CurrentUser } from '../../types/erp';

interface SidebarProps {
  activeDepartment: string;
  setActiveDepartment: (dept: string) => void;
  theme: string;
  currentUser: CurrentUser | null;
  onLogout: () => void;
  addNotification: (msg: string) => void;
}

export default function Sidebar({
  activeDepartment,
  setActiveDepartment,
  theme,
  currentUser,
  onLogout,
  addNotification
}: SidebarProps) {
  
  const navItems = [
    { id: 'CEO', label: 'CEO Command', icon: ShieldCheck },
    { id: 'MANAGEMENT', label: 'Management approvals', icon: Layers },
    { id: 'HR', label: 'Human Resources', icon: Users },
    { id: 'MARKETING', label: 'Marketing Pipeline', icon: TrendingUp },
    { id: 'OPERATIONS', label: 'Operations & Stock', icon: Grid },
    { id: 'FINANCE', label: 'Finance Ledgers', icon: DollarSign },
    { id: 'PRODUCTION', label: 'Production Line', icon: Activity },
    { id: 'RECEPTION', label: 'Reception Terminal', icon: Clipboard },
    { id: 'DISPATCH', label: 'Dispatch Fleet', icon: Truck },
    { id: 'LOGISTICS', label: 'Logistics Fleet', icon: Layers },
    { id: 'SETTINGS', label: 'ERP Settings', icon: Settings },
  ];

  const handleQuickAction = () => {
    if (currentUser?.department === 'MARKETING') setActiveDepartment('MARKETING');
    else if (currentUser?.department === 'OPERATIONS') setActiveDepartment('OPERATIONS');
    else setActiveDepartment('CEO');
    addNotification('Shortcut: Triggered core transactional workflow widget.');
  };

  return (
    <aside className="w-64 app-sidebar flex flex-col justify-between py-6 px-4 shrink-0 shadow-lg select-none">
      <div>
        {/* Logo Header */}
        <div className="flex items-center gap-3 px-3 mb-8">
          <Building2 className="w-8 h-8 text-white shrink-0" />
          <div>
            <h2 className="font-bold text-sm tracking-wide leading-none text-white">REBMA IMPEX</h2>
            <span className="text-[10px] uppercase text-white/60 tracking-widest font-semibold">Limited ERP</span>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="mb-6 px-1">
          <button 
            onClick={handleQuickAction}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-100 text-blue-600 rounded-full font-semibold shadow-md border border-slate-100 hover:scale-102 transition-all duration-200 cursor-pointer text-sm"
          >
            <Plus className="w-5 h-5 text-blue-600" />
            <span>Initiate Workflow</span>
          </button>
        </div>

        {/* Department Navigation Menu */}
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeDepartment === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveDepartment(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                style={isActive && theme !== 'breeze' ? {
                  backgroundColor: 'var(--sidebar-active-bg)',
                  color: 'var(--sidebar-active-text)'
                } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Card Profile & Logout */}
      <div className="pt-4 border-t border-white/20 px-2 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center font-bold text-white">
            {currentUser?.fullName[0] || 'U'}
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-white leading-none truncate">{currentUser?.fullName}</p>
            <p className="text-[10px] text-white/70 leading-none mt-1 truncate">{currentUser?.department}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="p-1.5 hover:bg-white/10 rounded-full text-white/80 hover:text-white cursor-pointer"
          title="Log out of Terminal"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
