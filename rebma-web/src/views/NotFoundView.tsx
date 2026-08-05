import { MapPinOff } from 'lucide-react';

export default function NotFoundView() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-page)] flex flex-col items-center justify-center p-6 text-center">
      <MapPinOff className="w-10 h-10 text-text-muted mb-4" />
      <h1 className="text-lg font-extrabold text-text-primary mb-1">Page not found</h1>
      <p className="text-sm text-text-muted mb-6 max-w-xs">
        The page you're looking for doesn't exist or the link is out of date.
      </p>
      <a
        href="/"
        className="px-4 py-2 rounded-full bg-[var(--accent)] text-white text-xs font-bold"
      >
        Back to Rebma Impex
      </a>
    </div>
  );
}
