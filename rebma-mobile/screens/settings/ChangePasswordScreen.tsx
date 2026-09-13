// rebma-mobile/screens/settings/ChangePasswordScreen.tsx
// Ports: rebma-web/src/views/SettingsDashboard.tsx's ChangePassword branch
// (~490-550) + apiClient.ts's changePassword (408-434) — D88. Real
// `supabase.auth.updateUser({password})`, session alone authorizes it.
// The "Current Password" field is captured but genuinely never verified
// or sent anywhere — confirmed by direct source read (the function's
// second parameter is accepted but unused). Ported faithfully, not
// silently redesigned into a 2-field form — same documented-not-
// silently-fixed treatment as the Phase 7.7 payroll bugs, since this
// touches auth. Client-side strength validation only (8+ chars, one
// uppercase, one special char), matching source.
import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';

function validate(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include a special character.';
  return null;
}

export default function ChangePasswordScreen() {
  const t = useTheme();
  const { profile } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!profile?.requiresPasswordReset && !currentPassword.trim()) {
      Alert.alert('Enter your current password.');
      return;
    }
    const validationError = validate(newPassword);
    if (validationError) {
      Alert.alert('Weak Password', validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      // Note: Supabase's updateUser({password}) needs only the live
      // session — currentPassword is captured to match web's form exactly
      // but is not sent or verified, same as web itself (D88).
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.from('profiles').update({
        password_hash: null,
        requires_password_reset: false,
      }).eq('id', profile?.id || '');
      Alert.alert('Success', 'Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not change your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card>
        {!profile?.requiresPasswordReset && (
          <Field label="Current Password"><Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Enter your current password" /></Field>
        )}
        <Field label="New Password" hint="At least 8 characters, one uppercase letter, one special character.">
          <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password" />
        </Field>
        <Field label="Confirm New Password"><Input value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Confirm new password" /></Field>
        <View style={{ marginTop: t.spacing.md }}>
          <Button label={submitting ? 'Changing…' : 'Change Password'} onPress={submit} loading={submitting} disabled={submitting} fullWidth />
        </View>
      </Card>
    </Screen>
  );
}
