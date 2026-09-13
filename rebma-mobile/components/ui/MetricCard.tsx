// rebma-mobile/components/ui/MetricCard.tsx
// Ports: rebma-web/src/components/mobile/MobileMetricCard.tsx
import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import type { ActionColor } from '../../theme/tokens';

interface Props {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  emphasis?: 'primary' | 'secondary';
  tone?: 'accent' | 'neutral' | 'warning' | 'danger';
  trend?: { direction: 'up' | 'down'; value: string };
  onPress?: () => void;
}

export default function MetricCard({ label, value, sublabel, icon, emphasis = 'secondary', tone = 'accent', trend, onPress }: Props) {
  const t = useTheme();
  const toneColor = {
    accent: t.colors.accent,
    neutral: t.colors.textSecondary,
    warning: t.colors.status.warning.text,
    danger: t.colors.status.danger.text,
  }[tone];

  const isPrimary = emphasis === 'primary';
  const tileSize = isPrimary ? 44 : 36;

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: t.colors.bgCard,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: isPrimary ? t.radius.lg : t.radius.md,
        padding: t.spacing.lg,
        ...t.shadow('card'),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
        <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, letterSpacing: 0.4, textTransform: 'uppercase', color: t.colors.textSecondary, flexShrink: 1 }}>
          {label}
        </Text>
        {icon ? (
          <View style={{ width: tileSize, height: tileSize, borderRadius: tileSize / 2, backgroundColor: `${toneColor}20`, borderWidth: 1, borderColor: `${toneColor}30`, alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </View>
        ) : null}
      </View>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={{ fontFamily: t.font.extrabold, fontSize: isPrimary ? t.type.kpi28.size : t.type.body14.size, color: t.colors.textPrimary }}>{value}</Text>
      ) : (
        value
      )}
      {sublabel ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>{sublabel}</Text> : null}
      {trend ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          {trend.direction === 'up' ? <TrendingUp size={11} color={t.colors.status.success.text} /> : <TrendingDown size={11} color={t.colors.status.danger.text} />}
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: trend.direction === 'up' ? t.colors.status.success.text : t.colors.status.danger.text }}>
            {trend.value}
          </Text>
        </View>
      ) : null}
    </Wrapper>
  );
}

export const ACTION_COLORS: Record<ActionColor, string> = {
  emerald: '#10b981', blue: '#3b82f6', indigo: '#6366f1', amber: '#f59e0b',
  teal: '#14b8a6', sky: '#0ea5e9', rose: '#f43f5e', violet: '#8b5cf6',
};
