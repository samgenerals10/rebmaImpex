// rebma-mobile/components/ui/Screen.tsx
// Ports: rebma-web/src/index.css .erp-page (24px padding, 12px <768px)
import type { ReactNode } from 'react';
import { View, Animated, RefreshControl, StatusBar, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { DASHBOARD_ICON_ROW_H, DASHBOARD_HEADER_CONTENT_H, CONTENT_SHEET_RADIUS } from '../chrome/AppHeader';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  /** Wire in `useCollapsibleHeader()`'s `scrollHandler` here to get the
   * dashboard header behavior on this screen: Screen switches into its
   * dashboard layout automatically whenever this is passed — a
   * transparent spacer (matching the fixed purple header's real height)
   * followed by an opaque, rounded-top content sheet. Because that's
   * rendered as normal scrollable content sitting behind the purple
   * header at rest, scrolling the page is what makes the sheet
   * physically rise and cover the header — no transform/animation
   * needed for that part (see AppHeader.tsx's own header comment).
   * Only pass this from a department's home/dashboard screen; every
   * other screen should omit it and gets the plain, non-dashboard
   * layout below. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
}

export default function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, footer, onScroll, scrollEventThrottle }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isDashboard = !!onScroll;

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bgPage },
    content: padded ? { padding: t.spacing.lg, paddingBottom: t.spacing.xxxl } : {},
  });

  if (isDashboard) {
    const headerH = insets.top + DASHBOARD_ICON_ROW_H + DASHBOARD_HEADER_CONTENT_H;
    return (
      // Deliberately no backgroundColor here — this View sits at the same
      // stacking level as the fixed purple header (DashboardHeaderBackground,
      // a sibling rendered by DepartmentHomeScreen.tsx, behind this one).
      // An opaque background on this wrapper would paint over the entire
      // screen regardless of the transparent spacer below, hiding the
      // purple header completely — the spacer only works if this stays
      // transparent; the opaque bgCard sheet further down is what's
      // actually supposed to provide the "cover" effect.
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: t.spacing.xxxl }}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={[t.colors.accent]} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <View style={{ height: headerH }} />
          <View
            style={{
              backgroundColor: t.colors.bgCard,
              borderTopLeftRadius: CONTENT_SHEET_RADIUS,
              borderTopRightRadius: CONTENT_SHEET_RADIUS,
              minHeight: 4,
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
