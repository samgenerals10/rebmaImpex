// Loading placeholders sized to match the real content so nothing jumps
// once data arrives — a plain spinner tells the user something is
// happening, this tells them roughly what's about to appear.

export function MobileSkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-[var(--bg-input)] shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-2/3 rounded bg-[var(--bg-input)]" />
        <div className="h-2.5 w-1/3 rounded bg-[var(--bg-input)]" />
      </div>
      <div className="h-3 w-12 rounded bg-[var(--bg-input)] shrink-0" />
    </div>
  );
}

export function MobileSkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <MobileSkeletonCard key={i} />)}
    </div>
  );
}

export function MobileSkeletonMetric() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 animate-pulse space-y-2">
      <div className="h-2.5 w-1/2 rounded bg-[var(--bg-input)]" />
      <div className="h-7 w-1/3 rounded bg-[var(--bg-input)]" />
      <div className="h-2.5 w-2/3 rounded bg-[var(--bg-input)]" />
    </div>
  );
}
