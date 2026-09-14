// rebma-mobile/screens/RegisterScreen.tsx
//
// Phase 10.1 — native mobile equivalent of rebma-web's invite-only
// registration screen (App.tsx's renderRegisterForm). The app is
// distributed as a downloadable APK, so a candidate may have it
// installed before ever being approved — this cannot be web-only.
//
// Same two endpoints web uses, same server-side trust boundary:
// /api/lookup-invite resolves the token and returns Name/Role/Department/
// Phone; /api/register-standard-user re-resolves the token server-side
// and writes department/role from the invite, never from what this
// screen sends. Both are public (no session yet), called via
// lib/apiBase.ts's callPublicApi, not callPrivilegedApi.
//
// Token source, built both ways (D — no domain-verification infra exists
// yet for true Universal Links, so the https link HR sends still opens a
// browser today; the custom `rebmaimpex://` scheme works right now with
// no extra infra, and the manual-entry field is the reliable fallback
// for whichever source the candidate actually received):
//  1. Deep link: rebmaimpex://register?token=... opens straight here.
//  2. Manual: paste the full link or just the token.
import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, StatusBar, Image, ScrollView,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User, Mail, Phone, Briefcase, Building2, Link2 } from 'lucide-react-native';
import { callPublicApi, ApiNotConfiguredError } from '../lib/apiBase';
import { useTheme } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';

type InviteState = 'enterLink' | 'checking' | 'valid' | 'invalid';

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('token');
    if (fromQuery) return fromQuery;
  } catch {
    // Not a full URL — treat the whole input as a raw token.
  }
  const match = trimmed.match(/token=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  // Plain token, no URL wrapper at all.
  return /^[a-z0-9]+$/i.test(trimmed) ? trimmed : null;
}

export default function RegisterScreen() {
  const t = useTheme();
  const navigation = useNavigation<any>();
  const [state, setState] = useState<InviteState>('enterLink');
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ email: string; fullName: string; department: string; role: string; phone: string } | null>(null);
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resolveToken = async (t0: string) => {
    setState('checking');
    setError('');
    try {
      const body = await callPublicApi<{ email: string; fullName: string; department: string; role: string; phone: string }>(
        `/api/lookup-invite?token=${encodeURIComponent(t0)}`,
        'GET'
      );
      setInvite(body);
      setToken(t0);
      setState('valid');
    } catch (e: any) {
      setError(e instanceof ApiNotConfiguredError ? e.message : (e.message || 'This invite link is no longer valid.'));
      setState('invalid');
    }
  };

  // Deep link: rebmaimpex://register?token=... opens straight here,
  // both cold-start (getInitialURL) and warm-start (the url event).
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const found = extractToken(url);
        if (found) resolveToken(found);
      }
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      const found = extractToken(url);
      if (found) resolveToken(found);
    });
    return () => sub.remove();
  }, []);

  const submitLink = () => {
    const found = extractToken(linkInput);
    if (!found) { setError('Enter the full invite link or the code HR sent you.'); return; }
    resolveToken(found);
  };

  const confirmRegister = async () => {
    if (!invite) return;
    setSubmitting(true);
    try {
      await callPublicApi('/api/register-standard-user', 'POST', {
        email: invite.email,
        fullName: invite.fullName,
        inviteToken: token,
      });
      navigation.navigate('Login');
    } catch (e: any) {
      setError(e instanceof ApiNotConfiguredError ? e.message : (e.message || 'Registration failed.'));
      setState('invalid');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = makeStyles(t);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#ffffff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.brandName}>REBMA</Text>
            <Text style={styles.brandSub}>IMPEX GHANA</Text>
          </View>
        </View>

        <View style={styles.card}>
          {state === 'enterLink' && (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Registration</Text>
                <View style={styles.cardRule} />
                <Text style={styles.cardSubtitle}>Paste the invite link HR sent you</Text>
              </View>
              {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
              <View style={styles.field}>
                <Text style={styles.label}>Invite Link or Code</Text>
                <View style={styles.inputRow}>
                  <Link2 size={16} color={t.colors.textMuted} />
                  <TextInput
                    value={linkInput}
                    onChangeText={setLinkInput}
                    placeholder="https://.../register?token=... or the code"
                    placeholderTextColor={t.colors.textMuted}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Button label="Continue" onPress={submitLink} fullWidth style={{ marginTop: t.spacing.sm }} />
            </>
          )}

          {state === 'checking' && (
            <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textMuted }}>Verifying your invite…</Text>
            </View>
          )}

          {state === 'invalid' && (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Link No Longer Valid</Text>
                <View style={styles.cardRule} />
              </View>
              <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
              <Button label="Try Again" variant="ghost" onPress={() => setState('enterLink')} fullWidth />
            </>
          )}

          {state === 'valid' && invite && (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Confirm Your Details</Text>
                <View style={styles.cardRule} />
                <Text style={styles.cardSubtitle}>HR already entered your record, just confirm it's you</Text>
              </View>
              {[
                { label: 'Full Name', value: invite.fullName, icon: <User size={16} color={t.colors.textMuted} /> },
                { label: 'Email', value: invite.email, icon: <Mail size={16} color={t.colors.textMuted} /> },
                { label: 'Department', value: invite.department, icon: <Building2 size={16} color={t.colors.textMuted} /> },
                { label: 'Role', value: invite.role || invite.department, icon: <Briefcase size={16} color={t.colors.textMuted} /> },
                { label: 'Phone', value: invite.phone, icon: <Phone size={16} color={t.colors.textMuted} /> },
              ].map((f) => (
                <View key={f.label} style={styles.field}>
                  <Text style={styles.label}>{f.label}</Text>
                  <View style={styles.inputRow}>
                    {f.icon}
                    <Text style={[styles.input, { paddingVertical: 2 }]}>{f.value || '—'}</Text>
                  </View>
                </View>
              ))}
              <Button label={submitting ? 'Registering…' : 'Confirm & Register'} onPress={confirmRegister} loading={submitting} disabled={submitting} fullWidth style={{ marginTop: t.spacing.sm }} />
            </>
          )}
        </View>

        <Button label="Back to Sign In" variant="ghost" onPress={() => navigation.navigate('Login')} fullWidth style={{ marginTop: t.spacing.lg }} />

        <Text style={styles.footer}>© {new Date().getFullYear()} REBMA IMPEX GHANA LIMITED.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scroll: { flexGrow: 1, backgroundColor: '#ffffff', padding: t.spacing.xl, paddingTop: t.spacing.xxxl, justifyContent: 'center' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginBottom: t.spacing.xl },
    logo: { width: 40, height: 40 },
    brandName: { fontFamily: t.font.extrabold, fontSize: t.type.title18.size, color: t.colors.textPrimary, letterSpacing: 1 },
    brandSub: { fontFamily: t.font.bold, fontSize: 9, color: t.colors.accentPressed, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 2 },
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
    cardSubtitle: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted, letterSpacing: 0.6, marginTop: t.spacing.xs, textAlign: 'center' },
    errorBox: { backgroundColor: t.colors.status.danger.bg, borderRadius: t.radius.md, padding: t.spacing.md, marginBottom: t.spacing.md },
    errorText: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, textAlign: 'center' },
    field: { marginBottom: t.spacing.md },
    label: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textSecondary, marginBottom: t.spacing.xs, marginLeft: 2 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, backgroundColor: t.colors.bgInput,
      borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, paddingHorizontal: t.spacing.md, paddingVertical: 12,
    },
    input: { flex: 1, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary, padding: 0 },
    footer: { fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing.xl },
  });
}
