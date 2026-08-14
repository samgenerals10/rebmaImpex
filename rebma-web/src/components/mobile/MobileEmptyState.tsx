import type { ReactNode } from 'react';

interface MobileEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function MobileEmptyState({ icon, title, description, action }: MobileEmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {icon && <div className="w-11 h-11 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-muted)] mb-3">{icon}</div>}
      <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
      {description && <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[260px]">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-xl cursor-pointer hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
