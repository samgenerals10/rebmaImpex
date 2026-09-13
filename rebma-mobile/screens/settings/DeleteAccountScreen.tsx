// rebma-mobile/screens/settings/DeleteAccountScreen.tsx
// Ports: rebma-web/src/views/SettingsDashboard.tsx's DeleteAccount branch
// (~566-623), handler handleDeleteRequest (~206-211) — D90. Confirmed by
// direct source read: this is a UI stub with zero Supabase calls — no
// table insert, nothing sent to HR — despite the on-screen copy claiming
// otherwise. Mobile keeps the same honest capture-and-confirm UI (a
// reason textarea + a submitted state), matching web's actual behavior
// exactly, but drops the specific false "HR department has been notified
// and must approve" claim — omitting a fabricated claim isn't a
// capability reduction.
import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function DeleteAccountScreen() {
  const t = useTheme();
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!reason.trim()) {
      Alert.alert('Please tell us why you want to delete your account.');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Screen>
        <Card>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.sm }}>Request Submitted</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>
            Your account deletion request has been recorded. Contact your administrator directly to follow up.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card tone="inset">
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-start' }}>
          <TriangleAlert size={16} color={t.colors.status.danger.text} />
          <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.status.danger.text }}>
            Deleting your account is permanent and cannot be undone.
          </Text>
        </View>
      </Card>
      <View style={{ marginTop: t.spacing.lg }}>
        <Card>
          <Field label="Reason for deletion">
            <Input value={reason} onChangeText={setReason} multiline numberOfLines={4} placeholder="Tell us why you'd like to delete your account…" style={{ minHeight: 96, textAlignVertical: 'top' }} />
          </Field>
          <View style={{ marginTop: t.spacing.md }}>
            <Button label="Request Account Deletion" variant="danger" onPress={submit} fullWidth />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
