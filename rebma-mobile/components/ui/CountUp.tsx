// rebma-mobile/components/ui/CountUp.tsx
// Ports: rebma-web/src/components/CountUp.tsx (value/duration/decimals/
// prefix/suffix/fallback contract kept; DOM-hover re-trigger dropped as
// meaningless on a touch device; renders <Text> instead of <span>).
import { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

interface Props {
  value: number | null | undefined;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  fallback?: string;
  style?: StyleProp<TextStyle>;
}

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export default function CountUp({ value, duration = 900, decimals = 0, prefix = '', suffix = '', format, fallback = 'Not set', style }: Props) {
  const [display, setDisplay] = useState(0);
  // Tracks what is on screen right now, so a refresh that lands mid-count
  // glides on from the current number instead of jumping back (that jump
  // was the visible flicker on auto-refreshing dashboards).
  const shownRef = useRef(0);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    const from = shownRef.current;
    const to = value;
    if (from === to) { setDisplay(to); return; }
    const start = Date.now();
    let raf: ReturnType<typeof setInterval>;
    // setInterval, not requestAnimationFrame — RN throttles rAF when the
    // screen isn't focused/backgrounded, same reasoning as the web version.
    raf = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutExpo(progress);
      const next = from + (to - from) * eased;
      shownRef.current = next;
      setDisplay(next);
      if (progress >= 1) clearInterval(raf);
    }, 16);
    return () => clearInterval(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  if (value == null || Number.isNaN(value)) {
    return <Text style={style}>{fallback}</Text>;
  }

  const text = format ? format(display) : `${prefix}${display.toFixed(decimals)}${suffix}`;
  return <Text style={style}>{text}</Text>;
}
