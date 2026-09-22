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

const styles = StyleSheet.create({
  button: { borderRadius: 999, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#ffffff' },
  outline: { borderRadius: 999, paddingVertical: 11.5, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  outlineLabel: { fontSize: 14 },
});
