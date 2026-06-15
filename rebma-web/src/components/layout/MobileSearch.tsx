import { Search } from 'lucide-react';

interface MobileSearchProps {
  isActive: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setIsActive: (v: boolean) => void;
}

export function MobileSearch({ isActive, searchQuery, setSearchQuery, setIsActive }: MobileSearchProps) {
  if (!isActive) return null;

  return (
    <div className="lg:hidden fixed inset-0 bg-bg-page dark:bg-slate-900 z-40 p-6 pt-12 overflow-y-auto pb-24 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-muted" />
          </span>
          <input
            type="text"
            placeholder="Search ERP modules, orders, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-3 py-2.5 bg-bg-card border border-[var(--border)] rounded-full text-sm text-text-primary placeholder-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsActive(false)}
          className="text-text-secondary font-bold text-xs"
        >
          Cancel
        </button>
      </div>
      <div className="space-y-4">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Search Results</p>
        {searchQuery ? (
          <div className="p-4 bg-bg-card dark:bg-slate-800 rounded-2xl border border-custom text-center py-8">
            <p className="text-xs text-text-secondary dark:text-text-muted">Searching details containing "{searchQuery}"</p>
            <p className="text-[10px] text-text-muted mt-1">Filtered dashboard view displays matching records.</p>
          </div>
        ) : (
          <div className="text-center py-8 text-text-muted">
            <p className="text-xs">Type a query to search the terminal databases.</p>
          </div>
        )}
      </div>
    </div>
  );
}
