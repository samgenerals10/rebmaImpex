// The main page area's scroll: smooth inertia scrolling (Lenis) plus
// sections that rise into view as you scroll to them.
//
// - Lenis smooths wheel and trackpad scrolling inside this panel only.
//   Lists, tables and menus that scroll on their own keep native scrolling
//   (allowNestedScroll), and touch screens keep the phone's own scrolling.
// - Reveal: cards that start below the visible area are faded down a little
//   and rise in as they scroll into view. Anything already on screen is
//   left alone (the page transition animates it), so nothing ever waits
//   to appear.
// Both turn off for "reduce motion" and the Off motion setting.
import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';

// What counts as a "section" for the reveal.
const REVEAL_SELECTOR = [
  '.erp-card', '.kpi-card', '.app-card', '.mobile-card',
  '[class*="rounded-2xl"][class*="border"]',
  '[class*="rounded-3xl"][class*="border"]',
].join(',');

interface Props {
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

export default function SmoothScrollArea({ className, disabled, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Smooth scrolling
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content || disabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.09,              // how softly it eases toward the target
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,        // touch keeps native scrolling
      allowNestedScroll: true, // inner scroll areas keep scrolling themselves
      autoResize: true,
    });
    let frame = 0;
    const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
    frame = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(frame); lenis.destroy(); };
  }, [disabled]);

  // Reveal sections as they scroll into view
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || disabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          if (el.classList.contains('sr-hidden')) {
            el.classList.add('sr-in');
            el.classList.remove('sr-hidden');
            // Hand the card back its own transitions once it has risen in.
            window.setTimeout(() => el.classList.remove('sr-in'), 700);
          }
          io.unobserve(el);
        } else if (e.boundingClientRect.top > (e.rootBounds?.bottom ?? window.innerHeight)) {
          // Below the visible area: hold it lowered until it is scrolled to.
          el.classList.add('sr-hidden');
        } else {
          io.unobserve(el);
        }
      }
    }, { root: wrapper, rootMargin: '0px 0px -6% 0px', threshold: 0.01 });

    const scan = () => {
      wrapper.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
        if (el.dataset.sr) return;
        // Only the outer card animates, not cards inside cards.
        if (el.parentElement?.closest('[data-sr]')) return;
        if (el.closest('.fixed, [role="dialog"], .keep-light, .auth-shell')) return;
        el.dataset.sr = '1';
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(wrapper, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); };
  }, [disabled]);

  return (
    <div ref={wrapperRef} className={className}>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
