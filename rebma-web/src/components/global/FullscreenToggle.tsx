import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

// Drop-in hook for "make this card occupy the full screen" — used on tables
// and the Boardroom. Callers apply `fullscreenClass` to their existing card
// div (swapping its normal rounded/bordered classes for a fixed full-viewport
// layout while expanded) and render <FullscreenButton> somewhere in the
// card's header. Escape collapses it, and only one panel can be expanded at
// a time app-wide since each instance has its own state — that's intentional,
// expanding a second card while one is already full-screen would stack badly.
export function useFullscreenToggle() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [expanded]);

  return {
    expanded,
    toggle: () => setExpanded(e => !e),
    fullscreenClass: expanded
      ? 'fixed inset-0 z-[100] !rounded-none overflow-y-auto'
      : '',
  };
}

interface ButtonProps {
  expanded: boolean;
  onClick: () => void;
  className?: string;
}

export function FullscreenButton({ expanded, onClick, className }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={expanded ? 'Exit fullscreen (Esc)' : 'Expand to fullscreen'}
      className={className || 'flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--accent)] transition-colors'}
    >
      {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    </button>
  );
}
