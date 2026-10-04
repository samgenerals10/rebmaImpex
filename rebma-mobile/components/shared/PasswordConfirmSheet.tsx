// rebma-mobile/components/shared/PasswordConfirmSheet.tsx
//
// "Type your password to confirm it's you", for every high-risk CEO action
// (approved rule). The password is passed straight to the server, which
// checks it (api/_shared/reauth.ts); it's never stored on the phone. A
// wrong password keeps the sheet open with the server's message, so the
// person can try again.
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Sheet from '../ui/Sheet';
import Input, { Field } from '../ui/Input';
import Button from '../ui/Button';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  /** Throw an Error to show its message and keep the sheet open. */
  onConfirm: (password: string) => Promise<void>;
}

export default function PasswordConfirmSheet({ open, title, description, confirmLabel, danger, onClose, onConfirm }: Props) {
  const t = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Never keep a typed password around between uses.
  useEffect(() => { if (!open) { setPassword(''); setError(''); setBusy(false); } }, [open]);

  const submit = async () => {
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
      setPassword('');
    } catch (e: any) {
      setError(e?.message || 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} side="bottom" maxHeight={420}
      footer={<Button label={busy ? 'Checking…' : confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={submit} loading={busy} disabled={busy} fullWidth />}>
      <View style={{ gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-start' }}>
          <ShieldCheck size={18} color={t.colors.accent} />
          <Text style={{ flex: 1, fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{description}</Text>
        </View>
        <Field label="Your password">
          <Input value={password} onChangeText={(v) => { setPassword(v); setError(''); }} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" placeholder="Type your sign-in password" onSubmitEditing={submit} />
        </Field>
        {error ? <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.status.danger.text }}>{error}</Text> : null}
      </View>
    </Sheet>
  );
}
