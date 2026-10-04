// rebma-mobile/screens/hr/BirthdaysScreen.tsx
//
// HR → Birthdays (approved Part B). HR only, for staff and customers.
//
//  * Auto-send: on/off and the sending time (default on, 08:00). When on,
//    each birthday person gets HR's default template automatically by email
//    and SMS (api/birthday-wishes.ts). HR can switch it off and send by hand.
//  * Calendar (no "today / this week" buttons): days with birthdays are
//    marked; swipe back to past months to see what was sent then.
//  * Tap a day: everyone with a birthday that day. "Send wish" opens the
//    composer: pick a template, edit the message for this person, tick
//    Email / SMS / WhatsApp, send. Email and SMS go through the server;
//    WhatsApp opens on this phone with the message ready.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { Send, MessageCircle, Cake } from 'lucide-react-native';
import { Alert } from '../../lib/appAlert';
import { supabase } from '../../lib/supabaseClient';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
import { getCeoSetting } from '../../lib/ceoSetting';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Input, { Field } from '../../components/ui/Input';
import Sheet from '../../components/ui/Sheet';
import Toggle from '../../components/ui/Toggle';
import SearchablePicker from '../../components/ui/SearchablePicker';
import CalendarPicker, { toKey, type CalendarValue } from '../../components/ui/CalendarPicker';
import { fillTemplate, type BirthdayTemplate } from './BirthdayTemplatesScreen';

interface Person { type: 'staff' | 'customer'; id: string; name: string; email: string | null; phone: string | null; photo: string | null; dob: string }
interface LogRow { person_type: string; person_id: string; email_sent: boolean; sms_sent: boolean; whatsapp_sent: boolean; message: string | null; sent_by: string | null; sent_at: string; email_note: string | null; sms_note: string | null }

// Month-day of a date of birth as it falls in `year` (29 Feb -> 28 Feb in
// years without a 29th).
function birthdayKeyIn(dob: string, year: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  let month = Number(m[2]);
  let day = Number(m[3]);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month === 2 && day === 29 && !leap) day = 28;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function whatsappDigits(phone: string): string {
  const s = phone.replace(/[^\d+]/g, '');
  if (s.startsWith('+')) return s.slice(1);
  if (s.startsWith('00')) return s.slice(2);
  if (s.startsWith('0')) return `233${s.slice(1)}`;
  return s;
}

