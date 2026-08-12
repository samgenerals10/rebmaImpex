import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
}

// Right-anchored slide-over replacing the app's old centered-dialog
// boilerplate. Full width below `sm` (the correct mobile sheet pattern, not
// a compromise of the desktop layout), fixed width above it. Pure
// presentation. It owns no form state, so every existing handleSave/validation
// call site keeps working unchanged when it swaps its wrapper to this.
export default function SidePanel({ open, onClose, title, subtitle, badge, children, footer, width = 'md' }: SidePanelProps) {
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

  const widthClass = width === 'lg' ? 'sm:w-[480px] lg:w-[560px]' : 'sm:w-[400px] lg:w-[480px]';

  return (
    <div className="fixed inset-0 z-[500]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/50 motion-safe:animate-[sidepanel-fade_0.2s_ease-out]"
        onClick={onClose}
      />
      <div
        className={`absolute top-0 right-0 h-full w-full ${widthClass} bg-[var(--bg-card)] border-l border-[var(--border)] shadow-[var(--shadow-dropdown)] flex flex-col motion-safe:animate-[sidepanel-slide-in_0.25s_ease-out]`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-btn text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] shrink-0 bg-[var(--bg-card)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Optional grouped section for forms with multiple field clusters (mirrors
// the "Trade Details / Pricing / Notes" grouping pattern from the reference
// design). Skip it for simple single-cluster forms.
export function SidePanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border)]">
        {label}
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
