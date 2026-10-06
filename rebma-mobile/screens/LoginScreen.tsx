// rebma-mobile/screens/LoginScreen.tsx
//
// Fifth restyle pass, per direct correction:
//  - A real back button (Welcome is always one screen behind Login in
//    the stack), only shown when there's actually somewhere to go.
//  - Leading icons back in the input boxes (amber, matching the new
//    palette) — Mail for email, Lock for password.
//  - Smaller logo (AuthBrandHeader's own change).
//  - Palette moves to turquoise (button, active states) + amber
//    (input icons) + a touch of forest green (links, back arrow) — no
//    gradients, all three sampled directly from the logo.
//  - The browser's default yellow/blue focus outline on a focused
//    TextInput is suppressed (web only — RN Native has no such
//    outline to begin with).
//
// "Keep me logged in" and "Forgot password?" stay real: the former
// writes to lib/rememberMe.ts, which authStore's initialize() checks
// before ever restoring a session; the latter calls Supabase Auth's
// actual resetPasswordForEmail().
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Toggle from '../components/ui/Toggle';
import AuthBrandHeader from '../components/auth/AuthBrandHeader';
import AuthBackButton from '../components/auth/AuthBackButton';
import AuthGradientButton, { TURQUOISE, AMBER, FOREST, INK, MUTED, FIELD_FILL, FIELD_HEIGHT } from '../components/auth/AuthGradientButton';

// react-native-web renders a real <input>, which picks up the
// browser's own focus ring (often a yellow/blue outline) — RN Native
// has no such thing, so this is web-only and harmless elsewhere.
const noWebOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

export default function LoginScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { signIn, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resetError, setResetError] = useState('');

  const styles = makeStyles(t);

  const openForgot = () => {
    setResetEmail(email);
    setResetStatus('idle');
    setResetError('');
    setForgotOpen(true);
  };

  const sendReset = async () => {
    const target = resetEmail.trim();
    if (!target) {
      setResetStatus('error');
      setResetError('Enter your email address first.');
      return;
    }
    setResetStatus('sending');
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(target);
    if (resetErr) {
      setResetStatus('error');
      setResetError(resetErr.message || 'Could not send the reset email.');
      return;
    }
    setResetStatus('sent');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthBackButton />
        {/* Per direct correction: the logo/wordmark stay exactly where
            they were (right under the back button) — only the title
            ("Sign in"/"Reset password") pushes down, via
            titleMarginTop, not a wrapper around the whole header. */}
        <AuthBrandHeader title={forgotOpen ? 'Reset password' : 'Sign in'} titleMarginTop={76} />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {forgotOpen ? (
          <View style={styles.resetBox}>
            <Text style={styles.resetHint}>We'll email you a link to set a new password.</Text>

            {resetStatus === 'sent' ? (
              <Text style={styles.resetSent}>Check your inbox at {resetEmail.trim()} for the reset link.</Text>
            ) : (
              <>
                <View style={styles.inputBox}>
                  <Mail size={18} color={AMBER} />
                  <TextInput
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    placeholder="example12@gmail.com"
                    placeholderTextColor={MUTED}
                    style={[styles.input, noWebOutline]}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                {resetStatus === 'error' ? <Text style={styles.resetErrorText}>{resetError}</Text> : null}
                <View style={{ marginTop: t.spacing.sm }}>
                  <AuthGradientButton label={resetStatus === 'sending' ? 'Sending…' : 'Send Reset Link'} onPress={sendReset} disabled={resetStatus === 'sending'} />
                </View>
              </>
            )}

            <Pressable onPress={() => setForgotOpen(false)} style={{ marginTop: t.spacing.sm }}>
              <Text style={styles.resetCancel}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputBox}>
                <Mail size={18} color={AMBER} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example12@gmail.com"
                  placeholderTextColor={MUTED}
                  style={[styles.input, noWebOutline]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputBox}>
                <Lock size={18} color={AMBER} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={MUTED}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { flex: 1 }, noWebOutline]}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                  {showPassword ? (
                    <EyeOff size={18} color={MUTED} />
                  ) : (
                    <Eye size={18} color={MUTED} />
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <Pressable onPress={() => setKeepLoggedIn((v) => !v)} style={styles.keepLoggedInRow} hitSlop={4}>
                <Toggle value={keepLoggedIn} onChange={setKeepLoggedIn} color={TURQUOISE} />
                <Text style={styles.optionsText}>Keep me logged in</Text>
              </Pressable>
              <Pressable onPress={openForgot} hitSlop={4}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: t.spacing.xs }}>
              <AuthGradientButton label={loading ? 'Signing In…' : 'Log in'} onPress={() => signIn(email, password, keepLoggedIn)} disabled={loading} />
            </View>
          </>
        )}

        <Pressable onPress={() => navigation.navigate('Register')} style={{ marginTop: t.spacing.lg }}>
          <Text style={styles.switchText}>
            Don't have an account? <Text style={styles.switchLink}>Register</Text>
          </Text>
        </Pressable>

        <Text style={styles.footer}>© {new Date().getFullYear()} REBMA IMPEX GHANA LIMITED.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 1,
      backgroundColor: '#ffffff',
      padding: t.spacing.xl,
      paddingTop: t.spacing.lg,
      justifyContent: 'flex-start',
    },
    errorBox: {
      backgroundColor: t.colors.status.danger.bg,
      borderRadius: t.radius.md,
      padding: t.spacing.md,
      marginBottom: t.spacing.md,
    },
    errorText: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, textAlign: 'center' },
    field: { marginBottom: t.spacing.sm },
    // Fixed INK, bumped to bold — labels are theme-independent (this
    // whole screen always renders on a hardcoded white background) and
    // prioritize visibility/boldness per direct correction.
    label: { fontFamily: t.font.bold, fontSize: t.type.body14.size, color: INK, marginBottom: 4 },
    // Deep border removed per direct correction — replaced with a soft
    // fixed fill so the field still reads as tappable without a heavy
    // outline.
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      height: FIELD_HEIGHT,
      backgroundColor: FIELD_FILL,
      borderRadius: t.radius.md,
      paddingHorizontal: t.spacing.md,
    },
    input: { flex: 1, fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: INK, padding: 0 },
    optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.xs },
    keepLoggedInRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    optionsText: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: INK },
    forgotText: { fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: FOREST },
    switchText: { fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: INK, textAlign: 'center' },
    switchLink: { fontFamily: t.font.bold, color: AMBER },
    footer: { fontFamily: t.font.semibold, fontSize: t.type.meta10.size, color: MUTED, textAlign: 'center', marginTop: t.spacing.xl },
    resetBox: { marginBottom: t.spacing.sm },
    resetTitle: { fontFamily: t.font.bold, fontSize: t.type.body14.size, color: INK, marginBottom: 4 },
    resetHint: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: MUTED, marginBottom: t.spacing.md },
    resetSent: { fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.success.text, textAlign: 'center', paddingVertical: t.spacing.md },
    resetErrorText: { fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, marginTop: t.spacing.sm },
    resetCancel: { fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: FOREST, textAlign: 'center' },
  });
}
