// src/components/CustomerAvatar.tsx
// Shared customer avatar: renders the real photo when the customer has one,
// falls back to initials otherwise. When `isSpecial` is set, wraps it in the
// animated neon ring defined in index.css (.special-avatar-ring) so VIP
// customers are visually called out wherever their avatar appears.

function initials(name: string) {
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

interface Props {
  name: string;
  photo?: string | null;
  isSpecial?: boolean;
  /** px, applies to both width and height */
  size?: number;
  rounded?: 'xl' | '2xl';
  className?: string;
}

export default function CustomerAvatar({ name, photo, isSpecial, size = 44, rounded = 'xl', className = '' }: Props) {
  const borderRadius = rounded === '2xl' ? 16 : 12;
  const content = photo ? (
    <img src={photo} alt={name} className="w-full h-full object-cover" style={{ borderRadius }} />
  ) : (
    <div
      className="w-full h-full flex items-center justify-center font-bold text-[var(--accent)] bg-[var(--accent-light)]"
      style={{ borderRadius, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name) || '?'}
    </div>
  );

  return (
    <div
      className={`flex-shrink-0 ${isSpecial ? 'special-avatar-ring' : ''} ${className}`}
      style={{ width: size, height: size, borderRadius }}
    >
      {content}
    </div>
  );
}
