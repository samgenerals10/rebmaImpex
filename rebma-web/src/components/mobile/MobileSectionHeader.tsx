import type { ReactNode } from 'react';

interface MobileSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
}

// One consistent section-header treatment for mobile cards/lists, so every
// department stops hand-rolling its own title row with slightly different
// sizes, weights, and spacing.
export default function MobileSectionHeader({ title, subtitle, icon, badge, action }: MobileSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[var(--border)]">
      <div className="min-w-0">
        <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 truncate">
          {icon}
          {title}
        </h3>
        {subtitle && <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {badge}
        {action}
      </div>
    </div>
  );
}
