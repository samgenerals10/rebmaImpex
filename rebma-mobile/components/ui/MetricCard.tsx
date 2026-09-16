// rebma-mobile/components/ui/MetricCard.tsx
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
  tone?: 'accent' | 'neutral' | 'warning' | 'danger' | 'success' | 'purple' | 'info';
  trend?: { direction: 'up' | 'down'; value: string };
  onPress?: () => void;
}

export default function MetricCard({ label, value, sublabel, icon, emphasis = 'primary', tone = 'accent', trend, onPress }: Props) {
  const t = useTheme();

  const toneStyles = {
    accent: { bg: t.colors.accentSoft, text: t.colors.accent },
    neutral: { bg: t.darkMode ? '#334155' : '#F1F5F9', text: t.colors.textSecondary },
    warning: { bg: t.colors.status.warning.bg, text: t.colors.status.warning.text },
    danger: { bg: t.colors.status.danger.bg, text: t.colors.status.danger.text },
    success: { bg: t.colors.status.success.bg, text: t.colors.status.success.text },
    purple: { bg: t.colors.status.purple.bg, text: t.colors.status.purple.text },
    info: { bg: t.colors.status.info.bg, text: t.colors.status.info.text },
  }[tone] || { bg: t.colors.accentSoft, text: t.colors.accent };

  const isPrimary = emphasis === 'primary';
  const tileSize = isPrimary ? 44 : 38;

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: any) => [
        {
          flex: 1,
          backgroundColor: pressed ? (t.darkMode ? '#2D3748' : '#F8F7FF') : t.colors.bgCard,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: t.spacing.lg,
          minHeight: isPrimary ? 116 : 94,
          justifyContent: 'space-between',
        },
        !pressed && t.shadow('card'),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.sm }}>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta10.size, letterSpacing: 0.5, textTransform: 'uppercase', color: t.colors.textSecondary, flexShrink: 1 }}>
          {label}
        </Text>
        {icon ? (
          <View style={{ width: tileSize, height: tileSize, borderRadius: 14, backgroundColor: toneStyles.bg, alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </View>
        ) : null}
      </View>
      <View>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text style={{ fontFamily: t.font.extrabold, fontSize: isPrimary ? t.type.kpi28.size : t.type.title18.size, color: t.colors.textPrimary }}>
            {value}
          </Text>
        ) : (
          value
        )}
        {sublabel ? <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: 4 }}>{sublabel}</Text> : null}
        {trend ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            {trend.direction === 'up' ? <TrendingUp size={12} color={t.colors.status.success.text} /> : <TrendingDown size={12} color={t.colors.status.danger.text} />}
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: trend.direction === 'up' ? t.colors.status.success.text : t.colors.status.danger.text }}>
              {trend.value}
            </Text>
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
}

export const ACTION_COLORS: Record<ActionColor, string> = {
  emerald: '#10b981', blue: '#3b82f6', indigo: '#6366f1', amber: '#f59e0b',
  teal: '#14b8a6', sky: '#0ea5e9', rose: '#f43f5e', violet: '#5b4dff',
};
