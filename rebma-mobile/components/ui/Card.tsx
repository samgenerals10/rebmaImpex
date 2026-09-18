// rebma-mobile/components/ui/Card.tsx
import type { ReactNode } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  children: ReactNode;
  padded?: boolean;
  tone?: 'default' | 'inset' | 'hero' | 'soft';
  style?: StyleProp<ViewStyle>;
}

export default function Card({ children, padded = true, tone = 'default', style }: Props) {
  const t = useTheme();
  const bg =
    tone === 'inset' ? (t.darkMode ? '#1E293B' : '#F4F3FA') :
    tone === 'hero' ? t.colors.accent :
    tone === 'soft' ? t.colors.accentSoft :
    t.colors.bgCard;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: tone === 'inset' ? t.radius.lg : t.radius.card,
          borderWidth: tone === 'inset' ? 1 : 1,
          borderColor: tone === 'hero' ? 'transparent' : t.colors.border,
          padding: padded ? t.spacing.xl : 0,
        },
        tone === 'default' && t.shadow('card'),
        tone === 'hero' && t.shadow('raised'),
        tone === 'soft' && t.shadow('card'),
        style,
      ]}
    >
      {children}
    </View>
  );
}
