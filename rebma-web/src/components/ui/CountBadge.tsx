// A small number pill shown next to a label (copy style rule: counts go
// in a badge, never typed into the label as "(3)"). Hidden at zero.
export default function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center px-1.5 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-[10px] font-bold leading-none align-middle ${className}`}>
      {count}
    </span>
  );
}
