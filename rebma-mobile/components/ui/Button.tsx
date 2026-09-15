// rebma-mobile/components/ui/Button.tsx
// Ports: rebma-web/src/index.css .erp-btn / -primary / -ghost / -danger,
// pill radius per the mobile-viewport override (Design Decision D2).
import type { ReactNode } from 'react';
import { Pressable, Text, ActivityIndicator, View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * A small white circular badge at the pill's trailing edge, carrying an
   * arrow/chevron/play icon (mobile-ui-fluidity: reserved for "move
   * forward" actions — submit, continue, start — not every button).
   * Only rendered for variant="primary".
   */
  trailingBadgeIcon?: ReactNode;
}

export default function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, fullWidth, style, trailingBadgeIcon }: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: t.colors.accent,
    ghost: t.colors.bgCard,
    danger: t.colors.status.danger.text,
  }[variant];

  const textColor = variant === 'ghost' ? t.colors.textSecondary : t.colors.onAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.sm,
          backgroundColor: pressed && !isDisabled ? (variant === 'primary' ? t.colors.accentPressed : bg) : bg,
          borderRadius: t.radius.pill,
          paddingVertical: size === 'sm' ? 8 : 12,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: t.colors.border,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: textColor }}>{label}</Text>
          {trailingBadgeIcon && variant === 'primary' ? (
            <View style={{
              width: 26, height: 26, borderRadius: 13, marginLeft: t.spacing.xs,
              backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {trailingBadgeIcon}
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
