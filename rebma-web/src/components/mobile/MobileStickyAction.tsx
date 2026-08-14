import type { ReactNode } from 'react';

interface MobileStickyActionProps {
  children: ReactNode;
  className?: string;
}

// Sticky bottom action bar for mobile forms/detail screens — pins the
// primary action within thumb reach and respects the device safe area so
// it never sits under a home-indicator or gesture bar.
export default function MobileStickyAction({ children, className = '' }: MobileStickyActionProps) {
  return (
    <div
      className={`sticky bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border)] px-4 pt-3 flex gap-2 ${className}`}
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
    >
      {children}
    </div>
  );
}
