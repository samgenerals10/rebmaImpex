// rebma-mobile/components/ui/IconActionButton.tsx
//
// A small tinted circular icon-only action button, for a table row's
// action row when it has 2+ actions that would otherwise run a row of
// full-width labeled buttons long (see ControlCenterScreen's Staff list:
// Suspend/Reactivate + Reset Password + Terminate stacked as 3 full-width
// pills per person, direct correction — "these can be icons so the list
// will not be that long... this is how we are doing all the tables").
// Same 34px tinted-circle shape PersistentIconRow.tsx's header icons
// already use, colored by the same status tone set every status Badge
// already draws from, so a row of these reads instantly (green = safe
// action, amber = caution, red = destructive) without a single word.
import type { ComponentType } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { StatusTone } from '../../theme/tokens';

interface Props {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tone: StatusTone;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  accessibilityLabel?: string;
}

export default function IconActionButton({ icon: Icon, tone, onPress, disabled, size = 34, accessibilityLabel }: Props) {
  const t = useTheme();
  const toneColors = t.colors.status[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: toneColors.bg,
        opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
      })}
    >
      <Icon size={Math.round(size * 0.46)} color={toneColors.text} strokeWidth={2} />
    </Pressable>
  );
}
