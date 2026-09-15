// rebma-mobile/components/ui/ProgressBar.tsx
// New primitive (mobile-ui-fluidity skill): horizontal completion bar with
// a trailing percentage, for a list of parallel completions (stock
// fulfillment per product, subject/department progress lists). Formalizes
// what a few screens were already hand-rolling ad hoc.
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  /** 0-100 */
  value: number;
  label?: string;
  color?: string;
  trackColor?: string;
  showPercent?: boolean;
  height?: number;
}

export default function ProgressBar({ value, label, color, trackColor, showPercent = true, height = 6 }: Props) {
  const t = useTheme();
  const fillColor = color ?? t.colors.accent;
  const track = trackColor ?? t.colors.bgInput;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View>
      {(label || showPercent) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: t.spacing.xs }}>
          {label ? (
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>
              {label}
            </Text>
          ) : <View />}
          {showPercent ? (
            <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
              {Math.round(clamped)}%
            </Text>
          ) : null}
        </View>
      )}
      <View style={{ height, borderRadius: t.radius.pill, backgroundColor: track, overflow: 'hidden' }}>
        <View style={{ width: `${clamped}%`, height: '100%', borderRadius: t.radius.pill, backgroundColor: fillColor }} />
      </View>
    </View>
  );
}
