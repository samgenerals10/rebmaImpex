// rebma-mobile/components/ui/StickyActionBar.tsx
// Ports: rebma-web/src/components/mobile/MobileStickyAction.tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

export default function StickyActionBar({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: t.colors.bgCard, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      <View style={{ padding: t.spacing.lg }}>{children}</View>
    </SafeAreaView>
  );
}
