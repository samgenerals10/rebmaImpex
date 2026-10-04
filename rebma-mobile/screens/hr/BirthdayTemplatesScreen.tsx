// rebma-mobile/screens/hr/BirthdayTemplatesScreen.tsx
//
// HR → Birthday Templates (approved Part B). HR writes the birthday
// messages, the same way Document Templates work: nothing is hard-coded.
// Each template says who it's for (staff, customers or both), which
// channels it goes by, the email subject, and the message, with {name} and
// {first_name} filled in per person. One template per group can be the
// default: the automatic sender uses it, and the Birthdays page starts
// from it.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Plus, Pencil, Trash2, Star } from 'lucide-react-native';
import { Alert } from '../../lib/appAlert';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input, { Field } from '../../components/ui/Input';
import Sheet from '../../components/ui/Sheet';
import Tabs from '../../components/ui/Tabs';
import Toggle from '../../components/ui/Toggle';
import EmptyState from '../../components/ui/EmptyState';

export interface BirthdayTemplate {
  id: string; name: string; audience: 'staff' | 'customer' | 'both'; channels: string[];
  email_subject: string; body: string; is_default: boolean;
}

const AUDIENCE_LABEL: Record<BirthdayTemplate['audience'], string> = { staff: 'Staff', customer: 'Customers', both: 'Staff and customers' };
const CHANNELS = [{ key: 'email', label: 'Email' }, { key: 'sms', label: 'SMS' }, { key: 'whatsapp', label: 'WhatsApp' }];

export function fillTemplate(text: string, fullName: string): string {
  const first = (fullName || '').trim().split(/\s+/)[0] || 'there';
  return text.replace(/\{first_name\}/g, first).replace(/\{name\}/g, (fullName || '').trim() || first);
}

const blank = { name: '', audience: 'both' as BirthdayTemplate['audience'], channels: ['email', 'sms'], email_subject: 'Happy birthday from Rebma Impex', body: '', is_default: false };

