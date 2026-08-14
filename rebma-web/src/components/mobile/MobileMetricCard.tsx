import type { ReactNode, KeyboardEvent } from 'react';

interface MobileMetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: ReactNode;
  emphasis?: 'primary' | 'secondary';
  tone?: 'accent' | 'neutral' | 'warning' | 'danger';
  trend?: { direction: 'up' | 'down'; value: string };
  onClick?: () => void;
}

const TONE_COLOR: Record<NonNullable<MobileMetricCardProps['tone']>, string> = {
  accent: 'var(--accent)',
  neutral: 'var(--text-secondary)',
  warning: '#d97706',
  danger: '#dc2626',
};

// Replaces the old "physical bank card" KPI tiles (fake card numbers on an
// operations metric) with a restrained card that actually reads as a
// number to act on. `primary` gets one full-width slot with real visual
// weight; `secondary` is meant for a 2-up grid of supporting metrics —
// not every number should compete for the same attention.
export default function MobileMetricCard({
  label,
  value,
  sublabel,
  icon,
  emphasis = 'secondary',
  tone = 'accent',
  trend,
  onClick,
}: MobileMetricCardProps) {
  const color = TONE_COLOR[tone];
  // Deliberately a <div>, never a <button> — a global mobile stylesheet rule
  // forces every <button> to the user's chosen button-radius (often a full
  // pill), which fought this card's own rounded-2xl and made primary/
  // secondary metrics render with mismatched corners depending on whether
  // they happened to be clickable. role="button" keeps it accessible.
  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        },
      }
    : {};

  if (emphasis === 'primary') {
    return (
      <div
        {...interactiveProps}
        className={`w-full text-left bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-card)] ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="text-[28px] leading-tight font-extrabold mt-1 tracking-tight" style={{ color }}>{value}</p>
            {sublabel && <p className="text-xs text-[var(--text-muted)] mt-1">{sublabel}</p>}
          </div>
          {icon && (
            <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, color }}>
              {icon}
            </div>
          )}
        </div>
        {trend && (
          <div className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${trend.direction === 'up' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      {...interactiveProps}
      className={`w-full text-left bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-2.5 ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
    >
      {icon && (
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}1a`, color }}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] truncate">{label}</p>
        <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5 truncate">{value}</p>
        {sublabel && <p className="text-[10px] text-[var(--text-muted)] truncate">{sublabel}</p>}
      </div>
    </div>
  );
}
