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
  accent: '#22c55e',
  accentPressed: '#16a34a',
  accentSoft: 'rgba(34,197,94,0.10)',
  onAccent: '#ffffff',

  bgPage: '#f0fdf4',
  bgCard: '#ffffff',
  bgHeader: '#ffffff',
  bgInput: '#f9fafb',

  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textOnAccent: '#ffffff',

  border: '#e2e8f0',
  borderFocus: '#22c55e',

  // Semantic status set — the app's own NAMED design system
  // (.erp-badge-success/-warning/-danger/-info/-muted/-purple in index.css),
  // not the ad-hoc inline Tailwind pairs used at individual call sites.
  status: {
    success: { bg: '#dcfce7', text: '#16a34a' },
    warning: { bg: '#fef9c3', text: '#ca8a04' },
    danger: { bg: '#fee2e2', text: '#dc2626' },
    info: { bg: '#dbeafe', text: '#2563eb' },
    muted: { bg: '#f1f5f9', text: '#64748b' },
    purple: { bg: '#ede9fe', text: '#7c3aed' },
  },

  // QuickActions.tsx's icon circles are deliberately NOT accent-driven —
  // fixed per-action colors that must never be swapped when a theme
  // changes. Keep this a separate namespace from `accent`.
  action: {
    emerald: '#10b981',
    blue: '#3b82f6',
    indigo: '#6366f1',
    amber: '#f59e0b',
    teal: '#14b8a6',
    sky: '#0ea5e9',
    rose: '#f43f5e',
    violet: '#8b5cf6',
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
  card: 24,
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

// @expo-google-fonts/inter family names — never use RN's `fontWeight` on
// top of these. Android does not synthesize sibling weights the way iOS
// does; fontWeight either fakes it or is silently ignored. Every primitive
// must set `fontFamily` to one of these, never `fontWeight`.
export const font = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

// CSS box-shadow has no RN equivalent — iOS reads shadowColor/Offset/
// Opacity/Radius, Android reads elevation only (no color, can't cast
// upward). Android also requires an opaque backgroundColor on the same
// view for elevation to render at all — remember that at every call site.
export const shadow = {
  card: {
    ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
    android: { elevation: 1 },
  },
  raised: {
    ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 8 },
    android: { elevation: 3 },
  },
  dropdown: {
    ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 12 },
    android: { elevation: 12 },
  },
  sheet: {
    ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.10, shadowRadius: 12 },
    android: { elevation: 12 },
  },
  // Android can't cast a shadow upward from a bottom-anchored bar — the
  // 1px top border (already part of MobileNav.tsx's own design) is the
  // faithful Android fallback, not a compromise.
  tabBar: {
    ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 6 },
    android: { elevation: 12 },
  },
  fab: {
    ios: { shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 8 },
    android: { elevation: 6 },
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
