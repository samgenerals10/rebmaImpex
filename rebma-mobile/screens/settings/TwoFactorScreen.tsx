// rebma-mobile/screens/settings/TwoFactorScreen.tsx
// Ports: rebma-web/src/components/TwoFactorSetup.tsx (168 lines, read in
// full) — D89. Real, complete Supabase Auth TOTP flow
// (enroll/challenge/verify/unenroll/listFactors) — the most functionally
// real of the four Settings items, not a stub. The QR code
// (data.totp.qr_code) is already a rendered data:image/... URI on the
// wire (confirmed by source: web renders it via a plain <img>), so this
// renders it via a plain RN <Image> — no QR-generation dependency needed.
import { useEffect, useState } from 'react';
import { View, Text, Image, Alert } from 'react-native';
import { ShieldCheck, ShieldOff, Smartphone } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function TwoFactorScreen() {
  const t = useTheme();
  const [loading, setLoading] = useState(true);
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      const verified = data.totp.find((f) => f.status === 'verified');
      setEnrolledFactorId(verified?.id || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      Alert.alert('Failed', error.message);
      setEnrolling(false);
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode('');
    setEnrolling(false);
  };

  const confirmEnroll = async () => {
    if (!pendingFactorId || code.length !== 6) return;
    setSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
      if (challengeError || !challenge) throw new Error(challengeError?.message || 'Failed to start verification.');
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: pendingFactorId, challengeId: challenge.id, code });
      if (verifyError) throw new Error('Incorrect code. Check your authenticator app and try again.');
      Alert.alert('Success', 'Two-factor authentication enabled.');
      setEnrolledFactorId(pendingFactorId);
      setPendingFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode('');
      setEnrolling(false);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const disable = () => {
    if (!enrolledFactorId) return;
    Alert.alert('Turn off Two-Factor Authentication', 'Turn off two-factor authentication for your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn Off',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });
          setSubmitting(false);
          if (error) { Alert.alert('Failed', error.message); return; }
          setEnrolledFactorId(null);
          Alert.alert('Two-factor authentication turned off.');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Checking your two-factor status…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        {enrolledFactorId ? (
          <View style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <ShieldCheck size={20} color={t.colors.status.success.text} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.success.text }}>Two-factor authentication is on</Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
              Your account requires a code from your authenticator app at login, in addition to your password.
            </Text>
            <Button label={submitting ? 'Turning off…' : 'Turn off 2FA'} variant="danger" icon={<ShieldOff size={14} color="#fff" />} onPress={disable} loading={submitting} disabled={submitting} />
          </View>
        ) : !enrolling ? (
          <View style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Smartphone size={20} color={t.colors.textMuted} />
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>Two-factor authentication is off</Text>
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
              Add a second step at login using an authenticator app (Google Authenticator, Authy, 1Password, etc.): a code from your phone alongside your password.
            </Text>
            <Button label="Enable 2FA" onPress={startEnroll} />
          </View>
        ) : (
          <View style={{ gap: t.spacing.md }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</Text>
            {qrCode && (
              <View style={{ alignItems: 'center', padding: t.spacing.lg, backgroundColor: '#fff', borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}>
                <Image source={{ uri: qrCode }} style={{ width: 160, height: 160 }} />
              </View>
            )}
            {secret && (
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, textAlign: 'center' }}>
                Can't scan? Enter this key manually: <Text style={{ fontFamily: t.font.medium }}>{secret}</Text>
              </Text>
            )}
            <Input
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="numeric"
              placeholder="000000"
              style={{ textAlign: 'center', letterSpacing: 6, fontSize: t.type.title18.size }}
            />
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Cancel" variant="ghost" onPress={cancelEnroll} /></View>
              <View style={{ flex: 1 }}><Button label={submitting ? 'Verifying…' : 'Confirm & Enable'} onPress={confirmEnroll} disabled={code.length !== 6 || submitting} loading={submitting} /></View>
            </View>
          </View>
        )}
      </Card>
    </Screen>
  );
}
