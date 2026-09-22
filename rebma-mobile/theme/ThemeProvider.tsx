// rebma-mobile/theme/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors, radius, spacing, type as baseType, font, shadow, darkShadow, type ColorTokens } from './tokens';
import { useAuthStore } from '../store/authStore';
import { darken, hexToRgba, deriveBackgroundSet, normalizeHex } from '../lib/color';

const DARK_MODE_KEY = 'rebma-dark-mode';
const ACCENT_KEY = 'rebma-accent-color';
const BG_KEY = 'rebma-bg-color';
const CUSTOM_ACCENT_KEY = 'rebma-custom-accent';
const CUSTOM_BG_KEY = 'rebma-custom-bg';
const NOTIF_SOUND_KEY = 'rebma-notification-sound';

export const FONT_SCALES = { small: 0.9, medium: 1, large: 1.15 } as const;
export type FontSizePreference = keyof typeof FONT_SCALES;

export const ACCENT_PALETTE = {
  // The real Rebma logo blue (sampled directly from assets/logo-mark.png,
  // matching components/auth/AuthGradientButton.tsx's TURQUOISE) — now
  // the app-wide default, per direct correction to rebrand off the
  // inherited "SalesPulse" violet. Kept in this same user-selectable
  // palette (not hardcoded) so Appearance settings still let someone
  // switch away from it, same as before.
  // Brightened per direct correction — the old #02afd9 read noticeably
  // duller on a real phone screen than in the browser preview (different
  // color management/gamma between the two), so this is a punchier, more
  // saturated turquoise chosen to actually "shine" on-device, not just
  // in a desktop browser tab.
  turquoise: { label: 'Rebma Turquoise', accent: '#00C2E8', accentPressed: '#0099BD', accentSoft: 'rgba(0,194,232,0.12)' },
  violet: { label: 'Royal Violet (Aczone)', accent: '#5B4DFF', accentPressed: '#4F46E5', accentSoft: 'rgba(91,77,255,0.12)' },
  emerald: { label: 'Emerald Green', accent: '#10b981', accentPressed: '#059669', accentSoft: 'rgba(16,185,129,0.12)' },
  blue: { label: 'Ocean Blue', accent: '#3b82f6', accentPressed: '#2563eb', accentSoft: 'rgba(59,130,246,0.12)' },
  indigo: { label: 'Midnight Indigo', accent: '#6366f1', accentPressed: '#4f46e5', accentSoft: 'rgba(99,102,241,0.12)' },
  // Aligned to the real logo droplet amber (was the generic #f59e0b),
  // matching AuthGradientButton.tsx's AMBER exactly.
  amber: { label: 'Rebma Amber', accent: '#f2a72e', accentPressed: '#cc8c1f', accentSoft: 'rgba(242,167,46,0.12)' },
  rose: { label: 'Rose Berry', accent: '#f43f5e', accentPressed: '#e11d48', accentSoft: 'rgba(244,63,94,0.12)' },
  teal: { label: 'Teal Cyan', accent: '#14b8a6', accentPressed: '#0d9488', accentSoft: 'rgba(20,184,166,0.12)' },
} as const;
export type AccentKey = keyof typeof ACCENT_PALETTE;

export const BACKGROUND_PALETTE = {
  lavender: { label: 'Lavender', bgPage: '#F8F7FD', bgCard: '#FFFFFF', bgInput: '#F4F3FA', border: '#EDE9FE', textPrimary: '#1E1B4B' },
  slate: { label: 'Clean Slate', bgPage: '#F1F5F9', bgCard: '#FFFFFF', bgInput: '#F8FAFC', border: '#E2E8F0', textPrimary: '#0F172A' },
  linen: { label: 'Warm Linen', bgPage: '#FAF9F6', bgCard: '#FFFFFF', bgInput: '#F5F4F0', border: '#EFECE6', textPrimary: '#292524' },
  white: { label: 'Pure White', bgPage: '#FFFFFF', bgCard: '#F8F9FA', bgInput: '#F1F3F5', border: '#E9ECEF', textPrimary: '#111827' },
  onyx: { label: 'Dark Velvet', bgPage: '#0F172A', bgCard: '#1E293B', bgInput: '#0F172A', border: '#334155', textPrimary: '#F1F5F9' },
} as const;
export type BgKey = keyof typeof BACKGROUND_PALETTE;

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
  colors: ColorTokens;
  radius: typeof radius;
  spacing: typeof spacing;
  type: ScaledType;
  font: typeof font;
  shadow: (token: keyof typeof shadow) => Record<string, unknown>;
  fontSizePreference: FontSizePreference;
  setFontSizePreference: (pref: FontSizePreference) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  accentKey: AccentKey;
  setAccentKey: (key: AccentKey) => void;
  bgKey: BgKey;
  setBgKey: (key: BgKey) => void;
  customAccentHex: string | null;
  setCustomAccent: (hex: string | null) => void;
  customBgHex: string | null;
  setCustomBg: (hex: string | null) => void;
  notificationSound: string;
  setNotificationSound: (id: string) => void;
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
  accentKey: 'turquoise', setAccentKey: () => {},
  bgKey: 'lavender', setBgKey: () => {},
  customAccentHex: null, setCustomAccent: () => {},
  customBgHex: null, setCustomBg: () => {},
  notificationSound: 'chime', setNotificationSound: () => {},
});

