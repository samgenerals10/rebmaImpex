// rebma-mobile/components/ui/Screen.tsx
// Ports: rebma-web/src/index.css .erp-page (24px padding, 12px <768px)
import type { ReactNode } from 'react';
import { View, Animated, RefreshControl, StatusBar, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import DashboardHeader, { CONTENT_SHEET_RADIUS } from '../chrome/AppHeader';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  /** Auto-detected from `onScroll` being passed (every department
   * home/dashboard screen wires this in via `useCollapsibleHeader()`,
   * nothing else does) — renders the purple DashboardHeader as the
   * first item in the scroll content, followed by a rounded-top
   * content sheet. The header is normal, non-fixed content — it
   * scrolls away with the rest of the page like everything else, it
   * doesn't stay pinned while content rises over it (that was tried
   * and rejected after seeing it live: icons shifting/hiding and
   * content sliding up behind the header read as poor UX in practice).
   * Every other screen should omit `onScroll` and gets the plain
   * layout below. */
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
          <DashboardHeader />
          <View
            style={{
              backgroundColor: t.colors.bgCard,
              borderTopLeftRadius: CONTENT_SHEET_RADIUS,
              borderTopRightRadius: CONTENT_SHEET_RADIUS,
              marginTop: -CONTENT_SHEET_RADIUS,
              ...(padded ? { padding: t.spacing.lg, paddingTop: t.spacing.lg + CONTENT_SHEET_RADIUS } : {}),
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
