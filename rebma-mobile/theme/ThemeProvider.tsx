// rebma-mobile/theme/ThemeProvider.tsx
//
// Components consume useTheme(), never `tokens.ts` directly — that seam is
// what makes a future dark-mode/alternate-theme addition (Phase 7.12) a
// second token object swapped in here, not a refactor of every screen.
//
// Phase 7.11, D86: `type` is exposed pre-scaled by a `fontScale` multiplier
// (Small/Medium/Large), the one Appearance control this phase ships —
// every other web Appearance control (template, font family, accent,
// motion, dark mode, density…) is deferred to Phase 7.12, which already
// owns this exact token seam. The preference is seeded once from the
// signed-in profile's `metadata.appearance.fontSize` (via authStore's
// `raw` escape hatch — no AsyncStorage dependency needed, the profile row
// is already loaded) and only changes when AppearanceScreen calls
// `setFontSizePreference`; persisting that choice to Supabase is
// AppearanceScreen's job, not this provider's.
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

export const FONT_SCALES = { small: 0.9, medium: 1, large: 1.15 } as const;
export type FontSizePreference = keyof typeof FONT_SCALES;

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
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const profile = useAuthStore((s) => s.profile);
  const [fontSizePreference, setFontSizePreference] = useState<FontSizePreference>('medium');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = (profile?.raw as any)?.metadata?.appearance?.fontSize;
    if (saved === 'small' || saved === 'medium' || saved === 'large') setFontSizePreference(saved);
  }, [profile?.id]);

  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((v) => {
      if (v === 'true') setDarkMode(true);
    });
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      AsyncStorage.setItem(DARK_MODE_KEY, next ? 'true' : 'false');
      return next;
    });
  };

  // D4 (Phase 7.0): only one theme's tokens exist as a single object; the
  // seam this provider was built around is exactly this ternary, added in
  // Phase 7.12 — no refactor of any consuming screen was needed.
  const value: Theme = {
    colors: darkMode ? darkColors : colors,
    radius, spacing, font, shadow: resolveShadow(darkMode),
    type: scaleType(FONT_SCALES[fontSizePreference]),
    fontSizePreference, setFontSizePreference,
    darkMode, toggleDarkMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
