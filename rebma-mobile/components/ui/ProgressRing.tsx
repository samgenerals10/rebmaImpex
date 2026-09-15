// rebma-mobile/components/ui/ProgressRing.tsx
// New primitive (mobile-ui-fluidity skill): a circular percentage ring for
// one headline completion number per screen (a quiz's "3/10 Answered", a
// dashboard's clearance rate). Real SVG, not a View-based approximation.
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Defaults to the theme accent; pass a colors.action value for a non-accent ring. */
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  /** When true, renders on a dark/accent background (white text/track). */
  onDark?: boolean;
}

export default function ProgressRing({
  value, size = 64, strokeWidth = 6, color, trackColor, label, sublabel, onDark,
}: Props) {
  const t = useTheme();
  const ringColor = color ?? (onDark ? t.colors.onAccent : t.colors.accent);
  const track = trackColor ?? (onDark ? 'rgba(255,255,255,0.28)' : t.colors.bgInput);
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={ringColor} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontFamily: t.font.extrabold, fontSize: size >= 56 ? t.type.body14.size : t.type.meta11.size, color: onDark ? t.colors.onAccent : t.colors.textPrimary }}>
        {label ?? `${Math.round(clamped)}%`}
      </Text>
      {sublabel ? (
        <Text style={{ fontFamily: t.font.medium, fontSize: 8, color: onDark ? 'rgba(255,255,255,0.85)' : t.colors.textMuted, marginTop: 1 }}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}
