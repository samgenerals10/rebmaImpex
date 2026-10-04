// rebma-mobile/screens/settings/DeleteAccountScreen.tsx
//
// "Delete Account" (approved rule): the person asks, HR confirms, and only
// then is the account closed. Requests from HR or Management staff are
// confirmed by the CEO. Closing an account deletes nothing: all the work
// the person did stays in the system for their department.
// The request is sent to the server with the person's own password
// (api/account-deletion.ts). This used to show "submitted" without sending
// anything anywhere.
// Web twin: rebma-web/src/views/SettingsDashboard.tsx (DeleteAccount).
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { TriangleAlert } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { ApiNotConfiguredError } from '../../lib/apiBase';
import { getMyDeletionRequest, deletionApi, type DeletionRequest } from '../../lib/staffDirectory';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const STATUS_TEXT: Record<DeletionRequest['status'], string> = {
  pending: 'Waiting for confirmation', approved: 'Confirmed', rejected: 'Not confirmed', cancelled: 'Cancelled',
};

export default function DeleteAccountScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [latest, setLatest] = useState<DeletionRequest | null>(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const isCeo = !!profile?.isAdmin;

  const load = useCallback(async () => {
    if (profile?.id) setLatest(await getMyDeletionRequest(profile.id));
  }, [profile?.id]);
  useEffect(() => { load(); }, [load]);

  const errorText = (e: any) => (e instanceof ApiNotConfiguredError ? e.message : (e?.message || 'That did not work.'));

  const submit = async () => {
    if (!reason.trim()) { Alert.alert('Missing Info', 'Tell HR why you want to delete your account.'); return; }
    if (!password) { Alert.alert('Missing Info', 'Type your password to confirm it is you.'); return; }
    setBusy(true);
    try {
      const res = await deletionApi.request(reason.trim(), password);
      setReason(''); setPassword('');
      Alert.alert('Request sent', res.message);
      load();
    } catch (e: any) {
      Alert.alert('Could not send', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (!latest) return;
    Alert.alert('Cancel request', 'Withdraw your request? Your account stays open.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', onPress: async () => {
        try { Alert.alert('Withdrawn', (await deletionApi.cancel(latest.id)).message); load(); } catch (e: any) { Alert.alert('Failed', errorText(e)); }
      } },
    ]);
  };

  if (isCeo) {
    return (
      <Screen>
        <Card>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>
            A CEO account is removed by the other CEO, from Control Center, CEO Account. It can't be deleted here.
          </Text>
        </Card>
      </Screen>
    );
  }

  const pending = latest?.status === 'pending';

  return (
    <Screen>
      <View style={{ gap: t.spacing.lg }}>
        <Card tone="inset">
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-start' }}>
            <TriangleAlert size={16} color={t.colors.status.danger.text} />
            <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text }}>
              Once HR confirms, you can no longer sign in. The work you did stays in the system for your department.
            </Text>
          </View>
        </Card>

        {latest && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Your last request</Text>
              <Badge tone={pending ? 'warning' : latest.status === 'rejected' ? 'danger' : 'muted'} label={STATUS_TEXT[latest.status]} size="xs" />
            </View>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
              Sent on {new Date(latest.createdAt).toLocaleDateString()}. To be confirmed by {latest.confirmer === 'CEO' ? 'the CEO' : 'HR'}.{latest.note ? ` Note: ${latest.note}` : ''}
            </Text>
            {pending && (
              <View style={{ marginTop: t.spacing.sm, alignItems: 'flex-start' }}>
                <Button label="Withdraw request" size="sm" variant="ghost" onPress={cancel} />
              </View>
            )}
          </Card>
        )}

        {!pending && (
          <Card>
            <Field label="Reason for deletion">
              <Input value={reason} onChangeText={setReason} multiline numberOfLines={4} placeholder="Tell HR why you'd like to delete your account..." style={{ minHeight: 96, textAlignVertical: 'top' }} />
            </Field>
            <Field label="Your password">
              <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" placeholder="Type your sign-in password" />
            </Field>
            <View style={{ marginTop: t.spacing.md }}>
              <Button label={busy ? 'Sending…' : 'Send Request to HR'} variant="danger" onPress={submit} loading={busy} disabled={busy} fullWidth />
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}