export default function BirthdaysScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [masterOn, setMasterOn] = useState(true);
  const [autoSend, setAutoSend] = useState(true);
  const [sendTime, setSendTime] = useState('08:00');
  const [timeDraft, setTimeDraft] = useState('08:00');
  const [month, setMonth] = useState(new Date());
  const [selection, setSelection] = useState<CalendarValue>({ start: toKey(new Date()), end: toKey(new Date()) });
  const [refreshing, setRefreshing] = useState(false);

  const [composeFor, setComposeFor] = useState<Person | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const year = month.getFullYear();

  const load = useCallback(async () => {
    const [{ data: staff }, { data: customers }, { data: tpl }, { data: settings }, master] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, photo, date_of_birth, status').not('date_of_birth', 'is', null),
      supabase.from('customers').select('*').not('date_of_birth', 'is', null),
      supabase.from('birthday_templates').select('*').order('created_at', { ascending: true }),
      supabase.from('birthday_settings').select('auto_send, send_time').eq('id', 'default').maybeSingle(),
      getCeoSetting<boolean>('birthday_wishes_enabled', true),
    ]);
    // Staff without the app get birthday wishes too (their record is
    // non_app_staff; they are 'staff' with their own id).
    const { data: otherStaff } = await supabase.from('non_app_staff').select('id, full_name, phone, photo, date_of_birth, status').not('date_of_birth', 'is', null);
    setPeople([
      ...[...(staff || []), ...((otherStaff as any[]) || [])].filter((p: any) => String(p.status || '').toUpperCase() === 'ACTIVE')
        .map((p: any) => ({ type: 'staff' as const, id: String(p.id), name: p.full_name || '', email: p.email || null, phone: p.phone || null, photo: p.photo || null, dob: p.date_of_birth })),
      ...(customers || []).map((c: any) => ({ type: 'customer' as const, id: String(c.id), name: c.name || '', email: c.email || null, phone: c.phone || null, photo: c.customer_photo || c.photo || null, dob: c.date_of_birth })),
    ]);
    setTemplates((tpl as BirthdayTemplate[]) || []);
    if (settings) {
      setAutoSend(settings.auto_send !== false);
      setSendTime(settings.send_time || '08:00');
      setTimeDraft(settings.send_time || '08:00');
    }
    setMasterOn(master !== false);
    setRefreshing(false);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from('birthday_wishes_log').select('*').eq('wish_year', year);
    setLogs((data as LogRow[]) || []);
  }, [year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Birthday dots for the month on screen.
  const byDay = useMemo(() => {
    const map: Record<string, Person[]> = {};
    for (const p of people) {
      const key = birthdayKeyIn(p.dob, year);
      if (key) (map[key] = map[key] || []).push(p);
    }
    return map;
  }, [people, year]);
  const marks = useMemo(() => Object.fromEntries(Object.keys(byDay).map((k) => [k, { color: t.colors.action.rose }])), [byDay, t]);

  const selectedKey = selection.start || toKey(new Date());
  const dayPeople = byDay[selectedKey] || [];
  const logFor = (p: Person) => logs.find((l) => l.person_type === p.type && l.person_id === p.id);

  const saveSettings = async (next: { auto_send?: boolean; send_time?: string }) => {
    const { error } = await supabase.from('birthday_settings').upsert({
      id: 'default', auto_send: next.auto_send ?? autoSend, send_time: next.send_time ?? sendTime,
      updated_by: profile?.fullName || 'HR', updated_at: new Date().toISOString(),
    });
    if (error) { Alert.alert('Could not save', error.message); return false; }
    return true;
  };

  const openCompose = (p: Person) => {
    const usable = templates.filter((tpl) => tpl.audience === p.type || tpl.audience === 'both');
    const def = usable.find((tpl) => tpl.is_default && tpl.audience === p.type) || usable.find((tpl) => tpl.is_default) || usable[0];
    setComposeFor(p);
    setTemplateId(def?.id || '');
    setSubject(def ? fillTemplate(def.email_subject, p.name) : 'Happy birthday from Rebma Impex');
    setMessage(def ? fillTemplate(def.body, p.name) : '');
    setChannels((def?.channels || ['email', 'sms']).filter((c) => (c === 'email' ? !!p.email : !!p.phone)));
  };

  const pickTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id);
    setTemplateId(id);
    if (tpl && composeFor) {
      setSubject(fillTemplate(tpl.email_subject, composeFor.name));
      setMessage(fillTemplate(tpl.body, composeFor.name));
      setChannels(tpl.channels.filter((c) => (c === 'email' ? !!composeFor.email : !!composeFor.phone)));
    }
  };

  const toggle = (c: string) => setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const send = async () => {
    const p = composeFor;
    if (!p) return;
    if (!message.trim()) { Alert.alert('Missing Info', 'Write the message first.'); return; }
    if (!channels.length) { Alert.alert('Missing Info', 'Tick at least one way to send it.'); return; }
    setSending(true);
    const notes: string[] = [];
    try {
      const serverChannels = channels.filter((c) => c !== 'whatsapp');
      if (serverChannels.length) {
        const res: any = await callPrivilegedApi('/api/birthday-send', {
          personType: p.type, personId: p.id, templateId: templateId || null, subject, message: message.trim(), channels: serverChannels, year,
        });
        notes.push(res?.message || '');
      }
      if (channels.includes('whatsapp') && p.phone) {
        Linking.openURL(`https://wa.me/${whatsappDigits(p.phone)}?text=${encodeURIComponent(message.trim())}`);
        await supabase.from('birthday_wishes_log').upsert(
          { person_type: p.type, person_id: p.id, person_name: p.name, wish_year: year, whatsapp_sent: true, message: message.trim(), template_id: templateId || null, sent_by: profile?.fullName || 'HR', sent_at: new Date().toISOString() },
          { onConflict: 'person_type,person_id,wish_year' },
        );
        notes.push('WhatsApp opened with the message ready.');
      }
      setComposeFor(null);
      loadLogs();
      Alert.alert('Birthday wish', notes.filter(Boolean).join(' ') || 'Sent.');
    } catch (e: any) {
      Alert.alert('Could not send', e instanceof ApiNotConfiguredError ? e.message : (e.message || 'Something went wrong.'));
    } finally {
      setSending(false);
    }
  };

  const muted = { fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted };
  const dayLabel = new Date(`${selectedKey}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); loadLogs(); }}>
      <View style={{ gap: t.spacing.md }}>
        {!masterOn && (
          <Card tone="soft">
            <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.status.danger.text }}>
              Birthday wishes are switched off by the CEO in Control Center, so nothing can be sent right now.
            </Text>
          </Card>
        )}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>Send automatically</Text>
              <Text style={muted}>Each birthday person gets the default template by email and SMS at the time below. Turn off to send by hand.</Text>
            </View>
            <Toggle value={autoSend} onChange={async (v) => { setAutoSend(v); if (!(await saveSettings({ auto_send: v }))) setAutoSend(!v); }} />
          </View>
          {autoSend && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm, marginTop: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Field label="Sending time (24-hour)">
                  <Input value={timeDraft} onChangeText={setTimeDraft} placeholder="08:00" keyboardType="numbers-and-punctuation" />
                </Field>
              </View>
              <Button label="Save" size="sm" disabled={timeDraft === sendTime} onPress={async () => {
                const v = timeDraft.trim();
                if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { Alert.alert('Check the time', 'Use 24-hour time like 08:00 or 14:30.'); return; }
                if (await saveSettings({ send_time: v })) { setSendTime(v); Alert.alert('Saved', `Wishes go out at ${v}.`); }
              }} />
            </View>
          )}
          {!templates.some((x) => x.is_default) && (
            <Text style={{ ...muted, color: t.colors.status.warning.text, marginTop: t.spacing.xs }}>
              No default template yet, so nothing can go out automatically. Set one in Birthday Templates.
            </Text>
          )}
        </Card>

        <Card>
          <CalendarPicker month={month} onMonthChange={setMonth} value={selection} onChange={setSelection} marks={marks} />
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Cake size={16} color={t.colors.action.rose} />
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{dayLabel}</Text>
        </View>

        {dayPeople.length === 0 ? (
          <Text style={muted}>No birthdays on this day. Days with a dot on the calendar have birthdays.</Text>
        ) : dayPeople.map((p) => {
          const log = logFor(p);
          return (
            <Card key={`${p.type}-${p.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <Avatar name={p.name} photo={p.photo} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{p.name}</Text>
                  <Text style={muted}>{p.type === 'staff' ? 'Staff' : 'Customer'} · {p.phone || 'no phone'} · {p.email || 'no email'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: t.spacing.sm }}>
                <Badge tone={log?.email_sent ? 'success' : 'muted'} label={log?.email_sent ? 'EMAIL SENT' : 'NO EMAIL YET'} size="xs" />
                <Badge tone={log?.sms_sent ? 'success' : 'muted'} label={log?.sms_sent ? 'SMS SENT' : 'NO SMS YET'} size="xs" />
                <Badge tone={log?.whatsapp_sent ? 'success' : 'muted'} label={log?.whatsapp_sent ? 'WHATSAPP SENT' : 'NO WHATSAPP YET'} size="xs" />
              </View>
              {log?.message ? (
                <Text style={{ ...muted, marginTop: 6 }}>Sent by {log.sent_by || 'HR'}: "{log.message}"</Text>
              ) : null}
              {(log?.email_note || log?.sms_note) ? (
                <Text style={{ ...muted, color: t.colors.status.danger.text, marginTop: 4 }}>{[log.email_note, log.sms_note].filter(Boolean).join(' ')}</Text>
              ) : null}
              <View style={{ alignItems: 'flex-start', marginTop: t.spacing.sm }}>
                <Button label={log ? 'Send again' : 'Send wish'} size="sm" icon={<Send size={12} color="#fff" />} onPress={() => openCompose(p)} disabled={!masterOn} />
              </View>
            </Card>
          );
        })}
      </View>

      <Sheet open={!!composeFor} onClose={() => setComposeFor(null)} title="Send Birthday Wish" subtitle={composeFor?.name} side="bottom" maxHeight={760}
        footer={<Button label={sending ? 'Sending…' : 'Send'} onPress={send} loading={sending} disabled={sending} fullWidth />}>
        {composeFor && (
          <View>
            <Field label="Template">
              <SearchablePicker
                value={templateId}
                onChange={pickTemplate}
                placeholder={templates.length ? 'Pick a template' : 'No templates yet'}
                options={templates.filter((x) => x.audience === composeFor.type || x.audience === 'both').map((x) => ({ value: x.id, label: x.is_default ? `${x.name} (default)` : x.name }))}
              />
            </Field>
            <Field label="Email subject"><Input value={subject} onChangeText={setSubject} placeholder="Happy birthday from Rebma Impex" /></Field>
            <Field label={`Message for ${composeFor.name.split(' ')[0] || 'them'}`} hint="Change anything just for this person.">
              <Input value={message} onChangeText={setMessage} multiline numberOfLines={5} style={{ minHeight: 110, textAlignVertical: 'top' }} placeholder="Write the birthday message" />
            </Field>
            <Field label="Send by">
              <View style={{ gap: t.spacing.xs }}>
                {[
                  { key: 'email', label: 'Email', ok: !!composeFor.email, why: 'no email on file' },
                  { key: 'sms', label: 'SMS', ok: !!composeFor.phone, why: 'no phone on file' },
                  { key: 'whatsapp', label: 'WhatsApp (opens on this phone)', ok: !!composeFor.phone, why: 'no phone on file' },
                ].map((c) => (
                  <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: c.ok ? t.colors.textPrimary : t.colors.textMuted }}>
                      {c.label}{c.ok ? '' : ` (${c.why})`}
                    </Text>
                    <Toggle value={channels.includes(c.key)} onChange={() => c.ok && toggle(c.key)} />
                  </View>
                ))}
              </View>
            </Field>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={13} color={t.colors.textMuted} />
              <Text style={muted}>Email and SMS go out straight away. WhatsApp opens with the message ready; you tap send there.</Text>
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
