// rebma-mobile/screens/EmailsScreen.tsx
//
// Internal email on the phone. Ports rebma-web/src/components/global/EmailsPanel.tsx
// against the same `internal_emails` table: Inbox (with an unread count),
// Sent, Starred and Trash, search, read an email (marks it read), star,
// reply, move to trash, delete for good from Trash, and compose to any
// active colleague. Sending respects the CEO's external_email_enabled
// switch, as on web. Reached from the Profile tab.
//
// Starring, trashing and deleting only change YOUR copy of an email (each
// side has its own flags, supabase_private_data_security.sql). The email
// is removed for real once both people have deleted it for good.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Alert } from '../lib/appAlert';
import { Mail, Star, Trash2, Reply, PenSquare } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { getCeoSetting } from '../lib/ceoSetting';
import { newRequestKey } from '../lib/requestKey';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import Tabs from '../components/ui/Tabs';
import SearchablePicker from '../components/ui/SearchablePicker';
import SearchSortBar from '../components/ui/SearchSortBar';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';

interface Email {
  id: string; from_user_id: string; to_user_id: string; subject: string; body: string;
  read: boolean; reply_to_id: string | null; created_at: string;
  sender_starred?: boolean; recipient_starred?: boolean;
  sender_deleted?: boolean; recipient_deleted?: boolean;
}
interface Person { id: string; full_name: string; department: string }
type Folder = 'inbox' | 'sent' | 'starred' | 'trash';

const blankCompose = { to: '', subject: '', body: '', replyToId: null as string | null };

const sideOf = (e: Email, me: string): 'sender' | 'recipient' => (e.from_user_id === me ? 'sender' : 'recipient');
const isStarred = (e: Email, me: string) => !!(sideOf(e, me) === 'sender' ? e.sender_starred : e.recipient_starred);
const isDeleted = (e: Email, me: string) => !!(sideOf(e, me) === 'sender' ? e.sender_deleted : e.recipient_deleted);