function applyCustomColors(
  base: ColorTokens,
  accent: AccentKey,
  bg: BgKey,
  isDark: boolean,
  customAccentHex: string | null,
  customBgHex: string | null
): ColorTokens {
  const preset = ACCENT_PALETTE[accent] || ACCENT_PALETTE.violet;
  const a = customAccentHex
    ? { accent: customAccentHex, accentPressed: darken(customAccentHex, 15), accentSoft: hexToRgba(customAccentHex, 0.12) }
    : preset;
  const b = customBgHex ? deriveBackgroundSet(customBgHex) : BACKGROUND_PALETTE[bg] || BACKGROUND_PALETTE.lavender;

  if (isDark) {
    return {
      ...darkColors,
      accent: a.accent,
      accentPressed: a.accentPressed,
      accentSoft: a.accentSoft,
      borderFocus: a.accent,
    };
  }

  return {
    ...base,
    accent: a.accent,
    accentPressed: a.accentPressed,
    accentSoft: a.accentSoft,
    borderFocus: a.accent,
    bgPage: b.bgPage,
    bgCard: b.bgCard,
    bgInput: b.bgInput,
    border: b.border,
    textPrimary: b.textPrimary,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const profile = useAuthStore((s) => s.profile);
  const [fontSizePreference, setFontSizePreference] = useState<FontSizePreference>('medium');
  const [darkMode, setDarkMode] = useState(false);
  const [accentKey, setAccentKeyState] = useState<AccentKey>('turquoise');
  const [bgKey, setBgKeyState] = useState<BgKey>('lavender');
  const [customAccentHex, setCustomAccentState] = useState<string | null>(null);
  const [customBgHex, setCustomBgState] = useState<string | null>(null);
  const [notificationSound, setNotificationSoundState] = useState('chime');

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
    AsyncStorage.getItem(BG_KEY).then((v) => {
      if (v && v in BACKGROUND_PALETTE) setBgKeyState(v as BgKey);
    });
    AsyncStorage.getItem(CUSTOM_ACCENT_KEY).then((v) => {
      if (v) setCustomAccentState(v);
    });
    AsyncStorage.getItem(CUSTOM_BG_KEY).then((v) => {
      if (v) setCustomBgState(v);
    });
    AsyncStorage.getItem(NOTIF_SOUND_KEY).then((v) => {
      if (v) setNotificationSoundState(v);
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
    // Choosing a preset swatch overrides any custom-picked color.
    setCustomAccentState(null);
    AsyncStorage.removeItem(CUSTOM_ACCENT_KEY);
  };

  const setBgKey = (key: BgKey) => {
    setBgKeyState(key);
    AsyncStorage.setItem(BG_KEY, key);
    setCustomBgState(null);
    AsyncStorage.removeItem(CUSTOM_BG_KEY);
  };

  const setCustomAccent = (hex: string | null) => {
    const norm = hex ? normalizeHex(hex) : null;
    setCustomAccentState(norm);
    if (norm) AsyncStorage.setItem(CUSTOM_ACCENT_KEY, norm);
    else AsyncStorage.removeItem(CUSTOM_ACCENT_KEY);
  };

  const setCustomBg = (hex: string | null) => {
    const norm = hex ? normalizeHex(hex) : null;
    setCustomBgState(norm);
    if (norm) AsyncStorage.setItem(CUSTOM_BG_KEY, norm);
    else AsyncStorage.removeItem(CUSTOM_BG_KEY);
  };

  const setNotificationSound = (id: string) => {
    setNotificationSoundState(id);
    AsyncStorage.setItem(NOTIF_SOUND_KEY, id);
  };

  const value: Theme = {
    colors: applyCustomColors(colors, accentKey, bgKey, darkMode, customAccentHex, customBgHex),
    radius, spacing, font, shadow: resolveShadow(darkMode),
    type: scaleType(FONT_SCALES[fontSizePreference]),
    fontSizePreference, setFontSizePreference,
    darkMode, toggleDarkMode,
    accentKey, setAccentKey,
    bgKey, setBgKey,
    customAccentHex, setCustomAccent,
    customBgHex, setCustomBg,
    notificationSound, setNotificationSound,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
