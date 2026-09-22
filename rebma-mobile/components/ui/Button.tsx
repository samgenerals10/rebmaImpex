// rebma-mobile/components/ui/Button.tsx
import type { ReactNode } from 'react';
import { Pressable, Text, ActivityIndicator, View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  trailingBadgeIcon?: ReactNode;
}

export default function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, fullWidth, style, trailingBadgeIcon }: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: t.colors.accent,
    ghost: t.colors.bgCard,
    soft: t.colors.accentSoft,
    danger: t.colors.status.danger.text,
  }[variant];

  const textColor =
    variant === 'ghost' ? t.colors.textPrimary :
    variant === 'soft' ? t.colors.accent :
    t.colors.onAccent;

  const padVertical = size === 'sm' ? 8 : size === 'lg' ? 15 : 12;
  const padHorizontal = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;

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
          paddingVertical: padVertical,
          paddingHorizontal: padHorizontal,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: t.colors.border,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        // 'raised', not 'fab' — per direct correction, an ordinary primary
        // button (e.g. "Open in Maps" inside a DataList row) had picked up
        // the bottom-nav FAB's own deep shadow and looked like it had
        // dropped/detached from its row. Buttons get the lighter, standard
        // elevation; only the actual nav FAB uses 'fab'.
        variant === 'primary' && !isDisabled && t.shadow('raised'),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            numberOfLines={1}
            style={{ fontFamily: t.font.bold, fontSize: size === 'sm' ? t.type.body12.size : t.type.body14.size, color: textColor }}
          >
            {label}
          </Text>
          {trailingBadgeIcon && variant === 'primary' ? (
            <View style={{
              width: 26, height: 26, borderRadius: 13, marginLeft: t.spacing.xs,
              backgroundColor: 'rgba(255,255,255,0.25)',
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
