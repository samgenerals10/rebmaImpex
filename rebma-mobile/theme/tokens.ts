// rebma-mobile/theme/tokens.ts
//
// Every value here is transcribed from rebma-web/src/index.css (the
// SalesPulse default theme, the only theme rebma-web ships without the
// user picking an alternate one) — not invented. See the Phase 7.0 plan
// for the exact line-by-line source of each value.
//
// Radius/button values target the MOBILE rendering of SalesPulse
// (index.css's <1024px override: --radius-card:1.5rem, --radius-btn:9999px),
// not the desktop one — that's what a phone already sees on rebma-web today.

// Widened shape shared by `colors` and `darkColors` so either can be
// assigned to Theme.colors — plain `as const` would narrow each object to
// its own literal hex values, making the two palettes structurally
// incompatible types even though they share every key.
export interface ColorTokens {
  accent: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  bgPage: string;
  bgCard: string;
  bgHeader: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  border: string;
  borderFocus: string;
  status: Record<'success' | 'warning' | 'danger' | 'info' | 'muted' | 'purple', { bg: string; text: string }>;
  action: Record<'emerald' | 'blue' | 'indigo' | 'amber' | 'teal' | 'sky' | 'rose' | 'violet', string>;
}

export const colors: ColorTokens = {
  accent: '#5B4DFF',
  accentPressed: '#4F46E5',
  accentSoft: 'rgba(91, 77, 255, 0.12)',
  onAccent: '#ffffff',

  bgPage: '#F8F7FD',
  bgCard: '#ffffff',
  bgHeader: '#ffffff',
  bgInput: '#F4F3FA',

  textPrimary: '#1E1B4B',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textOnAccent: '#ffffff',

  border: '#EDE9FE',
  borderFocus: '#5B4DFF',

  // Semantic status set — Aczone vibrant pastel design system
  status: {
    success: { bg: '#DCFCE7', text: '#10B981' },
    warning: { bg: '#FEF3C7', text: '#D97706' },
    danger: { bg: '#FFE4E6', text: '#E11D48' },
    info: { bg: '#E0F2FE', text: '#0284C7' },
    muted: { bg: '#F1F5F9', text: '#64748B' },
    purple: { bg: '#EDE9FE', text: '#6C5CE7' },
  },

  // Aczone Action Icon Circles
  action: {
    emerald: '#10b981',
    blue: '#3b82f6',
    indigo: '#6366f1',
    // Aligned to the real logo droplet amber (was the generic #f59e0b)
    // per direct correction — amber should read as the actual Rebma
    // brand color everywhere it already appears app-wide (metric card
    // icon tiles, quick-action circles, badges), not a generic shade.
    amber: '#f2a72e',
    teal: '#14b8a6',
    sky: '#0ea5e9',
    rose: '#f43f5e',
    violet: '#5b4dff',
  },
} as const;

// Phase 7.12, D116/D120: dark-mode overrides — transcribed from
// rebma-web/src/index.css:349-374 (body.dark-mode), not invented.
// Accent, status badges, and the fixed QuickActions action palette are
// DELIBERATELY unchanged from light mode: web's own dark-mode CSS block
// never touches --accent/--accent-2/--accent-soft or any .erp-badge-*
// color (confirmed by a direct grep of index.css — zero dark-mode
// overrides exist for either), so in dark mode web's status badges keep
// rendering the same light pastel backgrounds with saturated text. This
// is not a bug to "fix" here — it's web's real, confirmed behavior.
export const darkColors: ColorTokens = {
  accent: colors.accent,
  accentPressed: colors.accentPressed,
  accentSoft: colors.accentSoft,
  onAccent: colors.onAccent,

  bgPage: '#0f172a',
  bgCard: '#1e293b',
  bgHeader: '#1e293b',
  bgInput: '#0f172a',

  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  textOnAccent: '#ffffff',

  border: '#334155',
  borderFocus: colors.accent,

  status: colors.status,
  action: colors.action,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 22,
  pill: 9999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 8,
  smd: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Named by role, not by raw px, since that's how the web app actually uses
// its type scale (text-[9px] uppercase labels, text-sm body, etc).
export const type = {
  label9: { size: 9, lineHeight: 12, letterSpacing: 0.7 },
  meta10: { size: 10, lineHeight: 13, letterSpacing: 0 },
  meta11: { size: 11, lineHeight: 15, letterSpacing: 0.6 },
  body12: { size: 12, lineHeight: 17, letterSpacing: 0 },
  body14: { size: 14, lineHeight: 20, letterSpacing: 0 },
  base16: { size: 16, lineHeight: 22, letterSpacing: 0.3 },
  title18: { size: 18, lineHeight: 24, letterSpacing: 0 },
  page24: { size: 24, lineHeight: 30, letterSpacing: 0 },
  kpi28: { size: 28, lineHeight: 32, letterSpacing: 0 },
} as const;

export const font = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const shadow = {
  card: {
    ios: { shadowColor: '#4338CA', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8 },
    android: { elevation: 2 },
  },
  raised: {
    ios: { shadowColor: '#4338CA', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14 },
    android: { elevation: 4 },
  },
  dropdown: {
    ios: { shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 12 },
  },
  sheet: {
    ios: { shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 14 },
  },
  tabBar: {
    ios: { shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 10 },
    android: { elevation: 10 },
  },
  // Dialed back one round after "projected too deep" — this token is now
  // ALSO scoped to only the actual bottom-nav FAB (Button.tsx's own
  // primary-variant shadow was split off to 'raised' so ordinary buttons
  // never inherit this).
  fab: {
    ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 10 },
    android: { elevation: 8 },
  },
} as const;

// Phase 7.12, D117: dark-mode shadow overrides. Web gives `--shadow-card`
// (and its sidebar/header siblings) a dark override — same offset/radius,
// opacity bumped from ~0.06 to ~0.4 (index.css:362-364) — but explicitly
// leaves `--shadow-dropdown` UNCHANGED even in dark mode (confirmed: no
// override exists). `dropdown` therefore stays untouched below, matching
// that specific confirmed absence, not an oversight. `raised`/`sheet`/
// `tabBar` have no web equivalent (invented in Phase 7.0) — the same
// ratio-of-increase web applied to `card` (~6.7x) is applied to them here
// for consistency, a reasoned extension of the one real pattern rather
// than a guess. `fab`'s shadow is accent-colored, not a neutral surface
// shadow, and web gives no signal either way — left unchanged.
export const darkShadow = {
  card: {
    ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2 },
    android: { elevation: 1 },
  },
  raised: {
    ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.65, shadowRadius: 8 },
    android: { elevation: 3 },
  },
  dropdown: shadow.dropdown,
  sheet: {
    ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.65, shadowRadius: 12 },
    android: { elevation: 12 },
  },
  tabBar: {
    ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.75, shadowRadius: 6 },
    android: { elevation: 12 },
  },
  fab: shadow.fab,
} as const;

export type ShadowToken = keyof typeof shadow;
export type StatusTone = keyof typeof colors.status;
export type ActionColor = keyof typeof colors.action;
