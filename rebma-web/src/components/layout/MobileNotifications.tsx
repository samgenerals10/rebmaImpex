import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  msg: string;
  time: string;
}

interface MobileNotificationsProps {
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  notifications: Notification[];
}

export function MobileNotifications({ isActive, setIsActive, notifications }: MobileNotificationsProps) {
  if (!isActive) return null;

  return (
    <div className="lg:hidden fixed inset-0 bg-bg-page dark:bg-slate-900 z-40 p-6 pt-12 overflow-y-auto pb-24 animate-fade-in-up">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-bold text-text-primary dark:text-text-muted">Terminal Alerts</h3>
        <button
          type="button"
          onClick={() => setIsActive(false)}
          className="text-text-secondary font-bold text-xs"
        >
          Close
        </button>
      </div>
      {notifications.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Bell className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-xs">No active alerts or system notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="p-4 bg-bg-card dark:bg-slate-800 rounded-2xl border border-custom shadow-card flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-text-primary dark:text-text-muted font-medium leading-relaxed">{n.msg}</p>
                <p className="text-[10px] text-text-muted mt-1">{n.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
