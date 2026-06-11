// src/components/global/NotificationsPanel.tsx
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

interface NotificationsPanelProps {
  notifications: string[];
  onClear: () => void;
}

export default function NotificationsPanel({ notifications, onClear }: NotificationsPanelProps) {
  return (
    <div className="notifications-panel">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Notifications</h2>
        {notifications.length > 0 && (
          <button onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent-light)] cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--accent-light)] flex items-center justify-center mb-3">
            <CheckCheck className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <p className="font-semibold text-[var(--text-primary)] text-sm mb-1">All caught up!</p>
          <p className="text-xs text-[var(--text-muted)]">No notifications right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...notifications].reverse().map((msg, i) => (
            <div key={i} className="flex items-start gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3">
              <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                <Bell className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed pt-0.5">{msg}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
