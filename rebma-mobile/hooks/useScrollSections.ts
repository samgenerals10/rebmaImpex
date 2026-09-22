// rebma-mobile/hooks/useScrollSections.ts
//
// Backs the floating "scrolled-past sections" rail: every screen already
// breaks itself into visual pieces (hero card, metric grid, list cards,
// ModuleLauncher groups — see any Overview screen). Wrap each piece in
// <TrackedSection id title icon> and it registers itself here. As the
// user scrolls, whichever pieces have scrolled entirely above the
// visible viewport (behind the fixed header) collapse into a small icon
// in <SectionQuickNavRail>, tap to jump straight back to that piece —
// no need to scroll all the way back up to find it.
//
// Position tracking uses direct window-relative measurement
// (measureInWindow), not each section's own onLayout y in isolation —
// onLayout does NOT reliably refire for a section that only *moved*
// because an earlier sibling's content changed size (e.g. a card that
// only mounts once loading finishes, pushing everything below it down).
// Confirmed live: a section below a conditionally-mounted card kept
// reporting its stale pre-load position. measureInWindow + the current
// scroll offset gives every section's true position on every remeasure
// pass, regardless of what caused the shift.
//
// No react-native-reanimated in this app (Design Decision D5) — this
// runs on the plain JS-thread onScroll already wired for the header dim
// effect (useCollapsibleHeader), just with an extra cheap listener.
import { useCallback, useRef, useState, type ComponentType } from 'react';
import type { View } from 'react-native';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface TrackedSectionMeta {
  id: string;
  title: string;
  icon: ComponentType<any>;
  y: number;
  height: number;
}

interface Entry {
  id: string;
  title: string;
  icon: ComponentType<any>;
  ref: View;
  y: number;
  height: number;
}

// contentTopOffset: constant distance from the ScrollView's own content
// top to where the tracked pieces begin (pinned header height + padding)
// — Screen.tsx owns both, so it's passed in rather than recomputed here.
export function useScrollSections(contentTopOffset: number) {
  const entriesRef = useRef<Map<string, Entry>>(new Map());
  const scrollYRef = useRef(0);
  const remeasureScheduled = useRef(false);
  const [pastSections, setPastSections] = useState<TrackedSectionMeta[]>([]);

  const recomputePast = useCallback(() => {
    const scrollY = scrollYRef.current;
    const past: TrackedSectionMeta[] = [];
    entriesRef.current.forEach((e) => {
      if (e.y + e.height < scrollY + contentTopOffset - 4) {
        past.push({ id: e.id, title: e.title, icon: e.icon, y: e.y, height: e.height });
      }
    });
    past.sort((a, b) => b.y - a.y); // most-recently-scrolled-past nearest the top of the rail

    setPastSections((prev) => {
      const prevIds = prev.map((p) => p.id).join(',');
      const nextIds = past.map((p) => p.id).join(',');
      if (prevIds === nextIds) return prev;
      LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
      return past;
    });
  }, [contentTopOffset]);

  const remeasureAll = useCallback(() => {
    const entries = Array.from(entriesRef.current.values());
    if (entries.length === 0) return;
    let pending = entries.length;
    entries.forEach((e) => {
      e.ref?.measureInWindow?.((_x, winY) => {
        // Absolute content-relative y: window-y of the piece plus how far
        // we've already scrolled (pieces scroll up as scrollY grows, so
        // adding it back converts a viewport-relative measurement into a
        // stable, scroll-independent content coordinate).
        e.y = winY + scrollYRef.current;
        pending -= 1;
        if (pending === 0) recomputePast();
      });
    });
  }, [recomputePast]);

  const scheduleRemeasure = useCallback(() => {
    if (remeasureScheduled.current) return;
    remeasureScheduled.current = true;
    requestAnimationFrame(() => {
      remeasureScheduled.current = false;
      remeasureAll();
    });
  }, [remeasureAll]);

  const registerSection = useCallback(
    (meta: { id: string; title: string; icon: ComponentType<any> }, ref: View, initialHeight: number) => {
      entriesRef.current.set(meta.id, { ...meta, ref, y: 0, height: initialHeight });
      scheduleRemeasure();
    },
    [scheduleRemeasure],
  );

  const unregisterSection = useCallback((id: string) => {
    entriesRef.current.delete(id);
    recomputePast();
  }, [recomputePast]);

  const onScroll = useCallback(
    (y: number) => {
      scrollYRef.current = y;
      recomputePast();
    },
    [recomputePast],
  );

  // e.y is "the scroll offset that would put this piece's top at the very
  // top of the window" — but the top of the window is covered by the
  // fixed header, so the real target backs off by that much (plus a
  // little breathing room) to land the piece just below the header.
  const scrollTargetFor = useCallback(
    (id: string) => {
      const e = entriesRef.current.get(id);
      if (!e) return null;
      return Math.max(0, e.y - contentTopOffset - 12);
    },
    [contentTopOffset],
  );

  return { registerSection, unregisterSection, onScroll, pastSections, scrollTargetFor, scheduleRemeasure };
}
