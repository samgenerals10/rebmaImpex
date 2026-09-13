// rebma-mobile/theme/presets.ts
//
// Ready-made style fragments composed from theme tokens, so screens almost
// never write a raw color/radius/spacing number themselves — the same
// ergonomic win NativeWind would have offered, without the build-tooling
// risk (see Phase 7.0 plan, Design Decision D1).
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, type Theme } from './ThemeProvider';

export function createPresets(t: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.bgPage,
    },
    card: {
      backgroundColor: t.colors.bgCard,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.xl,
      ...t.shadow('card'),
    },
    cardInner: {
      backgroundColor: t.colors.bgPage,
      borderRadius: t.radius.md,
      padding: t.spacing.md,
    },
    pageTitle: {
      fontFamily: t.font.bold,
      fontSize: t.type.page24.size,
      lineHeight: t.type.page24.lineHeight,
      color: t.colors.textPrimary,
    },
    pageSubtitle: {
      fontFamily: t.font.regular,
      fontSize: t.type.body14.size,
      lineHeight: t.type.body14.lineHeight,
      color: t.colors.textSecondary,
    },
    label9: {
      fontFamily: t.font.bold,
      fontSize: t.type.label9.size,
      lineHeight: t.type.label9.lineHeight,
      letterSpacing: t.type.label9.letterSpacing,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
    },
    meta: {
      fontFamily: t.font.regular,
      fontSize: t.type.meta10.size,
      lineHeight: t.type.meta10.lineHeight,
      color: t.colors.textMuted,
    },
    body: {
      fontFamily: t.font.regular,
      fontSize: t.type.body14.size,
      lineHeight: t.type.body14.lineHeight,
      color: t.colors.textPrimary,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: t.colors.border,
    },
    inputBase: {
      backgroundColor: t.colors.bgInput,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.smd,
      fontFamily: t.font.regular,
      fontSize: t.type.body14.size,
      color: t.colors.textPrimary,
    },
  });
}

export function usePresets() {
  const t = useTheme();
  // Tokens are static within Phase 7.0 (one theme only), so this recomputes
  // only if the theme object identity ever changes (e.g. Phase 7.12 dark mode).
  return useMemo(() => createPresets(t), [t]);
}
