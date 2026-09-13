// rebma-mobile/screens/settings/ProfileAccountScreen.tsx
// Ports: rebma-web/src/views/SettingsDashboard.tsx's Profile branch
// (~423-487), handler handleSaveProfile (~155-183) — D87. Real self-edit:
// full name + photo (via lib/media.ts's existing pickOrCaptureImage()
// base64 flow, Phase 7.1 D12 — same no-Storage-bucket pattern web itself
// uses), writing both auth.updateUser({data:{full_name}}) and
// profiles.update({full_name, photo, updated_at}). Department/Role render
// read-only. Email also renders read-only — not an editable-but-ignored
// input: confirmed by direct source read that web's own handleSaveProfile
// never actually sends the edited email anywhere despite the field being
// required and editable. Porting a field that lies about doing something
// isn't parity.
import { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Camera } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { pickOrCaptureImage } from '../../lib/media';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { getDepartmentEntry } from '../../navigation/departmentRegistry';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ProfileAccountScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [photo, setPhoto] = useState<string | null | undefined>(profile?.photo);
  const [saving, setSaving] = useState(false);

  if (!profile) return null;
  const dept = getDepartmentEntry(profile.department);

  const changePhoto = async () => {
    const uri = await pickOrCaptureImage();
    if (uri) setPhoto(uri);
  };

  const save = async () => {
    if (!fullName.trim()) {
      Alert.alert('Full name is required.');
      return;
    }
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim(), photo: photo || null, updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (error) throw error;
      useAuthStore.setState((s) => (s.profile ? { profile: { ...s.profile, fullName: fullName.trim(), photo: photo || undefined } } : {}));
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <View style={{ alignItems: 'center', marginBottom: t.spacing.lg }}>
          <View>
            <Avatar name={fullName || profile.fullName} photo={photo} size={80} />
            <Button label="" size="sm" icon={<Camera size={13} color="#fff" />} onPress={changePhoto} style={{ position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, paddingHorizontal: 0 }} />
          </View>
        </View>
        <Field label="Full Name"><Input value={fullName} onChangeText={setFullName} placeholder="Your full name" /></Field>
        <Field label="Email"><Input value={profile.email} editable={false} style={{ opacity: 0.6 }} /></Field>
        <Field label="Department"><Input value={dept.label} editable={false} style={{ opacity: 0.6 }} /></Field>
        <View style={{ marginTop: t.spacing.md }}>
          <Button label={saving ? 'Saving…' : 'Save Changes'} onPress={save} loading={saving} disabled={saving} fullWidth />
        </View>
      </Card>
    </Screen>
  );
}
