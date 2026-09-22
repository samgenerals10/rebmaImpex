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
// Token source, built both ways (no domain-verification infra exists
// yet for true Universal Links, so the https link HR sends still opens a
// browser today; the custom `rebmaimpex://` scheme works right now with
// no extra infra, and the manual-entry field is the reliable fallback
// for whichever source the candidate actually received):
//  1. Deep link: rebmaimpex://register?token=... opens straight here.
//  2. Manual: paste the full link or just the token.
//
// Fifth restyle pass (matches LoginScreen.tsx) — plain white
// background, logo + "REBMA IMPEX" wordmark via AuthBrandHeader, a
// real back button to Login, leading icons in the boxed fields
// (amber), and the turquoise/amber/forest-green palette — no
// gradients, all three sampled directly from the logo.
//
// The screen shown to the user for "create an account" had editable
// Full Name/Email/Phone/Password fields, but that's not how
// registration actually works here — HR enters the candidate's record
// up front, the candidate only confirms it's them, and a password is
// set later through Settings once HR approves. Copying those literal
// fields would misrepresent that real flow, so only the shared shape
// (brand header, boxed fields, button) is carried over — the real
// invite-link -> confirm-details states stay exactly as they were.
import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, StatusBar, ScrollView,
  KeyboardAvoidingView, Platform, Linking, Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Link2, User, Mail, Building2, Briefcase, Phone } from 'lucide-react-native';
import { callPublicApi, ApiNotConfiguredError } from '../lib/apiBase';
import { useTheme } from '../theme/ThemeProvider';
import AuthBrandHeader from '../components/auth/AuthBrandHeader';
import AuthBackButton from '../components/auth/AuthBackButton';
import AuthGradientButton, { AMBER, FOREST } from '../components/auth/AuthGradientButton';

// See LoginScreen.tsx — suppresses the browser's own focus ring on web
// only; RN Native has no such outline to begin with.
const noWebOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

const CONFIRM_ICONS: Record<string, any> = {
  'Full name': User,
  Email: Mail,
  Department: Building2,
  Role: Briefcase,
  'Phone number': Phone,
};

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

const HEADER_COPY: Record<InviteState, { title: string; subtitle: string }> = {
  enterLink: { title: 'Create an account', subtitle: 'Paste the invite link HR sent you to get started.' },
  checking: { title: 'Create an account', subtitle: 'Paste the invite link HR sent you to get started.' },
  invalid: { title: 'Link not valid', subtitle: 'This invite link has expired or was already used.' },
  valid: { title: 'Almost there', subtitle: "HR already entered your record, just confirm it's you." },
};

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
  const header = HEADER_COPY[state];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#ffffff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthBackButton />
        <AuthBrandHeader title={header.title} subtitle={header.subtitle} />

        {state === 'enterLink' && (
          <>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            <View style={styles.field}>
              <Text style={styles.label}>Invite link or code</Text>
              <View style={styles.inputBox}>
                <Link2 size={18} color={AMBER} />
                <TextInput
                  value={linkInput}
                  onChangeText={setLinkInput}
                  placeholder="https://.../register?token=... or the code"
                  placeholderTextColor={t.colors.textMuted}
                  style={[styles.input, noWebOutline]}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={{ marginTop: t.spacing.xs }}>
              <AuthGradientButton label="Continue" onPress={submitLink} />
            </View>
          </>
        )}

        {state === 'checking' && (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body14.size, color: t.colors.textMuted }}>Verifying your invite…</Text>
          </View>
        )}

        {state === 'invalid' && (
          <>
            <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
            <AuthGradientButton label="Try Again" variant="outline" onPress={() => setState('enterLink')} />
          </>
        )}

        {state === 'valid' && invite && (
          <>
            {[
              { label: 'Full name', value: invite.fullName },
              { label: 'Email', value: invite.email },
              { label: 'Department', value: invite.department },
              { label: 'Role', value: invite.role || invite.department },
              { label: 'Phone number', value: invite.phone },
            ].map((f) => {
              const Icon = CONFIRM_ICONS[f.label];
              return (
                <View key={f.label} style={styles.field}>
                  <Text style={styles.label}>{f.label}</Text>
                  <View style={styles.inputBox}>
                    {Icon ? <Icon size={18} color={AMBER} /> : null}
                    <Text style={[styles.input, { paddingVertical: 2 }]}>{f.value || '—'}</Text>
                  </View>
                </View>
              );
            })}
            <View style={{ marginTop: t.spacing.xs }}>
              <AuthGradientButton
                label={submitting ? 'Registering…' : 'Create account'}
                onPress={confirmRegister}
                disabled={submitting}
              />
            </View>
          </>
        )}

        <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: t.spacing.lg }}>
          <Text style={styles.switchText}>
            Already have account ? <Text style={styles.switchLink}>Log In</Text>
          </Text>
        </Pressable>

        <Text style={styles.footer}>© {new Date().getFullYear()} REBMA IMPEX GHANA LIMITED.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scroll: { flexGrow: 1, backgroundColor: '#ffffff', padding: t.spacing.xl, paddingTop: t.spacing.lg, justifyContent: 'flex-start' },
    errorBox: { backgroundColor: t.colors.status.danger.bg, borderRadius: t.radius.md, padding: t.spacing.md, marginBottom: t.spacing.md },
    errorText: { fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text, textAlign: 'center' },
    field: { marginBottom: t.spacing.sm },
    label: { fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: 4 },
    inputBox: {
      flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm,
      borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md,
      paddingHorizontal: t.spacing.md, paddingVertical: 11,
    },
    input: { flex: 1, fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary, padding: 0 },
    switchText: { fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary, textAlign: 'center' },
    switchLink: { fontFamily: t.font.bold, color: AMBER },
    footer: { fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing.xl },
  });
}
