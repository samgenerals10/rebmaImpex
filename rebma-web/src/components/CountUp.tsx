import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number | null | undefined;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  fallback?: React.ReactNode;
  className?: string;
}

const TICK_MS = 16;

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Climbs up from the number's own DOM node to find the nearest hoverable
// "card" ancestor, so callers just drop <CountUp/> in place of a raw number —
// no need to add onMouseEnter/data attributes at every one of the ~55 call
// sites across the app.
function findHoverTarget(node: HTMLElement): HTMLElement {
  let el: HTMLElement | null = node;
  for (let depth = 0; el && depth < 5; depth++) {
    if (el !== node && (el.tagName === 'BUTTON' || el.tagName === 'A' || /\bcard\b|\bkpi\b/i.test(el.className))) {
      return el;
    }
    el = el.parentElement;
  }
  return node.parentElement || node;
}

export default function CountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  fallback = '—',
  className,
}: Props) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [display, setDisplay] = useState(0);

  const isValid = typeof value === 'number' && Number.isFinite(value);

  // setInterval rather than requestAnimationFrame — rAF is suspended by
  // browsers on hidden/backgrounded tabs, which would leave the animation
  // frozen mid-count if the user switches away and back; setInterval keeps
  // ticking (browsers only clamp its rate, never fully pause it).
  const runAnimation = (target: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setDisplay(target * easeOutExpo(t));
      if (t >= 1 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }, TICK_MS);
  };

  useEffect(() => {
    if (!isValid) return;
    runAnimation(value as number);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isValid]);

  useEffect(() => {
    if (!isValid || !spanRef.current) return;
    const target = findHoverTarget(spanRef.current);
    const onEnter = () => runAnimation(value as number);
    target.addEventListener('mouseenter', onEnter);
    return () => target.removeEventListener('mouseenter', onEnter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, value]);

  if (!isValid) return <span className={className}>{fallback}</span>;

  const formatted = format ? format(display) : display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span ref={spanRef} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
