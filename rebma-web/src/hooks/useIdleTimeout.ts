import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'] as const;

// session_timeout_minutes was persisted in the Control Center for a while
// with nothing anywhere reading it — no idle-tracking/auto-logout code
// existed at all. This is the whole feature: reset a timer on real user
// interaction (debounced so a stream of mousemove events doesn't reset it
// hundreds of times a second), sign out when it elapses.
export function useIdleTimeout(timeoutMinutes: number, onTimeout: () => void) {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    let timer: ReturnType<typeof setTimeout>;
    let lastReset = 0;

    const reset = () => {
      const now = Date.now();
      // Debounce: a real reset (clearing + rearming the timer) at most once
      // every 5s, regardless of how often activity events fire.
      if (now - lastReset < 5000) return;
      lastReset = now;
      clearTimeout(timer);
      timer = setTimeout(() => onTimeoutRef.current(), timeoutMinutes * 60 * 1000);
    };

    reset();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [timeoutMinutes]);
}
