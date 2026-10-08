// rebma-mobile/components/ui/Screen.tsx
// Ports: rebma-web/src/index.css .erp-page (24px padding, 12px <768px)
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Animated, RefreshControl, StyleSheet, Dimensions, Platform, KeyboardAvoidingView, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import DashboardHeader, { usePinnedHeaderHeight, CONTENT_SHEET_RADIUS } from '../chrome/AppHeader';
import { useScrollSections } from '../../hooks/useScrollSections';
import { ScrollSectionsContext } from '../../context/ScrollSectionsContext';
import SectionQuickNavRail from '../chrome/SectionQuickNavRail';
import { RevealContext } from './ScrollReveal';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  /** Which sides get safe-area inset padding. Defaults to top+left+right,
   * correct for a screen with no header above it. A screen pushed under
   * `SubScreenHeader` (every department sub-tab) already gets its own
   * `paddingTop: insets.top` there — leaving 'top' in this list too
   * double-counts that inset, showing as a real, large dead gap on any
   * device with a notch/Dynamic Island (invisible in a plain browser
   * preview, which has no such inset — confirmed as the real cause of a
   * reported "huge padding above the tabs" that never showed up in
   * screenshots taken here). Pass `edges={['left','right']}` from a
   * screen that already sits under that header. */
  edges?: ('top' | 'left' | 'right' | 'bottom')[];
  /** Auto-detected from `onScroll` being passed (every department
   * home/dashboard screen wires this in via `useCollapsibleHeader()`,
   * nothing else does) — renders DashboardHeader as a fixed sibling,
   * always on top (see AppHeader.tsx's own header comment for why —
   * it's what makes the header's own buttons reliably clickable,
   * unlike two earlier attempts where content could end up in front of
   * it). The scroll content starts with a transparent spacer matching
   * the header's real height, then an opaque content sheet — content
   * scrolls normally, disappearing behind the fixed header as it
   * passes underneath it. Every other screen should omit `onScroll`
   * and gets the plain layout below. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export default function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, footer, onScroll, scrollEventThrottle, edges = ['top', 'left', 'right'] }: Props) {
  const t = useTheme();
  const isDashboard = !!onScroll;
  const pinnedHeaderH = usePinnedHeaderHeight();
  const scrollRef = useRef<any>(null);
  // Dashboard mode: content starts below the fixed gradient header (via a
  // spacer) plus padding. Plain mode: no fixed header lives inside this
  // ScrollView at all (SubScreenHeader is react-navigation's own chrome,
  // rendered above/outside it), so content starts at just the padding.
  const contentTopOffset = (isDashboard ? pinnedHeaderH : 0) + (padded ? t.spacing.lg : 0);
  const sections = useScrollSections(contentTopOffset);
  // Reveal on scroll (components/ui/ScrollReveal.tsx)
  const revealScrollY = useRef(new Animated.Value(0)).current;
  const revealScrollNow = useRef(0);
  const [revealViewport, setRevealViewport] = useState({ h: 0, top: 0 });
  const revealInfo = useMemo(() => ({
    scrollY: revealScrollY, viewportH: revealViewport.h, viewportTop: revealViewport.top,
    currentScroll: () => revealScrollNow.current,
  }), [revealScrollY, revealViewport]);
  const trackReveal = (y: number) => { revealScrollNow.current = y; revealScrollY.setValue(y); };
  const measureViewport = () => {
    scrollRef.current?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
      if (h > 0) setRevealViewport({ h, top: y });
    });
  };

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bgPage },
    content: padded ? { padding: t.spacing.lg, paddingBottom: t.spacing.xxxl } : {},
  });

  if (isDashboard) {
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll?.(e);
      sections.onScroll(e.nativeEvent.contentOffset.y);
      trackReveal(e.nativeEvent.contentOffset.y);
    };

    const jumpTo = (id: string) => {
      const target = sections.scrollTargetFor(id);
      if (target != null) scrollRef.current?.scrollTo({ y: target, animated: true });
    };

    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bgPage }}>
        {/* Without this, a focused input anywhere on a dashboard screen
            (Create Order's form, a search box, etc.) had no compensation
            at all when the keyboard opened, nothing scrolled it back
            into view, so it just sat hidden behind the keyboard. Same
            fix as Sheet.tsx's own KeyboardAvoidingView, per direct
            correction. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: t.spacing.xxxl }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} progressViewOffset={pinnedHeaderH} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={scrollEventThrottle || 16}
          onLayout={measureViewport}
        >
          <View style={{ height: pinnedHeaderH }} />
          <View
            style={{
              backgroundColor: t.colors.bgCard,
              borderTopLeftRadius: CONTENT_SHEET_RADIUS,
              borderTopRightRadius: CONTENT_SHEET_RADIUS,
              // Per direct correction — a short-content page (e.g. Quick
              // Links with nothing pending) used to leave the pale page
              // background showing through below a small white card. The
              // white content sheet should always cover at least the full
              // visible screen, not just wrap tightly around its content.
              minHeight: Dimensions.get('window').height - pinnedHeaderH,
              ...(padded ? { padding: t.spacing.lg } : {}),
            }}
          >
            <ScrollSectionsContext.Provider value={{ registerSection: sections.registerSection, unregisterSection: sections.unregisterSection, scheduleRemeasure: sections.scheduleRemeasure }}>
              <RevealContext.Provider value={revealInfo}>{children}</RevealContext.Provider>
            </ScrollSectionsContext.Provider>
          </View>
        </Animated.ScrollView>
        </KeyboardAvoidingView>
        <SectionQuickNavRail sections={sections.pastSections} onJump={jumpTo} />
        <DashboardHeader />
        {footer}
      </View>
    );
  }

  const onScrollProp = onScroll as ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
  const handlePlainScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (onScrollProp) onScrollProp(e);
    sections.onScroll(e.nativeEvent.contentOffset.y);
    trackReveal(e.nativeEvent.contentOffset.y);
  };

  const jumpToPlain = (id: string) => {
    const target = sections.scrollTargetFor(id);
    if (target != null) scrollRef.current?.scrollTo({ y: target, animated: true });
  };

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {scroll ? (
        <>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Animated.ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} />
              ) : undefined
            }
            keyboardShouldPersistTaps="handled"
            onScroll={handlePlainScroll}
            scrollEventThrottle={scrollEventThrottle || 16}
            onLayout={measureViewport}
          >
            <ScrollSectionsContext.Provider value={{ registerSection: sections.registerSection, unregisterSection: sections.unregisterSection, scheduleRemeasure: sections.scheduleRemeasure }}>
              <RevealContext.Provider value={revealInfo}>{children}</RevealContext.Provider>
            </ScrollSectionsContext.Provider>
          </Animated.ScrollView>
          </KeyboardAvoidingView>
          <SectionQuickNavRail sections={sections.pastSections} onJump={jumpToPlain} />
        </>
      ) : (
        <View style={[{ flex: 1 }, styles.content]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
