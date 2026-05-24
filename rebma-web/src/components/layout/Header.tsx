// rebma-web/src/components/layout/Header.tsx

import { Search, MessageSquare, Bell, Wifi } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenChat: () => void;
  networkOnline?: boolean;
}

export default function Header({
  searchQuery,
  setSearchQuery,
  onOpenChat,
  networkOnline = true
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-3 mb-6">
      {/* Curved Search bar matching Google Drive mockup */}
      <div className="relative w-full max-w-xl">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          placeholder="Search documents, records, or departments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Status badges & Widgets */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <Wifi className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider">
            {networkOnline ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Collaborative Direct Message Toggle Button */}
        <button 
          onClick={onOpenChat}
          className="relative p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-slate-600 transition-all cursor-pointer shadow-sm"
          title="Open Chat Terminal"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
        </button>

        {/* Notification Badge list indicator */}
        <div className="relative p-2.5 bg-white border border-slate-200 rounded-full text-slate-600 cursor-pointer shadow-sm">
          <Bell className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
