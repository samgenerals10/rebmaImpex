// src/components/global/NotificationsPanel.tsx
import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, BellOff, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { stopAlertSound } from '../../utils/notificationSound';

interface DbNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  sender_name?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  recipient_department?: string | null;
  recipient_id?: string | null;
}

interface NotificationsPanelProps {
  /** Legacy in-memory notifications (still shown as a fallback row) */
  notifications?: string[];
  onClear?: () => void;
  currentUser?: { id: string; department: string; fullName?: string } | null;
}

export default function NotificationsPanel({ notifications = [], onClear, currentUser }: NotificationsPanelProps) {
  const [dbNotifs, setDbNotifs] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string | null, dept: string | null) => {
    if (!uid && !dept) { setLoading(false); return; }
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (uid && dept) {
        query = query.or(`recipient_id.eq.${uid},recipient_department.eq.${dept}`);
      } else if (uid) {
        query = query.eq('recipient_id', uid);
      } else if (dept) {
        query = query.eq('recipient_department', dept);
      }

      const { data } = await query;
      setDbNotifs((data as DbNotification[]) ?? []);
    } catch {
      setDbNotifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const uid = currentUser?.id ?? (await supabase.auth.getUser()).data.user?.id ?? null;
      const dept = currentUser?.department ?? null;
      setUserId(uid);
      await load(uid, dept);

      if (!uid) return;

      // Real-time: subscribe to both personal and department notifications
      const channel = supabase
        .channel('notifications-panel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${uid}`,
        }, (payload) => {
          setDbNotifs(prev => [payload.new as DbNotification, ...prev]);
        })
        .subscribe();

      // Also subscribe to department-level notifications if dept is known
      const deptChannel = dept ? supabase
        .channel('notifications-panel-dept')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_department=eq.${dept}`,
        }, (payload) => {
          const n = payload.new as DbNotification;
          // Avoid duplicate if also addressed to this user specifically
          setDbNotifs(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]);
        })
        .subscribe() : null;

      return () => {
        supabase.removeChannel(channel);
        if (deptChannel) supabase.removeChannel(deptChannel);
      };
    };
    init();
  }, [currentUser, load]);

  const markRead = async (id: string, actionUrl?: string | null) => {
    stopAlertSound(); // stop any repeating alert
    setDbNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {}, () => {});
    if (actionUrl) {
      // Navigate within the SPA if it's a hash/path, or open external URL
      if (actionUrl.startsWith('http')) {
        window.open(actionUrl, '_blank', 'noopener');
      } else {
        window.location.hash = actionUrl;
      }
    }
  };

  const markAllRead = async () => {
    const unreadIds = dbNotifs.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setDbNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  };

  const clearAll = async () => {
    stopAlertSound();
    if (userId) {
      await supabase.from('notifications').delete().eq('recipient_id', userId);
      setDbNotifs([]);
    }
    onClear?.();
  };

  const unreadCount = dbNotifs.filter(n => !n.read).length;
  const hasAny = dbNotifs.length > 0 || notifications.length > 0;

  const typeColor = (type: string) => {
    if (type === 'success') return 'bg-emerald-500/10 text-emerald-500';
    if (type === 'warning') return 'bg-amber-500/10 text-amber-500';
    if (type === 'error')   return 'bg-rose-500/10 text-rose-500';
    return 'bg-[var(--accent-light)] text-[var(--accent)]';
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="notifications-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent-light)] cursor-pointer">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
          {hasAny && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent-light)] cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="animate-pulse h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasAny && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--accent-light)] flex items-center justify-center mb-3">
            <BellOff className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <p className="font-semibold text-[var(--text-primary)] text-sm mb-1">All caught up!</p>
          <p className="text-xs text-[var(--text-muted)]">No notifications right now.</p>
        </div>
      )}

      {/* DB notifications */}
      {!loading && (
        <div className="space-y-2">
          {dbNotifs.map(n => (
            <button
              key={n.id}
              onClick={() => markRead(n.id, n.action_url)}
              className={`w-full text-left flex items-start gap-3 border border-[var(--border)] rounded-xl p-3 transition-all cursor-pointer ${
                n.read
                  ? 'bg-[var(--bg-card)] opacity-60'
                  : 'bg-[var(--bg-card)] shadow-sm ring-1 ring-[var(--accent)]/10'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${typeColor(n.type)}`}>
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{n.title}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {n.action_url && <ExternalLink className="w-3 h-3 text-[var(--accent)] opacity-70" />}
                    {!n.read && <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{n.message}</p>
                {n.action_label && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-[var(--accent)] underline underline-offset-2">{n.action_label}</span>
                )}
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </button>
          ))}

          {/* Legacy in-memory notifications (shown below DB ones) */}
          {notifications.length > 0 && dbNotifs.length === 0 && [...notifications].reverse().map((msg, i) => (
            <div key={`legacy-${i}`} className="flex items-start gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3">
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
