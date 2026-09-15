// rebma-mobile/components/ui/Card.tsx
// Ports: rebma-web/src/index.css .erp-card + .mobile-card
import type { ReactNode } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  children: ReactNode;
  padded?: boolean;
  /**
   * 'default' = neutral white list/section card, shadow only (no border,
   * mobile-ui-fluidity: a border is redundant once a card already reads
   * as separate via shadow + a contrasting page background).
   * 'inset' = flat bgPage fill for nested blocks (e.g. a ticket card inside a list).
   * 'hero' = one dominant accent-filled card per screen for the single
   * headline number/message (mobile-ui-fluidity card-weight tier 1).
   * 'soft' = light accentSoft tint for a secondary promo/streak card
   * (mobile-ui-fluidity card-weight tier 2).
   */
  tone?: 'default' | 'inset' | 'hero' | 'soft';
  style?: StyleProp<ViewStyle>;
}

export default function Card({ children, padded = true, tone = 'default', style }: Props) {
  const t = useTheme();
  const bg =
    tone === 'inset' ? t.colors.bgPage :
    tone === 'hero' ? t.colors.accent :
    tone === 'soft' ? t.colors.accentSoft :
    t.colors.bgCard;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: tone === 'inset' ? t.radius.md : t.radius.card,
          borderWidth: tone === 'inset' ? 1 : 0,
          borderColor: t.colors.border,
          padding: padded ? t.spacing.xl : 0,
        },
        tone === 'default' && t.shadow('card'),
        tone === 'hero' && t.shadow('raised'),
        style,
      ]}
    >
      {children}
    </View>
  );
}
