// rebma-web/src/components/layout/Header.tsx

import { useState } from 'react';
import { 
  Search, MessageSquare, Bell, Wifi, X, CheckCheck, Menu, Sun, Moon, MoreVertical,
  User, ShieldCheck, Layers, Users, TrendingUp, Activity, DollarSign, Clipboard, Truck, Video, Settings, LogOut, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CurrentUser } from '../../types/erp';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenChat: () => void;
  networkOnline?: boolean;
  notifications?: Array<{ id: string; msg: string; time: string }>;
  onClearNotifications?: () => void;
  onToggleSidebar?: () => void;
  currentUser?: CurrentUser | null;
  onOpenNotifications?: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onProfileClick?: () => void;
  onDisplaySettingsClick?: () => void;
  onSwitchDepartmentClick?: () => void;
  onLogout?: () => void;
  activeDepartment?: string;
  setActiveDepartment?: (dept: string) => void;
  setActiveSubTab?: (tab: string) => void;
  onSearchClick?: () => void;
  theme?: string;
  ordersList?: any[];
  incomingGoodsList?: any[];
  paymentsList?: any[];
  staffList?: any[];
  customersList?: any[];
}

const getGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export default function Header({
  searchQuery,
  setSearchQuery,
  onOpenChat,
  networkOnline = true,
  notifications = [],
  onClearNotifications,
  onToggleSidebar,
  currentUser,
  onOpenNotifications,
  darkMode,
  setDarkMode,
  onProfileClick,
  onDisplaySettingsClick,
  onSwitchDepartmentClick,
  onLogout,
  activeDepartment,
  setActiveDepartment,
  setActiveSubTab,
  onSearchClick,
  theme,
  ordersList = [],
  incomingGoodsList = [],
  paymentsList = [],
  staffList = [],
  customersList = []
}: HeaderProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const isAdmin = currentUser?.isAdmin || currentUser?.department?.toUpperCase() === 'CEO';
  const isSuperAdmin = currentUser?.isSuperAdmin ?? false;

  const allDepts = [
    { value: 'CEO', label: 'CEO Command', icon: ShieldCheck },
    { value: 'MANAGEMENT', label: 'Management Office', icon: Layers },
    { value: 'HR', label: 'Human Resources', icon: Users },
    { value: 'MARKETING', label: 'Marketing Pipeline', icon: TrendingUp },
    { value: 'OPERATIONS', label: 'Operations & Stock', icon: Activity },
    { value: 'FINANCE', label: 'Finance Ledgers', icon: DollarSign },
    { value: 'PRODUCTION', label: 'Production Line', icon: Clipboard },
    { value: 'RECEPTION', label: 'Reception Terminal', icon: Users },
    { value: 'DISPATCH', label: 'Dispatch Fleet', icon: Truck },
    { value: 'LOGISTICS', label: 'Logistics Fleet', icon: Truck },
    { value: 'BOARDROOM', label: 'Executive Boardroom', icon: Video },
    { value: 'SETTINGS', label: 'ERP Settings', icon: Settings },
  ];

  const availableDepts = allDepts.filter(d => {
    if (isSuperAdmin || isAdmin) return true;
    const rawDept = currentUser?.department || '';
    const normalizedUserDept = rawDept.toUpperCase() === 'HUMAN RESOURCES' ? 'HR' : rawDept.toUpperCase();
    if (d.value === 'BOARDROOM' || d.value === 'SETTINGS') return true;
    if (normalizedUserDept === 'HR') return d.value === 'HR';
    return d.value === normalizedUserDept;
  });

  const getSearchResults = () => {
    if (!searchQuery || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      category: string;
      dept: string;
      tab: string;
      icon: any;
    }> = [];

    const isAdmin = currentUser?.isAdmin || currentUser?.department?.toUpperCase() === 'CEO';
    const dept = activeDepartment || currentUser?.department || '';

    // 1. Orders search (accessible by CEO, MARKETING, FINANCE, MANAGEMENT)
    if (isAdmin || dept === 'MARKETING' || dept === 'FINANCE' || dept === 'MANAGEMENT') {
      const matchedOrders = (ordersList || []).filter((o: any) =>
        String(o.id || '').toLowerCase().includes(q) ||
        String(o.clientName || '').toLowerCase().includes(q) ||
        String(o.productName || '').toLowerCase().includes(q) ||
        String(o.ticketNumber || '').toLowerCase().includes(q)
      );
      matchedOrders.forEach((o: any) => {
        results.push({
          id: o.id,
          title: `Order: ${o.clientName}`,
          subtitle: `${o.productName || 'Unnamed'} (Qty: ${o.quantity || 1}) · GHS ${Number(o.totalAmount || 0).toLocaleString()} [${o.status}]`,
          category: 'Orders',
          dept: isAdmin ? 'CEO' : (dept === 'FINANCE' ? 'FINANCE' : 'MARKETING'),
          tab: isAdmin ? 'Invoices' : (dept === 'FINANCE' ? 'OrdersQueue' : 'SalesHistory'),
          icon: Clipboard
        });
      });
    }

    // 2. Cargo Ingestions (accessible by CEO, OPERATIONS, MANAGEMENT)
    if (isAdmin || dept === 'OPERATIONS' || dept === 'MANAGEMENT') {
      const matchedCargo = (incomingGoodsList || []).filter((c: any) =>
        String(c.id || '').toLowerCase().includes(q) ||
        String(c.goodsCode || '').toLowerCase().includes(q) ||
        String(c.productName || '').toLowerCase().includes(q) ||
        String(c.company || '').toLowerCase().includes(q)
      );
      matchedCargo.forEach((c: any) => {
        results.push({
          id: c.id,
          title: `Cargo: ${c.productName || 'Incoming Goods'}`,
          subtitle: `Code: ${c.goodsCode} · Carrier: ${c.company} · Qty: ${c.quantity} [${c.status}]`,
          category: 'Logistics / Intake',
          dept: isAdmin ? 'MANAGEMENT' : 'OPERATIONS',
          tab: isAdmin ? 'CargoApproval' : 'LoggedCargo',
          icon: Truck
        });
      });
    }

    // 3. Payments / Receipts (accessible by CEO, FINANCE)
    if (isAdmin || dept === 'FINANCE') {
      const matchedPayments = (paymentsList || []).filter((p: any) =>
        String(p.id || '').toLowerCase().includes(q) ||
        String(p.clientName || '').toLowerCase().includes(q) ||
        String(p.paymentMode || '').toLowerCase().includes(q) ||
        String(p.paymentType || '').toLowerCase().includes(q)
      );
      matchedPayments.forEach((p: any) => {
        results.push({
          id: p.id,
          title: `Payment: ${p.clientName}`,
          subtitle: `Receipt: ${p.id} · GHS ${Number(p.amount || 0).toLocaleString()} · Mode: ${p.paymentMode}`,
          category: 'Finance Receipts',
          dept: 'FINANCE',
          tab: 'Tickets',
          icon: DollarSign
        });
      });
    }

    // 4. Staff members (accessible by CEO, HR)
    if (isAdmin || dept === 'HR') {
      const matchedStaff = (staffList || []).filter((s: any) =>
        String(s.id || '').toLowerCase().includes(q) ||
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.role || '').toLowerCase().includes(q)
      );
      matchedStaff.forEach((s: any) => {
        results.push({
          id: s.id,
          title: `Employee: ${s.name}`,
          subtitle: `Role: ${s.role} · Email: ${s.email} · Status: ${s.status || 'ACTIVE'}`,
          category: 'HR Directory',
          dept: 'HR',
          tab: 'Staff',
          icon: Users
        });
      });
    }

    // 5. Customers (accessible by CEO, MARKETING)
    if (isAdmin || dept === 'MARKETING') {
      const matchedCustomers = (customersList || []).filter((c: any) =>
        String(c.id || '').toLowerCase().includes(q) ||
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.company || '').toLowerCase().includes(q) ||
        String(c.email || '').toLowerCase().includes(q)
      );
      matchedCustomers.forEach((c: any) => {
        results.push({
          id: c.id,
          title: `Customer: ${c.name}`,
          subtitle: `Company: ${c.company || 'N/A'} · Contact: ${c.email || c.phone || 'N/A'}`,
          category: 'Marketing Customers',
          dept: 'MARKETING',
          tab: 'RegisterCustomer',
          icon: User
        });
      });
    }

    return results;
  };

  const handleResultClick = (res: any) => {
    if (setActiveDepartment && res.dept) {
      setActiveDepartment(res.dept);
      sessionStorage.setItem('rebma-last-dept', res.dept);
    }
    if (setActiveSubTab && res.tab) {
      setActiveSubTab(res.tab);
    }
    setSearchQuery('');
  };

  const searchResults = getSearchResults();
  const dept = activeDepartment || currentUser?.department || '';

  return (
    <header className="relative mb-0 lg:mb-6">
      {/* 1. MOBILE HERO HEADER */}
      <div className="lg:hidden bg-transparent px-5 py-4 pb-2 relative flex flex-col gap-3">
        {/* Top Bar */}
        <div className="flex justify-between items-center h-12 relative">
          
          {/* Left: colored avatar initials with switcher */}
          <div className="relative">
            <button 
              onClick={() => setShowAvatarDropdown(prev => !prev)}
              className="w-10 h-10 rounded-full bg-[var(--accent,#068d5c)] text-white flex items-center justify-center font-extrabold text-sm shadow-card cursor-pointer hover:scale-105 active:scale-95 transition-all overflow-hidden"
            >
              {currentUser?.photo ? (
                <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                currentUser?.fullName?.[0] || 'U'
              )}
            </button>
            
            {/* Custom Avatar Dropdown */}
            {showAvatarDropdown && (
              <>
                <div className="fixed inset-0 z-[490]" onClick={() => setShowAvatarDropdown(false)} />
                <div className="absolute left-0 mt-2 w-64 bg-bg-card dark:bg-slate-900 border border-[var(--border)] dark:border-slate-800 rounded-2xl shadow-2xl z-[500] py-3 animate-fade-in-up text-text-primary dark:text-slate-200">
                  <div className="px-4 pb-3 border-b border-[var(--border)] dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-extrabold text-text-primary">{currentUser?.fullName}</p>
                      {isSuperAdmin && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide">
                          SUPER ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary mt-0.5">{currentUser?.department}</p>
                  </div>
                  
                  <div className="max-h-52 overflow-y-auto py-2">
                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest px-4 py-1">Departments</p>
                    {availableDepts.map(d => {
                      const isActive = d.value === activeDepartment;
                      const IconComponent = d.icon;
                      return (
                        <button
                          key={d.value}
                          onClick={() => {
                            if (setActiveDepartment) {
                              setActiveDepartment(d.value);
                              const defaultSubTabs: Record<string, string> = {
                                CEO: 'Overview', MANAGEMENT: 'CargoApproval', HR: 'Employees',
                                MARKETING: 'CreateOrder', OPERATIONS: 'PortIngestion', FINANCE: 'Evaluation',
                                PRODUCTION: 'Requisition', RECEPTION: 'VisitorLog', DISPATCH: 'Deliveries',
                                LOGISTICS: 'Maintenance', BOARDROOM: 'VideoConf', SETTINGS: 'Appearance'
                              };
                              if (setActiveSubTab) {
                                setActiveSubTab(defaultSubTabs[d.value] || 'Overview');
                              }
                            }
                            setShowAvatarDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-left transition-colors ${
                            isActive 
                              ? 'border-l-4 border-[var(--accent,#068d5c)] text-[var(--accent,#068d5c)] bg-bg-page pl-3.5'
                              : 'text-text-secondary dark:text-text-muted hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'
                          }`}
                        >
                          <IconComponent className="w-4 h-4 shrink-0" />
                          <span className="truncate">{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="h-px bg-bg-page my-1" />
                  
                  <div className="px-2 pt-1 space-y-0.5">
                    <button
                      onClick={() => {
                        if (setActiveDepartment) {
                          setActiveDepartment('SETTINGS');
                          if (setActiveSubTab) setActiveSubTab('Appearance');
                        }
                        setShowAvatarDropdown(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-text-primary hover:bg-[var(--accent-light)] hover:text-[var(--accent)] text-left transition-colors"
                    >
                      <Settings className="w-4 h-4 text-text-secondary" />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        setShowAvatarDropdown(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Center: REBMA IMPEX Title */}
          <span className="font-extrabold tracking-wider text-sm text-[var(--text-primary,#1a202c)] select-none">
            REBMA IMPEX
          </span>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1">
            {/* Chat Icon */}
            <button
              onClick={onOpenChat}
              className="p-2 text-text-secondary dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all"
              title="Open Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="p-2 text-text-secondary dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer relative transition-all"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-text-secondary dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* More Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(prev => !prev)}
                className="p-2 text-text-secondary dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-all"
                title="More Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-[290]" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-bg-card dark:bg-slate-900 border border-[var(--border)] dark:border-slate-800 rounded-2xl shadow-2xl z-[300] py-2 animate-fade-in-up text-text-primary dark:text-slate-200">
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onProfileClick?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors font-bold"
                    >
                      Profile & Account
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); if (setActiveDepartment) { setActiveDepartment('SETTINGS'); if (setActiveSubTab) setActiveSubTab('Appearance'); } }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors font-bold"
                    >
                      Display & Appearance
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onToggleSidebar?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors font-bold"
                    >
                      Switch Department
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onOpenNotifications?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors font-bold"
                    >
                      Notifications
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); window.alert("REBMA IMPEX Help Desk is active 24/7. Call +233 (0) 302 000 000."); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors font-bold"
                    >
                      Help & Support
                    </button>
                    <div className="h-px bg-bg-page my-1" />
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onLogout?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors font-bold"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Greeting Banner */}
        <div className="mt-1 flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[var(--text-primary,#1a202c)] tracking-tight">
              {getGreeting()}, {currentUser?.fullName?.split(' ')[0] || 'User'}
            </h2>
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse mt-1.5 shrink-0" />
          </div>
          <p className="text-xs text-[var(--text-secondary,#64748b)] font-semibold mt-0.5 uppercase tracking-wide">
            {currentUser?.department || 'ERP Command Center'}
          </p>
        </div>

        {/* Search Bar Input */}
        <div className="w-full mt-1.5">
          <div
            onClick={onSearchClick}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full text-xs text-text-muted dark:text-slate-500 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <Search className="w-4 h-4 text-text-muted" />
            <span>Search...</span>
          </div>
        </div>
      </div>

      {/* 2. DESKTOP HEADER */}
      <div className="header-shell hidden lg:flex items-center h-16 px-6 border-b border-[var(--border)] relative gap-4 w-full">
        {/* Collapse sidebar toggle — far left, matches reference */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-[var(--accent-light)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Search bar — center, pill shape, matches reference */}
        <div className="relative flex items-center flex-1 max-w-[420px]">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-text-muted" />
            </span>
            <input
              type="text"
              placeholder={isAdmin ? "Search everywhere (CEO mode)..." : `Search ${dept.toLowerCase()} records...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-full text-xs text-[var(--text-primary)] placeholder:text-text-muted focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Search Dropdown Results */}
          {searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl z-[100] max-h-[350px] overflow-y-auto p-2 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-input)] rounded-t-xl">
                <span>{isAdmin ? 'GLOBAL SEARCH RESULTS' : `${dept} SEARCH RESULTS`}</span>
                <span className="bg-[var(--accent)] text-white px-1.5 py-0.5 rounded text-[8px] font-bold">{searchResults.length} matches</span>
              </div>
              <div className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                {searchResults.map((res) => {
                  const Icon = res.icon;
                  return (
                    <button
                      key={res.id}
                      onClick={() => handleResultClick(res)}
                      className="w-full text-left p-2.5 hover:bg-[var(--accent-light)] rounded-xl flex items-center gap-3 transition-colors cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shrink-0 group-hover:scale-105 transition-transform">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{res.title}</p>
                          <span className="text-[8px] bg-[var(--bg-input)] text-[var(--text-muted)] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">{res.category}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{res.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
                {searchResults.length === 0 && (
                  <p className="text-center text-xs text-[var(--text-muted)] py-6">No matching records found.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status badges & Widgets */}
        <div className="flex items-center gap-3 relative">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] bg-[var(--accent-light)] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
            <Wifi className="w-3.5 h-3.5 animate-pulse text-[var(--accent)]" />
            <span>{networkOnline ? 'Live' : 'Offline'}</span>
          </div>

          {/* Chat Button */}
          <button
            onClick={onOpenChat}
            className="p-2 bg-[var(--bg-card)] hover:bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all cursor-pointer shadow-card shrink-0"
            title="Open Chat Terminal"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Foodie date chip */}
          {theme === 'foodie' && (
            <div className="foodie-date-chip hidden xl:flex">
              <Calendar className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowPanel(p => !p)}
              className="p-2 bg-[var(--bg-card)] hover:bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all cursor-pointer shadow-card shrink-0 relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-card)] px-0.5">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            <AnimatePresence>
              {showPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] rounded-2xl shadow-xl border border-[var(--border)] z-[200] overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[var(--accent)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">Notifications</span>
                      {notifications.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded-full">{notifications.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && onClearNotifications && (
                        <button onClick={onClearNotifications} className="text-[10px] text-text-muted hover:text-slate-650 flex items-center gap-1 cursor-pointer font-semibold">
                          <CheckCheck className="w-3.5 h-3.5" /> Clear all
                        </button>
                      )}
                      <button onClick={() => setShowPanel(false)} className="text-text-muted hover:text-slate-650 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notification list */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center bg-[var(--bg-card)]">
                        <Bell className="w-8 h-8 text-text-muted mx-auto mb-2" />
                        <p className="text-xs text-[var(--text-secondary)]">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="px-4 py-3 hover:bg-[var(--bg)] transition-colors bg-[var(--bg-card)]">
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{n.msg}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1">{n.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-[var(--bg-card)] hover:bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all cursor-pointer shadow-card shrink-0"
            title="Toggle Light/Dark Mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User profile avatar + name dropdown — matches reference */}
          <div className="relative">
            <button
              onClick={() => setShowAvatarDropdown(prev => !prev)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs shadow-card shrink-0 border-2 border-white overflow-hidden relative">
                {currentUser?.photo ? (
                  <img src={currentUser.photo} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  currentUser?.fullName?.[0] || 'U'
                )}
              </div>
              <span className="text-xs font-semibold text-[var(--text-primary)] hidden xl:block max-w-[120px] truncate">
                {currentUser?.fullName || 'User'}
              </span>
              {isSuperAdmin && (
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide whitespace-nowrap">
                  SUPER ADMIN
                </span>
              )}
              <User className="w-3.5 h-3.5 text-[var(--text-muted)] hidden xl:block" />
            </button>

            {/* Avatar Dropdown Menu */}
            <AnimatePresence>
              {showAvatarDropdown && (
                <>
                  <div className="fixed inset-0 z-[199]" onClick={() => setShowAvatarDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl z-[200] py-3 text-[var(--text-primary)] overflow-hidden"
                  >
                    <div className="px-4 pb-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-[var(--text-primary)]">{currentUser?.fullName}</p>
                        {isSuperAdmin && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide">
                            SUPER ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{currentUser?.department}</p>
                    </div>

                    <div className="max-h-52 overflow-y-auto py-2">
                      <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-4 py-1">Departments</p>
                      {availableDepts.map(d => {
                        const isActive = d.value === activeDepartment;
                        const IconComponent = d.icon;
                        return (
                          <button
                            key={d.value}
                            onClick={() => {
                              if (setActiveDepartment) {
                                setActiveDepartment(d.value);
                                const defaultSubTabs: Record<string, string> = {
                                  CEO: 'Overview', MANAGEMENT: 'CargoApproval', HR: 'Employees',
                                  MARKETING: 'CreateOrder', OPERATIONS: 'PortIngestion', FINANCE: 'Evaluation',
                                  PRODUCTION: 'Requisition', RECEPTION: 'VisitorLog', DISPATCH: 'Deliveries',
                                  LOGISTICS: 'Maintenance', BOARDROOM: 'VideoConf', SETTINGS: 'Appearance'
                                };
                                if (setActiveSubTab) {
                                  setActiveSubTab(defaultSubTabs[d.value] || 'Overview');
                                }
                              }
                              setShowAvatarDropdown(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-left transition-colors ${
                              isActive 
                                ? 'border-l-4 border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-light)] pl-3.5'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
                            <span className="truncate">{d.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="h-px bg-[var(--border)] my-1" />

                    <div className="px-2 pt-1 space-y-0.5">
                      <button
                        onClick={() => {
                          if (setActiveDepartment) {
                            setActiveDepartment('SETTINGS');
                            if (setActiveSubTab) setActiveSubTab('Themes');
                          }
                          setShowAvatarDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)] text-left transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[var(--text-secondary)]" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowAvatarDropdown(false);
                          onLogout?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Click-outside dismiss overlay */}
      {showPanel && (
        <div className="fixed inset-0 z-[199]" onClick={() => setShowPanel(false)} />
      )}
    </header>
  );
}
