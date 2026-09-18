// rebma-mobile/components/ui/Screen.tsx
// Ports: rebma-web/src/index.css .erp-page (24px padding, 12px <768px)
import type { ReactNode } from 'react';
import { View, Animated, RefreshControl, StatusBar, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { DashboardHeaderPinned, DashboardHeaderScrollable, CONTENT_SHEET_RADIUS } from '../chrome/AppHeader';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  /** Auto-detected from `onScroll` being passed (every department
   * home/dashboard screen wires this in via `useCollapsibleHeader()`,
   * nothing else does) — renders the collapsing-then-pinned dashboard
   * header: DashboardHeaderPinned (icon row + department name) stays
   * fixed at the top always; DashboardHeaderScrollable (greeting +
   * search) is normal scroll content that starts right below it and
   * disappears underneath it as the page scrolls — the rest of the
   * page then keeps scrolling under the now-permanently-visible pinned
   * strip. See AppHeader.tsx's own header comment for the two earlier,
   * rejected designs this replaced. Every other screen should omit
   * `onScroll` and gets the plain layout below. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export default function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, footer, onScroll, scrollEventThrottle }: Props) {
  const t = useTheme();
  const isDashboard = !!onScroll;

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bgPage },
    content: padded ? { padding: t.spacing.lg, paddingBottom: t.spacing.xxxl } : {},
  });

  if (isDashboard) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bgPage }}>
        <StatusBar barStyle="light-content" />
        <DashboardHeaderPinned />
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: t.spacing.xxxl }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <View style={{ borderBottomLeftRadius: CONTENT_SHEET_RADIUS, borderBottomRightRadius: CONTENT_SHEET_RADIUS, overflow: 'hidden' }}>
            <DashboardHeaderScrollable />
          </View>
          <View
            style={{
              backgroundColor: t.colors.bgCard,
              ...(padded ? { padding: t.spacing.lg } : {}),
            }}
          >
            {children}
          </View>
        </Animated.ScrollView>
        {footer}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={t.colors.bgPage} />
      {scroll ? (
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          {children}
        </Animated.ScrollView>
      ) : (
        <View style={[{ flex: 1 }, styles.content]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
