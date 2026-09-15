// rebma-mobile/theme/ThemeProvider.tsx
//
// Components consume useTheme(), never `tokens.ts` directly — that seam is
// what makes a future dark-mode/alternate-theme addition (Phase 7.12) a
// second token object swapped in here, not a refactor of every screen.
//
// Phase 7.11, D86: `type` is exposed pre-scaled by a `fontScale` multiplier
// (Small/Medium/Large). The preference is seeded once from the signed-in
// profile's `metadata.appearance.fontSize` (via authStore's `raw` escape
// hatch — no AsyncStorage dependency needed, the profile row is already
// loaded) and only changes when AppearanceScreen calls
// `setFontSizePreference`; persisting that choice to Supabase is
// AppearanceScreen's job, not this provider's.
//
// Dark Mode (Phase 7.12) and Accent Color (mobile-ui-fluidity redesign
// pass) are both real now too, both AsyncStorage-only. Template, font
// family, motion, and density remain the only Appearance controls not
// built — not a port of web's five alternate theme shells, which stay
// explicitly out of scope for this whole rollout.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, radius, spacing, type as baseType, font, shadow, darkShadow } from './tokens';
import { useAuthStore } from '../store/authStore';

// Phase 7.12, D118: persistence is AsyncStorage-only, matching a real,
// confirmed fact about web's own dark mode — it is localStorage-only
// (key 'erp-dark-mode', App.tsx:230-232,258) and is NEVER mirrored to
// profiles.metadata anywhere (deliberately excluded from the `appearance`
// object that DOES sync — confirmed by reading that literal object).
// Replicating web's real local-only behavior here is more faithful than
// inventing a cloud sync web itself doesn't have.
const DARK_MODE_KEY = 'rebma-dark-mode';
const ACCENT_KEY = 'rebma-accent-color';

export const FONT_SCALES = { small: 0.9, medium: 1, large: 1.15 } as const;
export type FontSizePreference = keyof typeof FONT_SCALES;

// A real accent-color picker, not a port of web's five alternate theme
// shells (Aczone/Finova/Foodie/LiamFinance/FinloFlash) — those swap far
// more than an accent hue and stay out of scope, same call every phase of
// this rollout made. This is a smaller, genuinely shippable capability
// using the exact token seam Phase 7.0/7.12 built for it: every screen
// already reads accent color through useTheme(), so overriding it here
// cascades app-wide with zero screen-level changes. Local-only
// persistence, matching Dark Mode's own real, confirmed-local behavior.
export const ACCENT_PALETTE = {
  green: { label: 'Green', accent: '#22c55e', accentPressed: '#16a34a', accentSoft: 'rgba(34,197,94,0.10)' },
  blue: { label: 'Blue', accent: '#3b82f6', accentPressed: '#2563eb', accentSoft: 'rgba(59,130,246,0.10)' },
  violet: { label: 'Violet', accent: '#8b5cf6', accentPressed: '#7c3aed', accentSoft: 'rgba(139,92,246,0.10)' },
  rose: { label: 'Rose', accent: '#f43f5e', accentPressed: '#e11d48', accentSoft: 'rgba(244,63,94,0.10)' },
  amber: { label: 'Amber', accent: '#f59e0b', accentPressed: '#d97706', accentSoft: 'rgba(245,158,11,0.10)' },
  teal: { label: 'Teal', accent: '#14b8a6', accentPressed: '#0d9488', accentSoft: 'rgba(20,184,166,0.10)' },
} as const;
export type AccentKey = keyof typeof ACCENT_PALETTE;

type ScaledType = typeof baseType;

function scaleType(scale: number): ScaledType {
  const out: Record<string, { size: number; lineHeight: number; letterSpacing: number }> = {};
  for (const key of Object.keys(baseType) as Array<keyof typeof baseType>) {
    const entry = baseType[key];
    out[key] = { ...entry, size: Math.round(entry.size * scale), lineHeight: Math.round(entry.lineHeight * scale) };
  }
  return out as ScaledType;
}

export interface Theme {
  colors: typeof colors;
  radius: typeof radius;
  spacing: typeof spacing;
  type: ScaledType;
  font: typeof font;
  /** Resolves a shadow token to the current platform's style object, spread directly onto a View's style. */
  shadow: (token: keyof typeof shadow) => Record<string, unknown>;
  fontSizePreference: FontSizePreference;
  setFontSizePreference: (pref: FontSizePreference) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  accentKey: AccentKey;
  setAccentKey: (key: AccentKey) => void;
}

function resolveShadow(darkMode: boolean) {
  const table = darkMode ? darkShadow : shadow;
  return (token: keyof typeof shadow) => {
    const entry = table[token];
    return Platform.OS === 'android' ? entry.android : entry.ios;
  };
}

const ThemeContext = createContext<Theme>({
  colors, radius, spacing, type: baseType, font, shadow: resolveShadow(false),
  fontSizePreference: 'medium', setFontSizePreference: () => {},
  darkMode: false, toggleDarkMode: () => {},
  accentKey: 'green', setAccentKey: () => {},
});

function withAccent(base: typeof colors, key: AccentKey): typeof colors {
  const a = ACCENT_PALETTE[key];
  return { ...base, accent: a.accent, accentPressed: a.accentPressed, accentSoft: a.accentSoft, borderFocus: a.accent };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const profile = useAuthStore((s) => s.profile);
  const [fontSizePreference, setFontSizePreference] = useState<FontSizePreference>('medium');
  const [darkMode, setDarkMode] = useState(false);
  const [accentKey, setAccentKeyState] = useState<AccentKey>('green');

  useEffect(() => {
    const saved = (profile?.raw as any)?.metadata?.appearance?.fontSize;
    if (saved === 'small' || saved === 'medium' || saved === 'large') setFontSizePreference(saved);
  }, [profile?.id]);

  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((v) => {
      if (v === 'true') setDarkMode(true);
    });
    AsyncStorage.getItem(ACCENT_KEY).then((v) => {
      if (v && v in ACCENT_PALETTE) setAccentKeyState(v as AccentKey);
    });
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(DARK_MODE_KEY, next ? 'true' : 'false');
      return next;
    });
  };

  const setAccentKey = (key: AccentKey) => {
    setAccentKeyState(key);
    AsyncStorage.setItem(ACCENT_KEY, key);
  };

  // D4 (Phase 7.0): only one theme's tokens exist as a single object; the
  // seam this provider was built around is exactly this ternary, added in
  // Phase 7.12 — no refactor of any consuming screen was needed.
  const value: Theme = {
    colors: withAccent(darkMode ? darkColors : colors, accentKey),
    radius, spacing, font, shadow: resolveShadow(darkMode),
    type: scaleType(FONT_SCALES[fontSizePreference]),
    fontSizePreference, setFontSizePreference,
    darkMode, toggleDarkMode,
    accentKey, setAccentKey,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
