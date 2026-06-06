// rebma-web/src/components/layout/Header.tsx

import { useState } from 'react';
import { Search, MessageSquare, Bell, Wifi, X, CheckCheck, Menu, Sun, Moon, MoreVertical } from 'lucide-react';
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
  onLogout
}: HeaderProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <header className="relative mb-0 lg:mb-6">
      {/* 1. MOBILE HERO HEADER */}
      <div className="lg:hidden bg-gradient-to-r from-[#068d5c] to-[#045c3d] text-white px-5 py-4 pb-6 relative flex flex-col gap-4">
        {/* Top Bar */}
        <div className="flex justify-between items-center h-12">
          {onToggleSidebar && (
            <button 
              onClick={onToggleSidebar}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title="Open Menu"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>
          )}

          <span className="font-extrabold tracking-wider text-sm select-none">REBMA IMPEX</span>

          <div className="flex items-center gap-1.5 relative">
            {/* Chat Bubble */}
            <button
              onClick={onOpenChat}
              className="p-2 text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title="Open Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="p-2 text-white hover:bg-white/10 rounded-lg cursor-pointer relative transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            {/* Day/Night Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* More Menu vertical dots */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(prev => !prev)}
                className="p-2 -mr-2 text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                title="More options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-[290]" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-[300] py-2 animate-fade-in-up text-slate-800 dark:text-slate-200">
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onProfileClick?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                    >
                      Profile & Account
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onDisplaySettingsClick?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                    >
                      Display & Appearance
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onSwitchDepartmentClick?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                    >
                      Switch Department
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); onOpenNotifications?.(); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                    >
                      Notifications
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); window.alert("REBMA IMPEX Help Desk is active 24/7. Call +233 (0) 302 000 000."); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold"
                    >
                      Help & Support
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
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

        {/* Hero Section */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              {getGreeting()}, {currentUser?.fullName?.split(' ')[0] || 'User'}
            </h2>
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse mt-1 shrink-0" />
          </div>
          <p className="text-xs text-white/75 font-semibold mt-0.5 uppercase tracking-wide">
            {currentUser?.department || 'ERP Command Center'}
          </p>
        </div>
      </div>

      {/* 2. DESKTOP HEADER */}
      <div className="hidden lg:flex items-center justify-between py-3 relative gap-2 w-full">
        {/* Search bar */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {onToggleSidebar && (
            <button 
              onClick={onToggleSidebar}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Status badges & Widgets */}
        <div className="flex items-center gap-4 relative">
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <Wifi className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider">
              {networkOnline ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Chat Button */}
          <button
            onClick={onOpenChat}
            className="relative p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-slate-600 transition-all cursor-pointer shadow-sm"
            title="Open Chat Terminal"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowPanel(p => !p)}
              className="relative p-2.5 bg-white border border-slate-200 rounded-full text-slate-600 cursor-pointer shadow-sm hover:bg-slate-50 transition-all"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white px-0.5">
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
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-[200] overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-slate-800">Notifications</span>
                      {notifications.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-bold rounded-full">{notifications.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && onClearNotifications && (
                        <button onClick={onClearNotifications} className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer">
                          <CheckCheck className="w-3 h-3" /> Clear all
                        </button>
                      )}
                      <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notification list */}
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No new notifications</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map(n => (
                          <div key={n.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                            <p className="text-xs text-slate-700 leading-relaxed">{n.msg}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
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
