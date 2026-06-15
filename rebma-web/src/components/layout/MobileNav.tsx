import { Home, Plus, Bell, User } from 'lucide-react';

interface MobileNavProps {
  isSidebarOpen: boolean;
  theme: string;
  accentColor: string;
  activeMobileView: string;
  isMobileSearchActive: boolean;
  isMobileNotificationsActive: boolean;
  navStyle: string;
  currentUser: any;
  setActiveDepartment: (dept: string) => void;
  setIsMobileSearchActive: (v: boolean) => void;
  setIsMobileNotificationsActive: (v: boolean) => void;
  setActiveMobileView: (v: string) => void;
  setIsQuickActionOpen: (v: boolean) => void;
}

export function MobileNav({
  isSidebarOpen,
  theme,
  accentColor,
  activeMobileView,
  isMobileSearchActive,
  isMobileNotificationsActive,
  navStyle,
  currentUser,
  setActiveDepartment,
  setIsMobileSearchActive,
  setIsMobileNotificationsActive,
  setActiveMobileView,
  setIsQuickActionOpen,
}: MobileNavProps) {
  if (isSidebarOpen) return null;

  const darkSidebarThemes = ['foodie'];
  const isDarkNav = darkSidebarThemes.includes(theme);
  const iconInactive = isDarkNav ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)';
  const iconActive   = isDarkNav ? '#ffffff' : accentColor;

  const isHome    = activeMobileView === 'dashboard' && !isMobileSearchActive && !isMobileNotificationsActive;
  const isAlerts  = isMobileNotificationsActive;
  const isProfile = activeMobileView === 'profile' && !isMobileSearchActive && !isMobileNotificationsActive;

  return (
    <div
      className={navStyle === 'Pill'
        ? "lg:hidden fixed bottom-5 left-4 right-4 h-16 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-around z-50 shadow-xl px-2"
        : "lg:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-white/10 flex items-center justify-around z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] pb-safe"
      }
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {/* Home */}
      <button
        type="button"
        onClick={() => {
          const userDept = (currentUser?.department || 'CEO').toUpperCase() === 'HUMAN RESOURCES'
            ? 'HR'
            : (currentUser?.department || 'CEO').toUpperCase();
          setActiveDepartment(userDept);
          sessionStorage.setItem('rebma-last-dept', userDept);
          setIsMobileSearchActive(false);
          setIsMobileNotificationsActive(false);
          setActiveMobileView('dashboard');
        }}
        className="flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors"
        style={{ color: isHome ? iconActive : iconInactive }}
      >
        <Home className="w-5 h-5" />
        <span className={`text-[9px] mt-1 ${isHome ? 'font-bold' : ''}`}>Home</span>
      </button>

      {/* Quick Action (Center) */}
      <div className={`relative flex-1 flex justify-center ${navStyle === 'Pill' ? '-mt-4' : '-mt-6'}`}>
        <button
          type="button"
          onClick={() => setIsQuickActionOpen(true)}
          className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white/20"
          style={{ backgroundColor: accentColor }}
          title="Quick Action"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Alerts */}
      <button
        type="button"
        onClick={() => {
          setIsMobileNotificationsActive(true);
          setIsMobileSearchActive(false);
          setActiveMobileView('dashboard');
        }}
        className="flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors"
        style={{ color: isAlerts ? iconActive : iconInactive }}
      >
        <Bell className="w-5 h-5" />
        <span className={`text-[9px] mt-1 ${isAlerts ? 'font-bold' : ''}`}>Alerts</span>
      </button>

      {/* Profile */}
      <button
        type="button"
        onClick={() => {
          setActiveMobileView('profile');
          setIsMobileSearchActive(false);
          setIsMobileNotificationsActive(false);
        }}
        className="flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors"
        style={{ color: isProfile ? iconActive : iconInactive }}
      >
        <User className="w-5 h-5" />
        <span className={`text-[9px] mt-1 ${isProfile ? 'font-bold' : ''}`}>Profile</span>
      </button>
    </div>
  );
}
