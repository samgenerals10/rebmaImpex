// rebma-mobile/components/ui/Screen.tsx
// Ports: rebma-web/src/index.css .erp-page (24px padding, 12px <768px)
import type { ReactNode } from 'react';
import { View, ScrollView, RefreshControl, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
}

export default function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, footer }: Props) {
  const t = useTheme();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bgPage },
    content: padded ? { padding: t.spacing.lg, paddingBottom: t.spacing.xxxl } : {},
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={t.colors.bgPage} />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, styles.content]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
