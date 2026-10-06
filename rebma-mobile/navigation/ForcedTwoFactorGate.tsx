// rebma-mobile/navigation/ForcedTwoFactorGate.tsx
//
// Two-factor is optional for everyone, switched on in their own Settings.
// The one exception is the CEO's Control Center switches "Force 2FA for
// Management" and "Force 2FA for Account Department" (both off unless the
// CEO turns them on). When one is on, staff in that department must set up
// two-factor before using the app, same as the web app (App.tsx's
// force2faRequired gate). CEO/admin accounts are never blocked.
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { getCeoSetting } from '../lib/ceoSetting';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import TwoFactorScreen from '../screens/settings/TwoFactorScreen';

const FORCE_KEY: Record<string, string> = {
  MANAGEMENT: 'force_2fa_management',
  FINANCE: 'force_2fa_finance',
};

/** null while checking, true when this person must set up two-factor first. */
export function useTwoFactorRequired(): [boolean | null, () => void] {
  const profile = useAuthStore((s) => s.profile);
  // The answer is tied to the person it was checked for, so a new sign-in
  // never reuses the last person's answer while its own check runs.
  const [result, setResult] = useState<{ forId: string; required: boolean } | null>(null);
  const key = profile ? FORCE_KEY[String(profile.department || '').toUpperCase()] : undefined;
  const needsCheck = !!profile && !profile.isAdmin && !!key;

  useEffect(() => {
    if (!needsCheck || !profile || !key) return;
    let cancelled = false;
    (async () => {
      const forced = await getCeoSetting<boolean>(key, false).catch(() => false);
      let required = false;
      if (forced) {
        const { data } = await supabase.auth.mfa.listFactors().catch(() => ({ data: null } as any));
        required = !data?.totp?.some((f: any) => f.status === 'verified');
      }
      if (!cancelled) setResult({ forId: profile.id, required });
    })();
    return () => { cancelled = true; };
  }, [needsCheck, profile?.id, key]);

  const markDone = () => { if (profile) setResult({ forId: profile.id, required: false }); };
  if (!needsCheck) return [false, markDone];
  if (!result || result.forId !== profile!.id) return [null, markDone];
  return [result.required, markDone];
}

export default function ForcedTwoFactorGate({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const deptLabel = String(profile?.department || '').toUpperCase() === 'FINANCE' ? 'Account Department' : 'Management';

  return (
    <TwoFactorScreen
      onEnrolled={onDone}
      header={
        <View style={{ alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.lg, paddingTop: t.spacing.lg }}>
          <ShieldAlert size={36} color={t.colors.accent} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.title18.size, color: t.colors.textPrimary, textAlign: 'center' }}>
            Two-Factor Authentication Required
          </Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted, textAlign: 'center' }}>
            The CEO requires two-factor authentication for the {deptLabel}. Set it up below to continue.
          </Text>
        </View>
      }
      footer={
        <Pressable onPress={signOut} style={{ marginTop: t.spacing.lg, alignItems: 'center' }}>
          <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textMuted, textDecorationLine: 'underline' }}>
            Sign out instead
          </Text>
        </Pressable>
      }
    />
  );
}
