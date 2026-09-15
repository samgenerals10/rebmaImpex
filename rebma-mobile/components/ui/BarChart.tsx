// rebma-mobile/components/ui/BarChart.tsx
//
// Phase 7.1, D9: OpsAnalyticsScreen/FleetAnalyticsScreen need simple
// aggregate bar comparisons (web renders these via a small chart on an
// otherwise metric-tile-driven dashboard). Rather than add a charting
// dependency (react-native-svg, victory-native, etc.) for what's
// fundamentally "these N things compared as proportional bars", this is a
// pure View/Text horizontal bar list — consistent with this project's
// dependency-minimalism precedent (Phase 7.0's D1/D5).
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
  formattedValue?: string;
}

interface Props {
  data: BarChartDatum[];
  maxValue?: number; // defaults to the largest value in `data`
}

export default function BarChart({ data, maxValue }: Props) {
  const t = useTheme();
  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={{ gap: t.spacing.md }}>
      {data.map((d) => {
        const pct = max > 0 ? Math.max(0, Math.min(1, d.value / max)) : 0;
        return (
          <View key={d.label} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>
                {d.formattedValue ?? d.value}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.bgInput, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${pct * 100}%`,
                  height: '100%',
                  borderRadius: t.radius.pill,
                  backgroundColor: d.color || t.colors.accent,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
