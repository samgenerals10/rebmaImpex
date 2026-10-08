// rebma-mobile/components/ui/MetricCard.tsx
import type { ReactNode } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useBlinkColor } from '../../hooks/useBlink';
import type { ActionColor } from '../../theme/tokens';

interface Props {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  /** 'compact' is the dashboard-grid size. Per direct correction, no KPI
   * row may ever leave dead space or stretch one card to a different
   * size than its siblings — every card in a row must be identical and
   * every row must be completely full. Screens therefore pick their
   * fixed wrapper `width` as 100 / (a column count that evenly divides
   * that row's actual card count), never flexGrow, so a lone leftover
   * card can never balloon and a partial last row can never happen. */
  emphasis?: 'primary' | 'secondary' | 'compact';
  tone?: 'accent' | 'neutral' | 'warning' | 'danger' | 'success' | 'purple' | 'info';
  trend?: { direction: 'up' | 'down'; value: string };
  onPress?: () => void;
  /** Direct correction, app-wide: a KPI carrying something that needs
   * attention — new/unread activity, a pending count above zero — gets
   * a real red border, not just a colored number inside it. Red stays
   * reserved for this exact meaning (the standing red=danger/
   * yellow=warning rule), so this is deliberately its own prop, never
   * inferred from `tone` (tone='danger' still just tints the icon). */
  flagged?: boolean;
}

export default function MetricCard({ label, value, sublabel, icon, emphasis = 'primary', tone = 'accent', trend, onPress, flagged }: Props) {
  const t = useTheme();

  const toneStyles = {
    accent: { bg: t.colors.accentSoft, text: t.colors.accent },
    neutral: { bg: t.darkMode ? '#262626' : '#F1F5F9', text: t.colors.textSecondary },
    warning: { bg: t.colors.status.warning.bg, text: t.colors.status.warning.text },
    danger: { bg: t.colors.status.danger.bg, text: t.colors.status.danger.text },
    success: { bg: t.colors.status.success.bg, text: t.colors.status.success.text },
    purple: { bg: t.colors.status.purple.bg, text: t.colors.status.purple.text },
    info: { bg: t.colors.status.info.bg, text: t.colors.status.info.text },
  }[tone] || { bg: t.colors.accentSoft, text: t.colors.accent };

  const isPrimary = emphasis === 'primary';
  const isCompact = emphasis === 'compact';
  const tileSize = isPrimary ? 38 : isCompact ? 22 : 38;

  // Direct instruction: a flagged KPI's red border should blink, the
  // same blink the notification bell uses — shared hook, shared visual
  // language, not two separate one-off animations.
  const blinkBorder = useBlinkColor(!!flagged, t.colors.status.danger.text, `${t.colors.status.danger.text}40`);

  // Direct correction: the shadow was reading as fully gone, not just
  // reduced. Root cause — `overflow: 'hidden'` (added so the icon
  // tile's square corners get clipped by the card's rounded corner)
  // was sitting on the SAME view as the shadow. `overflow: hidden`
  // clips anything drawn outside the view's own bounds, including its
  // own shadow, so the shadow token was never actually zero — it was
  // being clipped away entirely. Split into two layers: an outer
  // (shadow, no overflow) and an inner (background/border/padding,
  // overflow:hidden for the icon tile). This is the standard RN
  // pattern for "rounded card with both a shadow and clipped content."
  //
  // Direct correction: dialed back further than the shared 'card'
  // token, which many other components (Card, DataList, Input, Toggle,
  // ...) also use — so this is a KPI-only value, not a change to the
  // shared token, to avoid touching anything the user didn't ask about.
  const kpiShadow = {}; // flat look: no shadow
  const outerStyle = [
    { flex: 1, borderRadius: isCompact ? 12 : 20, height: isPrimary ? 128 : isCompact ? 84 : 94 },
    kpiShadow,
  ];

  const innerStyle = (pressed: boolean) => [
    {
      width: '100%' as const,
      height: '100%' as const,
      backgroundColor: pressed ? (t.darkMode ? '#2D3748' : '#F8F7FF') : t.colors.bgCard,
      borderRadius: isCompact ? 12 : 20,
      borderWidth: flagged ? 1.5 : 1,
      borderColor: flagged ? blinkBorder : t.colors.border,
      // Direct correction: on 'secondary' cards (3-per-row, the same
      // footprint as the Department Pages tiles) the full t.spacing.lg
      // (16) horizontal padding left barely enough room for a 7-letter
      // heading like "PENDING" next to the 38px icon — fine on the web
      // preview's font metrics, but wrapped a lone trailing letter onto
      // its own line on a real device's Inter rendering. Horizontal
      // padding only is tightened for 'secondary'; vertical rhythm (and
      // 'primary'/'compact') is untouched.
      paddingVertical: isCompact ? t.spacing.xs : t.spacing.lg,
      paddingHorizontal: isCompact ? t.spacing.xs : isPrimary ? t.spacing.lg : t.spacing.sm,
      justifyContent: 'space-between' as const,
      overflow: 'hidden' as const,
    },
  ];

  const content = (pressed: boolean) => (
    <Animated.View style={innerStyle(pressed)}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isCompact ? 4 : t.spacing.sm }}>
        <Text
          // Direct correction: heading bolder than before (extrabold,
          // not just bold); the sublabel/description text below is
          // deliberately untouched.
          style={{ fontFamily: t.font.extrabold, fontSize: isCompact ? t.type.label9.size : t.type.meta10.size, lineHeight: isCompact ? 11 : undefined, letterSpacing: 0.2, textTransform: 'uppercase', color: t.colors.textSecondary, flexShrink: 1, marginRight: 4 }}
          numberOfLines={2}
        >
          {label}
        </Text>
        {icon ? (
          <View style={{ width: tileSize, height: tileSize, flexShrink: 0, borderRadius: isCompact ? 7 : 14, backgroundColor: toneStyles.bg, alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </View>
        ) : null}
      </View>
      <View>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text
            // adjustsFontSizeToFit has no real effect on react-native-web
            // (silently ignored, not merely unsupported) — a fixed size
            // chosen to actually fit two cards per row is what's load-
            // bearing here, not the shrink-to-fit prop.
            style={{ fontFamily: t.font.extrabold, fontSize: isPrimary ? t.type.title18.size : isCompact ? t.type.base16.size : t.type.title18.size, color: t.colors.textPrimary }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {sublabel ? (
          <Text style={{ fontFamily: t.font.regular, fontSize: isCompact ? t.type.label9.size : t.type.meta10.size, color: t.colors.textMuted, marginTop: isCompact ? 2 : 4 }} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
        {trend ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            {trend.direction === 'up' ? <TrendingUp size={12} color={t.colors.status.success.text} /> : <TrendingDown size={12} color={t.colors.status.danger.text} />}
            <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: trend.direction === 'up' ? t.colors.status.success.text : t.colors.status.danger.text }}>
              {trend.value}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={outerStyle}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  ) : (
    <View style={outerStyle}>{content(false)}</View>
  );
}

export const ACTION_COLORS: Record<ActionColor, string> = {
  // amber aligned to the real logo droplet color — see theme/tokens.ts's
  // own action.amber for the same change and reasoning.
  emerald: '#10b981', blue: '#3b82f6', indigo: '#6366f1', amber: '#f2a72e',
  teal: '#14b8a6', sky: '#0ea5e9', rose: '#f43f5e', violet: '#5b4dff',
};