export default function BirthdayTemplatesScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<BirthdayTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('birthday_templates').select('*').order('created_at', { ascending: true });
    setTemplates((data as BirthdayTemplate[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(blank); setFormOpen(true); };
  const openEdit = (tpl: BirthdayTemplate) => {
    setEditing(tpl);
    setForm({ name: tpl.name, audience: tpl.audience, channels: tpl.channels, email_subject: tpl.email_subject, body: tpl.body, is_default: tpl.is_default });
    setFormOpen(true);
  };

  const toggleChannel = (key: string) =>
    setForm((f) => ({ ...f, channels: f.channels.includes(key) ? f.channels.filter((c) => c !== key) : [...f.channels, key] }));

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Missing Info', 'Give the template a name.'); return; }
    if (!form.body.trim()) { Alert.alert('Missing Info', 'Write the message.'); return; }
    if (!form.channels.length) { Alert.alert('Missing Info', 'Pick at least one way to send it.'); return; }
    setSaving(true);
    try {
      // Only one default per group: clear the old one first.
      if (form.is_default) {
        let q = supabase.from('birthday_templates').update({ is_default: false }).eq('audience', form.audience).eq('is_default', true);
        if (editing) q = q.neq('id', editing.id);
        const { error } = await q;
        if (error) throw new Error(error.message);
      }
      const row = {
        name: form.name.trim(), audience: form.audience, channels: form.channels,
        email_subject: form.email_subject.trim() || 'Happy birthday from Rebma Impex', body: form.body.trim(),
        is_default: form.is_default, updated_at: new Date().toISOString(),
      };
      const { error } = editing
        ? await supabase.from('birthday_templates').update(row).eq('id', editing.id)
        : await supabase.from('birthday_templates').insert({ ...row, created_by: profile?.fullName || 'HR' });
      if (error) throw new Error(error.message);
      setFormOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (tpl: BirthdayTemplate) => {
    Alert.alert('Delete Template', `Delete "${tpl.name}"?${tpl.is_default ? ' It is a default, so automatic wishes will stop until another default is set.' : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('birthday_templates').delete().eq('id', tpl.id);
        if (error) Alert.alert('Could not delete', error.message);
        else load();
      } },
    ]);
  };

  const muted = { fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <View style={{ gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ ...muted, flex: 1, marginRight: t.spacing.sm }}>Write the birthday messages here. Use {'{name}'} or {'{first_name}'} where the person's name goes.</Text>
          <Button label="New" size="sm" icon={<Plus size={12} color="#fff" />} onPress={openNew} />
        </View>

        {!loading && templates.length === 0 && (
          <EmptyState title="No templates yet" description="Create one and mark it as default so birthday wishes can go out." />
        )}

        {templates.map((tpl) => (
          <Card key={tpl.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: 6 }}>
              <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{tpl.name}</Text>
              {tpl.is_default && <Badge tone="success" label="DEFAULT" size="xs" />}
            </View>
            <Text style={muted}>For: {AUDIENCE_LABEL[tpl.audience]} · Sent by: {tpl.channels.map((c) => CHANNELS.find((x) => x.key === c)?.label || c).join(', ')}</Text>
            <Card tone="inset" style={{ marginTop: t.spacing.sm }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{fillTemplate(tpl.body, 'Ama Mensah')}</Text>
            </Card>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm }}>
              <Button label="Edit" size="sm" variant="ghost" icon={<Pencil size={12} color={t.colors.textSecondary} />} onPress={() => openEdit(tpl)} />
              <Button label="Delete" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => remove(tpl)} />
            </View>
          </Card>
        ))}
      </View>

      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Template' : 'New Template'} side="bottom" maxHeight={760}
        footer={<Button label={saving ? 'Saving…' : 'Save Template'} onPress={save} loading={saving} disabled={saving} fullWidth />}>
        <Field label="Template name"><Input value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Warm staff wish" /></Field>
        <Field label="Who it's for">
          <Tabs variant="segmented" value={form.audience} onChange={(v) => setForm((f) => ({ ...f, audience: v as BirthdayTemplate['audience'] }))}
            options={[{ value: 'staff', label: 'Staff' }, { value: 'customer', label: 'Customers' }, { value: 'both', label: 'Both' }]} />
        </Field>
        <Field label="Send by" hint="WhatsApp is never automatic: HR sends it with one tap from the Birthdays page.">
          <View style={{ gap: t.spacing.xs }}>
            {CHANNELS.map((c) => (
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{c.label}</Text>
                <Toggle value={form.channels.includes(c.key)} onChange={() => toggleChannel(c.key)} />
              </View>
            ))}
          </View>
        </Field>
        <Field label="Email subject"><Input value={form.email_subject} onChangeText={(v) => setForm((f) => ({ ...f, email_subject: v }))} placeholder="Happy birthday from Rebma Impex" /></Field>
        <Field label="Message" hint="Use {name} for their full name or {first_name} for their first name.">
          <Input value={form.body} onChangeText={(v) => setForm((f) => ({ ...f, body: v }))} multiline numberOfLines={5} style={{ minHeight: 110, textAlignVertical: 'top' }}
            placeholder="e.g. Happy birthday, {first_name}! Everyone at Rebma Impex wishes you a wonderful day." />
        </Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.md }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Star size={14} color={t.colors.action.amber} />
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Default for {AUDIENCE_LABEL[form.audience].toLowerCase()}</Text>
          </View>
          <Toggle value={form.is_default} onChange={(v) => setForm((f) => ({ ...f, is_default: v }))} />
        </View>
        {!!form.body.trim() && (
          <Field label="Preview">
            <Card tone="inset">
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>{fillTemplate(form.body, 'Ama Mensah')}</Text>
            </Card>
          </Field>
        )}
      </Sheet>
    </Screen>
  );
}