export default function EmailsScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id || '';

  const [emails, setEmails] = useState<Email[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Email | null>(null);
  const [compose, setCompose] = useState(blankCompose);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data }, { data: profs }] = await Promise.all([
      supabase.from('internal_emails').select('*').or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`).order('created_at', { ascending: false }),
      supabase.from('profiles_directory').select('id, full_name, department').eq('status', 'ACTIVE').neq('id', profile.id),
    ]);
    if (data) setEmails(data as Email[]);
    if (profs) setPeople(profs as Person[]);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const nameOf = (id: string) => (id === myId ? 'You' : people.find((p) => p.id === id)?.full_name || 'Former staff');

  const q = search.toLowerCase();
  const inFolder = emails.filter((e) => {
    const inbound = e.to_user_id === myId;
    const outbound = e.from_user_id === myId;
    if (!(e.subject.toLowerCase().includes(q) || (e.body || '').toLowerCase().includes(q))) return false;
    if (folder === 'inbox') return inbound && !e.recipient_deleted;
    if (folder === 'sent') return outbound && !e.sender_deleted;
    if (folder === 'starred') return isStarred(e, myId) && !isDeleted(e, myId);
    return isDeleted(e, myId);
  });
  const unread = emails.filter((e) => e.to_user_id === myId && !e.read && !e.recipient_deleted).length;

  const open = async (e: Email) => {
    setSelected(e);
    if (e.to_user_id === myId && !e.read) {
      await supabase.from('internal_emails').update({ read: true }).eq('id', e.id);
      load();
    }
  };

  const toggleStar = async (e: Email) => {
    const key = `${sideOf(e, myId)}_starred`;
    const { error } = await supabase.from('internal_emails').update({ [key]: !isStarred(e, myId) }).eq('id', e.id);
    if (error) { Alert.alert('Could not update', error.message); return; }
    load();
  };

  const trash = async (e: Email) => {
    const { error } = await supabase.from('internal_emails').update({ [`${sideOf(e, myId)}_deleted`]: true }).eq('id', e.id);
    if (error) { Alert.alert('Could not move to Trash', error.message); return; }
    setSelected(null);
    load();
  };

  const deleteForGood = (e: Email) => {
    Alert.alert('Delete email?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('internal_emails').update({ [`${sideOf(e, myId)}_purged`]: true }).eq('id', e.id);
        if (error) { Alert.alert('Could not delete', error.message); return; }
        setSelected(null);
        load();
      } },
    ]);
  };

  // One key per message being written: tapping Send twice, or retrying
  // after a dropped connection, can't send it twice.
  const emailKeyRef = useRef(newRequestKey());

  const openCompose = (replyTo?: Email) => {
    emailKeyRef.current = newRequestKey();
    setSelected(null);
    setCompose(replyTo ? { to: replyTo.from_user_id, subject: `Re: ${replyTo.subject}`, body: '', replyToId: replyTo.id } : blankCompose);
    // Let the reading sheet close before the compose sheet opens (iOS
    // can't show two sheets at once).
    setTimeout(() => setComposeOpen(true), replyTo ? 350 : 0);
  };

  const send = async () => {
    if (!profile || !compose.to || !compose.subject.trim() || sending) return;
    if (!(await getCeoSetting('external_email_enabled', true))) {
      Alert.alert('Email is off', 'Internal email is currently disabled by the CEO.');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('internal_emails').insert({
      from_user_id: profile.id, to_user_id: compose.to,
      subject: compose.subject.trim(), body: compose.body, reply_to_id: compose.replyToId,
      client_request_id: emailKeyRef.current,
    });
    setSending(false);
    if (error) { Alert.alert('Not sent', error.message); return; }
    setComposeOpen(false);
    setCompose(blankCompose);
    load();
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="Compose" icon={<PenSquare size={14} color="#fff" />} onPress={() => openCompose()} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
        <Tabs
          variant="segmented"
          value={folder}
          onChange={(v) => setFolder(v as Folder)}
          options={[
            { value: 'inbox', label: 'Inbox', badge: unread || undefined },
            { value: 'sent', label: 'Sent' },
            { value: 'starred', label: 'Starred' },
            { value: 'trash', label: 'Trash' },
          ]}
        />
        <SearchSortBar value={search} onChangeText={setSearch} placeholder="Search emails…" />
      </View>

      {loading ? (
        <SkeletonList rows={5} />
      ) : inFolder.length === 0 ? (
        <EmptyState icon={<Mail size={22} color={t.colors.textMuted} />} title="Nothing here" description={folder === 'inbox' ? 'Emails from colleagues will show up here.' : 'No emails in this folder.'} />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {inFolder.map((e) => {
            const unreadRow = e.to_user_id === myId && !e.read;
            const other = e.from_user_id === myId ? `To ${nameOf(e.to_user_id)}` : nameOf(e.from_user_id);
            return (
              <Pressable key={e.id} onPress={() => open(e)}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    {unreadRow && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.accent }} />}
                    <Text style={{ flex: 1, fontFamily: unreadRow ? t.font.bold : t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }} numberOfLines={1}>{other}</Text>
                    <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted }}>
                      {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Pressable onPress={() => toggleStar(e)} hitSlop={8} accessibilityLabel={isStarred(e, myId) ? 'Unstar' : 'Star'}>
                      <Star size={15} color={isStarred(e, myId) ? t.colors.action.amber : t.colors.textMuted} fill={isStarred(e, myId) ? t.colors.action.amber : 'transparent'} />
                    </Pressable>
                  </View>
                  <Text style={{ fontFamily: unreadRow ? t.font.bold : t.font.medium, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginTop: 4 }} numberOfLines={1}>{e.subject}</Text>
                  <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }} numberOfLines={2}>{e.body}</Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject || ''}
        subtitle={selected ? `From ${nameOf(selected.from_user_id)} to ${nameOf(selected.to_user_id)} · ${new Date(selected.created_at).toLocaleString()}` : ''}
        side="bottom"
        maxHeight={680}
        footer={selected ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {selected.from_user_id !== myId && !isDeleted(selected, myId) && (
              <View style={{ flex: 1 }}><Button label="Reply" icon={<Reply size={14} color="#fff" />} onPress={() => openCompose(selected)} fullWidth /></View>
            )}
            <View style={{ flex: 1 }}>
              {isDeleted(selected, myId)
                ? <Button label="Delete for good" variant="danger" icon={<Trash2 size={14} color="#fff" />} onPress={() => deleteForGood(selected)} fullWidth />
                : <Button label="Move to Trash" variant="ghost" icon={<Trash2 size={14} color={t.colors.textSecondary} />} onPress={() => trash(selected)} fullWidth />}
            </View>
          </View>
        ) : undefined}
      >
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body14.size, color: t.colors.textPrimary, lineHeight: 21 }}>{selected?.body || 'No message.'}</Text>
      </Sheet>

      <Sheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title={compose.replyToId ? 'Reply' : 'New Email'}
        side="bottom"
        maxHeight={720}
        footer={<Button label={sending ? 'Sending…' : 'Send'} onPress={send} loading={sending} disabled={sending || !compose.to || !compose.subject.trim()} fullWidth />}
      >
        <Field label="To">
          <SearchablePicker
            value={compose.to}
            onChange={(v) => setCompose((c) => ({ ...c, to: v }))}
            placeholder="Choose a colleague"
            options={people.map((p) => ({ value: p.id, label: p.full_name, sublabel: p.department }))}
          />
        </Field>
        <Field label="Subject"><Input value={compose.subject} onChangeText={(v) => setCompose((c) => ({ ...c, subject: v }))} placeholder="Subject" /></Field>
        <Field label="Message">
          <Input value={compose.body} onChangeText={(v) => setCompose((c) => ({ ...c, body: v }))} multiline numberOfLines={6} placeholder="Write your message…" style={{ minHeight: 130, textAlignVertical: 'top' }} />
        </Field>
      </Sheet>
    </Screen>
  );
}
