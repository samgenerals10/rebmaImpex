// rebma-mobile/screens/LoginScreen.tsx
//
// Restyled (Phase 7.0) to match rebma-web's actual login screen
// (App.tsx's `renderLoginForm()` + its enclosing auth layout, ~line 2980
// onward) — white background, REBMA wordmark, "Welcome!" hero, a floating
// white sign-in card, green pill submit button, Inter throughout. The old
// navy/blue (#0a1f33 / #0f55ff) placeholder styling is fully removed.
//
// The web layout is a two-column lg:grid that collapses to one column on
// a phone-width viewport — this screen only ever renders the collapsed
// (mobile) arrangement: logo header, hero copy, then the sign-in card.
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';

export default function LoginScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const { signIn, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const styles = makeStyles(t);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.brandName}>REBMA</Text>
            <Text style={styles.brandSub}>IMPEX GHANA</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Next-Gen Enterprise Logistics Gateway</Text>
          </View>
          <Text style={styles.heroTitle}>Welcome!</Text>
          <View style={styles.heroRule} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <View style={styles.cardRule} />
            <Text style={styles.cardSubtitle}>REBMA IMPEX ERP GATEWAY</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Mail size={16} color={t.colors.textMuted} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@rembaimpex.com"
                placeholderTextColor={t.colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} color={t.colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={t.colors.textMuted}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                {showPassword ? (
                  <EyeOff size={16} color={t.colors.textMuted} />
                ) : (
                  <Eye size={16} color={t.colors.textMuted} />
                )}
              </Pressable>
            </View>
          </View>

          <Button
            label={loading ? 'Signing In…' : 'Submit'}
            onPress={() => signIn(email, password)}
            loading={loading}
            disabled={loading}
            fullWidth
            style={{ marginTop: t.spacing.sm }}
          />
        </View>

        <Button
          label="Have an invite link? Register"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
          fullWidth
          style={{ marginTop: t.spacing.lg }}
        />

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
      paddingTop: t.spacing.xxxl,
      justifyContent: 'center',
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.xl },
    logo: { width: 40, height: 40 },
    brandName: { fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.textPrimary, letterSpacing: 1 },
    brandSub: { fontFamily: t.font.bold, fontSize: 9, color: t.colors.accentPressed, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 2 },
    hero: { marginBottom: t.spacing.xl },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: t.spacing.md,
      paddingVertical: 5,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.accentSoft,
      borderWidth: 1,
      borderColor: t.colors.accentSoft,
      marginBottom: t.spacing.md,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.accent },
    badgeText: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.accentPressed },
    heroTitle: { fontFamily: t.font.extrabold, fontSize: 40, color: t.colors.textPrimary, letterSpacing: -0.5 },
    heroRule: { width: 56, height: 5, borderRadius: 3, backgroundColor: t.colors.accent, marginTop: t.spacing.md },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.xl,
      ...(Platform.OS === 'ios'
        ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 }
        : { elevation: 4 }),
    },
    cardHeader: { alignItems: 'center', marginBottom: t.spacing.lg },
    cardTitle: { fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.textPrimary },
    cardRule: { width: 32, height: 4, borderRadius: 2, backgroundColor: t.colors.accent, marginTop: 6 },
    cardSubtitle: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted, letterSpacing: 0.6, marginTop: t.spacing.xs },
    errorBox: {
      backgroundColor: t.colors.status.danger.bg,
      borderRadius: t.radius.md,
      padding: t.spacing.md,
      marginBottom: t.spacing.md,
    },
    errorText: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, textAlign: 'center' },
    field: { marginBottom: t.spacing.md },
    label: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginBottom: t.spacing.xs, marginLeft: 2 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      backgroundColor: t.colors.bgInput,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 12,
    },
    input: { flex: 1, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary, padding: 0 },
    footer: { fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing.xl },
  });
}
