// rebma-mobile/components/auth/AuthBrandHeader.tsx
//
// Sixth pass, per direct correction: logo smaller again and the whole
// header tightened up — the previous size + margins read as crowded
// once combined with the back button above it. `subtitle` stays
// optional — Login only wants the short "Sign in" heading with no
// second line, Register keeps its own subtitle.
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { INK, MUTED } from './AuthGradientButton';

const LOGO_ASPECT = 398 / 237;
const LOGO_HEIGHT = 34;

interface Props {
  title: string;
  subtitle?: string;
  /** Extra gap between the logo/wordmark (untouched, stays right under
   * the back button) and the title below it — per direct correction,
   * Login pushes "Sign in" down without moving the logo, so this is an
   * opt-in addition on top of the shared brandName gap, not a change to
   * it. Undefined/0 for every other caller (Register), which keeps its
   * original spacing exactly as it was. */
  titleMarginTop?: number;
}

export default function AuthBrandHeader({ title, subtitle, titleMarginTop }: Props) {
  const t = useTheme();

  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
      {/* Fixed INK/MUTED, not theme tokens — see AuthGradientButton.tsx's
          comment: this header always sits on a hardcoded white
          background, so its text must never follow dark mode. */}
      <Text style={[styles.brandName, { fontFamily: t.font.extrabold, color: INK }]}>REBMA IMPEX</Text>
      <Text style={[styles.title, { fontFamily: t.font.extrabold, color: INK, marginTop: titleMarginTop || 0 }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { fontFamily: t.font.semibold, color: MUTED }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 16 },
  logo: { width: LOGO_HEIGHT * LOGO_ASPECT, height: LOGO_HEIGHT, marginBottom: 3 },
  // Per direct correction: the ONE deliberate gap on this page is
  // between "REBMA IMPEX" and the title below it — every other
  // spacing on the auth screens (label-to-input especially) stays
  // tight, not this. Widened further (was 28) to push the title down
  // without moving the logo/wordmark above it — this also absorbs the
  // otherwise-empty space that was collecting at the bottom of the
  // page under the footer now that the page is top-aligned.
  brandName: { fontSize: 12, letterSpacing: 0.4, marginBottom: 46 },
  title: { fontSize: 22, textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 8 },
});
