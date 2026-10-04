// rebma-mobile/components/auth/AuthGradientButton.tsx
//
// Fifth pass, per direct correction: the palette moves to turquoise
// blue (primary — button, active states) + amber (the input icons) +
// a small touch of the deep forest green (links, back arrow) — no
// gradients anywhere. All three sampled directly from
// assets/logo-mark.png, not darkened or invented: TURQUOISE is the
// swoosh's own blue, AMBER is the droplet, FOREST is the wordmark's
// dominant green.
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export const TURQUOISE = '#02afd9';
/** The real logo droplet amber — per direct correction, used identically
 * for both the input-box icons and the "Register"/"Log In" link text,
 * not a separately-darkened shade for one or the other. */
export const AMBER = '#f2a72e';
export const FOREST = '#0c5c34';
/** Kept as an alias so existing call sites (link/back-arrow color)
 * don't need a rename in this same pass. */
export const GREEN = FOREST;

/** Fixed, non-theme text/fill colors for the whole auth flow (Login,
 * Register, Forgot Password — all built on this same shared header/
 * button/back-button set). This screen group always renders on a
 * hardcoded white background regardless of the app's dark mode setting,
 * so its text must NOT come from theme tokens — t.colors.textPrimary/
 * textMuted flip to light, dark-mode-appropriate colors once dark mode
 * is on, which on this fixed white background produced near-invisible
 * text. Fixed here instead, and deliberately high-contrast/bold per
 * direct correction. */
export const INK = '#111827';
export const MUTED = '#6b7280';
export const FIELD_FILL = '#f3f4f6';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
}

export default function AuthGradientButton({ label, onPress, disabled, variant = 'solid' }: Props) {
  const t = useTheme();

  if (variant === 'outline') {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={[styles.outline, { borderColor: TURQUOISE, opacity: disabled ? 0.6 : 1 }]}>
        <Text style={[styles.outlineLabel, { fontFamily: t.font.bold, color: TURQUOISE }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        // Dark (black-based), not the theme's purple-tinted 'raised'
        // shadow, per direct correction.
        !disabled && !pressed && t.shadow('fab'),
        { backgroundColor: TURQUOISE, opacity: disabled ? 0.7 : pressed ? 0.9 : 1 },
      ]}
    >
      <Text style={[styles.label, { fontFamily: t.font.bold }]}>{label}</Text>
    </Pressable>
  );
}

// FIELD_HEIGHT is the one shared height for this button AND every
// auth-screen input box (LoginScreen.tsx/RegisterScreen.tsx's inputBox
// style) — per direct correction, they must all line up exactly, not
// just look close.
export const FIELD_HEIGHT = 52;

const styles = StyleSheet.create({
  button: { height: FIELD_HEIGHT, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#ffffff' },
  outline: { height: FIELD_HEIGHT, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  outlineLabel: { fontSize: 14 },
});
