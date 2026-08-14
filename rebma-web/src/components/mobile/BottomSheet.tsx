import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: string;
}

// Bottom-anchored counterpart to SidePanel — same proven interaction model
// (backdrop click, Escape, body-scroll-lock) but sliding up from the
// bottom, for the transient mobile patterns (filters, quick actions,
// simple selections) that a right-side panel doesn't fit.
export default function BottomSheet({ open, onClose, title, children, footer, maxHeight = '80vh' }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/50 motion-safe:animate-[sidepanel-fade_0.2s_ease-out]"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-3xl shadow-[var(--shadow-dropdown)] flex flex-col motion-safe:animate-[bottomsheet-slide-in_0.25s_ease-out]"
        style={{ maxHeight, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {title && (
          <div className="px-5 pb-3 border-b border-[var(--border)] shrink-0">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-[var(--border)] shrink-0 bg-[var(--bg-card)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
