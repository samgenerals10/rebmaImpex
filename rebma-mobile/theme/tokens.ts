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

// Dark mode: neutral near-black in the style of Vercel and Supabase, the
// same palette as the web app (rebma-web/src/index.css, DARK MODE).
// Brand accent and the action colours stay the same; status badges get
// soft tints that suit a dark background.
export const darkColors: ColorTokens = {
  accent: colors.accent,
  accentPressed: colors.accentPressed,
  accentSoft: colors.accentSoft,
  onAccent: colors.onAccent,

  bgPage: '#0a0a0a',
  bgCard: '#111111',
  bgHeader: '#0a0a0a',
  bgInput: '#171717',

  textPrimary: '#ededed',
  textSecondary: '#a1a1a1',
  textMuted: '#737373',
  textOnAccent: '#ffffff',

  border: '#262626',
  borderFocus: colors.accent,

  status: {
    success: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
    warning: { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15' },
    danger: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
    info: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    muted: { bg: '#1f1f1f', text: '#a1a1a1' },
    purple: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
  },
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
  // Body and paragraph text one step heavier than 400, for readability (matches web's body weight).
  regular: 'Inter_500Medium',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

// Clean, flat look (as on Vercel and Supabase): no shadows anywhere.
// Surfaces are separated by thin borders instead. The token names stay so
// every component keeps working; each one now resolves to "no shadow".
const FLAT = {
  ios: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0 },
  android: { elevation: 0 },
} as const;

export const shadow = {
  card: FLAT,
  raised: FLAT,
  dropdown: FLAT,
  sheet: FLAT,
  tabBar: FLAT,
  fab: FLAT,
} as const;

export const darkShadow = shadow;

export type ShadowToken = keyof typeof shadow;
export type StatusTone = keyof typeof colors.status;
export type ActionColor = keyof typeof colors.action;
