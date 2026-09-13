// rebma-mobile/components/ui/Card.tsx
// Ports: rebma-web/src/index.css .erp-card + .mobile-card
import type { ReactNode } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  children: ReactNode;
  padded?: boolean;
  /** 'inset' = flat bgPage fill for nested blocks (e.g. a ticket card inside a list). */
  tone?: 'default' | 'inset';
  style?: StyleProp<ViewStyle>;
}

export default function Card({ children, padded = true, tone = 'default', style }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'inset' ? t.colors.bgPage : t.colors.bgCard,
          borderRadius: tone === 'inset' ? t.radius.md : t.radius.card,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: padded ? t.spacing.xl : 0,
        },
        tone === 'default' && t.shadow('card'),
        style,
      ]}
    >
      {children}
    </View>
  );
}
