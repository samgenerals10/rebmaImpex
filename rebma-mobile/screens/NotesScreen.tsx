// rebma-mobile/screens/NotesScreen.tsx
//
// "My Notes" on the phone. Ports rebma-web/src/components/global/NotesPanel.tsx
// against the same `notes` table: your own notes plus notes your
// department shared, search, All / Personal / Shared filter, five colours,
// pin, share with my department, edit and delete (your own notes only;
// shared notes from colleagues are read only). Reached from the Profile tab.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Alert } from '../lib/appAlert';
import { StickyNote, Pin, Pencil, Trash2, Share2, Plus } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import Tabs from '../components/ui/Tabs';
import Toggle from '../components/ui/Toggle';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import SearchSortBar from '../components/ui/SearchSortBar';

interface Note {
  id: string; user_id: string; department: string; title: string; content: string;
  color: string; pinned: boolean; shared_with_department: boolean; created_at: string;
}

// Same five colours as web.
const COLORS = [
  { id: 'yellow', bg: '#fef9c3', border: '#fde68a', text: '#713f12' },
  { id: 'blue', bg: '#dbeafe', border: '#bfdbfe', text: '#1e3a8a' },
  { id: 'green', bg: '#dcfce7', border: '#bbf7d0', text: '#14532d' },
  { id: 'pink', bg: '#fce7f3', border: '#fbcfe8', text: '#831843' },
  { id: 'purple', bg: '#ede9fe', border: '#ddd6fe', text: '#4c1d95' },
];
const colorOf = (id: string) => COLORS.find((c) => c.id === id) || COLORS[0];

const blankForm = { id: '', title: '', content: '', color: 'yellow', shared: false };

export default function NotesScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id || '';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'personal' | 'shared'>('all');
  const [form, setForm] = useState(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .or(`user_id.eq.${profile.id},and(shared_with_department.eq.true,department.eq.${profile.department})`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setNotes(data as Note[]);
    setLoading(false);
    setRefreshing(false);
  }, [profile?.id, profile?.department]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(blankForm); setFormOpen(true); };
  const openEdit = (n: Note) => { setForm({ id: n.id, title: n.title, content: n.content, color: n.color, shared: n.shared_with_department }); setFormOpen(true); };

  const save = async () => {
    if (!profile || !form.title.trim() || saving) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from('notes').update({
          title: form.title.trim(), content: form.content, color: form.color,
          shared_with_department: form.shared, updated_at: new Date().toISOString(),
        }).eq('id', form.id).eq('user_id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('notes').insert({
          user_id: profile.id, department: profile.department,
          title: form.title.trim(), content: form.content, color: form.color,
          shared_with_department: form.shared,
        });
        if (error) throw error;
      }
      setFormOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Could not save note', e?.message || 'Unknown error.');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (n: Note) => {
    if (n.user_id !== myId) return;
    await supabase.from('notes').update({ pinned: !n.pinned }).eq('id', n.id).eq('user_id', myId);
    load();
  };

  const remove = (n: Note) => {
    Alert.alert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('notes').delete().eq('id', n.id).eq('user_id', myId);
        load();
      } },
    ]);
  };

  const q = search.toLowerCase();
  const visible = notes.filter((n) => {
    const matchSearch = n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'personal' && !n.shared_with_department) || (filter === 'shared' && n.shared_with_department);
    return matchSearch && matchFilter;
  });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      footer={<View style={{ padding: t.spacing.lg }}><Button label="New Note" icon={<Plus size={14} color="#fff" />} onPress={openNew} fullWidth /></View>}
    >
      <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
        <SearchSortBar value={search} onChangeText={setSearch} placeholder="Search notes…" />
        <Tabs
          variant="segmented"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[{ value: 'all', label: 'All' }, { value: 'personal', label: 'Personal' }, { value: 'shared', label: 'Shared' }]}
        />
      </View>

      {loading ? (
        <SkeletonList rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<StickyNote size={22} color={t.colors.textMuted} />} title="No notes yet" description="Tap New Note to capture something." />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {visible.map((n) => {
            const c = colorOf(n.color);
            const isOwn = n.user_id === myId;
            return (
              <View key={n.id} style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: t.radius.lg, padding: t.spacing.md, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm }}>
                  {n.pinned && <Pin size={13} color={c.text} fill={c.text} style={{ marginTop: 2 }} />}
                  <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body14.size, color: c.text }}>{n.title}</Text>
                  {isOwn && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={() => togglePin(n)} hitSlop={8} accessibilityLabel={n.pinned ? 'Unpin' : 'Pin'}>
                        <Pin size={15} color={c.text} fill={n.pinned ? c.text : 'transparent'} />
                      </Pressable>
                      <Pressable onPress={() => openEdit(n)} hitSlop={8} accessibilityLabel="Edit"><Pencil size={15} color={c.text} /></Pressable>
                      <Pressable onPress={() => remove(n)} hitSlop={8} accessibilityLabel="Delete"><Trash2 size={15} color={c.text} /></Pressable>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: c.text, opacity: 0.85 }} numberOfLines={4}>{n.content || 'No content'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: c.text, opacity: 0.6 }}>
                    {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {n.shared_with_department && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.border, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                        <Share2 size={9} color={c.text} />
                        <Text style={{ fontFamily: t.font.bold, fontSize: 9, color: c.text }}>Shared · {n.department}</Text>
                      </View>
                    )}
                    {!isOwn && <Text style={{ fontFamily: t.font.semibold, fontSize: 9, color: c.text, opacity: 0.6 }}>Read only</Text>}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Edit Note' : 'New Note'}
        side="bottom"
        maxHeight={640}
        footer={<Button label={saving ? 'Saving…' : 'Save'} onPress={save} loading={saving} disabled={saving || !form.title.trim()} fullWidth />}
      >
        <Field label="Title"><Input value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} placeholder="Note title" /></Field>
        <Field label="Note">
          <Input value={form.content} onChangeText={(v) => setForm((f) => ({ ...f, content: v }))} multiline numberOfLines={5} placeholder="Write your note…" style={{ minHeight: 110, textAlignVertical: 'top' }} />
        </Field>
        <Field label="Colour">
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {COLORS.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setForm((f) => ({ ...f, color: c.id }))}
                accessibilityLabel={c.id}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.bg, borderWidth: 2, borderColor: form.color === c.id ? c.text : c.border }}
              />
            ))}
          </View>
        </Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Share with my department</Text>
          <Toggle value={form.shared} onChange={(v) => setForm((f) => ({ ...f, shared: v }))} />
        </View>
      </Sheet>
    </Screen>
  );
}
